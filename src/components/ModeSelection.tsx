import { T, S } from "../styles"

interface Props {
  onSelect: (mode: "ai" | "people") => void
}

export default function ModeSelection({ onSelect }: Props) {
  return (
    <div style={S.modeWrap}>
      <div>
        <h1 style={S.modeTitle}>Choose Your Experience</h1>
        <p style={{ ...S.authSub, marginTop: 8 }}>How would you like to connect today?</p>
      </div>

      <div style={S.modeCardContainer}>
        {/* Persona Mode Card */}
        <div 
          style={S.modeCard}
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
          <div style={{ ...S.modeIconWrap, background: "hsla(119,99%,46%,0.15)", color: T.primary }}>
            ✦
          </div>
          <div style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8 }}>Persona Mode</h3>
            <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.5 }}>
              Chat with AI personas. Explore existing bots or create your own custom AI companion.
            </p>
          </div>
        </div>

        {/* Person Mode Card */}
        <div 
          style={S.modeCard}
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
          <div style={{ ...S.modeIconWrap, background: "rgba(168,85,247,0.15)", color: "#a855f7" }}>
            ◉
          </div>
          <div style={{ textAlign: "center" }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: T.text, marginBottom: 8 }}>Person Mode</h3>
            <p style={{ fontSize: 14, color: T.muted, lineHeight: 1.5 }}>
              Connect with real people. Send direct messages and manage your human conversations.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
