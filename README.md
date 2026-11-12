# ⚡ Kikar — The AI-Powered Discord Equivalent

<p align="center">
  <strong>Next-Gen Social Workspace: Discord-Style Community Servers, Multiplayer AI Co-Pilots, Universal Custom Bot Summoning, Offline Digital Twins & Instant Radar Matchmaking</strong>
</p>

<p align="center">
  <a href="https://kikar-git-main-bhavya4907s-projects.vercel.app/"><img src="https://img.shields.io/badge/Live%20Demo-kikar.vercel.app-5865F2?style=for-the-badge&logo=vercel" alt="Live Demo"></a>
  <a href="https://github.com/Bhavya4907/Kikar/releases"><img src="https://img.shields.io/badge/Android%20APK-Download%20v0.1.0-5f73e6?style=for-the-badge&logo=android" alt="Download APK"></a>
  <a href="https://nextjs.org"><img src="https://img.shields.io/badge/Next.js-16%20Turbopack-black?style=for-the-badge&logo=next.js" alt="Next.js 16"></a>
  <a href="https://deepmind.google/technologies/gemini/"><img src="https://img.shields.io/badge/Google-Gemini%202.5%20Flash-4285F4?style=for-the-badge&logo=google" alt="Google Gemini"></a>
  <a href="https://supabase.com"><img src="https://img.shields.io/badge/Supabase-Realtime%20Presence-3ECF8E?style=for-the-badge&logo=supabase" alt="Supabase"></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/License-Proprietary-red?style=for-the-badge" alt="License: Proprietary"></a>
</p>

<p align="center">
  ⭐ <strong>If you find Kikar exciting, please leave a star on GitHub — it motivates active development!</strong> ⭐
</p>

---

## 📖 Overview

**Kikar** reimagines Discord for the AI era. It blends high-performance community chat (servers, channels, roles, and member sidebars) with autonomous AI companions, real-time multiplayer co-pilots, universal bot summoning, and zero-latency social matchmaking.

1. 🎮 **Discord-Style Community Servers**: Server Rail, categorized channels (`#general`, `#lounge`, `#memes`, `#bot-commands`, `🔊 Voice Lounge`), role-based member lists (`Owner`, `Admin`, `Member`), and custom server creation.
2. 🤖 **Multiplayer `@ai` Co-Pilot & Universal Bot Summoning**: Summon Kikar or **any custom bot created by any user** into any Server Channel or 1-on-1 DM using `@<bot_name>` or the built-in **🤖 Summon Bot** picker.
3. 🪞 **Continuous Digital Twin Replicas**: Train an AI clone of yourself or your friends based on real message history. Your replica replies in your authentic tone, vocabulary, and humor, and holds live back-and-forth conversations when you are offline.
4. 🗑️ **1-Click Real-Time Chat Clearing**: Instantly clear chat history in direct messages or server channels with broadcast synchronization across all connected participants.
5. 🎭 **No-Code AI Persona Builder**: Create and customize AI personas with dynamic "Vibe & Boundary" sliders (Warmth vs. Wit, Hinglish/English blend, reply length, and safety guardrails).
6. 🎙️ **WebRTC P2P Voice Lounges**: Low-latency voice channels with RMS-based speaking detection, automatic backoff reconnection, TURN support, and native Android microphone permissions.
7. ⚡ **Ephemeral Radar Matchmaker**: Match with strangers or AI bots in real time using Supabase Broadcast channels—zero database bloat, paired with an AI wingman icebreaker host.
8. 📱 **Mobile & Native Android First**: Responsive mobile navigation drawer, safe-area inset handling for punch-hole cameras/notches, and pre-built Capacitor 8 APK.
9. 💳 **Commercial Subscription Engine**: Dual-currency checkout with **₹ INR (UPI / NetBanking via Razorpay)** and **$ USD (Cards via Stripe)** with atomic server-side quota enforcement.

---

## 🎨 Design System & Performance

### Design System
* **Palette**: Cool near-black greys (`#0f1115` base, `#161a20` / `#1e232b` surfaces), off-white text (`#e6e8ec`), and one desaturated indigo accent (`hsl(226, 72%, 70%)`). Pure black and pure white are avoided to eliminate eye strain and halation.
* **Tokens**: Defined once in `app/globals.css` (CSS variables) and `src/styles.ts` (the `T` object). Change the accent in both places to re-theme the entire app.
* **Typography**: Inter typography loaded cleanly via Google Fonts in `app/layout.tsx`.
* **Icons**: Inline SVG icon system in `src/components/Icons.tsx` (`<Icon name="trash" />`, `<Icon name="bot" />`). Icons inherit `currentColor` and scale dynamically.

### Performance
* **Zero Heavy 3D Canvases**: The heavy 3D scenes were replaced by GPU-composited CSS glows and animations (`transform` and `opacity` only).
* **DOM Message Optimization**: Long conversation bubbles use `content-visibility: auto`, so off-screen messages avoid redundant rendering passes.
* **Quiet Polling**: Background tab polling is automatically paused when the document is hidden (`document.hidden`).

