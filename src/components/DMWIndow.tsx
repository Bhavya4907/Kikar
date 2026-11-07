"use client"
import { useEffect, useRef, useState } from "react"
import { supabase } from "../lib/supabase"
import { T } from "../styles"
import { formatTime, formatDate, showNotification, speakMessageText, stopSpeakingText } from "../lib/helpers"

interface Props {
  session: any
  activeConvo: any
  allProfiles: any[]
  onBack: () => void
  creating: boolean
  setCreating: (v: boolean) => void
  onReplicaCreated: (char: any) => void
}

export default function DMWindow({
  session, activeConvo, allProfiles, onBack, creating, setCreating, onReplicaCreated
}: Props) {
  const [input, setInput] = useState("")
  const [directMessages, setDirectMessages] = useState<any[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [activeActionMsgId, setActiveActionMsgId] = useState<string | null>(null)
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null)
  const [autoReplicaMode, setAutoReplicaMode] = useState(false)
  const [replicaTyping, setReplicaTyping] = useState(false)
  const [catchUpSummary, setCatchUpSummary] = useState<string | null>(null)
  const [summarizingDigest, setSummarizingDigest] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const channelRef = useRef<any>(null)

  const other = activeConvo.user1_id === session.user.id
    ? activeConvo.user2
    : activeConvo.user1
  const otherProfile = allProfiles.find((p: any) => p.id === other?.id) || other

  // Helper to merge messages without duplicates
  function mergeMessages(incoming: any[]) {
    setDirectMessages(prev => {
      const map = new Map<string, any>()
      for (const m of prev) {
        if (!String(m.id).startsWith("temp-")) {
          map.set(String(m.id), m)
        }
      }
      for (const m of incoming) {
        if (m && m.id) {
          map.set(String(m.id), m)
        }
      }
      return Array.from(map.values()).sort(
        (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      )
    })
  }

  // ── Triple-Redundant Live Chat Sync (Initial Fetch + Broadcast + Postgres Changes + 2.5s Polling) ──
  useEffect(() => {
    if (!activeConvo?.id) return
    setCatchUpSummary(null)
    setShowMobileMenu(false)

    async function fetchMessages() {
      const { data } = await supabase
        .from("direct_messages")
        .select("*")
        .eq("conversation_id", activeConvo.id)
        .order("created_at", { ascending: true })
      if (data) {
        mergeMessages(data)
      }
    }

    fetchMessages()

    // Mark unread messages as read
    supabase.from("direct_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", activeConvo.id)
      .neq("sender_id", session.user.id)
      .is("read_at", null)
      .then(() => {})

    // 1. Realtime channel with BOTH Broadcast (peer-to-peer WebSocket, zero RLS latency) AND postgres_changes
    const ch = supabase
      .channel(`convo-live-${activeConvo.id}`, {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: "dm-insert" }, ({ payload }) => {
        if (payload && payload.conversation_id === activeConvo.id) {
          mergeMessages([payload])
          if (payload.sender_id !== session.user.id) {
            const name = otherProfile?.display_name || otherProfile?.username || "Someone"
            const isImage = payload.content?.startsWith("[image]:")
            showNotification(name, isImage ? "📷 Sent an image" : payload.content)
          }
        }
      })
      .on("broadcast", { event: "dm-delete" }, ({ payload }) => {
        if (payload?.id) {
          setDirectMessages(prev => prev.filter(m => m.id !== payload.id))
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" },
        (p) => {
          if (p.new && p.new.conversation_id === activeConvo.id) {
            mergeMessages([p.new])
            if (p.new.sender_id !== session.user.id) {
              const name = otherProfile?.display_name || otherProfile?.username || "Someone"
              const isImage = p.new.content?.startsWith("[image]:")
              showNotification(name, isImage ? "📷 Sent an image" : p.new.content)
            }
          }
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "direct_messages" },
        (p) => {
          if (p.old?.id) {
            setDirectMessages(prev => prev.filter(m => m.id !== p.old.id))
          }
        })
      .subscribe()

    channelRef.current = ch

    // 2. Automatic 2.5s polling fallback so live chat works even if Supabase Realtime replication is off
    const pollInterval = setInterval(fetchMessages, 2500)

    return () => {
      clearInterval(pollInterval)
      supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [activeConvo?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [directMessages.length, replicaTyping])

  async function triggerSmartDMResponse(userMessageText: string, recentMessages: any[]) {
    const isAiSummon = /^@(ai|kikar)\b/i.test(userMessageText.trim())
    const isRecipientOffline = !otherProfile?.is_online && autoReplicaMode

    if (!isAiSummon && !isRecipientOffline) return

    setReplicaTyping(true)
    try {
      let systemPrompt = ""
      let personaBadge = ""

      if (isAiSummon) {
        const otherName = otherProfile?.display_name || otherProfile?.username || "Friend"
        systemPrompt = `You are Kikar AI Co-Pilot, summoned inside a direct message conversation between two human friends (${session.user.email?.split("@")[0]} and ${otherName}). Be helpful, witty, concise (under 75 words), and directly answer or mediate their request.`
        personaBadge = "✦ Kikar AI Co-Pilot"
      } else {
        const { data: replicaChar } = await supabase
          .from("characters")
          .select("*")
          .eq("replica_of", other.id)
          .eq("is_replica", true)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        const otherName = otherProfile?.display_name || otherProfile?.username || "Friend"
        if (replicaChar?.system_prompt) {
          systemPrompt = `${replicaChar.system_prompt}\nYou are replying as ${otherName}'s Digital Replica while ${otherName} is offline. Keep it natural and concise.`
        } else {
          const pastSamples = recentMessages
            .filter(m => m.sender_id === other.id && !m.content?.startsWith("[image]:"))
            .slice(-15)
            .map(m => m.content)
            .join("\n")

          if (!pastSamples) {
            setReplicaTyping(false)
            return
          }
          systemPrompt = `You are the Digital Twin Replica of ${otherName}, who is currently offline. Match their tone, slang, and message length based on their past messages:\n${pastSamples}\nKeep replies under 50 words.`
        }
        personaBadge = `🪞 ${otherName}'s AI Replica`
      }

      const formattedHistory = recentMessages.slice(-10).map(m => ({
        role: m.sender_id === session.user.id ? "user" : "assistant",
        content: String(m.content || "").replace(/^\[replica:.*?\]:\s*/i, ""),
      }))

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...formattedHistory, { role: "user", content: userMessageText }],
          systemPrompt,
          userId: session.user.id,
          chatId: `dm_${activeConvo.id}`,
        }),
      })
      const data = await res.json()
      if (data.reply) {
        const taggedContent = `[replica:${personaBadge}]: ${data.reply}`
        const { data: inserted } = await supabase
          .from("direct_messages")
          .insert({
            conversation_id: activeConvo.id,
            sender_id: session.user.id,
            content: taggedContent,
          })
          .select()
          .single()

        if (inserted) {
          mergeMessages([inserted])
          channelRef.current?.send({
            type: "broadcast",
            event: "dm-insert",
            payload: inserted,
          })
        }
      }
    } catch (err) {
      console.warn("Smart DM response error:", err)
    } finally {
      setReplicaTyping(false)
    }
  }

  async function sendDirectMessage() {
    if (!input.trim() || !activeConvo || !session) return
    const msgContent = input.trim()
    setInput("")
    const historySnapshot = [...directMessages]

    // 1. Instant Optimistic UI insertion so message appears immediately
    const tempId = `temp-${Date.now()}`
    const optimisticMsg = {
      id: tempId,
      conversation_id: activeConvo.id,
      sender_id: session.user.id,
      content: msgContent,
      created_at: new Date().toISOString(),
    }
    setDirectMessages(prev => [...prev, optimisticMsg])

    // 2. Persist to Supabase and broadcast over WebSocket
    const { data: inserted, error } = await supabase
      .from("direct_messages")
      .insert({
        conversation_id: activeConvo.id,
        sender_id: session.user.id,
        content: msgContent,
      })
      .select()
      .single()

    if (inserted && !error) {
      setDirectMessages(prev =>
        prev.map(m => (m.id === tempId ? inserted : m))
      )
      channelRef.current?.send({
        type: "broadcast",
        event: "dm-insert",
        payload: inserted,
      })
    }

    await triggerSmartDMResponse(msgContent, historySnapshot)
  }

  async function generateCatchUpDigest() {
    if (directMessages.length === 0 || summarizingDigest) return
    setSummarizingDigest(true)
    setShowMobileMenu(false)
    try {
      const recentTranscript = directMessages
        .slice(-25)
        .map(m => {
          const speaker = m.sender_id === session.user.id ? "Me" : (otherProfile?.display_name || otherProfile?.username || "Friend")
          return `${speaker}: ${m.content}`
        })
        .join("\n")

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Summarize this recent conversation into 3 short, actionable bullet points covering: (1) Main topics discussed, (2) Any questions or plans pending, and (3) Overall vibe.\n\nTranscript:\n${recentTranscript}`,
            },
          ],
          systemPrompt: "You are a concise catch-up assistant. Output 3 brief bullet points only.",
          userId: session.user.id,
        }),
      })
      const data = await res.json()
      if (data.reply) {
        setCatchUpSummary(data.reply)
      }
    } catch (err) {
      console.error("Failed to generate catch-up digest:", err)
    } finally {
      setSummarizingDigest(false)
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !activeConvo || !session) return
    setUploadingImage(true)
    try {
      const ext = file.name.split(".").pop()
      const fileName = `${session.user.id}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from("chat-images").upload(fileName, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from("chat-images").getPublicUrl(fileName)
      const { data: inserted } = await supabase
        .from("direct_messages")
        .insert({
          conversation_id: activeConvo.id,
          sender_id: session.user.id,
          content: `[image]:${publicUrl}`,
        })
        .select()
        .single()
      if (inserted) {
        mergeMessages([inserted])
        channelRef.current?.send({
          type: "broadcast",
          event: "dm-insert",
          payload: inserted,
        })
      }
    } catch (err) {
      alert("Failed to upload image")
      console.error(err)
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleDeleteMessage(id: string) {
    if (!id) return
    setDirectMessages(prev => prev.filter(m => m.id !== id))
    if (!String(id).startsWith("temp-")) {
      await supabase.from("direct_messages").delete().eq("id", id)
      channelRef.current?.send({
        type: "broadcast",
        event: "dm-delete",
        payload: { id },
      })
    }
  }

  async function handleClearHistory() {
    setShowMobileMenu(false)
    if (directMessages.length === 0) return
    if (window.confirm("Clear all messages in this direct conversation?")) {
      await supabase.from("direct_messages").delete().eq("conversation_id", activeConvo.id)
      setDirectMessages([])
    }
  }

  function handleCopy(content: string, id: string) {
    const text = content
      .replace(/^\[image\]:/i, "")
      .replace(/^\[replica:.*?\]:\s*/i, "")
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  function handleSpeakToggle(content: string, id: string) {
    if (speakingMsgId === id) {
      stopSpeakingText()
      setSpeakingMsgId(null)
      return
    }
    const clean = content.replace(/^\[replica:.*?\]:\s*/i, "")
    setSpeakingMsgId(id)
    speakMessageText(clean, () => setSpeakingMsgId(null))
  }

  async function createReplica() {
    setShowMobileMenu(false)
    if (!session || !other) return
    setCreating(true)
    const { data: msgs } = await supabase
      .from("direct_messages")
      .select("content")
      .eq("conversation_id", activeConvo.id)
      .eq("sender_id", other.id)
      .order("created_at", { ascending: true })
      .limit(200)

    if (!msgs || msgs.length < 5) {
      alert(`${other.username || "This user"} needs to send at least 5 messages first!`)
      setCreating(false)
      return
    }

    const sampleMessages = msgs.map((m: any) => m.content).join("\n")
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: `Analyze the writing style, personality, tone, vocabulary, and communication patterns from these messages. Write a system prompt (max 200 words) for an AI to perfectly impersonate this person.\n\nMessages:\n${sampleMessages}` }],
        systemPrompt: "You are an expert at analyzing writing styles. Return only the system prompt text, nothing else.",
        userId: session.user.id,
        chatId: `convo_${activeConvo.id}`,
      }),
    })
    const data = await res.json()
    const system_prompt = `${data.reply} Never break character. Match the original person's typical message length and style exactly.`

    await supabase.from("characters")
      .delete()
      .eq("replica_of", other.id)
      .eq("created_by", session.user.id)

    const { data: char, error } = await supabase.from("characters")
      .insert({
        name: `${other.display_name || other.username}'s Replica`,
        emoji: "🪞",
        system_prompt,
        created_by: session.user.id,
        is_replica: true,
        replica_of: other.id,
        is_public: false,
      })
      .select().single()

    if (!error && char) onReplicaCreated(char)
    setCreating(false)
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      flex: 1,
      overflow: "hidden",
      height: "100%",
      width: "100%",
      fontFamily: T.font,
      position: "relative",
    }}>
      {/* ── Mobile-First Single-Row Header ─────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "max(10px, env(safe-area-inset-top, 10px)) 12px 10px",
        background: T.surface,
        borderBottom: `1px solid ${T.border}`,
        flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={onBack}
          title="Back to People list"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: T.bgAlt,
            border: `1px solid ${T.border}`,
            color: T.text,
            fontSize: 16,
            cursor: "pointer",
            width: 36,
            height: 36,
            borderRadius: 10,
            flexShrink: 0,
            fontFamily: T.font,
          }}
        >←</button>

        {/* Avatar with live status dot */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          {otherProfile?.avatar_url
            ? <img src={otherProfile.avatar_url} style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: `2px solid ${T.border}` }} />
            : <div style={{
                width: 38, height: 38, borderRadius: "50%",
                background: T.surface,
                border: `1px solid ${T.border}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
              }}>👤</div>
          }
          <div style={{
            position: "absolute", bottom: 0, right: 0,
            width: 10, height: 10, borderRadius: "50%",
            background: otherProfile?.is_online ? "#22c55e" : "#a855f7",
            border: `2px solid ${T.surface}`,
          }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {other?.display_name || other?.username || "Direct Chat"}
          </div>
          <div style={{ fontSize: 11, color: otherProfile?.is_online ? "#22c55e" : "#a855f7", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {otherProfile?.is_online
              ? "● Live Chat Active"
              : autoReplicaMode
              ? "🪞 Replica Auto-Reply ON"
              : "● Offline"}
          </div>
        </div>

        {/* Compact Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button
            type="button"
            disabled={creating}
            onClick={createReplica}
            style={{
              background: "rgba(168,85,247,0.12)",
              border: "1px solid rgba(168,85,247,0.4)",
              borderRadius: 8,
              color: "#c084fc",
              fontSize: 11,
              fontWeight: 600,
              cursor: creating ? "not-allowed" : "pointer",
              padding: "6px 10px",
              fontFamily: T.font,
              whiteSpace: "nowrap",
            }}
          >
            {creating ? "⏳…" : "🪞 Replica"}
          </button>

          <button
            type="button"
            onClick={() => setShowMobileMenu(prev => !prev)}
            title="More options"
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: showMobileMenu ? "hsla(119,99%,46%,0.15)" : T.bgAlt,
              border: `1px solid ${showMobileMenu ? T.primary : T.border}`,
              color: T.text,
              fontSize: 16,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ⋯
          </button>
        </div>
      </div>

      {/* ── Compact Dropdown Menu for Secondary DM Tools ─────────── */}
      {showMobileMenu && (
        <div style={{
          position: "absolute",
          top: 56,
          right: 12,
          zIndex: 50,
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: 6,
          boxShadow: "0 12px 32px rgba(0,0,0,0.65)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          minWidth: 210,
        }}>
          <button
            type="button"
            onClick={() => { setAutoReplicaMode(!autoReplicaMode); setShowMobileMenu(false) }}
            style={{
              padding: "9px 12px",
              background: "transparent",
              border: "none",
              borderRadius: 8,
              color: autoReplicaMode ? "#c084fc" : T.text,
              fontSize: 12,
              fontWeight: 600,
              textAlign: "left",
              cursor: "pointer",
              fontFamily: T.font,
            }}
          >
            🪞 {autoReplicaMode ? "Disable Offline Auto-Replica" : "Enable Offline Auto-Replica"}
          </button>

          <button
            type="button"
            onClick={generateCatchUpDigest}
            disabled={directMessages.length < 2 || summarizingDigest}
            style={{
              padding: "9px 12px",
              background: "transparent",
              border: "none",
              borderRadius: 8,
              color: T.primary,
              fontSize: 12,
              fontWeight: 600,
              textAlign: "left",
              cursor: "pointer",
              fontFamily: T.font,
              opacity: directMessages.length < 2 ? 0.5 : 1,
            }}
          >
            ☀️ {summarizingDigest ? "Summarizing…" : "Generate Catch-Up Digest"}
          </button>

          {directMessages.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              style={{
                padding: "9px 12px",
                background: "transparent",
                border: "none",
                borderRadius: 8,
                color: T.red,
                fontSize: 12,
                fontWeight: 600,
                textAlign: "left",
                cursor: "pointer",
                fontFamily: T.font,
              }}
            >
              🧹 Clear Chat History
            </button>
          )}
        </div>
      )}

      {/* ── Catch-Up Digest Banner ──────────────────────────────── */}
      {catchUpSummary && (
        <div style={{
          margin: "8px 12px 0",
          padding: "10px 14px",
          background: "rgba(168,85,247,0.1)",
          border: "1px solid rgba(168,85,247,0.35)",
          borderRadius: 12,
          fontSize: 12,
          color: T.text,
          lineHeight: 1.5,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontWeight: 700, color: "#c084fc", marginBottom: 3 }}>
              ☀️ Catch-Up Digest
            </div>
            <div style={{ whiteSpace: "pre-line", color: "#e5e7eb" }}>{catchUpSummary}</div>
          </div>
          <button
            type="button"
            onClick={() => setCatchUpSummary(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "#c084fc",
              cursor: "pointer",
              fontSize: 15,
              padding: "0 4px",
            }}
          >✕</button>
        </div>
      )}

      {/* ── Messages Area ──────────────────────────────────────── */}
      <div
        className="cc-messages"
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          background: T.bgAlt,
        }}
      >
        {directMessages.length === 0 && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            gap: 10,
            color: T.muted,
            fontSize: 13,
            textAlign: "center",
            padding: 24,
          }}>
            <div style={{ fontSize: 34 }}>💬</div>
            <div style={{ fontWeight: 600, color: T.text, fontSize: 15 }}>
              Chat with {other?.display_name || other?.username}
            </div>
            <p style={{ margin: 0, maxWidth: 300, lineHeight: 1.5 }}>
              Send a message below for live real-time chat, or tap <code>✦ @ai</code> to bring Kikar AI Co-Pilot into the conversation!
            </p>
          </div>
        )}

        {directMessages.map((m: any, i: number) => {
          const replicaMatch = typeof m.content === "string" ? m.content.match(/^\[replica:(.*?)\]:\s*([\s\S]*)$/i) : null
          const replicaBadge = replicaMatch ? replicaMatch[1] : m.is_replica_reply ? "🪞 AI Replica" : null
          const displayContent = replicaMatch ? replicaMatch[2] : m.content

          const isAiCoPilot = replicaBadge?.includes("Co-Pilot")
          const isUser = m.sender_id === session.user.id && !isAiCoPilot && !replicaBadge
          const isImage = displayContent?.startsWith("[image]:")
          const imageUrl = isImage ? displayContent.replace("[image]:", "") : null
          const showDate = i === 0 || formatDate(m.created_at) !== formatDate(directMessages[i - 1].created_at)
          const msgId = String(m.id ?? `dm-${i}`)
          const showActions = activeActionMsgId === msgId || speakingMsgId === msgId

          return (
            <div key={msgId}>
              {showDate && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  margin: "10px 0 6px",
                }}>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                  <div style={{
                    fontSize: 10,
                    color: T.muted2,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    padding: "2px 10px",
                    background: T.surface,
                    borderRadius: 999,
                    border: `1px solid ${T.border}`,
                  }}>{formatDate(m.created_at)}</div>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                </div>
              )}

              <div
                onClick={() => setActiveActionMsgId(prev => (prev === msgId ? null : msgId))}
                onMouseEnter={() => setActiveActionMsgId(msgId)}
                onMouseLeave={() => setActiveActionMsgId(null)}
                style={{
                  display: "flex",
                  flexDirection: isUser ? "row-reverse" : "row",
                  alignItems: "flex-end",
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isUser ? "flex-end" : "flex-start",
                  maxWidth: "80%",
                }}>
                  {replicaBadge && (
                    <div style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: isAiCoPilot ? T.primary : "#c084fc",
                      background: isAiCoPilot ? "hsla(119,99%,46%,0.12)" : "rgba(168,85,247,0.14)",
                      border: isAiCoPilot ? "1px solid hsla(119,99%,46%,0.3)" : "1px solid rgba(168,85,247,0.3)",
                      borderRadius: 999,
                      padding: "2px 8px",
                      marginBottom: 4,
                    }}>
                      {replicaBadge}
                    </div>
                  )}

                  <div
                    className="cc-bubble"
                    style={{
                      padding: isImage ? 4 : "10px 14px",
                      borderRadius: 14,
                      lineHeight: 1.5,
                      fontSize: 14,
                      wordBreak: "break-word",
                      borderBottomRightRadius: isUser ? 4 : 14,
                      borderBottomLeftRadius: isUser ? 14 : 4,
                      background: isImage
                        ? "transparent"
                        : isUser
                        ? "linear-gradient(135deg, hsl(119,99%,46%) 0%, hsl(119,99%,38%) 100%)"
                        : replicaBadge
                        ? "rgba(168,85,247,0.12)"
                        : T.surface,
                      color: isUser ? T.primaryFg : T.text,
                      border: isUser || isImage
                        ? "none"
                        : replicaBadge
                        ? "1px solid rgba(168,85,247,0.35)"
                        : `1px solid ${T.border}`,
                      fontWeight: isUser ? 500 : 400,
                    }}
                  >
                    {isImage
                      ? <img src={imageUrl!}
                          alt="Attachment"
                          style={{ maxWidth: 230, maxHeight: 260, borderRadius: 10, display: "block", cursor: "pointer" }}
                          onClick={(e) => { e.stopPropagation(); window.open(imageUrl!, "_blank") }} />
                      : displayContent}
                  </div>

                  {/* Timestamp + read receipt */}
                  <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 2, padding: "0 2px" }}>
                    <span style={{ fontSize: 10, color: T.muted2 }}>
                      {m.created_at ? formatTime(m.created_at) : ""}
                    </span>
                    {isUser && (
                      <span style={{
                        fontSize: 10,
                        color: m.read_at ? T.primary : T.muted2,
                        fontWeight: 600,
                      }}>
                        {String(m.id).startsWith("temp-") ? "⋯" : m.read_at ? "✓✓" : "✓"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Touch & Hover Action Buttons */}
                {showActions && (
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      marginBottom: 16,
                    }}
                  >
                    {!isImage && (
                      <button
                        type="button"
                        title="Play audio"
                        onClick={() => handleSpeakToggle(displayContent, msgId)}
                        style={{
                          background: speakingMsgId === msgId ? "hsla(119,99%,46%,0.2)" : T.surface,
                          border: `1px solid ${speakingMsgId === msgId ? T.primary : T.border}`,
                          borderRadius: 6,
                          color: speakingMsgId === msgId ? T.primary : T.muted,
                          fontSize: 11,
                          cursor: "pointer",
                          padding: "4px 6px",
                        }}
                      >
                        {speakingMsgId === msgId ? "⏹️" : "🔊"}
                      </button>
                    )}

                    <button
                      type="button"
                      title="Copy message"
                      onClick={() => handleCopy(m.content, msgId)}
                      style={{
                        background: T.surface,
                        border: `1px solid ${T.border}`,
                        borderRadius: 6,
                        color: copiedId === msgId ? T.primary : T.muted,
                        fontSize: 11,
                        cursor: "pointer",
                        padding: "4px 6px",
                      }}
                    >
                      {copiedId === msgId ? "✓" : "📋"}
                    </button>

                    {m.sender_id === session.user.id && (
                      <button
                        type="button"
                        title="Delete message"
                        onClick={() => handleDeleteMessage(m.id)}
                        style={{
                          background: T.surface,
                          border: `1px solid ${T.border}`,
                          borderRadius: 6,
                          color: T.red,
                          fontSize: 11,
                          cursor: "pointer",
                          padding: "4px 6px",
                        }}
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {replicaTyping && (
          <div style={{
            fontSize: 11,
            color: "#c084fc",
            padding: "6px 12px",
            background: "rgba(168,85,247,0.1)",
            border: "1px solid rgba(168,85,247,0.25)",
            borderRadius: 999,
            alignSelf: "flex-start",
          }}>
            🪞 AI is replying…
          </div>
        )}

        <div ref={bottomRef} style={{ height: 4 }} />
      </div>

      {/* ── Mobile-Optimized Input Bar ─────────────────────────── */}
      <div style={{
        display: "flex",
        gap: 6,
        padding: "8px 10px",
        background: T.surface,
        borderTop: `1px solid ${T.border}`,
        flexShrink: 0,
        paddingBottom: "max(10px, env(safe-area-inset-bottom))",
        alignItems: "center",
      }}>
        <input type="file" accept="image/*" style={{ display: "none" }}
          ref={fileInputRef} onChange={handleImageUpload} />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingImage}
          title="Upload image"
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: T.bgAlt,
            border: `1px solid ${T.border}`,
            fontSize: 16,
            cursor: uploadingImage ? "not-allowed" : "pointer",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >{uploadingImage ? "⏳" : "🖼️"}</button>

        <button
          type="button"
          onClick={() => {
            if (!input.startsWith("@ai ")) setInput(`@ai ${input}`)
          }}
          title="Summon Kikar AI Co-Pilot"
          style={{
            padding: "0 9px",
            height: 36,
            borderRadius: 999,
            background: input.startsWith("@ai") ? "hsla(119,99%,46%,0.18)" : T.bgAlt,
            border: input.startsWith("@ai") ? `1px solid ${T.primary}` : `1px solid ${T.border}`,
            color: input.startsWith("@ai") ? T.primary : T.muted,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: T.font,
            flexShrink: 0,
          }}
        >
          @ai
        </button>

        <input
          className="cc-chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendDirectMessage()}
          placeholder="Message (or @ai)…"
          style={{
            flex: 1,
            minWidth: 0,
            padding: "10px 14px",
            background: T.bgAlt,
            border: `1px solid ${T.border}`,
            borderRadius: 999,
            color: T.text,
            outline: "none",
            fontSize: 16,
            fontFamily: T.font,
          }}
        />

        <button
          type="button"
          onClick={sendDirectMessage}
          disabled={!input.trim()}
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: !input.trim()
              ? T.surface
              : "linear-gradient(135deg, hsl(119,99%,46%), hsl(119,99%,38%))",
            border: `1px solid ${!input.trim() ? T.border : "transparent"}`,
            fontSize: 16,
            cursor: !input.trim() ? "not-allowed" : "pointer",
            color: !input.trim() ? T.muted : T.primaryFg,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >↑</button>
      </div>
    </div>
  )
}