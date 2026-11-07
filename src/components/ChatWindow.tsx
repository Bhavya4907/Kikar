"use client"
import { useEffect, useRef, useState } from "react"
import { supabase } from "../lib/supabase"
import { T } from "../styles"
import { showNotification, speakMessageText, stopSpeakingText } from "../lib/helpers"
import type { PlanTier, UsageQuota } from "../lib/types"

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
  planTier?: PlanTier
  quota?: UsageQuota | null
  onConsumeChatQuota?: () => boolean
  onConsumeImageQuota?: () => boolean
  onOpenPricing?: () => void
}

export default function ChatWindow({
  session,
  activeChar,
  messages,
  setMessages,
  onBack,
  creating,
  setCreating,
  onDeleteCharacter,
  onEditChar,
  planTier = "free",
  quota,
  onConsumeChatQuota,
  onConsumeImageQuota,
  onOpenPricing,
}: Props) {
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [generatingImg, setGeneratingImg] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [activeActionMsgId, setActiveActionMsgId] = useState<string | null>(null)
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null)
  const [recalledMemories, setRecalledMemories] = useState<string[]>([])
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason] = useState("Inaccurate or inappropriate AI response")
  const [reportSubmitted, setReportSubmitted] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  async function sendMessage() {
    if (!input.trim() || !activeChar || loading || !session) return

    if (onConsumeChatQuota && !onConsumeChatQuota()) {
      if (onOpenPricing) onOpenPricing()
      return
    }

    const tempId = `temp-${Date.now()}`
    const userMsg = { role: "user", content: input.trim(), character_id: activeChar.id, user_id: session.user.id }
    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))

    setMessages((prev: any) => [...prev, { ...userMsg, id: tempId }])
    setInput("")
    setLoading(true)

    try {
      // Save user message (non-fatal if DB insert fails so chat still responds)
      const { data: insertedUserMsg } = await supabase
        .from("messages")
        .insert(userMsg)
        .select()
        .maybeSingle()

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          systemPrompt: activeChar.system_prompt,
          userId: session.user.id,
          planTier,
          chatId: `${session.user.id}_${activeChar.id}`,
        }),
      })
      const data = await res.json()

      if (Array.isArray(data.memoriesRecalled) && data.memoriesRecalled.length > 0) {
        setRecalledMemories(data.memoriesRecalled)
      }

      const aiReply = data.reply || "Sorry, I couldn't generate a response."
      const aiMsg = { role: "assistant", content: aiReply, character_id: activeChar.id, user_id: session.user.id }
      const { data: insertedAiMsg } = await supabase
        .from("messages")
        .insert(aiMsg)
        .select()
        .maybeSingle()

      setMessages((prev: any) => [
        ...prev.filter((m: any) => m.id !== tempId),
        insertedUserMsg || { ...userMsg, id: `u-${Date.now()}` },
        insertedAiMsg || { ...aiMsg, id: `a-${Date.now() + 1}` },
      ])
      showNotification(activeChar.name, aiReply)
    } catch (err) {
      console.error("sendMessage error:", err)
      setMessages((prev: any) => [
        ...prev.filter((m: any) => m.id !== tempId),
        { ...userMsg, id: `u-${Date.now()}` },
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "Network error while reaching AI service. Please check your connection or API keys.",
          character_id: activeChar.id,
          user_id: session.user.id,
        },
      ])
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateImage() {
    if (!input.trim() || !activeChar || !session) return

    if (onConsumeImageQuota && !onConsumeImageQuota()) {
      if (onOpenPricing) onOpenPricing()
      return
    }

    setGeneratingImg(true)
    const promptText = input.trim()
    setInput("")
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText, userId: session.user.id }),
      })
      if (!res.ok) throw new Error(`Status: ${res.status}`)
      const data = await res.json()
      if (data.url) {
        const msg = { role: "assistant", content: `[image]:${data.url}`, character_id: activeChar.id, user_id: session.user.id }
        const { data: inserted } = await supabase.from("messages").insert(msg).select().maybeSingle()
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
    setShowMobileMenu(false)
    if (!activeChar || !session || messages.length === 0) return
    if (window.confirm(`Start a fresh new chat session with ${activeChar.name}? This will clear your chat history with this bot.`)) {
      await supabase.from("messages").delete()
        .eq("character_id", activeChar.id)
        .eq("user_id", session.user.id)
      setMessages([])
    }
  }

  async function handleDeleteMessage(msgId: string) {
    if (!msgId) return
    setMessages((prev: any) => prev.filter((m: any) => m.id !== msgId))
    if (!String(msgId).startsWith("temp-") && !String(msgId).startsWith("u-") && !String(msgId).startsWith("a-")) {
      await supabase.from("messages").delete().eq("id", msgId)
    }
  }

  function handleCopyMessage(content: string, id: string) {
    const text = content.startsWith("[image]:") ? content.replace("[image]:", "") : content
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
    setSpeakingMsgId(id)
    speakMessageText(content, () => setSpeakingMsgId(null))
  }

  async function handleSubmitReport() {
    if (!session || !activeChar) return
    await supabase.from("character_reports").insert({
      reporter_id: session.user.id,
      character_id: activeChar.id,
      reason: reportReason,
    })
    setReportSubmitted(true)
    setTimeout(() => {
      setReportSubmitted(false)
      setShowReportModal(false)
    }, 1500)
  }

  function handleDeleteBot() {
    setShowMobileMenu(false)
    if (!activeChar) return
    if (window.confirm(`Are you sure you want to delete "${activeChar.name}"? This will delete the bot and its chat messages.`)) {
      if (onDeleteCharacter) {
        onDeleteCharacter(activeChar.id)
      }
      onBack()
    }
  }

  async function createReplica() {
    setShowMobileMenu(false)
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
        systemPrompt: "You are an expert at analyzing writing styles. Return only the system prompt text, nothing else.",
        userId: session.user.id,
      }),
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
        is_public: false,
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
      width: "100%",
      fontFamily: T.font,
      position: "relative",
    }}>
      {/* ── Mobile-Friendly Single-Row Header ──────────────────── */}
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
          title="Back to characters"
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

        {/* Character avatar */}
        <div style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: "hsla(119,99%,46%,0.12)",
          border: "1px solid hsla(119,99%,46%,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 20,
          flexShrink: 0,
        }}>{activeChar.emoji}</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {activeChar.name}
          </div>
          <div style={{ fontSize: 11, color: T.muted, display: "flex", alignItems: "center", gap: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {isReplica ? (
              <span style={{ color: "#a855f7", fontWeight: 600 }}>🪞 Replica</span>
            ) : isOwner ? (
              <span style={{ color: T.primary }}>✦ Custom Bot</span>
            ) : (
              <span>✦ AI Persona</span>
            )}
            <span>·</span>
            <span style={{ color: "#38bdf8", fontWeight: 600 }}>🧠 Memory</span>
          </div>
        </div>

        {/* Compact Header Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {onOpenPricing && (
            <button
              type="button"
              onClick={onOpenPricing}
              title="View plan and remaining daily credits"
              style={{
                background: planTier === "free" ? "rgba(255,255,255,0.05)" : "hsla(119,99%,46%,0.14)",
                border: planTier === "free" ? `1px solid ${T.border}` : `1px solid ${T.primary}`,
                borderRadius: 8,
                color: planTier === "free" ? T.text : T.primary,
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                padding: "6px 9px",
                fontFamily: T.font,
                whiteSpace: "nowrap",
              }}
            >
              ⚡ {planTier.toUpperCase()}
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowMobileMenu(prev => !prev)}
            title="Character options"
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

      {/* ── Dropdown Menu for Character Actions (Works cleanly on Mobile & Desktop) ── */}
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
          minWidth: 200,
        }}>
          <button
            type="button"
            onClick={handleStartNewChat}
            disabled={messages.length === 0}
            style={{
              padding: "9px 12px",
              background: "transparent",
              border: "none",
              borderRadius: 8,
              color: T.text,
              fontSize: 12,
              fontWeight: 600,
              textAlign: "left",
              cursor: "pointer",
              fontFamily: T.font,
              opacity: messages.length === 0 ? 0.5 : 1,
            }}
          >
            ✨ Start Fresh Chat
          </button>

          <button
            type="button"
            disabled={creating}
            onClick={createReplica}
            style={{
              padding: "9px 12px",
              background: "transparent",
              border: "none",
              borderRadius: 8,
              color: "#c084fc",
              fontSize: 12,
              fontWeight: 600,
              textAlign: "left",
              cursor: "pointer",
              fontFamily: T.font,
            }}
          >
            🪞 {creating ? "Creating Replica…" : "Train My Digital Replica"}
          </button>

          {isOwner && !isReplica && onEditChar && (
            <button
              type="button"
              onClick={() => { setShowMobileMenu(false); onEditChar(activeChar) }}
              style={{
                padding: "9px 12px",
                background: "transparent",
                border: "none",
                borderRadius: 8,
                color: T.text,
                fontSize: 12,
                fontWeight: 600,
                textAlign: "left",
                cursor: "pointer",
                fontFamily: T.font,
              }}
            >
              ✏️ Edit Character &amp; Vibe
            </button>
          )}

          <button
            type="button"
            onClick={() => { setShowMobileMenu(false); setShowReportModal(true) }}
            style={{
              padding: "9px 12px",
              background: "transparent",
              border: "none",
              borderRadius: 8,
              color: T.muted,
              fontSize: 12,
              fontWeight: 600,
              textAlign: "left",
              cursor: "pointer",
              fontFamily: T.font,
            }}
          >
            🚩 Report AI Character
          </button>

          {(isOwner || isReplica) && (
            <button
              type="button"
              onClick={handleDeleteBot}
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
              🗑️ Delete Character
            </button>
          )}
        </div>
      )}

      {/* ── Safety Report Modal ──────────────────────────────────── */}
      {showReportModal && (
        <div style={{
          margin: "8px 12px 0",
          padding: "10px 14px",
          background: T.surface,
          border: "1px solid rgba(248,113,113,0.35)",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
          flexShrink: 0,
        }}>
          {reportSubmitted ? (
            <span style={{ fontSize: 12, color: T.primary, fontWeight: 600 }}>
              ✓ Thank you. Your safety report has been logged for review.
            </span>
          ) : (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 200 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: T.red }}>🚩 Report:</span>
                <select
                  value={reportReason}
                  onChange={e => setReportReason(e.target.value)}
                  style={{
                    flex: 1,
                    background: T.bgAlt,
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    color: T.text,
                    fontSize: 12,
                    padding: "5px 8px",
                    fontFamily: T.font,
                  }}
                >
                  <option value="Inaccurate or inappropriate AI response">Inaccurate or inappropriate AI response</option>
                  <option value="Unauthorized impersonation">Unauthorized impersonation</option>
                  <option value="Spam or harmful prompt">Spam or harmful prompt</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={handleSubmitReport}
                  style={{
                    background: T.red,
                    border: "none",
                    borderRadius: 8,
                    color: "#000",
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "6px 12px",
                    cursor: "pointer",
                  }}
                >
                  Submit
                </button>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  style={{
                    background: "transparent",
                    border: `1px solid ${T.border}`,
                    borderRadius: 8,
                    color: T.muted,
                    fontSize: 11,
                    padding: "6px 10px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── ChatSorter Recalled Memories Banner ──────────────────── */}
      {recalledMemories.length > 0 && (
        <div style={{
          background: "rgba(56,189,248,0.08)",
          border: "1px solid rgba(56,189,248,0.22)",
          borderRadius: 8,
          padding: "6px 12px",
          margin: "8px 12px 0",
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
            <span style={{ fontWeight: 600, flexShrink: 0 }}>Memory:</span>
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
          gap: 10,
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
            gap: 12,
            color: T.muted,
            fontSize: 13,
            textAlign: "center",
            lineHeight: 1.6,
            padding: 24,
          }}>
            <div style={{
              fontSize: 36,
              width: 68,
              height: 68,
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
              <p style={{ margin: 0, maxWidth: 320 }}>
                {activeChar.system_prompt
                  ? activeChar.system_prompt.replace(/You are .*?\. /i, "").substring(0, 120) + "…"
                  : "Say hello or ask anything — this chat is private and saved."}
              </p>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 6 }}>
              {["👋 Hello!", "Tell me about yourself", "Give me your best advice"].map(preset => (
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
          const msgId = String(m.id ?? `msg-${i}`)
          const showActions = activeActionMsgId === msgId || speakingMsgId === msgId

          return (
            <div
              key={msgId}
              onClick={() => setActiveActionMsgId(prev => (prev === msgId ? null : msgId))}
              onMouseEnter={() => setActiveActionMsgId(msgId)}
              onMouseLeave={() => setActiveActionMsgId(null)}
              style={{
                display: "flex",
                flexDirection: isUser ? "row-reverse" : "row",
                alignItems: "center",
                gap: 6,
                maxWidth: "85%",
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
                  lineHeight: 1.5,
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
                  fontWeight: isUser ? 500 : 400,
                }}
              >
                {isImage ? (
                  <img
                    src={imageUrl!}
                    alt="Generated output"
                    style={{ width: "100%", maxWidth: 250, borderRadius: 10, display: "block" }}
                  />
                ) : (
                  m.content
                )}
              </div>

              {/* Touch & Hover Action Toolbar */}
              {showActions && (
                <div
                  onClick={e => e.stopPropagation()}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {!isImage && (
                    <button
                      type="button"
                      title="Listen to AI voice note"
                      onClick={() => handleSpeakToggle(m.content, msgId)}
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
                    title="Copy text"
                    onClick={() => handleCopyMessage(m.content, msgId)}
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
                </div>
              )}
            </div>
          )
        })}

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
        <button
          type="button"
          onClick={handleGenerateImage}
          disabled={!input.trim() || generatingImg}
          title="Generate image with Gemini AI"
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: T.bgAlt,
            border: `1px solid ${T.border}`,
            fontSize: 16,
            cursor: !input.trim() || generatingImg ? "not-allowed" : "pointer",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: !input.trim() || generatingImg ? 0.5 : 1,
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
          onClick={sendMessage}
          disabled={loading || !input.trim()}
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: loading || !input.trim()
              ? T.surface
              : "linear-gradient(135deg, hsl(119,99%,46%), hsl(119,99%,38%))",
            border: `1px solid ${loading || !input.trim() ? T.border : "transparent"}`,
            fontSize: 16,
            cursor: loading || !input.trim() ? "not-allowed" : "pointer",
            color: loading || !input.trim() ? T.muted : T.primaryFg,
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