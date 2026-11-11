"use client"
import { useState, useEffect, useMemo } from "react"
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
      { id: "gl-ai-trivia", serverId: "gaming-lounge", name: "trivia-bot", type: "ai", topic: "Compete with AI trivia masters" },
    ],
  },
]

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

  // Channel Messages Map
  const [channelMessages, setChannelMessages] = useState<Record<string, DiscordMessage[]>>({
    "kc-general": [
      {
        id: "msg-welcome-1",
        channelId: "kc-general",
        senderId: "system",
        senderName: "Kikar AI ✦",
        role: "bot",
        badge: "BOT",
        content: "👋 Welcome to Kikar Central! This is your AI-native community space. You can talk to humans, summon @ai anytime, or test out offline digital replicas.",
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

  // Load servers from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("kikar_discord_servers")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setServers(parsed)
        }
      } catch (err) {
        console.error("Failed to parse saved servers", err)
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
      status_note: profile?.replica_status_note || "Exploring Kikar Discord",
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

    // 3. AI Personas living in server
    for (const char of characters || []) {
      list.push({
        id: `bot-${char.id}`,
        username: char.name.toLowerCase().replace(/\s+/g, "_"),
        display_name: char.name,
        avatar_url: "",
        is_bot: true,
        is_online: true,
        role: "bot",
        status_note: char.is_replica ? "Offline Digital Twin" : "Custom AI Persona",
      })
    }

    return list
  }, [session, profile, allProfiles, characters])

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
    onCloseActive()
    setMobileDrawerOpen(false)
  }

  async function handleSendMessage(content: string, imageUrl?: string) {
    if (!activeChannel) return

    const userMsg: DiscordMessage = {
      id: `msg-${Date.now()}`,
      channelId: activeChannel.id,
      senderId: session?.user?.id || "guest",
      senderName: profile?.display_name || profile?.username || session?.user?.email?.split("@")[0] || "User",
      senderAvatar: profile?.avatar_url,
      role: "user",
      content,
      imageUrl,
      created_at: new Date().toISOString(),
    }

    setChannelMessages((prev) => ({
      ...prev,
      [activeChannel.id]: [...(prev[activeChannel.id] || []), userMsg],
    }))

    // If channel is AI arena or message mentions @ai / @kikar
    const shouldInvokeAI =
      activeChannel.type === "ai" ||
      content.toLowerCase().includes("@ai") ||
      content.toLowerCase().includes("@kikar")

    if (shouldInvokeAI) {
      try {
        const promptText = content.replace(/@ai|@kikar/gi, "").trim() || "Hello!"
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: promptText }],
            systemPrompt: `You are Kikar AI, an intelligent, witty, and helpful member of this Discord-style community channel #${activeChannel.name}. Keep your answers concise, natural, and conversational.`,
            maxTokens: 250,
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
        setChannelMessages((prev) => ({
          ...prev,
          [activeChannel.id]: [...(prev[activeChannel.id] || []), botReply],
        }))
      } catch (err) {
        console.error("AI channel reply error", err)
      }
    }
  }

  function handleTriggerAiIcebreaker() {
    if (!activeChannel) return
    const icebreakers = [
      "✦ Kikar Wingman: If you had to delete every app on your phone except 3, what are you keeping?",
      "✦ Kikar Wingman: What's one unpopular tech opinion you will defend with your life?",
      "✦ Kikar Wingman: Would you rather fight 1 horse-sized duck or 100 duck-sized horses?",
      "✦ Kikar Wingman: Tell the channel two truths and one lie — let's see who guesses first!",
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
    setChannelMessages((prev) => ({
      ...prev,
      [activeChannel.id]: [...(prev[activeChannel.id] || []), botMsg],
    }))
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
        onOpenCreateDM={() => {
          setActiveServerId(null)
          setHomeSubView("fellows")
          onCloseActive()
        }}
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
              onOpenChar(c)
            }}
            onCancel={() => setShowCharForm(false)}
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
            onOpenForm={() => setShowCharForm(true)}
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
