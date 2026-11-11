"use client"
import { useState, useRef, useEffect } from "react"
import { T } from "../../styles"
import type { DiscordChannel, DiscordMessage, DiscordMember } from "../../lib/discordTypes"

interface Props {
  channel: DiscordChannel
  messages: DiscordMessage[]
  onSendMessage: (content: string, imageUrl?: string) => void
  onToggleMemberList: () => void
  memberListOpen: boolean
  session: any
  profile: any
  onOpenMobileMenu?: () => void
  onTriggerAiIcebreaker?: () => void
  generatingImg?: boolean
  onGenerateImage?: (prompt: string) => void
}

export default function ServerChatArea({
  channel,
  messages,
  onSendMessage,
  onToggleMemberList,
  memberListOpen,
  session,
  profile,
  onOpenMobileMenu,
  onTriggerAiIcebreaker,
  generatingImg = false,
  onGenerateImage,
}: Props) {
  const [input, setInput] = useState("")
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null)
  const [showImagePromptModal, setShowImagePromptModal] = useState(false)
  const [imagePromptText, setImagePromptText] = useState("")

  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  function handleSend() {
    if (!input.trim()) return
    onSendMessage(input.trim())
    setInput("")
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleTriggerImage() {
    if (imagePromptText.trim() && onGenerateImage) {
      onGenerateImage(imagePromptText.trim())
      setShowImagePromptModal(false)
      setImagePromptText("")
    }
  }

  return (
    <div
      className="cc-discord-chat-area"
      style={{
        flex: 1,
        minWidth: 0,
        height: "100%",
        display: "flex",
        flexDirection: "column",
        background: "#1e1f22",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ── 1. Discord Channel Header ─────────────────────────────── */}
      <header
        style={{
          height: 48,
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          background: "#1e1f22",
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {/* Mobile hamburger menu toggle */}
          {onOpenMobileMenu && (
            <button
              type="button"
              className="cc-discord-mobile-menu-btn"
              onClick={onOpenMobileMenu}
              style={{
                background: "transparent",
                border: "none",
                color: "#dbdee1",
                fontSize: 18,
                cursor: "pointer",
                padding: "4px 8px 4px 0",
              }}
            >
              ☰
            </button>
          )}

          <span style={{ fontSize: 20, color: "#80848e", fontWeight: 700 }}>
            {channel.type === "radar" ? "⚡" : channel.type === "ai" ? "🤖" : "#"}
          </span>

          <span style={{ fontSize: 16, fontWeight: 700, color: "#f2f3f5", whiteSpace: "nowrap" }}>
            {channel.name}
          </span>

          {channel.topic && (
            <>
              <div style={{ width: 1, height: 16, background: "rgba(255, 255, 255, 0.12)", margin: "0 6px" }} />
              <span
                style={{
                  fontSize: 13,
                  color: "#949ba4",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {channel.topic}
              </span>
            </>
          )}
        </div>

        {/* Right header tool buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {onTriggerAiIcebreaker && (
            <button
              type="button"
              onClick={onTriggerAiIcebreaker}
              title="Summon AI Wingman Icebreaker"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 10px",
                borderRadius: 6,
                background: "rgba(168, 85, 247, 0.15)",
                border: "1px solid rgba(168, 85, 247, 0.35)",
                color: "#c084fc",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <span>🎲</span>
              <span className="hide-on-mobile">Wingman</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleMemberList}
            title={memberListOpen ? "Hide Member List" : "Show Member List"}
            style={{
              background: memberListOpen ? "rgba(255, 255, 255, 0.12)" : "transparent",
              border: "none",
              borderRadius: 6,
              color: memberListOpen ? "#ffffff" : "#b5bac1",
              fontSize: 16,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            👥
          </button>
        </div>
      </header>

      {/* ── 2. Channel Messages Area ──────────────────────────────── */}
      <div
        className="cc-discord-messages-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Welcome Channel Banner */}
        <div style={{ margin: "20px 0 10px", paddingBottom: 20, borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: "50%",
              background: "#2b2d31",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              color: "#ffffff",
              marginBottom: 12,
            }}
          >
            {channel.type === "radar" ? "⚡" : channel.type === "ai" ? "🤖" : "#"}
          </div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#f2f3f5" }}>
            Welcome to #{channel.name}!
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#949ba4" }}>
            This is the start of the #{channel.name} channel. Chat with fellow members, mention @ai for smart assistance, or test digital replicas!
          </p>
        </div>

        {/* Messages List with Discord clustering */}
        {messages.map((msg, index) => {
          const prevMsg = index > 0 ? messages[index - 1] : null
          const isSameSenderAsPrev = prevMsg && prevMsg.senderId === msg.senderId
          const isHovered = hoveredMsgId === msg.id
          const hasMention = msg.content.includes("@ai") || (profile?.username && msg.content.includes(`@${profile.username}`))

          return (
            <div
              key={msg.id}
              onMouseEnter={() => setHoveredMsgId(msg.id)}
              onMouseLeave={() => setHoveredMsgId(null)}
              style={{
                position: "relative",
                display: "flex",
                gap: 14,
                padding: isSameSenderAsPrev ? "2px 8px" : "6px 8px",
                borderRadius: 4,
                background: hasMention
                  ? "rgba(240, 178, 50, 0.1)"
                  : isHovered
                  ? "rgba(255, 255, 255, 0.03)"
                  : "transparent",
                borderLeft: hasMention ? "2px solid #f0b232" : "2px solid transparent",
                transition: "background 0.1s ease",
              }}
            >
              {/* Message Hover Actions Bar */}
              {isHovered && (
                <div
                  style={{
                    position: "absolute",
                    top: -14,
                    right: 12,
                    background: "#2b2d31",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 6,
                    padding: "2px 4px",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    zIndex: 20,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onSendMessage(`❤️ to "${msg.content.slice(0, 30)}..."`)}
                    title="React with Love"
                    style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 13, padding: "2px 4px" }}
                  >
                    ❤️
                  </button>
                  <button
                    type="button"
                    onClick={() => onSendMessage(`🔥 to "${msg.content.slice(0, 30)}..."`)}
                    title="React with Fire"
                    style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 13, padding: "2px 4px" }}
                  >
                    🔥
                  </button>
                  <button
                    type="button"
                    onClick={() => setInput(`@ai Explain this: "${msg.content.slice(0, 50)}"`)}
                    title="Ask AI to Explain"
                    style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 13, padding: "2px 4px", color: T.primary }}
                  >
                    ✦ AI
                  </button>
                </div>
              )}

              {/* Avatar column (only rendered for first message in cluster) */}
              {!isSameSenderAsPrev ? (
                <div style={{ flexShrink: 0 }}>
                  {msg.senderAvatar ? (
                    <img
                      src={msg.senderAvatar}
                      alt=""
                      style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        background: msg.role === "bot" ? "hsla(119,99%,46%,0.2)" : msg.role === "replica" ? "rgba(168,85,247,0.2)" : "#313338",
                        color: msg.role === "bot" ? T.primary : msg.role === "replica" ? "#c084fc" : "#dbdee1",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                        fontWeight: 700,
                      }}
                    >
                      {msg.role === "bot" ? "🤖" : msg.role === "replica" ? "🪞" : "👤"}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ width: 40, flexShrink: 0, textAlign: "right", fontSize: 10, color: "#666" }}>
                  {isHovered && new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              )}

              {/* Content Column */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {!isSameSenderAsPrev && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: msg.role === "bot" ? T.primary : msg.role === "replica" ? "#c084fc" : "#f2f3f5",
                        cursor: "pointer",
                      }}
                    >
                      {msg.senderName}
                    </span>

                    {/* Role badge */}
                    {msg.badge && (
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 800,
                          padding: "1px 5px",
                          borderRadius: 4,
                          background: msg.badge === "BOT" ? "#5865F2" : msg.badge === "REPLICA" ? "#a855f7" : "#f0b232",
                          color: "#ffffff",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {msg.badge}
                      </span>
                    )}

                    <span style={{ fontSize: 11, color: "#949ba4" }}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                )}

                {/* Message Text */}
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "#dbdee1",
                    wordBreak: "break-word",
                    userSelect: "text",
                    WebkitUserSelect: "text",
                  }}
                >
                  {msg.content}
                </div>

                {/* Attached Image */}
                {msg.imageUrl && (
                  <div style={{ marginTop: 8 }}>
                    <img
                      src={msg.imageUrl}
                      alt="Attached"
                      style={{ maxWidth: 360, maxHeight: 260, borderRadius: 8, objectFit: "cover" }}
                    />
                  </div>
                )}
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} style={{ height: 10 }} />
      </div>

      {/* ── 3. Discord-Style Rich Input Box ───────────────────────── */}
      <div
        style={{
          padding: "0 16px 18px",
          background: "#1e1f22",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            background: "#383a40",
            borderRadius: 8,
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {/* File/Image Upload Button */}
          <input
            type="file"
            ref={fileInputRef}
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) {
                const reader = new FileReader()
                reader.onload = () => {
                  onSendMessage("Shared an image:", reader.result as string)
                }
                reader.readAsDataURL(file)
              }
            }}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Upload Photo / File"
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "#4e5058",
              border: "none",
              color: "#dbdee1",
              fontSize: 16,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            +
          </button>

          {/* Text input */}
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${channel.name} (type @ai to summon AI Co-Pilot)...`}
            style={{
              flex: 1,
              minWidth: 0,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#dbdee1",
              fontSize: 15,
              fontFamily: T.font,
            }}
          />

          {/* Quick AI Trigger button */}
          <button
            type="button"
            onClick={() => {
              if (!input.startsWith("@ai ")) setInput(`@ai ${input}`)
            }}
            title="Mention @ai"
            style={{
              padding: "2px 8px",
              borderRadius: 4,
              background: input.startsWith("@ai") ? "hsla(119,99%,46%,0.2)" : "transparent",
              border: input.startsWith("@ai") ? `1px solid ${T.primary}` : "1px solid rgba(255,255,255,0.1)",
              color: input.startsWith("@ai") ? T.primary : "#949ba4",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            @ai
          </button>

          {/* AI Image Generation Button */}
          {onGenerateImage && (
            <button
              type="button"
              onClick={() => setShowImagePromptModal(true)}
              disabled={generatingImg}
              title="Generate AI Image"
              style={{
                background: "transparent",
                border: "none",
                fontSize: 16,
                cursor: generatingImg ? "wait" : "pointer",
              }}
            >
              {generatingImg ? "⏳" : "🖼️"}
            </button>
          )}

          {/* Send Arrow button */}
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim()}
            title="Send Message"
            style={{
              width: 30,
              height: 30,
              borderRadius: "50%",
              background: input.trim() ? "hsl(119, 99%, 46%)" : "transparent",
              border: "none",
              color: input.trim() ? "#000" : "#80848e",
              fontSize: 14,
              fontWeight: 800,
              cursor: input.trim() ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.15s ease",
            }}
          >
            ↑
          </button>
        </div>
      </div>

      {/* Image Prompt Modal */}
      {showImagePromptModal && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(6px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setShowImagePromptModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#2b2d31",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12,
              padding: 20,
              maxWidth: 420,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16, color: "#f2f3f5", fontWeight: 700 }}>
              🖼️ Generate Image with Gemini AI
            </h3>
            <input
              value={imagePromptText}
              onChange={(e) => setImagePromptText(e.target.value)}
              placeholder="e.g. Cyberpunk city with neon glowing rain..."
              style={{
                padding: "10px 14px",
                background: "#1e1f22",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                color: "#f2f3f5",
                fontSize: 14,
                outline: "none",
              }}
              onKeyDown={(e) => e.key === "Enter" && handleTriggerImage()}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button
                type="button"
                onClick={() => setShowImagePromptModal(false)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 6,
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "#949ba4",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleTriggerImage}
                disabled={!imagePromptText.trim()}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  background: "hsl(119, 99%, 46%)",
                  border: "none",
                  color: "#000",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: imagePromptText.trim() ? "pointer" : "not-allowed",
                }}
              >
                Generate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
