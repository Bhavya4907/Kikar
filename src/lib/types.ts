export type PlanTier = "free" | "plus" | "pro"

export interface Profile {
  id: string
  username: string
  display_name?: string
  avatar_url?: string
  bio?: string
  is_online?: boolean
  last_seen?: string
  push_token?: string
  auto_replica_enabled?: boolean
  replica_status_note?: string
  plan_tier?: PlanTier
}

export interface Character {
  id: string
  name: string
  emoji: string
  system_prompt: string
  created_by: string
  is_public?: boolean
  is_replica?: boolean
  replica_of?: string
  category?: string
  chat_count?: number
}

export interface Message {
  id?: string
  role: "user" | "assistant"
  content: string
  character_id: string
  user_id: string
  created_at?: string
}

export interface Conversation {
  id: string
  user1_id: string
  user2_id: string
  created_at: string
  user1?: Profile
  user2?: Profile
}

export interface DirectMessage {
  id?: string
  conversation_id: string
  sender_id: string
  content: string
  is_replica_reply?: boolean
  ai_persona_name?: string
  created_at?: string
  read_at?: string
}

export interface UsageQuota {
  user_id: string
  daily_chat_used: number
  daily_chat_limit: number
  monthly_image_used: number
  monthly_image_limit: number
  last_daily_reset?: string
}