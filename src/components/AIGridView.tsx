"use client"
import { useState } from "react"
import { T, S } from "../styles"
import type { PlanTier } from "../lib/types"

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
  planTier?: PlanTier
  onOpenPricing?: () => void
}

export default function AIGridView({
  characters,
  charsLoading,
  session,
  onOpenChar,
  onOpenForm,
  onEditChar,
  onDeleteCharacter,
  setView,
  onOpenProfile,
  onSignOut,
  planTier = "free",
  onOpenPricing,
}: Props) {
  const [searchQuery, setSearchQuery] = useState("")
  const [filterTab, setFilterTab] = useState<"all" | "my" | "replicas" | "public">("all")
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const filteredChars = characters.filter(c => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div style={S.botAvatar}>{c.emoji}</div>

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
            ) : (
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2, fontWeight: 500 }}>
                🌍 Community Persona
              </div>
            )}
          </div>

          <div style={{ ...S.botDesc, marginTop: 8 }}>
            {c.system_prompt
              ? c.system_prompt.replace(/You are .*?\. /i, "").substring(0, 110) + (c.system_prompt.length > 110 ? "..." : "")
              : "An AI persona ready to chat."}
          </div>
        </div>

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
          }}
        >
          <span>◉</span>
          <span>People &amp; Replicas</span>
        </button>

        {/* Center: Search Bar */}
        <div style={{ flex: 1, maxWidth: 360, margin: "0 12px" }}>
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
          />
        </div>

        {/* Top Right: Upgrade / Plan, Profile, Sign Out, Create */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {onOpenPricing && (
            <button
              type="button"
              onClick={onOpenPricing}
              title="Upgrade Kikar Plan"
              style={{
                padding: "0 12px",
                height: 36,
                background: planTier === "free" ? "rgba(168,85,247,0.14)" : "hsla(119,99%,46%,0.14)",
                border: planTier === "free" ? "1px solid rgba(168,85,247,0.4)" : `1px solid ${T.primary}`,
                borderRadius: 10,
                color: planTier === "free" ? "#c084fc" : T.primary,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                fontFamily: T.font,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span>⚡</span>
              <span>{planTier === "free" ? "Upgrade Plus" : `${planTier.toUpperCase()} Plan`}</span>
            </button>
          )}

          <button
            onClick={onOpenProfile}
            title="Profile & Replica Settings"
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
              boxShadow: "0 4px 16px hsla(119,99%,46%,0.2)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span>+</span> Create Bot
          </button>
        </div>
      </div>

      {/* ── Creative Feature: 24-Hour AI Story Rings & Daily Icebreakers ── */}
      {characters.length > 0 && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "12px 32px",
          background: T.bg,
          borderBottom: `1px solid ${T.border}`,
          overflowX: "auto",
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
            🔥 Live AI Stories
          </div>
          {characters.slice(0, 8).map(c => (
            <button
              key={`story-${c.id}`}
              type="button"
              onClick={() => onOpenChar(c)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "5px 12px 5px 6px",
                background: T.surface,
                border: c.is_replica ? "1.5px solid #a855f7" : "1.5px solid hsla(119,99%,46%,0.45)",
                borderRadius: 999,
                cursor: "pointer",
                flexShrink: 0,
                fontFamily: T.font,
              }}
              title={`Tap to jump into a live conversation with ${c.name}`}
            >
              <span style={{
                width: 26,
                height: 26,
                borderRadius: "50%",
                background: T.bgAlt,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
              }}>
                {c.emoji}
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.text }}>
                {c.name}
              </span>
              <span style={{ fontSize: 10, color: c.is_replica ? "#c084fc" : T.primary }}>
                {c.is_replica ? "🪞 Active" : "✦ Ask me"}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Filter Tabs Bar */}
      <div style={{
        display: "flex",
        padding: "12px 32px 0",
        gap: 8,
        borderBottom: `1px solid ${T.border}`,
        background: T.surface,
        flexShrink: 0,
        overflowX: "auto",
      }}>
        {([
          { id: "all", label: "🌟 All Characters", count: characters.length },
          { id: "my", label: "👤 My Bots", count: characters.filter(c => c.created_by === session?.user?.id || c.is_replica).length },
          { id: "replicas", label: "🪞 Replicas", count: characters.filter(c => c.is_replica).length },
          { id: "public", label: "🌍 Community Marketplace", count: characters.filter(c => !c.is_replica && c.is_public).length },
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
                flexShrink: 0,
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
            {replicas.length > 0 && (
              <>
                <div style={{ gridColumn: "1 / -1", fontSize: 15, fontWeight: 700, color: T.text, marginTop: 8, borderBottom: `1px solid ${T.border}`, paddingBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>🪞</span> Your Digital Replicas ({replicas.length})
                </div>
                {replicas.map(renderCard)}
              </>
            )}

            {privateBots.length > 0 && (
              <>
                <div style={{ gridColumn: "1 / -1", fontSize: 15, fontWeight: 700, color: T.text, marginTop: 20, borderBottom: `1px solid ${T.border}`, paddingBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>🔒</span> Custom / Private Bots ({privateBots.length})
                </div>
                {privateBots.map(renderCard)}
              </>
            )}

            {publicBots.length > 0 && (
              <>
                <div style={{ gridColumn: "1 / -1", fontSize: 15, fontWeight: 700, color: T.text, marginTop: 20, borderBottom: `1px solid ${T.border}`, paddingBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
                  <span>🌍</span> Public Marketplace Characters ({publicBots.length})
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
