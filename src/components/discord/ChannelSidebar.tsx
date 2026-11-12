"use client"
import { useState } from "react"
import { T } from "../../styles"
import type { DiscordServer, DiscordChannel } from "../../lib/discordTypes"
import { Icon } from "../Icons"

interface Props {
  activeServer: DiscordServer | null
  activeChannelId: string | null
  onSelectChannel: (channelId: string) => void
  homeSubView: "fellows" | "radar" | "personas" | "dm"
  onSelectHomeSubView: (view: "fellows" | "radar" | "personas") => void
  conversations: any[]
  activeConvo: any
  onOpenConvo: (convo: any) => void
  allProfiles: any[]
  session: any
  profile: any
  onOpenProfile: () => void
  onOpenPricing?: () => void
  onCreateChannel?: (serverId: string) => void
  onOpenCreateDM?: () => void
  onOpenCreatePersona?: () => void
  voiceConnected?: boolean
  onToggleVoice?: () => void
  micMuted?: boolean
  deafened?: boolean
  onToggleMic?: () => void
  onToggleDeafen?: () => void
  voiceChannelName?: string
  voicePeersCount?: number
}

export default function ChannelSidebar({
  activeServer,
  activeChannelId,
  onSelectChannel,
  homeSubView,
  onSelectHomeSubView,
  conversations,
  activeConvo,
  onOpenConvo,
  allProfiles,
  session,
  profile,
  onOpenProfile,
  onOpenPricing,
  onCreateChannel,
  onOpenCreateDM,
  onOpenCreatePersona,
  voiceConnected = false,
  onToggleVoice,
  micMuted: propMicMuted,
  deafened: propDeafened,
  onToggleMic,
  onToggleDeafen,
  voiceChannelName,
  voicePeersCount = 0,
}: Props) {
  const [localMicMuted, setLocalMicMuted] = useState(false)
  const [localHeadphonesMuted, setLocalHeadphonesMuted] = useState(false)
  const micMuted = propMicMuted !== undefined ? propMicMuted : localMicMuted
  const headphonesMuted = propDeafened !== undefined ? propDeafened : localHeadphonesMuted
  const [serverDropdownOpen, setServerDropdownOpen] = useState(false)
  const [searchFilter, setSearchFilter] = useState("")

  const myName = profile?.display_name || profile?.username || session?.user?.email?.split("@")[0] || "User"

  const onlineFellowsCount = (allProfiles || []).filter((p) => p.is_online).length

  return (
    <div
      className="cc-discord-channel-sidebar"
      style={{
        width: 240,
        flexShrink: 0,
        height: "100%",
        background: "#12151a",
        borderRight: "1px solid rgba(255, 255, 255, 0.06)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        userSelect: "none",
        WebkitUserSelect: "none",
        zIndex: 25,
      }}
    >
      {/* ── 1. Top Header ─────────────────────────────────────────── */}
      {activeServer ? (
        /* Inside a Server Header */
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setServerDropdownOpen((v) => !v)}
            style={{
              width: "100%",
              height: 48,
              padding: "0 16px",
              background: "transparent",
              border: "none",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              color: "#eceef2",
              fontWeight: 700,
              fontSize: 15,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              cursor: "pointer",
              transition: "background 0.15s ease",
            }}
          >
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {activeServer.name}
            </span>
            <span style={{ fontSize: 13, color: "#9aa1ad", transform: serverDropdownOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
              
            </span>
          </button>

          {/* Server dropdown menu */}
          {serverDropdownOpen && (
            <div
              style={{
                position: "absolute",
                top: 50,
                left: 8,
                right: 8,
                background: "#0b0d11",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                borderRadius: 8,
                padding: 6,
                zIndex: 100,
                boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              {onCreateChannel && (
                <button
                  type="button"
                  onClick={() => {
                    setServerDropdownOpen(false)
                    onCreateChannel(activeServer.id)
                  }}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 4,
                    background: "transparent",
                    border: "none",
                    color: "#9aa1ad",
                    fontSize: 13,
                    textAlign: "left",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "hsl(226, 72%, 70%)"
                    e.currentTarget.style.color = "#000"
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent"
                    e.currentTarget.style.color = "#9aa1ad"
                  }}
                >
                  <span>Create Channel</span>
                  <span><Icon name="plus" /></span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setServerDropdownOpen(false)
                  if (onOpenPricing) onOpenPricing()
                }}
                style={{
                  padding: "8px 10px",
                  borderRadius: 4,
                  background: "transparent",
                  border: "none",
                  color: "#b3a8f8",
                  fontSize: 13,
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span>Server Boost / Plus</span>
                <span><Icon name="radar" /></span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Home / Direct Messages Search Bar */
        <div
          style={{
            height: 48,
            padding: "0 10px",
            display: "flex",
            alignItems: "center",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: "100%",
              height: 30,
              background: "#0b0d11",
              borderRadius: 6,
              display: "flex",
              alignItems: "center",
              padding: "0 8px",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 12, color: "#9aa1ad" }}><Icon name="search" /></span>
            <input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Find or start a conversation"
              style={{
                width: "100%",
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#d5d9e0",
                fontSize: 12,
                fontFamily: T.font,
              }}
            />
            {searchFilter && (
              <button
                type="button"
                onClick={() => setSearchFilter("")}
                style={{ background: "transparent", border: "none", color: "#9aa1ad", cursor: "pointer", fontSize: 11 }}
              >
                
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── 2. Channels or DMs Navigation List ───────────────────── */}
      <div
        className="cc-discord-channel-list"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "10px 8px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {activeServer ? (
          /* ── Server Channels View ─────────────────────────────── */
          <>
            {/* Category: Text Channels */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 6px 4px",
                color: "#9aa1ad",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              <span>Text Channels</span>
              {onCreateChannel && (
                <button
                  type="button"
                  onClick={() => onCreateChannel(activeServer.id)}
                  title="Create Channel"
                  style={{ background: "transparent", border: "none", color: "#9aa1ad", cursor: "pointer", fontSize: 13 }}
                >
                  +
                </button>
              )}
            </div>

            {activeServer.channels
              .filter((c) => c.type === "text" || !c.type)
              .map((channel) => {
                const isActive = activeChannelId === channel.id
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => onSelectChannel(channel.id)}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "none",
                      background: isActive ? "rgba(255, 255, 255, 0.12)" : "transparent",
                      color: isActive ? "#f4f5f7" : "#9aa1ad",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 14,
                      fontWeight: isActive ? 600 : 500,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background-color 0.15s, border-color 0.15s, color 0.15s, opacity 0.15s, box-shadow 0.15s, transform 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"
                        e.currentTarget.style.color = "#d5d9e0"
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = "transparent"
                        e.currentTarget.style.color = "#9aa1ad"
                      }
                    }}
                  >
                    <span style={{ fontSize: 16, color: isActive ? "#f4f5f7" : "#7a8290" }}>#</span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {channel.name}
                    </span>
                  </button>
                )
              })}

            {/* Category: Voice Lounges */}
            {activeServer.channels.some((c) => c.type === "voice") && (
              <>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "16px 6px 4px",
                    color: "#9aa1ad",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  <span>Voice Lounges</span>
                </div>

                {activeServer.channels
                  .filter((c) => c.type === "voice")
                  .map((channel) => {
                    const isActive = activeChannelId === channel.id
                    return (
                      <button
                        key={channel.id}
                        type="button"
                        onClick={() => {
                          onSelectChannel(channel.id)
                          if (!voiceConnected && onToggleVoice) {
                            onToggleVoice()
                          }
                        }}
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          borderRadius: 6,
                          border: "none",
                          background: isActive
                            ? "rgba(79,185,135, 0.15)"
                            : "transparent",
                          color: isActive ? "#4fb987" : "#9aa1ad",
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontSize: 14,
                          fontWeight: isActive ? 600 : 500,
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "background-color 0.15s, border-color 0.15s, color 0.15s, opacity 0.15s, box-shadow 0.15s, transform 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"
                            e.currentTarget.style.color = "#d5d9e0"
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = "transparent"
                            e.currentTarget.style.color = "#9aa1ad"
                          }
                        }}
                      >
                        <span style={{ fontSize: 15 }}><Icon name="volume" /></span>
                        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {channel.name}
                        </span>
                        {voiceConnected && isActive && (
                          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4fb987", boxShadow: "0 0 6px #4fb987" }} />
                        )}
                      </button>
                    )
                  })}
              </>
            )}

            {/* Category: AI & Bot Arenas */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 6px 4px",
                color: "#9aa1ad",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              <span>AI Bot Arenas</span>
              {onOpenCreatePersona && (
                <button
                  type="button"
                  onClick={onOpenCreatePersona}
                  title="Create New AI Persona"
                  style={{ background: "transparent", border: "none", color: "#9aa1ad", cursor: "pointer", fontSize: 13 }}
                >
                  +
                </button>
              )}
            </div>

            {activeServer.channels
              .filter((c) => c.type === "ai" || c.type === "radar")
              .map((channel) => {
                const isActive = activeChannelId === channel.id
                return (
                  <button
                    key={channel.id}
                    type="button"
                    onClick={() => onSelectChannel(channel.id)}
                    style={{
                      width: "100%",
                      padding: "6px 8px",
                      borderRadius: 6,
                      border: "none",
                      background: isActive ? "rgba(139,124,246, 0.18)" : "transparent",
                      color: isActive ? "#b3a8f8" : "#9aa1ad",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 14,
                      fontWeight: isActive ? 600 : 500,
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background-color 0.15s, border-color 0.15s, color 0.15s, opacity 0.15s, box-shadow 0.15s, transform 0.15s ease",
                    }}
                  >
                    <span style={{ fontSize: 15 }}>{channel.type === "radar" ? <Icon name="radar" /> : <Icon name="bot" />}</span>
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {channel.name}
                    </span>
                  </button>
                )
              })}
          </>
        ) : (
          /* ── Home / Direct Messages View ──────────────────────── */
          <>
            {/* Top Navigation Shortcuts */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 12 }}>
              <button
                type="button"
                onClick={() => onSelectHomeSubView("fellows")}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: homeSubView === "fellows" && !activeConvo ? "rgba(255, 255, 255, 0.12)" : "transparent",
                  color: homeSubView === "fellows" && !activeConvo ? "#f4f5f7" : "#9aa1ad",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: 16 }}><Icon name="users" /></span>
                <span style={{ flex: 1 }}>Fellows Directory</span>
                {onlineFellowsCount > 0 && (
                  <span
                    style={{
                      background: "#4fb987",
                      color: "#000",
                      fontSize: 10,
                      fontWeight: 800,
                      padding: "1px 6px",
                      borderRadius: 999,
                    }}
                  >
                    {onlineFellowsCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onSelectHomeSubView("radar")}
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: 6,
                  border: "none",
                  background: homeSubView === "radar" && !activeConvo ? "rgba(56, 189, 248, 0.18)" : "transparent",
                  color: homeSubView === "radar" && !activeConvo ? "#62b5d9" : "#9aa1ad",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ fontSize: 16 }}><Icon name="radar" /></span>
                <span style={{ flex: 1 }}>Radar Matchmaker</span>
              </button>

              <div style={{ display: "flex", alignItems: "center", width: "100%", gap: 4 }}>
                <button
                  type="button"
                  onClick={() => onSelectHomeSubView("personas")}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: "none",
                    background: homeSubView === "personas" && !activeConvo ? "hsla(226, 72%, 70%, 0.15)" : "transparent",
                    color: homeSubView === "personas" && !activeConvo ? T.primary : "#9aa1ad",
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span style={{ fontSize: 16 }}><Icon name="bot" /></span>
                  <span style={{ flex: 1 }}>AI Persona Gallery</span>
                </button>
                {onOpenCreatePersona && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenCreatePersona()
                    }}
                    title="Create AI Persona"
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: "rgba(255, 255, 255, 0.06)",
                      border: "none",
                      color: "#9aa1ad",
                      fontSize: 14,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    +
                  </button>
                )}
              </div>
            </div>

            {/* Direct Messages Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 6px 4px",
                color: "#9aa1ad",
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              <span>Direct Messages</span>
              {onOpenCreateDM && (
                <button
                  type="button"
                  onClick={onOpenCreateDM}
                  title="Create DM"
                  style={{ background: "transparent", border: "none", color: "#9aa1ad", cursor: "pointer", fontSize: 13 }}
                >
                  +
                </button>
              )}
            </div>

            {/* Direct Messages List */}
            {conversations.length === 0 ? (
              <div style={{ padding: "16px 8px", fontSize: 12, color: "#6a7280", textAlign: "center" }}>
                No active DMs yet.<br />Meet people via Fellows or Radar!
              </div>
            ) : (
              conversations
                .filter((convo) => {
                  if (!searchFilter) return true
                  const other = convo.user1_id === session?.user?.id ? convo.user2 : convo.user1
                  const name = (other?.display_name || other?.username || "").toLowerCase()
                  return name.includes(searchFilter.toLowerCase())
                })
                .map((convo) => {
                  const other = convo.user1_id === session?.user?.id ? convo.user2 : convo.user1
                  const otherProfile = (allProfiles || []).find((p) => p.id === other?.id) || other
                  const isActive = activeConvo?.id === convo.id

                  return (
                    <button
                      key={convo.id}
                      type="button"
                      onClick={() => onOpenConvo(convo)}
                      style={{
                        width: "100%",
                        padding: "6px 8px",
                        borderRadius: 6,
                        border: "none",
                        background: isActive ? "rgba(255, 255, 255, 0.12)" : "transparent",
                        color: isActive ? "#f4f5f7" : "#9aa1ad",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        fontSize: 14,
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "background-color 0.15s, border-color 0.15s, color 0.15s, opacity 0.15s, box-shadow 0.15s, transform 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"
                          e.currentTarget.style.color = "#d5d9e0"
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.background = "transparent"
                          e.currentTarget.style.color = "#9aa1ad"
                        }
                      }}
                    >
                      {/* Avatar with live status dot */}
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        {otherProfile?.avatar_url ? (
                          <img
                            src={otherProfile.avatar_url}
                            alt=""
                            style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              background: "#161a20",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 14,
                            }}
                          >
                            <Icon name="user" />
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
                            background: otherProfile?.is_online ? "#4fb987" : "#7a8290",
                            border: "2px solid #12151a",
                          }}
                        />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontWeight: isActive ? 600 : 500,
                            color: isActive ? "#f4f5f7" : "#d5d9e0",
                          }}
                        >
                          {other?.display_name || other?.username || "Fellow"}
                        </div>
                        {otherProfile?.replica_status_note && (
                          <div
                            style={{
                              fontSize: 10,
                              color: "#7a8290",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {otherProfile.replica_status_note}
                          </div>
                        )}
                      </div>
                    </button>
                  )
                })
            )}
          </>
        )}
      </div>

      {/* ── Discord Live Voice Status Bar (When in voice) ───────── */}
      {voiceConnected && (
        <div
          style={{
            padding: "8px 12px",
            background: "rgba(79,185,135, 0.12)",
            borderTop: "1px solid rgba(79,185,135, 0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 16 }}><Icon name="signal" /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#4fb987", lineHeight: 1.2 }}>
                Voice Connected {voiceChannelName ? `· #${voiceChannelName}` : ""}
              </div>
              <div style={{ fontSize: 10, color: "#9aa1ad", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                WebRTC P2P Mesh · {voicePeersCount || 1} in room
              </div>
            </div>
          </div>

          {onToggleVoice && (
            <button
              type="button"
              onClick={onToggleVoice}
              title="Disconnect from Voice"
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "rgba(248, 113, 113, 0.15)",
                border: "1px solid rgba(248, 113, 113, 0.3)",
                color: "#ef8a8a",
                fontSize: 12,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon name="phone" />
            </button>
          )}
        </div>
      )}

      {/* ── 3. Discord Bottom User Panel (Profile / Audio Controls) ── */}
      <div
        style={{
          height: 52,
          padding: "0 8px",
          background: "#0b0d11",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          borderTop: "1px solid rgba(255, 255, 255, 0.05)",
        }}
      >
        {/* User Card */}
        <div
          onClick={onOpenProfile}
          title="Open Profile & Settings"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 6px",
            borderRadius: 6,
            cursor: "pointer",
            flex: 1,
            minWidth: 0,
            transition: "background 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          <div style={{ position: "relative", flexShrink: 0 }}>
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
              />
            ) : (
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "#161a20",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 14,
                }}
              >
                <Icon name="user" />
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
                background: "#4fb987",
                border: "2px solid #0b0d11",
              }}
            />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: "#eceef2",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {myName}
            </div>
            <div
              style={{
                fontSize: 11,
                color: "#9aa1ad",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              Online
            </div>
          </div>
        </div>

        {/* Audio & Settings Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          <button
            type="button"
            onClick={() => (onToggleMic ? onToggleMic() : setLocalMicMuted((v) => !v))}
            title={micMuted ? "Unmute Mic" : "Mute Mic"}
            style={{
              width: 30,
              height: 30,
              borderRadius: 4,
              border: "none",
              background: "transparent",
              color: micMuted ? "#e5666b" : "#aab1bc",
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {micMuted ? <Icon name="micOff" /> : <Icon name="mic" />}
          </button>

          <button
            type="button"
            onClick={() => (onToggleDeafen ? onToggleDeafen() : setLocalHeadphonesMuted((v) => !v))}
            title={headphonesMuted ? "Undeafen" : "Deafen"}
            style={{
              width: 30,
              height: 30,
              borderRadius: 4,
              border: "none",
              background: "transparent",
              color: headphonesMuted ? "#e5666b" : "#aab1bc",
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {headphonesMuted ? <Icon name="headphonesOff" /> : <Icon name="headphones" />}
          </button>

          <button
            type="button"
            onClick={onOpenProfile}
            title="User Settings"
            style={{
              width: 30,
              height: 30,
              borderRadius: 4,
              border: "none",
              background: "transparent",
              color: "#aab1bc",
              fontSize: 14,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name="settings" />
          </button>
        </div>
      </div>
    </div>
  )
}
