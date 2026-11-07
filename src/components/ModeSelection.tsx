import { T, S } from "../styles"

interface Props {
  onSelect: (mode: "ai" | "people") => void
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
      <div>
        <h1 style={{ ...S.modeTitle, fontSize: "clamp(22px, 5vw, 28px)" }}>Choose Your Experience</h1>
        <p style={{ ...S.authSub, marginTop: 6 }}>How would you like to connect today?</p>
      </div>

      <div style={{
        ...S.modeCardContainer,
        gap: 16,
      }}>
        {/* Persona Mode Card */}
        <div
          style={{
            ...S.modeCard,
            flex: "1 1 250px",
            padding: "24px 20px",
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
              Chat with AI personas. Explore existing bots or create your own custom AI companion.
            </p>
          </div>
        </div>

        {/* Person Mode Card */}
        <div
          style={{
            ...S.modeCard,
            flex: "1 1 250px",
            padding: "24px 20px",
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
            ◉
          </div>
          <div style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 6 }}>Person Mode</h3>
            <p style={{ fontSize: 13, color: T.muted, lineHeight: 1.5, margin: 0 }}>
              Connect with real people. Send live direct messages or chat with offline Digital Replicas.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
