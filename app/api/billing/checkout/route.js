import { PLAN_LIMITS, isValidPlan } from "../../../../src/lib/plans.js"
import { getAuthedUser, getSupabaseAdmin, isProduction } from "../../../../src/lib/serverAuth.js"
import { checkRateLimit } from "../../../../src/lib/rateLimit.js"

async function applyPlan(supabase, userId, planTier) {
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
}

export async function POST(request) {
  try {
    // The user is identified by their verified token, never by a userId in the body.
    const user = await getAuthedUser(request)
    if (!user) return Response.json({ error: "Please sign in to manage your plan." }, { status: 401 })
    const userId = user.id

    if (!checkRateLimit(`checkout:${userId}`, 10, 60 * 1000)) {
      return Response.json({ error: "Too many attempts. Please wait a moment." }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))
    const planTier = body.planTier || "plus"
    const provider = body.provider === "stripe" ? "stripe" : "razorpay"

    if (!isValidPlan(planTier)) {
      return Response.json({ error: "Valid planTier ('free', 'plus' or 'pro') is required" }, { status: 400 })
    }

    const limits = PLAN_LIMITS[planTier]
    const supabase = getSupabaseAdmin()

    // Switching to the free plan only ever affects the caller's own account.
    if (planTier === "free") {
      if (!supabase) return Response.json({ error: "Billing is not configured." }, { status: 503 })
      await applyPlan(supabase, userId, "free")
      return Response.json({ success: true, planTier: "free", limits, message: "Switched to Free Explorer plan." })
    }

    const razorpayKeyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || ""
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || ""
    const stripePaymentLink =
      planTier === "pro" ? process.env.NEXT_PUBLIC_STRIPE_PRO_LINK : process.env.NEXT_PUBLIC_STRIPE_PLUS_LINK
    const razorpayPaymentLink =
      planTier === "pro" ? process.env.NEXT_PUBLIC_RAZORPAY_PRO_LINK : process.env.NEXT_PUBLIC_RAZORPAY_PLUS_LINK

    // 1. Stripe Payment Link
    if (provider === "stripe" && stripePaymentLink && !stripePaymentLink.includes("your_")) {
      const url = new URL(stripePaymentLink)
      url.searchParams.set("client_reference_id", userId)
      if (user.email) url.searchParams.set("prefilled_email", user.email)
      return Response.json({
        success: true,
        provider: "stripe",
        checkoutUrl: url.toString(),
        planTier,
        limits,
        message: "Redirecting to Stripe checkout...",
      })
    }

    // 2. Razorpay API order
    if (provider === "razorpay" && razorpayKeyId && razorpayKeySecret && !razorpayKeyId.includes("your_")) {
      const amountPaisa = limits.price_inr * 100
      const authHeader = `Basic ${Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64")}`

      const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: authHeader },
        body: JSON.stringify({
          amount: amountPaisa,
          currency: "INR",
          receipt: `rcpt_${userId.slice(0, 8)}_${Date.now()}`,
          notes: { user_id: userId, plan_tier: planTier },
        }),
      })

      if (rzpRes.ok) {
        const order = await rzpRes.json()
        return Response.json({
          success: true,
          provider: "razorpay",
          orderId: order.id,
          amount: amountPaisa,
          currency: "INR",
          keyId: razorpayKeyId,
          planTier,
          limits,
          message: "Razorpay order created successfully.",
        })
      }
      console.error("Razorpay order creation failed with status", rzpRes.status)
    }

    // 3. Razorpay static payment link fallback
    if (provider === "razorpay" && razorpayPaymentLink && !razorpayPaymentLink.includes("your_")) {
      return Response.json({
        success: true,
        provider: "razorpay",
        checkoutUrl: razorpayPaymentLink,
        planTier,
        limits,
        message: "Redirecting to Razorpay payment link...",
      })
    }

    // 4. Local development sandbox ONLY (never in production).
    if (!isProduction()) {
      if (!supabase) return Response.json({ error: "Set SUPABASE_SERVICE_ROLE_KEY to use the dev upgrade sandbox." }, { status: 503 })
      await applyPlan(supabase, userId, planTier)
      return Response.json({
        success: true,
        planTier,
        provider,
        limits,
        isDevMode: true,
        message: `[Dev Mode] Upgraded to Kikar ${planTier.toUpperCase()}. Add Razorpay/Stripe keys for production.`,
      })
    }

    return Response.json(
      { error: "Payment gateway is currently being configured. Please contact support or try again shortly." },
      { status: 503 }
    )
  } catch (err) {
    console.error("Billing checkout error:", err)
    return Response.json({ error: "Checkout failed. Please try again." }, { status: 500 })
  }
}
