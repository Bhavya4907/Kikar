import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import { searchMemories, processMessage, isChatSorterEnabled, buildScopedChatId } from "../../../src/lib/chatsorter.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Sliding-window rate limiter (15 requests per 60s per user/IP)
const rateLimitBucket = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 15;

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
  if (response.candidates && response.candidates[0]?.content?.parts) {
    const parts = response.candidates[0].content.parts;
    const nonThought = parts.filter(p => !p.thought && p.text);
    if (nonThought.length > 0) {
      return nonThought.map(p => p.text).join("\n").trim();
    }
  }
  if (response.text) return response.text;
  if (response.candidates && response.candidates[0]?.content?.parts) {
    const anyText = response.candidates[0].content.parts
      .filter(p => p.text)
      .map(p => p.text)
      .join("\n")
      .trim();
    if (anyText) return anyText;
  }
  return "";
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

    // ── Rate Limiting (15 req/min) ──────────────────────────────────
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
    const rateKey = userId ? `user:${userId}` : `ip:${clientIp}`;

    if (!checkRateLimit(rateKey)) {
      return Response.json(
        {
          reply: "You're sending messages too quickly! Please wait a moment or upgrade to Kikar Pro for higher throughput.",
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

    if (!apiKey) {
      if (process.env.GROQ_API_KEY && !process.env.GROQ_API_KEY.includes("your_")) {
        return handleGroqFallback(messages, systemPrompt, maxTokens);
      }

      return Response.json(
        {
          reply: "Gemini API key is not configured. Please add GEMINI_API_KEY to your .env.local file.",
          error: "Missing GEMINI_API_KEY",
        },
        { headers: corsHeaders, status: 200 }
      );
    }

    const formattedContents = (messages || []).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content || "") }],
    }));

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
        recalledMemories = await searchMemories(scopedChatId, lastUserMessage, 5000);
        if (recalledMemories.length > 0) {
          effectiveSystemPrompt += `\n\n[Persistent Long-Term Memories about this User (from ChatSorter)]:\n${recalledMemories.map(m => `- ${m}`).join("\n")}\nUse these memories naturally when relevant to maintain continuity.`;
        }
      } catch (err) {
        console.warn("ChatSorter memory recall failed (continuing without memory):", err);
      }
    }

    const ai = new GoogleGenAI({ apiKey });

    // Tier-aware model routing: Plus/Pro routes to high-capability Gemini 3.5 Flash first
    const modelsToTry = (planTier === "plus" || planTier === "pro")
      ? [
          "gemini-3.5-flash",
          "gemini-3.5-flash-lite",
          "gemini-flash-lite-latest",
          "gemma-4-31b-it",
        ]
      : [
          "gemini-3.5-flash-lite",
          "gemini-flash-lite-latest",
          "gemini-3.5-flash",
          "gemma-4-31b-it",
          "gemma-4-26b-a4b-it",
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
        reply: "Sorry, I couldn't generate a response from Gemini. Please check your API quota or model settings.",
        error: lastError?.message || "Unknown error",
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
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        max_tokens: maxTokens || 500,
        messages: [
          ...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []),
          ...(messages || []),
        ],
      }),
    });

    const data = await res.json();
    if (data.choices?.[0]?.message?.content) {
      return Response.json({
        reply: data.choices[0].message.content,
        memoriesRecalled,
        modelUsed: "groq/openai/gpt-oss-120b",
      }, { headers: corsHeaders });
    }
    return Response.json({ reply: "AI service temporarily unavailable.", error: data }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ reply: "Failed to connect to AI fallback.", error: err.message }, { headers: corsHeaders, status: 500 });
  }
}
