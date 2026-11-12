# Kikar v5 — fixes since v4 (webrtc-voice)

## Deploy order (important)
1. Run `supabase-migration-v5-security.sql` in the Supabase SQL editor **first**.
2. Set env vars (see `.env.example`): `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_WEBHOOK_SECRET`,
   `RAZORPAY_WEBHOOK_SECRET`, and the `NEXT_PUBLIC_TURN_*` trio.
3. Deploy the web app, then rebuild the APK (`npx cap sync android` → `assembleDebug`) so the
   new microphone permissions ship.

## Voice (`src/lib/webrtcVoice.ts`, `AndroidManifest.xml`, `DiscordView.tsx`)
- **Build error fixed:** `DiscordView` called `new WebRTCVoiceManager(...)` with 6 positional
  arguments, but the class takes one options object (TypeScript error / runtime `undefined`s).
- **Android mic permission:** added `RECORD_AUDIO` + `MODIFY_AUDIO_SETTINGS` (APK always joined
  listen-only before).
- **TURN support** via `NEXT_PUBLIC_TURN_URLS / _USERNAME / _CREDENTIAL` (+ console warning when missing).
- **Failed/disconnected connections now recover** (5 s grace, rebuild with backoff, max 5 tries;
  non-initiator asks the initiator to re-offer). Each attempt has a `connId` so stale
  offers/answers/ICE from an old attempt are ignored.
- **Mute/deafen are truthful for late joiners** (presence is re-tracked on change; the resulting
  "leave" event for the replaced state no longer tears the connection down).
- **Two tabs/devices of one account** no longer collide (per-session peer id; other sessions of
  your own account are ignored, so no echo).
- **Speaking detection** uses RMS + hysteresis instead of a fixed average-frequency threshold.
- Audio unlock on first click/tap, `AudioContext.resume()`, `<audio>` elements attached to the DOM.
- Unmuting without a microphone is refused with a message instead of silently "working".

## Security (`app/api/*`, `src/lib/*`, SQL migration)
- **Stripe webhook** now verifies `Stripe-Signature` (HMAC, 5-min tolerance, timing-safe).
  Razorpay verification is timing-safe and **mandatory**. Unsigned requests get 400.
- Webhook checks payment status / amount before upgrading; plan is inferred from the amount for
  Stripe Payment Links (or from `metadata.plan_tier` if you set it on the link).
- **`/api/chat`, `/api/generate-image`, `/api/billing/checkout` require a Supabase login**
  (`Authorization: Bearer`, added by the new `apiFetch` helper). `userId` / `planTier` from the
  request body are ignored; plan tier is read from the database.
- **Quotas enforced on the server** with atomic SQL functions (daily chat, monthly image, with
  real resets — the old `last_daily_reset` was never applied) and refunds when the AI call fails.
- **Users can no longer change their own plan or quotas** from the browser (trigger + removed
  policies/privileges).
- Input limits (messages, prompt, tokens); no more raw `err.message` in responses; CORS wildcard
  removed (same-origin only unless `ALLOWED_ORIGINS` is set).
- Removed the `ALLOW_DEV_UPGRADE` flag: the free dev upgrade sandbox only runs outside production.
- Storage: uploads only into `<your-user-id>/…`, images only, 5 MB; bucket listing disabled
  (public image URLs still work).
- `PLAN_LIMITS` moved to `src/lib/plans.js` (exporting it from a `route.js` file is not allowed by Next.js).

## Cleanup
- Package renamed `kikar`; `DMWIndow.tsx` → `DMWindow.tsx`; deleted unused `lib/superbase.ts`.
- Removed retired/unreleased model IDs (`gemini-1.5-flash`, `gemini-3-pro-image`); cascades are
  overridable with `GEMINI_CHAT_MODELS_FREE|PAID` and `GEMINI_IMAGE_MODELS`.

## Behavior changes to know about
- The server counts **every** `/api/chat` call against the daily limit — including icebreakers,
  replica replies and `@ai` multi-turn dialogues (one user message can cost up to 3).
  The client's counter is now only an instant local mirror.
- Plans change only via webhook (or dev sandbox). After paying, the UI may show the new plan a few
  seconds before the server does.

## Not done (features / refactors, not bugs)
Server-side offline replica, splitting the 1000+-line components, replacing `any` types,
Radar reports/blocking, tests, friend-consent UI for replicas, private voice channels
(needs a server-membership table first), SFU for rooms larger than ~5 people.

## What was and wasn't verified
- Verified: syntax of all changed JS/TS; strict TypeScript check of the voice manager; webhook
  signature functions (valid / forged / stale / tampered); an 8-scenario simulation of the voice
  manager against a fake signaling server + fake WebRTC (the same scenarios fail on the v4 code).
- NOT verified (no network / database in my sandbox): `next build`, the SQL migration against a
  real Postgres, real WebRTC audio between devices, Stripe/Razorpay live webhooks.
