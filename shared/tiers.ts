/**
 * Subscription tier definitions and feature gate helpers.
 * Used on both server (tRPC procedures) and client (UI gating).
 */

export type SubscriptionTier = "free" | "core" | "pro" | "elite";

export const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: "Free",
  core: "Core",
  pro: "Pro",
  elite: "Elite",
};

export const TIER_PRICES: Record<SubscriptionTier, { monthly: number; annual: number }> = {
  free: { monthly: 0, annual: 0 },
  core: { monthly: 9.99, annual: 89.99 },
  pro: { monthly: 19.99, annual: 179.99 },
  elite: { monthly: 39.99, annual: 359.99 },
};

/** Ordered from lowest to highest access. */
export const TIER_ORDER: SubscriptionTier[] = ["free", "core", "pro", "elite"];

/** Returns true if the user's tier meets or exceeds the required tier. */
export function tierAtLeast(userTier: SubscriptionTier | null | undefined, required: SubscriptionTier): boolean {
  const userIdx = TIER_ORDER.indexOf(userTier ?? "free");
  const reqIdx = TIER_ORDER.indexOf(required);
  return userIdx >= reqIdx;
}

/**
 * Feature gates — what each tier unlocks.
 * Use `tierAtLeast` to check access rather than comparing strings directly.
 */
export const FEATURE_GATES = {
  /** Unlimited JIMMI chat messages (free = 10/day cap) */
  unlimitedChat: "core" as SubscriptionTier,
  /** Barcode and camera food scanning */
  foodScan: "core" as SubscriptionTier,
  /** Workout / exercise logging */
  workoutLog: "core" as SubscriptionTier,
  /** Meal plan generation */
  mealPlan: "core" as SubscriptionTier,
  /** Training plan generation */
  trainingPlan: "core" as SubscriptionTier,
  /** Progress analytics dashboard */
  analytics: "core" as SubscriptionTier,
  /** Wearable device integrations (Oura, Whoop, Fitbit) */
  wearables: "pro" as SubscriptionTier,
  /** Multiple saved plans (beyond 1) */
  multiplePlans: "pro" as SubscriptionTier,
  /** Advanced analytics (wearable-enriched) */
  advancedAnalytics: "pro" as SubscriptionTier,
  /** Premium LLM routing (higher quality responses) */
  premiumLLM: "elite" as SubscriptionTier,
  /** Weekly AI-generated progress summary report */
  weeklyReport: "elite" as SubscriptionTier,
  /** Async coach check-in (1x/week) */
  coachCheckIn: "elite" as SubscriptionTier,
} as const;

export type FeatureGate = keyof typeof FEATURE_GATES;

/** Free tier daily chat message limit. */
export const FREE_CHAT_DAILY_LIMIT = 10;
