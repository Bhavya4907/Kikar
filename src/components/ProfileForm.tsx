"use client"
import { useState } from "react"
import { supabase } from "../lib/supabase"
import { T } from "../styles"

interface Props {
  session: any
  profile: any
  onSaved: (profile: any) => void
  onCancel: () => void
}

export default function ProfileForm({ session, profile, onSaved, onCancel }: Props) {
  const [editProfile, setEditProfile] = useState({
    display_name: profile?.display_name || "",
    bio: profile?.bio || "",
    avatar_url: profile?.avatar_url || ""
  })
  const [saving, setSaving] = useState(false)

  async function saveProfile() {
    setSaving(true)
    try {
      const updatedData = {
        id: session.user.id,
        username: profile?.username || session.user.user_metadata?.username || session.user.email?.split("@")[0] || "user",
        display_name: editProfile.display_name,
        bio: editProfile.bio,
        avatar_url: editProfile.avatar_url,
      }
      const { error } = await supabase.from("profiles")
        .upsert(updatedData, { onConflict: "id" })

      if (error) {
        console.error("Failed to save profile:", error)
        alert("Failed to save profile: " + error.message)
      } else {
        onSaved({ ...profile, ...editProfile })
      }
    } catch (err: any) {
      console.error("Profile save error:", err)
      alert("Error saving profile: " + (err?.message || "Unknown error"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      flex: 1,
      overflowY: "auto",
      padding: "24px 20px",
      background: T.bgAlt,
      fontFamily: T.font,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
        <button
          className="cc-back-btn"
          onClick={onCancel}
          style={{
            display: "none",
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
          }}>My Profile</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: T.muted }}>
            How others see you on Kikar
          </p>
        </div>
      </div>

      {/* Avatar section */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 14,
        padding: "24px 20px",
        background: T.surface,
        borderRadius: 14,
        border: `1px solid ${T.border}`,
        marginBottom: 24,
      }}>
        {/* Avatar preview */}
        <div style={{ position: "relative" }}>
          {editProfile.avatar_url
            ? <img
                src={editProfile.avatar_url}
                style={{
                  width: 86,
                  height: 86,
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: `2px solid hsl(119,99%,46%)`,
                  boxShadow: "0 0 24px hsla(119,99%,46%,0.3)",
                }}
              />
            : <div style={{
                width: 86,
                height: 86,
                borderRadius: "50%",
                background: "hsla(119,99%,46%,0.08)",
                border: `2px dashed hsla(119,99%,46%,0.35)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 34,
              }}>👤</div>
          }
          {/* Online indicator */}
          <div style={{
            position: "absolute",
            bottom: 4,
            right: 4,
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: "#22c55e",
            border: `2px solid ${T.surface}`,
            boxShadow: "0 0 8px rgba(34,197,94,0.5)",
          }} />
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: 600, fontSize: 16, color: T.text, letterSpacing: "-0.02em" }}>
            {editProfile.display_name || session.user.email?.split("@")[0]}
          </div>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>
            {session.user.email}
          </div>
        </div>
      </div>

      {/* Avatar URL */}
      <label style={{
        fontSize: 11,
        color: T.muted,
        display: "block",
        marginBottom: 6,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        fontWeight: 600,
      }}>Avatar URL</label>
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
        placeholder="https://…"
        value={editProfile.avatar_url}
        onChange={e => setEditProfile({ ...editProfile, avatar_url: e.target.value })}
        onFocus={e => {
          e.target.style.borderColor = "hsla(119,99%,46%,0.5)"
          e.target.style.boxShadow = "0 0 0 3px hsla(119,99%,46%,0.08)"
        }}
        onBlur={e => {
          e.target.style.borderColor = T.border
          e.target.style.boxShadow = "none"
        }}
      />

      {/* Display name */}
      <label style={{
        fontSize: 11,
        color: T.muted,
        display: "block",
        margin: "20px 0 6px",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        fontWeight: 600,
      }}>Display Name</label>
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
        placeholder="Your name"
        value={editProfile.display_name}
        onChange={e => setEditProfile({ ...editProfile, display_name: e.target.value })}
        onFocus={e => {
          e.target.style.borderColor = "hsla(119,99%,46%,0.5)"
          e.target.style.boxShadow = "0 0 0 3px hsla(119,99%,46%,0.08)"
        }}
        onBlur={e => {
          e.target.style.borderColor = T.border
          e.target.style.boxShadow = "none"
        }}
      />

      {/* Bio */}
      <label style={{
        fontSize: 11,
        color: T.muted,
        display: "block",
        margin: "20px 0 6px",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        fontWeight: 600,
      }}>Bio</label>
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
        placeholder="Tell people about yourself…"
        value={editProfile.bio}
        onChange={e => setEditProfile({ ...editProfile, bio: e.target.value })}
        onFocus={e => {
          e.target.style.borderColor = "hsla(119,99%,46%,0.5)"
          e.target.style.boxShadow = "0 0 0 3px hsla(119,99%,46%,0.08)"
        }}
        onBlur={e => {
          e.target.style.borderColor = T.border
          e.target.style.boxShadow = "none"
        }}
      />

      {/* Buttons */}
      <div style={{ display: "flex", gap: 10, marginTop: 28 }}>
        <button
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
          onMouseEnter={e => { const el = e.currentTarget; el.style.borderColor = T.borderHover; el.style.color = T.text }}
          onMouseLeave={e => { const el = e.currentTarget; el.style.borderColor = T.border; el.style.color = T.muted }}
        >Cancel</button>

        <button
          onClick={saveProfile}
          disabled={saving}
          style={{
            flex: 2,
            padding: "13px 0",
            background: saving
              ? T.surface
              : "linear-gradient(135deg, hsl(119,99%,46%) 0%, hsl(119,99%,38%) 100%)",
            border: `1px solid ${saving ? T.border : "transparent"}`,
            borderRadius: 10,
            fontWeight: 700,
            fontSize: 14,
            fontFamily: T.font,
            cursor: saving ? "not-allowed" : "pointer",
            color: saving ? T.muted : T.primaryFg,
            letterSpacing: "0.01em",
            boxShadow: saving ? "none" : "0 4px 20px hsla(119,99%,46%,0.25)",
            transition: "all 0.18s",
          }}
        >
          {saving ? "⏳ Saving…" : "✓ Save Profile"}
        </button>
      </div>
    </div>
  )
}