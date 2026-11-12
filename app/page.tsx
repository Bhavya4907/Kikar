"use client"
import { useEffect, useState } from "react"
import { supabase } from "../src/lib/supabase"
import { requestNotificationPermission, showNotification } from "../src/lib/helpers"
import AuthScreen from "../src/components/AuthScreen"
import ProfileForm from "../src/components/ProfileForm"
import PricingModal from "../src/components/PricingModal"
import DiscordView from "../src/components/discord/DiscordView"
import type { PlanTier, UsageQuota } from "../src/lib/types"
import { Icon } from "../src/components/Icons"

// Poll results usually come back identical. Setting state with a brand-new (but equal)
// array still re-renders the whole app, so we skip the update when nothing changed.
function sameData(a: unknown, b: unknown) {
  try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false }
}

export default function Home() {
  const [session,       setSession]       = useState<any>(null)
  const [authChecking,  setAuthChecking]  = useState(true)
  const [characters,    setCharacters]    = useState<any[]>([])
  const [activeChar,    setActiveChar]    = useState<any>(null)
  const [messages,      setMessages]      = useState<any[]>([])
  const [charsLoading,  setCharsLoading]  = useState(true)
  const [conversations, setConversations] = useState<any[]>([])
  const [activeConvo,   setActiveConvo]   = useState<any>(null)
  const [allProfiles,   setAllProfiles]   = useState<any[]>([])
  const [showProfile,   setShowProfile]   = useState(false)
  const [profile,       setProfile]       = useState<any>(null)
  const [creating,      setCreating]      = useState(false)

  // Commercialization state: Plan Tier & Daily/Monthly Quotas
  const [planTier, setPlanTier] = useState<PlanTier>("free")
  const [quota, setQuota] = useState<UsageQuota | null>(null)
  const [showPricing, setShowPricing] = useState(false)

  // ── Auth ─────────────────────────────────────────────────────
  useEffect(() => {
    requestNotificationPermission()
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthChecking(false)
      if (data.session?.user?.id) initPushNotifications(data.session.user.id)
    }).catch(() => {
      setAuthChecking(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      setAuthChecking(false)
      if (s?.user?.id) initPushNotifications(s.user.id)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function initPushNotifications(userId: string) {
    if (!(window as any).Capacitor) return
    try {
      const { PushNotifications } = await import("@capacitor/push-notifications")
      const permission = await PushNotifications.requestPermissions()
      if (permission.receive !== "granted") return
      await PushNotifications.register()
      PushNotifications.addListener("registration", token => {
        supabase.from("profiles")
          .update({ push_token: token.value })
          .eq("id", userId)
          .then(() => {})
      })
    } catch (err) {
      console.log("Push notifications not available:", err)
    }
  }

  // ── Load characters ───────────────────────────────────────────
  useEffect(() => {
    if (!session) return
    setCharsLoading(true)
    supabase.from("characters")
      .select("*")
      .or(`is_public.eq.true,created_by.eq.${session.user.id},is_replica.eq.true`)
      .order("created_at", { ascending: false })
      .then(({ data }) => { setCharacters(data || []); setCharsLoading(false) })
  }, [session])

  // ── Load messages for active character ────────────────────────
  useEffect(() => {
    if (!activeChar || !session) { setMessages([]); return }
    supabase.from("messages").select("*")
      .eq("character_id", activeChar.id).eq("user_id", session.user.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => setMessages(data || []))
  }, [activeChar, session])

  // ── Load conversations (with periodic sync for new incoming DMs) ──
  useEffect(() => {
    if (!session) return

    async function fetchConversations() {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .or(`user1_id.eq.${session.user.id},user2_id.eq.${session.user.id}`)
        .order("created_at", { ascending: false })

      if (!data) return
      const ids = [...new Set(data.flatMap(c => [c.user1_id, c.user2_id]))]
      if (ids.length === 0) {
        setConversations(prev => (prev.length === 0 ? prev : []))
        return
      }
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url,is_online,last_seen,auto_replica_enabled,replica_status_note,plan_tier")
        .in("id", ids)
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
      const enriched = data.map(c => ({
        ...c,
        user1: profileMap[c.user1_id] || null,
        user2: profileMap[c.user2_id] || null,
      }))
      setConversations(prev => (sameData(prev, enriched) ? prev : enriched))
    }

    fetchConversations()
    // 8s instead of 5s, and skipped while the tab is in the background
    const interval = setInterval(() => {
      if (!document.hidden) fetchConversations()
    }, 8000)
    return () => clearInterval(interval)
  }, [session])

  // ── Load profile & usage quotas (with auto-creation if missing) ──
  useEffect(() => {
    if (!session) return

    async function loadProfileAndQuotas() {
      try {
        const { data: existing } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", session.user.id)
          .maybeSingle()

        if (existing) {
          setProfile(existing)
          if (existing.plan_tier === "plus" || existing.plan_tier === "pro") {
            setPlanTier(existing.plan_tier)
          }
        } else {
          const userMeta = session.user.user_metadata || {}
          const emailPrefix = session.user.email?.split("@")[0] || "user"
          const username = userMeta.username || emailPrefix
          const displayName = userMeta.display_name || userMeta.full_name || username

          const newProfile = {
            id: session.user.id,
            username,
            display_name: displayName,
            avatar_url: userMeta.avatar_url || "",
            bio: "",
            is_online: true,
            last_seen: new Date().toISOString(),
          }

          const { data: created } = await supabase
            .from("profiles")
            .upsert(newProfile, { onConflict: "id" })
            .select()
            .maybeSingle()

          setProfile(created || newProfile)
        }

        const { data: existingQuota } = await supabase
          .from("usage_quotas")
          .select("*")
          .eq("user_id", session.user.id)
          .maybeSingle()

        if (existingQuota) {
          setQuota(existingQuota)
        } else {
          const defaultQuota: UsageQuota = {
            user_id: session.user.id,
            daily_chat_used: 0,
            daily_chat_limit: 30,
            monthly_image_used: 0,
            monthly_image_limit: 3,
          }
          // The server creates the real row on the first AI request; clients can no longer write quotas.
          setQuota(defaultQuota)
        }
      } catch (err) {
        console.error("Error loading profile or quotas:", err)
      }
    }

    loadProfileAndQuotas()
  }, [session])

  function consumeChatQuota(): boolean {
    if (!quota) return true
    if (quota.daily_chat_used >= quota.daily_chat_limit) {
      return false
    }
    // Local mirror only (instant UI feedback). The server enforces and records the real quota.
    setQuota({ ...quota, daily_chat_used: quota.daily_chat_used + 1 })
    return true
  }

  function consumeImageQuota(): boolean {
    if (!quota) return true
    if (quota.monthly_image_used >= quota.monthly_image_limit) {
      return false
    }
    setQuota({ ...quota, monthly_image_used: quota.monthly_image_used + 1 })
    return true
  }

  // ── Online presence heartbeat ────────────────────────────────
  useEffect(() => {
    if (!session) return

    supabase.from("profiles")
      .update({ is_online: true, last_seen: new Date().toISOString() })
      .eq("id", session.user.id).then(() => {})

    const handleOffline = () => {
      supabase.from("profiles")
        .update({ is_online: false, last_seen: new Date().toISOString() })
        .eq("id", session.user.id).then(() => {})
    }
    window.addEventListener("beforeunload", handleOffline)

    const heartbeat = setInterval(() => {
      supabase.from("profiles")
        .update({ is_online: true, last_seen: new Date().toISOString() })
        .eq("id", session.user.id).then(() => {})
    }, 20000)

    return () => {
      window.removeEventListener("beforeunload", handleOffline)
      clearInterval(heartbeat)
      handleOffline()
    }
  }, [session])

  // ── Load all profiles immediately & keep presence synced ────
  useEffect(() => {
    if (!session) {
      setAllProfiles([])
      return
    }

    function fetchProfiles() {
      supabase.from("profiles").select("*")
        .neq("id", session.user.id)
        .order("is_online", { ascending: false })
        .then(({ data }) => {
          if (data) setAllProfiles(prev => (sameData(prev, data) ? prev : data))
        })
    }

    fetchProfiles()
    const pollProfiles = setInterval(() => {
      if (!document.hidden) fetchProfiles()
    }, 8000)

    const ch = supabase
      .channel("profiles-online")
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" },
        (p) => {
          if (p.eventType === "INSERT" && p.new.id !== session.user.id) {
            setAllProfiles(prev => (prev.some(prof => prof.id === p.new.id) ? prev : [p.new, ...prev]))
          } else if (p.eventType === "UPDATE") {
            setAllProfiles(prev => prev.map(prof =>
              prof.id === p.new.id ? { ...prof, ...p.new } : prof
            ))
          }
        })
      .subscribe()

    return () => {
      clearInterval(pollProfiles)
      supabase.removeChannel(ch)
    }
  }, [session])

  // ── Global DM notifications ───────────────────────────────────
  useEffect(() => {
    if (!session) return
    const ch = supabase
      .channel("global-dm-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" },
        (p) => {
          if (p.new.sender_id === session.user.id) return
          if (activeConvo?.id === p.new.conversation_id) return
          const convo = conversations.find(c => c.id === p.new.conversation_id)
          if (!convo) return
          const other = convo.user1_id === session.user.id ? convo.user2 : convo.user1
          const name = other?.display_name || other?.username || "Someone"
          const isImage = p.new.content?.startsWith("[image]:")
          showNotification(`New message from ${name}`, isImage ? "Sent an image" : p.new.content)
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [session, conversations, activeConvo])

  // ── Navigation ────────────────────────────────────────────────
  function openChar(c: any) {
    if (c && c.id) {
      setCharacters(prev => {
        const exists = prev.some(item => item.id === c.id)
        if (exists) {
          return prev.map(item => item.id === c.id ? c : item)
        }
        return [c, ...prev]
      })
    }
    setActiveChar(c)
    setActiveConvo(null)
    setShowProfile(false)
  }
  function openConvo(c: any) {
    setActiveConvo(c)
    setActiveChar(null)
    setShowProfile(false)
  }
  function goBack() {
    setActiveChar(null)
    setActiveConvo(null)
    setShowProfile(false)
  }

  // ── Actions ───────────────────────────────────────────────────
  async function startConversation(otherUserId: string) {
    const { data: existing } = await supabase
      .from("conversations")
      .select("*")
      .or(`and(user1_id.eq.${session.user.id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${session.user.id})`)
      .maybeSingle()

    if (existing) {
      const ids = [existing.user1_id, existing.user2_id]
      const { data: profiles } = await supabase.from("profiles").select("id,username,display_name,avatar_url,is_online,last_seen,auto_replica_enabled,replica_status_note").in("id", ids)
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
      openConvo({ ...existing, user1: profileMap[existing.user1_id], user2: profileMap[existing.user2_id] })
      return
    }

    const { data } = await supabase
      .from("conversations")
      .insert({ user1_id: session.user.id, user2_id: otherUserId })
      .select("*")
      .single()

    if (data) {
      const ids = [data.user1_id, data.user2_id]
      const { data: profiles } = await supabase.from("profiles").select("id,username,display_name,avatar_url,is_online,last_seen,auto_replica_enabled,replica_status_note").in("id", ids)
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
      const enriched = { ...data, user1: profileMap[data.user1_id], user2: profileMap[data.user2_id] }
      setConversations(prev => [enriched, ...prev])
      openConvo(enriched)
    }
  }

  async function deleteCharacter(id: string) {
    await supabase.from("characters").delete().eq("id", id)
    setCharacters(prev => prev.filter(c => c.id !== id))
    if (activeChar?.id === id) { setActiveChar(null); setMessages([]) }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    setSession(null)
    setActiveChar(null)
    setActiveConvo(null)
    setMessages([])
    setProfile(null)
  }

  // ── Auth Loading Screen ───────────────────────────────────────
  if (authChecking) {
    return (
      <div style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#0b0d11",
        fontFamily: "'Inter', -apple-system, sans-serif",
      }}>
        <div style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          background: "hsla(226,72%,70%,0.15)",
          border: "1px solid hsla(226,72%,70%,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          color: "hsl(226,72%,70%)",
          boxShadow: "0 0 24px hsla(226,72%,70%,0.2)",
          animation: "pulse-dot 1.5s infinite ease-in-out",
        }}><Icon name="spark" /></div>
      </div>
    )
  }

  // ── Auth guard ────────────────────────────────────────────────
  if (!session) return <AuthScreen />

  return (
    <div style={{ width: "100%", height: "100dvh", overflow: "hidden", background: "#0f1115" }}>
      {showPricing && (
        <PricingModal
          session={session}
          currentPlan={planTier}
          quota={quota}
          onClose={() => setShowPricing(false)}
          onPlanUpgraded={(newTier, updatedLimits) => {
            setPlanTier(newTier)
            if (quota) {
              setQuota({
                ...quota,
                daily_chat_limit: updatedLimits.daily_chat_limit ?? quota.daily_chat_limit,
                monthly_image_limit: updatedLimits.monthly_image_limit ?? quota.monthly_image_limit,
              })
            }
          }}
        />
      )}

      {showProfile && (
        <div style={{
          position: "fixed",
          inset: 0,
          zIndex: 1100,
          background: "rgba(0,0,0,0.85)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
        }}>
          <div style={{ width: "100%", maxWidth: 640, maxHeight: "90dvh", display: "flex", overflow: "hidden", borderRadius: 16 }}>
            <ProfileForm
              session={session}
              profile={profile}
              onSaved={(updated) => {
                setProfile(updated)
                setShowProfile(false)
              }}
              onCancel={() => setShowProfile(false)}
            />
          </div>
        </div>
      )}

      <DiscordView
        session={session}
        profile={profile}
        allProfiles={allProfiles}
        characters={characters}
        charsLoading={charsLoading}
        conversations={conversations}
        activeConvo={activeConvo}
        onOpenConvo={openConvo}
        activeChar={activeChar}
        onOpenChar={openChar}
        charMessages={messages}
        setCharMessages={setMessages}
        onCloseActive={goBack}
        onStartConversation={startConversation}
        onOpenProfile={() => setShowProfile(true)}
        onSignOut={handleSignOut}
        planTier={planTier}
        quota={quota}
        onConsumeChatQuota={consumeChatQuota}
        onConsumeImageQuota={consumeImageQuota}
        onOpenPricing={() => setShowPricing(true)}
        onDeleteCharacter={deleteCharacter}
        creating={creating}
        setCreating={setCreating}
      />
    </div>
  )
}
