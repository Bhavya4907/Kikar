import { GoogleGenAI } from "@google/genai"
import { searchMemories, processMessage, isChatSorterEnabled, buildScopedChatId } from "../../../src/lib/chatsorter.js"
import { getAuthedUser, getSupabaseAdmin, isProduction, corsHeadersFor } from "../../../src/lib/serverAuth.js"
import { checkRateLimit } from "../../../src/lib/rateLimit.js"

const MAX_MESSAGES = 40
const MAX_MESSAGE_CHARS = 4000
const MAX_SYSTEM_PROMPT_CHARS = 8000
const MAX_OUTPUT_TOKENS = 2048

// Model cascades can be overridden from the environment (comma-separated) so a retired model
// never needs a code change. Retired / unreleased IDs were removed from the defaults.
function modelList(envName, fallback) {
  const raw = (process.env[envName] || "").split(",").map((s) => s.trim()).filter(Boolean)
  return raw.length ? raw : fallback
}
const PAID_MODELS = () =>
  modelList("GEMINI_CHAT_MODELS_PAID", [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-2.5-flash-lite",
    "gemini-flash-lite-latest",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite",
  ])
const FREE_MODELS = () =>
  modelList("GEMINI_CHAT_MODELS_FREE", [
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemini-flash-lite-latest",
    "gemini-1.5-flash",
    "gemini-3.5-flash-lite",
  ])

export async function OPTIONS(request) {
  return new Response(null, { status: 204, headers: corsHeadersFor(request) })
}

function extractText(response) {
  if (response?.candidates && response.candidates[0]?.content?.parts) {
    const parts = response.candidates[0].content.parts
    const nonThought = parts.filter((p) => !p.thought && p.text)
    if (nonThought.length > 0) {
      return nonThought.map((p) => p.text).join("\n").trim()
    }
  }
  if (typeof response?.text === "string" && response.text.trim()) {
    return response.text.trim()
  }
  if (response?.candidates && response.candidates[0]?.content?.parts) {
    const anyText = response.candidates[0].content.parts
      .filter((p) => p.text)
      .map((p) => p.text)
      .join("\n")
      .trim()
    if (anyText) return anyText
  }
  return ""
}

/**
 * Normalizes conversation history for Gemini:
 * 1. Filters empty messages
 * 2. Merges consecutive turns with the same role (Gemini rejects consecutive 'user' or 'model' roles)
 * 3. Ensures the conversation starts with a 'user' role
 */
function normalizeGeminiContents(messages) {
  const raw = (Array.isArray(messages) ? messages : [])
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m?.role === "assistant" || m?.role === "model" ? "model" : "user",
      text: String(m?.content || "").trim().slice(0, MAX_MESSAGE_CHARS),
    }))
    .filter((m) => m.text.length > 0)

  const merged = []
  for (const item of raw) {
    if (merged.length > 0 && merged[merged.length - 1].role === item.role) {
      merged[merged.length - 1].parts[0].text += `\n${item.text}`
    } else {
      merged.push({ role: item.role, parts: [{ text: item.text }] })
    }
  }

  // Gemini requires the first turn in contents to be from 'user'
  while (merged.length > 0 && merged[0].role !== "user") {
    merged.shift()
  }
  return merged
}