---

## ✨ Feature Deep Dive

### 🎮 1. Discord UI Architecture
* **Server Rail (72px)**: Discord-style circular navigation rail with Home shortcut, active channel indicators, server icon badges, public server explorer, and an interactive **+ Create Server** modal.
* **Channel & DM Sidebar (240px)**:
  * **Home Views**: 👥 Fellows Directory, ⚡ Radar Matchmaker, and 🤖 AI Persona Gallery (with 1-click **+** quick creator).
  * **Server Channels**: Organize spaces with collapsible categories (`💬 Text Channels`, `🔊 Voice Lounges`, `🤖 AI Arenas`).
  * **Direct Messages**: Real-time DM list with online presence indicators (`●`), unread counters, and instant user search.
* **Main Center Stage**:
  * Rich Markdown rendering, emoji reactions, image uploads, and live typing indicators.
  * **🎲 AI Icebreaker**: One-click prompt generator that sparks conversations when channels go quiet.
  * **🎨 `/imagine` Image Generation**: In-chat AI image synthesis powered by Gemini.
* **Server Member List (240px)**: Slide-out or dedicated member panel categorized by roles (`Online`, `Bots & Replicas`, `Offline`).

---

### 🤖 2. Multiplayer `@ai` Co-Pilot & Universal Bot Calling
* **Summon Kikar AI Co-Pilot**: Type `@ai <prompt>` or `@kikar <prompt>` inside any server channel or DM.
* **Call Any Custom Bot in Any Conversation**:
  * Tap the **🤖 Call Bot** button in the header or message bar of any DM or channel to open the **Summon Bot Modal**.
  * Search and call any persona created by any user across the platform with 1 click.
  * Tag any bot directly with `@<bot_name>` (e.g. `@wizard`, `@study_coach`, `@sherlock`) to have them immediately jump into the discussion.
* **Multi-Turn Replica & Bot Dialogues**: Prompt `@ai talk to <friend>'s replica` to orchestrate multi-agent banter between your digital twins and the AI co-pilot right in front of your friends.

---

### 🪞 3. Continuous Digital Twin Replicas & Offline Auto-Responder
* **Writing Style Distillation**: Analyzes conversational history to distill distinctive tone, favorite slang, and message brevity.
* **Continuous Back-and-Forth Dialogue**: When chatting with a friend's replica, the conversational state stays active so the replica answers your ongoing follow-up questions naturally without requiring repetitive `@replica` tags.
* **Autonomous Offline Responder**: When you or your friends go offline (`is_online = false`), the replica automatically steps in to reply on your behalf without breaking character.
* **Morning Catch-Up Digest**: Receive an AI-summarized recap of all conversations your digital twin had while you were asleep.

---

### 🗑️ 4. 1-Click Real-Time Chat History Clearing
* Prominent **🗑️ Clear** buttons located in the headers of both **Direct Messages** and **Server Channels**.
* Includes confirmation dialogs to prevent accidental loss.
* Broadcasts `dm-clear` and `clear-channel-msgs` in real-time so all active participants see the cleared state instantly.

---

### 🎙️ 5. WebRTC P2P Voice Lounges
* High-fidelity mesh voice chat directly inside community servers (`🔊 Voice Lounge`).
* **Intelligent Audio Handling**: RMS-based hysteresis speaking detection, audio element DOM binding, and browser autoplay unlock.
* **Resilient Connection Recovery**: Automatic backoff reconnection (up to 5 retries) and unique peer session IDs to eliminate multi-tab collisions.
* **Mobile Ready**: Native Android `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS` permissions configured in `AndroidManifest.xml`.

---

### 🎭 6. No-Code Persona Builder & AI Arena
* **Vibe Tuning Sliders**:
  * **Warmth vs. Wit**: Shift personality between empathetic confidant and razor-sharp sarcasm.
  * **Reply Length**: Configure snappy 1-line quips or comprehensive deep-dive paragraphs.
  * **Language Blend**: Toggle Clean English, Hinglish (Hindi + English colloquial blend), or Multi-lingual adaptation.
* **Guardrail Presets**: Toggle boundaries against sharing personal phone numbers, making financial promises, or binding work commitments.
* **Instant Synchronized Gallery**: Newly created personas immediately appear in the AI Arena, Channel Sidebar, and Member List without page refreshes.

---

### ⚡ 7. Radar Mode ("Omegle + AI Wingman")
* **Zero-DB Ephemeral Rooms**: Matchmaking is negotiated entirely through **Supabase Presence & Broadcast channels** (`kikar-radar-lobby` and `radar-room-${id}`). No temporary chat messages cluttering PostgreSQL.
* **Vibe Filtering**: Filter matches by mood: *Casual & Chill*, *Gaming & Geek*, *Deep Thoughts*, or *Fun Debates*.
* **🎲 AI Wingman**: Drops witty icebreakers when chats stall.
* **🤝 "Add Friend" Bridge**: Convert any great stranger interaction into a permanent Discord DM with 1 click.

