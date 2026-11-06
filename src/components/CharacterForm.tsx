"use client"
import { useState, useEffect } from "react"
import { supabase } from "../lib/supabase"
import { T } from "../styles"
import ElectricBorder from "./ElectricBorder"

const EMOJIS = ["🤖", "🧙", "🦊", "🐉", "👾", "🧠", "🕵️", "🧜", "🦁", "🎭", "👻", "🤡", "🧛", "🦸", "🧝", "🐱", "🐶", "🚀", "⚡", "🔮"]

const CATEGORIES = [
  { id: "general", label: "🌟 General Companion" },
  { id: "study",   label: "📚 Study & Coding Mentor" },
  { id: "roleplay",label: "🎭 Story & Roleplay" },
  { id: "coach",   label: "💪 Life & Career Coach" },
  { id: "creator", label: "✨ Creator Digital Twin" },
]

const BOUNDARY_PRESETS = [
  "Never agree to lend money or make financial promises",
  "Never share personal phone numbers, home addresses, or passwords",
  "Defer scheduling or binding work commitments until the human user is online",
]

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
    category: initialChar?.category || "general",
    personality: "",
    speakingStyle: "",
    is_public: initialChar?.is_public ?? false,
  })

  // Creative No-Code "Vibe & Boundaries" Sliders
  const [warmthVsWit, setWarmthVsWit] = useState(50) // 0 = Warm/Empathetic, 100 = Witty/Sarcastic
  const [replyLength, setReplyLength] = useState(40) // 0 = Short 1-liners, 100 = Detailed paragraphs
  const [languageMix, setLanguageMix] = useState<"english" | "hinglish" | "multilingual">("english")
  const [selectedBoundaries, setSelectedBoundaries] = useState<string[]>([BOUNDARY_PRESETS[0], BOUNDARY_PRESETS[1]])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initialChar) {
      let prompt = initialChar.system_prompt || ""
      prompt = prompt.replace(new RegExp(`^You are ${initialChar.name}\\.\\s*`, "i"), "")
      const styleMatch = prompt.match(/Speaking style:\s*(.*?)\.\s*(?:Vibe tuning:|Keep replies)/i)
      const speakingStyle = styleMatch ? styleMatch[1] : ""
      const personality = prompt
        .replace(/Speaking style:\s*.*?\.\s*/i, "")
        .replace(/Vibe tuning:[\s\S]*$/i, "")
        .replace(/Keep replies under \d+ words\.\s*/i, "")
        .replace(/Never break character\.\s*/i, "")
        .trim()

      setNewChar({
        name: initialChar.name || "",
        emoji: initialChar.emoji || "🤖",
        category: initialChar.category || "general",
        personality: personality || prompt,
        speakingStyle: speakingStyle,
        is_public: !!initialChar.is_public,
      })
    }
  }, [initialChar])

  function toggleBoundary(b: string) {
    setSelectedBoundaries(prev =>
      prev.includes(b) ? prev.filter(item => item !== b) : [...prev, b]
    )
  }

  function buildVibeDirective() {
    const toneDesc =
      warmthVsWit < 35
        ? "warm, empathetic, supportive, and encouraging"
        : warmthVsWit > 65
        ? "witty, playful, sharp, and lightly sarcastic"
        : "balanced between friendly warmth and clever wit"

    const maxWords = replyLength < 35 ? 35 : replyLength > 70 ? 160 : 85
    const langDesc =
      languageMix === "hinglish"
        ? "Naturally blend casual Hinglish (Hindi + English) expressions where appropriate."
        : languageMix === "multilingual"
        ? "Adapt smoothly to whatever language or slang the user writes in."
        : "Respond in clear, natural English."

    const boundaryText =
      selectedBoundaries.length > 0
        ? ` Guardrails: ${selectedBoundaries.join("; ")}.`
        : ""

    return `Vibe tuning: Maintain a ${toneDesc} tone. ${langDesc}${boundaryText} Keep replies under ${maxWords} words. Never break character.`
  }

  async function handleSave() {
    if (!newChar.name.trim() || !newChar.personality.trim() || !session) return
    setSaving(true)
    const vibeDirective = buildVibeDirective()
    const system_prompt = `You are ${newChar.name}. ${newChar.personality}.${
      newChar.speakingStyle ? " Speaking style: " + newChar.speakingStyle + "." : ""
    } ${vibeDirective}`

    if (initialChar) {
      const { data, error } = await supabase
        .from("characters")
        .update({
          name: newChar.name,
          emoji: newChar.emoji,
          category: newChar.category,
          system_prompt,
          is_public: newChar.is_public,
        })
        .eq("id", initialChar.id)
        .select()
        .single()

      if (!error && data && onUpdated) {
        onUpdated(data)
      }
    } else {
      const { data, error } = await supabase
        .from("characters")
        .insert({
          name: newChar.name,
          emoji: newChar.emoji,
          category: newChar.category,
          system_prompt,
          created_by: session.user.id,
          is_public: newChar.is_public,
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
          }}>{isEditing ? "Edit Character & Vibe" : "Create a Character"}</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: T.muted }}>
            Design your AI persona with custom traits, vibe sliders, and safety boundaries
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
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontWeight: 600, fontSize: 16, color: newChar.name ? T.text : T.muted2, letterSpacing: "-0.02em" }}>
                {newChar.name || "Character name…"}
              </span>
              <span style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                color: T.primary,
                fontWeight: 600,
              }}>
                {CATEGORIES.find(c => c.id === newChar.category)?.label || "Companion"}
              </span>
            </div>
            <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>
              {newChar.personality ? newChar.personality.slice(0, 75) + (newChar.personality.length > 75 ? "…" : "") : "Personality preview…"}
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
        }}
        placeholder="e.g. Socrates, Coding Sensei, Aarav's Twin…"
        value={newChar.name}
        onChange={e => setNewChar({ ...newChar, name: e.target.value })}
      />

      {/* Category */}
      <label style={{
        fontSize: 11,
        color: T.muted,
        display: "block",
        margin: "20px 0 8px",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        fontWeight: 600,
      }}>Marketplace Category</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {CATEGORIES.map(cat => {
          const active = newChar.category === cat.id
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => setNewChar({ ...newChar, category: cat.id })}
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: active ? 700 : 500,
                background: active ? "hsla(119,99%,46%,0.15)" : T.surface,
                border: active ? `1px solid ${T.primary}` : `1px solid ${T.border}`,
                color: active ? T.primary : T.muted,
                cursor: "pointer",
                fontFamily: T.font,
              }}
            >
              {cat.label}
            </button>
          )
        })}
      </div>

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
      }}>Personality & Backstory *</label>
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
          minHeight: 80,
        }}
        rows={3}
        placeholder="e.g. A sharp full-stack startup mentor who explains system design using real-world analogies"
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
        }}
        placeholder="e.g. Uses bullet points, asks thought-provoking follow-ups"
        value={newChar.speakingStyle}
        onChange={e => setNewChar({ ...newChar, speakingStyle: e.target.value })}
      />

      {/* ── Creative Feature: Vibe & Boundaries No-Code Tuner ───────── */}
      <div style={{
        marginTop: 22,
        padding: 18,
        background: T.surface,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}>
          <span>🎛️</span> Vibe &amp; Boundaries Tuner
        </div>
        <p style={{ fontSize: 11, color: T.muted, margin: "0 0 14px" }}>
          Fine-tune how this persona (or your Digital Replica) responds without writing complex prompt code.
        </p>

        {/* Tone slider */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.muted, marginBottom: 4 }}>
            <span>🤝 Warm &amp; Empathetic</span>
            <strong style={{ color: T.primary }}>Tone Balance ({warmthVsWit}%)</strong>
            <span>⚡ Witty &amp; Sarcastic</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={warmthVsWit}
            onChange={e => setWarmthVsWit(Number(e.target.value))}
            style={{ width: "100%", accentColor: "hsl(119, 99%, 46%)" }}
          />
        </div>

        {/* Length slider */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.muted, marginBottom: 4 }}>
            <span>💬 Punchy 1-Liners</span>
            <strong style={{ color: T.primary }}>Reply Length ({replyLength}%)</strong>
            <span>📜 Deep Paragraphs</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={replyLength}
            onChange={e => setReplyLength(Number(e.target.value))}
            style={{ width: "100%", accentColor: "hsl(119, 99%, 46%)" }}
          />
        </div>

        {/* Language mix */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, marginBottom: 6 }}>Language Vibe</div>
          <div style={{ display: "flex", gap: 8 }}>
            {([
              { id: "english", label: "🇬🇧 English" },
              { id: "hinglish", label: "🇮🇳 Hinglish Mix" },
              { id: "multilingual", label: "🌐 Auto-Adapt" },
            ] as const).map(lang => (
              <button
                key={lang.id}
                type="button"
                onClick={() => setLanguageMix(lang.id)}
                style={{
                  flex: 1,
                  padding: "7px 10px",
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: languageMix === lang.id ? "hsla(119,99%,46%,0.15)" : T.bgAlt,
                  border: languageMix === lang.id ? `1px solid ${T.primary}` : `1px solid ${T.border}`,
                  color: languageMix === lang.id ? T.primary : T.muted,
                  fontFamily: T.font,
                }}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* Safe Boundaries */}
        <div>
          <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, marginBottom: 6 }}>Safety &amp; Replica Boundaries</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {BOUNDARY_PRESETS.map(b => {
              const checked = selectedBoundaries.includes(b)
              return (
                <label
                  key={b}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12,
                    color: checked ? T.text : T.muted,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleBoundary(b)}
                    style={{ accentColor: "hsl(119, 99%, 46%)" }}
                  />
                  <span>{b}</span>
                </label>
              )
            })}
          </div>
        </div>
      </div>

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
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
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
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <span>🌍</span> Public Marketplace
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
          }}
        >
          {saving ? "⏳ Saving…" : isEditing ? "✓ Save Changes" : "✦ Create & Chat"}
        </button>
      </div>
    </div>
  )
}