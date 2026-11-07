# ⚡ KIKAR AI

<p align="center">
  <strong>Next-Generation AI Social Messaging, Digital Twin Replicas & Custom Persona Platform</strong>
</p>

<p align="center">
  <a href="https://github.com/Bhavya4907/Kikar/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Proprietary-red.svg" alt="License: Proprietary"></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16%20(Turbopack)-black.svg" alt="Next.js 16"></a>
  <a href="https://deepmind.google/technologies/gemini/"><img src="https://img.shields.io/badge/Google-Gemini%20AI-blue.svg" alt="Google Gemini"></a>
  <a href="https://chatsorter.com"><img src="https://img.shields.io/badge/ChatSorter-AI%20Memory-purple.svg" alt="ChatSorter Memory"></a>
  <a href="https://supabase.com"><img src="https://img.shields.io/badge/Supabase-Realtime%20%26%20Auth-emerald.svg" alt="Supabase"></a>
  <a href="https://capacitorjs.com"><img src="https://img.shields.io/badge/Capacitor-Android%20Mobile-blueviolet.svg" alt="Capacitor Android"></a>
</p>

---

## 📖 Overview

**Kikar** is an AI-powered social messaging platform built with **Next.js 16 (Turbopack)**, **Google Gemini (`@google/genai`)**, **ChatSorter AI Memory Layer**, **Supabase Realtime**, and **Capacitor Android**.

Beyond conventional chatbots, Kikar merges human social connection with autonomous AI twins:
1. **Chat with AI Personas**: Create and explore bots with creative "Vibe & Boundary" sliders.
2. **Offline Digital Twin Replicas**: When you or your friends go offline, your Digital Twin can auto-respond in your natural slang, style, and vocabulary.
3. **Multiplayer `@ai` Co-Pilot in DMs**: Summon Kikar directly inside human-to-human direct messages to settle debates, brainstorm, or answer questions collaboratively.
4. **Persistent Long-Term Memory**: Powered by ChatSorter to maintain continuity and recall key facts across conversations.
5. **Commercial Subscription Engine**: Tiered access (Free Explorer, Kikar Plus, and Kikar Pro) with dual-currency INR (UPI) and USD checkout via Razorpay and Stripe.

---

## ✨ Features

### 🪞 Digital Twin Replicas & Offline Auto-Responder
* **Autonomous Offline Replies**: When friends message you while you're offline (`is_online = false`), your Digital Replica auto-responds matching your tone.
* **Morning Catch-Up Digest**: Receive a concise AI summary of conversations that took place with your replica while you were away.
* **Replica Controls & Privacy**: Enable/disable replica auto-replies, set custom status notes, or permanently purge replica memory and logs with one click.

### ✦ Multiplayer `@ai` DM Co-Pilot
* Type `@ai <prompt>` or `@kikar <prompt>` inside any human DM thread to summon the Kikar Co-Pilot.
* Both participants see the response in real-time, allowing collaborative ideation, live trivia, or dispute resolution.

