"use client"
import { useState, useMemo } from "react"
import { T } from "../../styles"
import { Icon } from "../Icons"

interface Props {
  isOpen: boolean
  onClose: () => void
  characters: any[]
  onSelectBot: (bot: any, mode: "call" | "mention") => void
  channelOrPeerName?: string
}

export default function SummonBotModal({
  isOpen,
  onClose,
  characters = [],
  onSelectBot,
  channelOrPeerName = "this chat",
}: Props) {
  const [search, setSearch] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")

  const categories = [
    { id: "all", label: "🌟 All Bots" },
    { id: "general", label: "🤝 Companions" },
    { id: "mentor", label: "📚 Mentors" },
    { id: "roleplay", label: "🎭 Roleplay" },
    { id: "replica", label: "🪞 Replicas" },
  ]

  const filteredBots = useMemo(() => {
    return (characters || []).filter((c) => {
      if (!c || !c.name) return false
      const nameMatch = c.name.toLowerCase().includes(search.toLowerCase())
      const promptMatch = (c.system_prompt || c.prompt || "").toLowerCase().includes(search.toLowerCase())
      const matchesSearch = !search.trim() || nameMatch || promptMatch

      if (!matchesSearch) return false

      if (selectedCategory === "all") return true
      if (selectedCategory === "replica") return !!c.is_replica
      const prompt = (c.system_prompt || "").toLowerCase()
      if (selectedCategory === "mentor") return prompt.includes("mentor") || prompt.includes("code") || prompt.includes("study")
      if (selectedCategory === "roleplay") return prompt.includes("roleplay") || prompt.includes("story")
      if (selectedCategory === "general") return !c.is_replica && !prompt.includes("mentor")
      return true
    })
  }, [characters, search, selectedCategory])

  if (!isOpen) return null

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 580,
          maxHeight: "85vh",
          background: "#161a20",
          border: `1px solid ${T.border}`,
          borderRadius: 14,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 12px 40px rgba(0, 0, 0, 0.6)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: `1px solid ${T.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#0f1115",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 22 }}>🤖</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: T.text }}>
                Summon an AI Bot or Persona
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: T.muted }}>
                Call any custom bot created by any user into {channelOrPeerName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: T.muted,
              fontSize: 18,
              cursor: "pointer",
              padding: "4px 8px",
              borderRadius: 6,
            }}
          >
            ✕
          </button>
        </div>

        {/* Search & Categories Bar */}
        <div style={{ padding: "12px 20px", borderBottom: `1px solid ${T.border}`, background: "#161a20" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#0f1115",
              padding: "8px 12px",
              borderRadius: 8,
              border: `1px solid ${T.border}`,
              marginBottom: 10,
            }}
          >
            <Icon name="search" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search custom bots by name or skill..."
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: T.text,
                fontSize: 13,
                fontFamily: T.font,
              }}
              autoFocus
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                style={{ background: "transparent", border: "none", color: T.muted, cursor: "pointer", fontSize: 12 }}
              >
                Clear
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 999,
                  border: selectedCategory === cat.id ? `1px solid ${T.primary}` : `1px solid ${T.border}`,
                  background: selectedCategory === cat.id ? "hsla(226, 72%, 70%, 0.15)" : "#0f1115",
                  color: selectedCategory === cat.id ? T.primary : T.muted,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Bot Cards List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {filteredBots.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "30px 10px",
                color: T.muted,
                fontSize: 13,
              }}
            >
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              No custom bots found matching "{search}".
              <br />
              <span style={{ fontSize: 12, color: T.muted2 }}>
                Try searching for another name or build a new bot in the Persona Creator!
              </span>
            </div>
          ) : (
            filteredBots.map((bot) => {
              const isRep = !!bot.is_replica
              const botEmoji = bot.emoji || (isRep ? "🪞" : "🤖")
              const cleanBio = (bot.system_prompt || bot.prompt || "")
                .replace(/^\[Category:.*?\]\s*/i, "")
                .replace(/^You are .*?\.\s*/i, "")
                .slice(0, 110)

              return (
                <div
                  key={bot.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "12px 14px",
                    background: "#0f1115",
                    border: `1px solid ${T.border}`,
                    borderRadius: 10,
                    gap: 12,
                    transition: "border 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 10,
                        background: isRep ? "rgba(139,124,246,0.15)" : "hsla(226,72%,70%,0.15)",
                        border: isRep ? "1px solid rgba(139,124,246,0.3)" : `1px solid ${T.border}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 22,
                        flexShrink: 0,
                      }}
                    >
                      {botEmoji}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
                        <span style={{ fontWeight: 700, fontSize: 14, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {bot.name}
                        </span>
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: 4,
                            background: isRep ? "rgba(139,124,246,0.2)" : "hsla(226,72%,70%,0.2)",
                            color: isRep ? "#b3a8f8" : T.primary,
                          }}
                        >
                          {isRep ? "REPLICA" : "BOT"}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          color: T.muted,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cleanBio ? cleanBio + "…" : "Custom AI companion ready to chat."}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectBot(bot, "mention")
                        onClose()
                      }}
                      title={`Mention @${bot.name}`}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        background: "rgba(255, 255, 255, 0.06)",
                        border: `1px solid ${T.border}`,
                        color: T.text,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      @{bot.name.toLowerCase().replace(/\s+/g, "_")}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onSelectBot(bot, "call")
                        onClose()
                      }}
                      title="Call bot into this chat immediately"
                      style={{
                        padding: "6px 12px",
                        borderRadius: 6,
                        background: "linear-gradient(135deg, hsl(226,72%,70%), hsl(226,62%,58%))",
                        border: "none",
                        color: "#0f1115",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Call Now
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: `1px solid ${T.border}`,
            background: "#0f1115",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 12,
            color: T.muted,
          }}
        >
          <span>Tip: You can also type <code>@{`<bot_name>`}</code> in any message.</span>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "6px 14px",
              background: "transparent",
              border: `1px solid ${T.border}`,
              borderRadius: 6,
              color: T.text,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
