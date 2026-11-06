"use client"
import { useState } from "react"
import { T, S } from "../styles"

interface Props {
  characters: any[]
  charsLoading: boolean
  session: any
  onOpenChar: (c: any) => void
  onOpenForm: () => void
  onEditChar?: (c: any) => void
  onDeleteCharacter?: (id: string) => void
  setView: (v: "ai" | "people") => void
  onOpenProfile: () => void
  onSignOut: () => void
}

export default function AIGridView({ 
  characters, charsLoading, session, onOpenChar, onOpenForm, onEditChar, onDeleteCharacter, setView, onOpenProfile, onSignOut 
}: Props) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterTab, setFilterTab] = useState<"all" | "my" | "replicas" | "public">("all")
  const [deletingId, setDeletingId] = useState<string | null>(null)
  
  const filteredChars = characters.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.system_prompt && c.system_prompt.toLowerCase().includes(searchQuery.toLowerCase()))
    
    if (!matchesSearch) return false

    if (filterTab === "my") {
      return c.created_by === session?.user?.id || c.is_replica
    }
    if (filterTab === "replicas") {
      return c.is_replica
    }
    if (filterTab === "public") {
      return !c.is_replica && c.is_public
    }
    return true
  })

  const replicas = filteredChars.filter(c => c.is_replica)
  const privateBots = filteredChars.filter(c => !c.is_replica && !c.is_public)
  const publicBots = filteredChars.filter(c => !c.is_replica && c.is_public)

  function handleDeleteClick(e: React.MouseEvent, char: any) {
    e.stopPropagation()
    if (window.confirm(`Are you sure you want to delete "${char.name}"? This cannot be undone.`)) {
      setDeletingId(char.id)
      if (onDeleteCharacter) {
        onDeleteCharacter(char.id)
      }
    }
  }

  function handleEditClick(e: React.MouseEvent, char: any) {
    e.stopPropagation()
    if (onEditChar) {
      onEditChar(char)
    }
  }

  const renderCard = (c: any) => {
    const isOwner = c.created_by === session?.user?.id
    const isReplica = !!c.is_replica

    return (
      <div
        key={c.id}
        style={{
          ...S.botCard,
          position: "relative",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          opacity: deletingId === c.id ? 0.4 : 1,
        }}
        onClick={() => onOpenChar(c)}
        onMouseEnter={e => {
          const el = e.currentTarget
          el.style.transform = S.botCardHover.transform as string
          el.style.borderColor = S.botCardHover.borderColor as string
          el.style.background = S.botCardHover.background as string
        }}
        onMouseLeave={e => {
          const el = e.currentTarget
          el.style.transform = "translateY(0)"
          el.style.borderColor = T.border
          el.style.background = T.surface
        }}
      >
        <div>
          {/* Top row: Avatar & Action buttons */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div style={S.botAvatar}>{c.emoji}</div>
            
            {/* Owner Actions */}
            {(isOwner || isReplica) && (
              <div style={{ display: "flex", gap: 6 }} onClick={e => e.stopPropagation()}>
                {isOwner && !isReplica && onEditChar && (
                  <button
                    type="button"
                    onClick={e => handleEditClick(e, c)}
                    title="Edit character"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      width: 30,
                      height: 30,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: T.muted,
                      cursor: "pointer",
                      fontSize: 13,
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget
                      el.style.background = "hsla(119,99%,46%,0.15)"
                      el.style.borderColor = "hsla(119,99%,46%,0.4)"
                      el.style.color = T.primary
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget
                      el.style.background = "rgba(255,255,255,0.06)"
                      el.style.borderColor = T.border
                      el.style.color = T.muted
                    }}
                  >
                    ✏️
                  </button>
                )}
                
                {onDeleteCharacter && (
                  <button
                    type="button"
                    onClick={e => handleDeleteClick(e, c)}
                    title="Delete character"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      width: 30,
                      height: 30,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: T.muted,
                      cursor: "pointer",
                      fontSize: 13,
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={e => {
                      const el = e.currentTarget
                      el.style.background = "rgba(248,113,113,0.15)"
                      el.style.borderColor = "rgba(248,113,113,0.4)"
                      el.style.color = T.red
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget
                      el.style.background = "rgba(255,255,255,0.06)"
                      el.style.borderColor = T.border
                      el.style.color = T.muted
                    }}
                  >
                    🗑️
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <div style={S.botName}>{c.name}</div>
            {c.is_replica ? (
              <div style={{ fontSize: 11, color: "#a855f7", marginTop: 2, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                <span>🪞</span> Replica Persona
              </div>
            ) : isOwner ? (
              <div style={{ fontSize: 11, color: T.primary, marginTop: 2, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                <span>✦</span> Created by you {c.is_public ? "· Public" : "· Private"}
              </div>
            ) : null}
          </div>

          <div style={{ ...S.botDesc, marginTop: 8 }}>
            {c.system_prompt 
              ? c.system_prompt.replace(/You are .*?\. /i, "").substring(0, 110) + (c.system_prompt.length > 110 ? "..." : "")
              : "An AI persona ready to chat."}
          </div>
        </div>

        {/* Start Chat hint footer */}
        <div style={{
          marginTop: 14,
          paddingTop: 10,
          borderTop: `1px solid ${T.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 12,
          color: T.muted,
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.primary }} />
            Ready to chat
          </span>
          <span style={{ color: T.primary, fontWeight: 600 }}>Start Chat →</span>
        </div>
      </div>
    )
  }

  return (
    <div style={S.aiGridWrap}>
      {/* Header */}
      <div style={S.aiGridHeader}>
        {/* Top Left: People Mode Switcher */}
        <button
          onClick={() => setView("people")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 16px",
            background: "rgba(168,85,247,0.1)",
            border: "1px solid rgba(168,85,247,0.3)",
            borderRadius: 10,
            color: "#a855f7",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: T.font,
            transition: "all 0.15s",
          }}
          onMouseEnter={e => {
            const el = e.currentTarget
            el.style.background = "rgba(168,85,247,0.2)"
            el.style.borderColor = "rgba(168,85,247,0.5)"
          }}
          onMouseLeave={e => {
            const el = e.currentTarget
            el.style.background = "rgba(168,85,247,0.1)"
            el.style.borderColor = "rgba(168,85,247,0.3)"
          }}
        >
          <span>◉</span>
          <span>People</span>
        </button>

        {/* Center: Search Bar */}
        <div style={{ flex: 1, maxWidth: 380, margin: "0 16px" }}>
          <input
            style={{
              width: "100%",
              padding: "10px 16px",
              background: T.bgAlt,
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              color: T.text,
              fontSize: 14,
              fontFamily: T.font,
              outline: "none",
            }}
            placeholder="Search AI personas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={e => e.target.style.borderColor = "hsla(119,99%,46%,0.5)"}
            onBlur={e => e.target.style.borderColor = T.border}
          />
        </div>

        {/* Top Right: Profile, Sign Out, Create */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            onClick={onOpenProfile}
            title="Profile"
            style={{
              width: 36,
              height: 36,
              background: T.bgAlt,
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              color: T.muted,
              cursor: "pointer",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "border-color 0.15s, color 0.15s",
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.borderColor = T.borderHover
              ;(e.currentTarget as HTMLElement).style.color = T.text
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = T.border
              ;(e.currentTarget as HTMLElement).style.color = T.muted
            }}
          >👤</button>
          <button
            onClick={onSignOut}
            title="Sign out"
            style={{
              padding: "0 12px",
              height: 36,
              background: T.bgAlt,
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              color: T.muted,
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              fontFamily: T.font,
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
          
          <button
            onClick={onOpenForm}
            style={{
              padding: "10px 18px",
              height: 36,
              background: "linear-gradient(135deg, hsl(119,99%,46%) 0%, hsl(119,99%,38%) 100%)",
              border: "none",
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 13,
              cursor: "pointer",
              color: T.primaryFg,
              fontFamily: T.font,
              letterSpacing: "0.01em",
              boxShadow: "0 4px 16px hsla(119,99%,46%,0.2)",
              transition: "opacity 0.15s, transform 0.12s",
              display: "flex",
              alignItems: "center",
              gap: 6
            }}
          >
            <span>+</span> Create Bot
          </button>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div style={{
        display: "flex",
        padding: "12px 32px 0",
        gap: 8,
        borderBottom: `1px solid ${T.border}`,
        background: T.surface,
        flexShrink: 0,
      }}>
        {([
          { id: "all", label: "🌟 All Characters", count: characters.length },
          { id: "my", label: "👤 My Bots", count: characters.filter(c => c.created_by === session?.user?.id || c.is_replica).length },
          { id: "replicas", label: "🪞 Replicas", count: characters.filter(c => c.is_replica).length },
          { id: "public", label: "🌍 Community / Public", count: characters.filter(c => !c.is_replica && c.is_public).length },
        ] as const).map(tab => {
          const isActive = filterTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              style={{
                padding: "8px 16px 12px",
                background: "transparent",
                border: "none",
                borderBottom: isActive ? `2px solid ${T.primary}` : "2px solid transparent",
                color: isActive ? T.primary : T.muted,
                fontWeight: isActive ? 600 : 400,
                fontSize: 13,
                cursor: "pointer",
                fontFamily: T.font,
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.15s",
              }}
            >
              <span>{tab.label}</span>
              <span style={{
                fontSize: 11,
                padding: "1px 6px",
                borderRadius: 10,
                background: isActive ? "hsla(119,99%,46%,0.15)" : "rgba(255,255,255,0.06)",
                color: isActive ? T.primary : T.muted,
              }}>
                {tab.count}
              </span>
            </button>
          )
        })}
      </div>

      {/* Grid Container */}
      <div style={S.aiGridContainer}>
        {charsLoading ? (
          // Shimmers
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ ...S.botCard, background: "transparent", borderColor: "transparent" }}>
              <div className="shimmer" style={{ width: 56, height: 56, borderRadius: 14 }} />
              <div className="shimmer" style={{ height: 16, borderRadius: 6, width: "70%", marginTop: 4 }} />
              <div className="shimmer" style={{ height: 12, borderRadius: 6, width: "100%" }} />
              <div className="shimmer" style={{ height: 12, borderRadius: 6, width: "90%" }} />
            </div>
          ))
        ) : filteredChars.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 60 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
            <h3 style={{ fontSize: 18, color: T.text, fontWeight: 600, marginBottom: 8 }}>No AI personas found</h3>
            <p style={{ color: T.muted, fontSize: 14, marginBottom: 20 }}>
              {searchQuery ? "Try a different search query." : "You haven't created or saved any bots in this view."}
            </p>
            <button
              onClick={onOpenForm}
              style={{
                padding: "10px 22px",
                background: "linear-gradient(135deg, hsl(119,99%,46%) 0%, hsl(119,99%,38%) 100%)",
                border: "none",
                borderRadius: 10,
                color: T.primaryFg,
                fontWeight: 600,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              + Create a Character
            </button>
          </div>
        ) : filterTab === "all" ? (
          <>
            {/* Replicas Section */}
            {replicas.length > 0 && (
              <>
                <div style={{ gridColumn: "1 / -1", fontSize: 15, fontWeight: 700, color: T.text, marginTop: 8, borderBottom: `1px solid ${T.border}`, paddingBottom: 8, display: "flex", alignItems: "center", gap: 8, letterSpacing: "-0.01em" }}>
                  <span>🪞</span> Your Replicas ({replicas.length})
                </div>
                {replicas.map(renderCard)}
              </>
            )}

            {/* Private Bots Section */}
            {privateBots.length > 0 && (
              <>
                <div style={{ gridColumn: "1 / -1", fontSize: 15, fontWeight: 700, color: T.text, marginTop: 20, borderBottom: `1px solid ${T.border}`, paddingBottom: 8, display: "flex", alignItems: "center", gap: 8, letterSpacing: "-0.01em" }}>
                  <span>🔒</span> Custom / Private Bots ({privateBots.length})
                </div>
                {privateBots.map(renderCard)}
              </>
            )}

            {/* Public Bots Section */}
            {publicBots.length > 0 && (
              <>
                <div style={{ gridColumn: "1 / -1", fontSize: 15, fontWeight: 700, color: T.text, marginTop: 20, borderBottom: `1px solid ${T.border}`, paddingBottom: 8, display: "flex", alignItems: "center", gap: 8, letterSpacing: "-0.01em" }}>
                  <span>🌍</span> Public Characters ({publicBots.length})
                </div>
                {publicBots.map(renderCard)}
              </>
            )}
          </>
        ) : (
          filteredChars.map(renderCard)
        )}
      </div>
    </div>
  )
}
