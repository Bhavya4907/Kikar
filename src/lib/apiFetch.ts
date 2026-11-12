import { supabase } from "./supabase"

/**
 * fetch() wrapper for Kikar's own API routes: attaches the current Supabase access token so the
 * server can identify the user (the server ignores any userId sent in the body).
 */
export async function apiFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (token) headers.set("Authorization", `Bearer ${token}`)
  } catch {
    // fall through: the server will answer 401 and the UI shows its normal error message
  }
  return fetch(input, { ...init, headers })
}
