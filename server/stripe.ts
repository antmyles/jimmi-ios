import { Express } from "express";
import Stripe from "stripe";
import { ENV } from "./_core/env";
import { createStripeSubscription, getStripeCustomerByUserId, updateStripeSubscription, updateUserPlanTier, getUserById } from "./db";
import express from "express";

const stripe = new Stripe(ENV.stripeSecretKey);

export async function registerStripeRoutes(app: Express) {
  // Endpoint to create checkout session (MUST be registered before webhook to avoid body consumption)
  app.post("/api/stripe/checkout", express.json(), async (req, res) => {
    try {
      const { userId, tier, origin } = req.body;
      console.log(`[Stripe] Checkout request: userId=${userId}, tier=${tier}, origin=${origin}`);

      if (!userId || !tier || !origin) {
        console.error("[Stripe] Missing required fields");
        return res.status(400).json({ error: "Missing required fields" });
      }

      const user = await getUserById(userId);
      if (!user) {
        console.error(`[Stripe] User not found: ${userId}`);
        return res.status(404).json({ error: "User not found" });
      }

      const priceId = getPriceIdForTier(tier);
      console.log(`[Stripe] Price ID for tier ${tier}: ${priceId}`);
      if (!priceId) {
        console.error(`[Stripe] Invalid tier or missing price ID: ${tier}`);
        return res.status(400).json({ error: "Invalid tier" });
      }

      // Get or create Stripe customer
      let stripeCustomerId = (await getStripeCustomerByUserId(userId))?.stripeCustomerId;
      if (!stripeCustomerId) {
        const customer = await stripe.customers.create({
          email: user.email ?? undefined,
          name: user.name ?? undefined,
          metadata: { userId: userId.toString() },
        });
        stripeCustomerId = customer.id;
      }

      // Create checkout session
      const session = await stripe.checkout.sessions.create({
        customer: stripeCustomerId,
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${origin}/subscription?status=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/subscription?status=canceled`,
        metadata: {
          userId: userId.toString(),
          tier,
        },
      });

      console.log(`[Stripe] Checkout session created: ${session.id}`);
      res.json({ sessionId: session.id, url: session.url });
    } catch (error) {
      console.error("[Stripe] Checkout error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      res.status(500).json({ error: `Failed to create checkout session: ${errorMessage}` });
    }
  });

  // Webhook handler for Stripe events (registered after checkout to avoid interfering with JSON parsing)
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(req.body, sig, ENV.stripeWebhookSecret);
    } catch (error) {
      console.error("[Stripe] Webhook signature verification failed:", error);
      return res.status(400).send(`Webhook Error: ${(error as Error).message}`);
    }

    // Handle test events (for testing purposes)
    if (event.id.startsWith("evt_test_")) {
      console.log("[Stripe] Test event detected, returning verification response");
      return res.json({ verified: true });
    }

    try {
      switch (event.type) {
        case "customer.subscription.created":
        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionUpdate(subscription);
          break;
        }
        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;
          await handleSubscriptionCanceled(subscription);
          break;
        }
        case "invoice.paid": {
          const invoice = event.data.object as Stripe.Invoice;
          console.log(`[Stripe] Invoice paid: ${invoice.id}`);
          break;
        }
        case "payment_intent.succeeded": {
          const paymentIntent = event.data.object as Stripe.PaymentIntent;
          console.log(`[Stripe] Payment succeeded: ${paymentIntent.id}`);
          break;
        }
        default:
          console.log(`[Stripe] Unhandled event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("[Stripe] Error processing webhook:", error);
      res.status(500).json({ error: "Webhook processing failed" });
    }
  });
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const userId = parseInt(subscription.metadata?.userId ?? "0");
  if (!userId) {
    console.warn("[Stripe] Subscription update missing userId in metadata");
    return;
  }

  const tierFromMetadata = subscription.metadata?.tier as string | undefined;
  if (!tierFromMetadata) {
    console.warn("[Stripe] Subscription update missing tier in metadata");
    return;
  }

  // Map Stripe tier to database tier
  const tierMap: Record<string, "free" | "core" | "pro" | "elite"> = {
    starter: "core",
    pro: "pro",
    elite: "elite",
  };
  const tier = tierMap[tierFromMetadata];
  if (!tier) {
    console.warn(`[Stripe] Unknown tier: ${tierFromMetadata}`);
    return;
  }

  const status = subscription.status === "active" ? "active" : ("past_due" as const);
  
  // Get current period dates from subscription (cast to any to access Stripe API properties)
  const sub = subscription as any;
  const currentPeriodStart = sub.current_period_start ? new Date(sub.current_period_start * 1000) : undefined;
  const currentPeriodEnd = sub.current_period_end ? new Date(sub.current_period_end * 1000) : undefined;

  // Update or create subscription record
  await createStripeSubscription({
    userId,
    stripeSubscriptionId: subscription.id,
    stripePriceId: subscription.items.data[0]?.price.id ?? "",
    tier: tierFromMetadata as "starter" | "pro" | "elite",
    status,
    currentPeriodStart,
    currentPeriodEnd,
  });

  // Update user tier if subscription is active
  if (subscription.status === "active") {
    await updateUserPlanTier(userId, tier);
  }

  console.log(`[Stripe] Subscription updated for user ${userId}: ${tier} (${status})`);
}

async function handleSubscriptionCanceled(subscription: Stripe.Subscription) {
  const userId = parseInt(subscription.metadata?.userId ?? "0");
  if (!userId) {
    console.warn("[Stripe] Subscription cancellation missing userId in metadata");
    return;
  }

  // Mark subscription as canceled
  await updateStripeSubscription(subscription.id, {
    status: "canceled",
    canceledAt: new Date(),
  });

  // Downgrade user to free tier
  await updateUserPlanTier(userId, "free");

  console.log(`[Stripe] Subscription canceled for user ${userId}`);
}

function getPriceIdForTier(tier: string): string | null {
  // Use environment variables configured in ENV
  const priceIds: Record<string, string> = {
    starter: ENV.stripePriceStarterId,
    core: ENV.stripePriceStarterId, // core maps to starter price
    pro: ENV.stripePriceProId,
    elite: ENV.stripePriceEliteId,
  };
  console.log(`[Stripe] Available price IDs:`, priceIds);
  const priceId = priceIds[tier];
  console.log(`[Stripe] Requested tier: ${tier}, Price ID: ${priceId}`);
  return priceId && priceId.length > 0 ? priceId : null;
}

export { stripe };
