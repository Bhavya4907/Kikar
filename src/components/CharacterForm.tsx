"use client"
import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase"
import { T } from "../styles"
import ElectricBorder from "./ElectricBorder"

const EMOJIS = ["🤖", "🧙", "🦊", "🐉", "👾", "🧠", "🕵️", "🧜", "🦁", "🎭", "👻", "🤡", "🧛", "🦸", "🧝", "🐱", "🐶", "🚀", "⚡", "🔮"]

interface Props {
  session: any
  initialChar?: any
  onCreated: (char: any) => void
  onUpdated?: (char: any) => void
  onCancel: () => void
}

export default function CharacterForm({ session, initialChar, onCreated, onUpdated, onCancel }: Props) {
  const [newChar, setNewChar] = useState({
    name: initialChar?.name || "",
    emoji: initialChar?.emoji || "🤖",
    personality: "",
    speakingStyle: "",
    is_public: initialChar?.is_public ?? false
  })
  const [saving, setSaving] = useState(false)

  // Extract personality and speaking style from existing system_prompt if editing
  useEffect(() => {
    if (initialChar) {
      let prompt = initialChar.system_prompt || ""
      // Remove prefix "You are <name>. "
      prompt = prompt.replace(new RegExp(`^You are ${initialChar.name}\\.\\s*`, 'i'), "")
      // Extract Speaking style if present
      const styleMatch = prompt.match(/Speaking style:\s*(.*?)\.\s*Keep replies/i)
      const speakingStyle = styleMatch ? styleMatch[1] : ""
      // Remove speaking style and suffix
      const personality = prompt
        .replace(/Speaking style:\s*.*?\.\s*/i, "")
        .replace(/Keep replies under \d+ words\.\s*/i, "")
        .replace(/Never break character\.\s*/i, "")
        .trim()

      setNewChar({
        name: initialChar.name || "",
        emoji: initialChar.emoji || "🤖",
        personality: personality || prompt,
        speakingStyle: speakingStyle,
        is_public: !!initialChar.is_public
      })
    }
  }, [initialChar])

  async function handleSave() {
    if (!newChar.name.trim() || !newChar.personality.trim() || !session) return
    setSaving(true)
    const system_prompt = `You are ${newChar.name}. ${newChar.personality}.${newChar.speakingStyle ? " Speaking style: " + newChar.speakingStyle + "." : ""} Keep replies under 100 words. Never break character.`
    
    if (initialChar) {
      const { data, error } = await supabase.from("characters")
        .update({
          name: newChar.name,
          emoji: newChar.emoji,
          system_prompt,
          is_public: newChar.is_public
        })
        .eq("id", initialChar.id)
        .select()
        .single()
      
      if (!error && data && onUpdated) {
        onUpdated(data)
      }
    } else {
      const { data, error } = await supabase.from("characters")
        .insert({
          name: newChar.name,
          emoji: newChar.emoji,
          system_prompt,
          created_by: session.user.id,
          is_public: newChar.is_public
        })
        .select()
        .single()
      if (!error && data) onCreated(data)
    }

    setSaving(false)
  }

  const isEditing = !!initialChar

  return (
    <div style={{
      flex: 1,
      overflowY: "auto",
      padding: "24px 20px",
      background: T.bgAlt,
      fontFamily: T.font,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button
          className="cc-back-btn"
          onClick={onCancel}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: T.surface,
            border: `1px solid ${T.border}`,
            color: T.text,
            fontSize: 16,
            cursor: "pointer",
            width: 34,
            height: 34,
            borderRadius: 8,
            flexShrink: 0,
          }}
        >←</button>

        <div>
          <h2 style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            color: T.text,
            letterSpacing: "-0.03em",
          }}>{isEditing ? "Edit Character" : "Create a Character"}</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: T.muted }}>
            {isEditing ? "Customize your AI persona's traits and behavior" : "Design a custom AI persona to chat with"}
          </p>
        </div>
      </div>

      {/* Electric Border Wrapped Character Preview Card */}
      <ElectricBorder
        color="hsl(119, 99%, 46%)"
        speed={1}
        chaos={0.1}
        borderRadius={16}
        style={{ marginBottom: 24 }}
      >
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "18px 20px",
          background: T.surface,
          borderRadius: 16,
        }}>
          <div style={{
            width: 54,
            height: 54,
            borderRadius: 14,
            background: "hsla(119,99%,46%,0.15)",
            border: "1px solid hsla(119,99%,46%,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            boxShadow: "0 0 20px hsla(119,99%,46%,0.2)",
          }}>{newChar.emoji}</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16, color: newChar.name ? T.text : T.muted2, letterSpacing: "-0.02em" }}>
              {newChar.name || "Character name…"}
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>
              {newChar.personality ? newChar.personality.slice(0, 65) + (newChar.personality.length > 65 ? "…" : "") : "Personality preview…"}
            </div>
          </div>
        </div>
      </ElectricBorder>

      {/* Name */}
      <label style={{
        fontSize: 11,
        color: T.muted,
        display: "block",
        marginBottom: 6,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        fontWeight: 600,
      }}>Name</label>
      <input
        style={{
          width: "100%",
          padding: "12px 16px",
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          color: T.text,
          fontSize: 14,
          fontFamily: T.font,
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 0.18s, box-shadow 0.18s",
        }}
        placeholder="e.g. Socrates, Iron Man, Coach Yoda…"
        value={newChar.name}
        onChange={e => setNewChar({ ...newChar, name: e.target.value })}
      />

      {/* Emoji picker */}
      <label style={{
        fontSize: 11,
        color: T.muted,
        display: "block",
        margin: "20px 0 8px",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        fontWeight: 600,
      }}>Pick an Emoji</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {EMOJIS.map(em => {
          const isSelected = newChar.emoji === em
          return (
            <button key={em}
              type="button"
              onClick={() => setNewChar({ ...newChar, emoji: em })}
              style={{
                fontSize: 22,
                padding: "8px 10px",
                background: isSelected ? "hsla(119,99%,46%,0.15)" : T.surface,
                border: isSelected
                  ? "1px solid hsla(119,99%,46%,0.6)"
                  : `1px solid ${T.border}`,
                borderRadius: 10,
                cursor: "pointer",
                transform: isSelected ? "scale(1.1)" : "scale(1)",
                boxShadow: isSelected ? "0 0 14px hsla(119,99%,46%,0.3)" : "none",
                transition: "all 0.15s ease",
              }}
            >{em}</button>
          )
        })}
      </div>

      {/* Personality */}
      <label style={{
        fontSize: 11,
        color: T.muted,
        display: "block",
        margin: "20px 0 6px",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        fontWeight: 600,
      }}>Personality *</label>
      <textarea
        style={{
          width: "100%",
          padding: "12px 16px",
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          color: T.text,
          fontSize: 14,
          fontFamily: T.font,
          outline: "none",
          resize: "vertical",
          boxSizing: "border-box",
          transition: "border-color 0.18s, box-shadow 0.18s",
          minHeight: 80,
        }}
        rows={3}
        placeholder="e.g. A wise philosopher who questions everything and uses the Socratic method"
        value={newChar.personality}
        onChange={e => setNewChar({ ...newChar, personality: e.target.value })}
      />

      {/* Speaking style */}
      <label style={{
        fontSize: 11,
        color: T.muted,
        display: "block",
        margin: "20px 0 6px",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        fontWeight: 600,
      }}>Speaking Style <span style={{ color: T.muted2, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
      <input
        style={{
          width: "100%",
          padding: "12px 16px",
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 10,
          color: T.text,
          fontSize: 14,
          fontFamily: T.font,
          outline: "none",
          boxSizing: "border-box",
          transition: "border-color 0.18s, box-shadow 0.18s",
        }}
        placeholder="e.g. Uses rhetorical questions, very formal, concise"
        value={newChar.speakingStyle}
        onChange={e => setNewChar({ ...newChar, speakingStyle: e.target.value })}
      />

      {/* Visibility */}
      <label style={{
        fontSize: 11,
        color: T.muted,
        display: "block",
        margin: "20px 0 6px",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        fontWeight: 600,
      }}>Visibility</label>
      <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
        <button
          type="button"
          onClick={() => setNewChar({ ...newChar, is_public: false })}
          style={{
            flex: 1,
            padding: "12px 14px",
            background: !newChar.is_public ? "rgba(255,255,255,0.06)" : T.surface,
            border: !newChar.is_public ? `1px solid ${T.primary}` : `1px solid ${T.border}`,
            borderRadius: 10,
            color: !newChar.is_public ? T.primary : T.muted,
            cursor: "pointer",
            fontWeight: 600,
            fontFamily: T.font,
            transition: "all 0.15s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6
          }}
        >
          <span>🔒</span> Private
        </button>
        <button
          type="button"
          onClick={() => setNewChar({ ...newChar, is_public: true })}
          style={{
            flex: 1,
            padding: "12px 14px",
            background: newChar.is_public ? "rgba(255,255,255,0.06)" : T.surface,
            border: newChar.is_public ? `1px solid ${T.primary}` : `1px solid ${T.border}`,
            borderRadius: 10,
            color: newChar.is_public ? T.primary : T.muted,
            cursor: "pointer",
            fontWeight: 600,
            fontFamily: T.font,
            transition: "all 0.15s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6
          }}
        >
          <span>🌍</span> Public
        </button>
      </div>

      {/* Buttons */}
      <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
        <button
          type="button"
          onClick={onCancel}
          style={{
            flex: 1,
            padding: "13px 0",
            background: "transparent",
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            color: T.muted,
            fontSize: 13,
            fontFamily: T.font,
            fontWeight: 500,
            cursor: "pointer",
            transition: "border-color 0.18s, color 0.18s",
          }}
        >Cancel</button>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !newChar.name.trim() || !newChar.personality.trim()}
          style={{
            flex: 2,
            padding: "13px 0",
            background: saving || !newChar.name.trim() || !newChar.personality.trim()
              ? T.surface
              : "linear-gradient(135deg, hsl(119,99%,46%) 0%, hsl(119,99%,38%) 100%)",
            border: `1px solid ${saving || !newChar.name.trim() || !newChar.personality.trim() ? T.border : "transparent"}`,
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            fontFamily: T.font,
            cursor: saving || !newChar.name.trim() || !newChar.personality.trim() ? "not-allowed" : "pointer",
            color: saving || !newChar.name.trim() || !newChar.personality.trim() ? T.muted : T.primaryFg,
            letterSpacing: "0.01em",
            boxShadow: saving || !newChar.name.trim() || !newChar.personality.trim()
              ? "none"
              : "0 4px 20px hsla(119,99%,46%,0.25)",
            transition: "all 0.18s",
          }}
        >
          {saving ? "⏳ Saving…" : isEditing ? "✓ Save Changes" : "✦ Create & Chat"}
        </button>
      </div>
    </div>
  )
}