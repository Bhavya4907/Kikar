// Single source of truth for plan limits and prices.
// (Kept out of any route.js file: Next.js only allows HTTP-method exports from route files.)

export const PLAN_LIMITS = {
  free: { daily_chat_limit: 30, monthly_image_limit: 3, price_inr: 0, price_usd: 0 },
  plus: { daily_chat_limit: 500, monthly_image_limit: 50, price_inr: 249, price_usd: 5.99 },
  pro: { daily_chat_limit: 999999, monthly_image_limit: 250, price_inr: 699, price_usd: 14.99 },
}

// Own-property check, so values like "constructor" or "__proto__" are not treated as plans.
export function isValidPlan(tier) {
  return typeof tier === "string" && Object.prototype.hasOwnProperty.call(PLAN_LIMITS, tier)
}
