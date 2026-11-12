"use client"
import React from "react"
import Link from "next/link"
import { Icon } from "./Icons"

interface LandingHeroProps {
  onLaunchApp?: () => void
}

export function Navbar({ onLaunchApp }: LandingHeroProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-5">
      <div className="flex items-center gap-3 cursor-pointer group" onClick={onLaunchApp}>
        <div className="w-8 h-8 rounded-lg bg-[hsl(226,72%,70%)]/15 border border-[hsl(226,72%,70%)]/30 flex items-center justify-center text-sm text-[hsl(226,72%,70%)] group-hover:scale-105 transition-transform">
          <Icon name="spark" />
        </div>
        <span className="text-foreground text-lg font-semibold tracking-tight uppercase font-sora">
          KIKAR <span className="text-[hsl(226,72%,70%)] font-bold">AI</span>
        </span>
      </div>
    </header>
  )
}

const FEATURES = ["AI Servers", "Radar Matchmaking", "Digital Twins", "@ai Co-Pilot"]

export function HeroSection({ onLaunchApp }: LandingHeroProps) {
  return (
    <section className="relative min-h-screen flex items-center justify-center bg-[#0f1115] overflow-hidden text-center">
      {/* Static layered gradients: zero JS, zero WebGL. Drift uses transform only. */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="kikar-orb kikar-orb-green" />
        <div className="kikar-orb kikar-orb-purple" />
        <div className="kikar-grid" />
      </div>
      <div className="absolute inset-0 z-[1] pointer-events-none bg-gradient-to-b from-transparent via-transparent to-[#0f1115]" />

      <div className="relative z-10 w-full max-w-2xl px-6 md:px-12 py-20 flex flex-col items-center justify-center text-center mx-auto">
        <h1
          className="text-[clamp(3rem,7vw,5.5rem)] font-bold leading-none tracking-[-0.04em] text-white uppercase font-sora opacity-0 animate-fade-up mb-4"
          style={{ animationDelay: "0.1s" }}
        >
          KIKAR <span className="text-[hsl(226,72%,70%)]">AI</span>
        </h1>

        <p
          className="text-white/90 text-lg md:text-2xl font-light font-sora opacity-0 animate-fade-up mb-3"
          style={{ animationDelay: "0.2s" }}
        >
          AI Servers, Strangers Radar &amp; Digital Twins
        </p>

        <p
          className="text-white/65 text-sm md:text-base font-light leading-relaxed font-sora opacity-0 animate-fade-up mb-6 max-w-lg mx-auto"
          style={{ animationDelay: "0.3s" }}
        >
          Hang out in AI-native Discord servers, match with live strangers on Kikar Radar with an AI Wingman, or let your Digital Replica reply while you&apos;re offline.
        </p>

        <div
          className="opacity-0 animate-fade-up flex flex-wrap justify-center gap-2 mb-9"
          style={{ animationDelay: "0.4s" }}
        >
          {FEATURES.map(f => (
            <span
              key={f}
              className="text-[11px] font-medium text-white/70 bg-white/5 border border-white/10 px-3 py-1 rounded-full font-sora"
            >
              {f}
            </span>
          ))}
        </div>

        <div className="opacity-0 animate-fade-up flex justify-center" style={{ animationDelay: "0.5s" }}>
          <button
            onClick={onLaunchApp}
            className="kikar-cta bg-[hsl(226,72%,70%)] text-black px-9 py-4 rounded-full font-bold text-sm font-sora flex items-center gap-3 cursor-pointer"
          >
            <span>Start Chatting</span>
            <span className="text-base">→</span>
          </button>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-center gap-6 py-6">
      <Link
        href="/privacy"
        className="text-white/40 hover:text-white/80 text-xs font-medium uppercase tracking-widest transition-colors"
      >
        Privacy Policy
      </Link>
      <span className="text-white/20">·</span>
      <Link
        href="/terms"
        className="text-white/40 hover:text-white/80 text-xs font-medium uppercase tracking-widest transition-colors"
      >
        Terms of Service
      </Link>
    </footer>
  )
}

export default function LandingHero({ onLaunchApp }: LandingHeroProps) {
  return (
    <div className="relative bg-[#0f1115] min-h-screen text-foreground font-sora selection:bg-[hsl(226,72%,70%)] selection:text-black">
      <Navbar onLaunchApp={onLaunchApp} />
      <HeroSection onLaunchApp={onLaunchApp} />
      <Footer />
    </div>
  )
}
