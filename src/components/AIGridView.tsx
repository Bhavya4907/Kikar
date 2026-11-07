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
          padding: 16,
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
            <div style={{ ...S.botAvatar, width: 48, height: 48, fontSize: 24 }}>{c.emoji}</div>

            {(isOwner || isReplica) && (
              <div style={{ display: "flex", gap: 4 }} onClick={e => e.stopPropagation()}>
                {isOwner && !isReplica && onEditChar && (
                  <button
                    type="button"
                    onClick={e => handleEditClick(e, c)}
                    title="Edit character"
                    style={{
                      background: "rgba(255,255,255,0.06)",
                      border: `1px solid ${T.border}`,
                      borderRadius: 8,
                      width: 28,
                      height: 28,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: T.muted,
                      cursor: "pointer",
                      fontSize: 12,
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
                      width: 28,
                      height: 28,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: T.muted,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    🗑️
                  </button>
                )}
              </div>
            )}
          </div>

          <div>
            <div style={{ ...S.botName, fontSize: 15 }}>{c.name}</div>
            {c.is_replica ? (
              <div style={{ fontSize: 11, color: "#a855f7", marginTop: 2, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                <span>🪞</span> Replica
              </div>
            ) : isOwner ? (
              <div style={{ fontSize: 11, color: T.primary, marginTop: 2, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                <span>✦</span> {c.is_public ? "Public" : "Private"}
              </div>
            ) : (
              <div style={{ fontSize: 11, color: T.muted, marginTop: 2, fontWeight: 500 }}>
                🌍 Community
              </div>
            )}
          </div>

          <div style={{ ...S.botDesc, fontSize: 12, marginTop: 6 }}>
            {c.system_prompt
              ? c.system_prompt.replace(/You are .*?\. /i, "").substring(0, 95) + (c.system_prompt.length > 95 ? "..." : "")
              : "An AI persona ready to chat."}
          </div>
        </div>

        <div style={{
          marginTop: 12,
          paddingTop: 8,
          borderTop: `1px solid ${T.border}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: 11,
          color: T.muted,
        }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.primary }} />
            Online
          </span>
          <span style={{ color: T.primary, fontWeight: 600 }}>Chat →</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...S.aiGridWrap, height: "100dvh", overflow: "hidden" }}>
      {/* Mobile-Responsive Header */}
      <div className="cc-grid-header">
        {/* Top Left: People Mode Switcher */}
        <button
          type="button"
          onClick={() => setView("people")}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 12px",
            background: "rgba(168,85,247,0.12)",
            border: "1px solid rgba(168,85,247,0.35)",
            borderRadius: 10,
            color: "#c084fc",
            fontWeight: 600,
            fontSize: 13,
            cursor: "pointer",
            fontFamily: T.font,
            flexShrink: 0,
          }}
        >
          <span>◉</span>
          <span>People</span>
        </button>

        {/* Center (or Full-Width Row 2 on Mobile): Search Bar */}
        <div className="cc-grid-search">
          <input
            style={{
              width: "100%",
              padding: "9px 14px",
              background: T.bgAlt,
              border: `1px solid ${T.border}`,
              borderRadius: 10,
              color: T.text,
              fontSize: 15,
              fontFamily: T.font,
              outline: "none",
            }}
            placeholder="Search AI personas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Top Right: Upgrade, Profile, Sign Out, Create */}
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          {onOpenPricing && (
            <button
              type="button"
              onClick={onOpenPricing}
              title="Upgrade Kikar Plan"
              style={{
                padding: "0 10px",
                height: 34,
                background: planTier === "free" ? "rgba(168,85,247,0.14)" : "hsla(119,99%,46%,0.14)",
                border: planTier === "free" ? "1px solid rgba(168,85,247,0.4)" : `1px solid ${T.primary}`,
                borderRadius: 9,
                color: planTier === "free" ? "#c084fc" : T.primary,
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 700,
                fontFamily: T.font,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>⚡</span>
              <span>{planTier === "free" ? "Plus" : planTier.toUpperCase()}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenProfile}
            title="Profile & Replica Settings"
            style={{
              width: 34,
              height: 34,
              background: T.bgAlt,
              border: `1px solid ${T.border}`,
              borderRadius: 9,
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
              padding: "0 9px",
              height: 34,
              background: T.bgAlt,
              border: `1px solid ${T.border}`,
              borderRadius: 9,
              color: T.muted,
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              fontFamily: T.font,
            }}
          >OUT</button>

          <button
            type="button"
            onClick={onOpenForm}
            style={{
              padding: "0 12px",
              height: 34,
              background: "linear-gradient(135deg, hsl(119,99%,46%) 0%, hsl(119,99%,38%) 100%)",
              border: "none",
              borderRadius: 9,
              fontWeight: 700,
              fontSize: 12,
              cursor: "pointer",
              color: T.primaryFg,
              fontFamily: T.font,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <span>+</span>
            <span>Create</span>
          </button>
        </div>
      </div>

      {/* 24-Hour AI Story Rings Strip */}
      {characters.length > 0 && (
        <div className="cc-story-strip">
          <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0 }}>
            🔥 Stories
          </div>
          {characters.slice(0, 8).map(c => (
            <button
              key={`story-${c.id}`}
              type="button"
              onClick={() => onOpenChar(c)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 10px 4px 5px",
                background: T.surface,
                border: c.is_replica ? "1.5px solid #a855f7" : "1.5px solid hsla(119,99%,46%,0.45)",
                borderRadius: 999,
                cursor: "pointer",
                flexShrink: 0,
                fontFamily: T.font,
              }}
            >
              <span style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: T.bgAlt,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 13,
              }}>
                {c.emoji}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.text }}>
                {c.name}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Filter Tabs Bar */}
      <div className="cc-filter-tabs">
        {([
          { id: "all", label: "🌟 All", count: characters.length },
          { id: "my", label: "👤 My Bots", count: characters.filter(c => c.created_by === session?.user?.id || c.is_replica).length },
          { id: "replicas", label: "🪞 Replicas", count: characters.filter(c => c.is_replica).length },
          { id: "public", label: "🌍 Public", count: characters.filter(c => !c.is_replica && c.is_public).length },
        ] as const).map(tab => {
          const isActive = filterTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id)}
              style={{
                padding: "7px 12px 10px",
                background: "transparent",
                border: "none",
                borderBottom: isActive ? `2px solid ${T.primary}` : "2px solid transparent",
                color: isActive ? T.primary : T.muted,
                fontWeight: isActive ? 600 : 400,
                fontSize: 12,
                cursor: "pointer",
                fontFamily: T.font,
                display: "flex",
                alignItems: "center",
                gap: 5,
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              <span>{tab.label}</span>
              <span style={{
                fontSize: 10,
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

      {/* Responsive Grid Container */}
      <div className="cc-grid-container">
        {charsLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ ...S.botCard, background: "transparent", borderColor: "transparent" }}>
              <div className="shimmer" style={{ width: 48, height: 48, borderRadius: 12 }} />
              <div className="shimmer" style={{ height: 14, borderRadius: 6, width: "70%", marginTop: 4 }} />
              <div className="shimmer" style={{ height: 11, borderRadius: 6, width: "100%" }} />
            </div>
          ))
        ) : filteredChars.length === 0 ? (
          <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>🤖</div>
            <h3 style={{ fontSize: 17, color: T.text, fontWeight: 600, marginBottom: 6 }}>No AI personas found</h3>
            <p style={{ color: T.muted, fontSize: 13, marginBottom: 18 }}>
              {searchQuery ? "Try a different search query." : "Create your first AI character to start chatting."}
            </p>
            <button
              type="button"
              onClick={onOpenForm}
              style={{
                padding: "10px 20px",
                background: "linear-gradient(135deg, hsl(119,99%,46%) 0%, hsl(119,99%,38%) 100%)",
                border: "none",
                borderRadius: 10,
                color: T.primaryFg,
                fontWeight: 700,
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
                <div style={{ gridColumn: "1 / -1", fontSize: 14, fontWeight: 700, color: T.text, marginTop: 4, borderBottom: `1px solid ${T.border}`, paddingBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>🪞</span> Your Digital Replicas ({replicas.length})
                </div>
                {replicas.map(renderCard)}
              </>
            )}

            {privateBots.length > 0 && (
              <>
                <div style={{ gridColumn: "1 / -1", fontSize: 14, fontWeight: 700, color: T.text, marginTop: 14, borderBottom: `1px solid ${T.border}`, paddingBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>🔒</span> Custom / Private Bots ({privateBots.length})
                </div>
                {privateBots.map(renderCard)}
              </>
            )}

            {publicBots.length > 0 && (
              <>
                <div style={{ gridColumn: "1 / -1", fontSize: 14, fontWeight: 700, color: T.text, marginTop: 14, borderBottom: `1px solid ${T.border}`, paddingBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <span>🌍</span> Public Marketplace ({publicBots.length})
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
