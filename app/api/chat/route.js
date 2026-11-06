import { GoogleGenAI } from "@google/genai";
import { searchMemories, processMessage, isChatSorterEnabled } from "../../../src/lib/chatsorter.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

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

export async function POST(request) {
  try {
    const { messages, systemPrompt, maxTokens, chatId } = await request.json();

    const apiKey = (process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes("your_"))
      ? process.env.GEMINI_API_KEY
      : (process.env.GOOGLE_API_KEY && !process.env.GOOGLE_API_KEY.includes("your_"))
        ? process.env.GOOGLE_API_KEY
        : "";

    if (!apiKey) {
      // Fallback to Groq if user still has GROQ_API_KEY
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

    // Format conversation messages for Gemini API
    const formattedContents = (messages || []).map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content || "") }],
    }));

    if (formattedContents.length === 0) {
      return Response.json({ reply: "" }, { headers: corsHeaders });
    }

    // ── 🧠 ChatSorter AI Memory Layer Integration ─────────────────────
    let effectiveSystemPrompt = systemPrompt || "";
    let recalledMemories = [];
    const lastUserMessage = [...(messages || [])].reverse().find(m => m.role === "user")?.content;

    if (chatId && lastUserMessage && isChatSorterEnabled()) {
      try {
        recalledMemories = await searchMemories(chatId, lastUserMessage);
        if (recalledMemories.length > 0) {
          effectiveSystemPrompt += `\n\n[Persistent Long-Term Memories about this User (from ChatSorter)]:\n${recalledMemories.map(m => `- ${m}`).join("\n")}\nUse these memories naturally when relevant to maintain continuity.`;
        }
      } catch (err) {
        console.warn("ChatSorter memory recall failed (continuing without memory):", err);
      }
    }

    const ai = new GoogleGenAI({ apiKey });

    const modelsToTry = [
      "gemini-3.5-flash-lite",
      "gemini-flash-lite-latest",
      "gemini-3.5-flash",
      "gemma-4-31b-it",
      "gemma-4-26b-a4b-it",
    ];

    let lastError = null;
    let replyText = "";

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
          break;
        }
      } catch (err) {
        lastError = err;
        console.warn(`Model ${model} failed, trying next candidate:`, err?.message || err);
      }
    }

    if (replyText) {
      // Asynchronously process the turn in ChatSorter background (non-blocking)
      if (chatId && isChatSorterEnabled()) {
        Promise.all([
          lastUserMessage ? processMessage(chatId, lastUserMessage) : Promise.resolve(),
          processMessage(chatId, replyText),
        ]).catch(err => console.warn("ChatSorter background memory index error:", err));
      }

      return Response.json(
        {
          reply: replyText,
          memoriesRecalled: recalledMemories,
        },
        { headers: corsHeaders }
      );
    }

    // If all Gemini candidates failed and Groq is present, attempt fallback
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
      }, { headers: corsHeaders });
    }
    return Response.json({ reply: "AI service temporarily unavailable.", error: data }, { headers: corsHeaders });
  } catch (err) {
    return Response.json({ reply: "Failed to connect to AI fallback.", error: err.message }, { headers: corsHeaders, status: 500 });
  }
}
