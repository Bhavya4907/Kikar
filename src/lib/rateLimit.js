// Sliding-window rate limiter.
// NOTE: state lives in this server instance's memory, so on serverless hosting each instance
// has its own counters. It is a cheap burst guard; the database quota (consume_*_quota) is the
// real cost control.

const buckets = new Map()

export function checkRateLimit(key, maxRequests = 25, windowMs = 60 * 1000) {
  const now = Date.now()
  const recent = (buckets.get(key) || []).filter((ts) => now - ts < windowMs)
  if (recent.length >= maxRequests) {
    buckets.set(key, recent)
    return false
  }
  recent.push(now)
  buckets.set(key, recent)

  // Opportunistic cleanup so the map cannot grow forever.
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (!v.length || now - v[v.length - 1] > windowMs) buckets.delete(k)
    }
  }
  return true
}
