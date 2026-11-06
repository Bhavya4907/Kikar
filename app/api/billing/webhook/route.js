import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { PLAN_LIMITS } from "../checkout/route.js";

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (!supabaseUrl || !supabaseKey || supabaseUrl.includes("your_supabase_url")) return null;
  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(request) {
  try {
    const rawBody = await request.text();
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return Response.json({ error: "Database not configured" }, { status: 500 });
    }

    // ── Razorpay Webhook Verification ──────────────────────────
    const rzpSignature = request.headers.get("x-razorpay-signature");
    const rzpSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    if (rzpSignature && rzpSecret) {
      const expectedSignature = crypto
        .createHmac("sha256", rzpSecret)
        .update(rawBody)
        .digest("hex");

      if (expectedSignature !== rzpSignature) {
        return Response.json({ error: "Invalid Razorpay signature" }, { status: 400 });
      }

      const event = JSON.parse(rawBody);
      if (event.event === "order.paid" || event.event === "payment.captured") {
        const payload = event.payload.payment?.entity || event.payload.order?.entity;
        const userId = payload?.notes?.user_id;
        const planTier = payload?.notes?.plan_tier || "plus";

        if (userId && PLAN_LIMITS[planTier]) {
          const limits = PLAN_LIMITS[planTier];
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
          console.log(`[Billing Webhook] Upgraded user ${userId} to ${planTier}`);
        }
      }
      return Response.json({ status: "ok" });
    }

    // ── Stripe Webhook (JSON Event) ───────────────────────────
    try {
      const event = JSON.parse(rawBody);
      if (event.type === "checkout.session.completed") {
        const session = event.data?.object;
        const userId = session?.client_reference_id || session?.metadata?.user_id;
        const planTier = session?.metadata?.plan_tier || "plus";

        if (userId && PLAN_LIMITS[planTier]) {
          const limits = PLAN_LIMITS[planTier];
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
          console.log(`[Billing Webhook] Upgraded user ${userId} to ${planTier}`);
        }
      }
      return Response.json({ status: "ok" });
    } catch {
      // not stripe json
    }

    return Response.json({ status: "ignored" });
  } catch (err) {
    console.error("Billing webhook error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
