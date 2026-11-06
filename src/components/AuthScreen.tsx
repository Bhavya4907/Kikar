"use client"
import { useState } from "react"
import { supabase, isSupabaseConfigured } from "../lib/supabase"
import ElectricBorder from "./ElectricBorder"
import GlareHover from "./GlareHover"
import LandingHero from "./LandingHero"

export default function AuthScreen() {
  const [authMode, setAuthMode] = useState<"login" | "signup" | "forgot">("login")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [username, setUsername] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [authError, setAuthError] = useState("")
  const [authSuccess, setAuthSuccess] = useState("")
  const [authLoading, setAuthLoading] = useState(false)
  const [showLanding, setShowLanding] = useState(true)

  async function handleAuth(e?: React.FormEvent) {
    if (e) e.preventDefault()
    setAuthError("")
    setAuthSuccess("")

    if (!isSupabaseConfigured) {
      setAuthError("Supabase credentials are not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local.")
      return
    }

    if (!email.trim()) {
      setAuthError("Please enter your email address.")
      return
    }

    if (authMode === "forgot") {
      setAuthLoading(true)
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: typeof window !== "undefined" ? `${window.location.origin}/` : undefined,
        })
        if (error) {
          setAuthError(error.message)
        } else {
          setAuthSuccess("Password reset email sent! Check your inbox for the link.")
        }
      } catch (err: any) {
        setAuthError(err?.message || "Failed to send reset email. Please verify your Supabase settings.")
      } finally {
        setAuthLoading(false)
      }
      return
    }

    if (!password) {
      setAuthError("Please enter your password.")
      return
    }

    if (authMode === "signup" && password.length < 6) {
      setAuthError("Password must be at least 6 characters long.")
      return
    }

    setAuthLoading(true)
    try {
      if (authMode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        if (error) {
          if (error.message.includes("Failed to fetch")) {
            setAuthError("Unable to connect to Supabase. Please verify your internet connection or NEXT_PUBLIC_SUPABASE_URL.")
          } else {
            setAuthError(error.message)
          }
        }
      } else {
        const cleanUsername = username.trim() || email.trim().split("@")[0]
        const cleanDisplayName = displayName.trim() || cleanUsername

        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              username: cleanUsername,
              display_name: cleanDisplayName,
            },
          },
        })

        if (error) {
          setAuthError(error.message)
        } else if (data?.user && !data?.session) {
          setAuthSuccess("Account created successfully! Please check your email inbox to confirm your account, then sign in.")
          setAuthMode("login")
        } else if (data?.session) {
          // Auto signed in via session
          setAuthSuccess("Account created! Logging in...")
        }
      }
    } catch (err: any) {
      setAuthError(err?.message || "An unexpected error occurred during authentication.")
    } finally {
      setAuthLoading(false)
    }
  }

  if (showLanding) {
    return <LandingHero onLaunchApp={() => setShowLanding(false)} />
  }

  return (
    <div style={{
      minHeight: "100dvh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "radial-gradient(ellipse at 50% 0%, hsla(119,99%,46%,0.1) 0%, #0d0d0d 70%)",
      padding: 20,
      fontFamily: "'Sora', -apple-system, sans-serif",
      position: "relative"
    }}>
      {/* Top Left Navigation Back to Landing Hero */}
      <button
        type="button"
        onClick={() => setShowLanding(true)}
        className="absolute top-6 left-6 z-20 text-white/60 hover:text-white text-xs font-medium uppercase tracking-widest flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-full border border-white/10 transition-colors cursor-pointer"
      >
        <span>← Back</span>
      </button>

      {/* GlareHover & Electric Border Wrapped Auth Card */}
      <GlareHover
        width="100%"
        height="auto"
        background="rgba(20, 20, 20, 0.95)"
        borderRadius="20px"
        borderColor="rgba(255, 255, 255, 0.08)"
        glareColor="#ffffff"
        glareOpacity={0.25}
        glareAngle={-30}
        glareSize={300}
        transitionDuration={800}
        playOnce={false}
        style={{
          maxWidth: 420,
          backdropFilter: "blur(24px)",
          boxShadow: "0 24px 80px rgba(0,0,0,0.8)",
          display: "block",
        }}
      >
        <ElectricBorder
          color="hsl(119, 99%, 46%)"
          speed={1.4}
          chaos={0.14}
          borderRadius={20}
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
          }}
        >
          <form
            onSubmit={handleAuth}
            style={{
              padding: "36px 28px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              position: "relative",
              zIndex: 2,
            }}
          >

            {/* Logo & Heading */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                background: "hsla(119,99%,46%,0.15)",
                border: "1px solid hsla(119,99%,46%,0.35)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 24,
                boxShadow: "0 0 24px hsla(119,99%,46%,0.2)",
              }}>✦</div>
              <div style={{ textAlign: "center" }}>
                <h1 style={{
                  margin: 0,
                  fontSize: 22,
                  fontWeight: 700,
                  color: "#f0f0f0",
                  letterSpacing: "-0.03em",
                }}>
                  KIKAR <span style={{ color: "hsl(119,99%,46%)" }}>AI</span>
                </h1>
                <p style={{
                  margin: "4px 0 0",
                  color: "#888",
                  fontSize: 13,
                  fontWeight: 400,
                }}>
                  {authMode === "login" && "Sign in to your account"}
                  {authMode === "signup" && "Create a new account"}
                  {authMode === "forgot" && "Reset your account password"}
                </p>
              </div>
            </div>

            {/* Supabase Not Configured Warning Banner */}
            {!isSupabaseConfigured && (
              <div style={{
                padding: "10px 12px",
                background: "rgba(234, 179, 8, 0.12)",
                border: "1px solid rgba(234, 179, 8, 0.35)",
                borderRadius: 10,
                color: "#facc15",
                fontSize: 12,
                lineHeight: 1.4,
              }}>
                <strong>Setup required:</strong> Supabase environment variables are missing. Configure <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in <code>.env.local</code>.
              </div>
            )}

            {/* Mode Switch Tabs (Login / Signup) */}
            {authMode !== "forgot" ? (
              <div style={{
                display: "flex",
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "#0d0d0d",
              }}>
                {(["login", "signup"] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setAuthMode(m); setAuthError(""); setAuthSuccess("") }}
                    style={{
                      flex: 1,
                      padding: "10px 0",
                      background: authMode === m ? "hsla(119,99%,46%,0.12)" : "transparent",
                      border: authMode === m ? "1px solid hsla(119,99%,46%,0.3)" : "none",
                      color: authMode === m ? "hsl(119,99%,46%)" : "#888",
                      cursor: "pointer",
                      fontSize: 13,
                      fontWeight: authMode === m ? 600 : 400,
                      fontFamily: "'Sora', sans-serif",
                      transition: "all 0.18s ease",
                    }}>
                    {m === "login" ? "Sign In" : "Sign Up"}
                  </button>
                ))}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => { setAuthMode("login"); setAuthError(""); setAuthSuccess("") }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "hsl(119,99%,46%)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  textAlign: "left",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                ← Back to Sign In
              </button>
            )}

            {/* Signup only: Username & Display Name */}
            {authMode === "signup" && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  <label style={{
                    fontSize: 11,
                    color: "#888",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    marginBottom: 6,
                  }}>Username</label>
                  <input
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      background: "#0d0d0d",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 10,
                      color: "#f0f0f0",
                      fontSize: 14,
                      fontFamily: "'Sora', sans-serif",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                    placeholder="e.g. alex99"
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    autoCapitalize="none"
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  <label style={{
                    fontSize: 11,
                    color: "#888",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    marginBottom: 6,
                  }}>Display Name <span style={{ color: "#666", fontWeight: 400 }}>(optional)</span></label>
                  <input
                    style={{
                      width: "100%",
                      padding: "11px 14px",
                      background: "#0d0d0d",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 10,
                      color: "#f0f0f0",
                      fontSize: 14,
                      fontFamily: "'Sora', sans-serif",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                    placeholder="e.g. Alex Rivera"
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                  />
                </div>
              </>
            )}

            {/* Email input */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
              <label style={{
                fontSize: 11,
                color: "#888",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginBottom: 6,
              }}>Email</label>
              <input
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  background: "#0d0d0d",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 10,
                  color: "#f0f0f0",
                  fontSize: 14,
                  fontFamily: "'Sora', sans-serif",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                placeholder="you@example.com"
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            {/* Password input (login & signup only) */}
            {authMode !== "forgot" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <label style={{
                    fontSize: 11,
                    color: "#888",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                  }}>Password</label>

                  {authMode === "login" && (
                    <button
                      type="button"
                      onClick={() => { setAuthMode("forgot"); setAuthError(""); setAuthSuccess("") }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "hsl(119,99%,46%)",
                        fontSize: 11,
                        cursor: "pointer",
                        padding: 0,
                        fontFamily: "'Sora', sans-serif",
                      }}
                    >
                      Forgot?
                    </button>
                  )}
                </div>

                <div style={{ position: "relative", width: "100%" }}>
                  <input
                    style={{
                      width: "100%",
                      padding: "11px 40px 11px 14px",
                      background: "#0d0d0d",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 10,
                      color: "#f0f0f0",
                      fontSize: 14,
                      fontFamily: "'Sora', sans-serif",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                    placeholder={authMode === "signup" ? "At least 6 characters" : "••••••••"}
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete={authMode === "login" ? "current-password" : "new-password"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: 10,
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: "#888",
                      fontSize: 14,
                      cursor: "pointer",
                      padding: 4,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
            )}

            {/* Error message */}
            {authError && (
              <div style={{
                padding: "10px 14px",
                background: "rgba(248,113,113,0.1)",
                border: "1px solid rgba(248,113,113,0.25)",
                borderRadius: 8,
                color: "#f87171",
                fontSize: 13,
                lineHeight: 1.5,
              }}>{authError}</div>
            )}

            {/* Success message */}
            {authSuccess && (
              <div style={{
                padding: "10px 14px",
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.3)",
                borderRadius: 8,
                color: "hsl(119,99%,46%)",
                fontSize: 13,
                lineHeight: 1.5,
              }}>{authSuccess}</div>
            )}

            {/* Signup hint */}
            {authMode === "signup" && !authSuccess && (
              <p style={{
                color: "#888",
                fontSize: 12,
                margin: 0,
                lineHeight: 1.5,
                padding: "8px 12px",
                background: "rgba(255,255,255,0.03)",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.06)",
              }}>
                ✉️ A confirmation link may be emailed to verify your account upon signup.
              </p>
            )}

            {/* CTA Button */}
            <button
              type="submit"
              disabled={authLoading}
              style={{
                padding: "13px 0",
                background: authLoading
                  ? "rgba(255,255,255,0.06)"
                  : "linear-gradient(135deg, hsl(119,99%,46%) 0%, hsl(119,99%,38%) 100%)",
                border: "none",
                borderRadius: 10,
                fontWeight: 700,
                fontSize: 14,
                cursor: authLoading ? "not-allowed" : "pointer",
                color: authLoading ? "#888" : "#0a0a0a",
                marginTop: 4,
                fontFamily: "'Sora', sans-serif",
                letterSpacing: "0.01em",
                transition: "opacity 0.15s, transform 0.12s",
                boxShadow: authLoading ? "none" : "0 4px 24px hsla(119,99%,46%,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {authLoading ? (
                <>
                  <span style={{
                    width: 14,
                    height: 14,
                    borderRadius: "50%",
                    border: "2px solid #888",
                    borderTopColor: "transparent",
                    display: "inline-block",
                    animation: "spin 0.7s linear infinite",
                  }} />
                  {authMode === "login" && "Signing in…"}
                  {authMode === "signup" && "Creating account…"}
                  {authMode === "forgot" && "Sending reset link…"}
                </>
              ) : (
                <>
                  {authMode === "login" && "Sign In →"}
                  {authMode === "signup" && "Create Account →"}
                  {authMode === "forgot" && "Send Reset Link →"}
                </>
              )}
            </button>

          </form>
        </ElectricBorder>
      </GlareHover>
    </div>
  )
}
