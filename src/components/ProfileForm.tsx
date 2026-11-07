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
    avatar_url: profile?.avatar_url || "",
    auto_replica_enabled: profile?.auto_replica_enabled ?? true,
    replica_status_note: profile?.replica_status_note || "",
  })
  const [saving, setSaving] = useState(false)
  const [purging, setPurging] = useState(false)

  async function saveProfile() {
    setSaving(true)
    try {
      const updatedData = {
        id: session.user.id,
        username: profile?.username || session.user.user_metadata?.username || session.user.email?.split("@")[0] || "user",
        display_name: editProfile.display_name,
        bio: editProfile.bio,
        avatar_url: editProfile.avatar_url,
        auto_replica_enabled: editProfile.auto_replica_enabled,
        replica_status_note: editProfile.replica_status_note,
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

  async function handlePurgeReplicaData() {
    if (!window.confirm("Reset your Digital Replica and delete your AI chat history? This action cannot be undone.")) return
    setPurging(true)
    try {
      await supabase.from("characters")
        .delete()
        .eq("replica_of", session.user.id)
        .eq("created_by", session.user.id)
      await supabase.from("messages")
        .delete()
        .eq("user_id", session.user.id)
      alert("Your Digital Replica and AI chat history have been purged.")
    } catch (err) {
      console.error("Failed to purge replica data:", err)
    } finally {
      setPurging(false)
    }
  }

  return (
    <div style={{
      flex: 1,
      overflowY: "auto",
      padding: "max(16px, env(safe-area-inset-top, 16px)) 16px calc(32px + env(safe-area-inset-bottom, 16px))",
      background: T.bgAlt,
      fontFamily: T.font,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
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
          }}>My Profile &amp; Replica Controls</h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: T.muted }}>
            Manage your public identity, offline Digital Twin settings, and data privacy
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
        }}
        placeholder="https://…"
        value={editProfile.avatar_url}
        onChange={e => setEditProfile({ ...editProfile, avatar_url: e.target.value })}
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
        }}
        placeholder="Your name"
        value={editProfile.display_name}
        onChange={e => setEditProfile({ ...editProfile, display_name: e.target.value })}
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
          minHeight: 80,
        }}
        rows={3}
        placeholder="Tell people about yourself…"
        value={editProfile.bio}
        onChange={e => setEditProfile({ ...editProfile, bio: e.target.value })}
      />

      {/* ── Digital Replica Control Center & Privacy ─────────────── */}
      <div style={{
        marginTop: 22,
        padding: 18,
        background: T.surface,
        border: "1px solid rgba(168,85,247,0.35)",
        borderRadius: 14,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#c084fc" }}>
              🪞 Offline Digital Replica Auto-Responder
            </div>
            <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>
              Allow your AI Replica to respond to friends in DMs when you are offline (always labeled with an AI badge).
            </div>
          </div>
          <input
            type="checkbox"
            checked={editProfile.auto_replica_enabled}
            onChange={e => setEditProfile({ ...editProfile, auto_replica_enabled: e.target.checked })}
            style={{ width: 18, height: 18, accentColor: "#a855f7", cursor: "pointer" }}
          />
        </div>

        <label style={{ fontSize: 11, color: T.muted, display: "block", margin: "12px 0 6px", fontWeight: 600 }}>
          Offline Status Note for Your Replica
        </label>
        <input
          style={{
            width: "100%",
            padding: "10px 14px",
            background: T.bgAlt,
            border: `1px solid ${T.border}`,
            borderRadius: 8,
            color: T.text,
            fontSize: 13,
            fontFamily: T.font,
            outline: "none",
            boxSizing: "border-box",
          }}
          placeholder="e.g. Studying for exams till 9 PM — my AI twin is taking notes!"
          value={editProfile.replica_status_note}
          onChange={e => setEditProfile({ ...editProfile, replica_status_note: e.target.value })}
        />

        <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${T.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: T.muted }}>
            Data &amp; Memory Privacy: Permanently clear your trained replica and AI chat logs.
          </span>
          <button
            type="button"
            disabled={purging}
            onClick={handlePurgeReplicaData}
            style={{
              padding: "7px 12px",
              background: "rgba(248,113,113,0.1)",
              border: "1px solid rgba(248,113,113,0.35)",
              borderRadius: 8,
              color: T.red,
              fontSize: 11,
              fontWeight: 600,
              cursor: purging ? "wait" : "pointer",
              fontFamily: T.font,
            }}
          >
            {purging ? "⏳ Purging…" : "🗑️ Purge Replica & AI Logs"}
          </button>
        </div>
      </div>

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
          }}
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
          }}
        >
          {saving ? "⏳ Saving…" : "✓ Save Profile"}
        </button>
      </div>
    </div>
  )
}