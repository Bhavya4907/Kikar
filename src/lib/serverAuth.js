import { createClient } from "@supabase/supabase-js"

const supabaseUrl = () => process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const anonKey = () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

function looksConfigured(url, key) {
  return Boolean(url && key && url.startsWith("http") && !url.includes("your_supabase_url") && !url.includes("your-project-id"))
}

export const isProduction = () => process.env.NODE_ENV === "production"

/**
 * Verifies the Supabase access token sent in `Authorization: Bearer <jwt>` and returns the
 * authenticated user, or null. Never trust a userId from the request body.
 */
export async function getAuthedUser(request) {
  const header = request.headers.get("authorization") || ""
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : ""
  if (!token) return null
  if (!looksConfigured(supabaseUrl(), anonKey())) return null

  const client = createClient(supabaseUrl(), anonKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.getUser(token)
  if (error || !data?.user) return null
  return data.user
}

/**
 * Service-role client for trusted server-side writes (plans, quotas).
 * There is deliberately NO fallback to the anon key: with the anon key these writes would
 * silently fail (RLS) or, worse, tempt a loosened policy.
 */
export function getSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
  if (!looksConfigured(supabaseUrl(), key)) return null
  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Optional cross-origin allow-list. The app calls its own origin, so the default is "none". */
export function corsHeadersFor(request) {
  const allowed = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean)
  const origin = request.headers.get("origin") || ""
  const headers = { Vary: "Origin" }
  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin
    headers["Access-Control-Allow-Methods"] = "POST, OPTIONS"
    headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
  }
  return headers
}