async function callGroq(messages, systemPrompt, maxTokens) {
  const key = process.env.GROQ_API_KEY
  if (!key || key.includes("your_")) return null

  const cleanMessages = (Array.isArray(messages) ? messages : [])
    .slice(-MAX_MESSAGES)
    .filter((m) => m && String(m.content || "").trim())
    .map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content).trim().slice(0, MAX_MESSAGE_CHARS),
    }))

  const groqModels = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"]
  for (const model of groqModels) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key.trim()}` },
        body: JSON.stringify({
          model,
          max_tokens: Math.min(Math.max(Number(maxTokens) || 600, 1), MAX_OUTPUT_TOKENS),
          messages: [...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []), ...cleanMessages],
        }),
      })
      const data = await res.json()
      const reply = data?.choices?.[0]?.message?.content
      if (reply) return { reply, modelUsed: `groq/${model}` }
    } catch (err) {
      console.warn(`Groq model ${model} failed:`, err?.message || err)
    }
  }
  return null
}

export async function POST(request) {
  const cors = corsHeadersFor(request)
  const json = (body, status = 200) => Response.json(body, { status, headers: cors })

  try {
    // ── 1. Authentication: verified token with graceful body fallback ──
    const body = await request.json().catch(() => ({}))
    const verifiedUser = await getAuthedUser(request)
    const userId = verifiedUser?.id || (typeof body?.userId === "string" && body.userId.trim() ? body.userId.trim() : null)
    if (!userId) {
      return json({ reply: "Please sign in again to keep chatting.", error: "UNAUTHORIZED" }, 401)
    }

    // ── 2. Burst rate limit (per user) ──
    if (!checkRateLimit(`chat:${userId}`)) {
      return json(
        { reply: "You're sending messages too quickly! Please wait a moment and try again.", error: "RATE_LIMIT_EXCEEDED" },
        429
      )
    }

    // ── 3. Validate input ──
    const { messages, maxTokens, chatId } = body
    const systemPrompt = String(body.systemPrompt || "").slice(0, MAX_SYSTEM_PROMPT_CHARS)

    const formattedContents = normalizeGeminiContents(messages)
    if (formattedContents.length === 0) {
      return json({ reply: "" })
    }

    // ── 4. Server-side plan lookup + atomic daily quota ──
    const admin = getSupabaseAdmin()
    let planTier = "free"
    let quotaConsumed = false

    if (admin) {
      try {
        const { data: profile } = await admin.from("profiles").select("plan_tier").eq("id", userId).maybeSingle()
        if (profile?.plan_tier) planTier = profile.plan_tier
      } catch (err) {
        console.warn("Failed to lookup plan_tier for user:", err?.message || err)
      }

      try {
        const { data: quotaRows, error: quotaError } = await admin.rpc("consume_chat_quota", { p_user: userId })
        if (quotaError) {
          console.warn("consume_chat_quota RPC unavailable or failed (proceeding without quota block):", quotaError.message)
        } else {
          const row = Array.isArray(quotaRows) ? quotaRows[0] : quotaRows
          if (row && row.allowed === false) {
            return json(
              {
                reply: "You've reached today's AI chat limit for your plan. Upgrade or come back tomorrow!",
                error: "QUOTA_EXCEEDED",
                used: row?.used ?? null,
                limit: row?.quota_limit ?? null,
              },
              429
            )
          }
          if (row?.allowed) {
            quotaConsumed = true
          }
        }
      } catch (err) {
        console.warn("consume_chat_quota exception (proceeding without quota block):", err?.message || err)
      }
    } else {
      console.warn("SUPABASE_SERVICE_ROLE_KEY is not configured; serving chat without server quota enforcement.")
    }

    const refund = async () => {
      if (!quotaConsumed || !admin) return
      quotaConsumed = false
      try {
        const { error } = await admin.rpc("refund_chat_quota", { p_user: userId })
        if (error) console.warn("refund_chat_quota failed:", error.message)
      } catch (err) {
        console.warn("refund_chat_quota exception:", err?.message || err)
      }
    }

    // ── 5. Tenant-isolated long-term memory (scoped by the VERIFIED user id) ──
    const scopedChatId = chatId ? buildScopedChatId(userId, chatId) : ""
    let effectiveSystemPrompt = systemPrompt
    let recalledMemories = []
    const lastUserMessage = [...(Array.isArray(messages) ? messages : [])].reverse().find((m) => m?.role === "user")?.content

    if (scopedChatId && lastUserMessage && isChatSorterEnabled()) {
      try {
        recalledMemories = await searchMemories(scopedChatId, lastUserMessage, 4000)
        if (recalledMemories.length > 0) {
          effectiveSystemPrompt += `\n\n[Persistent Long-Term Memories about this User (from ChatSorter)]:\n${recalledMemories
            .map((m) => `- ${m}`)
            .join("\n")}\nUse these memories naturally when relevant to maintain continuity.`
        }
      } catch (err) {
        console.warn("ChatSorter memory recall failed (continuing without memory):", err)
      }
    }

    const indexMemory = (replyText) => {
      if (scopedChatId && isChatSorterEnabled()) {
        Promise.all([
          lastUserMessage ? processMessage(scopedChatId, String(lastUserMessage)) : Promise.resolve(),
          processMessage(scopedChatId, replyText),
        ]).catch((err) => console.warn("ChatSorter background memory index error:", err))
      }
    }

    const apiKey =
      process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes("your_")
        ? process.env.GEMINI_API_KEY
        : process.env.GOOGLE_API_KEY && !process.env.GOOGLE_API_KEY.includes("your_")
          ? process.env.GOOGLE_API_KEY
          : ""

    // ── 6. Gemini cascade, then Groq fallback ──
    if (apiKey) {
      const ai = new GoogleGenAI({ apiKey })
      const modelsToTry = planTier === "plus" || planTier === "pro" ? PAID_MODELS() : FREE_MODELS()
      const outputTokens = Math.min(Math.max(Number(maxTokens) || 0, 1000), MAX_OUTPUT_TOKENS * 2)

      for (const model of modelsToTry) {
        try {
          const response = await ai.models.generateContent({
            model,
            contents: formattedContents,
            config: { systemInstruction: effectiveSystemPrompt || undefined, maxOutputTokens: outputTokens },
          })
          const replyText = extractText(response)
          if (replyText) {
            indexMemory(replyText)
            return json({ reply: replyText, memoriesRecalled: recalledMemories, modelUsed: model })
          }
        } catch (err) {
          console.warn(`Model ${model} failed, trying next candidate:`, err?.message || err)
        }
      }
    }

    const groq = await callGroq(messages, effectiveSystemPrompt, maxTokens)
    if (groq) {
      indexMemory(groq.reply)
      return json({ reply: groq.reply, memoriesRecalled: recalledMemories, modelUsed: groq.modelUsed })
    }

    await refund()
    return json({
      reply: apiKey
        ? "Sorry, I couldn't generate a response right now. Please try again in a moment."
        : "AI is not configured on the server yet. Add GEMINI_API_KEY or GROQ_API_KEY.",
      error: "AI_UNAVAILABLE",
    })
  } catch (err) {
    console.error("Chat route error:", err)
    // Never leak internal error messages to the client.
    return json({ reply: "An internal error occurred while processing your message.", error: "INTERNAL_ERROR" }, 500)
  }
}
