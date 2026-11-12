"use client"
import { useState, useEffect, useMemo, useRef } from "react"
import { apiFetch } from "../../lib/apiFetch"
import { supabase } from "../../lib/supabase"
import { WebRTCVoiceManager, type VoicePeerState } from "../../lib/webrtcVoice"
import ServerRail from "./ServerRail"
import ChannelSidebar from "./ChannelSidebar"
import ServerChatArea from "./ServerChatArea"
import ServerMemberList from "./ServerMemberList"
import CreateServerModal from "./CreateServerModal"
import VoiceLoungeStage from "./VoiceLoungeStage"
import PeopleDirectoryView from "../PeopleDirectoryView"
import RandomMatchWindow from "../RandomMatchWindow"
import AIGridView from "../AIGridView"
import DMWindow from "../DMWindow"
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
  charMessages?: any[]
  setCharMessages?: (msgs: any) => void
  onCloseActive: () => void
  onStartConversation: (partnerId: string) => void
  onOpenProfile: () => void
  onSignOut: () => void
  planTier: PlanTier
  quota: UsageQuota | null
  onConsumeChatQuota?: () => boolean
  onConsumeImageQuota?: () => boolean
  onOpenPricing: () => void
  onDeleteCharacter: (id: string) => void
  creating: boolean
  setCreating: (v: boolean) => void
}

