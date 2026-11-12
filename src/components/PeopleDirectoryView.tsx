"use client"
import { useState, useMemo } from "react"
import { T } from "../styles"
import type { Profile } from "../lib/types"
import { Icon } from "./Icons"

interface Props {
  session: any
  allProfiles: Profile[]
  conversations: any[]
  onStartConversation: (userId: string) => void
  onOpenPricing?: () => void
  onOpenRadar?: () => void
}

export default function PeopleDirectoryView({
  session,
  allProfiles,
  conversations,
  onStartConversation,
  onOpenPricing,
  onOpenRadar,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterTab, setFilterTab] = useState<"all" | "online" | "replica" | "chats">("online")

  // Set of user IDs with existing conversation
  const existingConvoPartnerIds = useMemo(() => {
    const set = new Set<string>()
    for (const c of conversations) {
      if (c.user1_id === session.user.id) set.add(c.user2_id)
      if (c.user2_id === session.user.id) set.add(c.user1_id)
    }
    return set
  }, [conversations, session])

  // Count active/online users
  const onlineCount = useMemo(() => {
    return allProfiles.filter(p => p.is_online).length
  }, [allProfiles])

  // Filtered and searched profiles
  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return allProfiles.filter(p => {
      // Don't show ourselves in the directory
      if (p.id === session.user.id) return false

      // Tab filter
      if (filterTab === "online" && !p.is_online) return false
      if (filterTab === "replica" && !p.auto_replica_enabled) return false
      if (filterTab === "chats" && !existingConvoPartnerIds.has(p.id)) return false

      // Search query filter (matches username, display_name, status note, or bio)
      if (q) {
        const u = (p.username || "").toLowerCase()
        const d = (p.display_name || "").toLowerCase()
        const s = (p.replica_status_note || "").toLowerCase()
        const b = (p.bio || "").toLowerCase()
        if (!u.includes(q) && !d.includes(q) && !s.includes(q) && !b.includes(q)) {
          return false
        }
      }

      return true
    })
  }, [allProfiles, session, filterTab, searchQuery, existingConvoPartnerIds])

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      background: T.bg,
      overflow: "hidden",
      fontFamily: T.font,
    }}>
      {/* ── Top Header Bar ─────────────────────────────────────────── */}
      <div className="cc-grid-header">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: "rgba(139,124,246,0.14)",
            border: "1px solid rgba(139,124,246,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            color: "#b3a8f8",
          }}>
            <Icon name="users" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: T.text, letterSpacing: "-0.02em" }}>
                Fellows Directory
              </h2>
              <span style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                background: "hsla(142,76%,36%,0.15)",
                border: "1px solid rgba(79,185,135,0.3)",
                color: "#4fb987",
                fontSize: 11,
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: 999,
              }}>
                <span style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#4fb987",
                  boxShadow: "0 0 8px #4fb987",
                }} />
                {onlineCount} Online
              </span>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: T.muted }}>
              Search specific users by @username or connect with active fellows live
            </p>
          </div>
        </div>

        {/* Search input */}
        <div className="cc-grid-search" style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: T.muted }}>
            <Icon name="search" />
          </span>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by @username, name, or status…"
            style={{
              width: "100%",
              padding: "9px 14px 9px 34px",
              background: T.bgAlt,
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              color: T.text,
              fontSize: 13,
              fontFamily: T.font,
              outline: "none",
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
                background: "transparent",
                border: "none",
                color: T.muted,
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              
            </button>
          )}
        </div>

        {onOpenRadar && (
          <button
            type="button"
            onClick={onOpenRadar}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              background: "linear-gradient(135deg, rgba(56,189,248,0.18) 0%, rgba(14,165,233,0.1) 100%)",
              border: "1px solid rgba(56,189,248,0.4)",
              borderRadius: 10,
              color: "#62b5d9",
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: T.font,
              flexShrink: 0,
            }}
          >
            <span><Icon name="radar" /></span>
            <span>Omegle Radar</span>
          </button>
        )}
      </div>

      {/* ── Filter Tabs ────────────────────────────────────────────── */}
      <div className="cc-filter-tabs">
        {([
          { id: "online",  label: "Online Now", count: onlineCount },
          { id: "chats",   label: "Existing Chats", count: conversations.length },
          { id: "replica", label: "Has Digital Replica", count: allProfiles.filter(p => p.auto_replica_enabled).length },
          { id: "all",     label: "All Fellows", count: allProfiles.length },
        ] as const).map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterTab(tab.id)}
            style={{
              padding: "9px 14px",
              border: "none",
              background: "transparent",
              borderBottom: filterTab === tab.id ? "2px solid #8b7cf6" : "2px solid transparent",
              color: filterTab === tab.id ? "#b3a8f8" : T.muted,
              fontSize: 12,
              fontWeight: filterTab === tab.id ? 700 : 500,
              cursor: "pointer",
              fontFamily: T.font,
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
            }}
          >
            <span>{tab.label}</span>
            <span style={{
              fontSize: 10,
              background: filterTab === tab.id ? "rgba(139,124,246,0.2)" : "rgba(255,255,255,0.06)",
              padding: "1px 6px",
              borderRadius: 999,
              color: filterTab === tab.id ? "#b3a8f8" : T.muted,
            }}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Directory Grid ─────────────────────────────────────────── */}
      <div className="cc-grid-container">
        {filteredProfiles.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}><Icon name="users" /></div>
            <h3 style={{ fontSize: 17, color: T.text, fontWeight: 700, margin: "0 0 6px" }}>
              {searchQuery ? "No matching fellows found" : filterTab === "online" ? "No fellows currently online" : "No fellows found"}
            </h3>
            <p style={{ color: T.muted, fontSize: 13, margin: 0, maxWidth: 360, marginInline: "auto" }}>
              {searchQuery
                ? `Nobody matching "${searchQuery}". Check the spelling of the @username or share your invite link.`
                : filterTab === "online"
                ? "Check back shortly or view 'All Fellows' to message someone's offline Digital Replica!"
                : "Invite friends by sharing your Kikar username handle!"}
            </p>
          </div>
        ) : (
          filteredProfiles.map(p => {
            const hasExisting = existingConvoPartnerIds.has(p.id)

            return (
              <div
                key={p.id}
                style={{
                  background: T.surface,
                  border: `1px solid ${p.is_online ? "rgba(79,185,135,0.3)" : T.border}`,
                  borderRadius: 16,
                  padding: "16px 16px 14px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 12,
                  transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s",
                  boxShadow: p.is_online ? "0 4px 20px rgba(79,185,135,0.06)" : "none",
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "translateY(-3px)"
                  e.currentTarget.style.borderColor = p.is_online ? "#4fb987" : "#8b7cf6"
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "translateY(0)"
                  e.currentTarget.style.borderColor = p.is_online ? "rgba(79,185,135,0.3)" : T.border
                }}
              >
                <div>
                  {/* Top user row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      {p.avatar_url ? (
                        <img
                          src={p.avatar_url}
                          alt={p.username}
                          style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover" }}
                        />
                      ) : (
                        <div style={{
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          background: T.surfaceAlt,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 22,
                        }}>
                          <Icon name="user" />
                        </div>
                      )}
                      {/* Online indicator ring */}
                      <div
                        style={{
                          position: "absolute",
                          bottom: 1,
                          right: 1,
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: p.is_online ? "#4fb987" : "#3a414c",
                          border: `2px solid ${T.surface}`,
                          boxShadow: p.is_online ? "0 0 8px #4fb987" : "none",
                        }}
                      />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 15,
                        fontWeight: 700,
                        color: T.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {p.display_name || p.username}
                      </div>
                      <div style={{
                        fontSize: 12,
                        color: T.muted,
                        marginTop: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        @{p.username}
                      </div>
                    </div>
                  </div>

                  {/* Status / Note badge */}
                  {p.replica_status_note ? (
                    <div style={{
                      fontSize: 11,
                      color: "#b3a8f8",
                      background: "rgba(139,124,246,0.1)",
                      border: "1px solid rgba(139,124,246,0.22)",
                      borderRadius: 8,
                      padding: "5px 9px",
                      marginBottom: 8,
                      lineHeight: 1.4,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      &quot;{p.replica_status_note}&quot;
                    </div>
                  ) : null}

                  {/* Bio snippet */}
                  {p.bio && (
                    <div style={{
                      fontSize: 12,
                      color: T.muted,
                      lineHeight: 1.4,
                      marginBottom: 6,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}>
                      {p.bio}
                    </div>
                  )}

                  {/* Badges */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: p.is_online ? "#4fb987" : T.muted,
                      background: p.is_online ? "rgba(79,185,135,0.1)" : "rgba(255,255,255,0.05)",
                      padding: "2px 7px",
                      borderRadius: 6,
                    }}>
                      {p.is_online
                        ? "● Active Now"
                        : p.last_seen
                        ? `Last seen ${new Date(p.last_seen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : "Offline"}
                    </span>

                    {p.auto_replica_enabled && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: "#b3a8f8",
                        background: "rgba(139,124,246,0.1)",
                        padding: "2px 7px",
                        borderRadius: 6,
                      }}>
                        Replica Ready
                      </span>
                    )}

                    {p.plan_tier && p.plan_tier !== "free" && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: T.primary,
                        background: "hsla(226,72%,70%,0.12)",
                        padding: "2px 7px",
                        borderRadius: 6,
                        textTransform: "uppercase",
                      }}>
                        {p.plan_tier}
                      </span>
                    )}
                  </div>
                </div>

                {/* Connect / Chat Button */}
                <button
                  type="button"
                  onClick={() => onStartConversation(p.id)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    background: hasExisting
                      ? "rgba(139,124,246,0.15)"
                      : "linear-gradient(135deg, hsl(226,72%,70%) 0%, hsl(226,62%,58%) 100%)",
                    border: hasExisting ? "1px solid rgba(139,124,246,0.35)" : "none",
                    borderRadius: 9,
                    color: hasExisting ? "#b3a8f8" : T.primaryFg,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    fontFamily: T.font,
                    transition: "opacity 0.15s, transform 0.15s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.9")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                >
                  <span>{hasExisting ? "Open Chat" : "Connect & Message"}</span>
                  <span style={{ fontSize: 13 }}>→</span>
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
