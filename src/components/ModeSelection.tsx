import { T, S } from "../styles"

interface Props {
  onSelect: (mode: "ai" | "people" | "radar") => void
}

export default function ModeSelection({ onSelect }: Props) {
  return (
    <div style={{
      ...S.modeWrap,
      minHeight: "100dvh",
      width: "100%",
      overflowY: "auto",
      padding: "24px 16px",
      gap: 24,
    }}>
      <div style={{ textAlign: "center" }}>
        <h1 style={{ ...S.modeTitle, fontSize: "clamp(22px, 5vw, 30px)" }}>Choose Your Experience</h1>
        <p style={{ ...S.authSub, marginTop: 6 }}>How would you like to connect on Kikar today?</p>
      </div>

      <div style={{
        ...S.modeCardContainer,
        gap: 16,
        maxWidth: 960,
      }}>
        {/* Persona Mode Card */}
        <div
          style={{
            ...S.modeCard,
            flex: "1 1 240px",
            padding: "24px 18px",
          }}
          onClick={() => onSelect("ai")}
          onMouseEnter={e => {
            const el = e.currentTarget
            el.style.transform = S.modeCardHoverAI.transform as string
            el.style.borderColor = S.modeCardHoverAI.borderColor as string
            el.style.boxShadow = S.modeCardHoverAI.boxShadow as string
          }}
          onMouseLeave={e => {
            const el = e.currentTarget
            el.style.transform = "translateY(0)"
            el.style.borderColor = T.border
            el.style.boxShadow = "none"
          }}
        >
          <div style={{ ...S.modeIconWrap, width: 56, height: 56, fontSize: 28, background: "hsla(119,99%,46%,0.15)", color: T.primary }}>
            ✦
          </div>
          <div style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 6 }}>Persona Mode</h3>
            <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.5, margin: 0 }}>
              Chat with custom AI personas. Explore existing bots or tune vibe sliders and boundaries.
            </p>
          </div>
        </div>

        {/* Person / Fellows Mode Card */}
        <div
          style={{
            ...S.modeCard,
            flex: "1 1 240px",
            padding: "24px 18px",
          }}
          onClick={() => onSelect("people")}
          onMouseEnter={e => {
            const el = e.currentTarget
            el.style.transform = S.modeCardHoverPeople.transform as string
            el.style.borderColor = S.modeCardHoverPeople.borderColor as string
            el.style.boxShadow = S.modeCardHoverPeople.boxShadow as string
          }}
          onMouseLeave={e => {
            const el = e.currentTarget
            el.style.transform = "translateY(0)"
            el.style.borderColor = T.border
            el.style.boxShadow = "none"
          }}
        >
          <div style={{ ...S.modeIconWrap, width: 56, height: 56, fontSize: 28, background: "rgba(168,85,247,0.15)", color: "#a855f7" }}>
            👥
          </div>
          <div style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 6 }}>Fellows Mode</h3>
            <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.5, margin: 0 }}>
              Connect with real people. Send private direct messages or chat with offline Digital Replicas.
            </p>
          </div>
        </div>

        {/* Radar / Stranger Connect Mode Card */}
        <div
          style={{
            ...S.modeCard,
            flex: "1 1 240px",
            padding: "24px 18px",
          }}
          onClick={() => onSelect("radar")}
          onMouseEnter={e => {
            const el = e.currentTarget
            el.style.transform = "translateY(-4px)"
            el.style.borderColor = "#38bdf8"
            el.style.boxShadow = "0 16px 40px rgba(56,189,248,0.2)"
          }}
          onMouseLeave={e => {
            const el = e.currentTarget
            el.style.transform = "translateY(0)"
            el.style.borderColor = T.border
            el.style.boxShadow = "none"
          }}
        >
          <div style={{ ...S.modeIconWrap, width: 56, height: 56, fontSize: 28, background: "rgba(56,189,248,0.15)", color: "#38bdf8" }}>
            ⚡
          </div>
          <div style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 6 }}>Radar Match</h3>
            <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.5, margin: 0 }}>
              Meet live strangers anonymously. Break the ice with @ai wingman and skip or add friends anytime.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