const DEFAULT_SERVERS: DiscordServer[] = [
  {
    id: "kikar-central",
    name: "Kikar Central",
    ownerId: "system",
    description: "Official community hub for Kikar AI, human fellows, and digital twins.",
    channels: [
      { id: "kc-general", serverId: "kikar-central", name: "general", type: "text", topic: "General community banter & hello!" },
      { id: "kc-ai-wingman", serverId: "kikar-central", name: "ai-wingman", type: "ai", topic: "Chat with the AI wingman & brainstorm" },
      { id: "kc-voice-hangout", serverId: "kikar-central", name: "voice-hangout", type: "voice", topic: "Live P2P WebRTC voice audio hangout lounge" },
      { id: "kc-announcements", serverId: "kikar-central", name: "announcements", type: "text", topic: "Kikar platform updates & releases" },
      { id: "kc-radar-lounge", serverId: "kikar-central", name: "radar-lounge", type: "radar", topic: "Speed stranger matching lounge" },
    ],
  },
  {
    id: "gaming-lounge",
    name: "Gaming & Banter",
    ownerId: "system",
    description: "Gaming discussion, anime debates, and AI trivia.",
    channels: [
      { id: "gl-general", serverId: "gaming-lounge", name: "game-chat", type: "text", topic: "Talk games, clips, and setups" },
      { id: "gl-voice-comms", serverId: "gaming-lounge", name: "squad-voice", type: "voice", topic: "Live P2P WebRTC gaming comms voice lounge" },
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
  charMessages = [],
  setCharMessages,
  onCloseActive,
  onStartConversation,
  onOpenProfile,
  onSignOut,
  planTier,
  quota,
  onConsumeChatQuota,
  onConsumeImageQuota,
  onOpenPricing,
  onDeleteCharacter,
  creating,
  setCreating,
}: Props) {
  const [servers, setServers] = useState<DiscordServer[]>(DEFAULT_SERVERS)
  const [activeServerId, setActiveServerId] = useState<string | null>(null) // null = Home / DMs
  const [activeChannelId, setActiveChannelId] = useState<string>("kc-general")
  const [homeSubView, setHomeSubView] = useState<"fellows" | "radar" | "personas">("fellows")
  const [memberListOpen, setMemberListOpen] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)
  const [showCreateServer, setShowCreateServer] = useState(false)
  const [editingChar, setEditingChar] = useState<any>(null)
  const [showCharForm, setShowCharForm] = useState(false)
  const [localCharMsgs, setLocalCharMsgs] = useState<any[]>([])

  const effectiveCharMessages = setCharMessages ? charMessages : localCharMsgs
  const updateCharMessages = setCharMessages || setLocalCharMsgs

  // Default memberListOpen to true only on desktop screens (>= 1024px)
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) {
      setMemberListOpen(true)
    }
  }, [])

  // Live Features & WebRTC Voice State
  const [voiceConnected, setVoiceConnected] = useState(false)
  const [voiceChannelId, setVoiceChannelId] = useState<string | null>(null)
  const [voicePeers, setVoicePeers] = useState<VoicePeerState[]>([])
  const [micMuted, setMicMuted] = useState(false)
  const [deafened, setDeafened] = useState(false)
  const [voiceWarning, setVoiceWarning] = useState<string | null>(null)

  const [generatingImg, setGeneratingImg] = useState(false)
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; expires: number }>>({})

  const realtimeChannelRef = useRef<any>(null)
  const voiceManagerRef = useRef<WebRTCVoiceManager | null>(null)

  const myName = profile?.display_name || profile?.username || session?.user?.email?.split("@")[0] || "User"

  // Clean up WebRTC voice on unmount
  useEffect(() => {
    return () => {
      if (voiceManagerRef.current) {
        voiceManagerRef.current.leave()
        voiceManagerRef.current = null
      }
    }
  }, [])

  const [channelMessages, setChannelMessages] = useState<Record<string, DiscordMessage[]>>({
    "kc-general": [
      {
        id: "msg-welcome-1",
        channelId: "kc-general",
        senderId: "system",
        senderName: "Kikar AI",
        role: "bot",
        badge: "BOT",
        content: "Welcome to Kikar Central! This is your AI-native community space. Chat with real friends, summon @ai anytime, hop into #voice-hangout for live P2P WebRTC audio, or mention friends to chat with their offline Digital Replicas.",
        created_at: new Date(Date.now() - 3600000).toISOString(),
      },
    ],
    "kc-ai-wingman": [
      {
        id: "msg-ai-1",
        channelId: "kc-ai-wingman",
        senderId: "ai-wingman",
        senderName: "AI Wingman",
        role: "bot",
        badge: "BOT",
        content: "Wingman ready! Ask me for an icebreaker, settle a debate, or brainstorm anything by typing in this channel or tagging @ai.",
        created_at: new Date().toISOString(),
      },
    ],
  })

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

  const connectedVoiceChannel = useMemo(() => {
    if (!voiceChannelId) return null
    for (const s of servers) {
      const ch = s.channels.find((c) => c.id === voiceChannelId)
      if (ch) return ch
    }
    return null
  }, [servers, voiceChannelId])

  // ── Supabase Realtime Subscription for Active Channel ────────────
  useEffect(() => {
    if (!activeChannel) return

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

  const serverMembers: DiscordMember[] = useMemo(() => {
    const list: DiscordMember[] = []

    list.push({
      id: session?.user?.id || "me",
      username: profile?.username || session?.user?.email?.split("@")[0] || "user",
      display_name: profile?.display_name || "You",
      avatar_url: profile?.avatar_url,
      is_online: true,
      role: "owner",
      status_note:
        profile?.replica_status_note ||
        (voiceConnected ? `In #${connectedVoiceChannel?.name || "voice"}` : "Exploring Kikar Discord"),
    })

    for (const p of allProfiles || []) {
      if (p.id === session?.user?.id) continue
      const inVoice = voicePeers.some((vp) => vp.userId === p.id)
      list.push({
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        is_online: p.is_online || inVoice,
        role: "member",
        status_note: inVoice ? `In #${connectedVoiceChannel?.name || "voice"}` : p.replica_status_note,
      })
    }

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
  }, [session, profile, allProfiles, characters, voiceConnected, voicePeers, connectedVoiceChannel])

  const activeTypingNames = useMemo(() => {
    return Object.values(typingUsers).map((u) => u.name)
  }, [typingUsers])

  // ── WebRTC Voice Lounge Connection Management ───────────────────
  async function connectToVoiceLounge(targetChannelId: string) {
    if (voiceManagerRef.current) {
      await voiceManagerRef.current.leave()
      voiceManagerRef.current = null
    }

    setVoiceWarning(null)
    const myId = session?.user?.id || `guest-${Math.random().toString(36).slice(2, 8)}`
    const mgr = new WebRTCVoiceManager({
      channelId: targetChannelId,
      userId: myId,
      username: myName,
      avatarUrl: profile?.avatar_url,
      onPeersChanged: (peers) => {
        setVoicePeers([...peers])
      },
      onError: (errMsg) => {
        setVoiceWarning(errMsg)
      },
    })

    voiceManagerRef.current = mgr
    setVoiceChannelId(targetChannelId)
    setVoiceConnected(true)
    playDiscordChime("join")

    await mgr.join()
    if (micMuted) mgr.setMuted(true)
    if (deafened) mgr.setDeafened(true)

    const notice: DiscordMessage = {
      id: `notice-${Date.now()}`,
      channelId: targetChannelId,
      senderId: "system",
      senderName: "System",
      role: "system",
      content: `${myName} connected to WebRTC voice lounge.`,
      created_at: new Date().toISOString(),
    }
    setChannelMessages((prev) => {
      const updated = {
        ...prev,
        [targetChannelId]: [...(prev[targetChannelId] || []), notice],
      }
      localStorage.setItem("kikar_discord_messages", JSON.stringify(updated))
      return updated
    })
    if (realtimeChannelRef.current && activeChannel?.id === targetChannelId) {
      realtimeChannelRef.current.send({
        type: "broadcast",
        event: "new-channel-msg",
        payload: notice,
      })
    }
  }

  async function disconnectFromVoiceLounge() {
    const prevChannelId = voiceChannelId || activeChannel?.id
    if (voiceManagerRef.current) {
      await voiceManagerRef.current.leave()
      voiceManagerRef.current = null
    }
    setVoiceConnected(false)
    setVoiceChannelId(null)
    setVoicePeers([])
    setVoiceWarning(null)
    playDiscordChime("leave")

    if (prevChannelId) {
      const notice: DiscordMessage = {
        id: `notice-${Date.now()}`,
        channelId: prevChannelId,
        senderId: "system",
        senderName: "System",
        role: "system",
        content: `${myName} left the voice lounge.`,
        created_at: new Date().toISOString(),
      }
      setChannelMessages((prev) => {
        const updated = {
          ...prev,
          [prevChannelId]: [...(prev[prevChannelId] || []), notice],
        }
        localStorage.setItem("kikar_discord_messages", JSON.stringify(updated))
        return updated
      })
      if (realtimeChannelRef.current && activeChannel?.id === prevChannelId) {
        realtimeChannelRef.current.send({
          type: "broadcast",
          event: "new-channel-msg",
          payload: notice,
        })
      }
    }
  }

  function handleToggleVoice() {
    if (voiceConnected) {
      disconnectFromVoiceLounge()
    } else {
      // Find appropriate voice channel to join
      const targetChId =
        activeChannel?.type === "voice"
          ? activeChannel.id
          : activeServer?.channels.find((c) => c.type === "voice")?.id ||
            activeChannel?.id ||
            "kc-voice-hangout"
      connectToVoiceLounge(targetChId)
    }
  }

  function handleToggleMic() {
    const nextMuted = !micMuted
    setMicMuted(nextMuted)
    if (voiceManagerRef.current) {
      voiceManagerRef.current.setMuted(nextMuted)
    }
  }

  function handleToggleDeafen() {
    const nextDeafened = !deafened
    setDeafened(nextDeafened)
    if (nextDeafened && !micMuted) {
      setMicMuted(true)
    }
    if (voiceManagerRef.current) {
      voiceManagerRef.current.setDeafened(nextDeafened)
    }
  }

  function handleSetPeerVolume(userId: string, volume: number) {
    if (voiceManagerRef.current) {
      voiceManagerRef.current.setPeerVolume(userId, volume)
    }
  }

  function handleBroadcastVoiceTranscript(speaker: string, text: string, role: "user" | "bot") {
    const targetId = voiceChannelId || activeChannel?.id
    if (!targetId) return

    const transcriptMsg: DiscordMessage = {
      id: `vtrans-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      channelId: targetId,
      senderId: role === "bot" ? "kikar-voice-ai" : session?.user?.id || "user",
      senderName: speaker,
      senderAvatar: role === "user" ? profile?.avatar_url : undefined,
      role,
      badge: role === "bot" ? "VOICE AI" : undefined,
      content: text,
      created_at: new Date().toISOString(),
    }

    setChannelMessages((prev) => {
      const updated = {
        ...prev,
        [targetId]: [...(prev[targetId] || []), transcriptMsg],
      }
      localStorage.setItem("kikar_discord_messages", JSON.stringify(updated))
      return updated
    })

    if (realtimeChannelRef.current && activeChannel?.id === targetId) {
      realtimeChannelRef.current.send({
        type: "broadcast",
        event: "new-channel-msg",
        payload: transcriptMsg,
      })
    }
  }

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

    // If user clicked a voice channel and isn't already connected to it, auto-connect
    const targetChannel = activeServer?.channels.find((c) => c.id === channelId)
    if (targetChannel?.type === "voice" && voiceChannelId !== channelId) {
      connectToVoiceLounge(channelId)
    }
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

    // 1. Check if a custom AI Persona or Digital Replica was mentioned
    for (const rawTag of mentionMatches) {
      const cleanTag = rawTag.slice(1).toLowerCase()
      if (cleanTag === "ai" || cleanTag === "kikar") continue

      const matchedChar = (characters || []).find((c) => {
        const charSlug = (c.name || "").toLowerCase().replace(/\s+/g, "_")
        const charFirst = (c.name || "").toLowerCase().split(" ")[0]
        return charSlug === cleanTag || charFirst === cleanTag || (c.name || "").toLowerCase() === cleanTag
      })

      if (matchedChar) {
        const botTypingKey = `bot-${matchedChar.id}`
        setTypingUsers((prev) => ({
          ...prev,
          [botTypingKey]: { name: matchedChar.name, expires: Date.now() + 8000 },
        }))

        setTimeout(async () => {
          try {
            const recentHistory = (channelMessages[activeChannel.id] || []).slice(-6).map((m) => ({
              role: m.senderId === session?.user?.id ? "user" : "assistant",
              content: `${m.senderName}: ${m.content}`,
            }))

            const res = await apiFetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messages: [
                  ...recentHistory,
                  { role: "user", content: `${myName}: ${content}` },
                ],
                systemPrompt: `${matchedChar.prompt}\n\nYou are chatting inside the #${activeChannel.name} channel on Kikar Discord. Keep your reply natural, in-character, and concise (1-3 sentences).`,
                maxTokens: 220,
                userId: session?.user?.id,
              }),
            })
            const data = await res.json()
            const isRep = !!matchedChar.is_replica
            const botReply: DiscordMessage = {
              id: `char-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              channelId: activeChannel.id,
              senderId: `bot-${matchedChar.id}`,
              senderName: matchedChar.name,
              senderAvatar: matchedChar.avatar_url,
              role: isRep ? "replica" : "bot",
              badge: isRep ? "REPLICA" : "AI PERSONA",
              content: data?.reply || `Hey ${myName}!`,
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
            console.error("Character mention reply error:", err)
          } finally {
            setTypingUsers((prev) => {
              const copy = { ...prev }
              delete copy[botTypingKey]
              return copy
            })
          }
        }, 700)
        return
      }

      // 2. Check if an offline human fellow with replica mode enabled was mentioned
      const matchedUser = (allProfiles || []).find((p) => {
        const uName = (p.username || "").toLowerCase()
        const dName = (p.display_name || "").toLowerCase().replace(/\s+/g, "_")
        const dFirst = (p.display_name || "").toLowerCase().split(" ")[0]
        return uName === cleanTag || dName === cleanTag || dFirst === cleanTag
      })

      if (matchedUser && (!matchedUser.is_online || matchedUser.replica_Drop_in || matchedUser.replica_enabled)) {
        const repKey = `rep-${matchedUser.id}`
        const repName = `${matchedUser.display_name || matchedUser.username} (Replica)`
        setTypingUsers((prev) => ({
          ...prev,
          [repKey]: { name: repName, expires: Date.now() + 8000 },
        }))

        setTimeout(async () => {
          try {
            const styleNote = matchedUser.replica_bio || matchedUser.bio || "Casual, friendly, witty texting style."
            const statusNote = matchedUser.replica_status_note ? `Currently away: "${matchedUser.replica_status_note}".` : "Currently offline."

            const res = await apiFetch("/api/chat", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                messages: [{ role: "user", content: `${myName} mentioned you in #${activeChannel.name}: "${content}"` }],
                systemPrompt: `You are the Digital Replica (AI twin) of ${matchedUser.display_name || matchedUser.username} on Kikar. ${statusNote} Personality & style: ${styleNote}. Reply directly to ${myName} in first person as their digital twin in 1-2 casual sentences.`,
                maxTokens: 180,
                userId: session?.user?.id,
              }),
            })
            const data = await res.json()
            const repReply: DiscordMessage = {
              id: `rep-${Date.now()}`,
              channelId: activeChannel.id,
              senderId: `replica-${matchedUser.id}`,
              senderName: `${matchedUser.display_name || matchedUser.username}`,
              senderAvatar: matchedUser.avatar_url,
              role: "replica",
              badge: "REPLICA",
              content: data?.reply || `Hey! I'm away right now, but my Digital Replica caught your ping.`,
              created_at: new Date().toISOString(),
            }

            setChannelMessages((prev) => {
              const updated = {
                ...prev,
                [activeChannel.id]: [...(prev[activeChannel.id] || []), repReply],
              }
              localStorage.setItem("kikar_discord_messages", JSON.stringify(updated))
              return updated
            })

            if (realtimeChannelRef.current) {
              realtimeChannelRef.current.send({
                type: "broadcast",
                event: "new-channel-msg",
                payload: repReply,
              })
            }
          } catch (err) {
            console.error("Replica auto-reply error:", err)
          } finally {
            setTypingUsers((prev) => {
              const copy = { ...prev }
              delete copy[repKey]
              return copy
            })
          }
        }, 850)
        return
      }
    }

    // 3. Default @ai / AI Arena Channel response
    if (isAiSummon) {
      const promptText = content.replace(/@ai/gi, "").replace(/@kikar/gi, "").trim() || content
      setTypingUsers((prev) => ({
        ...prev,
        "kikar-ai-bot": { name: "Kikar AI", expires: Date.now() + 8000 },
      }))

      setTimeout(async () => {
        try {
          const recentHistory = (channelMessages[activeChannel.id] || []).slice(-6).map((m) => ({
            role: m.senderId === session?.user?.id ? "user" : "assistant",
            content: `${m.senderName}: ${m.content}`,
          }))

          const res = await apiFetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: [
                ...recentHistory,
                { role: "user", content: `${myName}: ${promptText}` },
              ],
              systemPrompt: `You are Kikar AI, an intelligent, witty, Discord-native co-pilot and active citizen of channel #${activeChannel.name}.
You are in a lively group server with human users and digital replicas.
Keep your answer concise, engaging, and formatting-rich (markdown). Use emojis sparingly, only when they add clarity. Avoid robotic greetings.`,
              maxTokens: 300,
              userId: session?.user?.id,
            }),
          })
          const data = await res.json()
          const botReply: DiscordMessage = {
            id: `ai-${Date.now()}`,
            channelId: activeChannel.id,
            senderId: "kikar-bot",
            senderName: "Kikar AI",
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
      content: `Generating image: "${prompt}"...`,
      created_at: new Date().toISOString(),
    }

    setChannelMessages((prev) => ({
      ...prev,
      [activeChannel.id]: [...(prev[activeChannel.id] || []), userPromptMsg],
    }))

    try {
      const res = await apiFetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, userId: session?.user?.id }),
      })
      const data = await res.json()

      if (data?.url) {
        const artMsg: DiscordMessage = {
          id: `img-${Date.now()}`,
          channelId: activeChannel.id,
          senderId: "kikar-bot",
          senderName: "Kikar AI",
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
          content: `Could not generate image: ${data?.error || "Unknown error"}`,
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
      "Kikar Wingman: If you had to delete every app on your phone except 3, what are you keeping?",
      "Kikar Wingman: What's one unpopular tech opinion you will defend with your life?",
      "Kikar Wingman: Would you rather fight 1 horse-sized duck or 100 duck-sized horses?",
      "Kikar Wingman: Tell the channel two truths and one lie — let's see who guesses first!",
      "Kikar Wingman: If AI could automate 100% of one chore in your life forever, what chore are you banishing?",
    ]
    const chosen = icebreakers[Math.floor(Math.random() * icebreakers.length)]
    const botMsg: DiscordMessage = {
      id: `ai-${Date.now()}`,
      channelId: activeChannel.id,
      senderId: "kikar-wingman",
      senderName: "AI Wingman",
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

  const showVoiceStageInChat =
    activeChannel &&
    (activeChannel.type === "voice" || (voiceConnected && voiceChannelId === activeChannel.id))

  return (
    <div
      className="cc-discord-root"
      style={{
        display: "flex",
        width: "100%",
        height: "100dvh",
        background: "#0f1115",
        color: "#d5d9e0",
        overflow: "hidden",
        position: "relative",
      }}
    >
      {/* ── Mobile Backdrop Overlay When Left Drawer is Open ──────── */}
      {mobileDrawerOpen && (
        <div
          className="cc-discord-drawer-backdrop"
          onClick={() => setMobileDrawerOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.65)",
            zIndex: 95,
          }}
        />
      )}

      {/* ── Left Navigation Wrapper (ServerRail + ChannelSidebar) ─── */}
      <div className={`cc-discord-nav-drawer${mobileDrawerOpen ? " drawer-open" : ""}`}>
        <ServerRail
          servers={servers}
          activeServerId={activeServerId}
          onSelectServer={handleSelectServer}
          onOpenCreateServer={() => setShowCreateServer(true)}
          onOpenRadar={() => {
            setActiveServerId(null)
            setHomeSubView("radar")
            onCloseActive()
            setMobileDrawerOpen(false)
          }}
          unreadDMsCount={0}
        />

        <ChannelSidebar
          activeServer={activeServer}
          activeChannelId={activeChannelId}
          onSelectChannel={handleSelectChannel}
          homeSubView={homeSubView}
          onSelectHomeSubView={handleSelectHomeSubView}
          conversations={conversations}
          activeConvo={activeConvo}
          onOpenConvo={(convo) => {
            onOpenConvo(convo)
            setMobileDrawerOpen(false)
          }}
          allProfiles={allProfiles}
          session={session}
          profile={profile}
          onOpenProfile={() => {
            onOpenProfile()
            setMobileDrawerOpen(false)
          }}
          onOpenPricing={onOpenPricing}
          onCreateChannel={handleCreateChannel}
          onOpenCreatePersona={handleOpenCreatePersona}
          onOpenCreateDM={() => {
            setActiveServerId(null)
            setHomeSubView("fellows")
            onCloseActive()
            setMobileDrawerOpen(false)
          }}
          voiceConnected={voiceConnected}
          onToggleVoice={handleToggleVoice}
          micMuted={micMuted}
          deafened={deafened}
          onToggleMic={handleToggleMic}
          onToggleDeafen={handleToggleDeafen}
          voiceChannelName={connectedVoiceChannel?.name}
          voicePeersCount={voicePeers.length}
        />
      </div>

      {/* ── 3. Main Center Content Area (Flex: 1) ───────────────────── */}
      <main
        style={{
          flex: 1,
          minWidth: 0,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Mobile Top Navigation Strip when inside Home Subviews (Fellows / Radar / Personas) */}
        {activeServerId === null && !activeConvo && !activeChar && (
          <div className="cc-discord-mobile-topbar">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                color: "#eceef2",
                fontSize: 16,
                width: 34,
                height: 34,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
              title="Open Servers & Channels"
            >
              
            </button>
            <div style={{ display: "flex", gap: 6, flex: 1, justifyContent: "center" }}>
              {([
                { id: "fellows", label: "Fellows" },
                { id: "radar",   label: "Radar" },
                { id: "personas",label: "Personas" },
              ] as const).map(t => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleSelectHomeSubView(t.id)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 8,
                    border: "none",
                    background: homeSubView === t.id ? "hsla(226,72%,70%,0.18)" : "transparent",
                    color: homeSubView === t.id ? "hsl(226,72%,70%)" : "#9aa1ad",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, display: "flex", position: "relative", overflow: "hidden" }}>
          {activeServerId !== null && activeChannel ? (
            <ServerChatArea
              channel={activeChannel}
              messages={channelMessages[activeChannel.id] || []}
              onSendMessage={handleSendMessage}
              onToggleMemberList={() => setMemberListOpen((v) => !v)}
              memberListOpen={memberListOpen}
              session={session}
              profile={profile}
              onOpenMobileMenu={() => setMobileDrawerOpen(true)}
              onTriggerAiIcebreaker={handleTriggerAiIcebreaker}
              generatingImg={generatingImg}
              onGenerateImage={handleGenerateImage}
              typingNames={activeTypingNames}
              onTyping={handleUserTyping}
              onReactMessage={handleReactMessage}
              voiceConnected={voiceConnected}
              onToggleVoice={handleToggleVoice}
              voiceStage={
                showVoiceStageInChat ? (
                  <VoiceLoungeStage
                    channelName={activeChannel.name}
                    voiceConnected={voiceConnected && voiceChannelId === activeChannel.id}
                    peers={voicePeers}
                    micMuted={micMuted}
                    deafened={deafened}
                    voiceWarning={voiceWarning}
                    onToggleConnect={() => {
                      if (voiceConnected && voiceChannelId === activeChannel.id) {
                        disconnectFromVoiceLounge()
                      } else {
                        connectToVoiceLounge(activeChannel.id)
                      }
                    }}
                    onToggleMic={handleToggleMic}
                    onToggleDeafen={handleToggleDeafen}
                    onSetPeerVolume={handleSetPeerVolume}
                    session={session}
                    myName={myName}
                    onBroadcastVoiceTranscript={handleBroadcastVoiceTranscript}
                  />
                ) : undefined
              }
            />
          ) : activeConvo ? (
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
            <ChatWindow
              session={session}
              activeChar={activeChar}
              messages={effectiveCharMessages}
              setMessages={updateCharMessages}
              onBack={onCloseActive}
              creating={creating}
              setCreating={setCreating}
              onDeleteCharacter={onDeleteCharacter}
              planTier={planTier}
              quota={quota}
              onConsumeChatQuota={onConsumeChatQuota}
              onConsumeImageQuota={onConsumeImageQuota}
              onOpenPricing={onOpenPricing}
            />
          ) : showCharForm ? (
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
        </div>
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
