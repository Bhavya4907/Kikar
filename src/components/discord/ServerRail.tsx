"use client"
import { useState } from "react"
import { T } from "../../styles"
import type { DiscordServer } from "../../lib/discordTypes"

interface Props {
  servers: DiscordServer[]
  activeServerId: string | null // null = Home / Direct Messages
  onSelectServer: (serverId: string | null) => void
  onOpenCreateServer: () => void
  onOpenRadar: () => void
  unreadDMsCount?: number
}

export default function ServerRail({
  servers,
  activeServerId,
  onSelectServer,
  onOpenCreateServer,
  onOpenRadar,
  unreadDMsCount = 0,
}: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  const isHomeActive = activeServerId === null

  return (
    <aside
      className="cc-discord-server-rail"
      style={{
        width: 72,
        flexShrink: 0,
        height: "100%",
        background: "#111215",
        borderRight: "1px solid rgba(255, 255, 255, 0.06)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "12px 0",
        gap: 8,
        overflowY: "auto",
        scrollbarWidth: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        zIndex: 30,
      }}
    >
      {/* ── 1. Home / Direct Messages Icon ───────────────────────── */}
      <div
        style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}
        onMouseEnter={() => setHoveredId("home")}
        onMouseLeave={() => setHoveredId(null)}
      >
        {/* Left Pill Indicator */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            width: 4,
            height: isHomeActive ? 40 : hoveredId === "home" ? 20 : 0,
            borderRadius: "0 4px 4px 0",
            background: "#ffffff",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            opacity: isHomeActive || hoveredId === "home" ? 1 : 0,
          }}
        />

        <button
          type="button"
          onClick={() => onSelectServer(null)}
          title="Direct Messages & Fellows"
          style={{
            width: 48,
            height: 48,
            borderRadius: isHomeActive || hoveredId === "home" ? 16 : 24,
            background: isHomeActive
              ? "linear-gradient(135deg, hsl(119,99%,46%), hsl(119,99%,36%))"
              : "rgba(255, 255, 255, 0.08)",
            color: isHomeActive ? "#050505" : "#dbdee1",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            fontWeight: 800,
            cursor: "pointer",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: isHomeActive ? "0 4px 16px hsla(119,99%,46%,0.35)" : "none",
            position: "relative",
          }}
        >
          <span>✦</span>

          {/* Unread badge */}
          {unreadDMsCount > 0 && (
            <span
              style={{
                position: "absolute",
                bottom: -2,
                right: -2,
                background: "#f23f43",
                color: "#ffffff",
                fontSize: 10,
                fontWeight: 800,
                padding: "2px 5px",
                borderRadius: 999,
                border: "2px solid #111215",
              }}
            >
              {unreadDMsCount}
            </span>
          )}
        </button>
      </div>

      {/* Divider */}
      <div
        style={{
          width: 32,
          height: 2,
          borderRadius: 1,
          background: "rgba(255, 255, 255, 0.08)",
          margin: "4px 0",
        }}
      />

      {/* ── 2. Server List ───────────────────────────────────────── */}
      {servers.map((server) => {
        const isActive = activeServerId === server.id
        const isHovered = hoveredId === server.id

        return (
          <div
            key={server.id}
            style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}
            onMouseEnter={() => setHoveredId(server.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {/* Left Pill Indicator */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: "50%",
                transform: "translateY(-50%)",
                width: 4,
                height: isActive ? 40 : isHovered ? 20 : 0,
                borderRadius: "0 4px 4px 0",
                background: "#ffffff",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                opacity: isActive || isHovered ? 1 : 0,
              }}
            />

            <button
              type="button"
              onClick={() => onSelectServer(server.id)}
              title={server.name}
              style={{
                width: 48,
                height: 48,
                borderRadius: isActive || isHovered ? 16 : 24,
                background: isActive
                  ? "hsl(119, 99%, 46%)"
                  : isHovered
                  ? "rgba(255, 255, 255, 0.16)"
                  : "rgba(255, 255, 255, 0.08)",
                color: isActive ? "#050505" : "#dbdee1",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 18,
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                position: "relative",
              }}
            >
              {server.icon ? (
                server.icon.startsWith("http") ? (
                  <img
                    src={server.icon}
                    alt={server.name}
                    style={{ width: "100%", height: "100%", borderRadius: "inherit", objectFit: "cover" }}
                  />
                ) : (
                  <span>{server.icon}</span>
                )
              ) : (
                server.name
                  .split(" ")
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 3)
                  .toUpperCase()
              )}

              {/* Mentions badge */}
              {(server.unreadMentions ?? 0) > 0 && (
                <span
                  style={{
                    position: "absolute",
                    bottom: -2,
                    right: -2,
                    background: "#f23f43",
                    color: "#ffffff",
                    fontSize: 10,
                    fontWeight: 800,
                    padding: "2px 5px",
                    borderRadius: 999,
                    border: "2px solid #111215",
                  }}
                >
                  {server.unreadMentions}
                </span>
              )}
            </button>
          </div>
        )
      })}

      {/* ── 3. Add a Server Button ───────────────────────────────── */}
      <div
        style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}
        onMouseEnter={() => setHoveredId("add")}
        onMouseLeave={() => setHoveredId(null)}
      >
        <button
          type="button"
          onClick={onOpenCreateServer}
          title="Create a Server"
          style={{
            width: 48,
            height: 48,
            borderRadius: hoveredId === "add" ? 16 : 24,
            background: hoveredId === "add" ? "hsl(119, 99%, 46%)" : "rgba(255, 255, 255, 0.06)",
            color: hoveredId === "add" ? "#050505" : "#23a55a",
            border: "1px dashed rgba(255, 255, 255, 0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          +
        </button>
      </div>

      {/* ── 4. Radar Lounge Matchmaker Shortcut ──────────────────── */}
      <div
        style={{ position: "relative", width: "100%", display: "flex", justifyContent: "center" }}
        onMouseEnter={() => setHoveredId("radar")}
        onMouseLeave={() => setHoveredId(null)}
      >
        <button
          type="button"
          onClick={onOpenRadar}
          title="Radar Speed Matchmaker"
          style={{
            width: 48,
            height: 48,
            borderRadius: hoveredId === "radar" ? 16 : 24,
            background: hoveredId === "radar" ? "rgba(56,189,248,0.25)" : "rgba(56,189,248,0.12)",
            color: "#38bdf8",
            border: "1px solid rgba(56,189,248,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            cursor: "pointer",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
            boxShadow: hoveredId === "radar" ? "0 0 12px rgba(56,189,248,0.4)" : "none",
          }}
        >
          ⚡
        </button>
      </div>
    </aside>
  )
}
