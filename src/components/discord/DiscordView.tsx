"use client"
import { useState, useEffect, useMemo, useRef } from "react"
import { supabase } from "../../lib/supabase"
import ServerRail from "./ServerRail"
import ChannelSidebar from "./ChannelSidebar"
import ServerChatArea from "./ServerChatArea"
import ServerMemberList from "./ServerMemberList"
import CreateServerModal from "./CreateServerModal"
import PeopleDirectoryView from "../PeopleDirectoryView"
import RandomMatchWindow from "../RandomMatchWindow"
import AIGridView from "../AIGridView"
import DMWindow from "../DMWIndow"
import ChatWindow from "../ChatWindow"
import CharacterForm from "../CharacterForm"
import type { DiscordServer, DiscordChannel, DiscordMessage, DiscordMember } from "../../lib/discordTypes"
import type { PlanTier, UsageQuota } from "../../lib/types"

interface Props {
  session: any
  profile: any
  allProfiles: any[]
  characters: any[]
  charsLoading: boolean
  conversations: any[]
  activeConvo: any
  onOpenConvo: (convo: any) => void
  activeChar: any
  onOpenChar: (char: any) => void
  onCloseActive: () => void
  onStartConversation: (partnerId: string) => void
  onOpenProfile: () => void
  onSignOut: () => void
  planTier: PlanTier
  quota: UsageQuota | null
  onOpenPricing: () => void
  onDeleteCharacter: (id: string) => void
  creating: boolean
  setCreating: (v: boolean) => void
}

const DEFAULT_SERVERS: DiscordServer[] = [
  {
    id: "kikar-central",
    name: "Kikar Central",
    icon: "🚀",
    ownerId: "system",
    description: "Official community hub for Kikar AI, human fellows, and digital twins.",
    channels: [
      { id: "kc-general", serverId: "kikar-central", name: "general", type: "text", topic: "General community banter & hello!" },
      { id: "kc-ai-wingman", serverId: "kikar-central", name: "ai-wingman", type: "ai", topic: "Chat with the AI wingman & brainstorm" },
      { id: "kc-voice-hangout", serverId: "kikar-central", name: "voice-hangout", type: "voice", topic: "Live voice audio hangout lounge" },
      { id: "kc-announcements", serverId: "kikar-central", name: "announcements", type: "text", topic: "Kikar platform updates & releases" },
      { id: "kc-radar-lounge", serverId: "kikar-central", name: "radar-lounge", type: "radar", topic: "Speed stranger matching lounge" },
    ],
  },
  {
    id: "gaming-lounge",
    name: "Gaming & Banter",
    icon: "🎮",
    ownerId: "system",
    description: "Gaming discussion, anime debates, and AI trivia.",
    channels: [
      { id: "gl-general", serverId: "gaming-lounge", name: "game-chat", type: "text", topic: "Talk games, clips, and setups" },
      { id: "gl-voice-comms", serverId: "gaming-lounge", name: "squad-voice", type: "voice", topic: "Gaming comms voice lounge" },
      { id: "gl-ai-trivia", serverId: "gaming-lounge", name: "trivia-bot", type: "ai", topic: "Compete with AI trivia masters" },
    ],
  },
]

function playDiscordChime(type: "join" | "leave") {
  if (typeof window === "undefined") return
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioContextClass) return
    const ctx = new AudioContextClass()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    const now = ctx.currentTime
    if (type === "join") {
      osc.type = "sine"
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.12)
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
      osc.start(now)
      osc.stop(now + 0.25)
    } else {
      osc.type = "sine"
      osc.frequency.setValueAtTime(880, now)
      osc.frequency.exponentialRampToValueAtTime(440, now + 0.12)
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
      osc.start(now)
      osc.stop(now + 0.25)
    }
  } catch {
    // AudioContext permission policy
  }
}

