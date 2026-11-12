"use client"
import { useState } from "react"
import { T } from "../../styles"
import type { DiscordMember } from "../../lib/discordTypes"
import { Icon } from "../Icons"

interface Props {
  members: DiscordMember[]
  onStartDM?: (userId: string) => void
  onOpenReplica?: (member: DiscordMember) => void
  voiceConnected?: boolean
}

export default function ServerMemberList({
  members,
  onStartDM,
  onOpenReplica,
  voiceConnected = false,
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
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                objectFit: "cover",
                outline: voiceConnected && m.role === "owner" ? "2px solid #4fb987" : "none",
                outlineOffset: 2,
              }}
            />
          ) : (
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                background: m.is_bot ? "hsla(226,72%,70%,0.2)" : m.is_replica ? "rgba(139,124,246,0.2)" : "#161a20",
                color: m.is_bot ? T.primary : m.is_replica ? "#b3a8f8" : "#d5d9e0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 700,
                outline: voiceConnected && m.role === "owner" ? "2px solid #4fb987" : "none",
                outlineOffset: 2,
              }}
            >
              {m.is_bot ? <Icon name="bot" /> : m.is_replica ? <Icon name="twin" /> : <Icon name="user" />}
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
              background: voiceConnected && m.role === "owner" ? "#4fb987" : m.is_online || m.is_bot ? "#4fb987" : "#7a8290",
              border: "2px solid #12151a",
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
                color: m.is_bot ? T.primary : m.is_replica ? "#b3a8f8" : m.role === "owner" ? "#e0ac4e" : "#d5d9e0",
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
                  background: "#e0ac4e",
                  color: "#000",
                }}
              >
                <Icon name="crown" />
              </span>
            )}
            {m.is_bot && (
              <span
                style={{
                  fontSize: 8,
                  fontWeight: 800,
                  padding: "1px 4px",
                  borderRadius: 3,
                  background: "#5f73e6",
                  color: "#f4f5f7",
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
                  background: "#8b7cf6",
                  color: "#f4f5f7",
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
                color: "#7a8290",
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
        background: "#12151a",
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
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9aa1ad", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 6px 6px" }}>
            Online — {onlineHumans.length}
          </div>
          {onlineHumans.map(renderMember)}
        </div>
      )}

      {/* 2. AI Bot Citizens */}
      {aiBots.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9aa1ad", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 6px 6px" }}>
            AI Citizens — {aiBots.length}
          </div>
          {aiBots.map(renderMember)}
        </div>
      )}

      {/* 3. Digital Twins (Offline Replicas) */}
      {digitalTwins.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9aa1ad", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 6px 6px" }}>
            Digital Twins — {digitalTwins.length}
          </div>
          {digitalTwins.map(renderMember)}
        </div>
      )}

      {/* 4. Offline Humans */}
      {offlineHumans.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#9aa1ad", textTransform: "uppercase", letterSpacing: "0.06em", padding: "0 6px 6px" }}>
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
              background: "#1a1e25",
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
                  ? "linear-gradient(135deg, hsl(226,72%,70%), #2f7d5a)"
                  : selectedMember.is_replica
                  ? "linear-gradient(135deg, #8b7cf6, #4b3fa8)"
                  : "linear-gradient(135deg, #5f73e6, #3b428a)",
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
                  border: "5px solid #1a1e25",
                  background: "#0f1115",
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
                  <span>{selectedMember.is_bot ? <Icon name="bot" /> : selectedMember.is_replica ? <Icon name="twin" /> : <Icon name="user" />}</span>
                )}
              </div>

              <div style={{ marginTop: -20, marginBottom: 12 }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: "#eceef2" }}>
                  {selectedMember.display_name || selectedMember.username}
                </div>
                <div style={{ fontSize: 13, color: "#9aa1ad" }}>@{selectedMember.username}</div>
              </div>

              {selectedMember.status_note && (
                <div
                  style={{
                    background: "#0b0d11",
                    padding: "8px 12px",
                    borderRadius: 8,
                    fontSize: 12,
                    color: "#d5d9e0",
                    marginBottom: 14,
                  }}
                >
                  {selectedMember.status_note}
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
                      background: "hsl(226, 72%, 70%)",
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
                    <span><Icon name="chat" /></span>
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
                      background: "rgba(139,124,246, 0.2)",
                      border: "1px solid rgba(139,124,246, 0.4)",
                      color: "#b3a8f8",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <span><Icon name="twin" /></span>
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
