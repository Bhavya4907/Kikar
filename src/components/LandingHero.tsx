"use client"
import React, { Suspense, useState } from "react"
import Link from "next/link"
import ElectricBorder from "./ElectricBorder"

const Spline = React.lazy(() => import("@splinetool/react-spline"))

interface LandingHeroProps {
  onLaunchApp?: () => void
}

export function Navbar({ onLaunchApp }: LandingHeroProps) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-12 py-6 bg-transparent">
      <div className="flex items-center gap-3 cursor-pointer group" onClick={onLaunchApp}>
        <div className="w-8 h-8 rounded-lg bg-[hsl(119,99%,46%)]/15 border border-[hsl(119,99%,46%)]/30 flex items-center justify-center text-sm text-[hsl(119,99%,46%)] group-hover:scale-105 transition-transform">
          ✦
        </div>
        <span className="text-foreground text-lg font-semibold tracking-tight uppercase font-sora">
          KIKAR <span className="text-[hsl(119,99%,46%)] font-bold">AI</span>
        </span>
      </div>
    </header>
  )
}

export function HeroSection({ onLaunchApp }: LandingHeroProps) {
  const [splineError, setSplineError] = useState(false)

  return (
    <section className="relative min-h-screen flex items-center justify-center bg-[hsl(0,0%,8%)] overflow-hidden text-center">
      <div className="absolute inset-0 z-0">
        <Suspense fallback={<div className="absolute inset-0 bg-[hsl(0,0%,8%)]" />}>
          {!splineError ? (
            <Spline
              scene="https://prod.spline.design/Slk6b8kz3LRlKiyk/scene.splinecode"
              className="w-full h-full"
              onError={() => setSplineError(true)}
            />
          ) : (
            <div className="absolute inset-0 bg-radial-gradient from-[hsl(119,99%,46%)]/10 via-[hsl(0,0%,8%)] to-[hsl(0,0%,5%)]" />
          )}
        </Suspense>
      </div>

      <div className="absolute inset-0 bg-radial-gradient from-black/40 via-[hsl(0,0%,8%)]/60 to-[hsl(0,0%,8%)]/90 z-[1] pointer-events-none" />

      <div className="relative z-10 w-full max-w-2xl px-6 md:px-12 py-20 flex flex-col items-center justify-center text-center mx-auto">
        <h1
          className="text-[clamp(3rem,7vw,5.5rem)] font-bold leading-none tracking-[-0.04em] text-white uppercase font-sora opacity-0 animate-fade-up mb-4 text-center"
          style={{ animationDelay: "0.15s" }}
        >
          KIKAR <span className="text-[hsl(119,99%,46%)]">AI</span>
        </h1>

        <p
          className="text-white/90 text-lg md:text-2xl font-light font-sora opacity-0 animate-fade-up mb-3 text-center"
          style={{ animationDelay: "0.3s" }}
        >
          AI Personas &amp; Always-On Digital Twins
        </p>

        <p
          className="text-white/65 text-sm md:text-base font-light leading-relaxed font-sora opacity-0 animate-fade-up mb-8 max-w-lg mx-auto text-center"
          style={{ animationDelay: "0.45s" }}
        >
          Chat with custom AI characters, summon AI co-pilots into human DMs, or let your personal Digital Replica reply while you&apos;re offline.
        </p>

        <div className="opacity-0 animate-fade-up flex justify-center" style={{ animationDelay: "0.6s" }}>
          <ElectricBorder
            color="hsl(119, 99%, 46%)"
            speed={1.4}
            chaos={0.12}
            borderRadius={999}
            style={{ display: "inline-block" }}
          >
            <button
              onClick={onLaunchApp}
              className="bg-[hsl(119,99%,46%)] text-black px-9 py-4 rounded-full font-bold text-sm hover:brightness-110 active:scale-95 transition-all font-sora flex items-center gap-3 cursor-pointer shadow-[0_0_35px_rgba(34,197,94,0.35)]"
            >
              <span>Start Chatting</span>
              <span className="text-base">→</span>
            </button>
          </ElectricBorder>
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
    <div className="relative bg-[hsl(0,0%,8%)] min-h-screen text-foreground font-sora selection:bg-[hsl(119,99%,46%)] selection:text-black">
      <Navbar onLaunchApp={onLaunchApp} />
      <HeroSection onLaunchApp={onLaunchApp} />
      <Footer />
    </div>
  )
}
