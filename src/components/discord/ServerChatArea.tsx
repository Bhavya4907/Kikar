"use client"
import { useState, useRef, useEffect } from "react"
import { T } from "../../styles"
import type { DiscordChannel, DiscordMessage } from "../../lib/discordTypes"
import { Icon } from "../Icons"

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
  typingNames?: string[]
  onTyping?: (isTyping: boolean) => void
  onReactMessage?: (msgId: string, emoji: string) => void
  voiceConnected?: boolean
  onToggleVoice?: () => void
  voiceStage?: React.ReactNode
}

const QUICK_EMOJIS = ["👍", "❤️", "🔥", "😂", "💀", "🚀"]

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
  typingNames = [],
  onTyping,
  onReactMessage,
  voiceConnected = false,
  onToggleVoice,
  voiceStage,
}: Props) {
  const [input, setInput] = useState("")
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null)
  const [showImagePromptModal, setShowImagePromptModal] = useState(false)
  const [imagePromptText, setImagePromptText] = useState("")

  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const typingTimeoutRef = useRef<any>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, typingNames])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    setInput(e.target.value)

    if (onTyping) {
      onTyping(true)
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        onTyping(false)
      }, 2000)
    }
  }

  function handleSend() {
    if (!input.trim()) return
    onSendMessage(input.trim())
    setInput("")
    if (onTyping) onTyping(false)
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
        background: "#0f1115",
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
          background: "#0f1115",
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
                color: "#d5d9e0",
                fontSize: 18,
                cursor: "pointer",
                padding: "4px 8px 4px 0",
              }}
            >
              
            </button>
          )}

          <span style={{ fontSize: 20, color: "#7a8290", fontWeight: 700 }}>
            {channel.type === "radar" ? <Icon name="radar" /> : channel.type === "ai" ? <Icon name="bot" /> : "#"}
          </span>

          <span style={{ fontSize: 16, fontWeight: 700, color: "#eceef2", whiteSpace: "nowrap" }}>
            {channel.name}
          </span>

          {channel.topic && (
            <>
              <div style={{ width: 1, height: 16, background: "rgba(255, 255, 255, 0.12)", margin: "0 6px" }} />
              <span
                style={{
                  fontSize: 13,
                  color: "#9aa1ad",
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
          {/* Voice Lounge Toggle Button */}
          {onToggleVoice && (
            <button
              type="button"
              onClick={onToggleVoice}
              title={voiceConnected ? "Disconnect from Voice Lounge" : "Connect to Voice Lounge"}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "4px 10px",
                borderRadius: 6,
                background: voiceConnected ? "rgba(79,185,135, 0.2)" : "rgba(255, 255, 255, 0.06)",
                border: voiceConnected ? "1px solid #4fb987" : "1px solid rgba(255, 255, 255, 0.12)",
                color: voiceConnected ? "#4fb987" : "#aab1bc",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <span>{voiceConnected ? <Icon name="volume" /> : <Icon name="volumeLow" />}</span>
              <span className="hide-on-mobile">{voiceConnected ? "Connected" : "Join Voice"}</span>
            </button>
          )}

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
                background: "rgba(139,124,246, 0.15)",
                border: "1px solid rgba(139,124,246, 0.35)",
                color: "#b3a8f8",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <span><Icon name="shuffle" /></span>
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
              color: memberListOpen ? "#f4f5f7" : "#aab1bc",
              fontSize: 16,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <Icon name="users" />
          </button>
        </div>
      </header>

      {/* ── Interactive WebRTC Voice Lounge Stage (When in voice channel) ── */}
      {voiceStage}

      {/* ── Voice Banner (If Connected in background while browsing text channel) ── */}
      {voiceConnected && !voiceStage && (
        <div
          style={{
            padding: "8px 16px",
            background: "rgba(79,185,135, 0.1)",
            borderBottom: "1px solid rgba(79,185,135, 0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 12,
            color: "#4fb987",
            fontWeight: 600,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#4fb987", boxShadow: "0 0 8px #4fb987" }} />
            <span>Voice Connected / RTC Latency: 24ms</span>
          </div>
          {onToggleVoice && (
            <button
              type="button"
              onClick={onToggleVoice}
              style={{
                background: "transparent",
                border: "none",
                color: "#ef8a8a",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 11,
              }}
            >
              Disconnect 
            </button>
          )}
        </div>
      )}

      {/* ── 2. Channel Messages Area ──────────────────────────────── */}
      <div
        className="cc-discord-messages-scroll"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px 16px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {/* Welcome Channel Banner */}
        <div style={{ margin: "20px 0 10px", paddingBottom: 20, borderBottom: "1px solid rgba(255, 255, 255, 0.08)" }}>
          <div
            style={{
              width: 68,
              height: 68,
              borderRadius: "50%",
              background: "#161a20",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              color: "#f4f5f7",
              marginBottom: 12,
            }}
          >
            {channel.type === "radar" ? <Icon name="radar" /> : channel.type === "ai" ? <Icon name="bot" /> : "#"}
          </div>
          <h2 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: "#eceef2" }}>
            Welcome to #{channel.name}!
          </h2>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: "#9aa1ad" }}>
            This is the start of the #{channel.name} channel. Chat with fellow members, mention @ai for smart assistance, or test digital replicas!
          </p>
        </div>

        {/* Messages List with Discord clustering & live reactions */}
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
                borderLeft: hasMention ? "2px solid #e0ac4e" : "2px solid transparent",
                transition: "background 0.1s ease",
              }}
            >
              {/* Message Hover Actions Bar with Reaction Emojis */}
              {isHovered && (
                <div
                  style={{
                    position: "absolute",
                    top: -14,
                    right: 12,
                    background: "#161a20",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: 6,
                    padding: "2px 6px",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    zIndex: 20,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                  }}
                >
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => onReactMessage && onReactMessage(msg.id, emoji)}
                      title={`React ${emoji}`}
                      style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 13, padding: "2px" }}
                    >
                      {emoji}
                    </button>
                  ))}

                  <div style={{ width: 1, height: 14, background: "rgba(255,255,255,0.15)", margin: "0 2px" }} />

                  <button
                    type="button"
                    onClick={() => setInput(`@ai Explain this: "${msg.content.slice(0, 50)}"`)}
                    title="Ask AI to Explain"
                    style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 12, padding: "2px 4px", color: T.primary, fontWeight: 700 }}
                  >
                    AI
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
                        background: msg.role === "bot" ? "hsla(226,72%,70%,0.2)" : msg.role === "replica" ? "rgba(139,124,246,0.2)" : "#1e232b",
                        color: msg.role === "bot" ? T.primary : msg.role === "replica" ? "#b3a8f8" : "#d5d9e0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 18,
                        fontWeight: 700,
                      }}
                    >
                      {msg.role === "bot" ? <Icon name="bot" /> : msg.role === "replica" ? <Icon name="twin" /> : <Icon name="user" />}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ width: 40, flexShrink: 0, textAlign: "right", fontSize: 10, color: "#6a7280" }}>
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
                        color: msg.role === "bot" ? T.primary : msg.role === "replica" ? "#b3a8f8" : "#eceef2",
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
                          background: msg.badge === "BOT" ? "#5f73e6" : msg.badge === "REPLICA" ? "#8b7cf6" : "#e0ac4e",
                          color: "#f4f5f7",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {msg.badge}
                      </span>
                    )}

                    <span style={{ fontSize: 11, color: "#9aa1ad" }}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                )}

                {/* Message Text */}
                <div
                  style={{
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: "#d5d9e0",
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

                {/* Live Emoji Reaction Pills */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                    {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                      if (!Array.isArray(userIds) || userIds.length === 0) return null
                      const hasReacted = userIds.includes(session?.user?.id)

                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => onReactMessage && onReactMessage(msg.id, emoji)}
                          style={{
                            background: hasReacted ? "rgba(88, 101, 242, 0.25)" : "#161a20",
                            border: hasReacted ? "1px solid #5f73e6" : "1px solid rgba(255, 255, 255, 0.1)",
                            borderRadius: 6,
                            padding: "2px 6px",
                            fontSize: 12,
                            color: hasReacted ? "#f4f5f7" : "#aab1bc",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            cursor: "pointer",
                          }}
                        >
                          <span>{emoji}</span>
                          <span style={{ fontSize: 11, fontWeight: 700 }}>{userIds.length}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        <div ref={bottomRef} style={{ height: 6 }} />
      </div>

      {/* ── Live Typing Indicator Bar ────────────────────────────── */}
      {typingNames.length > 0 && (
        <div
          style={{
            padding: "0 18px 4px",
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: 11,
            color: "#9aa1ad",
            background: "#0f1115",
          }}
        >
          <span className="typing-dot" style={{ width: 5, height: 5 }} />
          <span className="typing-dot" style={{ width: 5, height: 5 }} />
          <span className="typing-dot" style={{ width: 5, height: 5 }} />
          <span style={{ fontWeight: 600, color: "#eceef2" }}>
            {typingNames.slice(0, 3).join(", ")}
          </span>
          <span>{typingNames.length === 1 ? "is typing..." : "are typing..."}</span>
        </div>
      )}

      {/* ── 3. Discord-Style Rich Input Box ───────────────────────── */}
      <div
        style={{
          padding: "0 16px 18px",
          background: "#0f1115",
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
              color: "#d5d9e0",
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
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`Message #${channel.name} (type @ai to summon AI Co-Pilot)...`}
            style={{
              flex: 1,
              minWidth: 0,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#d5d9e0",
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
              background: input.startsWith("@ai") ? "hsla(226,72%,70%,0.2)" : "transparent",
              border: input.startsWith("@ai") ? `1px solid ${T.primary}` : "1px solid rgba(255,255,255,0.1)",
              color: input.startsWith("@ai") ? T.primary : "#9aa1ad",
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
              {generatingImg ? <Icon name="clock" /> : <Icon name="image" />}
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
              background: input.trim() ? "hsl(226, 72%, 70%)" : "transparent",
              border: "none",
              color: input.trim() ? "#000" : "#7a8290",
              fontSize: 14,
              fontWeight: 800,
              cursor: input.trim() ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background-color 0.15s, border-color 0.15s, color 0.15s, opacity 0.15s, box-shadow 0.15s, transform 0.15s ease",
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
              background: "#161a20",
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
            <h3 style={{ margin: 0, fontSize: 16, color: "#eceef2", fontWeight: 700 }}>
              Generate Image with Gemini AI
            </h3>
            <input
              value={imagePromptText}
              onChange={(e) => setImagePromptText(e.target.value)}
              placeholder="e.g. Cyberpunk city with neon glowing rain..."
              style={{
                padding: "10px 14px",
                background: "#0f1115",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                color: "#eceef2",
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
                  color: "#9aa1ad",
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
                  background: "hsl(226, 72%, 70%)",
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