### 🧠 Persistent Long-Term Memory (ChatSorter Layer)
* Deep integration with **[ChatSorter](https://chatsorter.com)**.
* Automatically recalls facts, personal preferences, and profile traits based on semantic search before prompting the LLM.
* **Tenant Isolation**: Uses `buildScopedChatId(userId, chatId)` so user memories never leak into another user's prompt context when interacting with public bots.

### 🎛️ No-Code "Vibe & Boundaries" Sliders
* **Warmth vs. Wit Slider**: Shift personality between warm/empathetic support and witty/sarcastic banter.
* **Reply Length Slider**: Tune output from punchy 1-liners to detailed long-form paragraphs.
* **Language Vibe**: Toggle between Clean English, Hinglish (Hindi + English blend), or Multi-lingual Auto-Adapt.
* **Safety Boundaries**: Preset guardrails (*"Never agree to lend money"*, *"Never share personal phone numbers"*, *"Defer binding commitments until the human is online"*).

### ⚡ Commercialization & Subscription Tiers
* **Pricing Modal (`PricingModal.tsx`)**:
  * **Free Explorer (₹0)**: 30 daily AI chats, 3 trial AI image generations, full 1-on-1 human DMs.
  * **Kikar Plus (₹249 / $5.99 mo)**: Always-on Offline Digital Replica, 500 daily chats on Gemini 3.5 Flash, ChatSorter memory, 50 monthly AI image generations.
  * **Kikar Pro & Creator (₹699 / $14.99 mo)**: Unlimited priority messages, 250 image generations, multiplayer `@ai` DM Co-pilot, Verified Creator badge.
* **Dual Currency**: Switch between **₹ INR (UPI / Cards via Razorpay)** and **$ USD (via Stripe)**.
* **Cryptographically Verified Webhooks**: Server-side HMAC-SHA256 verification for Razorpay and Stripe with instant database quota synchronization.

### 💬 Triple-Redundant Live DM Sync
* **Supabase Broadcast**: WebSocket peer-to-peer delivery ensures instant zero-latency message display.
* **Postgres Changes**: Real-time change replication backed by `replica identity full`.
* **2.5s Polling Fallback & Deduplication**: High reliability across spotty mobile networks without duplicate bubbles.

### 🎨 Multimodal & Voice Features
* **AI Image Generation**: Built-in image synthesis endpoint powered by Gemini.
* **AI Voice Note Playback**: Native text-to-speech engine (`SpeechSynthesis`) with play/pause controls.
* **Image Uploads in DMs**: Share photos directly in chat backed by Supabase Storage.

---

## 🛠️ Architecture & Tech Stack

```
                              ┌────────────────────────────────────────┐
                              │          KIKAR Client Interface         │
                              │  (Next.js 16 Turbopack / Capacitor APK)│
                              └───────────────────┬────────────────────┘
                                                  │
                         ┌────────────────────────┼────────────────────────┐
                         ▼                        ▼                        ▼
               ┌──────────────────┐     ┌──────────────────┐     ┌──────────────────┐
               │  Supabase Auth   │     │  Realtime DMs    │     │  Storage Bucket  │
               │  & Postgres DB   │     │ (Broadcast + RLS)│     │  (chat-images)   │
               └──────────────────┘     └──────────────────┘     └──────────────────┘
                         ▲
                         │ (User Quotas & Plan Tiers)
                         ▼
        ┌────────────────────────────────────────────────────────────────────────┐
        │                          KIKAR API Layer                               │
        │                                                                        │
        │  /api/chat                     /api/billing/checkout & /webhook        │
        │  ├── Sliding-Window Rate Limit ├── Razorpay Order API & HMAC Check     │
        │  ├── Tenant Chat ID Scoping    └── Stripe Checkout & Webhook Listener  │
        │  └── Conversation Normalizer                                           │
        └──────────────┬─────────────────────────────────────────────────────────┘
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
    ┌─────────────────┐ ┌─────────────────────────────────────────────────────────┐
    │   ChatSorter    │ │                 AI Candidate Cascades                   │
    │  Memory Recall  │ │ 1. Google Gemini (2.5-flash / 2.0-flash / 2.5-lite)     │
    │  & Async Index  │ │ 2. Groq Fallback (openai/gpt-oss-120b / llama-3.3-70b) │
    └─────────────────┘ └─────────────────────────────────────────────────────────┘
```

| Layer | Technology |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router + Turbopack), React 19, TypeScript |
| **Styling** | Tailwind CSS, Custom Sora Typography, Responsive Mobile Grid |
| **Primary AI Engine** | Google Gemini (`@google/genai`) — Flash 2.5, 2.0, 1.5 & Flash-Lite |
| **AI Memory Layer** | [ChatSorter](https://chatsorter.com) API (Semantic Vector Recall & Scoring) |
| **Fallback AI Engine** | Groq Cloud API (`openai/gpt-oss-120b`, `llama-3.3-70b-versatile`) |
| **Database & Auth** | Supabase (PostgreSQL 15+, RLS Policies, Realtime Broadcast) |
| **Payments** | Razorpay (UPI, NetBanking, Cards) & Stripe (Payment Links & Sessions) |
| **Mobile Runtime** | Capacitor 7, Android SDK (Java 21 LTS) |

---

## 📁 Project Structure

```text
Kikar/
├── android/                   # Capacitor Android native project & Gradle build
├── app/
│   ├── api/
│   │   ├── billing/
│   │   │   ├── checkout/      # Stripe session & Razorpay order creation
│   │   │   └── webhook/       # HMAC signature verified webhook listener
│   │   ├── chat/              # Gemini chat cascade, memory injection & rate limiting
│   │   └── generate-image/    # Multimodal AI image generation
│   ├── privacy/               # Privacy policy & data deletion procedures
│   ├── terms/                 # Terms of service, safety rules & subscription terms
│   ├── globals.css            # Dark charcoal cyberpunk theme & mobile layout fixes
│   ├── layout.tsx             # Root layout & mobile viewport-fit configuration
│   └── page.tsx               # Primary app shell (Persona mode vs. People mode)
├── src/
│   ├── components/
│   │   ├── AIGridView.tsx     # Responsive persona discovery & story strip
│   │   ├── CharacterForm.tsx  # Character creation with Vibe & Boundary sliders
│   │   ├── ChatWindow.tsx     # AI chat window with memory tags, voice & image tools
│   │   ├── DMWIndow.tsx       # Live DM thread, @ai Co-Pilot & Offline Replica auto-reply
│   │   ├── ModeSelection.tsx  # Initial mode switcher (Persona vs. Person)
│   │   ├── PricingModal.tsx   # Dual-currency (INR/USD) subscription modal
│   │   ├── ProfileForm.tsx    # User profile, replica toggle & data purge controls
│   │   └── Sidebar.tsx        # Conversation lists, search & mode navigation
│   ├── lib/
│   │   ├── chatsorter.js      # ChatSorter memory recall & background indexing
│   │   ├── helpers.ts         # Speech synthesis, notifications & timestamp helpers
│   │   ├── supabase.ts        # Client-side Supabase client
│   │   └── types.ts           # PlanTier, UsageQuota, Character, Message types
│   └── styles.ts              # Design tokens and style constants
├── supabase-schema.sql        # Full database schema, RLS, quotas & realtime replication
├── capacitor.config.ts        # Capacitor mobile configuration
└── package.json
```

---

## 🚀 Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/Bhavya4907/Kikar.git
cd Kikar
npm install
```

### 2. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# ── Supabase ────────────────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# ── Primary AI Engine (Google Gemini) ──────────────────────────────
GEMINI_API_KEY=your_google_gemini_api_key

# ── ChatSorter AI Memory Layer ──────────────────────────────────────
CHATSORTER_API_KEY=cs_demo_your_key_here

# ── AI Fallback (Groq) ─────────────────────────────────────────────
GROQ_API_KEY=gsk_your_groq_api_key

# ── Payments: Razorpay (India / UPI) ────────────────────────────────
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_live_your_key_id
RAZORPAY_KEY_ID=rzp_live_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret

# ── Payments: Stripe (Global / USD) ─────────────────────────────────
NEXT_PUBLIC_STRIPE_PLUS_LINK=https://buy.stripe.com/your_plus_link
NEXT_PUBLIC_STRIPE_PRO_LINK=https://buy.stripe.com/your_pro_link
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
```

### 3. Initialize the Database

Open the [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql) and run the complete script from:
```
supabase-schema.sql
```
This automatically sets up:
* `profiles`, `characters`, `messages`, `conversations`, `direct_messages`
* `subscriptions`, `usage_quotas`, and `character_reports` tables
* Row Level Security (RLS) policies for tenant isolation
* `replica identity full` and Realtime publications
* `handle_new_user()` trigger for automated Free Explorer quota provisioning
* `chat-images` public storage bucket

### 4. Run the Development Server

```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📱 Building the Android APK

Kikar uses **Capacitor 7** with **Microsoft OpenJDK 21 LTS**.

1. **Verify `capacitor.config.ts`**:
   Ensure the `server.url` points to your active deployment URL:
   ```typescript
   const config: CapacitorConfig = {
     appId: 'com.Paneer.Kikar',
     appName: 'Kikar',
     webDir: 'out',
     server: {
       url: 'https://kikar-git-main-bhavya4907s-projects.vercel.app',
       cleartext: true
     }
   };
   ```

2. **Sync Web Assets & Plugins**:
   ```bash
   npx cap sync android
   ```

3. **Build the APK using Gradle**:
   ```powershell
   $env:JAVA_HOME = "C:\Users\Bhavya Sharma\.jdk\jdk-21.0.6+7"
   cd android
   .\gradlew assembleDebug
   ```
   The compiled APK will be located at:
   `android/app/build/outputs/apk/debug/app-debug.apk`

---

## 🔐 Security & Safety Compliance

* **Server-Side Quota Enforcement**: Chat routing and billing updates are verified against database records to prevent client-side plan spoofing.
* **Webhook Signatures**: Payment updates require valid HMAC-SHA256 signatures (`x-razorpay-signature` and `stripe-signature`).
* **Tenant Memory Isolation**: All ChatSorter memory queries are scoped to the individual user's ID to prevent cross-account information leakage.
* **Google Play UGC Compliance**: Built-in character reporting system (`🚩 Report Character`), content guardrails, and one-click data deletion in compliance with Google Play Developer policies.

---

## 📄 License

Copyright © 2026 Bhavya Sharma / Kikar AI. All rights reserved. Proprietary software. Unauthorized copying, distribution, or commercial exploitation is strictly prohibited. See [LICENSE](LICENSE) for details.