---

### 💳 8. Commercial Subscription Tiers & Security
* **Free Explorer (₹0)**: 30 daily AI chats, 3 trial AI image generations, full 1-on-1 human DMs and server participation.
* **Kikar Plus (₹249 / $5.99 mo)**: Always-on Offline Digital Replica, 500 daily chats on Gemini 2.5 Flash, 50 monthly AI image generations.
* **Kikar Pro & Creator (₹699 / $14.99 mo)**: Unlimited priority messages, 250 image generations, multiplayer `@ai` DM Co-pilot, custom server creation, Verified Creator badge.
* **Server-Side Security**: Atomic quota consumption functions (`consume_daily_chat_quota`, `consume_image_quota`), timing-safe HMAC webhook signature checks (Stripe & Razorpay), and rate-limiting.
* **Overridable Model Cascades**: Configurable via `GEMINI_CHAT_MODELS_PAID`, `GEMINI_CHAT_MODELS_FREE`, and `GEMINI_IMAGE_MODELS` in `.env.local`.

---

## 🛠️ System Architecture

```
                               ┌────────────────────────────────────────┐
                               │          KIKAR Client Interface         │
                               │  (Next.js 16 Turbopack / Capacitor APK)│
                               └───────────────────┬────────────────────┘
                                                   │
                         ┌─────────────────────────┼────────────────────────┐
                         ▼                         ▼                        ▼
               ┌──────────────────┐      ┌──────────────────┐     ┌──────────────────┐
               │  Supabase Auth   │      │  Realtime DMs,   │     │  Storage Bucket  │
               │  & Postgres DB   │      │ Channels & Radar │     │  (chat-images)   │
               └──────────────────┘      └──────────────────┘     └──────────────────┘
                         ▲
                         │ (User Quotas & Plan Tiers)
                         ▼
        ┌────────────────────────────────────────────────────────────────────────┐
        │                          KIKAR API Layer                               │
        │                                                                        │
        │  /api/chat                     /api/billing/checkout & /webhook        │
        │  ├── Sliding-Window Rate Limit ├── Razorpay Order API & HMAC Check     │
        │  ├── Tenant Scoping            └── Stripe Checkout & Webhook Listener  │
        │  └── Conversation Normalizer   /api/generate-image                     │
        └──────────────┬─────────────────────────────────────────────────────────┘
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
    ┌─────────────────┐ ┌─────────────────────────────────────────────────────────┐
    │   ChatSorter    │ │                 AI Model Cascades                       │
    │  Memory Recall  │ │ 1. Google Gemini (2.5-flash / 2.0-flash / 2.5-lite)     │
    │  & Async Index  │ │ 2. Groq Fallback (openai/gpt-oss-120b / llama-3.3-70b) │
    └─────────────────┘ └─────────────────────────────────────────────────────────┘
```

| Layer | Technology |
| :--- | :--- |
| **Framework** | Next.js 16 (App Router + Turbopack), React 19, TypeScript |
| **Mobile Runtime** | Capacitor 8, Android SDK (Java 21 LTS) |
| **Styling** | Tailwind CSS v4, Inter typography, near-black dark theme, inline SVG icons |
| **AI LLM Engine** | Google Gemini (`@google/genai`) — Gemini 2.5 Flash & 2.5 Flash-Lite |
| **Voice Signaling & WebRTC** | P2P WebRTC with Supabase Presence & Broadcast signaling + TURN fallback |
| **AI Memory Layer** | [ChatSorter](https://chatsorter.com) Semantic Vector Recall |
| **Realtime & Database**| Supabase (PostgreSQL 15+, Row Level Security, Realtime Broadcast) |
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
RAZORPAY_WEBHOOK_SECRET=your_razorpay_webhook_secret
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret

# Voice lounges (TURN relay)
NEXT_PUBLIC_TURN_URLS=turn:your.turn.host:3478
NEXT_PUBLIC_TURN_USERNAME=your_turn_username
NEXT_PUBLIC_TURN_CREDENTIAL=your_turn_credential
```

### 4. Run database migrations
Execute the SQL scripts in your Supabase SQL editor in order:
1. `supabase-schema.sql` — tables, RLS policies, and triggers
2. `supabase-migration-v5-security.sql` — atomic quota functions, webhook protection, and storage rules

### 5. Start the development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to view the app in your browser.

---

## 📱 Building the Native Android APK

```bash
# 1. Build the production Next.js bundle
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

- **[Contributing Guidelines](./CONTRIBUTING.md)**: Details our contribution standards and branch workflows.
- **[Security Policy](./SECURITY.md)**: Responsible vulnerability disclosure channel.
- **[Code of Conduct](./CODE_OF_CONDUCT.md)**: Contributor Covenant v2.1 community standards.

---

## 📜 License

Copyright © 2026 Bhavya Sharma / Kikar AI. All rights reserved.  
This project is licensed under a **Proprietary / All Rights Reserved License**. See [LICENSE](./LICENSE) for details.
