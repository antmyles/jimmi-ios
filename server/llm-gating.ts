import { getStripeSubscriptionByUserId } from "./db";

export type UserTier = "free" | "core" | "pro" | "elite";

/**
 * Determine which LLM model to use based on user's subscription tier.
 * 
 * Tier mapping:
 * - free/core: Gemini (faster, cost-effective)
 * - pro/elite: Claude (more capable, reasoning)
 */
export function selectLLMModelForTier(tier: UserTier): string {
  switch (tier) {
    case "free":
    case "core":
      // Gemini for free and core tiers
      return "gemini-2.0-flash";
    case "pro":
    case "elite":
      // Claude for pro and elite tiers
      return "claude-3-5-sonnet-20241022";
    default:
      // Default to Gemini for unknown tiers
      return "gemini-2.0-flash";
  }
}

/**
 * Get the appropriate LLM model for a user based on their subscription status.
 * Falls back to free tier model if no active subscription is found.
 */
export async function getLLMModelForUser(userId: number): Promise<string> {
  try {
    // Check if user has an active Stripe subscription
    const subscription = await getStripeSubscriptionByUserId(userId);
    
    if (subscription && subscription.status === "active") {
      // Map Stripe tier to our tier system
      const tierMap: Record<string, UserTier> = {
        starter: "core",
        pro: "pro",
        elite: "elite",
      };
      const tier = tierMap[subscription.tier] ?? "free";
      return selectLLMModelForTier(tier);
    }
  } catch (error) {
    console.warn(`[LLM Gating] Failed to check subscription for user ${userId}:`, error);
  }

  // Default to free tier model
  return selectLLMModelForTier("free");
}

/**
 * Configuration for different LLM models to guide system prompt selection.
 * Can be used to customize coaching style based on model capabilities.
 */
export const LLM_MODEL_CAPABILITIES = {
  "gemini-2.0-flash": {
    name: "Gemini 2.0 Flash",
    tier: "free",
    maxTokens: 8192,
    supportsThinking: false,
    description: "Fast, efficient model for quick coaching responses",
  },
  "claude-3-5-sonnet-20241022": {
    name: "Claude 3.5 Sonnet",
    tier: "pro",
    maxTokens: 32768,
    supportsThinking: true,
    description: "Advanced reasoning model for detailed analysis and coaching",
  },
} as const;
