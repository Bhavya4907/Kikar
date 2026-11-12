import crypto from "crypto"

const STRIPE_TOLERANCE_SECONDS = 5 * 60

function safeEqualHex(a, b) {
  const bufA = Buffer.from(String(a), "utf8")
  const bufB = Buffer.from(String(b), "utf8")
  return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)
}

// Stripe-Signature: t=<unix>,v1=<hmac>[,v1=<hmac>...]  where hmac = HMAC_SHA256(secret, `${t}.${rawBody}`)
export function verifyStripeSignature(rawBody, header, secret, nowMs = Date.now()) {
  if (!header || !secret) return false
  const parts = header.split(",").map((p) => p.trim())
  const timestamp = parts.find((p) => p.startsWith("t="))?.slice(2)
  const signatures = parts.filter((p) => p.startsWith("v1=")).map((p) => p.slice(3))
  if (!timestamp || signatures.length === 0) return false
  if (Math.abs(nowMs / 1000 - Number(timestamp)) > STRIPE_TOLERANCE_SECONDS) return false
  const expected = crypto.createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")
  return signatures.some((sig) => safeEqualHex(sig, expected))
}

export function verifyRazorpaySignature(rawBody, header, secret) {
  if (!header || !secret) return false
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
  return safeEqualHex(header, expected)
}
