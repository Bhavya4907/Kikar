"use client"
import { useState, useMemo } from "react"
import { T } from "../styles"

interface Props {
  session: any
  view: "ai" | "people" | "radar"
  setView: (v: "ai" | "people" | "radar") => void
  characters: any[]
  charsLoading: boolean
  activeChar: any
  activeConvo: any
  conversations: any[]
  allProfiles: any[]
  showForm: boolean
  searchEmail: string
  setSearchEmail: (v: string) => void
  searchResult: any
  onOpenChar: (c: any) => void
  onOpenConvo: (c: any) => void
  onOpenForm: () => void
  onOpenProfile: () => void
  onStartConversation: (id: string) => void
  onSearchUser: () => void
  onDeleteCharacter: (id: string) => void
  onSignOut: () => void
}

export default function Sidebar({
  session, view, setView, characters, charsLoading,
  activeChar, activeConvo, conversations, allProfiles,
  showForm, searchEmail, setSearchEmail, searchResult,
  onOpenChar, onOpenConvo, onOpenForm, onOpenProfile,
  onStartConversation, onSearchUser, onDeleteCharacter, onSignOut
}: Props) {
  const [peopleFilter, setPeopleFilter] = useState<"online" | "chats" | "all">("online")

  const onlineProfiles = useMemo(() => {
    return (allProfiles || []).filter(p => p.is_online)
  }, [allProfiles])

  // Filter people list based on active tab and instant search query
  const displayedPeople = useMemo(() => {
    const q = (searchEmail || "").trim().toLowerCase()
    let list = allProfiles || []

    if (peopleFilter === "online") {
      list = onlineProfiles
    } else if (peopleFilter === "chats") {
      const convoPartnerIds = new Set(
        (conversations || []).map(c => (c.user1_id === session.user.id ? c.user2_id : c.user1_id))
      )
      list = (allProfiles || []).filter(p => convoPartnerIds.has(p.id))
    }

    if (q) {
      list = list.filter(p => {
        const u = (p.username || "").toLowerCase()
        const d = (p.display_name || "").toLowerCase()
        const s = (p.replica_status_note || "").toLowerCase()
        return u.includes(q) || d.includes(q) || s.includes(q)
      })
    }

    return list
  }, [allProfiles, onlineProfiles, conversations, session, peopleFilter, searchEmail])

  return (
    <aside className="cc-sidebar">

      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "max(14px, env(safe-area-inset-top, 14px)) 16px 14px",
        background: T.surface,
        borderBottom: `1px solid ${T.border}`,
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: 10,
            background: "hsla(119,99%,46%,0.12)",
            border: "1px solid hsla(119,99%,46%,0.25)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            boxShadow: "0 0 16px hsla(119,99%,46%,0.15)",
          }}>✦</div>
          <div>
            <div style={{
              fontWeight: 700,
              fontSize: 14,
              color: T.text,
              letterSpacing: "-0.03em",
            }}>
              Kikar <span style={{ color: T.primary }}>AI</span>
            </div>
            <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>
              {session.user.email?.split("@")[0]}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button
            type="button"
            onClick={onOpenProfile}
            title="Profile"
            style={{
              width: 32,
              height: 32,
              background: T.bgAlt,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              color: T.muted,
              cursor: "pointer",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >👤</button>
          <button
            type="button"
            onClick={onSignOut}
            title="Sign out"
            style={{
              padding: "0 10px",
              height: 32,
              background: T.bgAlt,
              border: `1px solid ${T.border}`,
              borderRadius: 8,
              color: T.muted,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              fontFamily: T.font,
              letterSpacing: "0.04em",
            }}
          >Exit</button>
        </div>
      </div>

      {/* ── Mode Toggle Switcher ─────────────────────────────────── */}
      <div style={{
        display: "flex",
        padding: "8px 10px",
        gap: 6,
        background: T.bgAlt,
        borderBottom: `1px solid ${T.border}`,
        flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={() => setView("ai")}
          style={{
            flex: 1,
            padding: "8px 12px",
            borderRadius: 8,
            border: "none",
            background: view === "ai" ? "hsla(119,99%,46%,0.15)" : "transparent",
            color: view === "ai" ? T.primary : T.muted,
            fontWeight: 700,
            fontSize: 12,
            cursor: "pointer",
            fontFamily: T.font,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <span>✦</span> Persona
        </button>

        <button
          type="button"
          onClick={() => setView("people")}
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 8,
            border: "none",
            background: view === "people" ? "rgba(168,85,247,0.18)" : "transparent",
            color: view === "people" ? "#c084fc" : T.muted,
            fontWeight: 700,
            fontSize: 11,
            cursor: "pointer",
            fontFamily: T.font,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <span>👥</span> Fellows
          {onlineProfiles.length > 0 && (
            <span style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#22c55e",
              boxShadow: "0 0 6px #22c55e",
            }} />
          )}
        </button>

        <button
          type="button"
          onClick={() => setView("radar")}
          style={{
            flex: 1,
            padding: "8px 10px",
            borderRadius: 8,
            border: "none",
            background: view === "radar" ? "rgba(56,189,248,0.18)" : "transparent",
            color: view === "radar" ? "#38bdf8" : T.muted,
            fontWeight: 700,
            fontSize: 11,
            cursor: "pointer",
            fontFamily: T.font,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
          }}
        >
          <span>⚡</span> Radar
        </button>
      </div>

      {/* ── Content View ─────────────────────────────────────────── */}
      {view === "ai" ? (
        /* ── Character List ──────────────────────────────────────── */
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <button
            type="button"
            onClick={onOpenForm}
            style={{
              margin: "12px 14px 6px",
              padding: "10px 14px",
              background: "linear-gradient(135deg, hsl(119,99%,46%) 0%, hsl(119,99%,38%) 100%)",
              border: "none",
              borderRadius: 10,
              color: T.primaryFg,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              boxShadow: "0 2px 12px hsla(119,99%,46%,0.25)",
            }}
          >+ New Character</button>

          <div className="cc-charlist">
            {charsLoading ? (
              [1, 2, 3].map(i => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: `1px solid ${T.border}` }}>
                  <div className="shimmer" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div className="shimmer" style={{ height: 12, borderRadius: 6, marginBottom: 6, width: "60%" }} />
                    <div className="shimmer" style={{ height: 10, borderRadius: 6, width: "40%" }} />
                  </div>
                </div>
              ))
            ) : characters.length === 0 ? (
              <p style={{ color: T.muted, fontSize: 13, padding: "20px 16px", textAlign: "center", lineHeight: 1.6 }}>
                No characters yet.<br />Create your first one above!
              </p>
            ) : (
              characters.map(c => {
                const isActive = activeChar?.id === c.id && !showForm
                return (
                  <div
                    key={c.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 14px",
                      cursor: "pointer",
                      borderBottom: `1px solid ${T.border}`,
                      background: isActive ? "hsla(119,99%,46%,0.08)" : "transparent",
                      borderLeft: isActive ? `2px solid ${T.primary}` : "2px solid transparent",
                      transition: "background 0.15s",
                    }}
                    onClick={() => onOpenChar(c)}
                  >
                    <div style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: isActive ? "hsla(119,99%,46%,0.15)" : T.bgAlt,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      flexShrink: 0,
                      border: isActive ? "1px solid hsla(119,99%,46%,0.3)" : `1px solid ${T.border}`,
                    }}>
                      {c.emoji}
                    </div>

                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: isActive ? T.primary : T.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                        {c.name}
                      </div>
                      {c.is_replica && (
                        <div style={{ fontSize: 10, color: "#a855f7", marginTop: 2, fontWeight: 600 }}>
                          🪞 Replica
                        </div>
                      )}
                    </div>

                    {c.created_by === session.user.id && (
                      <button
                        type="button"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: T.muted2,
                          cursor: "pointer",
                          fontSize: 14,
                          padding: "4px 6px",
                          borderRadius: 6,
                          flexShrink: 0,
                        }}
                        onClick={e => {
                          e.stopPropagation()
                          if (window.confirm(`Delete "${c.name}"?`)) {
                            onDeleteCharacter(c.id)
                          }
                        }}
                      >✕</button>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>

      ) : view === "people" ? (
        /* ── People List (Zangi-Style Online Discovery & Search) ─── */
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Search bar */}
          <div style={{ display: "flex", gap: 6, padding: "10px 12px", flexShrink: 0 }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                style={{
                  width: "100%",
                  padding: "9px 28px 9px 12px",
                  background: T.bgAlt,
                  border: `1px solid ${T.border}`,
                  borderRadius: 10,
                  color: T.text,
                  fontSize: 13,
                  fontFamily: T.font,
                  outline: "none",
                  boxSizing: "border-box",
                }}
                placeholder="Search @username or name…"
                value={searchEmail}
                onChange={e => setSearchEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && onSearchUser()}
              />
              {searchEmail && (
                <button
                  type="button"
                  onClick={() => setSearchEmail("")}
                  style={{
                    position: "absolute",
                    right: 8,
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "transparent",
                    border: "none",
                    color: T.muted,
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >✕</button>
              )}
            </div>
            <button
              type="button"
              onClick={onSearchUser}
              title="Search database"
              style={{
                width: 36,
                height: 36,
                background: `linear-gradient(135deg, ${T.primary}, hsl(119,99%,38%))`,
                border: "none",
                borderRadius: 10,
                color: T.primaryFg,
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 14,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >→</button>
          </div>

          {/* Filter tabs */}
          <div style={{
            display: "flex",
            padding: "0 10px 8px",
            gap: 4,
            borderBottom: `1px solid ${T.border}`,
            flexShrink: 0,
          }}>
            {([
              { id: "online", label: "🟢 Online", count: onlineProfiles.length },
              { id: "chats",  label: "💬 Chats",  count: conversations.length },
              { id: "all",    label: "👥 All",    count: (allProfiles || []).length },
            ] as const).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPeopleFilter(tab.id)}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: 8,
                  border: "none",
                  background: peopleFilter === tab.id ? "rgba(168,85,247,0.18)" : "transparent",
                  color: peopleFilter === tab.id ? "#c084fc" : T.muted,
                  fontSize: 11,
                  fontWeight: peopleFilter === tab.id ? 700 : 500,
                  cursor: "pointer",
                  fontFamily: T.font,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                }}
              >
                <span>{tab.label}</span>
                <span style={{
                  fontSize: 9,
                  background: peopleFilter === tab.id ? "rgba(168,85,247,0.3)" : "rgba(255,255,255,0.06)",
                  padding: "1px 5px",
                  borderRadius: 999,
                }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Search result from manual database lookup */}
          {searchResult && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 14px",
                cursor: "pointer",
                background: "hsla(119,99%,46%,0.06)",
                borderBottom: `1px solid ${T.border}`,
                borderLeft: `2px solid ${T.primary}`,
              }}
              onClick={() => onStartConversation(searchResult.id)}
            >
              <div style={{ position: "relative", flexShrink: 0 }}>
                {searchResult.avatar_url ? (
                  <img src={searchResult.avatar_url} style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 38, height: 38, borderRadius: "50%", background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>👤</div>
                )}
                <div style={{
                  position: "absolute", bottom: 0, right: 0,
                  width: 10, height: 10, borderRadius: "50%",
                  background: searchResult.is_online ? "#22c55e" : T.muted2,
                  border: `2px solid ${T.surface}`,
                }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {searchResult.display_name || searchResult.username}
                </div>
                <div style={{ fontSize: 11, color: T.muted }}>@{searchResult.username}</div>
              </div>
              <div style={{ fontSize: 11, color: T.primary, fontWeight: 700 }}>Chat →</div>
            </div>
          )}

          {/* People list */}
          <div className="cc-charlist">
            {displayedPeople.length === 0 ? (
              <div style={{ padding: "28px 16px", textAlign: "center", color: T.muted, fontSize: 12, lineHeight: 1.6 }}>
                {searchEmail
                  ? `No fellows matching "${searchEmail}".`
                  : peopleFilter === "online"
                  ? "No fellows currently online.\nCheck back soon or browse 'All'!"
                  : peopleFilter === "chats"
                  ? "No active chats yet.\nConnect with someone online!"
                  : "No other registered fellows found."}
              </div>
            ) : (
              displayedPeople.map(p => {
                const existingConvo = conversations.find(c =>
                  (c.user1_id === session.user.id && c.user2_id === p.id) ||
                  (c.user2_id === session.user.id && c.user1_id === p.id)
                )
                const isActive = activeConvo?.id === existingConvo?.id
                return (
                  <div key={p.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 14px",
                      cursor: "pointer",
                      borderBottom: `1px solid ${T.border}`,
                      background: isActive ? "hsla(119,99%,46%,0.08)" : "transparent",
                      borderLeft: isActive ? `2px solid ${T.primary}` : "2px solid transparent",
                      transition: "background 0.15s",
                    }}
                    onClick={() => onStartConversation(p.id)}
                  >
                    <div style={{ position: "relative", flexShrink: 0 }}>
                      {p.avatar_url ? (
                        <img src={p.avatar_url} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ width: 40, height: 40, borderRadius: "50%", background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>👤</div>
                      )}
                      <div style={{
                        position: "absolute", bottom: 0, right: 0,
                        width: 11, height: 11, borderRadius: "50%",
                        background: p.is_online ? "#22c55e" : "#444444",
                        border: `2px solid ${T.surface}`,
                        boxShadow: p.is_online ? "0 0 6px #22c55e" : "none",
                      }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: isActive ? T.primary : T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {p.display_name || p.username}
                        </span>
                        {p.auto_replica_enabled && (
                          <span style={{ fontSize: 10, color: "#c084fc", flexShrink: 0 }} title="Digital Replica Ready">
                            🪞
                          </span>
                        )}
                      </div>

                      <div style={{ fontSize: 11, color: T.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        @{p.username}
                      </div>

                      {p.replica_status_note ? (
                        <div style={{ fontSize: 10, color: "#c084fc", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          💬 {p.replica_status_note}
                        </div>
                      ) : (
                        <div style={{ fontSize: 10, color: p.is_online ? "#22c55e" : T.muted2, marginTop: 1 }}>
                          {p.is_online ? "● Active Now" : p.last_seen
                            ? `Last seen ${new Date(p.last_seen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                            : "Offline"}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      ) : (
        /* ── Radar Mode Sidebar ──────────────────────────────────── */
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: 16,
          gap: 16,
          overflowY: "auto",
        }}>
          <div style={{
            padding: 16,
            background: "rgba(56,189,248,0.08)",
            border: "1px solid rgba(56,189,248,0.25)",
            borderRadius: 14,
            textAlign: "center",
          }}>
            <div style={{ fontSize: 32, marginBottom: 6 }}>📡</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#38bdf8", marginBottom: 4 }}>
              Kikar Radar Active
            </div>
            <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.5 }}>
              Instant anonymous 1-on-1 matches. Tap &apos;Start Matching&apos; in the main screen to begin!
            </div>
          </div>

          <div style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            padding: 14,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
              ⚡ Radar Features
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 12, color: T.text }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>🎲</span>
                <span>AI Wingman Icebreaker Host</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>➔</span>
                <span>Instant &apos;Next Stranger&apos; Skip</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>🤝</span>
                <span>Add Friend to Save Chat</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span>🪞</span>
                <span>Replica Sparring Fallback</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────── */}
      <div style={{
        fontSize: 11,
        color: T.muted2,
        padding: "10px 16px",
        flexShrink: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        borderTop: `1px solid ${T.border}`,
        background: T.surface,
      }}>{session.user.email}</div>
    </aside>
  )
}
