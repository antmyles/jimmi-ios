import crypto from "crypto";
import { describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import {
  WHOOP_REDIRECT_URI,
  WHOOP_SCOPES,
  WHOOP_WEBHOOK_URL,
  createWhoopAuthorizationUrl,
  isWhoopConfigured,
  verifyWhoopState,
  verifyWhoopWebhookSignature,
} from "./whoop";

describe("WHOOP OAuth helpers", () => {
  it("builds a WHOOP authorization URL with the production redirect URI and requested scopes", () => {
    expect(isWhoopConfigured()).toBe(true);

    const url = new URL(createWhoopAuthorizationUrl(42));

    expect(url.origin + url.pathname).toBe("https://api.prod.whoop.com/oauth/oauth2/auth");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("client_id")).toBe(ENV.whoopClientId);
    expect(url.searchParams.get("redirect_uri")).toBe(WHOOP_REDIRECT_URI);
    expect(url.searchParams.get("scope")).toBe(WHOOP_SCOPES.join(" "));
    expect(WHOOP_WEBHOOK_URL).toBe("https://askjimmi.com/api/whoop/webhook");
  });

  it("round-trips and verifies the signed WHOOP OAuth state without exposing token data", () => {
    const url = new URL(createWhoopAuthorizationUrl(77));
    const state = url.searchParams.get("state");

    expect(state).toBeTruthy();
    expect(verifyWhoopState(state!)).toMatchObject({ userId: 77 });
  });
});

describe("WHOOP webhook signature verification", () => {
  it("accepts a correctly signed WHOOP webhook body within timestamp tolerance", () => {
    const rawBody = Buffer.from(JSON.stringify({ type: "sleep.updated", user_id: "whoop-user", id: "sleep-id" }), "utf8");
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = crypto
      .createHmac("sha256", ENV.whoopClientSecret)
      .update(`${timestamp}${rawBody.toString("utf8")}`)
      .digest("base64");

    expect(verifyWhoopWebhookSignature({ rawBody, timestamp, signature })).toBe(true);
  });

  it("rejects stale or tampered WHOOP webhook signatures", () => {
    const rawBody = Buffer.from(JSON.stringify({ type: "workout.updated", id: "workout-id" }), "utf8");
    const timestamp = String(Math.floor(Date.now() / 1000) - 1_000);
    const signature = crypto
      .createHmac("sha256", ENV.whoopClientSecret)
      .update(`${timestamp}${rawBody.toString("utf8")}`)
      .digest("base64");

    expect(verifyWhoopWebhookSignature({ rawBody, timestamp, signature })).toBe(false);
    expect(verifyWhoopWebhookSignature({ rawBody, timestamp: String(Math.floor(Date.now() / 1000)), signature: "tampered" })).toBe(false);
  });
});
