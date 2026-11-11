"use client"
import { useState } from "react"
import { T } from "../../styles"
import type { DiscordServer } from "../../lib/discordTypes"

interface Props {
  onClose: () => void
  onCreateServer: (newServer: DiscordServer) => void
  userId: string
}

const TEMPLATES = [
  { id: "gaming", name: "Gaming & Banter", icon: "🎮", channels: ["general", "clip-sharing", "ai-wingman"] },
  { id: "ai", name: "AI Lab & Replicas", icon: "🤖", channels: ["general", "bot-sparring", "replica-showcase"] },
  { id: "study", name: "Study & Coding", icon: "📚", channels: ["general", "code-review", "mentor-bot"] },
  { id: "lounge", name: "Late Night Lounge", icon: "🌙", channels: ["general", "2am-thoughts", "random-lounge"] },
]

export default function CreateServerModal({ onClose, onCreateServer, userId }: Props) {
  const [serverName, setServerName] = useState("")
  const [selectedIcon, setSelectedIcon] = useState("🚀")
  const [selectedTemplate, setSelectedTemplate] = useState("gaming")

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!serverName.trim()) return

    const template = TEMPLATES.find((t) => t.id === selectedTemplate) || TEMPLATES[0]
    const serverId = `server-${Date.now()}`

    const newServer: DiscordServer = {
      id: serverId,
      name: serverName.trim(),
      icon: selectedIcon,
      ownerId: userId,
      description: `Welcome to ${serverName.trim()}!`,
      channels: template.channels.map((chName, idx) => ({
        id: `ch-${serverId}-${idx}`,
        serverId,
        name: chName,
        type: chName.includes("ai") || chName.includes("bot") ? "ai" : chName.includes("lounge") ? "radar" : "text",
        topic: `Discussion channel for #${chName}`,
      })),
    }

    onCreateServer(newServer)
    onClose()
  }

  const ICONS = ["🚀", "🎮", "🤖", "🌙", "🔥", "⚡", "🧠", "✨", "☕", "🏆"]

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(8px)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#313338",
          borderRadius: 16,
          maxWidth: 440,
          width: "100%",
          padding: "24px 22px",
          boxShadow: "0 16px 48px rgba(0,0,0,0.8)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#f2f3f5" }}>Create Your Server</h2>
          <p style={{ margin: "6px 0 0", fontSize: 13, color: "#949ba4" }}>
            Your server is where you, your friends, and your AI personas can hang out.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Pick Emoji Icon */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#b5bac1", textTransform: "uppercase" }}>
              SERVER ICON
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              {ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setSelectedIcon(icon)}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 10,
                    background: selectedIcon === icon ? "hsl(119, 99%, 46%)" : "#2b2d31",
                    border: selectedIcon === icon ? "2px solid #ffffff" : "1px solid rgba(255,255,255,0.08)",
                    fontSize: 18,
                    cursor: "pointer",
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Server Name Input */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#b5bac1", textTransform: "uppercase" }}>
              SERVER NAME
            </label>
            <input
              value={serverName}
              onChange={(e) => setServerName(e.target.value)}
              placeholder="e.g. The 2AM Club"
              required
              style={{
                width: "100%",
                marginTop: 6,
                padding: "10px 14px",
                background: "#1e1f22",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 8,
                color: "#f2f3f5",
                fontSize: 14,
                outline: "none",
                fontFamily: T.font,
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Template Choice */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#b5bac1", textTransform: "uppercase" }}>
              CHOOSE A TEMPLATE
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 6 }}>
              {TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  type="button"
                  onClick={() => {
                    setSelectedTemplate(tmpl.id)
                    setSelectedIcon(tmpl.icon)
                  }}
                  style={{
                    padding: "10px",
                    borderRadius: 8,
                    background: selectedTemplate === tmpl.id ? "rgba(168, 85, 247, 0.2)" : "#2b2d31",
                    border: selectedTemplate === tmpl.id ? "1.5px solid #a855f7" : "1px solid rgba(255,255,255,0.06)",
                    color: selectedTemplate === tmpl.id ? "#ffffff" : "#dbdee1",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 16 }}>{tmpl.icon}</span>
                  <span>{tmpl.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Footer buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "#dbdee1",
                fontSize: 14,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!serverName.trim()}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                background: "hsl(119, 99%, 46%)",
                border: "none",
                color: "#000",
                fontSize: 14,
                fontWeight: 700,
                cursor: serverName.trim() ? "pointer" : "not-allowed",
                opacity: serverName.trim() ? 1 : 0.5,
              }}
            >
              Create Server
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
