"use client"
import { useState } from "react"
import { apiFetch } from "../lib/apiFetch"
import { T } from "../styles"
import type { PlanTier, UsageQuota } from "../lib/types"
import { Icon } from "./Icons"

interface Props {
  session: any
  currentPlan: PlanTier
  quota: UsageQuota | null
  onClose: () => void
  onPlanUpgraded: (newTier: PlanTier, updatedQuota: Partial<UsageQuota>) => void
}

export default function PricingModal({
  session,
  currentPlan,
  quota,
  onClose,
  onPlanUpgraded,
}: Props) {
  const [currency, setCurrency] = useState<"INR" | "USD">("INR")
  const [loadingTier, setLoadingTier] = useState<PlanTier | null>(null)
  const [statusMsg, setStatusMsg] = useState("")

  const tiers: Array<{
    id: PlanTier
    name: string
    badge: string
    priceINR: string
    priceUSD: string
    accent: string
    features: string[]
  }> = [
    {
      id: "free",
      name: "Free Explorer",
      badge: "Starter",
      priceINR: "₹0",
      priceUSD: "$0",
      accent: T.muted,
      features: [
        "Unlimited human-to-human Direct Messages",
        "30 AI persona messages per day (Gemini Flash-Lite)",
        "Create custom AI characters with Vibe Sliders",
        "3 trial AI image generations per month",
      ],
    },
    {
      id: "plus",
      name: "Kikar Plus",
      badge: "Most Popular",
      priceINR: "₹249/mo",
      priceUSD: "$5.99/mo",
      accent: T.primary,
      features: [
        "Always-On Offline Digital Replica in DMs",
        "500 daily AI messages routed to Gemini 3.5 Flash",
        "Persistent long-term memory (ChatSorter + pgvector)",
        "Morning Catch-Up Digest for offline replica chats",
        "50 high-res AI image generations per month",
      ],
    },
    {
      id: "pro",
      name: "Kikar Pro & Creator",
      badge: "Power & Creator",
      priceINR: "₹699/mo",
      priceUSD: "$14.99/mo",
      accent: "#8b7cf6",
      features: [
        "Unlimited priority AI persona & Replica messages",
        "250 monthly AI image generations stored on CDN",
        "Expressive AI Voice Note playback & custom tuning",
        "Multiplayer @ai Co-Pilot inside human DM threads",
        "Verified Creator Badge & Marketplace tip jar eligibility",
      ],
    },
  ]

  async function handleSelectPlan(tier: PlanTier) {
    if (!session?.user?.id || tier === currentPlan) return
    setLoadingTier(tier)
    setStatusMsg("")
    try {
      const provider = currency === "INR" ? "razorpay" : "stripe"
      const res = await apiFetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          planTier: tier,
          provider,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setStatusMsg(data.error)
        return
      }

      if (data.checkoutUrl) {
        window.open(data.checkoutUrl, "_blank")
        setStatusMsg("Checkout opened in a new tab. Complete payment to activate your plan.")
        return
      }

      if (data.orderId && data.keyId) {
        const options = {
          key: data.keyId,
          amount: data.amount,
          currency: data.currency,
          name: "Kikar AI",
          description: `Kikar ${tier.toUpperCase()} Subscription`,
          order_id: data.orderId,
          handler: function (_response: any) {
            setStatusMsg("Payment successful! Upgrading plan...")
            onPlanUpgraded(tier, {
              daily_chat_limit: data.limits?.daily_chat_limit ?? 500,
              monthly_image_limit: data.limits?.monthly_image_limit ?? 50,
            })
          },
          prefill: {
            email: session?.user?.email || "",
          },
          theme: {
            color: "#16a34a",
          },
        }

        const openRzp = () => {
          const rzp = new (window as any).Razorpay(options)
          rzp.open()
        }

        if ((window as any).Razorpay) {
          openRzp()
        } else {
          const script = document.createElement("script")
          script.src = "https://checkout.razorpay.com/v1/checkout.js"
          script.onload = openRzp
          document.body.appendChild(script)
        }
        return
      }

      if (data.success) {
        setStatusMsg(data.message || `Switched to Kikar ${tier.toUpperCase()}!`)
        onPlanUpgraded(tier, {
          daily_chat_limit: data.limits?.daily_chat_limit ?? 500,
          monthly_image_limit: data.limits?.monthly_image_limit ?? 50,
        })
      }
    } catch (err: any) {
      setStatusMsg(err?.message || "Failed to process upgrade.")
    } finally {
      setLoadingTier(null)
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0,0,0,0.82)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        fontFamily: T.font,
        overflowY: "auto",
      }}
      onClick={onClose}
    >
      <div
        className="cc-pricing-dialog"
        onClick={e => e.stopPropagation()}
        style={{
          background: T.surface,
          border: `1px solid ${T.border}`,
          borderRadius: 20,
          maxWidth: 920,
          width: "100%",
          padding: "28px 24px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.75)",
          maxHeight: "92dvh",
          overflowY: "auto",
        }}
      >
        {/* Top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, color: T.primary, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>
              <span><Icon name="radar" /></span> Kikar Commercial Plans
            </div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: T.text, letterSpacing: "-0.02em" }}>
              Power Up Your Digital Twin & AI Personas
            </h2>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {/* Currency switcher */}
            <div style={{ display: "flex", background: T.bgAlt, border: `1px solid ${T.border}`, borderRadius: 10, padding: 3 }}>
              {(["INR", "USD"] as const).map(curr => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setCurrency(curr)}
                  style={{
                    padding: "5px 10px",
                    borderRadius: 7,
                    border: "none",
                    background: currency === curr ? T.surfaceAlt : "transparent",
                    color: currency === curr ? T.primary : T.muted,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: T.font,
                  }}
                >
                  {curr === "INR" ? "₹ INR (UPI)" : "$ USD"}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: T.bgAlt,
                border: `1px solid ${T.border}`,
                color: T.muted,
                fontSize: 16,
                cursor: "pointer",
              }}
            >
              
            </button>
          </div>
        </div>

        {/* Live Quota Usage Bar */}
        {quota && (
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
            padding: "12px 16px",
            background: T.bgAlt,
            border: `1px solid ${T.border}`,
            borderRadius: 12,
            marginBottom: 20,
            alignItems: "center",
            justifyContent: "space-between",
          }}>
            <div style={{ fontSize: 12, color: T.text }}>
              <strong>Current Plan:</strong>{" "}
              <span style={{ color: T.primary, fontWeight: 700, textTransform: "uppercase" }}>{currentPlan}</span>
            </div>
            <div style={{ display: "flex", gap: 20, fontSize: 12, color: T.muted }}>
              <span>
                Daily AI Chats:{" "}
                <strong style={{ color: T.text }}>
                  {quota.daily_chat_used} / {quota.daily_chat_limit >= 999999 ? "∞" : quota.daily_chat_limit}
                </strong>
              </span>
              <span>
                Monthly AI Images:{" "}
                <strong style={{ color: T.text }}>
                  {quota.monthly_image_used} / {quota.monthly_image_limit}
                </strong>
              </span>
            </div>
          </div>
        )}

        {statusMsg && (
          <div style={{
            padding: "10px 14px",
            background: "hsla(226,72%,70%,0.12)",
            border: "1px solid hsla(226,72%,70%,0.35)",
            borderRadius: 10,
            color: T.primary,
            fontSize: 13,
            fontWeight: 600,
            marginBottom: 16,
          }}>
            {statusMsg}
          </div>
        )}

        {/* Pricing Cards Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: 16,
        }}>
          {tiers.map(t => {
            const isCurrent = currentPlan === t.id
            const isHighlight = t.id === "plus"
            return (
              <div
                key={t.id}
                style={{
                  background: T.bgAlt,
                  border: isHighlight
                    ? `1.5px solid ${T.primary}`
                    : isCurrent
                    ? "1.5px solid #8b7cf6"
                    : `1px solid ${T.border}`,
                  borderRadius: 16,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  boxShadow: isHighlight ? "0 8px 30px hsla(226,72%,70%,0.1)" : "none",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: T.text }}>{t.name}</span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: isHighlight ? "hsla(226,72%,70%,0.15)" : "rgba(255,255,255,0.06)",
                      color: t.accent,
                      textTransform: "uppercase",
                    }}>
                      {t.badge}
                    </span>
                  </div>

                  <div style={{ fontSize: 28, fontWeight: 800, color: T.text, margin: "8px 0 16px" }}>
                    {currency === "INR" ? t.priceINR : t.priceUSD}
                  </div>

                  <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "flex", flexDirection: "column", gap: 9 }}>
                    {t.features.map(f => (
                      <li key={f} style={{ fontSize: 12, color: T.muted, display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.45 }}>
                        <span style={{ color: t.accent, fontWeight: 700 }}></span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  disabled={isCurrent || loadingTier === t.id}
                  onClick={() => handleSelectPlan(t.id)}
                  style={{
                    width: "100%",
                    padding: "11px 0",
                    borderRadius: 10,
                    border: isCurrent ? `1px solid ${T.border}` : "none",
                    background: isCurrent
                      ? T.surface
                      : t.id === "pro"
                      ? "linear-gradient(135deg, #8b7cf6 0%, #5b4bc4 100%)"
                      : "linear-gradient(135deg, hsl(226,72%,70%) 0%, hsl(226,62%,58%) 100%)",
                    color: isCurrent ? T.muted : t.id === "pro" ? "#fff" : T.primaryFg,
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: isCurrent ? "default" : "pointer",
                    fontFamily: T.font,
                  }}
                >
                  {isCurrent
                    ? "✓ Active Plan"
                    : loadingTier === t.id
                    ? "Activating…"
                    : `Switch to ${t.name} →`}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
