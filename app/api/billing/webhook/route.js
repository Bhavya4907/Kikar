import { PLAN_LIMITS, isValidPlan } from "../../../../src/lib/plans.js"
import { getSupabaseAdmin } from "../../../../src/lib/serverAuth.js"
import { verifyStripeSignature, verifyRazorpaySignature } from "../../../../src/lib/webhookVerify.js"

async function upgradeUser(supabase, userId, planTier) {
  const limits = PLAN_LIMITS[planTier]
  const { error: profileError } = await supabase.from("profiles").update({ plan_tier: planTier }).eq("id", userId)
  if (profileError) throw new Error(`profile update failed: ${profileError.message}`)
  const { error: quotaError } = await supabase.from("usage_quotas").upsert(
    {
      user_id: userId,
      daily_chat_limit: limits.daily_chat_limit,
      monthly_image_limit: limits.monthly_image_limit,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  )
  if (quotaError) throw new Error(`quota update failed: ${quotaError.message}`)
  console.log(`[Billing Webhook] Upgraded user ${userId} to ${planTier}`)
}

// Stripe Payment Links can't carry a plan in the URL, so use event metadata if you configured it,
// otherwise infer the plan from the amount that was actually paid (USD).
function stripePlanFromSession(session) {
  const fromMeta = session?.metadata?.plan_tier
  if (isValidPlan(fromMeta) && fromMeta !== "free") return fromMeta
  if (String(session?.currency || "").toLowerCase() === "usd") {
    for (const tier of ["plus", "pro"]) {
      if (session.amount_total === Math.round(PLAN_LIMITS[tier].price_usd * 100)) return tier
    }
  }
  return null
}

export async function POST(request) {
  try {
    const rawBody = await request.text()
    const stripeSig = request.headers.get("stripe-signature")
    const rzpSig = request.headers.get("x-razorpay-signature")

    // Every request must be signed by a provider. Unsigned requests are rejected outright.
    if (!stripeSig && !rzpSig) {
      return Response.json({ error: "Missing signature" }, { status: 400 })
    }

    const supabase = getSupabaseAdmin()
    if (!supabase) {
      console.error("Billing webhook: SUPABASE_SERVICE_ROLE_KEY is not configured")
      return Response.json({ error: "Server not configured" }, { status: 500 })
    }

    // ── Razorpay ──────────────────────────────────────────────
    if (rzpSig) {
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET
      if (!secret) return Response.json({ error: "Razorpay webhook secret not configured" }, { status: 500 })
      if (!verifyRazorpaySignature(rawBody, rzpSig, secret)) {
        return Response.json({ error: "Invalid signature" }, { status: 400 })
      }

      const event = JSON.parse(rawBody)
      if (event.event === "order.paid" || event.event === "payment.captured") {
        const order = event.payload?.order?.entity
        const payment = event.payload?.payment?.entity
        const notes = order?.notes || payment?.notes || {}
        const userId = notes.user_id
        const planTier = notes.plan_tier
        const paidAmount = order?.amount_paid ?? payment?.amount

        if (userId && isValidPlan(planTier) && planTier !== "free") {
          // Only upgrade when the money received matches the plan price.
          if (paidAmount === PLAN_LIMITS[planTier].price_inr * 100) {
            await upgradeUser(supabase, userId, planTier)
          } else {
            console.warn(`[Billing Webhook] Amount mismatch for ${planTier}: got ${paidAmount}`)
          }
        }
      }
      return Response.json({ status: "ok" })
    }

    // ── Stripe ────────────────────────────────────────────────
    const secret = process.env.STRIPE_WEBHOOK_SECRET
    if (!secret) return Response.json({ error: "Stripe webhook secret not configured" }, { status: 500 })
    if (!verifyStripeSignature(rawBody, stripeSig, secret)) {
      return Response.json({ error: "Invalid signature" }, { status: 400 })
    }

    const event = JSON.parse(rawBody)
    if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
      const session = event.data?.object
      const userId = session?.client_reference_id || session?.metadata?.user_id
      const planTier = stripePlanFromSession(session)

      if (session?.payment_status === "paid" && userId && planTier) {
        await upgradeUser(supabase, userId, planTier)
      } else {
        console.warn("[Billing Webhook] Stripe session ignored", {
          paid: session?.payment_status,
          hasUser: Boolean(userId),
          planTier,
        })
      }
    }
    return Response.json({ status: "ok" })
  } catch (err) {
    console.error("Billing webhook error:", err)
    return Response.json({ error: "Webhook processing failed" }, { status: 500 })
  }
}
