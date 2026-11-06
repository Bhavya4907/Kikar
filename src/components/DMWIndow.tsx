"use client"
import { useEffect, useRef, useState } from "react"
import { supabase } from "../lib/supabase"
import { T } from "../styles"
import { formatTime, formatDate, showNotification } from "../lib/helpers"

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
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const other = activeConvo.user1_id === session.user.id
    ? activeConvo.user2
    : activeConvo.user1
  const otherProfile = allProfiles.find((p: any) => p.id === other?.id)

  useEffect(() => {
    if (!activeConvo) return
    supabase.from("direct_messages").select("*")
      .eq("conversation_id", activeConvo.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => setDirectMessages(data || []))

    // Mark messages as read
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
  }, [directMessages])

  async function sendDirectMessage() {
    if (!input.trim() || !activeConvo || !session) return
    const msgContent = input.trim()
    setInput("")
    await supabase.from("direct_messages").insert({
      conversation_id: activeConvo.id,
      sender_id: session.user.id,
      content: msgContent
    })
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !activeConvo || !session) return
    setUploadingImage(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `${session.user.id}-${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('chat-images').upload(fileName, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(fileName)
      await supabase.from("direct_messages").insert({
        conversation_id: activeConvo.id,
        sender_id: session.user.id,
        content: `[image]:${publicUrl}`
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
    const text = content.startsWith("[image]:") ? content.replace("[image]:", "") : content
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
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
        chatId: `convo_${activeConvo.id}`,
      })
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
        is_public: false
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
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20
              }}>👤</div>
          }
          <div style={{
            position: "absolute", bottom: 1, right: 1,
            width: 11, height: 11, borderRadius: "50%",
            background: otherProfile?.is_online ? "#22c55e" : "#3a3a3a",
            border: `2px solid ${T.surface}`,
            boxShadow: otherProfile?.is_online ? "0 0 6px rgba(34,197,94,0.5)" : "none",
          }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {other?.display_name || other?.username || "Direct Chat"}
          </div>
          <div style={{ fontSize: 11, color: otherProfile?.is_online ? "#22c55e" : T.muted, marginTop: 2 }}>
            {otherProfile?.is_online ? "● Online" : "● Offline"}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                padding: "7px 10px",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontFamily: T.font,
                transition: "all 0.15s",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget
                el.style.background = "rgba(248,113,113,0.15)"
                el.style.borderColor = "rgba(248,113,113,0.3)"
                el.style.color = T.red
              }}
              onMouseLeave={e => {
                const el = e.currentTarget
                el.style.background = "rgba(255,255,255,0.05)"
                el.style.borderColor = T.border
                el.style.color = T.muted
              }}
            >
              <span>🧹</span>
            </button>
          )}

          {/* Replica button */}
          <button
            disabled={creating}
            onClick={createReplica}
            title="Create a replica bot based on this person's chat style"
            style={{
              background: "transparent",
              border: "1px solid rgba(168,85,247,0.4)",
              borderRadius: 8,
              color: "#a855f7",
              fontSize: 12,
              fontWeight: 600,
              cursor: creating ? "not-allowed" : "pointer",
              padding: "7px 12px",
              flexShrink: 0,
              opacity: creating ? 0.5 : 1,
              fontFamily: T.font,
              transition: "background 0.15s, border-color 0.15s",
              letterSpacing: "0.01em",
            }}
            onMouseEnter={e => {
              if (!creating) {
                const el = e.currentTarget
                el.style.background = "rgba(168,85,247,0.12)"
                el.style.borderColor = "rgba(168,85,247,0.6)"
              }
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              el.style.background = "transparent"
              el.style.borderColor = "rgba(168,85,247,0.4)"
            }}
          >
            {creating ? "⏳ Creating…" : "🪞 Replica"}
          </button>
        </div>
      </div>

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
            <p style={{ margin: 0, maxWidth: 300, lineHeight: 1.6 }}>
              Send a direct message below. Once you exchange 5+ messages, you can generate an AI persona replica!
            </p>
          </div>
        )}

        {directMessages.map((m: any, i: number) => {
          const isUser = m.sender_id === session.user.id
          const isImage = m.content?.startsWith("[image]:")
          const imageUrl = isImage ? m.content.replace("[image]:", "") : null
          const showDate = i === 0 || formatDate(m.created_at) !== formatDate(directMessages[i - 1].created_at)
          const msgId = m.id ?? `dm-${i}`
          const isHovered = hoveredMsgId === msgId

          return (
            <div key={msgId}>
              {/* Date separator */}
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
                  maxWidth: "70%",
                }}>
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
                        : T.surface,
                      color: isUser ? T.primaryFg : T.text,
                      border: isUser || isImage ? "none" : `1px solid ${T.border}`,
                      boxShadow: isUser ? "0 2px 12px hsla(119,99%,46%,0.2)" : "none",
                      fontWeight: isUser ? 500 : 400,
                      animation: "fade-in 0.2s ease both",
                    }}
                  >
                    {isImage
                      ? <img src={imageUrl!}
                          alt="Attachment"
                          style={{ maxWidth: 240, maxHeight: 280, borderRadius: 10, display: "block", cursor: "pointer" }}
                          onClick={() => window.open(imageUrl!, '_blank')} />
                      : m.content}
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

                {/* Message Hover Actions */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  opacity: isHovered ? 1 : 0,
                  transition: "opacity 0.15s ease",
                  marginBottom: 16,
                  pointerEvents: isHovered ? "auto" : "none",
                }}>
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
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    {copiedId === msgId ? "✓" : "📋"}
                  </button>

                  {isUser && (
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
                        display: "flex",
                        alignItems: "center",
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = T.red}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = T.muted2}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
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
            transition: "border-color 0.15s",
          }}
        >{uploadingImage ? "⏳" : "🖼️"}</button>

        <input
          className="cc-chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendDirectMessage()}
          placeholder="Type a message…"
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
            transition: "border-color 0.18s, box-shadow 0.18s",
          }}
          onFocus={e => {
            e.target.style.borderColor = "hsla(119,99%,46%,0.4)"
            e.target.style.boxShadow = "0 0 0 3px hsla(119,99%,46%,0.07)"
          }}
          onBlur={e => {
            e.target.style.borderColor = T.border
            e.target.style.boxShadow = "none"
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
            transition: "all 0.18s",
            boxShadow: !input.trim() ? "none" : "0 2px 12px hsla(119,99%,46%,0.3)",
          }}
        >↑</button>
      </div>
    </div>
  )
}