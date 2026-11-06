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
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null)
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null)
  const [autoReplicaMode, setAutoReplicaMode] = useState(true)
  const [replicaTyping, setReplicaTyping] = useState(false)
  const [catchUpSummary, setCatchUpSummary] = useState<string | null>(null)
  const [summarizingDigest, setSummarizingDigest] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const other = activeConvo.user1_id === session.user.id
    ? activeConvo.user2
    : activeConvo.user1
  const otherProfile = allProfiles.find((p: any) => p.id === other?.id) || other

  useEffect(() => {
    if (!activeConvo) return
    setCatchUpSummary(null)
    supabase.from("direct_messages").select("*")
      .eq("conversation_id", activeConvo.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => setDirectMessages(data || []))

    supabase.from("direct_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", activeConvo.id)
      .neq("sender_id", session.user.id)
      .is("read_at", null)
      .then(() => {})

    const ch = supabase
      .channel(`convo-${activeConvo.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" },
        (p) => {
          if (p.new.conversation_id === activeConvo.id) {
            setDirectMessages(prev => {
              if (prev.some(m => m.id === p.new.id)) return prev
              return [...prev, p.new]
            })
            if (p.new.sender_id !== session.user.id) {
              const name = otherProfile?.display_name || otherProfile?.username || "Someone"
              const isImage = p.new.content?.startsWith("[image]:")
              showNotification(name, isImage ? "📷 Sent an image" : p.new.content)
            }
          }
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "direct_messages" },
        (p) => {
          setDirectMessages(prev => prev.filter(m => m.id !== p.old.id))
        })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [activeConvo])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [directMessages, replicaTyping])

  /**
   * Triggers either:
   * 1. Multiplayer @ai Co-Pilot response inside the DM thread if user typed `@ai ...`, OR
   * 2. Automatic Offline Digital Replica reply when the recipient is offline (`!otherProfile?.is_online`).
   */
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
        // Look up the offline user's replica character
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
          // Build an on-the-fly style prompt from the offline user's past messages in this thread
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
            sender_id: isAiSummon ? session.user.id : other.id,
            content: taggedContent,
          })
          .select()
          .single()

        if (inserted) {
          setDirectMessages(prev => (prev.some(m => m.id === inserted.id) ? prev : [...prev, inserted]))
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

    const { data: inserted } = await supabase
      .from("direct_messages")
      .insert({
        conversation_id: activeConvo.id,
        sender_id: session.user.id,
        content: msgContent,
      })
      .select()
      .single()

    if (inserted) {
      setDirectMessages(prev => (prev.some(m => m.id === inserted.id) ? prev : [...prev, inserted]))
    }

    await triggerSmartDMResponse(msgContent, historySnapshot)
  }

  /**
   * Generates a 3-bullet "Morning Catch-Up Digest" summarizing recent DM & Replica activity.
   */
  async function generateCatchUpDigest() {
    if (directMessages.length === 0 || summarizingDigest) return
    setSummarizingDigest(true)
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
              content: `Summarize this recent conversation (including any AI Replica replies) into 3 short, actionable bullet points covering: (1) Main topics discussed, (2) Any questions or plans pending, and (3) Overall vibe.\n\nTranscript:\n${recentTranscript}`,
            },
          ],
          systemPrompt: "You are a concise executive catch-up assistant. Output 3 brief bullet points only.",
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
      await supabase.from("direct_messages").insert({
        conversation_id: activeConvo.id,
        sender_id: session.user.id,
        content: `[image]:${publicUrl}`,
      })
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
    await supabase.from("direct_messages").delete().eq("id", id)
    setDirectMessages(prev => prev.filter(m => m.id !== id))
  }

  async function handleClearHistory() {
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
      alert(`${other.username} needs to send at least 5 messages first!`)
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
      fontFamily: T.font,
    }}>
      {/* ── Header ─────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        background: T.surface,
        borderBottom: `1px solid ${T.border}`,
        flexShrink: 0,
        flexWrap: "wrap",
      }}>
        <button
          className="cc-back-btn"
          onClick={onBack}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: T.bgAlt,
            border: `1px solid ${T.border}`,
            color: T.text,
            fontSize: 16,
            cursor: "pointer",
            width: 34,
            height: 34,
            borderRadius: 8,
            flexShrink: 0,
            lineHeight: 1,
            fontFamily: T.font,
          }}
        >←</button>

        {/* Avatar with online dot */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          {otherProfile?.avatar_url
            ? <img src={otherProfile.avatar_url} style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover", border: `2px solid ${T.border}` }} />
            : <div style={{
                width: 42, height: 42, borderRadius: "50%",
                background: T.surface,
                border: `1px solid ${T.border}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20,
              }}>👤</div>
          }
          <div style={{
            position: "absolute", bottom: 1, right: 1,
            width: 11, height: 11, borderRadius: "50%",
            background: otherProfile?.is_online ? "#22c55e" : "#a855f7",
            border: `2px solid ${T.surface}`,
            boxShadow: otherProfile?.is_online ? "0 0 6px rgba(34,197,94,0.5)" : "0 0 6px rgba(168,85,247,0.5)",
          }} />
        </div>

        <div style={{ flex: 1, minWidth: 140 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {other?.display_name || other?.username || "Direct Chat"}
          </div>
          <div style={{ fontSize: 11, color: otherProfile?.is_online ? "#22c55e" : "#a855f7", marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
            <span>{otherProfile?.is_online ? "● Live Human Online" : "🪞 Offline · AI Replica Standby"}</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {/* Offline Replica Auto-Responder Toggle */}
          {!otherProfile?.is_online && (
            <button
              type="button"
              onClick={() => setAutoReplicaMode(!autoReplicaMode)}
              title="Toggle automatic replies from this user's AI Replica while they are offline"
              style={{
                background: autoReplicaMode ? "rgba(168,85,247,0.15)" : "rgba(255,255,255,0.05)",
                border: autoReplicaMode ? "1px solid rgba(168,85,247,0.45)" : `1px solid ${T.border}`,
                borderRadius: 8,
                color: autoReplicaMode ? "#c084fc" : T.muted,
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                padding: "6px 10px",
                fontFamily: T.font,
              }}
            >
              {autoReplicaMode ? "🪞 Auto-Replica: ON" : "🪞 Auto-Replica: OFF"}
            </button>
          )}

          {/* Morning Catch-Up Digest button */}
          {directMessages.length >= 3 && (
            <button
              type="button"
              onClick={generateCatchUpDigest}
              disabled={summarizingDigest}
              title="Generate a 3-bullet Catch-Up Digest of this conversation"
              style={{
                background: "hsla(119,99%,46%,0.1)",
                border: "1px solid hsla(119,99%,46%,0.35)",
                borderRadius: 8,
                color: T.primary,
                fontSize: 11,
                fontWeight: 600,
                cursor: summarizingDigest ? "wait" : "pointer",
                padding: "6px 10px",
                fontFamily: T.font,
              }}
            >
              {summarizingDigest ? "⏳ Summarizing…" : "☀️ Catch-Up Digest"}
            </button>
          )}

          {/* Clear history button */}
          {directMessages.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              title="Clear message history"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                color: T.muted,
                fontSize: 12,
                cursor: "pointer",
                padding: "6px 9px",
                fontFamily: T.font,
              }}
            >
              🧹
            </button>
          )}

          {/* Clone Replica button */}
          <button
            disabled={creating}
            onClick={createReplica}
            title="Create a standalone replica bot based on this person's chat style"
            style={{
              background: "transparent",
              border: "1px solid rgba(168,85,247,0.4)",
              borderRadius: 8,
              color: "#a855f7",
              fontSize: 11,
              fontWeight: 600,
              cursor: creating ? "not-allowed" : "pointer",
              padding: "6px 10px",
              flexShrink: 0,
              opacity: creating ? 0.5 : 1,
              fontFamily: T.font,
            }}
          >
            {creating ? "⏳ Cloning…" : "🪞 Clone Bot"}
          </button>
        </div>
      </div>

      {/* ── Creative Feature: Morning Catch-Up Digest Banner ──────── */}
      {catchUpSummary && (
        <div style={{
          margin: "10px 16px 0",
          padding: "12px 16px",
          background: "rgba(168,85,247,0.1)",
          border: "1px solid rgba(168,85,247,0.35)",
          borderRadius: 12,
          fontSize: 12,
          color: T.text,
          lineHeight: 1.55,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}>
          <div>
            <div style={{ fontWeight: 700, color: "#c084fc", marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
              <span>☀️</span> Conversation &amp; Offline Replica Catch-Up Digest
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

      {/* ── Messages ───────────────────────────────────────────── */}
      <div
        className="cc-messages"
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: 16,
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
            gap: 12,
            color: T.muted,
            fontSize: 13,
            textAlign: "center",
            padding: 32,
          }}>
            <div style={{ fontSize: 36 }}>💬</div>
            <div style={{ fontWeight: 600, color: T.text, fontSize: 15 }}>
              Start a conversation with {other?.display_name || other?.username}
            </div>
            <p style={{ margin: 0, maxWidth: 340, lineHeight: 1.6 }}>
              Send a direct message below. If they are offline, their <strong>🪞 AI Replica</strong> can reply automatically—or type <code>@ai</code> to summon Kikar AI Co-Pilot into your chat!
            </p>
          </div>
        )}

        {directMessages.map((m: any, i: number) => {
          const replicaMatch = typeof m.content === "string" ? m.content.match(/^\[replica:(.*?)\]:\s*([\s\S]*)$/i) : null
          const replicaBadge = replicaMatch ? replicaMatch[1] : m.is_replica_reply ? "🪞 AI Replica" : null
          const displayContent = replicaMatch ? replicaMatch[2] : m.content

          const isAiCoPilot = replicaBadge?.includes("Co-Pilot")
          const isUser = m.sender_id === session.user.id && !isAiCoPilot
          const isImage = displayContent?.startsWith("[image]:")
          const imageUrl = isImage ? displayContent.replace("[image]:", "") : null
          const showDate = i === 0 || formatDate(m.created_at) !== formatDate(directMessages[i - 1].created_at)
          const msgId = m.id ?? `dm-${i}`
          const isHovered = hoveredMsgId === msgId

          return (
            <div key={msgId}>
              {showDate && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  margin: "12px 0 8px",
                }}>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                  <div style={{
                    fontSize: 10,
                    color: T.muted2,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    padding: "3px 10px",
                    background: T.surface,
                    borderRadius: 999,
                    border: `1px solid ${T.border}`,
                  }}>{formatDate(m.created_at)}</div>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                </div>
              )}

              <div
                onMouseEnter={() => setHoveredMsgId(msgId)}
                onMouseLeave={() => setHoveredMsgId(null)}
                style={{
                  display: "flex",
                  flexDirection: isUser ? "row-reverse" : "row",
                  alignItems: "flex-end",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isUser ? "flex-end" : "flex-start",
                  maxWidth: "72%",
                }}>
                  {/* AI Replica / Co-Pilot Transparency Badge */}
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
                      lineHeight: 1.55,
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
                      boxShadow: isUser ? "0 2px 12px hsla(119,99%,46%,0.2)" : "none",
                      fontWeight: isUser ? 500 : 400,
                      animation: "fade-in 0.2s ease both",
                    }}
                  >
                    {isImage
                      ? <img src={imageUrl!}
                          alt="Attachment"
                          style={{ maxWidth: 240, maxHeight: 280, borderRadius: 10, display: "block", cursor: "pointer" }}
                          onClick={() => window.open(imageUrl!, "_blank")} />
                      : displayContent}
                  </div>

                  {/* Timestamp + read receipt */}
                  <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 3, padding: "0 2px" }}>
                    <span style={{ fontSize: 10, color: T.muted2 }}>
                      {m.created_at ? formatTime(m.created_at) : ""}
                    </span>
                    {isUser && (
                      <span style={{
                        fontSize: 10,
                        color: m.read_at ? T.primary : T.muted2,
                        fontWeight: 600,
                      }}>
                        {m.read_at ? "✓✓" : "✓"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Message Hover Actions (Voice Note TTS + Copy + Delete) */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  opacity: isHovered || speakingMsgId === msgId ? 1 : 0,
                  transition: "opacity 0.15s ease",
                  marginBottom: 16,
                  pointerEvents: isHovered || speakingMsgId === msgId ? "auto" : "none",
                }}>
                  {!isImage && (
                    <button
                      type="button"
                      title={speakingMsgId === msgId ? "Stop voice playback" : "Play message aloud"}
                      onClick={() => handleSpeakToggle(displayContent, msgId)}
                      style={{
                        background: speakingMsgId === msgId ? "hsla(119,99%,46%,0.2)" : "rgba(255,255,255,0.06)",
                        border: `1px solid ${speakingMsgId === msgId ? T.primary : T.border}`,
                        borderRadius: 6,
                        color: speakingMsgId === msgId ? T.primary : T.muted,
                        fontSize: 11,
                        cursor: "pointer",
                        padding: "3px 6px",
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
                      background: "rgba(255,255,255,0.06)",
                      border: `1px solid ${T.border}`,
                      borderRadius: 6,
                      color: copiedId === msgId ? T.primary : T.muted,
                      fontSize: 11,
                      cursor: "pointer",
                      padding: "3px 6px",
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
                        background: "rgba(255,255,255,0.06)",
                        border: `1px solid ${T.border}`,
                        borderRadius: 6,
                        color: T.muted2,
                        fontSize: 11,
                        cursor: "pointer",
                        padding: "3px 6px",
                      }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
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
            🪞 AI Persona is typing a reply…
          </div>
        )}

        <div ref={bottomRef} style={{ height: 4 }} />
      </div>

      {/* ── Input Bar ──────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        gap: 8,
        padding: "10px 14px",
        background: T.surface,
        borderTop: `1px solid ${T.border}`,
        flexShrink: 0,
        paddingBottom: "max(10px,env(safe-area-inset-bottom))",
        alignItems: "center",
      }}>
        <input type="file" accept="image/*" style={{ display: "none" }}
          ref={fileInputRef} onChange={handleImageUpload} />

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingImage}
          title="Upload image"
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: T.bgAlt,
            border: `1px solid ${T.border}`,
            fontSize: 17,
            cursor: uploadingImage ? "not-allowed" : "pointer",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: uploadingImage ? 0.5 : 1,
          }}
        >{uploadingImage ? "⏳" : "🖼️"}</button>

        {/* Quick @ai Co-Pilot trigger chip */}
        <button
          type="button"
          onClick={() => {
            if (!input.startsWith("@ai ")) setInput(`@ai ${input}`)
          }}
          title="Summon Kikar AI Co-Pilot into this DM conversation"
          style={{
            padding: "0 11px",
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
          ✦ @ai
        </button>

        <input
          className="cc-chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendDirectMessage()}
          placeholder={
            !otherProfile?.is_online && autoReplicaMode
              ? `Message ${other?.display_name || other?.username}'s AI Replica (or type @ai)…`
              : "Type a message (or @ai to summon AI Co-Pilot)…"
          }
          style={{
            flex: 1,
            padding: "11px 16px",
            background: T.bgAlt,
            border: `1px solid ${T.border}`,
            borderRadius: 999,
            color: T.text,
            outline: "none",
            fontSize: 14,
            fontFamily: T.font,
          }}
        />

        <button
          onClick={sendDirectMessage}
          disabled={!input.trim()}
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: !input.trim()
              ? T.surface
              : "linear-gradient(135deg, hsl(119,99%,46%), hsl(119,99%,38%))",
            border: `1px solid ${!input.trim() ? T.border : "transparent"}`,
            fontSize: 17,
            cursor: !input.trim() ? "not-allowed" : "pointer",
            color: !input.trim() ? T.muted : T.primaryFg,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: !input.trim() ? "none" : "0 2px 12px hsla(119,99%,46%,0.3)",
          }}
        >↑</button>
      </div>
    </div>
  )
}