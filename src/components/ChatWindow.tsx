"use client"
import { useEffect, useRef, useState } from "react"
import { supabase } from "../lib/supabase"
import { T } from "../styles"
import { showNotification } from "../lib/helpers"

interface Props {
  session: any
  activeChar: any
  messages: any[]
  setMessages: (msgs: any) => void
  onBack: () => void
  creating: boolean
  setCreating: (v: boolean) => void
  onDeleteCharacter?: (id: string) => void
  onEditChar?: (char: any) => void
}

export default function ChatWindow({
  session, activeChar, messages, setMessages, onBack, creating, setCreating, onDeleteCharacter, onEditChar
}: Props) {
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [generatingImg, setGeneratingImg] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null)
  const [recalledMemories, setRecalledMemories] = useState<string[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  async function sendMessage() {
    if (!input.trim() || !activeChar || loading || !session) return
    const userMsg = { role: "user", content: input, character_id: activeChar.id, user_id: session.user.id }
    setMessages((prev: any) => [...prev, { ...userMsg, id: `temp-${Date.now()}` }])
    setInput(""); setLoading(true)

    try {
      const { data: insertedUserMsg } = await supabase.from("messages").insert(userMsg).select().single()
      const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
      
      const res = await fetch("/api/chat", {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          systemPrompt: activeChar.system_prompt,
          chatId: `${session.user.id}_${activeChar.id}`,
        })
      })
      const data = await res.json()
      
      if (Array.isArray(data.memoriesRecalled) && data.memoriesRecalled.length > 0) {
        setRecalledMemories(data.memoriesRecalled)
      }
      
      const aiReply = data.reply || "Sorry, I couldn't generate a response."
      const aiMsg = { role: "assistant", content: aiReply, character_id: activeChar.id, user_id: session.user.id }
      const { data: insertedAiMsg } = await supabase.from("messages").insert(aiMsg).select().single()
      
      setMessages((prev: any) => [
        ...prev.filter((m: any) => !m.id?.startsWith("temp-")),
        insertedUserMsg || userMsg,
        insertedAiMsg || aiMsg
      ])
      showNotification(activeChar.name, aiReply)
    } catch (err) {
      console.error("sendMessage error:", err)
      setMessages((prev: any) => prev.filter((m: any) => !m.id?.startsWith("temp-")))
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateImage() {
    if (!input.trim() || !activeChar || !session) return
    setGeneratingImg(true)
    const promptText = input
    setInput("")
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText }),
      })
      if (!res.ok) throw new Error(`Status: ${res.status}`)
      const data = await res.json()
      if (data.url) {
        const msg = { role: "assistant", content: `[image]:${data.url}`, character_id: activeChar.id, user_id: session.user.id }
        const { data: inserted } = await supabase.from("messages").insert(msg).select().single()
        setMessages((prev: any) => [...prev, inserted || { ...msg, id: `img-${Date.now()}` }])
      }
    } catch (err) {
      console.error("generateImage error:", err)
      alert("Failed to generate image. Please check your Gemini API key.")
    } finally {
      setGeneratingImg(false)
    }
  }

  async function handleStartNewChat() {
    if (!activeChar || !session) return
    if (messages.length === 0) return
    if (window.confirm(`Start a fresh new chat session with ${activeChar.name}? This will clear your chat history with this bot.`)) {
      await supabase.from("messages").delete()
        .eq("character_id", activeChar.id)
        .eq("user_id", session.user.id)
      setMessages([])
    }
  }

  async function handleDeleteMessage(msgId: string) {
    if (!msgId) return
    if (msgId.startsWith("temp-")) {
      setMessages((prev: any) => prev.filter((m: any) => m.id !== msgId))
      return
    }
    await supabase.from("messages").delete().eq("id", msgId)
    setMessages((prev: any) => prev.filter((m: any) => m.id !== msgId))
  }

  function handleCopyMessage(content: string, id: string) {
    const text = content.startsWith("[image]:") ? content.replace("[image]:", "") : content
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  function handleDeleteBot() {
    if (!activeChar) return
    if (window.confirm(`Are you sure you want to delete "${activeChar.name}"? This will delete the bot and its chat messages.`)) {
      if (onDeleteCharacter) {
        onDeleteCharacter(activeChar.id)
      }
      onBack()
    }
  }

  async function createReplica() {
    if (!session) return
    setCreating(true)
    const { data: msgs } = await supabase
      .from("messages")
      .select("content")
      .eq("user_id", session.user.id)
      .eq("role", "user")
      .order("created_at", { ascending: true })
      .limit(200)

    if (!msgs || msgs.length < 5) {
      alert("Send at least 5 messages before creating a replica!")
      setCreating(false)
      return
    }

    const sampleMessages = msgs.map((m: any) => m.content).join("\n")
    const res = await fetch("/api/chat", {
      method: "POST", 
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: `Analyze the writing style, personality, tone, vocabulary, and communication patterns from these messages. Write a system prompt (max 200 words) for an AI to perfectly impersonate this person.\n\nMessages:\n${sampleMessages}` }],
        systemPrompt: "You are an expert at analyzing writing styles. Return only the system prompt text, nothing else."
      })
    })
    const data = await res.json()
    const system_prompt = `${data.reply} Never break character. Match the original person's typical message length and style exactly.`

    await supabase.from("characters")
      .delete()
      .eq("replica_of", session.user.id)
      .eq("created_by", session.user.id)

    const { data: char, error } = await supabase.from("characters")
      .insert({
        name: `${session.user.email?.split("@")[0]}'s Replica`,
        emoji: "🪞",
        system_prompt,
        created_by: session.user.id,
        is_replica: true,
        replica_of: session.user.id,
        is_public: false
      })
      .select().single()

    if (!error && char) {
      setMessages([])
    }
    setCreating(false)
  }

  const isOwner = activeChar.created_by === session?.user?.id
  const isReplica = !!activeChar.is_replica

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

        {/* Character avatar */}
        <div style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: "hsla(119,99%,46%,0.12)",
          border: "1px solid hsla(119,99%,46%,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
          boxShadow: "0 0 16px hsla(119,99%,46%,0.15)",
          flexShrink: 0,
        }}>{activeChar.emoji}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.text, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {activeChar.name}
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2, display: "flex", alignItems: "center", gap: 6 }}>
            {isReplica ? (
              <span style={{ color: "#a855f7" }}>🪞 Replica</span>
            ) : isOwner ? (
              <span style={{ color: T.primary }}>✦ Your Custom Bot</span>
            ) : (
              <span>✦ AI Character</span>
            )}
            <span>·</span>
            <span>Private Chat</span>
            <span>·</span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                color: "#38bdf8",
                background: "rgba(56,189,248,0.12)",
                border: "1px solid rgba(56,189,248,0.25)",
                padding: "1px 7px",
                borderRadius: 999,
                fontSize: 10,
                fontWeight: 600,
              }}
              title="ChatSorter AI Memory: Automatically stores facts and recalls long-term context across conversations"
            >
              🧠 ChatSorter Memory
            </span>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {/* New Chat / Reset Chat Button */}
          <button
            type="button"
            onClick={handleStartNewChat}
            title="Start new chat session"
            disabled={messages.length === 0}
            style={{
              background: "rgba(255,255,255,0.05)",
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              color: messages.length === 0 ? T.muted2 : T.text,
              fontSize: 12,
              fontWeight: 600,
              cursor: messages.length === 0 ? "default" : "pointer",
              padding: "7px 12px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              opacity: messages.length === 0 ? 0.5 : 1,
              fontFamily: T.font,
              transition: "all 0.15s ease",
            }}
            onMouseEnter={e => {
              if (messages.length > 0) {
                const el = e.currentTarget
                el.style.background = "hsla(119,99%,46%,0.12)"
                el.style.borderColor = "hsla(119,99%,46%,0.4)"
                el.style.color = T.primary
              }
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              el.style.background = "rgba(255,255,255,0.05)"
              el.style.borderColor = T.border
              el.style.color = messages.length === 0 ? T.muted2 : T.text
            }}
          >
            <span>✨</span>
            <span style={{ display: "inline" }}>New Chat</span>
          </button>

          {/* Edit Bot if user created */}
          {isOwner && !isReplica && onEditChar && (
            <button
              type="button"
              onClick={() => onEditChar(activeChar)}
              title="Edit character settings"
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
                transition: "all 0.15s ease",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget
                el.style.background = "rgba(255,255,255,0.1)"
                el.style.color = T.text
              }}
              onMouseLeave={e => {
                const el = e.currentTarget
                el.style.background = "rgba(255,255,255,0.05)"
                el.style.color = T.muted
              }}
            >
              <span>✏️</span>
            </button>
          )}

          {/* Delete Bot if user created */}
          {(isOwner || isReplica) && (
            <button
              type="button"
              onClick={handleDeleteBot}
              title="Delete this bot"
              style={{
                background: "rgba(248,113,113,0.08)",
                border: "1px solid rgba(248,113,113,0.2)",
                borderRadius: 8,
                color: T.red,
                fontSize: 12,
                cursor: "pointer",
                padding: "7px 10px",
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontFamily: T.font,
                transition: "all 0.15s ease",
              }}
              onMouseEnter={e => {
                const el = e.currentTarget
                el.style.background = "rgba(248,113,113,0.2)"
                el.style.borderColor = "rgba(248,113,113,0.4)"
              }}
              onMouseLeave={e => {
                const el = e.currentTarget
                el.style.background = "rgba(248,113,113,0.08)"
                el.style.borderColor = "rgba(248,113,113,0.2)"
              }}
            >
              <span>🗑️</span>
            </button>
          )}

          {/* Create Replica button */}
          <button
            disabled={creating}
            onClick={createReplica}
            title="Create a digital replica persona of yourself"
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
            {creating ? "⏳ Creating…" : "🪞 My Replica"}
          </button>
        </div>
      </div>

      {/* ── ChatSorter Recalled Memories Banner ──────────────────── */}
      {recalledMemories.length > 0 && (
        <div style={{
          background: "rgba(56,189,248,0.08)",
          border: "1px solid rgba(56,189,248,0.22)",
          borderRadius: 8,
          padding: "7px 12px",
          margin: "8px 16px 0 16px",
          fontSize: 11,
          color: "#7dd3fc",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, overflow: "hidden" }}>
            <span>🧠</span>
            <span style={{ fontWeight: 600, flexShrink: 0 }}>ChatSorter Memory:</span>
            <span style={{ opacity: 0.9, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {recalledMemories[0]}
            </span>
          </div>
          <button
            onClick={() => setRecalledMemories([])}
            style={{
              background: "transparent",
              border: "none",
              color: "#7dd3fc",
              cursor: "pointer",
              fontSize: 14,
              lineHeight: 1,
              padding: "0 4px",
              flexShrink: 0,
            }}
            title="Dismiss memory notice"
          >×</button>
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
          gap: 12,
          padding: 16,
          background: T.bgAlt,
        }}
      >
        {messages.length === 0 && !loading && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            gap: 14,
            color: T.muted,
            fontSize: 13,
            textAlign: "center",
            lineHeight: 1.7,
            padding: 32,
          }}>
            <div style={{
              fontSize: 40,
              width: 72,
              height: 72,
              borderRadius: 20,
              background: "hsla(119,99%,46%,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid hsla(119,99%,46%,0.2)",
            }}>{activeChar.emoji}</div>
            <div>
              <div style={{ fontWeight: 700, color: T.text, marginBottom: 4, fontSize: 16 }}>
                Chat with {activeChar.name}
              </div>
              <p style={{ margin: 0, maxWidth: 360 }}>
                {activeChar.system_prompt 
                  ? activeChar.system_prompt.replace(/You are .*?\. /i, "").substring(0, 140) + "…"
                  : "Say hello or ask anything — this chat is private and saved."}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 8 }}>
              {["👋 Hello!", "Tell me about yourself", "What can you do?"].map(preset => (
                <button
                  key={preset}
                  onClick={() => { setInput(preset) }}
                  style={{
                    padding: "6px 14px",
                    background: T.surface,
                    border: `1px solid ${T.border}`,
                    borderRadius: 999,
                    color: T.text,
                    fontSize: 12,
                    cursor: "pointer",
                    fontFamily: T.font,
                    transition: "all 0.15s ease",
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget
                    el.style.borderColor = "hsla(119,99%,46%,0.4)"
                    el.style.color = T.primary
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget
                    el.style.borderColor = T.border
                    el.style.color = T.text
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m: any, i: number) => {
          const isImage = m.content?.startsWith("[image]:")
          const imageUrl = isImage ? m.content.replace("[image]:", "") : null
          const isUser = m.role === "user"
          const msgId = m.id ?? `msg-${i}`
          const isHovered = hoveredMsgId === msgId

          return (
            <div
              key={msgId}
              onMouseEnter={() => setHoveredMsgId(msgId)}
              onMouseLeave={() => setHoveredMsgId(null)}
              style={{
                display: "flex",
                flexDirection: isUser ? "row-reverse" : "row",
                alignItems: "center",
                gap: 8,
                maxWidth: "80%",
                alignSelf: isUser ? "flex-end" : "flex-start",
                position: "relative",
              }}
            >
              {/* Message Bubble */}
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
                  border: isUser ? "none" : `1px solid ${T.border}`,
                  boxShadow: isUser ? "0 2px 12px hsla(119,99%,46%,0.2)" : "none",
                  fontWeight: isUser ? 500 : 400,
                  animation: "fade-in 0.2s ease both",
                }}
              >
                {isImage ? (
                  <img 
                    src={imageUrl!} 
                    alt="Generated output"
                    style={{ width: "100%", maxWidth: 280, borderRadius: 10, display: "block" }} 
                  />
                ) : (
                  m.content
                )}
              </div>

              {/* Message Action Toolbar on Hover */}
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                opacity: isHovered ? 1 : 0,
                transition: "opacity 0.15s ease",
                pointerEvents: isHovered ? "auto" : "none",
              }}>
                {/* Copy button */}
                <button
                  type="button"
                  title="Copy text"
                  onClick={() => handleCopyMessage(m.content, msgId)}
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
                    transition: "all 0.15s",
                  }}
                >
                  {copiedId === msgId ? "✓ Copied" : "📋"}
                </button>

                {/* Delete message button */}
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
                    transition: "all 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = T.red}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = T.muted2}
                >
                  🗑️
                </button>
              </div>
            </div>
          )
        })}

        {/* Typing indicator */}
        {loading && (
          <div className="cc-bubble" style={{
            padding: "12px 16px",
            borderRadius: 14,
            borderBottomLeftRadius: 4,
            background: T.surface,
            border: `1px solid ${T.border}`,
            alignSelf: "flex-start",
            display: "flex",
            alignItems: "center",
            gap: 5,
            maxWidth: "65%",
          }}>
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
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
        {/* Image generation button */}
        <button
          onClick={handleGenerateImage}
          disabled={!input.trim() || generatingImg}
          title="Generate image with Gemini AI"
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: T.bgAlt,
            border: `1px solid ${T.border}`,
            fontSize: 17,
            cursor: !input.trim() || generatingImg ? "not-allowed" : "pointer",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: !input.trim() || generatingImg ? 0.5 : 1,
            transition: "border-color 0.15s, opacity 0.15s",
          }}
        >
          {generatingImg ? "⏳" : "🖼️"}
        </button>

        <input
          className="cc-chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage()}
          placeholder={`Message ${activeChar.name}…`}
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
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            width: 42,
            height: 42,
            borderRadius: "50%",
            background: loading || !input.trim()
              ? T.surface
              : "linear-gradient(135deg, hsl(119,99%,46%), hsl(119,99%,38%))",
            border: `1px solid ${loading || !input.trim() ? T.border : "transparent"}`,
            fontSize: 17,
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            color: loading || !input.trim() ? T.muted : T.primaryFg,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.18s",
            boxShadow: loading || !input.trim() ? "none" : "0 2px 12px hsla(119,99%,46%,0.3)",
          }}
        >↑</button>
      </div>
    </div>
  )
}