export default function DiscordView({
  session,
  profile,
  allProfiles,
  characters,
  charsLoading,
  conversations,
  activeConvo,
  onOpenConvo,
  activeChar,
  onOpenChar,
  onCloseActive,
  onStartConversation,
  onOpenProfile,
  onSignOut,
  planTier,
  quota,
  onOpenPricing,
  onDeleteCharacter,
  creating,
  setCreating,
}: Props) {
  // Navigation State
  const [servers, setServers] = useState<DiscordServer[]>(DEFAULT_SERVERS)
  const [activeServerId, setActiveServerId] = useState<string | null>(null) // null = Home / DMs
  const [activeChannelId, setActiveChannelId] = useState<string>("kc-general")
  const [homeSubView, setHomeSubView] = useState<"fellows" | "radar" | "personas">("fellows")
  const [memberListOpen, setMemberListOpen] = useState(true)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [showCreateServer, setShowCreateServer] = useState(false)
  const [editingChar, setEditingChar] = useState<any>(null)
  const [showCharForm, setShowCharForm] = useState(false)
  const [charMessages, setCharMessages] = useState<any[]>([])

  // Live Features State
  const [voiceConnected, setVoiceConnected] = useState(false)
  const [generatingImg, setGeneratingImg] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; expires: number }>>({})

  const realtimeChannelRef = useRef<any>(null)

  const myName = profile?.display_name || profile?.username || session?.user?.email?.split("@")[0] || "User"

  // Channel Messages Map with default welcome seeds
  const [channelMessages, setChannelMessages] = useState<Record<string, DiscordMessage[]>>({
    "kc-general": [
      {
        id: "msg-welcome-1",
        channelId: "kc-general",
        senderId: "system",
        senderName: "Kikar AI ✦",
        role: "bot",
        badge: "BOT",
        content: "👋 Welcome to Kikar Central! This is your AI-native community space. Chat with real friends, summon @ai anytime, or mention friends to chat with their offline Digital Replicas 🪞.",
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
    "kc-ai-wingman": [
      {
        id: "msg-ai-1",
        channelId: "kc-ai-wingman",
        senderId: "ai-wingman",
        senderName: "AI Wingman 🎲",
        role: "bot",
        badge: "BOT",
        content: "✦ Wingman ready! Ask me for an icebreaker, settle a debate, or brainstorm anything by typing in this channel or tagging @ai.",
        created_at: new Date().toISOString(),
      },
    ],
  })

  // Load persisted servers and messages from localStorage
  useEffect(() => {
    const savedServers = localStorage.getItem("kikar_discord_servers")
    if (savedServers) {
      try {
        const parsed = JSON.parse(savedServers)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setServers(parsed)
        }
      } catch (err) {
        console.error("Failed to parse saved servers", err)
      }
    }

    const savedMsgs = localStorage.getItem("kikar_discord_messages")
    if (savedMsgs) {
      try {
        const parsed = JSON.parse(savedMsgs)
        if (parsed && typeof parsed === "object") {
          setChannelMessages((prev) => ({ ...prev, ...parsed }))
        }
      } catch (err) {
        console.error("Failed to parse saved messages", err)
      }
    }
  }, [])

  // Persist servers
  function updateServers(newServers: DiscordServer[]) {
    setServers(newServers)
    localStorage.setItem("kikar_discord_servers", JSON.stringify(newServers))
  }

  const activeServer = useMemo(() => {
    if (!activeServerId) return null
    return servers.find((s) => s.id === activeServerId) || null
  }, [servers, activeServerId])

  const activeChannel = useMemo(() => {
    if (!activeServer) return null
    return activeServer.channels.find((c) => c.id === activeChannelId) || activeServer.channels[0] || null
  }, [activeServer, activeChannelId])

  // ── Supabase Realtime Subscription for Active Channel ────────────
  useEffect(() => {
    if (!activeChannel) return

    // Clean up previous channel subscription
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current)
      realtimeChannelRef.current = null
    }

    const channelName = `kikar-discord-channel-${activeChannel.id}`
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } },
    })

    channel
      .on("broadcast", { event: "new-channel-msg" }, ({ payload }) => {
        if (payload && payload.channelId === activeChannel.id && payload.senderId !== session?.user?.id) {
          setChannelMessages((prev) => {
            const list = prev[activeChannel.id] || []
            if (list.some((m) => m.id === payload.id)) return prev
            const updated = { ...prev, [activeChannel.id]: [...list, payload] }
            localStorage.setItem("kikar_discord_messages", JSON.stringify(updated))
            return updated
          })
        }
      })
      .on("broadcast", { event: "channel-typing" }, ({ payload }) => {
        if (payload && payload.userId !== session?.user?.id) {
          setTypingUsers((prev) => {
            if (!payload.isTyping) {
              const copy = { ...prev }
              delete copy[payload.userId]
              return copy
            }
            return {
              ...prev,
              [payload.userId]: { name: payload.username, expires: Date.now() + 3000 },
            }
          })
        }
      })
      .on("broadcast", { event: "msg-reaction" }, ({ payload }) => {
        if (payload && payload.msgId && payload.emoji && payload.userId) {
          setChannelMessages((prev) => {
            const list = prev[activeChannel.id] || []
            const updated = list.map((m) => {
              if (m.id !== payload.msgId) return m
              const reactions = { ...(m.reactions || {}) }
              const users = reactions[payload.emoji] || []
              const exists = users.includes(payload.userId)
              reactions[payload.emoji] = exists
                ? users.filter((u) => u !== payload.userId)
                : [...users, payload.userId]
              return { ...m, reactions }
            })
            const newMap = { ...prev, [activeChannel.id]: updated }
            localStorage.setItem("kikar_discord_messages", JSON.stringify(newMap))
            return newMap
          })
        }
      })
      .subscribe()

    realtimeChannelRef.current = channel

    // Periodic cleanup of stale typing indicators
    const interval = setInterval(() => {
      const now = Date.now()
      setTypingUsers((prev) => {
        let changed = false
        const next: Record<string, { name: string; expires: number }> = {}
        for (const [key, val] of Object.entries(prev)) {
          if (val.expires > now) {
            next[key] = val
          } else {
            changed = true
          }
        }
        return changed ? next : prev
      })
    }, 1500)

    return () => {
      clearInterval(interval)
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current)
        realtimeChannelRef.current = null
      }
    }
  }, [activeChannel?.id, session?.user?.id])

  // Build Unified Member List for current server / channel
  const serverMembers: DiscordMember[] = useMemo(() => {
    const list: DiscordMember[] = []

    // 1. Current user
    list.push({
      id: session?.user?.id || "me",
      username: profile?.username || session?.user?.email?.split("@")[0] || "user",
      display_name: profile?.display_name || "You",
      avatar_url: profile?.avatar_url,
      is_online: true,
      role: "owner",
      status_note: profile?.replica_status_note || (voiceConnected ? "In Voice Lounge 🔊" : "Exploring Kikar Discord"),
    })

    // 2. Real human fellows
    for (const p of allProfiles || []) {
      if (p.id === session?.user?.id) continue
      list.push({
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        is_online: p.is_online,
        role: "member",
        status_note: p.replica_status_note,
      })
    }

    // 3. AI Personas living in server (Bots vs Replicas)
    for (const char of characters || []) {
      const isReplica = !!char.is_replica
      list.push({
        id: `bot-${char.id}`,
        username: char.name.toLowerCase().replace(/\s+/g, "_"),
        display_name: char.name,
        avatar_url: char.avatar_url || "",
        is_bot: !isReplica,
        is_replica: isReplica,
        is_online: true,
        role: isReplica ? "replica" : "bot",
        status_note: isReplica ? "Offline Digital Twin" : "Custom AI Persona",
      })
    }

    return list
  }, [session, profile, allProfiles, characters, voiceConnected])

  const activeTypingNames = useMemo(() => {
    return Object.values(typingUsers).map((u) => u.name)
  }, [typingUsers])

  // ── Actions ─────────────────────────────────────────────────────
  function handleSelectServer(serverId: string | null) {
    setActiveServerId(serverId)
    if (serverId) {
      const target = servers.find((s) => s.id === serverId)
      if (target && target.channels.length > 0) {
        setActiveChannelId(target.channels[0].id)
      }
      onCloseActive()
    }
    setMobileDrawerOpen(false)
  }

  function handleSelectChannel(channelId: string) {
    setActiveChannelId(channelId)
    setMobileDrawerOpen(false)
  }

  function handleSelectHomeSubView(view: "fellows" | "radar" | "personas") {
    setHomeSubView(view)
    setShowCharForm(false)
    setEditingChar(null)
    onCloseActive()
    setMobileDrawerOpen(false)
  }

  function handleOpenCreatePersona() {
    setActiveServerId(null)
    setHomeSubView("personas")
    setEditingChar(null)
    setShowCharForm(true)
    onCloseActive()
    setMobileDrawerOpen(false)
  }

  function handleToggleVoice() {
    const nextState = !voiceConnected
    setVoiceConnected(nextState)
    playDiscordChime(nextState ? "join" : "leave")

    if (activeChannel) {
      const notice: DiscordMessage = {
        id: `notice-${Date.now()}`,
        channelId: activeChannel.id,
        senderId: "system",
        senderName: "System",
        role: "system",
        content: nextState
          ? `🔊 ${myName} joined the voice lounge.`
          : `🔈 ${myName} left the voice lounge.`,
        created_at: new Date().toISOString(),
      }
      setChannelMessages((prev) => {
        const updated = {
          ...prev,
          [activeChannel.id]: [...(prev[activeChannel.id] || []), notice],
        }
        localStorage.setItem("kikar_discord_messages", JSON.stringify(updated))
        return updated
      })
      if (realtimeChannelRef.current) {
        realtimeChannelRef.current.send({
          type: "broadcast",
          event: "new-channel-msg",
          payload: notice,
        })
      }
    }
  }

  function handleUserTyping(isTyping: boolean) {
    if (!activeChannel || !realtimeChannelRef.current) return
    realtimeChannelRef.current.send({
      type: "broadcast",
      event: "channel-typing",
      payload: {
        userId: session?.user?.id || "guest",
        username: myName,
        isTyping,
      },
    })
  }

  function handleReactMessage(msgId: string, emoji: string) {
    if (!activeChannel) return
    const myId = session?.user?.id || "guest"

    setChannelMessages((prev) => {
      const list = prev[activeChannel.id] || []
      const updated = list.map((msg) => {
        if (msg.id !== msgId) return msg
        const reactions = { ...(msg.reactions || {}) }
        const users = reactions[emoji] || []
        const exists = users.includes(myId)

        reactions[emoji] = exists
          ? users.filter((u) => u !== myId)
          : [...users, myId]

        return { ...msg, reactions }
      })

      const newMap = { ...prev, [activeChannel.id]: updated }
      localStorage.setItem("kikar_discord_messages", JSON.stringify(newMap))
      return newMap
    })

    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.send({
        type: "broadcast",
        event: "msg-reaction",
        payload: { msgId, emoji, userId: myId },
      })
    }
  }

  async function handleSendMessage(content: string, imageUrl?: string) {
    if (!activeChannel) return

    const userMsg: DiscordMessage = {
      id: `msg-${Date.now()}`,
      channelId: activeChannel.id,
      senderId: session?.user?.id || "guest",
      senderName: myName,
      senderAvatar: profile?.avatar_url,
      role: "user",
      content,
      imageUrl,
      created_at: new Date().toISOString(),
    }

    setChannelMessages((prev) => {
      const updated = {
        ...prev,
        [activeChannel.id]: [...(prev[activeChannel.id] || []), userMsg],
      }
      localStorage.setItem("kikar_discord_messages", JSON.stringify(updated))
      return updated
    })

    // Broadcast user message to all peers
    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.send({
        type: "broadcast",
        event: "new-channel-msg",
        payload: userMsg,
      })
    }

    // ── Check for Cross-Convo / Mention Targets ──────────────────────
    const isAiSummon = content.toLowerCase().includes("@ai") || content.toLowerCase().includes("@kikar") || activeChannel.type === "ai"
    const mentionMatches = content.match(/@([a-zA-Z0-9_\-\.]+)/g) || []
    
    // Find if a specific user/replica was mentioned or targeted
    let targetProfile: any = null
    let targetReplica: any = null

    for (const rawMention of mentionMatches) {
      const cleanTag = rawMention.replace("@", "").toLowerCase()
      if (cleanTag === "ai" || cleanTag === "kikar") continue

      const p = (allProfiles || []).find((prof) => {
        const u = (prof.username || "").toLowerCase()
        const d = (prof.display_name || "").toLowerCase()
        return u === cleanTag || d === cleanTag || u.includes(cleanTag) || d.includes(cleanTag)
      })
      if (p) {
        targetProfile = p
        break
      }
    }

    // Also detect if user typed "ba's replica" or "replica" without an '@' tag
    if (!targetProfile) {
      for (const p of allProfiles || []) {
        const u = (p.username || "").toLowerCase()
        const d = (p.display_name || "").toLowerCase()
        if ((u && content.toLowerCase().includes(u)) || (d && content.toLowerCase().includes(d))) {
          targetProfile = p
          break
        }
      }
    }

    if (targetProfile) {
      targetReplica = (characters || []).find(
        (c) =>
          c.is_replica &&
          (c.user_id === targetProfile.id ||
            c.name.toLowerCase().includes(targetProfile.display_name?.toLowerCase() || "") ||
            c.name.toLowerCase().includes(targetProfile.username?.toLowerCase() || ""))
      )
    }

    const hasTarget = Boolean(targetReplica || /replica|twin/i.test(content) || targetProfile)
    const isContinuation = /continue|keep|more|again|talk|go on|what else/i.test(content)
    const isCrossConvoRequest = isAiSummon && (hasTarget || isContinuation)

    if (isCrossConvoRequest && targetReplica) {
      // ── SCENARIO A: Real-Time Multi-Agent Channel Convo (Kikar AI & Replica) ──
      const targetName = targetProfile?.display_name || targetProfile?.username || targetReplica.name
      const replicaDisplayName = `${targetName}'s Replica 🪞`

      setTypingUsers((prev) => ({
        ...prev,
        "kikar-ai-bot": { name: "Kikar AI ✦", expires: Date.now() + 4000 },
      }))

      setTimeout(async () => {
        try {
          const recentHistory = (channelMessages[activeChannel.id] || []).slice(-6).map((m) => ({
            role: m.role === "bot" || m.role === "replica" ? "assistant" : "user",
            content: `${m.senderName}: ${m.content}`,
          }))

          // 1. Kikar AI Co-Pilot addresses the replica directly
          const promptText = content.replace(/@ai|@kikar/gi, "").trim() || "Hello!"
          const aiRes1 = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [
                ...recentHistory,
                { role: "user", content: `${myName}: ${promptText}` },
              ],
              systemPrompt: `You are Kikar AI ✦ in #${activeChannel.name}.
${myName} asked you: "${content}".
Address ${targetName}'s AI Replica directly (e.g. "Hey ${replicaDisplayName}...").
Greet them or ask a fun question to initiate dialogue.
CRITICAL: DO NOT roleplay or simulate ${targetName}'s Replica yourself! The replica is a real separate agent that will reply right after you in this channel.
Keep it punchy, conversational, and under 40 words.`,
              maxTokens: 150,
              userId: session?.user?.id,
            }),
          })
          const aiData1 = await aiRes1.json()
          const aiReplyText = aiData1?.reply || `Hey ${replicaDisplayName}! ${myName} wanted us to link up in #${activeChannel.name}. What's the plan today? 🚀`

          const botMsg: DiscordMessage = {
            id: `ai-${Date.now()}`,
            channelId: activeChannel.id,
            senderId: "kikar-bot",
            senderName: "Kikar AI ✦",
            role: "bot",
            badge: "BOT",
            content: aiReplyText,
            created_at: new Date().toISOString(),
          }

          setChannelMessages((prev) => {
            const updated = {
              ...prev,
              [activeChannel.id]: [...(prev[activeChannel.id] || []), botMsg],
            }
            localStorage.setItem("kikar_discord_messages", JSON.stringify(updated))
            return updated
          })

          if (realtimeChannelRef.current) {
            realtimeChannelRef.current.send({
              type: "broadcast",
              event: "new-channel-msg",
              payload: botMsg,
            })
          }

          // 2. Replica wakes up and replies to Kikar AI in the channel
          setTypingUsers((prev) => ({
            ...prev,
            [`replica-${targetReplica.id}`]: { name: replicaDisplayName, expires: Date.now() + 4000 },
          }))

          setTimeout(async () => {
            try {
              const repRes = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  messages: [
                    ...recentHistory,
                    { role: "assistant", content: `Kikar AI ✦: ${aiReplyText}` },
                    { role: "user", content: `Reply directly to Kikar AI's message: "${aiReplyText}"` },
                  ],
                  systemPrompt: `You are ${targetName}'s Digital Replica 🪞 in Discord #${activeChannel.name}.
Your persona: "${targetReplica.personality || targetReplica.description || 'Casual, witty, loyal, match their style'}".
Kikar AI ✦ just said directly to you: "${aiReplyText}".
Respond directly to Kikar AI in character with playful banter. Max 40 words.`,
                  maxTokens: 150,
                  userId: session?.user?.id,
                }),
              })
              const repData = await repRes.json()
              const repReplyText = repData?.reply || `Haha what's up Kikar AI! ${myName} knows I'm always ready for channel banter. What's on your neural net? 😎`

              const repMsg: DiscordMessage = {
                id: `replica-${Date.now()}`,
                channelId: activeChannel.id,
                senderId: `replica-${targetReplica.id}`,
                senderName: replicaDisplayName,
                senderAvatar: targetProfile?.avatar_url || targetReplica.avatar_url,
                role: "replica",
                badge: "REPLICA",
                content: repReplyText,
                created_at: new Date().toISOString(),
              }

              setChannelMessages((prev) => {
                const updated = {
                  ...prev,
                  [activeChannel.id]: [...(prev[activeChannel.id] || []), repMsg],
                }
                localStorage.setItem("kikar_discord_messages", JSON.stringify(updated))
                return updated
              })

              if (realtimeChannelRef.current) {
                realtimeChannelRef.current.send({
                  type: "broadcast",
                  event: "new-channel-msg",
                  payload: repMsg,
                })
              }

              // 3. Kikar AI rejoinder
              setTypingUsers((prev) => ({
                ...prev,
                "kikar-ai-bot": { name: "Kikar AI ✦", expires: Date.now() + 3500 },
              }))

              setTimeout(async () => {
                try {
                  const aiRes2 = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      messages: [
                        { role: "user", content: `Kikar AI said: "${aiReplyText}"` },
                        { role: "assistant", content: `${replicaDisplayName} replied: "${repReplyText}"` },
                        { role: "user", content: "Give a quick, clever comeback to continue the channel banter!" }
                      ],
                      systemPrompt: `You are Kikar AI ✦ in #${activeChannel.name}. Give a quick 1-2 sentence witty comeback back to ${replicaDisplayName} to conclude the friendly exchange!`,
                      maxTokens: 100,
                      userId: session?.user?.id,
                    }),
                  })
                  const aiData2 = await aiRes2.json()
                  if (aiData2?.reply) {
                    const aiMsg2: DiscordMessage = {
                      id: `ai-${Date.now()}`,
                      channelId: activeChannel.id,
                      senderId: "kikar-bot",
                      senderName: "Kikar AI ✦",
                      role: "bot",
                      badge: "BOT",
                      content: aiData2.reply,
                      created_at: new Date().toISOString(),
                    }

                    setChannelMessages((prev) => {
                      const updated = {
                        ...prev,
                        [activeChannel.id]: [...(prev[activeChannel.id] || []), aiMsg2],
                      }
                      localStorage.setItem("kikar_discord_messages", JSON.stringify(updated))
                      return updated
                    })

                    if (realtimeChannelRef.current) {
                      realtimeChannelRef.current.send({
                        type: "broadcast",
                        event: "new-channel-msg",
                        payload: aiMsg2,
                      })
                    }
                  }
                } catch (err) {
                  console.error("AI channel comeback error:", err)
                } finally {
                  setTypingUsers((prev) => {
                    const next = { ...prev }
                    delete next["kikar-ai-bot"]
                    return next
                  })
                }
              }, 1200)

            } catch (err) {
              console.error("Replica channel reply error:", err)
            } finally {
              setTypingUsers((prev) => {
                const next = { ...prev }
                delete next[`replica-${targetReplica.id}`]
                return next
              })
            }
          }, 1100)

        } catch (err) {
          console.error("AI channel reply error", err)
        } finally {
          setTypingUsers((prev) => {
            const next = { ...prev }
            delete next["kikar-ai-bot"]
            return next
          })
        }
      }, 900)

    } else if (targetProfile && targetReplica && !isAiSummon) {
      // ── SCENARIO B: Direct Replica Interception in Channel ───────────
      const replicaDisplayName = `${targetProfile.display_name || targetProfile.username}'s Replica 🪞`

      setTypingUsers((prev) => ({
        ...prev,
        [`replica-${targetReplica.id}`]: { name: replicaDisplayName, expires: Date.now() + 3500 },
      }))

      setTimeout(async () => {
        try {
          const recentHistory = (channelMessages[activeChannel.id] || []).slice(-5).map((m) => ({
            role: m.role === "bot" || m.role === "replica" ? "assistant" : "user",
            content: `${m.senderName}: ${m.content}`,
          }))

          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [
                ...recentHistory,
                { role: "user", content: `${myName} mentioned you in #${activeChannel.name}: "${content}"` },
              ],
              systemPrompt: `You are ${targetProfile.display_name || targetProfile.username}'s Digital Replica 🪞 in a Discord server channel #${activeChannel.name}.
Your human creator is currently offline or away.
Your persona instructions: "${targetReplica.personality || targetReplica.description || 'Be casual, friendly, witty, and match their style'}".
Acknowledge in character that you're their digital twin holding down the fort while they're away. Keep your response to 1-3 conversational sentences.`,
              maxTokens: 250,
              userId: session?.user?.id,
            }),
          })
          const data = await res.json()
          const replicaReply: DiscordMessage = {
            id: `replica-${Date.now()}`,
            channelId: activeChannel.id,
            senderId: `replica-${targetReplica.id}`,
            senderName: replicaDisplayName,
            senderAvatar: targetProfile.avatar_url || targetReplica.avatar_url,
            role: "replica",
            badge: "REPLICA",
            content: data?.reply || `Hey ${myName}! ${targetProfile.display_name || targetProfile.username} is offline right now, but I'm their replica! What's up?`,
            created_at: new Date().toISOString(),
          }

          setChannelMessages((prev) => {
            const updated = {
              ...prev,
              [activeChannel.id]: [...(prev[activeChannel.id] || []), replicaReply],
            }
            localStorage.setItem("kikar_discord_messages", JSON.stringify(updated))
            return updated
          })

          if (realtimeChannelRef.current) {
            realtimeChannelRef.current.send({
              type: "broadcast",
              event: "new-channel-msg",
              payload: replicaReply,
            })
          }
        } catch (err) {
          console.error("Replica auto-interception error:", err)
        } finally {
          setTypingUsers((prev) => {
            const next = { ...prev }
            delete next[`replica-${targetReplica.id}`]
            return next
          })
        }
      }, 1200)

    } else if (isAiSummon) {
      // ── SCENARIO C: Standard AI Channel Participation ───────────────
      setTypingUsers((prev) => ({
        ...prev,
        "kikar-ai-bot": { name: "Kikar AI ✦", expires: Date.now() + 4000 },
      }))

      setTimeout(async () => {
        try {
          const recentHistory = (channelMessages[activeChannel.id] || []).slice(-6).map((m) => ({
            role: m.role === "bot" || m.role === "replica" ? "assistant" : "user",
            content: `${m.senderName}: ${m.content}`,
          }))

          const promptText = content.replace(/@ai|@kikar/gi, "").trim() || "Hello!"
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [
                ...recentHistory,
                { role: "user", content: `${myName}: ${promptText}` },
              ],
              systemPrompt: `You are Kikar AI ✦, an intelligent, witty, Discord-native co-pilot and active citizen of channel #${activeChannel.name}.
You are in a lively group server with human users and digital replicas.
Keep your answer concise, engaging, and formatting-rich (markdown, emojis). Avoid robotic greetings.`,
              maxTokens: 300,
              userId: session?.user?.id,
            }),
          })
          const data = await res.json()
          const botReply: DiscordMessage = {
            id: `ai-${Date.now()}`,
            channelId: activeChannel.id,
            senderId: "kikar-bot",
            senderName: "Kikar AI ✦",
            role: "bot",
            badge: "BOT",
            content: data?.reply || "I'm right here! Let's build something awesome.",
            created_at: new Date().toISOString(),
          }

          setChannelMessages((prev) => {
            const updated = {
              ...prev,
              [activeChannel.id]: [...(prev[activeChannel.id] || []), botReply],
            }
            localStorage.setItem("kikar_discord_messages", JSON.stringify(updated))
            return updated
          })

          if (realtimeChannelRef.current) {
            realtimeChannelRef.current.send({
              type: "broadcast",
              event: "new-channel-msg",
              payload: botReply,
            })
          }
        } catch (err) {
          console.error("AI channel reply error", err)
        } finally {
          setTypingUsers((prev) => {
            const next = { ...prev }
            delete next["kikar-ai-bot"]
            return next
          })
        }
      }, 900)
    }
  }

  async function handleGenerateImage(prompt: string) {
    if (!activeChannel) return
    setGeneratingImg(true)

    const userPromptMsg: DiscordMessage = {
      id: `prompt-${Date.now()}`,
      channelId: activeChannel.id,
      senderId: session?.user?.id || "user",
      senderName: myName,
      senderAvatar: profile?.avatar_url,
      role: "user",
      content: `🎨 Generating image: "${prompt}"...`,
      created_at: new Date().toISOString(),
    }

    setChannelMessages((prev) => ({
      ...prev,
      [activeChannel.id]: [...(prev[activeChannel.id] || []), userPromptMsg],
    }))

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()

      if (data?.url) {
        const artMsg: DiscordMessage = {
          id: `img-${Date.now()}`,
          channelId: activeChannel.id,
          senderId: "kikar-bot",
          senderName: "Kikar AI ✦",
          role: "bot",
          badge: "BOT",
          content: `Here is your art for: "${prompt}"`,
          imageUrl: data.url,
          created_at: new Date().toISOString(),
        }

        setChannelMessages((prev) => {
          const updated = {
            ...prev,
            [activeChannel.id]: [...(prev[activeChannel.id] || []), artMsg],
          }
          localStorage.setItem("kikar_discord_messages", JSON.stringify(updated))
          return updated
        })

        if (realtimeChannelRef.current) {
          realtimeChannelRef.current.send({
            type: "broadcast",
            event: "new-channel-msg",
            payload: artMsg,
          })
        }
      } else {
        const failMsg: DiscordMessage = {
          id: `fail-${Date.now()}`,
          channelId: activeChannel.id,
          senderId: "system",
          senderName: "System",
          role: "system",
          content: `⚠️ Could not generate image: ${data?.error || "Unknown error"}`,
          created_at: new Date().toISOString(),
        }
        setChannelMessages((prev) => ({
          ...prev,
          [activeChannel.id]: [...(prev[activeChannel.id] || []), failMsg],
        }))
      }
    } catch (err: any) {
      console.error("Image generation error:", err)
    } finally {
      setGeneratingImg(false)
    }
  }

  function handleTriggerAiIcebreaker() {
    if (!activeChannel) return
    const icebreakers = [
      "✦ Kikar Wingman: If you had to delete every app on your phone except 3, what are you keeping?",
      "✦ Kikar Wingman: What's one unpopular tech opinion you will defend with your life?",
      "✦ Kikar Wingman: Would you rather fight 1 horse-sized duck or 100 duck-sized horses?",
      "✦ Kikar Wingman: Tell the channel two truths and one lie — let's see who guesses first!",
      "✦ Kikar Wingman: If AI could automate 100% of one chore in your life forever, what chore are you banishing?",
    ]
    const chosen = icebreakers[Math.floor(Math.random() * icebreakers.length)]
    const botMsg: DiscordMessage = {
      id: `ai-${Date.now()}`,
      channelId: activeChannel.id,
      senderId: "kikar-wingman",
      senderName: "AI Wingman 🎲",
      role: "bot",
      badge: "BOT",
      content: chosen,
      created_at: new Date().toISOString(),
    }
    setChannelMessages((prev) => {
      const updated = {
        ...prev,
        [activeChannel.id]: [...(prev[activeChannel.id] || []), botMsg],
      }
      localStorage.setItem("kikar_discord_messages", JSON.stringify(updated))
      return updated
    })

    if (realtimeChannelRef.current) {
      realtimeChannelRef.current.send({
        type: "broadcast",
        event: "new-channel-msg",
        payload: botMsg,
      })
    }
  }

  function handleCreateServer(newServer: DiscordServer) {
    const updated = [...servers, newServer]
    updateServers(updated)
    setActiveServerId(newServer.id)
    if (newServer.channels.length > 0) {
      setActiveChannelId(newServer.channels[0].id)
    }
  }

  function handleCreateChannel(serverId: string) {
    const chName = window.prompt("Enter new channel name (e.g. memes, dev-chat):")
    if (!chName || !chName.trim()) return

    const cleanName = chName.trim().toLowerCase().replace(/\s+/g, "-")
    const newCh: DiscordChannel = {
      id: `ch-${serverId}-${Date.now()}`,
      serverId,
      name: cleanName,
      type: "text",
      topic: `Discussion channel for #${cleanName}`,
    }

    const updated = servers.map((s) => {
      if (s.id === serverId) {
        return { ...s, channels: [...s.channels, newCh] }
      }
      return s
    })
    updateServers(updated)
    setActiveChannelId(newCh.id)
  }

  return (
    <div
      className="cc-discord-root"
      style={{
        display: "flex",
        width: "100%",
        height: "100dvh",
        background: "#1e1f22",
        color: "#dbdee1",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* ── 1. Far-Left Server Rail (72px) ─────────────────────────── */}
      <ServerRail
        servers={servers}
        activeServerId={activeServerId}
        onSelectServer={handleSelectServer}
        onOpenCreateServer={() => setShowCreateServer(true)}
        onOpenRadar={() => {
          setActiveServerId(null)
          setHomeSubView("radar")
          onCloseActive()
        }}
        unreadDMsCount={0}
      />

      {/* ── 2. Channel & DM Sidebar (240px) ────────────────────────── */}
      <ChannelSidebar
        activeServer={activeServer}
        activeChannelId={activeChannelId}
        onSelectChannel={handleSelectChannel}
        homeSubView={homeSubView}
        onSelectHomeSubView={handleSelectHomeSubView}
        conversations={conversations}
        activeConvo={activeConvo}
        onOpenConvo={onOpenConvo}
        allProfiles={allProfiles}
        session={session}
        profile={profile}
        onOpenProfile={onOpenProfile}
        onOpenPricing={onOpenPricing}
        onCreateChannel={handleCreateChannel}
        onOpenCreatePersona={handleOpenCreatePersona}
        onOpenCreateDM={() => {
          setActiveServerId(null)
          setHomeSubView("fellows")
          onCloseActive()
        }}
        voiceConnected={voiceConnected}
        onToggleVoice={handleToggleVoice}
      />

      {/* ── 3. Main Center Content Area (Flex: 1) ───────────────────── */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {activeServerId !== null && activeChannel ? (
          /* Inside a Server Channel */
          <ServerChatArea
            channel={activeChannel}
            messages={channelMessages[activeChannel.id] || []}
            onSendMessage={handleSendMessage}
            onToggleMemberList={() => setMemberListOpen((v) => !v)}
            memberListOpen={memberListOpen}
            session={session}
            profile={profile}
            onTriggerAiIcebreaker={handleTriggerAiIcebreaker}
            generatingImg={generatingImg}
            onGenerateImage={handleGenerateImage}
            typingNames={activeTypingNames}
            onTyping={handleUserTyping}
            onReactMessage={handleReactMessage}
            voiceConnected={voiceConnected}
            onToggleVoice={handleToggleVoice}
          />
        ) : activeConvo ? (
          /* Inside a Direct Message */
          <DMWindow
            session={session}
            activeConvo={activeConvo}
            allProfiles={allProfiles}
            onBack={onCloseActive}
            creating={creating}
            setCreating={setCreating}
            onReplicaCreated={(char) => {
              onOpenChar(char)
            }}
          />
        ) : activeChar ? (
          /* Inside an AI Persona Chat */
          <ChatWindow
            session={session}
            activeChar={activeChar}
            messages={charMessages}
            setMessages={setCharMessages}
            onBack={onCloseActive}
            creating={creating}
            setCreating={setCreating}
            onDeleteCharacter={onDeleteCharacter}
            planTier={planTier}
            quota={quota}
            onOpenPricing={onOpenPricing}
          />
        ) : showCharForm ? (
          /* Character Creator */
          <CharacterForm
            session={session}
            initialChar={editingChar}
            onCreated={(c) => {
              setShowCharForm(false)
              setEditingChar(null)
              onOpenChar(c)
            }}
            onUpdated={(c) => {
              setShowCharForm(false)
              setEditingChar(null)
              onOpenChar(c)
            }}
            onCancel={() => {
              setShowCharForm(false)
              setEditingChar(null)
            }}
          />
        ) : homeSubView === "radar" ? (
          /* Radar Matchmaker */
          <RandomMatchWindow
            session={session}
            profile={profile}
            allProfiles={allProfiles}
            characters={characters}
            onBack={() => setHomeSubView("fellows")}
            onStartPermanentConvo={onStartConversation}
            onOpenChar={onOpenChar}
          />
        ) : homeSubView === "personas" ? (
          /* AI Persona Gallery */
          <AIGridView
            characters={characters}
            charsLoading={charsLoading}
            session={session}
            onOpenChar={onOpenChar}
            onOpenForm={() => {
              setEditingChar(null)
              setShowCharForm(true)
            }}
            onEditChar={(c) => {
              setEditingChar(c)
              setShowCharForm(true)
            }}
            onDeleteCharacter={onDeleteCharacter}
            setView={(v) => {
              if (v === "people") setHomeSubView("fellows")
              else if (v === "radar") setHomeSubView("radar")
            }}
            onOpenProfile={onOpenProfile}
            onSignOut={onSignOut}
            planTier={planTier}
            onOpenPricing={onOpenPricing}
          />
        ) : (
          /* Fellows Directory */
          <PeopleDirectoryView
            session={session}
            allProfiles={allProfiles}
            conversations={conversations}
            onStartConversation={onStartConversation}
            onOpenPricing={onOpenPricing}
            onOpenRadar={() => setHomeSubView("radar")}
          />
        )}

        {/* ── 4. Far-Right Server Member List (Collapsible, 240px) ───── */}
        {activeServerId !== null && memberListOpen && (
          <ServerMemberList
            members={serverMembers}
            voiceConnected={voiceConnected}
            onStartDM={(targetUserId) => {
              setActiveServerId(null)
              onStartConversation(targetUserId)
            }}
            onOpenReplica={(member) => {
              const matchedChar = characters.find((c) => c.name.toLowerCase().includes(member.display_name?.toLowerCase() || ""))
              if (matchedChar) {
                onOpenChar(matchedChar)
              }
            }}
          />
        )}
      </main>

      {/* ── Create Server Modal ────────────────────────────────────── */}
      {showCreateServer && (
        <CreateServerModal
          onClose={() => setShowCreateServer(false)}
          onCreateServer={handleCreateServer}
          userId={session?.user?.id || "user"}
        />
      )}
    </div>
  )
}
