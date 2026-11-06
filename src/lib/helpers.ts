export function formatTime(ts: string) {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function formatDate(ts: string) {
  const d = new Date(ts)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return "Today"
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
  return d.toLocaleDateString()
}

export function showNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission !== "granted") return
  if (document.visibilityState === "visible") return
  new Notification(title, { body, icon: "/favicon.ico" })
}

export async function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission === "default") {
    await Notification.requestPermission()
  }
}

/**
 * Plays an AI message or replica voice note using browser SpeechSynthesis (or external TTS fallback).
 */
export function speakMessageText(text: string, onEnd?: () => void): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    if (onEnd) onEnd()
    return false
  }
  const cleanText = text.replace(/^\[image\]:.*$/i, "").replace(/[*_#`~]/g, "").trim()
  if (!cleanText) {
    if (onEnd) onEnd()
    return false
  }
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(cleanText)
  utterance.rate = 1.02
  utterance.pitch = 1.0
  if (onEnd) {
    utterance.onend = () => onEnd()
    utterance.onerror = () => onEnd()
  }
  window.speechSynthesis.speak(utterance)
  return true
}

export function stopSpeakingText() {
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel()
  }
}