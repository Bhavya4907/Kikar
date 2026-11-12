"use client"
import { useEffect, useRef, useState } from "react"
import { apiFetch } from "../lib/apiFetch"
import { supabase } from "../lib/supabase"
import { T } from "../styles"
import { formatTime, formatDate, showNotification, speakMessageText, stopSpeakingText } from "../lib/helpers"
import { Icon } from "./Icons"
import SummonBotModal from "./discord/SummonBotModal"

interface Props {
  session: any
  activeConvo: any
  allProfiles: any[]
  characters?: any[]
  onBack: () => void
  creating: boolean
  setCreating: (v: boolean) => void
  onReplicaCreated: (char: any) => void
}

export default function DMWindow({
  session, activeConvo, allProfiles, characters = [], onBack, creating, setCreating, onReplicaCreated
}: Props) {
  const [input, setInput] = useState("")
  const [directMessages, setDirectMessages] = useState<any[]>([])
  const [uploadingImage, setUploadingImage] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [activeActionMsgId, setActiveActionMsgId] = useState<string | null>(null)
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null)
  const [autoReplicaMode, setAutoReplicaMode] = useState(true)
  const [replicaSessionActive, setReplicaSessionActive] = useState(false)
  const [showSummonModal, setShowSummonModal] = useState(false)
  const [replicaTyping, setReplicaTyping] = useState(false)
  const [typingLabel, setTypingLabel] = useState<string | null>(null)
  const [catchUpSummary, setCatchUpSummary] = useState<string | null>(null)
  const [summarizingDigest, setSummarizingDigest] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const channelRef = useRef<any>(null)

  const otherId: string = (activeConvo?.user1_id === session?.user?.id
    ? activeConvo?.user2_id
    : activeConvo?.user1_id) || activeConvo?.user2?.id || activeConvo?.user1?.id || ""

  const otherProfile = (allProfiles || []).find((p: any) => p.id === otherId) || (activeConvo?.user1_id === session?.user?.id ? activeConvo?.user2 : activeConvo?.user1) || {}
  const other = otherProfile
  const otherName = otherProfile?.display_name || otherProfile?.username || (otherId ? `User_${otherId.slice(0, 4)}` : "Friend")
  const myName = session?.user?.email?.split("@")[0] || "Friend"

  // Helper to merge messages without duplicates
  function mergeMessages(incoming: any[]) {
    setDirectMessages(prev => {
      const map = new Map<string, any>()
      for (const m of prev) {
        if (!String(m.id).startsWith("temp-")) {
          map.set(String(m.id), m)
        }
      }
      for (const m of incoming) {
        if (m && m.id) {
          map.set(String(m.id), m)
        }
      }
      const next = Array.from(map.values()).sort(
        (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      )
      // The 2.5s poll mostly returns the exact same messages. Keep the old array in that
      // case so React skips re-rendering the whole conversation.
      if (
        next.length === prev.length &&
        next.every((m, i) => m.id === prev[i].id && m.content === prev[i].content && m.read_at === prev[i].read_at)
      ) {
        return prev
      }
      return next
    })
  }

  // ── Triple-Redundant Live Chat Sync (Initial Fetch + Broadcast + Postgres Changes + 2.5s Polling) ──
  useEffect(() => {
    if (!activeConvo?.id) return
    setCatchUpSummary(null)
    setShowMobileMenu(false)

    async function fetchMessages() {
      const { data } = await supabase
        .from("direct_messages")
        .select("*")
        .eq("conversation_id", activeConvo.id)
        .order("created_at", { ascending: true })
      if (data) {
        mergeMessages(data)
      }
    }

    fetchMessages()

    // Mark unread messages as read
    supabase.from("direct_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("conversation_id", activeConvo.id)
      .neq("sender_id", session.user.id)
      .is("read_at", null)
      .then(() => {})

    // 1. Realtime channel with BOTH Broadcast (peer-to-peer WebSocket, zero RLS latency) AND postgres_changes
    const ch = supabase
      .channel(`convo-live-${activeConvo.id}`, {
        config: { broadcast: { self: false } },
      })
      .on("broadcast", { event: "dm-insert" }, ({ payload }) => {
        if (payload && payload.conversation_id === activeConvo.id) {
          mergeMessages([payload])
          if (payload.sender_id !== session.user.id) {
            const name = otherProfile?.display_name || otherProfile?.username || "Someone"
            const isImage = payload.content?.startsWith("[image]:")
            showNotification(name, isImage ? "Sent an image" : payload.content)
          }
        }
      })
      .on("broadcast", { event: "dm-delete" }, ({ payload }) => {
        if (payload?.id) {
          setDirectMessages(prev => prev.filter(m => m.id !== payload.id))
        }
      })
      .on("broadcast", { event: "dm-clear" }, ({ payload }) => {
        if (payload?.conversation_id === activeConvo.id) {
          setDirectMessages([])
        }
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" },
        (p) => {
          if (p.new && p.new.conversation_id === activeConvo.id) {
            mergeMessages([p.new])
            if (p.new.sender_id !== session.user.id) {
              const name = otherProfile?.display_name || otherProfile?.username || "Someone"
              const isImage = p.new.content?.startsWith("[image]:")
              showNotification(name, isImage ? "Sent an image" : p.new.content)
            }
          }
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "direct_messages" },
        (p) => {
          if (p.old?.id) {
            setDirectMessages(prev => prev.filter(m => m.id !== p.old.id))
          }
        })
      .subscribe()

    channelRef.current = ch

    // 2. Automatic 2.5s polling fallback so live chat works even if Supabase Realtime replication is off
    const pollInterval = setInterval(() => {
      if (!document.hidden) fetchMessages()
    }, 3500)

    return () => {
      clearInterval(pollInterval)
      supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [activeConvo?.id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [directMessages.length, replicaTyping])

  async function postSmartDMMessage(personaBadge: string, replyText: string) {
    const taggedContent = personaBadge.startsWith("[bot:")
      ? `${personaBadge}: ${replyText}`
      : `[replica:${personaBadge}]: ${replyText}`

    const { data: inserted } = await supabase
      .from("direct_messages")
      .insert({
        conversation_id: activeConvo.id,
        sender_id: session.user.id,
        content: taggedContent,
      })
      .select()
      .single()

    if (inserted) {
      mergeMessages([inserted])
      channelRef.current?.send({
        type: "broadcast",
        event: "dm-insert",
        payload: inserted,
      })
    }
    return inserted
  }

  async function handleSummonBotInDM(bot: any, mode: "call" | "mention") {
    if (mode === "mention") {
      const tag = `@${(bot.name || "bot").toLowerCase().replace(/\s+/g, "_")} `
      setInput(prev => (prev.startsWith(tag) ? prev : `${tag}${prev}`))
      return
    }

    const botName = bot.name
    const botEmoji = bot.emoji || "🤖"
    setReplicaTyping(true)
    setTypingLabel(`${botEmoji} ${botName} is entering the chat...`)
    try {
      const recentContext = directMessages.slice(-5).map(m => m.content).join("\n")
      const res = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "user", content: `You were just called into a direct message conversation between ${myName} and ${otherName}. Say an energetic, in-character hello to both of them and chime into the vibe!\n\nRecent context:\n${recentContext}` }
          ],
          systemPrompt: `${bot.system_prompt || bot.prompt || ""}\n\nYou are ${botName}. Stay completely in character. Keep your greeting under 40 words.`,
          userId: session.user.id,
          chatId: `dm_${activeConvo.id}`,
        }),
      })
      const data = await res.json()
      if (data?.reply) {
        await postSmartDMMessage(`[bot:${botName}:${botEmoji}]`, data.reply)
      }
    } catch (err) {
      console.warn("Summon bot in DM error:", err)
    } finally {
      setReplicaTyping(false)
      setTypingLabel(null)
    }
  }

  async function triggerSmartDMResponse(userMessageText: string, recentMessages: any[]) {
    const isAiSummon = /@(ai|kikar)\b/i.test(userMessageText) || /^@(ai|kikar)/i.test(userMessageText.trim())
    const otherName = otherProfile?.display_name || otherProfile?.username || "Friend"
    const myName = session.user.email?.split("@")[0] || "Friend"
    const cleanLower = userMessageText.toLowerCase()
    const otherNameLower = otherName.toLowerCase()

    // 0. Check if a custom bot was mentioned: @<bot_name>
    const mentionMatches = userMessageText.match(/@([a-zA-Z0-9_\-\.]+)/g) || []
    let matchedCustomBot: any = null
    for (const rawTag of mentionMatches) {
      const tag = rawTag.slice(1).toLowerCase()
      if (tag === "ai" || tag === "kikar" || tag === "replica" || tag === "twin") continue
      matchedCustomBot = (characters || []).find((c: any) => {
        const slug = (c.name || "").toLowerCase().replace(/\s+/g, "_")
        const first = (c.name || "").toLowerCase().split(" ")[0]
        const full = (c.name || "").toLowerCase()
        return slug === tag || first === tag || full === tag
      })
      if (matchedCustomBot) break
    }

    // 1. Mentions the replica or the other user
    const mentionsReplica = /replica|twin/i.test(userMessageText)
    const mentionsOther = cleanLower.includes(`@${otherNameLower}`) ||
      new RegExp(`\\b${otherNameLower}\\b`, "i").test(cleanLower)

    // 2. Ongoing conversation state with the replica
    const lastMsg = recentMessages[recentMessages.length - 1]
    const lastWasReplica = typeof lastMsg?.content === "string" && (
      lastMsg.content.includes("[replica:") || lastMsg.is_replica_reply
    )
    const isReplicaConversationActive = (replicaSessionActive || lastWasReplica) && !isAiSummon && !matchedCustomBot

    // 3. Continuation of an ongoing multi-agent conversation
    const lastFew = recentMessages.slice(-4)
    const hadRecentReplicaConvo = lastFew.some(m => typeof m.content === "string" && m.content.includes("replica:"))
    const isContinuation = hadRecentReplicaConvo && /continue|keep|more|again|talk|go on|what else/i.test(cleanLower)

    // Check if user asks AI to talk to, interact with, or mention the replica or friend
    const isCrossConvoRequest = isAiSummon && (mentionsReplica || mentionsOther || isContinuation)

    // Check if user directly addresses replica without @ai
    const isReplicaDirectSummon =
      /^\s*@(replica|twin)\b/i.test(userMessageText) ||
      new RegExp(`@?${otherNameLower}\\b`, "i").test(cleanLower) ||
      cleanLower.includes("replica") ||
      /\b(talk to|ask|hey|hi|hello|what's up|tell)\s+(the\s+)?(replica|twin|${otherNameLower})\b/i.test(cleanLower)

    const isRecipientOffline = !otherProfile?.is_online && autoReplicaMode

    if (!matchedCustomBot && !isAiSummon && !isReplicaDirectSummon && !isReplicaConversationActive && !isRecipientOffline && !isCrossConvoRequest) return

    // Helper to retrieve the other user's replica prompt or past voice
    async function getReplicaSystemPrompt() {
      try {
        let query = supabase
          .from("characters")
          .select("*")
          .eq("is_replica", true)

        if (otherId) {
          query = query.or(`replica_of.eq.${otherId},name.ilike.%${otherName}%`)
        } else {
          query = query.ilike("name", `%${otherName}%`)
        }

        const { data: replicaChar } = await query
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()

        if (replicaChar?.system_prompt) {
          return `${replicaChar.system_prompt}\nYou are ${otherName}'s Digital Twin Replica in this direct chat. Never break character. Match their style, slang, and personality.`
        }
      } catch (e) {
        console.warn("Error fetching replicaChar:", e)
      }

      const pastSamples = recentMessages
        .filter(m => (m.sender_id === otherId || (m.sender_id !== session?.user?.id && !m.content?.startsWith("[replica:"))) && !m.content?.startsWith("[image]:") && !m.content?.startsWith("[bot:"))
        .slice(-15)
        .map(m => m.content)
        .join("\n")

      if (pastSamples) {
        return `You are the Digital Twin Replica of ${otherName}, who is currently offline. Match their tone, slang, quirks, and message length based on their past messages:\n${pastSamples}\nKeep replies concise and authentic.`
      }

      return `You are the witty, casual Digital Twin Replica of ${otherName}. Stay in character and speak in a friendly, conversational tone.`
    }

    setReplicaTyping(true)
    try {
      const formattedHistory = recentMessages.slice(-10).map(m => ({
        role: m.sender_id === session.user.id ? "user" : "assistant",
        content: String(m.content || "").replace(/^\[replica:.*?\]:\s*/i, ""),
      }))

      if (isCrossConvoRequest) {
        // ── SCENARIO A: Real-Time Multi-Agent Convo (Kikar AI & Ba's Replica) ──
        // Turn 1: Kikar AI Co-Pilot initiates directly TO the replica
        setTypingLabel("Kikar AI Co-Pilot is thinking...")
        const cleanUserPrompt = userMessageText.replace(/^@(ai|kikar)\s*/i, "").trim()

        const aiRes1 = await apiFetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...formattedHistory, { role: "user", content: cleanUserPrompt }],
            systemPrompt: `You are Kikar AI Co-Pilot in a direct message between ${myName} and ${otherName}.
${myName} instructed you: "${userMessageText}".
Follow ${myName}'s prompt instructions (for example, if they asked you to start with "@${otherName}" or address ${otherName}'s Replica, do so!).
Address ${otherName}'s AI Replica or @${otherName} directly.
CRITICAL: DO NOT roleplay or simulate ${otherName}'s Replica or ${otherName} yourself! ${otherName}'s Replica is an independent AI agent right here in this chat that will respond to you in the next message.
Keep your response concise (under 45 words).`,
            userId: session.user.id,
            chatId: `dm_${activeConvo.id}`,
          }),
        })
        const aiData1 = await aiRes1.json()
        const aiMsg1 = aiData1?.reply || `Hey ${otherName}'s Replica! ${myName} wanted us to link up. What kind of mischief are you cooking up today?`

        await postSmartDMMessage("Kikar AI Co-Pilot", aiMsg1)

        // Turn 2: Ba's AI Replica replies directly to Kikar AI Co-Pilot
        setTypingLabel(`${otherName}'s AI Replica is typing...`)
        await new Promise(r => setTimeout(r, 1200))

        const replicaPrompt = await getReplicaSystemPrompt()
        const replicaRes = await apiFetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              ...formattedHistory,
              { role: "assistant", content: `Kikar AI Co-Pilot: ${aiMsg1}` },
              { role: "user", content: `Reply directly to Kikar AI Co-Pilot's message: "${aiMsg1}"` },
            ],
            systemPrompt: `${replicaPrompt}
Kikar AI Co-Pilot just said directly to you or @${otherName}: "${aiMsg1}".
Respond directly to Kikar AI Co-Pilot as ${otherName}'s Replica.
Be playful, witty, and stay completely in character.
Keep your reply punchy and under 40 words.`,
            userId: session.user.id,
            chatId: `dm_${activeConvo.id}`,
          }),
        })
        const replicaData = await replicaRes.json()
        const replicaMsg = replicaData?.reply || `Haha hey Kikar AI! Bhavya knows I'm always cooking up chaos. What about you, still crunching numbers or ready to hang out?`

        await postSmartDMMessage(`${otherName}'s AI Replica`, replicaMsg)

        // Turn 3: Kikar AI Co-Pilot rejoinder
        setTypingLabel("Kikar AI Co-Pilot is typing...")
        await new Promise(r => setTimeout(r, 1300))

        const aiRes2 = await apiFetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              { role: "user", content: `Kikar AI Co-Pilot: "${aiMsg1}"` },
              { role: "assistant", content: `${otherName}'s Replica: "${replicaMsg}"` },
              { role: "user", content: `Give a quick, clever comeback to ${otherName}'s Replica to continue the banter!` },
            ],
            systemPrompt: `You are Kikar AI Co-Pilot in friendly banter with ${otherName}'s AI Replica.
Reply directly to what ${otherName}'s Replica just said: "${replicaMsg}".
Keep it witty, fast, friendly, and under 35 words.`,
            userId: session.user.id,
            chatId: `dm_${activeConvo.id}`,
          }),
        })
        const aiData2 = await aiRes2.json()
        if (aiData2?.reply) {
          await postSmartDMMessage("Kikar AI Co-Pilot", aiData2.reply)
        }
        setReplicaSessionActive(true)

      } else if (matchedCustomBot) {
        // ── SCENARIO B: Custom Bot Summoned in DM ──
        const botName = matchedCustomBot.name
        const botEmoji = matchedCustomBot.emoji || "🤖"
        setTypingLabel(`${botEmoji} ${botName} is typing...`)
        const cleanPrompt = userMessageText
          .replace(new RegExp(`@${botName.replace(/\s+/g, "_")}`, "gi"), "")
          .replace(new RegExp(`@${botName}`, "gi"), "")
          .trim() || userMessageText

        const res = await apiFetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              ...formattedHistory,
              { role: "user", content: cleanPrompt },
            ],
            systemPrompt: `${matchedCustomBot.system_prompt || matchedCustomBot.prompt || ""}\n\nYou are ${botName}, summoned into a direct conversation between ${myName} and ${otherName}. Stay authentic to your persona, speak naturally, and keep replies concise (under 50 words).`,
            userId: session.user.id,
            chatId: `dm_${activeConvo.id}`,
          }),
        })
        const data = await res.json()
        if (data?.reply) {
          await postSmartDMMessage(`[bot:${botName}:${botEmoji}]`, data.reply)
        }

      } else if (isAiSummon) {
        // ── SCENARIO C: Regular AI Summon ──
        setTypingLabel("Kikar AI Co-Pilot is thinking...")
        const cleanUserPrompt = userMessageText.replace(/^@(ai|kikar)\s*/i, "").trim()

        const res = await apiFetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...formattedHistory, { role: "user", content: cleanUserPrompt }],
            systemPrompt: `You are Kikar AI Co-Pilot, summoned inside a direct message conversation between two human friends (${myName} and ${otherName}).
Be helpful, witty, concise (under 75 words), and directly answer or mediate their request.
Do NOT impersonate ${otherName} or their replica.`,
            userId: session.user.id,
            chatId: `dm_${activeConvo.id}`,
          }),
        })
        const data = await res.json()
        if (data.reply) {
          await postSmartDMMessage("Kikar AI Co-Pilot", data.reply)
        }

      } else {
        // ── SCENARIO D: Replica Speaks (Direct Summon, Follow-up, or Offline Auto-Replica) ──
        setReplicaSessionActive(true)
        setTypingLabel(`${otherName}'s AI Replica is typing...`)
        const replicaPrompt = await getReplicaSystemPrompt()
        const cleanText = userMessageText.replace(/^@(replica|twin|[a-zA-Z0-9_\-\.]+)\s*/i, "").trim() || userMessageText

        const res = await apiFetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...formattedHistory, { role: "user", content: cleanText }],
            systemPrompt: `${replicaPrompt}\nYou are chatting directly with ${myName} (the human user). Match ${otherName}'s real voice, personality, slang, and brevity. Keep it natural, conversational, and under 50 words.`,
            userId: session.user.id,
            chatId: `dm_${activeConvo.id}`,
          }),
        })
        const data = await res.json()
        if (data.reply) {
          await postSmartDMMessage(`${otherName}'s AI Replica`, data.reply)
        }
      }
    } catch (err) {
      console.warn("Smart DM response error:", err)
    } finally {
      setReplicaTyping(false)
      setTypingLabel(null)
    }
  }

  async function sendDirectMessage() {
    if (!input.trim() || !activeConvo || !session) return
    const msgContent = input.trim()
    setInput("")
    const historySnapshot = [...directMessages]

    // 1. Instant Optimistic UI insertion so message appears immediately
    const tempId = `temp-${Date.now()}`
    const optimisticMsg = {
      id: tempId,
      conversation_id: activeConvo.id,
      sender_id: session.user.id,
      content: msgContent,
      created_at: new Date().toISOString(),
    }
    setDirectMessages(prev => [...prev, optimisticMsg])

    // 2. Persist to Supabase and broadcast over WebSocket
    const { data: inserted, error } = await supabase
      .from("direct_messages")
      .insert({
        conversation_id: activeConvo.id,
        sender_id: session.user.id,
        content: msgContent,
      })
      .select()
      .single()

    if (inserted && !error) {
      setDirectMessages(prev =>
        prev.map(m => (m.id === tempId ? inserted : m))
      )
      channelRef.current?.send({
        type: "broadcast",
        event: "dm-insert",
        payload: inserted,
      })
    }

    await triggerSmartDMResponse(msgContent, historySnapshot)
  }

  async function generateCatchUpDigest() {
    if (directMessages.length === 0 || summarizingDigest) return
    setSummarizingDigest(true)
    setShowMobileMenu(false)
    try {
      const recentTranscript = directMessages
        .slice(-25)
        .map(m => {
          const speaker = m.sender_id === session.user.id ? "Me" : (otherProfile?.display_name || otherProfile?.username || "Friend")
          return `${speaker}: ${m.content}`
        })
        .join("\n")

      const res = await apiFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `Summarize this recent conversation into 3 short, actionable bullet points covering: (1) Main topics discussed, (2) Any questions or plans pending, and (3) Overall vibe.\n\nTranscript:\n${recentTranscript}`,
            },
          ],
          systemPrompt: "You are a concise catch-up assistant. Output 3 brief bullet points only.",
          userId: session.user.id,
        }),
      })
      const data = await res.json()
      if (data.reply) {
        setCatchUpSummary(data.reply)
      }
    } catch (err) {
      console.error("Failed to generate catch-up digest:", err)
    } finally {
      setSummarizingDigest(false)
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !activeConvo || !session) return
    setUploadingImage(true)
    try {
      const ext = file.name.split(".").pop()
      const fileName = `${session.user.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from("chat-images").upload(fileName, file)
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from("chat-images").getPublicUrl(fileName)
      const { data: inserted } = await supabase
        .from("direct_messages")
        .insert({
          conversation_id: activeConvo.id,
          sender_id: session.user.id,
          content: `[image]:${publicUrl}`,
        })
        .select()
        .single()
      if (inserted) {
        mergeMessages([inserted])
        channelRef.current?.send({
          type: "broadcast",
          event: "dm-insert",
          payload: inserted,
        })
      }
    } catch (err) {
      alert("Failed to upload image")
      console.error(err)
    } finally {
      setUploadingImage(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleDeleteMessage(id: string) {
    if (!id) return
    setDirectMessages(prev => prev.filter(m => m.id !== id))
    if (!String(id).startsWith("temp-")) {
      await supabase.from("direct_messages").delete().eq("id", id)
      channelRef.current?.send({
        type: "broadcast",
        event: "dm-delete",
        payload: { id },
      })
    }
  }

  async function handleClearHistory() {
    setShowMobileMenu(false)
    if (directMessages.length === 0) return
    if (window.confirm("Clear all messages in this direct conversation? This cannot be undone.")) {
      setDirectMessages([])
      try {
        const { error } = await supabase.from("direct_messages").delete().eq("conversation_id", activeConvo.id)
        if (error) console.warn("Supabase clear error:", error.message)
      } catch (err) {
        console.warn("Delete error:", err)
      }
      channelRef.current?.send({
        type: "broadcast",
        event: "dm-clear",
        payload: { conversation_id: activeConvo.id },
      })
    }
  }

  function handleCopy(content: string, id: string) {
    const text = content
      .replace(/^\[image\]:/i, "")
      .replace(/^\[replica:.*?\]:\s*/i, "")
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    })
  }

  function handleSpeakToggle(content: string, id: string) {
    if (speakingMsgId === id) {
      stopSpeakingText()
      setSpeakingMsgId(null)
      return
    }
    const clean = content.replace(/^\[replica:.*?\]:\s*/i, "")
    setSpeakingMsgId(id)
    speakMessageText(clean, () => setSpeakingMsgId(null))
  }

  async function createReplica() {
    setShowMobileMenu(false)
    if (!session || !otherId) return
    setCreating(true)
    const { data: msgs } = await supabase
      .from("direct_messages")
      .select("content")
      .eq("conversation_id", activeConvo.id)
      .eq("sender_id", otherId)
      .order("created_at", { ascending: true })
      .limit(200)

    if (!msgs || msgs.length < 5) {
      alert(`${otherName || "This user"} needs to send at least 5 messages first!`)
      setCreating(false)
      return
    }

    const sampleMessages = msgs.map((m: any) => m.content).join("\n")
    const res = await apiFetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [{ role: "user", content: `Analyze the writing style, personality, tone, vocabulary, and communication patterns from these messages. Write a system prompt (max 200 words) for an AI to perfectly impersonate this person.\n\nMessages:\n${sampleMessages}` }],
        systemPrompt: "You are an expert at analyzing writing styles. Return only the system prompt text, nothing else.",
        userId: session.user.id,
        chatId: `convo_${activeConvo.id}`,
      }),
    })
    const data = await res.json()
    const system_prompt = `${data.reply} Never break character. Match the original person's typical message length and style exactly.`

    await supabase.from("characters")
      .delete()
      .eq("replica_of", otherId)
      .eq("created_by", session.user.id)

    const { data: char, error } = await supabase.from("characters")
      .insert({
        name: `${otherName}'s Replica`,
        emoji: "🪞",
        system_prompt,
        created_by: session.user.id,
        is_replica: true,
        replica_of: otherId,
        is_public: false,
      })
      .select().single()

    if (!error && char) onReplicaCreated(char)
    setCreating(false)
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      flex: 1,
      overflow: "hidden",
      height: "100%",
      width: "100%",
      fontFamily: T.font,
      position: "relative",
    }}>
      {/* ── Mobile-First Single-Row Header ─────────────────────── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "max(10px, env(safe-area-inset-top, 10px)) 12px 10px",
        background: T.surface,
        borderBottom: `1px solid ${T.border}`,
        flexShrink: 0,
      }}>
        <button
          type="button"
          onClick={onBack}
          title="Back to People list"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: T.bgAlt,
            border: `1px solid ${T.border}`,
            color: T.text,
            fontSize: 16,
            cursor: "pointer",
            width: 36,
            height: 36,
            borderRadius: 10,
            flexShrink: 0,
            fontFamily: T.font,
          }}
        >←</button>

        {/* Avatar with live status dot */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          {otherProfile?.avatar_url
            ? <img src={otherProfile.avatar_url} style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: `2px solid ${T.border}` }} />
            : <div style={{
                width: 38, height: 38, borderRadius: "50%",
                background: T.surface,
                border: `1px solid ${T.border}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
              }}><Icon name="user" /></div>
          }
          <div style={{
            position: "absolute", bottom: 0, right: 0,
            width: 10, height: 10, borderRadius: "50%",
            background: otherProfile?.is_online ? "#4fb987" : "#8b7cf6",
            border: `2px solid ${T.surface}`,
          }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {other?.display_name || other?.username || "Direct Chat"}
          </div>
          <div
            onClick={() => setReplicaSessionActive(prev => !prev)}
            title="Click to toggle chatting with Replica"
            style={{
              fontSize: 11,
              color: otherProfile?.is_online ? "#4fb987" : "#b3a8f8",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            {otherProfile?.is_online
              ? "● Live Chat Active"
              : replicaSessionActive
              ? "● Replica Chat Active (Tap to pause)"
              : "● Offline (Tap to chat with Replica)"}
          </div>
        </div>

        {/* Compact Action Buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {directMessages.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              title="Clear all messages in this conversation"
              style={{
                background: "rgba(239, 68, 68, 0.12)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: 8,
                color: T.red,
                fontSize: 12,
                cursor: "pointer",
                padding: "6px 9px",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Icon name="trash" />
              <span className="hide-on-mobile" style={{ fontSize: 11, fontWeight: 600 }}>Clear</span>
            </button>
          )}

          <button
            type="button"
            disabled={creating}
            onClick={createReplica}
            style={{
              background: "rgba(139,124,246,0.12)",
              border: "1px solid rgba(139,124,246,0.4)",
              borderRadius: 8,
              color: "#b3a8f8",
              fontSize: 11,
              fontWeight: 600,
              cursor: creating ? "not-allowed" : "pointer",
              padding: "6px 10px",
              fontFamily: T.font,
              whiteSpace: "nowrap",
            }}
          >
            {creating ? "…" : "Replica"}
          </button>

          <button
            type="button"
            onClick={() => setShowMobileMenu(prev => !prev)}
            title="More options"
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: showMobileMenu ? "hsla(226,72%,70%,0.15)" : T.bgAlt,
              border: `1px solid ${showMobileMenu ? T.primary : T.border}`,
              color: T.text,
              fontSize: 16,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ⋯
          </button>
        </div>
      </div>

      {/* ── Compact Dropdown Menu for Secondary DM Tools ─────────── */}
      {showMobileMenu && (
        <div style={{
          position: "absolute",
          top: 56,
          right: 12,
          zIndex: 50,
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 12,
          padding: 6,
          boxShadow: "0 12px 32px rgba(0,0,0,0.65)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          minWidth: 210,
        }}>
          <button
            type="button"
            onClick={() => { setAutoReplicaMode(!autoReplicaMode); setShowMobileMenu(false) }}
            style={{
              padding: "9px 12px",
              background: "transparent",
              border: "none",
              borderRadius: 8,
              color: autoReplicaMode ? "#b3a8f8" : T.text,
              fontSize: 12,
              fontWeight: 600,
              textAlign: "left",
              cursor: "pointer",
              fontFamily: T.font,
            }}
          >
            {autoReplicaMode ? "Disable Offline Auto-Replica" : "Enable Offline Auto-Replica"}
          </button>

          <button
            type="button"
            onClick={generateCatchUpDigest}
            disabled={directMessages.length < 2 || summarizingDigest}
            style={{
              padding: "9px 12px",
              background: "transparent",
              border: "none",
              borderRadius: 8,
              color: T.primary,
              fontSize: 12,
              fontWeight: 600,
              textAlign: "left",
              cursor: "pointer",
              fontFamily: T.font,
              opacity: directMessages.length < 2 ? 0.5 : 1,
            }}
          >
            {summarizingDigest ? "Summarizing…" : "Generate Catch-Up Digest"}
          </button>

          {directMessages.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              style={{
                padding: "9px 12px",
                background: "transparent",
                border: "none",
                borderRadius: 8,
                color: T.red,
                fontSize: 12,
                fontWeight: 600,
                textAlign: "left",
                cursor: "pointer",
                fontFamily: T.font,
              }}
            >
              Clear Chat History
            </button>
          )}
        </div>
      )}

      {/* ── Active Replica Chat Banner ─────────────────────────── */}
      {replicaSessionActive && (
        <div style={{
          margin: "8px 12px 0",
          padding: "8px 14px",
          background: "rgba(139,124,246,0.15)",
          border: "1px solid rgba(139,124,246,0.4)",
          borderRadius: 10,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          color: "#b3a8f8",
          fontSize: 12,
          fontWeight: 600,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>🪞</span>
            <span>Chatting with {otherName}'s Digital Replica (AI Twin). Your messages will be answered by their replica.</span>
          </div>
          <button
            type="button"
            onClick={() => setReplicaSessionActive(false)}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(139,124,246,0.4)",
              color: "#eceef2",
              borderRadius: 6,
              padding: "3px 8px",
              fontSize: 11,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            End Replica Session
          </button>
        </div>
      )}

      {/* ── Catch-Up Digest Banner ──────────────────────────────── */}
      {catchUpSummary && (
        <div style={{
          margin: "8px 12px 0",
          padding: "10px 14px",
          background: "rgba(139,124,246,0.1)",
          border: "1px solid rgba(139,124,246,0.35)",
          borderRadius: 12,
          fontSize: 12,
          color: T.text,
          lineHeight: 1.5,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 10,
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontWeight: 700, color: "#b3a8f8", marginBottom: 3 }}>
              Catch-Up Digest
            </div>
            <div style={{ whiteSpace: "pre-line", color: "#e6e8ec" }}>{catchUpSummary}</div>
          </div>
          <button
            type="button"
            onClick={() => setCatchUpSummary(null)}
            style={{
              background: "transparent",
              border: "none",
              color: "#b3a8f8",
              cursor: "pointer",
              fontSize: 15,
              padding: "0 4px",
            }}
          ></button>
        </div>
      )}

      {/* ── Messages Area ──────────────────────────────────────── */}
      <div
        className="cc-messages"
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          background: T.bgAlt,
        }}
      >
        {directMessages.length === 0 && (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            gap: 10,
            color: T.muted,
            fontSize: 13,
            textAlign: "center",
            padding: 24,
          }}>
            <div style={{ fontSize: 34 }}><Icon name="chat" /></div>
            <div style={{ fontWeight: 600, color: T.text, fontSize: 15 }}>
              Chat with {other?.display_name || other?.username}
            </div>
            <p style={{ margin: 0, maxWidth: 300, lineHeight: 1.5 }}>
              Send a message below for live real-time chat, or tap <code>@ai</code> to bring Kikar AI Co-Pilot into the conversation!
            </p>
          </div>
        )}

        {directMessages.map((m: any, i: number) => {
          const botMatch = typeof m.content === "string" ? m.content.match(/^\[bot:(.*?):(.*?)]:([\s\S]*)$/i) : null
          const replicaMatch = typeof m.content === "string" ? m.content.match(/^\[replica:(.*?)\]:\s*([\s\S]*)$/i) : null
          const botName = botMatch ? botMatch[1] : null
          const botEmoji = botMatch ? botMatch[2] : null
          const replicaBadge = botMatch ? `${botEmoji} ${botName}` : replicaMatch ? replicaMatch[1] : m.is_replica_reply ? "AI Replica" : null
          const displayContent = botMatch ? botMatch[3].trim() : replicaMatch ? replicaMatch[2] : m.content

          const isAiCoPilot = replicaBadge?.includes("Co-Pilot")
          const isCustomBot = !!botMatch
          const isUser = m.sender_id === session.user.id && !isAiCoPilot && !replicaBadge
          const isImage = displayContent?.startsWith("[image]:")
          const imageUrl = isImage ? displayContent.replace("[image]:", "") : null
          const showDate = i === 0 || formatDate(m.created_at) !== formatDate(directMessages[i - 1].created_at)
          const msgId = String(m.id ?? `dm-${i}`)
          const showActions = activeActionMsgId === msgId || speakingMsgId === msgId

          return (
            <div key={msgId}>
              {showDate && (
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  margin: "10px 0 6px",
                }}>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                  <div style={{
                    fontSize: 10,
                    color: T.muted2,
                    fontWeight: 600,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    padding: "2px 10px",
                    background: T.surface,
                    borderRadius: 999,
                    border: `1px solid ${T.border}`,
                  }}>{formatDate(m.created_at)}</div>
                  <div style={{ flex: 1, height: 1, background: T.border }} />
                </div>
              )}

              <div
                onClick={() => setActiveActionMsgId(prev => (prev === msgId ? null : msgId))}
                onMouseEnter={() => setActiveActionMsgId(msgId)}
                onMouseLeave={() => setActiveActionMsgId(null)}
                style={{
                  display: "flex",
                  flexDirection: isUser ? "row-reverse" : "row",
                  alignItems: "flex-end",
                  gap: 6,
                  marginBottom: 4,
                }}
              >
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isUser ? "flex-end" : "flex-start",
                  maxWidth: "80%",
                }}>
                  {replicaBadge && (
                    <div style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: (isAiCoPilot || isCustomBot) ? T.primary : "#b3a8f8",
                      background: (isAiCoPilot || isCustomBot) ? "hsla(226,72%,70%,0.12)" : "rgba(139,124,246,0.14)",
                      border: (isAiCoPilot || isCustomBot) ? "1px solid hsla(226,72%,70%,0.3)" : "1px solid rgba(139,124,246,0.3)",
                      borderRadius: 999,
                      padding: "2px 8px",
                      marginBottom: 4,
                    }}>
                      {replicaBadge}
                    </div>
                  )}

                  <div
                    className="cc-bubble"
                    style={{
                      padding: isImage ? 4 : "10px 14px",
                      borderRadius: 14,
                      lineHeight: 1.5,
                      fontSize: 14,
                      wordBreak: "break-word",
                      borderBottomRightRadius: isUser ? 4 : 14,
                      borderBottomLeftRadius: isUser ? 14 : 4,
                      background: isImage
                        ? "transparent"
                        : isUser
                        ? "linear-gradient(135deg, hsl(226,72%,70%) 0%, hsl(226,62%,58%) 100%)"
                        : replicaBadge
                        ? "rgba(139,124,246,0.12)"
                        : T.surface,
                      color: isUser ? T.primaryFg : T.text,
                      border: isUser || isImage
                        ? "none"
                        : replicaBadge
                        ? "1px solid rgba(139,124,246,0.35)"
                        : `1px solid ${T.border}`,
                      fontWeight: isUser ? 500 : 400,
                    }}
                  >
                    {isImage
                      ? <img src={imageUrl!}
                          alt="Attachment"
                          style={{ maxWidth: 230, maxHeight: 260, borderRadius: 10, display: "block", cursor: "pointer" }}
                          onClick={(e) => { e.stopPropagation(); window.open(imageUrl!, "_blank") }} />
                      : displayContent}
                  </div>

                  {/* Timestamp + read receipt */}
                  <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 2, padding: "0 2px" }}>
                    <span style={{ fontSize: 10, color: T.muted2 }}>
                      {m.created_at ? formatTime(m.created_at) : ""}
                    </span>
                    {isUser && (
                      <span style={{
                        fontSize: 10,
                        color: m.read_at ? T.primary : T.muted2,
                        fontWeight: 600,
                      }}>
                        {String(m.id).startsWith("temp-") ? "⋯" : m.read_at ? "✓✓" : null}
                      </span>
                    )}
                  </div>
                </div>

                {/* Touch & Hover Action Buttons */}
                {showActions && (
                  <div
                    onClick={e => e.stopPropagation()}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      marginBottom: 16,
                    }}
                  >
                    {!isImage && (
                      <button
                        type="button"
                        title="Play audio"
                        onClick={() => handleSpeakToggle(displayContent, msgId)}
                        style={{
                          background: speakingMsgId === msgId ? "hsla(226,72%,70%,0.2)" : T.surface,
                          border: `1px solid ${speakingMsgId === msgId ? T.primary : T.border}`,
                          borderRadius: 6,
                          color: speakingMsgId === msgId ? T.primary : T.muted,
                          fontSize: 11,
                          cursor: "pointer",
                          padding: "4px 6px",
                        }}
                      >
                        {speakingMsgId === msgId ? <Icon name="stop" /> : <Icon name="volume" />}
                      </button>
                    )}

                    <button
                      type="button"
                      title="Copy message"
                      onClick={() => handleCopy(m.content, msgId)}
                      style={{
                        background: T.surface,
                        border: `1px solid ${T.border}`,
                        borderRadius: 6,
                        color: copiedId === msgId ? T.primary : T.muted,
                        fontSize: 11,
                        cursor: "pointer",
                        padding: "4px 6px",
                      }}
                    >
                      {copiedId === msgId ? null : <Icon name="copy" />}
                    </button>

                    {m.sender_id === session.user.id && (
                      <button
                        type="button"
                        title="Delete message"
                        onClick={() => handleDeleteMessage(m.id)}
                        style={{
                          background: T.surface,
                          border: `1px solid ${T.border}`,
                          borderRadius: 6,
                          color: T.red,
                          fontSize: 11,
                          cursor: "pointer",
                          padding: "4px 6px",
                        }}
                      >
                        <Icon name="trash" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {replicaTyping && (
          <div style={{
            fontSize: 11,
            color: typingLabel?.includes("Co-Pilot") ? T.primary : "#b3a8f8",
            padding: "6px 12px",
            background: typingLabel?.includes("Co-Pilot") ? "hsla(226,72%,70%,0.1)" : "rgba(139,124,246,0.1)",
            border: typingLabel?.includes("Co-Pilot") ? "1px solid hsla(226,72%,70%,0.25)" : "1px solid rgba(139,124,246,0.25)",
            borderRadius: 999,
            alignSelf: "flex-start",
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}>
            <span>{typingLabel || "AI is replying…"}</span>
          </div>
        )}

        <div ref={bottomRef} style={{ height: 4 }} />
      </div>

      {/* ── Mobile-Optimized Input Bar ─────────────────────────── */}
      <div style={{
        display: "flex",
        gap: 6,
        padding: "8px 10px",
        background: T.surface,
        borderTop: `1px solid ${T.border}`,
        flexShrink: 0,
        paddingBottom: "max(10px, env(safe-area-inset-bottom))",
        alignItems: "center",
      }}>
        <input type="file" accept="image/*" style={{ display: "none" }}
          ref={fileInputRef} onChange={handleImageUpload} />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingImage}
          title="Upload image"
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: T.bgAlt,
            border: `1px solid ${T.border}`,
            fontSize: 16,
            cursor: uploadingImage ? "not-allowed" : "pointer",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >{uploadingImage ? <Icon name="clock" /> : <Icon name="image" />}</button>

        <button
          type="button"
          onClick={() => {
            if (!input.startsWith("@ai ")) setInput(`@ai ${input}`)
          }}
          title="Summon Kikar AI Co-Pilot"
          style={{
            padding: "0 9px",
            height: 36,
            borderRadius: 999,
            background: input.startsWith("@ai") ? "hsla(226,72%,70%,0.18)" : T.bgAlt,
            border: input.startsWith("@ai") ? `1px solid ${T.primary}` : `1px solid ${T.border}`,
            color: input.startsWith("@ai") ? T.primary : T.muted,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: T.font,
            flexShrink: 0,
          }}
        >
          @ai
        </button>

        <button
          type="button"
          onClick={() => {
            if (!input.startsWith("@replica ")) setInput(`@replica ${input}`)
          }}
          title={`Talk directly to ${otherName}'s Replica`}
          style={{
            padding: "0 9px",
            height: 36,
            borderRadius: 999,
            background: input.startsWith("@replica") ? "rgba(139,124,246,0.2)" : T.bgAlt,
            border: input.startsWith("@replica") ? "1px solid #b3a8f8" : `1px solid ${T.border}`,
            color: input.startsWith("@replica") ? "#b3a8f8" : T.muted,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: T.font,
            flexShrink: 0,
          }}
        >
          @replica
        </button>

        <button
          type="button"
          onClick={() => setShowSummonModal(true)}
          title="Summon any custom bot created by any user"
          style={{
            padding: "0 9px",
            height: 36,
            borderRadius: 999,
            background: "hsla(226,72%,70%,0.15)",
            border: `1px solid ${T.primary}`,
            color: T.primary,
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: T.font,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <span>🤖</span>
          <span>Bots</span>
        </button>

        <input
          className="cc-chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendDirectMessage()}
          placeholder="Message (or @ai)…"
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
          onClick={sendDirectMessage}
          disabled={!input.trim()}
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: !input.trim()
              ? T.surface
              : "linear-gradient(135deg, hsl(226,72%,70%), hsl(226,62%,58%))",
            border: `1px solid ${!input.trim() ? T.border : "transparent"}`,
            fontSize: 16,
            cursor: !input.trim() ? "not-allowed" : "pointer",
            color: !input.trim() ? T.muted : T.primaryFg,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >↑</button>
      </div>

      {/* ── Summon Custom Bot Modal ── */}
      <SummonBotModal
        isOpen={showSummonModal}
        onClose={() => setShowSummonModal(false)}
        characters={characters}
        channelOrPeerName={otherName}
        onSelectBot={handleSummonBotInDM}
      />
    </div>
  )
}