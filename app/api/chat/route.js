import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { searchMemories, processMessage, isChatSorterEnabled, buildScopedChatId } from "../../../src/lib/chatsorter.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Sliding-window rate limiter (25 requests per 60s per user/IP)
const rateLimitBucket = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 25;

function checkRateLimit(key) {
  const now = Date.now();
  const entry = rateLimitBucket.get(key) || [];
  const recent = entry.filter(ts => now - ts < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    rateLimitBucket.set(key, recent);
    return false;
  }
  recent.push(now);
  rateLimitBucket.set(key, recent);
  return true;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

function extractText(response) {
  if (response?.candidates && response.candidates[0]?.content?.parts) {
    const parts = response.candidates[0].content.parts;
    const nonThought = parts.filter(p => !p.thought && p.text);
    if (nonThought.length > 0) {
      return nonThought.map(p => p.text).join("\n").trim();
    }
  }
  if (typeof response?.text === "string" && response.text.trim()) {
    return response.text.trim();
  }
  if (response?.candidates && response.candidates[0]?.content?.parts) {
    const anyText = response.candidates[0].content.parts
      .filter(p => p.text)
      .map(p => p.text)
      .join("\n")
      .trim();
    if (anyText) return anyText;
  }
  return "";
}

/**
 * Normalizes conversation history for Gemini:
 * 1. Filters empty messages
 * 2. Merges consecutive turns with the same role (Gemini rejects consecutive 'user' or 'model' roles)
 * 3. Ensures the conversation starts with a 'user' role
 */
function normalizeGeminiContents(messages) {
  const raw = (messages || [])
    .map(m => ({
      role: m.role === "assistant" || m.role === "model" ? "model" : "user",
      text: String(m.content || "").trim(),
    }))
    .filter(m => m.text.length > 0);

  const merged = [];
  for (const item of raw) {
    if (merged.length > 0 && merged[merged.length - 1].role === item.role) {
      merged[merged.length - 1].parts[0].text += `\n${item.text}`;
    } else {
      merged.push({
        role: item.role,
        parts: [{ text: item.text }],
      });
    }
  }

  // Gemini requires the first turn in contents to be from 'user'
  while (merged.length > 0 && merged[0].role !== "user") {
    merged.shift();
  }

  return merged;
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes("your_supabase_url")) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { messages, systemPrompt, maxTokens, chatId, userId } = body;
    let planTier = body.planTier || "free";

    // ── Rate Limiting (25 req/min) ──────────────────────────────────
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
    const rateKey = userId ? `user:${userId}` : `ip:${clientIp}`;

    if (!checkRateLimit(rateKey)) {
      return Response.json(
        {
          reply: "You're sending messages too quickly! Please wait a moment and try again.",
          error: "RATE_LIMIT_EXCEEDED",
        },
        { headers: corsHeaders, status: 429 }
      );
    }

    // Verify true planTier from Supabase if userId is provided
    if (userId) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("plan_tier")
          .eq("id", userId)
          .maybeSingle();
        if (profile?.plan_tier) {
          planTier = profile.plan_tier;
        }
      }
    }

    const apiKey = (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes("your_"))
      ? process.env.GEMINI_API_KEY
      : (process.env.GOOGLE_API_KEY && !process.env.GOOGLE_API_KEY.includes("your_"))
        ? process.env.GOOGLE_API_KEY
        : "";

    const formattedContents = normalizeGeminiContents(messages);
    if (formattedContents.length === 0) {
      return Response.json({ reply: "" }, { headers: corsHeaders });
    }

    // ── Tenant-Isolated ChatSorter AI Memory Layer ─────────────────
    const scopedChatId = chatId ? buildScopedChatId(userId, chatId) : "";
    let effectiveSystemPrompt = systemPrompt || "";
    let recalledMemories = [];
    const lastUserMessage = [...(messages || [])].reverse().find(m => m.role === "user")?.content;

    if (scopedChatId && lastUserMessage && isChatSorterEnabled()) {
      try {
        recalledMemories = await searchMemories(scopedChatId, lastUserMessage, 4000);
        if (recalledMemories.length > 0) {
          effectiveSystemPrompt += `\n\n[Persistent Long-Term Memories about this User (from ChatSorter)]:\n${recalledMemories.map(m => `- ${m}`).join("\n")}\nUse these memories naturally when relevant to maintain continuity.`;
        }
      } catch (err) {
        console.warn("ChatSorter memory recall failed (continuing without memory):", err);
      }
    }

    if (!apiKey) {
      if (process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.includes("your_")) {
        return handleGroqFallback(messages, effectiveSystemPrompt, maxTokens, recalledMemories);
      }

      return Response.json(
        {
          reply: "AI API key is not configured. Please add GEMINI_API_KEY or GROQ_API_KEY to your .env.local file (or Vercel Environment Variables).",
          error: "Missing API Key",
        },
        { headers: corsHeaders, status: 200 }
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    // Valid production Gemini models ordered for speed, intelligence and quota
    const modelsToTry = (planTier === "plus" || planTier === "pro")
      ? [
          "gemini-2.5-flash",
          "gemini-2.0-flash",
          "gemini-2.5-flash-lite",
          "gemini-flash-lite-latest",
          "gemini-1.5-flash",
          "gemini-3.5-flash",
          "gemini-3.5-flash-lite",
        ]
      : [
          "gemini-2.5-flash-lite",
          "gemini-2.5-flash",
          "gemini-2.0-flash",
          "gemini-flash-lite-latest",
          "gemini-1.5-flash",
          "gemini-3.5-flash-lite",
        ];

    let lastError = null;
    let replyText = "";
    let modelUsed = "";

    for (const model of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: formattedContents,
          config: {
            systemInstruction: effectiveSystemPrompt || undefined,
            maxOutputTokens: Math.max(maxTokens || 0, 1000),
          },
        });

        replyText = extractText(response);
        if (replyText) {
          modelUsed = model;
          break;
        }
      } catch (err) {
        lastError = err;
        console.warn(`Model ${model} failed, trying next candidate:`, err?.message || err);
      }
    }

    if (replyText) {
      if (scopedChatId && isChatSorterEnabled()) {
        Promise.all([
          lastUserMessage ? processMessage(scopedChatId, lastUserMessage) : Promise.resolve(),
          processMessage(scopedChatId, replyText),
        ]).catch(err => console.warn("ChatSorter background memory index error:", err));
      }

      return Response.json(
        {
          reply: replyText,
          memoriesRecalled: recalledMemories,
          modelUsed,
        },
        { headers: corsHeaders }
      );
    }

    if (process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.includes("your_")) {
      console.log("Gemini attempts exhausted, trying Groq fallback...");
      return handleGroqFallback(messages, effectiveSystemPrompt, maxTokens, recalledMemories);
    }

    return Response.json(
      {
        reply: "Sorry, I couldn't generate a response right now. Please check your GEMINI_API_KEY or GROQ_API_KEY quota.",
        error: lastError?.message || "All candidate models failed",
      },
      { headers: corsHeaders }
    );

  } catch (err) {
    console.error("Chat route error:", err);
    return Response.json(
      { reply: "An internal error occurred while processing your message.", error: err.message },
      { headers: corsHeaders, status: 500 }
    );
  }
}

async function handleGroqFallback(messages, systemPrompt, maxTokens, memoriesRecalled = []) {
  const cleanMessages = (messages || [])
    .filter(m => m && String(m.content || "").trim())
    .map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content).trim(),
    }));

  const groqModels = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"];
  let lastGroqError = null;

  for (const model of groqModels) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY.trim()}`,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens || 600,
          messages: [
            ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
            ...cleanMessages,
          ],
        }),
      });

      const data = await res.json();
      if (data.choices?.[0]?.message?.content) {
        return Response.json({
          reply: data.choices[0].message.content,
          memoriesRecalled,
          modelUsed: `groq/${model}`,
        }, { headers: corsHeaders });
      }
      lastGroqError = data;
    } catch (err) {
      lastGroqError = err;
    }
  }

  return Response.json({
    reply: "AI service temporarily unavailable.",
    error: lastGroqError?.message || lastGroqError,
  }, { headers: corsHeaders });
}
