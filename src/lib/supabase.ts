import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes("your_supabase_url") &&
  supabaseUrl.startsWith("http")
)

// Fallback to placeholder if environment variables are not yet provided
// to avoid bundle-time fatal crash from createClient("", "")
const validUrl = isSupabaseConfigured ? supabaseUrl : "https://placeholder-project.supabase.co"
const validKey = isSupabaseConfigured ? supabaseAnonKey : "placeholder-anon-key"

export const supabase = createClient(validUrl, validKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})
