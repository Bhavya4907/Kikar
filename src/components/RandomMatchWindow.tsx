"use client"
import { useState, useEffect, useRef } from "react"
import { apiFetch } from "../lib/apiFetch"
import { supabase } from "../lib/supabase"
import { T } from "../styles"
import type { Profile } from "../lib/types"
import { Icon } from "./Icons"

interface Props {
  session: any
  profile: Profile | null
  allProfiles: Profile[]
  characters: any[]
  onBack: () => void
  onStartPermanentConvo: (partnerId: string) => void
  onOpenChar?: (char: any) => void
}

interface RadarMessage {
  id: string
  senderId: string
  senderName: string
  role: "me" | "stranger" | "ai"
  content: string
  created_at: string
}

const FALLBACK_ICEBREAKERS = [
  "Kikar Wingman: If you had to be trapped in an elevator for 6 hours with any fictional character, who are you picking?",
  "Kikar Wingman: What is one controversial food opinion that you will defend with your life?",
  "Kikar Wingman: Tell each other two truths and one lie. Let's see who guesses the lie first!",
  "Kikar Wingman: Would you rather fight 1 horse-sized duck or 100 duck-sized horses?",
  "Kikar Wingman: What's the best travel destination you've ever visited, or your #1 bucket list spot?",
]

