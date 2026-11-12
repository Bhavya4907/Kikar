import { GoogleGenAI } from "@google/genai"
import { getAuthedUser, getSupabaseAdmin, isProduction, corsHeadersFor } from "../../../src/lib/serverAuth.js"
import { checkRateLimit } from "../../../src/lib/rateLimit.js"

const MAX_PROMPT_CHARS = 1000

const imageModels = () => {
  const raw = (process.env.GEMINI_IMAGE_MODELS || "").split(",").map((s) => s.trim()).filter(Boolean)
  return raw.length ? raw : ["gemini-2.5-flash-image", "gemini-3.1-flash-image-preview"]
}

export async function OPTIONS(request) {
  return new Response(null, { status: 204, headers: corsHeadersFor(request) })
}

export async function POST(request) {
  const cors = corsHeadersFor(request)
  const json = (body, status = 200) => Response.json(body, { status, headers: cors })

  try {
    const body = await request.json().catch(() => ({}))
    const verifiedUser = await getAuthedUser(request)
    const userId = verifiedUser?.id || (typeof body?.userId === "string" && body.userId.trim() ? body.userId.trim() : null)
    if (!userId) return json({ error: "Please sign in again to generate images." }, 401)

    if (!checkRateLimit(`img:${userId}`, 6, 60 * 1000)) {
      return json({ error: "You're generating images too quickly. Please wait a moment." }, 429)
    }

    const apiKey =
      process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.includes("your_")
        ? process.env.GEMINI_API_KEY
        : process.env.GOOGLE_API_KEY && !process.env.GOOGLE_API_KEY.includes("your_")
          ? process.env.GOOGLE_API_KEY
          : ""
    if (!apiKey) {
      return json({ error: "Image generation is not configured on the server." }, 500)
    }

    const prompt = String(body.prompt || "").trim().slice(0, MAX_PROMPT_CHARS)
    if (!prompt) return json({ error: "Prompt is required" }, 400)

    // Atomic monthly image quota
    const admin = getSupabaseAdmin()
    let quotaConsumed = false
    if (admin) {
      try {
        const { data: rows, error: quotaError } = await admin.rpc("consume_image_quota", { p_user: userId })
        if (quotaError) {
          console.warn("consume_image_quota failed (proceeding without quota enforcement):", quotaError.message)
        } else {
          const row = Array.isArray(rows) ? rows[0] : rows
          if (row && row.allowed === false) {
            return json({ error: "You've used all image generations for this month on your plan.", code: "QUOTA_EXCEEDED" }, 429)
          }
          if (row?.allowed) {
            quotaConsumed = true
          }
        }
      } catch (e) {
        console.warn("consume_image_quota exception:", e)
      }
    } else {
      console.warn("SUPABASE_SERVICE_ROLE_KEY is not configured; generating image without server quota enforcement.")
    }

    const ai = new GoogleGenAI({ apiKey })
    for (const model of imageModels()) {
      try {
        const response = await ai.models.generateContent({ model, contents: prompt })
        if (response.parts) {
          for (const part of response.parts) {
            if (part.inlineData) {
              const mimeType = part.inlineData.mimeType || "image/png"
              return json({ url: `data:${mimeType};base64,${part.inlineData.data}` })
            }
          }
        }
      } catch (err) {
        console.warn(`Image model ${model} failed, trying next:`, err?.message || err)
      }
    }

    if (quotaConsumed && admin) {
      try {
        const { error } = await admin.rpc("refund_image_quota", { p_user: userId })
        if (error) console.warn("refund_image_quota failed:", error.message)
      } catch (e) {
        console.warn("refund_image_quota exception:", e)
      }
    }
    return json({ error: "Couldn't generate an image right now. Please try again." }, 502)
  } catch (error) {
    console.error("Gemini image error:", error?.message || error)
    return json({ error: "Failed to generate image" }, 500)
  }
}
