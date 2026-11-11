export interface DiscordChannel {
  id: string
  serverId: string
  name: string
  type: "text" | "voice" | "ai" | "radar"
  topic?: string
  unreadCount?: number
  isPrivate?: boolean
}

export interface DiscordServer {
  id: string
  name: string
  icon?: string // image URL or emoji
  ownerId: string
  description?: string
  channels: DiscordChannel[]
  unreadMentions?: number
}

export interface DiscordMessage {
  id: string
  channelId: string
  senderId: string
  senderName: string
  senderAvatar?: string
  role?: "user" | "bot" | "replica" | "system"
  badge?: string // "BOT", "REPLICA", "OWNER"
  content: string
  imageUrl?: string
  reactions?: Record<string, string[]> // emoji -> array of userIds
  created_at: string
}

export interface DiscordMember {
  id: string
  username: string
  display_name?: string
  avatar_url?: string
  is_online?: boolean
  is_bot?: boolean
  is_replica?: boolean
  role: "owner" | "admin" | "member" | "bot" | "replica"
  status_note?: string
}
