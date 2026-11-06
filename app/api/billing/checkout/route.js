import { createClient } from "@supabase/supabase-js";

export const PLAN_LIMITS = {
  free: { daily_chat_limit: 30, monthly_image_limit: 3, price_inr: 0, price_usd: 0 },
  plus: { daily_chat_limit: 500, monthly_image_limit: 50, price_inr: 249, price_usd: 5.99 },
  pro:  { daily_chat_limit: 999999, monthly_image_limit: 250, price_inr: 699, price_usd: 14.99 },
};

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes("your_supabase_url")) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(request) {
  try {
    const { userId, planTier = "plus", provider = "razorpay" } = await request.json();

    if (!userId || !PLAN_LIMITS[planTier]) {
      return Response.json({ error: "Valid userId and planTier ('plus' or 'pro') are required" }, { status: 400 });
    }

    const limits = PLAN_LIMITS[planTier];
    const supabase = getSupabaseAdmin();

    // Free downgrade / reset is always allowed immediately
    if (planTier === "free") {
      if (supabase) {
        await supabase.from("profiles").update({ plan_tier: "free" }).eq("id", userId);
        await supabase.from("usage_quotas").upsert(
          {
            user_id: userId,
            daily_chat_limit: limits.daily_chat_limit,
            monthly_image_limit: limits.monthly_image_limit,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      }
      return Response.json({
        success: true,
        planTier: "free",
        limits,
        message: "Switched to Free Explorer plan.",
      });
    }

    // Check configured payment provider keys
    const razorpayKeyId = process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
    const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET || "";
    const stripePaymentLink = planTier === "pro"
      ? process.env.NEXT_PUBLIC_STRIPE_PRO_LINK
      : process.env.NEXT_PUBLIC_STRIPE_PLUS_LINK;
    const razorpayPaymentLink = planTier === "pro"
      ? process.env.NEXT_PUBLIC_RAZORPAY_PRO_LINK
      : process.env.NEXT_PUBLIC_RAZORPAY_PLUS_LINK;

    // 1. Stripe Payment Link Checkout
    if (provider === "stripe" && stripePaymentLink && !stripePaymentLink.includes("your_")) {
      const checkoutUrl = `${stripePaymentLink}?client_reference_id=${encodeURIComponent(userId)}`;
      return Response.json({
        success: true,
        provider: "stripe",
        checkoutUrl,
        planTier,
        limits,
        message: "Redirecting to Stripe checkout...",
      });
    }

    // 2. Razorpay API Order Creation
    if (provider === "razorpay" && razorpayKeyId && razorpayKeySecret && !razorpayKeyId.includes("your_")) {
      const amountPaisa = limits.price_inr * 100;
      const authHeader = `Basic ${Buffer.from(`${razorpayKeyId}:${razorpayKeySecret}`).toString("base64")}`;
      
      const rzpRes = await fetch("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader,
        },
        body: JSON.stringify({
          amount: amountPaisa,
          currency: "INR",
          receipt: `rcpt_${userId.slice(0, 8)}_${Date.now()}`,
          notes: {
            user_id: userId,
            plan_tier: planTier,
          },
        }),
      });

      if (rzpRes.ok) {
        const order = await rzpRes.json();
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
        });
      }
    }

    // 3. Razorpay Static Payment Link Fallback
    if (provider === "razorpay" && razorpayPaymentLink && !razorpayPaymentLink.includes("your_")) {
      return Response.json({
        success: true,
        provider: "razorpay",
        checkoutUrl: razorpayPaymentLink,
        planTier,
        limits,
        message: "Redirecting to Razorpay payment link...",
      });
    }

    // 4. Safe Development Sandbox Mode (only enabled when keys not yet added in development)
    const isDev = process.env.NODE_ENV !== "production" || process.env.ALLOW_DEV_UPGRADE === "true";
    if (isDev) {
      if (supabase) {
        await supabase.from("profiles").update({ plan_tier: planTier }).eq("id", userId);
        await supabase.from("usage_quotas").upsert(
          {
            user_id: userId,
            daily_chat_limit: limits.daily_chat_limit,
            monthly_image_limit: limits.monthly_image_limit,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      }
      return Response.json({
        success: true,
        planTier,
        provider,
        limits,
        isDevMode: true,
        message: `[Dev Mode] Upgraded to Kikar ${planTier.toUpperCase()} (${limits.daily_chat_limit >= 999999 ? "Unlimited" : limits.daily_chat_limit} chats, ${limits.monthly_image_limit} images). Add Razorpay/Stripe keys in production.`,
      });
    }

    // In production without payment credentials, reject unauthenticated upgrade attempts
    return Response.json({
      error: "Payment gateway is currently being configured. Please contact support or try again shortly.",
    }, { status: 503 });

  } catch (err) {
    console.error("Billing checkout error:", err);
    return Response.json({ error: err?.message || "Checkout failed" }, { status: 500 });
  }
}