export default function RandomMatchWindow({
  session,
  profile,
  allProfiles,
  characters,
  onBack,
  onStartPermanentConvo,
  onOpenChar,
}: Props) {
  const [matchState, setMatchState] = useState<"idle" | "searching" | "matched">("idle")
  const [topicVibe, setTopicVibe] = useState<"casual" | "gaming" | "deep" | "debate">("casual")
  const [searchingSeconds, setSearchingSeconds] = useState(0)
  const [partner, setPartner] = useState<{ id: string; username: string; display_name?: string; avatar_url?: string; isReplica?: boolean } | null>(null)
  const [roomId, setRoomId] = useState<string | null>(null)
  const [messages, setMessages] = useState<RadarMessage[]>([])
  const [input, setInput] = useState("")
  const [partnerTyping, setPartnerTyping] = useState(false)
  const [friendAdded, setFriendAdded] = useState(false)
  const [requestingAi, setRequestingAi] = useState(false)
  const [activePeersCount, setActivePeersCount] = useState(1)

  const bottomRef = useRef<HTMLDivElement>(null)
  const lobbyChannelRef = useRef<any>(null)
  const roomChannelRef = useRef<any>(null)
  const searchTimerRef = useRef<any>(null)

  const myName = profile?.display_name || profile?.username || session.user.email?.split("@")[0] || "Fellow"

  // ── Auto scroll ────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, partnerTyping])

  // ── 1. Global Lobby Setup (Presence & Match Handshake) ─────────
  useEffect(() => {
    if (!session?.user?.id) return

    const lobby = supabase.channel("kikar-radar-lobby", {
      config: { presence: { key: session.user.id } },
    })

    lobby
      .on("presence", { event: "sync" }, () => {
        const state = lobby.presenceState()
        const count = Object.keys(state).length
        setActivePeersCount(Math.max(count, 1))

        // If currently searching, check if an eligible partner is also searching
        if (matchState === "searching") {
          checkForEligiblePartner(state)
        }
      })
      .on("broadcast", { event: "match-proposal" }, ({ payload }) => {
        // Another peer proposed a match to us!
        if (payload?.targetUserId === session.user.id && payload?.roomId) {
          acceptMatchProposal(payload)
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await lobby.track({
            userId: session.user.id,
            username: myName,
            avatar_url: profile?.avatar_url || "",
            isSearching: matchState === "searching",
            topicVibe,
          })
        }
      })

    lobbyChannelRef.current = lobby

    return () => {
      lobby.unsubscribe()
    }
  }, [session, matchState, topicVibe, myName, profile])

  // Track search timer
  useEffect(() => {
    if (matchState === "searching") {
      setSearchingSeconds(0)
      searchTimerRef.current = setInterval(() => {
        setSearchingSeconds(s => s + 1)
      }, 1000)
    } else {
      clearInterval(searchTimerRef.current)
    }
    return () => clearInterval(searchTimerRef.current)
  }, [matchState])

  // ── Match Handshake Helpers ────────────────────────────────────
  function checkForEligiblePartner(presenceState: any) {
    for (const key of Object.keys(presenceState)) {
      if (key === session.user.id) continue
      const peerArr = presenceState[key]
      if (!Array.isArray(peerArr) || peerArr.length === 0) continue
      const peer = peerArr[0]

      if (peer.isSearching) {
        // We found an available searching stranger! Propose a room
        const generatedRoom = `room-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        lobbyChannelRef.current?.send({
          type: "broadcast",
          event: "match-proposal",
          payload: {
            targetUserId: peer.userId,
            proposer: {
              id: session.user.id,
              username: myName,
              avatar_url: profile?.avatar_url || "",
            },
            roomId: generatedRoom,
            topic: topicVibe,
          },
        })

        startRoomSession(generatedRoom, {
          id: peer.userId,
          username: peer.username,
          avatar_url: peer.avatar_url,
        })
        break
      }
    }
  }

  function acceptMatchProposal(payload: any) {
    if (matchState === "matched") return
    startRoomSession(payload.roomId, payload.proposer)
  }

  // ── 2. Active Room Channel (Live Instant Chat & Icebreakers) ───
  function startRoomSession(activeRoomId: string, partnerData: any) {
    setMatchState("matched")
    setRoomId(activeRoomId)
    setPartner(partnerData)
    setFriendAdded(false)
    setMessages([
      {
        id: `sys-${Date.now()}`,
        senderId: "system",
        senderName: "System",
        role: "ai",
        content: `Connected with a live stranger (${partnerData.username || "Anonymous"})! Be friendly, or tap AI Icebreaker to kick off the conversation.`,
        created_at: new Date().toISOString(),
      },
    ])

    // Update lobby presence to not searching
    lobbyChannelRef.current?.track({
      userId: session.user.id,
      username: myName,
      avatar_url: profile?.avatar_url || "",
      isSearching: false,
    })

    // Subscribe to private room channel
    if (roomChannelRef.current) {
      roomChannelRef.current.unsubscribe()
    }

    const room = supabase.channel(`radar-room-${activeRoomId}`)

    room
      .on("broadcast", { event: "room-msg" }, ({ payload }) => {
        if (payload && payload.senderId !== session.user.id) {
          setMessages(prev => [...prev, payload])
        }
      })
      .on("broadcast", { event: "room-typing" }, ({ payload }) => {
        if (payload?.senderId !== session.user.id) {
          setPartnerTyping(Boolean(payload.isTyping))
        }
      })
      .on("broadcast", { event: "room-icebreaker" }, ({ payload }) => {
        if (payload?.content) {
          setMessages(prev => [...prev, {
            id: `ai-${Date.now()}`,
            senderId: "kikar-ai",
            senderName: "Kikar Wingman",
            role: "ai",
            content: payload.content,
            created_at: new Date().toISOString(),
          }])
        }
      })
      .on("broadcast", { event: "room-skip" }, () => {
        setMessages(prev => [
          ...prev,
          {
            id: `skip-${Date.now()}`,
            senderId: "system",
            senderName: "System",
            role: "ai",
            content: "Stranger skipped to the next person. Tap 'Find Next Stranger' below!",
            created_at: new Date().toISOString(),
          },
        ])
        setPartner(null)
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Send automatic first icebreaker
          triggerAiIcebreaker(room, true)
        }
      })

    roomChannelRef.current = room
  }

  // ── Actions: Send Message ──────────────────────────────────────
  function sendMessage() {
    if (!input.trim() || !roomChannelRef.current || !roomId) return

    const newMsg: RadarMessage = {
      id: `msg-${Date.now()}`,
      senderId: session.user.id,
      senderName: myName,
      role: "me",
      content: input.trim(),
      created_at: new Date().toISOString(),
    }

    setMessages(prev => [...prev, newMsg])
    setInput("")

    roomChannelRef.current.send({
      type: "broadcast",
      event: "room-msg",
      payload: { ...newMsg, role: "stranger" },
    })

    // Stop typing broadcast
    roomChannelRef.current.send({
      type: "broadcast",
      event: "room-typing",
      payload: { senderId: session.user.id, isTyping: false },
    })
  }

  // ── Actions: AI Icebreaker ─────────────────────────────────
  async function triggerAiIcebreaker(customRoom?: any, silent = false) {
    const activeRoom = customRoom || roomChannelRef.current
    if (!activeRoom || requestingAi) return
    setRequestingAi(true)

    try {
      const topicPrompts = {
        casual: "fun, casual icebreaker or rapid-fire question",
        gaming: "gaming, anime, pop-culture, or sci-fi dilemma",
        deep: "deep philosophical, life perspective, or personal dream question",
        debate: "playful and funny controversial debate question",
      }

      const res = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemPrompt: `You are Kikar Wingman, an ultra-witty, friendly AI referee and icebreaker host in an anonymous chat between two strangers. Generate a single ${topicPrompts[topicVibe]}. Keep it under 40 words. Be energetic, engaging, and fun. No preamble.`,
          messages: [{ role: "user", content: "Give us an icebreaker question!" }],
          maxTokens: 120,
        }),
      })

      const data = await res.json()
      const icebreakerText = data?.reply || FALLBACK_ICEBREAKERS[Math.floor(Math.random() * FALLBACK_ICEBREAKERS.length)]

      activeRoom.send({
        type: "broadcast",
        event: "room-icebreaker",
        payload: { content: icebreakerText },
      })

      setMessages(prev => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          senderId: "kikar-ai",
          senderName: "Kikar Wingman",
          role: "ai",
          content: icebreakerText,
          created_at: new Date().toISOString(),
        },
      ])
    } catch {
      const fallback = FALLBACK_ICEBREAKERS[Math.floor(Math.random() * FALLBACK_ICEBREAKERS.length)]
      setMessages(prev => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          senderId: "kikar-ai",
          senderName: "Kikar Wingman",
          role: "ai",
          content: fallback,
          created_at: new Date().toISOString(),
        },
      ])
    } finally {
      setRequestingAi(false)
    }
  }

  // ── Actions: Next Stranger (Skip) ──────────────────────────────
  function handleNextStranger() {
    if (roomChannelRef.current) {
      roomChannelRef.current.send({
        type: "broadcast",
        event: "room-skip",
        payload: {},
      })
      roomChannelRef.current.unsubscribe()
    }
    setPartner(null)
    setRoomId(null)
    setMessages([])
    handleStartSearch()
  }

  // ── Actions: Start Search ──────────────────────────────────────
  function handleStartSearch() {
    setMatchState("searching")
    lobbyChannelRef.current?.track({
      userId: session.user.id,
      username: myName,
      avatar_url: profile?.avatar_url || "",
      isSearching: true,
      topicVibe,
    })
  }

  // ── Actions: Cancel / Leave ────────────────────────────────────
  function handleLeave() {
    if (roomChannelRef.current) {
      roomChannelRef.current.send({
        type: "broadcast",
        event: "room-skip",
        payload: {},
      })
      roomChannelRef.current.unsubscribe()
    }
    setMatchState("idle")
    setPartner(null)
    setRoomId(null)
    setMessages([])
    lobbyChannelRef.current?.track({
      userId: session.user.id,
      username: myName,
      avatar_url: profile?.avatar_url || "",
      isSearching: false,
    })
  }

  // ── Actions: Add as Friend ─────────────────────────────────────
  function handleAddFriend() {
    if (!partner?.id || partner.id === session.user.id) return
    onStartPermanentConvo(partner.id)
    setFriendAdded(true)
  }

  // ── Actions: Spar with a Digital Twin when no human is online ──
  function handleSparWithReplica() {
    const replicaChar = characters.find(c => c.is_replica) || characters[0]
    if (replicaChar && onOpenChar) {
      onOpenChar(replicaChar)
    } else {
      onBack()
    }
  }

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      background: T.bg,
      overflow: "hidden",
      fontFamily: T.font,
    }}>

      {/* ── Top Header Bar ─────────────────────────────────────────── */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "max(12px, env(safe-area-inset-top, 12px)) 16px 12px",
        background: T.surface,
        borderBottom: `1px solid ${T.border}`,
        flexShrink: 0,
        gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            className="cc-back-btn"
            onClick={onBack}
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: T.bgAlt,
              border: `1px solid ${T.border}`,
              color: T.text,
              cursor: "pointer",
              fontSize: 14,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ←
          </button>

          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 16 }}><Icon name="radar" /></span>
              <span style={{ fontSize: 15, fontWeight: 700, color: T.text, letterSpacing: "-0.02em" }}>
                Kikar Radar
              </span>
              <span style={{
                fontSize: 11,
                background: matchState === "matched" ? "rgba(79,185,135,0.15)" : "rgba(56,189,248,0.15)",
                color: matchState === "matched" ? "#4fb987" : "#62b5d9",
                border: matchState === "matched" ? "1px solid rgba(79,185,135,0.3)" : "1px solid rgba(56,189,248,0.3)",
                padding: "1px 7px",
                borderRadius: 999,
                fontWeight: 700,
              }}>
                {matchState === "matched" ? "Matched" : `${activePeersCount} in Lobby`}
              </span>
            </div>
            <div style={{ fontSize: 11, color: T.muted }}>
              {matchState === "matched" && partner
                ? `Chatting with ${partner.username || "Stranger"}`
                : "Instant anonymous stranger match with @ai wingman"}
            </div>
          </div>
        </div>

        {/* Header Right actions */}
        {matchState === "matched" ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              onClick={handleAddFriend}
              disabled={friendAdded}
              title="Add this stranger as a permanent friend in your Fellows list"
              style={{
                padding: "7px 12px",
                background: friendAdded ? "rgba(79,185,135,0.15)" : "hsla(226,72%,70%,0.15)",
                border: friendAdded ? "1px solid #4fb987" : `1px solid ${T.primary}`,
                borderRadius: 8,
                color: friendAdded ? "#4fb987" : T.primary,
                fontSize: 11,
                fontWeight: 700,
                cursor: friendAdded ? "default" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <span>{friendAdded ? "Added to Friends" : "Add Friend"}</span>
            </button>

            <button
              type="button"
              onClick={handleNextStranger}
              title="Skip to next stranger"
              style={{
                padding: "7px 12px",
                background: "linear-gradient(135deg, #e0a84f 0%, #d97706 100%)",
                border: "none",
                borderRadius: 8,
                color: "#000",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>Next →</span>
            </button>

            <button
              type="button"
              onClick={handleLeave}
              title="Leave to lobby"
              style={{
                width: 32,
                height: 32,
                background: T.bgAlt,
                border: `1px solid ${T.border}`,
                borderRadius: 8,
                color: T.muted,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              
            </button>
          </div>
        ) : null}
      </div>

      {/* ── Match Views ────────────────────────────────────────────── */}
      {matchState !== "matched" ? (
        /* ── LOBBY / SEARCHING SCREEN ────────────────────────────── */
        <div style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px calc(76px + env(safe-area-inset-bottom, 8px))",
          position: "relative",
          overflowY: "auto",
        }}>

          {/* Radar Scanner Animation */}
          <div style={{ position: "relative", width: 140, height: 140, marginBottom: 24, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {matchState === "searching" && (
              <>
                <div style={{
                  position: "absolute",
                  inset: -20,
                  borderRadius: "50%",
                  border: "2px solid rgba(56,189,248,0.25)",
                  animation: "ping 2s cubic-bezier(0, 0, 0.2, 1) infinite",
                }} />
                <div style={{
                  position: "absolute",
                  inset: -8,
                  borderRadius: "50%",
                  border: "2px solid rgba(56,189,248,0.45)",
                  animation: "ping 2s cubic-bezier(0, 0, 0.2, 1) 0.5s infinite",
                }} />
              </>
            )}

            <div style={{
              width: 90,
              height: 90,
              borderRadius: "50%",
              background: matchState === "searching"
                ? "radial-gradient(circle, rgba(56,189,248,0.3) 0%, rgba(56,189,248,0.05) 70%)"
                : "radial-gradient(circle, rgba(139,124,246,0.25) 0%, rgba(139,124,246,0.05) 70%)",
              border: matchState === "searching" ? "2px solid #62b5d9" : "2px solid #8b7cf6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 38,
              boxShadow: matchState === "searching" ? "0 0 35px rgba(56,189,248,0.35)" : "0 0 30px rgba(139,124,246,0.25)",
            }}>
              {matchState === "searching" ? <Icon name="radar" /> : <Icon name="radar" />}
            </div>
          </div>

          <h2 style={{ fontSize: 22, fontWeight: 700, color: T.text, margin: "0 0 8px", textAlign: "center" }}>
            {matchState === "searching" ? "Scanning for Live Strangers…" : "Instant Stranger Radar"}
          </h2>

          <p style={{ color: T.muted, fontSize: 13, textAlign: "center", maxWidth: 380, lineHeight: 1.6, margin: "0 0 24px" }}>
            {matchState === "searching"
              ? `Looking for a match (${searchingSeconds}s). When matched, Kikar AI will drop a fun icebreaker into your chat.`
              : "Connect 1-on-1 with another live fellow randomly. Skip anytime, or add them as a friend if you click."}
          </p>

          {/* Vibe Category Pills */}
          {matchState === "idle" && (
            <div style={{ marginBottom: 28, width: "100%", maxWidth: 380 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8, textAlign: "center" }}>
                Select Conversation Vibe
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
                {([
                  { id: "casual", label: "Casual & Fun" },
                  { id: "gaming", label: "Gaming & Tech" },
                  { id: "deep",   label: "Deep Thoughts" },
                  { id: "debate", label: "Playful Debates" },
                ] as const).map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setTopicVibe(v.id)}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 10,
                      background: topicVibe === v.id ? "rgba(56,189,248,0.18)" : T.surface,
                      border: topicVibe === v.id ? "1px solid #62b5d9" : `1px solid ${T.border}`,
                      color: topicVibe === v.id ? "#62b5d9" : T.muted,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: T.font,
                    }}
                  >
                    {v.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action button */}
          {matchState === "idle" ? (
            <button
              type="button"
              onClick={handleStartSearch}
              style={{
                padding: "14px 38px",
                background: "linear-gradient(135deg, #62b5d9 0%, #2b7ea3 100%)",
                border: "none",
                borderRadius: 12,
                color: "#000",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: T.font,
                boxShadow: "0 4px 25px rgba(56,189,248,0.35)",
              }}
            >
              Start Matching
            </button>
          ) : (
            <button
              type="button"
              onClick={handleLeave}
              style={{
                padding: "10px 24px",
                background: T.surface,
                border: `1px solid ${T.border}`,
                borderRadius: 10,
                color: T.muted,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                fontFamily: T.font,
              }}
            >
              Cancel Scanning
            </button>
          )}

          {/* If waiting longer than 7s: offer Digital Twin match fallback */}
          {matchState === "searching" && searchingSeconds >= 7 && (
            <div style={{
              marginTop: 28,
              padding: "16px 20px",
              background: "rgba(139,124,246,0.1)",
              border: "1px solid rgba(139,124,246,0.3)",
              borderRadius: 14,
              maxWidth: 380,
              textAlign: "center",
            }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#b3a8f8", marginBottom: 4 }}>
                No live human in queue right now?
              </div>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 12, lineHeight: 1.5 }}>
                You don&apos;t have to wait! Match instantly with an active Digital Twin or AI Persona companion.
              </div>
              <button
                type="button"
                onClick={handleSparWithReplica}
                style={{
                  padding: "8px 18px",
                  background: "linear-gradient(135deg, #8b7cf6 0%, #5b4bc4 100%)",
                  border: "none",
                  borderRadius: 8,
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Chat with Digital Replica
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ── IN-MATCH CHAT WINDOW ────────────────────────────────── */
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Messages Feed */}
          <div className="cc-messages" style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}>
            {messages.map(m => {
              if (m.role === "ai") {
                return (
                  <div
                    key={m.id}
                    style={{
                      alignSelf: "center",
                      maxWidth: "90%",
                      background: "rgba(56,189,248,0.08)",
                      border: "1px solid rgba(56,189,248,0.25)",
                      borderRadius: 14,
                      padding: "10px 16px",
                      textAlign: "center",
                      color: "#e0f2fe",
                      fontSize: 13,
                      lineHeight: 1.5,
                      boxShadow: "0 2px 12px rgba(56,189,248,0.08)",
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#62b5d9", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>
                      {m.senderName}
                    </div>
                    {m.content}
                  </div>
                )
              }

              const isMe = m.role === "me"

              return (
                <div
                  key={m.id}
                  style={{
                    alignSelf: isMe ? "flex-end" : "flex-start",
                    maxWidth: "80%",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: isMe ? "flex-end" : "flex-start",
                  }}
                >
                  <div style={{ fontSize: 10, color: T.muted2, marginBottom: 2, paddingInline: 4 }}>
                    {isMe ? "You" : partner?.username || "Stranger"}
                  </div>
                  <div
                    style={{
                      padding: "10px 14px",
                      borderRadius: isMe ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                      background: isMe
                        ? "linear-gradient(135deg, hsl(226,72%,70%), hsl(226,62%,58%))"
                        : T.surface,
                      color: isMe ? T.primaryFg : T.text,
                      border: isMe ? "none" : `1px solid ${T.border}`,
                      fontSize: 14,
                      lineHeight: 1.5,
                      wordBreak: "break-word",
                    }}
                  >
                    {m.content}
                  </div>
                </div>
              )
            })}

            {partnerTyping && (
              <div style={{
                fontSize: 11,
                color: "#62b5d9",
                padding: "6px 12px",
                background: "rgba(56,189,248,0.1)",
                border: "1px solid rgba(56,189,248,0.25)",
                borderRadius: 999,
                alignSelf: "flex-start",
              }}>
                Stranger is typing…
              </div>
            )}

            <div ref={bottomRef} style={{ height: 4 }} />
          </div>

          {/* ── Chat Input Bar ─────────────────────────────────────── */}
          <div style={{
            display: "flex",
            gap: 6,
            padding: "8px 10px max(10px, env(safe-area-inset-bottom, 10px))",
            background: T.surface,
            borderTop: `1px solid ${T.border}`,
            flexShrink: 0,
            alignItems: "center",
          }}>
            {/* Quick AI Icebreaker chip */}
            <button
              type="button"
              onClick={() => triggerAiIcebreaker()}
              disabled={requestingAi}
              title="Ask AI Wingman for a fun icebreaker or topic"
              style={{
                padding: "0 10px",
                height: 38,
                borderRadius: 999,
                background: "rgba(56,189,248,0.15)",
                border: "1px solid rgba(56,189,248,0.35)",
                color: "#62b5d9",
                fontSize: 11,
                fontWeight: 700,
                cursor: requestingAi ? "wait" : "pointer",
                fontFamily: T.font,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <span>{requestingAi ? <Icon name="clock" /> : <Icon name="shuffle" />}</span>
              <span>Icebreaker</span>
            </button>

            <input
              value={input}
              onChange={e => {
                setInput(e.target.value)
                roomChannelRef.current?.send({
                  type: "broadcast",
                  event: "room-typing",
                  payload: { senderId: session.user.id, isTyping: e.target.value.length > 0 },
                })
              }}
              onKeyDown={e => e.key === "Enter" && sendMessage()}
              placeholder="Type to stranger (or tap Icebreaker)…"
              style={{
                flex: 1,
                minWidth: 0,
                padding: "10px 14px",
                background: T.bgAlt,
                border: `1px solid ${T.border}`,
                borderRadius: 999,
                color: T.text,
                outline: "none",
                fontSize: 16,
                fontFamily: T.font,
              }}
            />

            <button
              type="button"
              onClick={sendMessage}
              disabled={!input.trim()}
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: !input.trim()
                  ? T.surface
                  : "linear-gradient(135deg, #62b5d9, #2b7ea3)",
                border: `1px solid ${!input.trim() ? T.border : "transparent"}`,
                fontSize: 16,
                cursor: !input.trim() ? "not-allowed" : "pointer",
                color: !input.trim() ? T.muted : "#000",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
              }}
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
