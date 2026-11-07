# ⚡ Kikar AI

<p align="center">
  <strong>Next-Generation Social Matchmaking, Digital Twin Replicas & AI Companions</strong>
</p>

<p align="center">
  <a href="https://kikar-git-main-bhavya4907s-projects.vercel.app/"><img src="https://img.shields.io/badge/Live%20Demo-kikar.vercel.app-16a34a?style=for-the-badge&logo=vercel" alt="Live Demo"></a>
  <a href="https://github.com/Bhavya4907/Kikar/releases"><img src="https://img.shields.io/badge/Android%20APK-Download%20v0.1.0-38bdf8?style=for-the-badge&logo=android" alt="Download APK"></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16%20Turbopack-black?style=for-the-badge&logo=next.js" alt="Next.js 16"></a>
  <a href="https://deepmind.google/technologies/gemini/"><img src="https://img.shields.io/badge/Google-Gemini%202.5%20Flash-4285F4?style=for-the-badge&logo=google" alt="Google Gemini"></a>
  <a href="https://supabase.com"><img src="https://img.shields.io/badge/Supabase-Realtime%20Presence-3ECF8E?style=for-the-badge&logo=supabase" alt="Supabase"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge" alt="License: Proprietary"></a>
</p>

<p align="center">
  ⭐ <strong>If you find Kikar exciting, please leave a star on GitHub — it motivates further development!</strong> ⭐
</p>

---

## 📖 Overview

**Kikar AI** merges human social networking with autonomous AI companions:
1. ⚡ **Radar Mode ("Omegle + AI Wingman")**: Instant stranger matching with zero database bloat, paired with an AI wingman that drops witty icebreakers when chats get awkward.
2. 👥 **Zangi-Style Fellows Discovery**: Instant debounced user search, live online presence tracking (`● X Online`), and instant 1-click encrypted messaging.
3. 🪞 **Offline Digital Replicas**: When you or your friends go offline, your Digital Twin can auto-respond matching your tone, slang, vocabulary, and message length.
4. ✦ **Multiplayer `@ai` Co-Pilot in DMs**: Summon Kikar directly inside human-to-human DMs to settle debates, brainstorm, or answer questions collaboratively.
5. 📱 **Mobile & Android APK First**: Full-screen frosted-glass bottom navigation, safe-area inset handling for punch-hole cameras/notches, and OLED dark styling.
6. 💳 **Commercial Billing Ready**: Dual-currency checkout with **₹ INR (UPI)** via Razorpay and **$ USD** via Stripe.

---

## ✨ Core Features

### ⚡ 1. Radar Mode (The "Omegle + AI Wingman" Experience)
* **Zero-DB Matchmaking**: Ephemeral stranger rooms are powered entirely by **Supabase Presence & Broadcast channels** (`kikar-radar-lobby` and `radar-room-${id}`). No junk messages cluttering PostgreSQL.
* **Vibe Filtering**: Match strangers by mood: *Casual & Chill*, *Gaming & Geek*, *Deep Thoughts*, or *Fun Debates*.
* **🎲 AI Wingman Icebreaker Host**: Tap the 🎲 button anytime to have Gemini drop high-energy conversation starters and debate prompts.
* **➔ Instant Next Stranger Skip**: Move to the next person with one tap.
* **🤝 "Add Friend" Conversion Bridge**: Transition a great stranger chat into a permanent DM thread with one click.
* **🪞 Digital Twin Fallback**: If waiting longer than 7s without another human, spar with an AI persona or offline replica.

### 👥 2. Fellows Directory & Zangi-Style Discovery
* **Live Online Counter**: See real-time active users (`● Online Now`).
* **Debounced Instant Search**: Search any registered user instantly by `@username` or display name as you type.
* **Status Badges & Notes**: Custom replica status notes to see what people are up to.

### 🪞 3. Digital Twin Replicas & Offline Auto-Responder
* **Writing Style Analysis**: Analyzes real user message history to generate a bespoke system prompt reflecting tone, vocabulary, and typical reply length.
* **Autonomous Offline Replies**: When friends message you while you're offline (`is_online = false`), your Digital Replica auto-responds in your voice.
* **Morning Catch-Up Digest**: Receive a concise AI summary of conversations that took place with your replica while you were away.

### ✦ 4. Multiplayer `@ai` DM Co-Pilot
* Type `@ai <prompt>` or `@kikar <prompt>` inside any human DM thread to summon the Kikar Co-Pilot.
* Both participants see the response in real-time, allowing collaborative ideation, live trivia, or dispute resolution.

