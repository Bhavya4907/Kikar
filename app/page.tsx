"use client"
import { useEffect, useState } from "react"
import { supabase } from "../src/lib/supabase"
import { requestNotificationPermission, showNotification } from "../src/lib/helpers"
import AuthScreen from "../src/components/AuthScreen"
import Sidebar from "../src/components/Sidebar"
import ChatWindow from "../src/components/ChatWindow"
import DMWindow from "../src/components/DMWIndow"
import CharacterForm from "../src/components/CharacterForm"
import ProfileForm from "../src/components/ProfileForm"
import ElectricBorder from "../src/components/ElectricBorder"
import ModeSelection from "../src/components/ModeSelection"
import AIGridView from "../src/components/AIGridView"
import PricingModal from "../src/components/PricingModal"
import { T } from "../src/styles"
import type { PlanTier, UsageQuota } from "../src/lib/types"

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
  const [searchEmail,   setSearchEmail]   = useState("")
  const [searchResult,  setSearchResult]  = useState<any>(null)
  const [view,          setView]          = useState<"ai"|"people">("ai")
  const [showForm,      setShowForm]      = useState(false)
  const [editingChar,   setEditingChar]   = useState<any>(null)
  const [showProfile,   setShowProfile]   = useState(false)
  const [profile,       setProfile]       = useState<any>(null)
  const [creating,      setCreating]      = useState(false)
  const [chatOpen,      setChatOpen]      = useState(false)
  const [initialModeSelected, setInitialModeSelected] = useState(false)

  // Commercialization state: Plan Tier & Daily/Monthly Quotas
  const [planTier, setPlanTier] = useState<PlanTier>("free")
  const [quota, setQuota] = useState<UsageQuota | null>(null)
  const [showPricing, setShowPricing] = useState(false)

  // ── Mode Persistence ─────────────────────────────────────────
  useEffect(() => {
    const savedMode = localStorage.getItem("kikar_mode")
    if (savedMode === "ai" || savedMode === "people") {
      setView(savedMode as "ai"|"people")
      setInitialModeSelected(true)
    }
  }, [])

  function handleSetView(m: "ai"|"people") {
    setView(m)
    localStorage.setItem("kikar_mode", m)
    // On mobile, switching views should return to the main list view of that mode
    setActiveChar(null)
    setActiveConvo(null)
    setShowForm(false)
    setEditingChar(null)
    setShowProfile(false)
    setChatOpen(false)
  }

  function selectMode(m: "ai"|"people") {
    setView(m)
    setInitialModeSelected(true)
    setChatOpen(false)
    localStorage.setItem("kikar_mode", m)
  }

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
      .or(`is_public.eq.true,created_by.eq.${session.user.id}`)
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
        setConversations([])
        return
      }
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url,is_online,last_seen")
        .in("id", ids)
      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
      const enriched = data.map(c => ({
        ...c,
        user1: profileMap[c.user1_id] || null,
        user2: profileMap[c.user2_id] || null,
      }))
      setConversations(enriched)
    }

    fetchConversations()
    const interval = setInterval(fetchConversations, 5000)
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
          setQuota(defaultQuota)
          supabase.from("usage_quotas").upsert(defaultQuota, { onConflict: "user_id" }).then(() => {})
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
    const nextUsed = quota.daily_chat_used + 1
    setQuota({ ...quota, daily_chat_used: nextUsed })
    if (session?.user?.id) {
      supabase
        .from("usage_quotas")
        .update({ daily_chat_used: nextUsed, updated_at: new Date().toISOString() })
        .eq("user_id", session.user.id)
        .then(() => {})
    }
    return true
  }

  function consumeImageQuota(): boolean {
    if (!quota) return true
    if (quota.monthly_image_used >= quota.monthly_image_limit) {
      return false
    }
    const nextUsed = quota.monthly_image_used + 1
    setQuota({ ...quota, monthly_image_used: nextUsed })
    if (session?.user?.id) {
      supabase
        .from("usage_quotas")
        .update({ monthly_image_used: nextUsed, updated_at: new Date().toISOString() })
        .eq("user_id", session.user.id)
        .then(() => {})
    }
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

  // ── Load all profiles (with live presence refresh) ────────────
  useEffect(() => {
    if (!session || view !== "people") {
      return
    }

    function fetchProfiles() {
      supabase.from("profiles").select("*")
        .neq("id", session.user.id)
        .order("is_online", { ascending: false })
        .then(({ data }) => {
          if (data) setAllProfiles(data)
        })
    }

    fetchProfiles()
    const pollProfiles = setInterval(fetchProfiles, 5000)

    const ch = supabase
      .channel("profiles-online")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" },
        (p) => {
          setAllProfiles(prev => prev.map(prof =>
            prof.id === p.new.id ? { ...prof, ...p.new } : prof
          ))
        })
      .subscribe()

    return () => {
      clearInterval(pollProfiles)
      supabase.removeChannel(ch)
    }
  }, [session, view])

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
          showNotification(`New message from ${name}`, isImage ? "📷 Sent an image" : p.new.content)
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [session, conversations, activeConvo])

  // ── Navigation ────────────────────────────────────────────────
  function openChar(c: any) {
    setActiveChar(c); setShowForm(false); setEditingChar(null); setActiveConvo(null)
    setShowProfile(false); setChatOpen(true)
  }
  function openConvo(c: any) {
    setView("people")
    localStorage.setItem("kikar_mode", "people")
    setActiveConvo(c); setActiveChar(null); setShowForm(false); setEditingChar(null)
    setShowProfile(false); setChatOpen(true)
  }
  function openForm() {
    setEditingChar(null); setShowForm(true); setActiveChar(null); setActiveConvo(null)
    setShowProfile(false); setChatOpen(true)
  }
  function openEditForm(char: any) {
    setEditingChar(char); setShowForm(true); setActiveChar(null); setActiveConvo(null)
    setShowProfile(false); setChatOpen(true)
  }
  function goBack() {
    setChatOpen(false)
    setActiveChar(null)
    setActiveConvo(null)
    setShowForm(false)
    setEditingChar(null)
    setShowProfile(false)
  }

  // ── Actions ───────────────────────────────────────────────────
  async function searchUser() {
    if (!searchEmail.trim()) return
    const { data } = await supabase.from("profiles").select("*")
      .ilike("username", `%${searchEmail}%`)
      .neq("id", session.user.id).limit(5)
    setSearchResult(data?.[0] || null)
  }

  async function startConversation(otherUserId: string) {
    const { data: existing } = await supabase
      .from("conversations")
      .select("*")
      .or(`and(user1_id.eq.${session.user.id},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${session.user.id})`)
      .maybeSingle()

    if (existing) {
      const ids = [existing.user1_id, existing.user2_id]
      const { data: profiles } = await supabase.from("profiles").select("id,username,display_name,avatar_url,is_online,last_seen").in("id", ids)
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
      const { data: profiles } = await supabase.from("profiles").select("id,username,display_name,avatar_url,is_online,last_seen").in("id", ids)
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
    setChatOpen(false)
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
        background: "#0d0d0d",
        fontFamily: "'Sora', -apple-system, sans-serif",
      }}>
        <div style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          background: "hsla(119,99%,46%,0.15)",
          border: "1px solid hsla(119,99%,46%,0.35)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 24,
          color: "hsl(119,99%,46%)",
          boxShadow: "0 0 24px hsla(119,99%,46%,0.2)",
          animation: "pulse-dot 1.5s infinite ease-in-out",
        }}>✦</div>
      </div>
    )
  }

  // ── Auth guard ────────────────────────────────────────────────
  if (!session) return <AuthScreen />

  // ── Main app ──────────────────────────────────────────────────
  if (!initialModeSelected) {
    return (
      <div style={{ display: "flex", minHeight: "100dvh", width: "100%" }}>
        <ModeSelection onSelect={selectMode} />
      </div>
    )
  }

  const modeClass = view === "ai" ? "ai-view" : "people-view"

  return (
    <div className={`cc-app ${modeClass}${chatOpen ? " chat-open" : ""}`}>

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

      {view !== "ai" && (
        <Sidebar
          session={session}
          view={view}
          setView={handleSetView}
          characters={characters}
          charsLoading={charsLoading}
          activeChar={activeChar}
          activeConvo={activeConvo}
          conversations={conversations}
          allProfiles={allProfiles}
          showForm={showForm}
          searchEmail={searchEmail}
          setSearchEmail={setSearchEmail}
          searchResult={searchResult}
          onOpenChar={openChar}
          onOpenConvo={openConvo}
          onOpenForm={openForm}
          onOpenProfile={() => { setShowProfile(true); setChatOpen(true) }}
          onStartConversation={startConversation}
          onSearchUser={searchUser}
          onDeleteCharacter={deleteCharacter}
          onSignOut={handleSignOut}
        />
      )}

      <main className="cc-main">
        {view === "people" && activeConvo ? (
          <DMWindow
            session={session}
            activeConvo={activeConvo}
            allProfiles={allProfiles}
            onBack={goBack}
            creating={creating}
            setCreating={setCreating}
            onReplicaCreated={(char) => {
              setCharacters(prev => [char, ...prev.filter(c => c.replica_of !== char.replica_of)])
              setView("ai")
              openChar(char)
            }}
          />

        ) : view === "people" && !activeConvo && !showProfile ? (
          <div style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 32,
            background: T.bgAlt,
            fontFamily: T.font,
          }}>
            <ElectricBorder
              color="#a855f7"
              speed={1}
              chaos={0.12}
              borderRadius={20}
              style={{
                background: "rgba(22, 22, 22, 0.9)",
                backdropFilter: "blur(16px)",
                padding: "36px 32px",
                maxWidth: 360,
                textAlign: "center",
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  background: "rgba(168,85,247,0.12)",
                  border: "1px solid rgba(168,85,247,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                  boxShadow: "0 0 32px rgba(168,85,247,0.18)",
                }}>◉</div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 6, letterSpacing: "-0.02em" }}>
                    Connect with People &amp; Replicas
                  </div>
                  <p style={{ color: T.muted, fontSize: 13, textAlign: "center", lineHeight: 1.7, margin: 0 }}>
                    Search for someone by username or select a direct message to start chatting live.
                  </p>
                </div>
              </div>
            </ElectricBorder>
          </div>

        ) : showProfile ? (
          <ProfileForm
            session={session}
            profile={profile}
            onSaved={(updated) => {
              setProfile(updated)
              setShowProfile(false)
              goBack()
            }}
            onCancel={() => { setShowProfile(false); goBack() }}
          />

        ) : showForm ? (
          <CharacterForm
            session={session}
            initialChar={editingChar}
            onCreated={(char) => {
              setCharacters(prev => [char, ...prev])
              setEditingChar(null)
              setShowForm(false)
              openChar(char)
              setMessages([])
            }}
            onUpdated={(updated) => {
              setCharacters(prev => prev.map(c => c.id === updated.id ? updated : c))
              setEditingChar(null)
              setShowForm(false)
              openChar(updated)
            }}
            onCancel={() => { setShowForm(false); setEditingChar(null); goBack() }}
          />

        ) : !activeChar ? (
          <AIGridView
            characters={characters}
            charsLoading={charsLoading}
            session={session}
            onOpenChar={openChar}
            onOpenForm={openForm}
            onEditChar={openEditForm}
            onDeleteCharacter={deleteCharacter}
            setView={handleSetView}
            onOpenProfile={() => { setShowProfile(true); setChatOpen(true) }}
            onSignOut={handleSignOut}
            planTier={planTier}
            onOpenPricing={() => setShowPricing(true)}
          />
        ) : (
          <ChatWindow
            session={session}
            activeChar={activeChar}
            messages={messages}
            setMessages={setMessages}
            onBack={goBack}
            creating={creating}
            setCreating={setCreating}
            onDeleteCharacter={deleteCharacter}
            onEditChar={openEditForm}
            planTier={planTier}
            quota={quota}
            onConsumeChatQuota={consumeChatQuota}
            onConsumeImageQuota={consumeImageQuota}
            onOpenPricing={() => setShowPricing(true)}
          />
        )}
      </main>
    </div>
  )
}
