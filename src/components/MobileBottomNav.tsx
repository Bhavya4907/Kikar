"use client"
import { T } from "../styles"
import { Icon, type IconName } from "./Icons"
import type { PlanTier } from "../lib/types"

interface Props {
  view: "ai" | "people" | "radar"
  setView: (v: "ai" | "people" | "radar") => void
  showProfile: boolean
  onOpenProfile: () => void
  onCloseProfile: () => void
  activeChar: any
  activeConvo: any
  showForm: boolean
  onlineCount: number
  profile: any
  planTier?: PlanTier
}

export default function MobileBottomNav({
  view,
  setView,
  showProfile,
  onOpenProfile,
  onCloseProfile,
  activeChar,
  activeConvo,
  showForm,
  onlineCount,
  profile,
}: Props) {
  // Hide bottom nav while inside an active chat session or character creator
  // so the mobile keyboard has maximum screen estate
  const isChatting = Boolean(activeChar || activeConvo || showForm)
  if (isChatting) return null

  const tabs: Array<{
    id: "ai" | "people" | "radar" | "me"
    label: string
    icon: IconName | "avatar"
    activeColor: string
    badge?: number
  }> = [
    {
      id: "ai",
      label: "Personas",
      icon: "spark",
      activeColor: "hsl(226,72%,70%)",
    },
    {
      id: "people",
      label: "Fellows",
      icon: "users",
      activeColor: "#b3a8f8",
      badge: onlineCount,
    },
    {
      id: "radar",
      label: "Radar",
      icon: "radar",
      activeColor: "#62b5d9",
    },
    {
      id: "me",
      label: "Profile",
      icon: profile?.avatar_url ? "avatar" : "user",
      activeColor: "#f4f5f7",
    },
  ]

  function handleTabClick(tabId: "ai" | "people" | "radar" | "me") {
    if (tabId === "me") {
      onOpenProfile()
      return
    }

    if (showProfile) {
      onCloseProfile()
    }
    setView(tabId)
  }

  return (
    <nav
      className="cc-mobile-bottom-nav"
      aria-label="Mobile Navigation"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 90,
        height: "calc(60px + env(safe-area-inset-bottom, 8px))",
        paddingBottom: "env(safe-area-inset-bottom, 8px)",
        background: "rgb(16, 16, 18)",
        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-around",
        boxShadow: "0 -8px 32px rgba(0, 0, 0, 0.7)",
        userSelect: "none",
        WebkitUserSelect: "none",
        touchAction: "manipulation",
      }}
    >
      {tabs.map((tab) => {
        const isActive =
          tab.id === "me"
            ? showProfile
            : !showProfile && view === tab.id

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => handleTabClick(tab.id)}
            style={{
              flex: 1,
              height: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 3,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              position: "relative",
              padding: "4px 0",
              transition: "transform 0.15s ease, opacity 0.15s ease",
            }}
          >
            {/* Top glowing bar indicator for active tab */}
            {isActive && (
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  width: 32,
                  height: 3,
                  borderRadius: "0 0 3px 3px",
                  background: tab.activeColor,
                  boxShadow: `0 2px 10px ${tab.activeColor}`,
                }}
              />
            )}

            {/* Icon container */}
            <div
              style={{
                position: "relative",
                width: 28,
                height: 28,
                borderRadius: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: tab.id === "ai" ? 17 : 16,
                background: isActive ? `${tab.activeColor}22` : "transparent",
                color: isActive ? tab.activeColor : T.muted,
                transition: "background-color 0.18s, border-color 0.18s, color 0.18s, opacity 0.18s, box-shadow 0.18s, transform 0.18s ease",
              }}
            >
              {tab.icon === "avatar" && profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt="Profile"
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: "50%",
                    objectFit: "cover",
                    border: isActive ? `1.5px solid ${tab.activeColor}` : "1.5px solid transparent",
                  }}
                />
              ) : (
                <Icon name={tab.icon as IconName} size={tab.id === "ai" ? 19 : 18} />
              )}

              {/* Online fellows green pulse badge */}
              {tab.id === "people" && (tab.badge ?? 0) > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: 2,
                    right: 2,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#4fb987",
                    boxShadow: "0 0 8px #4fb987",
                  }}
                />
              )}
            </div>

            {/* Label */}
            <span
              style={{
                fontSize: 10,
                fontWeight: isActive ? 700 : 500,
                color: isActive ? tab.activeColor : T.muted,
                letterSpacing: "-0.01em",
                fontFamily: T.font,
                transition: "color 0.18s ease",
              }}
            >
              {tab.label}
            </span>
          </button>
        )
      })}
    </nav>
  )
}
