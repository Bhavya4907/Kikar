"use client"
import { useState } from "react"
import { T } from "../../styles"
import type { DiscordMember } from "../../lib/discordTypes"

interface Props {
  members: DiscordMember[]
  onStartDM?: (userId: string) => void
  onOpenReplica?: (member: DiscordMember) => void
}

export default function ServerMemberList({
  members,
  onStartDM,
  onOpenReplica,
}: Props) {
  const [selectedMember, setSelectedMember] = useState<DiscordMember | null>(null)

  const onlineHumans = members.filter((m) => m.is_online && !m.is_bot && !m.is_replica)
  const aiBots = members.filter((m) => m.is_bot)
  const digitalTwins = members.filter((m) => m.is_replica)
  const offlineHumans = members.filter((m) => !m.is_online && !m.is_bot && !m.is_replica)

  const renderMember = (m: DiscordMember) => {
    return (
      <div
        key={m.id}
        onClick={() => setSelectedMember(m)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "6px 8px",
          borderRadius: 6,
          cursor: "pointer",
          transition: "background 0.15s ease",
          position: "relative",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.06)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        {/* Avatar with status ring */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          {m.avatar_url ? (
            <img
              src={m.avatar_url}
              alt=""
              style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: m.is_bot ? "hsla(119,99%,46%,0.2)" : m.is_replica ? "rgba(168,85,247,0.2)" : "#2b2d31",
                color: m.is_bot ? T.primary : m.is_replica ? "#c084fc" : "#dbdee1",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {m.is_bot ? "🤖" : m.is_replica ? "🪞" : "👤"}
            </div>
          )}

          <span
            style={{
              position: "absolute",
              bottom: -1,
              right: -1,
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: m.is_online || m.is_bot ? "#22c55e" : "#80848e",
              border: "2px solid #18191c",
            }}
          />
        </div>

        {/* Member Name & Status */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: m.is_bot ? T.primary : m.is_replica ? "#c084fc" : m.role === "owner" ? "#f0b232" : "#dbdee1",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {m.display_name || m.username}
            </span>

            {/* Role Badge */}
            {m.role === "owner" && (
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 800,
                  padding: "1px 4px",
                  borderRadius: 3,
                  background: "#f0b232",
                  color: "#000",
                }}
              >
                👑
              </span>
            )}
            {m.is_bot && (
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 800,
                  padding: "1px 4px",
                  borderRadius: 3,
                  background: "#5865F2",
                  color: "#ffffff",
                }}
              >
                BOT
              </span>
            )}
            {m.is_replica && (
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 800,
                  padding: "1px 4px",
                  borderRadius: 3,
                  background: "#a855f7",
                  color: "#ffffff",
                }}
              >
                REPLICA
              </span>
            )}
          </div>

          {m.status_note && (
            <div
              style={{
                fontSize: 10,
                color: "#80848e",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {m.status_note}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <aside
      className="cc-discord-member-list"
      style={{
        width: 240,
        flexShrink: 0,
        height: "100%",
        background: "#18191c",
        borderLeft: "1px solid rgba(255, 255, 255, 0.06)",
        overflowY: "auto",
        padding: "14px 10px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        userSelect: "none",
        WebkitUserSelect: "none",
        position: "relative",
      }}
    >
      {/* 1. Online Humans */}
      {onlineHumans.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#949ba4", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 6px 6px" }}>
            Online — {onlineHumans.length}
          </div>
          {onlineHumans.map(renderMember)}
        </div>
      )}

      {/* 2. AI Bot Citizens */}
      {aiBots.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#949ba4", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 6px 6px" }}>
            🤖 AI Citizens — {aiBots.length}
          </div>
          {aiBots.map(renderMember)}
        </div>
      )}

      {/* 3. Digital Twins (Offline Replicas) */}
      {digitalTwins.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#949ba4", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 6px 6px" }}>
            🪞 Digital Twins — {digitalTwins.length}
          </div>
          {digitalTwins.map(renderMember)}
        </div>
      )}

      {/* 4. Offline Humans */}
      {offlineHumans.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#949ba4", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 6px 6px" }}>
            Offline — {offlineHumans.length}
          </div>
          {offlineHumans.map(renderMember)}
        </div>
      )}

      {/* ── Discord Popout Mini Profile Card ─────────────────────── */}
      {selectedMember && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={() => setSelectedMember(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#232428",
              borderRadius: 16,
              width: "100%",
              maxWidth: 340,
              overflow: "hidden",
              boxShadow: "0 16px 40px rgba(0,0,0,0.7)",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            {/* Top Color Banner */}
            <div
              style={{
                height: 80,
                background: selectedMember.is_bot
                  ? "linear-gradient(135deg, hsl(119,99%,46%), #15803d)"
                  : selectedMember.is_replica
                  ? "linear-gradient(135deg, #a855f7, #6b21a8)"
                  : "linear-gradient(135deg, #5865F2, #3b428a)",
              }}
            />

            {/* Avatar & Info */}
            <div style={{ padding: "0 16px 16px", position: "relative" }}>
              <div
                style={{
                  position: "relative",
                  top: -30,
                  width: 68,
                  height: 68,
                  borderRadius: "50%",
                  border: "5px solid #232428",
                  background: "#1e1f22",
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 28,
                }}
              >
                {selectedMember.avatar_url ? (
                  <img src={selectedMember.avatar_url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span>{selectedMember.is_bot ? "🤖" : selectedMember.is_replica ? "🪞" : "👤"}</span>
                )}
              </div>

              <div style={{ marginTop: -20, marginBottom: 12 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#f2f3f5" }}>
                  {selectedMember.display_name || selectedMember.username}
                </div>
                <div style={{ fontSize: 13, color: "#949ba4" }}>@{selectedMember.username}</div>
              </div>

              {selectedMember.status_note && (
                <div
                  style={{
                    background: "#111214",
                    padding: "8px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "#dbdee1",
                    marginBottom: 14,
                  }}
                >
                  💭 {selectedMember.status_note}
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {onStartDM && !selectedMember.is_bot && (
                  <button
                    type="button"
                    onClick={() => {
                      onStartDM(selectedMember.id)
                      setSelectedMember(null)
                    }}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: 8,
                      background: "hsl(119, 99%, 46%)",
                      border: "none",
                      color: "#000",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <span>💬</span>
                    <span>Send Direct Message</span>
                  </button>
                )}

                {onOpenReplica && selectedMember.is_replica && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenReplica(selectedMember)
                      setSelectedMember(null)
                    }}
                    style={{
                      width: "100%",
                      padding: "10px",
                      borderRadius: 8,
                      background: "rgba(168, 85, 247, 0.2)",
                      border: "1px solid rgba(168, 85, 247, 0.4)",
                      color: "#c084fc",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <span>🪞</span>
                    <span>Chat with Digital Twin</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </aside>
  )
}
