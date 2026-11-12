"use client"
import { useState } from "react"
import { apiFetch } from "../../lib/apiFetch"
import { T } from "../../styles"
import { speakMessageText, stopSpeakingText } from "../../lib/helpers"
import type { VoicePeerState } from "../../lib/webrtcVoice"
import { Icon } from "../Icons"

interface Props {
  channelName: string
  voiceConnected: boolean
  peers: VoicePeerState[]
  micMuted: boolean
  deafened: boolean
  voiceWarning?: string | null
  onToggleConnect: () => void
  onToggleMic: () => void
  onToggleDeafen: () => void
  onSetPeerVolume?: (userId: string, volume: number) => void
  session: any
  myName: string
  onBroadcastVoiceTranscript?: (speaker: string, text: string, role: "user" | "bot") => void
}

export default function VoiceLoungeStage({
  channelName,
  voiceConnected,
  peers,
  micMuted,
  deafened,
  voiceWarning,
  onToggleConnect,
  onToggleMic,
  onToggleDeafen,
  onSetPeerVolume,
  session,
  myName,
  onBroadcastVoiceTranscript,
}: Props) {
  const [aiSpeaking, setAiSpeaking] = useState(false)
  const [aiStatusText, setAiStatusText] = useState("Ready to co-host or drop voice icebreakers")
  const [listeningToSpeech, setListeningToSpeech] = useState(false)
  const [volumes, setVolumes] = useState<Record<string, number>>({})

  async function askAiVoiceCoHost(spokenPrompt: string) {
    if (!spokenPrompt.trim()) return
    setAiStatusText(`Thinking about: "${spokenPrompt}"…`)

    if (onBroadcastVoiceTranscript) {
      onBroadcastVoiceTranscript(myName, `[Voice Lounge]: ${spokenPrompt}`, "user")
    }

    try {
      const res = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: spokenPrompt }],
          systemPrompt: `You are Kikar Voice AI, the live audio co-host inside the #${channelName} Discord Voice Lounge. Keep your spoken response natural, warm, witty, and under 35 words so it sounds great read aloud.`,
          maxTokens: 120,
          userId: session?.user?.id,
        }),
      })
      const data = await res.json()
      const reply = data?.reply || "I'm hanging out in the voice lounge with you! What should we talk about next?"
      setAiStatusText(reply)

      if (onBroadcastVoiceTranscript) {
        onBroadcastVoiceTranscript("Kikar Voice AI", reply, "bot")
      }

      if (!deafened) {
        setAiSpeaking(true)
        speakMessageText(reply, () => {
          setAiSpeaking(false)
        })
      }
    } catch {
      setAiStatusText("Voice AI couldn't reach the server right now.")
    }
  }

  function handlePushToTalkAi() {
    if (aiSpeaking) {
      stopSpeakingText()
      setAiSpeaking(false)
    }

    const SpeechRecognition =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null

    if (!SpeechRecognition) {
      const fallbackPrompt = window.prompt("Speak to Kikar Voice AI (type your prompt for live voice reply):", "Give our voice lounge a fun rapid-fire topic!")
      if (fallbackPrompt) {
        askAiVoiceCoHost(fallbackPrompt)
      }
      return
    }

    try {
      const recognition = new SpeechRecognition()
      recognition.lang = "en-US"
      recognition.interimResults = false
      recognition.maxAlternatives = 1

      setListeningToSpeech(true)
      setAiStatusText("Listening to your voice… speak now!")

      recognition.onresult = (event: any) => {
        const transcript = event.results?.[0]?.[0]?.transcript || ""
        setListeningToSpeech(false)
        if (transcript.trim()) {
          askAiVoiceCoHost(transcript.trim())
        }
      }

      recognition.onerror = () => {
        setListeningToSpeech(false)
        setAiStatusText("Couldn't catch that—tap 'Ask Voice AI' to try again.")
      }

      recognition.onend = () => {
        setListeningToSpeech(false)
      }

      recognition.start()
    } catch {
      setListeningToSpeech(false)
    }
  }

  return (
    <div
      style={{
        background: "linear-gradient(180deg, #0b0d11 0%, #1a1b1e 100%)",
        borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        flexShrink: 0,
      }}
    >
      {/* Top Status & Controls Row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: voiceConnected ? "rgba(79,185,135, 0.16)" : "rgba(255, 255, 255, 0.06)",
              border: voiceConnected ? "1px solid rgba(79,185,135, 0.4)" : "1px solid rgba(255, 255, 255, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 18,
            }}
          >
            <Icon name="volume" />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#eceef2" }}>
                #{channelName} — WebRTC Voice Lounge
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: voiceConnected ? "rgba(79,185,135, 0.18)" : "rgba(255, 255, 255, 0.08)",
                  color: voiceConnected ? "#4fb987" : "#9aa1ad",
                }}
              >
                {voiceConnected ? `● Live P2P Audio (${peers.length} in room)` : "Disconnected"}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "#9aa1ad", marginTop: 2 }}>
              {voiceConnected
                ? "Peer-to-peer WebRTC mesh active · Green ring lights up when speaking"
                : "Click 'Join Voice Lounge' to connect your microphone and hear peers live"}
            </div>
          </div>
        </div>

        {/* Voice Controls Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {voiceConnected && (
            <>
              <button
                type="button"
                onClick={onToggleMic}
                style={{
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: micMuted ? "1px solid rgba(242, 63, 67, 0.5)" : "1px solid rgba(255, 255, 255, 0.12)",
                  background: micMuted ? "rgba(242, 63, 67, 0.18)" : "#161a20",
                  color: micMuted ? "#ef8a8a" : "#eceef2",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: T.font,
                }}
              >
                <span>{micMuted ? "Unmute" : "Mute"}</span>
              </button>

              <button
                type="button"
                onClick={onToggleDeafen}
                style={{
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: deafened ? "1px solid rgba(242, 63, 67, 0.5)" : "1px solid rgba(255, 255, 255, 0.12)",
                  background: deafened ? "rgba(242, 63, 67, 0.18)" : "#161a20",
                  color: deafened ? "#ef8a8a" : "#eceef2",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: T.font,
                }}
              >
                <span>{deafened ? "Undeafen" : "Deafen"}</span>
              </button>

              <button
                type="button"
                onClick={handlePushToTalkAi}
                style={{
                  padding: "7px 12px",
                  borderRadius: 8,
                  border: listeningToSpeech ? `1px solid ${T.primary}` : "1px solid rgba(139,124,246, 0.45)",
                  background: listeningToSpeech ? "hsla(226, 72%, 70%, 0.2)" : "rgba(139,124,246, 0.18)",
                  color: listeningToSpeech ? T.primary : "#b3a8f8",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontFamily: T.font,
                }}
                title="Speak to Kikar AI Co-Host and hear its spoken response in the lounge"
              >
                <span>{listeningToSpeech ? "Listening…" : "Ask Voice AI"}</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onToggleConnect}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: voiceConnected
                ? "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)"
                : "linear-gradient(135deg, #4fb987 0%, #2f7d5a 100%)",
              color: "#f4f5f7",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: T.font,
              boxShadow: voiceConnected ? "none" : "0 4px 14px rgba(79,185,135, 0.3)",
            }}
          >
            {voiceConnected ? "Leave Voice" : "Join Voice Lounge"}
          </button>
        </div>
      </div>

      {voiceWarning && (
        <div
          style={{
            fontSize: 11,
            color: "#facc15",
            background: "rgba(234, 179, 8, 0.12)",
            border: "1px solid rgba(234, 179, 8, 0.3)",
            borderRadius: 8,
            padding: "6px 10px",
          }}
        >
          {voiceWarning}
        </div>
      )}

      {/* Participant Stage Cards Grid */}
      {voiceConnected && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
            gap: 10,
          }}
        >
          {peers.map((peer) => {
            const isMe = peer.userId === session?.user?.id
            const vol = volumes[peer.userId] ?? 100

            return (
              <div
                key={peer.userId}
                style={{
                  background: "#1a1e25",
                  border: peer.isSpeaking
                    ? "2px solid #4fb987"
                    : "1px solid rgba(255, 255, 255, 0.08)",
                  borderRadius: 12,
                  padding: "12px 10px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 6,
                  boxShadow: peer.isSpeaking ? "0 0 18px rgba(79,185,135, 0.3)" : "none",
                  transition: "border-color 0.12s ease, box-shadow 0.12s ease",
                }}
              >
                <div style={{ position: "relative" }}>
                  {peer.avatarUrl ? (
                    <img
                      src={peer.avatarUrl}
                      alt={peer.username}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        objectFit: "cover",
                        outline: peer.isSpeaking ? "3px solid #4fb987" : "none",
                        outlineOffset: 2,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        background: "#1e232b",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 22,
                        outline: peer.isSpeaking ? "3px solid #4fb987" : "none",
                        outlineOffset: 2,
                      }}
                    >
                      <Icon name="user" />
                    </div>
                  )}

                  {(peer.isMuted || peer.isDeafened) && (
                    <span
                      style={{
                        position: "absolute",
                        bottom: -2,
                        right: -4,
                        background: "#e5666b",
                        color: "#fff",
                        fontSize: 10,
                        borderRadius: 999,
                        padding: "1px 4px",
                        border: "2px solid #1a1e25",
                      }}
                    >
                      {peer.isDeafened ? <Icon name="headphonesOff" /> : <Icon name="micOff" />}
                    </span>
                  )}
                </div>

                <div style={{ fontSize: 12, fontWeight: 700, color: "#eceef2", textAlign: "center" }}>
                  {peer.username} {isMe ? "(You)" : ""}
                </div>

                <div style={{ fontSize: 10, color: peer.isSpeaking ? "#4fb987" : "#9aa1ad", fontWeight: 600 }}>
                  {peer.isDeafened
                    ? "Deafened"
                    : peer.isMuted
                    ? "Muted"
                    : peer.isSpeaking
                    ? "● Speaking…"
                    : "Connected"}
                </div>

                {/* Per-Peer Volume Slider for remote participants */}
                {!isMe && onSetPeerVolume && (
                  <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <span style={{ fontSize: 10, color: "#9aa1ad" }}><Icon name="volumeLow" /></span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={vol}
                      onChange={(e) => {
                        const v = Number(e.target.value)
                        setVolumes((prev) => ({ ...prev, [peer.userId]: v }))
                        onSetPeerVolume(peer.userId, v / 100)
                      }}
                      style={{ width: "100%", accentColor: "#4fb987", height: 4 }}
                      title={`Peer volume: ${vol}%`}
                    />
                  </div>
                )}
              </div>
            )
          })}

          {/* Kikar Voice AI Co-Host Tile */}
          <div
            onClick={handlePushToTalkAi}
            style={{
              background: "rgba(139,124,246, 0.08)",
              border: aiSpeaking
                ? "2px solid #4fb987"
                : "1px dashed rgba(139,124,246, 0.4)",
              borderRadius: 12,
              padding: "12px 10px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              cursor: "pointer",
              boxShadow: aiSpeaking ? "0 0 18px rgba(79,185,135, 0.3)" : "none",
            }}
            title="Click to talk to Kikar Voice AI Co-Host"
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "rgba(139,124,246, 0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 22,
                outline: aiSpeaking ? "3px solid #4fb987" : "none",
                outlineOffset: 2,
              }}
            >
              <Icon name="bot" />
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#b3a8f8" }}>
              Kikar Voice AI
            </div>
            <div
              style={{
                fontSize: 10,
                color: aiSpeaking ? "#4fb987" : "#9aa1ad",
                textAlign: "center",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {aiSpeaking ? "Speaking aloud…" : aiStatusText}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
