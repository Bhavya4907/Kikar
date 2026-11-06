# 🤖 KIKAR

An AI-powered social messaging platform built with **Next.js**, **Supabase**, **GROQ**, and **Capacitor**. Beyond traditional AI chat, the application can generate **personalized AI personas** by analyzing a user's conversation history, enabling realistic interactions that reflect their unique communication style.

Whether users want to chat with custom AI characters, create an AI version of themselves, or connect with other users, ChatBot provides a modern, cross-platform messaging experience.

---

## ✨ Features

### 🤖 AI Personas

* Generate personalized AI personas based on conversation history.
* AI adapts to a user's communication style, tone, and personality.
* Continue conversations with an AI version of a user even when they are offline.
* Create and manage custom AI characters with unique personalities.

### 💬 Messaging

* Real-time chat interface.
* Direct messaging between users.
* AI-powered conversations using Google Gemini.

### 👤 User Management

* Secure authentication using Supabase Auth.
* User profiles.
* Persistent chat history.

### 📱 Mobile Support

* Android support using Capacitor.
* Push notifications.

### ☁️ Backend

* Supabase Database
* Authentication
* Cloud storage
* Scalable architecture

---

## 🛠️ Tech Stack

**Frontend**

* Next.js
* React
* TypeScript
* Tailwind CSS

**Backend**

* Supabase
* GROQ

**Mobile**

* Capacitor
* Android

---

## 🧠 How AI Personas Work

```text
User Conversations
        │
        ▼
Conversation History
        │
        ▼
Personality Analysis
(Tone • Style • Vocabulary • Behaviour)
        │
        ▼
Prompt Generation
        │
        ▼
GROQ
        │
        ▼
Personalized AI Persona
```

The application analyzes previous conversations to identify communication patterns and personality traits. These insights are used to construct prompts that allow the AI to generate responses closely aligned with the user's messaging style.

> **Privacy Notice:** AI persona generation is designed for users who choose to enable this feature. Conversation data is used only to create personalized AI interactions within the application.

---

## 🚀 Future Improvements

* 🎙️ Voice conversations
* 🖼️ AI image generation
* 😊 Emotion-aware responses
* 👥 Group chats
* 🤝 Friend requests
* 📖 Long-term AI memory
* 📞 Voice and video calling
* 🌙 Dynamic mood adaptation based on time and conversation context


## 📂 Project Structure

```
ChatBot/
│
├── app/                 # Next.js App Router
├── src/
│   ├── components/      # UI Components
│   ├── lib/             # Supabase & helper functions
│   └── styles.ts
│
├── android/             # Android project (Capacitor)
├── public/
├── package.json
└── README.md
```

---

## 🚀 Installation

### Clone the repository

```bash
git clone https://github.com/Bhavya4907/ChatBot.git
cd ChatBot
```

### Install dependencies

```bash
npm install
```

### Configure environment variables

Create a `.env.local` file (or copy `.env.example`):

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# AI Providers
GROQ_API_KEY=your_groq_api_key
GEMINI_API_KEY=your_gemini_api_key
```

### Database Setup

Run the SQL script `supabase-schema.sql` in your [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql) to automatically set up tables, RLS policies, real-time channels, and storage bucket.

---

## ▶️ Run the project

Development server

```bash
npm run dev
```

Production build

```bash
npm run build
npm start
```

---

## 📱 Android Build

Sync Capacitor

```bash
npx cap sync
```

Open Android Studio

```bash
npx cap open android
```


## 🎯 Future Improvements

* Voice conversations
* AI memory system
* Image generation
* Group chats
* Friend requests
* Typing indicators
* Read receipts
* Better character customization
* Theme support (Dark/Light Mode)

---

## 🤝 Contributing

Contributions are welcome!

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to your branch
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---


