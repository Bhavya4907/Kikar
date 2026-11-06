"use client"
import { T } from "../styles"

interface Props {
  session: any
  view: "ai" | "people"
  setView: (v: "ai" | "people") => void
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
  return (
    <aside className="cc-sidebar">

      {/* ── Top Bar ─────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "14px 16px",
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
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={e => {
              (e.target as HTMLElement).style.borderColor = T.borderHover
              ;(e.target as HTMLElement).style.color = T.text
            }}
            onMouseLeave={e => {
              (e.target as HTMLElement).style.borderColor = T.border
              ;(e.target as HTMLElement).style.color = T.muted
            }}
          >👤</button>
          <button
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
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={e => {
              const el = e.currentTarget
              el.style.borderColor = "rgba(248,113,113,0.4)"
              el.style.color = T.red
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              el.style.borderColor = T.border
              el.style.color = T.muted
            }}
          >OUT</button>
        </div>
      </div>

      {/* ── Tab Bar ─────────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        padding: "10px 12px",
        gap: 6,
        background: T.surface,
        borderBottom: `1px solid ${T.border}`,
        flexShrink: 0,
      }}>
        {([
          { id: "ai",     label: "✦ AI Characters" },
          { id: "people", label: "◉ People" },
        ] as const).map(tab => (
          <button key={tab.id}
            onClick={() => setView(tab.id)}
            style={{
              flex: 1,
              padding: "9px 0",
              background: view === tab.id ? "hsla(119,99%,46%,0.12)" : "transparent",
              border: view === tab.id
                ? "1px solid hsla(119,99%,46%,0.35)"
                : `1px solid ${T.border}`,
              borderRadius: 8,
              color: view === tab.id ? T.primary : T.muted,
              fontSize: 12,
              fontWeight: view === tab.id ? 600 : 400,
              fontFamily: T.font,
              cursor: "pointer",
              letterSpacing: "0.01em",
              transition: "all 0.18s ease",
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── AI Characters List ───────────────────────────────────── */}
      {view === "ai" ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* New character button */}
          <button
            onClick={onOpenForm}
            style={{
              margin: "12px 12px 6px",
              padding: "11px 0",
              background: "transparent",
              border: `1px dashed hsla(119,99%,46%,0.4)`,
              borderRadius: 10,
              color: T.primary,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: T.font,
              cursor: "pointer",
              flexShrink: 0,
              transition: "background 0.18s, border-color 0.18s",
            }}
            onMouseEnter={e => {
              const el = e.currentTarget
              el.style.background = "hsla(119,99%,46%,0.06)"
              el.style.borderColor = "hsla(119,99%,46%,0.6)"
            }}
            onMouseLeave={e => {
              const el = e.currentTarget
              el.style.background = "transparent"
              el.style.borderColor = "hsla(119,99%,46%,0.4)"
            }}
          >+ New Character</button>

          {/* Character list */}
          <div className="cc-charlist">
            {charsLoading ? (
              // Skeleton shimmer
              [1,2,3].map(i => (
                <div key={i} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  borderBottom: `1px solid ${T.border}`,
                }}>
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
                  <div key={c.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 14px",
                      cursor: "pointer",
                      borderBottom: `1px solid ${T.border}`,
                      background: isActive ? "hsla(119,99%,46%,0.08)" : "transparent",
                      borderLeft: isActive ? `2px solid ${T.primary}` : "2px solid transparent",
                      transition: "background 0.15s, border-color 0.15s",
                    }}
                    onClick={() => onOpenChar(c)}
                    onMouseEnter={e => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"
                    }}
                    onMouseLeave={e => {
                      if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"
                    }}
                  >
                    {/* Emoji avatar */}
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
                      transition: "all 0.15s",
                    }}>{c.emoji}</div>

                    <div style={{ flex: 1, overflow: "hidden" }}>
                      <div style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: isActive ? T.primary : T.text,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        letterSpacing: "-0.01em",
                      }}>{c.name}</div>
                      {c.is_replica && (
                        <div style={{ fontSize: 10, color: "#a855f7", marginTop: 2, fontWeight: 500 }}>
                          🪞 Replica
                        </div>
                      )}
                    </div>

                    {c.created_by === session.user.id && (
                      <button
                        style={{
                          background: "transparent",
                          border: "none",
                          color: T.muted2,
                          cursor: "pointer",
                          fontSize: 14,
                          padding: "4px 6px",
                          borderRadius: 6,
                          flexShrink: 0,
                          transition: "color 0.15s",
                        }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = T.red}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = T.muted2}
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

      ) : (
        /* ── People List ─────────────────────────────────────────── */
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Search bar */}
          <div style={{ display: "flex", gap: 6, padding: "10px 12px", flexShrink: 0 }}>
            <input
              style={{
                flex: 1,
                padding: "10px 14px",
                background: T.bgAlt,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                color: T.text,
                fontSize: 13,
                fontFamily: T.font,
                outline: "none",
              }}
              placeholder="Search by username…"
              value={searchEmail}
              onChange={e => setSearchEmail(e.target.value)}
              onKeyDown={e => e.key === "Enter" && onSearchUser()}
              onFocus={e => {
                e.target.style.borderColor = "hsla(119,99%,46%,0.5)"
                e.target.style.boxShadow = "0 0 0 3px hsla(119,99%,46%,0.08)"
              }}
              onBlur={e => {
                e.target.style.borderColor = T.border
                e.target.style.boxShadow = "none"
              }}
            />
            <button
              onClick={onSearchUser}
              style={{
                width: 40,
                height: 40,
                background: `linear-gradient(135deg, ${T.primary}, hsl(119,99%,38%))`,
                border: "none",
                borderRadius: 10,
                color: T.primaryFg,
                fontWeight: 700,
                cursor: "pointer",
                fontSize: 16,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 12px hsla(119,99%,46%,0.25)",
              }}
            >→</button>
          </div>

          {/* Search result */}
          {searchResult && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 14px",
                cursor: "pointer",
                background: "hsla(119,99%,46%,0.06)",
                borderBottom: `1px solid ${T.border}`,
                borderLeft: `2px solid ${T.primary}`,
                margin: "0 0 4px",
              }}
              onClick={() => onStartConversation(searchResult.id)}
            >
              <div style={{ position: "relative", flexShrink: 0 }}>
                {searchResult.avatar_url
                  ? <img src={searchResult.avatar_url} style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                  : <div style={{ width: 40, height: 40, borderRadius: "50%", background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>👤</div>
                }
                <div style={{
                  position: "absolute", bottom: 0, right: 0,
                  width: 11, height: 11, borderRadius: "50%",
                  background: searchResult.is_online ? "#22c55e" : T.muted2,
                  border: `2px solid ${T.surface}`,
                }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: T.text }}>{searchResult.display_name || searchResult.username}</div>
                <div style={{ fontSize: 11, color: searchResult.is_online ? "#22c55e" : T.muted, marginTop: 2 }}>
                  {searchResult.is_online ? "● Online" : "● Offline"}
                </div>
              </div>
              <div style={{ fontSize: 11, color: T.primary, fontWeight: 600 }}>Chat →</div>
            </div>
          )}

          {/* Section header */}
          <div style={{
            padding: "8px 16px 6px",
            fontSize: 10,
            color: T.muted2,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            fontWeight: 600,
            flexShrink: 0,
          }}>All People ({allProfiles.length})</div>

          {/* People list */}
          <div className="cc-charlist">
            {allProfiles.map(p => {
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
                    padding: "12px 14px",
                    cursor: "pointer",
                    borderBottom: `1px solid ${T.border}`,
                    background: isActive ? "hsla(119,99%,46%,0.08)" : "transparent",
                    borderLeft: isActive ? `2px solid ${T.primary}` : "2px solid transparent",
                    transition: "background 0.15s",
                  }}
                  onClick={() => onStartConversation(p.id)}
                  onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)" }}
                  onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent" }}
                >
                  <div style={{ position: "relative", flexShrink: 0 }}>
                    {p.avatar_url
                      ? <img src={p.avatar_url} style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover" }} />
                      : <div style={{ width: 42, height: 42, borderRadius: "50%", background: T.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>👤</div>
                    }
                    <div style={{
                      position: "absolute", bottom: 1, right: 1,
                      width: 11, height: 11, borderRadius: "50%",
                      background: p.is_online ? "#22c55e" : "#3a3a3a",
                      border: `2px solid ${T.surface}`,
                    }} />
                  </div>
                  <div style={{ flex: 1, overflow: "hidden" }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {p.display_name || p.username}
                    </div>
                    <div style={{ fontSize: 11, color: p.is_online ? "#22c55e" : T.muted, marginTop: 2 }}>
                      {p.is_online ? "● Online" : p.last_seen
                        ? `Last seen ${new Date(p.last_seen).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                        : "● Offline"}
                    </div>
                  </div>
                </div>
              )
            })}
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