### 🎛️ 5. No-Code "Vibe & Boundaries" Sliders
* **Warmth vs. Wit Slider**: Shift personality between warm/empathetic support and witty/sarcastic banter.
* **Reply Length Slider**: Tune output from punchy 1-liners to detailed long-form paragraphs.
* **Language Vibe**: Toggle between Clean English, Hinglish (Hindi + English blend), or Multi-lingual Auto-Adapt.
* **Safety Boundaries**: Preset guardrails (*"Never agree to lend money"*, *"Never share personal phone numbers"*, *"Defer binding commitments until the human is online"*).

### 📱 6. Mobile & Android APK Optimizations
* **Frosted-Glass Bottom Nav**: Clean Telegram/Discord-style tab bar with live indicators that auto-hides during active chat.
* **Hardware Safe-Area Insets**: Proper padding for camera cutouts, notches, and Android system gesture pills.
* **Touch Ergonomics**: Zero 300ms tap delay, anti-zoom inputs (`font-size: 16px`), and no rubber-banding.
* **Pre-built APK**: Ready-to-install Android APK [`Kikar.apk`](./Kikar.apk) built with Capacitor 8.

### 💳 7. Commercialization & Subscription Engine
* **Free Explorer (₹0)**: 30 daily AI chats, 3 trial AI image generations, full 1-on-1 human DMs.
* **Kikar Plus (₹249 / $5.99 mo)**: Always-on Offline Digital Replica, 500 daily chats on Gemini 2.5 Flash, ChatSorter memory, 50 monthly AI image generations.
* **Kikar Pro & Creator (₹699 / $14.99 mo)**: Unlimited priority messages, 250 image generations, multiplayer `@ai` DM Co-pilot, Verified Creator badge.
* **Dual Currency**: Switch between **₹ INR (UPI / Cards via Razorpay)** and **$ USD (via Stripe)**.

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
               │  Supabase Auth   │     │  Realtime DMs &  │     │  Storage Bucket  │
               │  & Postgres DB   │     │  Radar Presence  │     │  (chat-images)   │
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
| **Mobile Runtime** | Capacitor 8, Android SDK (Java 21 LTS) |
| **Styling** | Tailwind CSS v4, Custom Sora Typography, OLED Dark Mode |
| **AI LLM Engine** | Google Gemini (`@google/genai`) — Gemini 2.5 Flash & 2.5 Flash-Lite |
| **AI Memory Layer** | [ChatSorter](https://chatsorter.com) API (Semantic Vector Recall) |
| **Realtime & Database**| Supabase (PostgreSQL 15+, Row Level Security, Presence Channels) |
| **Payments** | Razorpay (UPI, NetBanking, Cards) & Stripe (USD Sessions) |

---

## 🚀 Quick Start & Local Setup

### 1. Clone the repository
```bash
git clone https://github.com/Bhavya4907/Kikar.git
cd Kikar
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env.local` file in the root directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

GEMINI_API_KEY=your_google_gemini_api_key
GROQ_API_KEY=your_groq_api_key_optional

CHATSORTER_API_KEY=your_chatsorter_key_optional

# Payments (Optional for local testing)
RAZORPAY_KEY_ID=your_razorpay_key
RAZORPAY_KEY_SECRET=your_razorpay_secret
STRIPE_SECRET_KEY=your_stripe_secret
```

### 4. Run database migrations
Execute the SQL schema in your Supabase SQL editor:
```sql
-- See supabase-schema.sql for tables, RLS policies, and triggers
```

### 5. Start the development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the app.

---

## 📱 Building the Android APK

```bash
# 1. Build the production Next.js static bundle
npm run build

# 2. Sync web assets to the Android native project
npx cap sync android

# 3. Compile the debug APK
cd android
./gradlew assembleDebug
```
The output APK will be generated at `android/app/build/outputs/apk/debug/app-debug.apk`.

---

## 🏛️ Community & Governance

- **[Contributing Guidelines](./CONTRIBUTING.md)**: Details our commercial contribution policies.
- **[Security Policy](./SECURITY.md)**: Responsible vulnerability disclosure channel.
- **[Code of Conduct](./CODE_OF_CONDUCT.md)**: Contributor Covenant v2.1 community standards.
- **[Pull Request Template](./.github/pull_request_template.md)**: Verification checklist & IP assignment terms.

---

## 📜 License

Copyright © 2026 Bhavya Sharma / Kikar AI. All rights reserved.  
This project is licensed under a **Proprietary / All Rights Reserved License**. See [LICENSE](./LICENSE) for full details.
