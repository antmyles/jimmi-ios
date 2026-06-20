import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { ENV } from "./_core/env";
import { saveWhoopConnection } from "./db";

export const WHOOP_AUTHORIZE_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
export const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";
export const WHOOP_BASIC_PROFILE_URL = "https://api.prod.whoop.com/developer/v2/user/profile/basic";
export const WHOOP_REDIRECT_URI = "https://askjimmi.com/api/whoop/callback";
export const WHOOP_WEBHOOK_URL = "https://askjimmi.com/api/whoop/webhook";
export const WHOOP_SCOPES = ["offline", "read:profile", "read:recovery", "read:sleep", "read:workout", "read:cycles"] as const;

const WHOOP_STATE_TTL_MS = 15 * 60 * 1000;
const WHOOP_WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000;

export type WhoopWebhookEventType =
  | "workout.updated"
  | "workout.deleted"
  | "sleep.updated"
  | "sleep.deleted"
  | "recovery.updated"
  | "recovery.deleted";

type WhoopStatePayload = {
  userId: number;
  issuedAt: number;
  nonce: string;
};

type SignedWhoopState = WhoopStatePayload & {
  signature: string;
};

type WhoopTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type WhoopBasicProfileResponse = {
  user_id?: number | string;
  id?: number | string;
  email?: string;
};

type RequestWithRawBody = Request & {
  rawBody?: Buffer;
};

function secretForWhoopState() {
  if (!ENV.cookieSecret) throw new Error("JIMMI session secret is not configured.");
  return ENV.cookieSecret;
}

function signWhoopState(payload: WhoopStatePayload) {
  return crypto
    .createHmac("sha256", secretForWhoopState())
    .update(`${payload.userId}.${payload.issuedAt}.${payload.nonce}`)
    .digest("base64url");
}

function encodeWhoopState(payload: WhoopStatePayload) {
  const signed: SignedWhoopState = { ...payload, signature: signWhoopState(payload) };
  return Buffer.from(JSON.stringify(signed), "utf8").toString("base64url");
}

export function verifyWhoopState(state: string, now = Date.now()) {
  let parsed: SignedWhoopState;
  try {
    parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    throw new Error("The WHOOP connection state is invalid.");
  }

  if (!Number.isInteger(parsed.userId) || parsed.userId <= 0 || !Number.isFinite(parsed.issuedAt) || typeof parsed.nonce !== "string" || typeof parsed.signature !== "string") {
    throw new Error("The WHOOP connection state is malformed.");
  }
  if (now - parsed.issuedAt > WHOOP_STATE_TTL_MS || parsed.issuedAt - now > 60_000) {
    throw new Error("The WHOOP connection state has expired. Please try connecting again.");
  }

  const expected = signWhoopState({ userId: parsed.userId, issuedAt: parsed.issuedAt, nonce: parsed.nonce });
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(parsed.signature);
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new Error("The WHOOP connection state signature is invalid.");
  }

  return { userId: parsed.userId, issuedAt: parsed.issuedAt };
}

export function isWhoopConfigured() {
  return Boolean(ENV.whoopClientId && ENV.whoopClientSecret);
}

export function createWhoopAuthorizationUrl(userId: number) {
  if (!isWhoopConfigured()) throw new Error("WHOOP credentials are not configured yet.");
  const state = encodeWhoopState({ userId, issuedAt: Date.now(), nonce: crypto.randomBytes(16).toString("base64url") });
  const url = new URL(WHOOP_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", ENV.whoopClientId);
  url.searchParams.set("redirect_uri", WHOOP_REDIRECT_URI);
  url.searchParams.set("scope", WHOOP_SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

function getQueryParam(req: Request, key: string) {
  const value = req.query[key];
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.find((candidate): candidate is string => typeof candidate === "string");
  return undefined;
}

async function exchangeWhoopCodeForToken(code: string) {
  if (!isWhoopConfigured()) throw new Error("WHOOP credentials are not configured yet.");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: WHOOP_REDIRECT_URI,
    client_id: ENV.whoopClientId,
    client_secret: ENV.whoopClientSecret,
  });
  const response = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const data = (await response.json().catch(() => ({}))) as WhoopTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "WHOOP token exchange failed.");
  }
  return data;
}

async function fetchWhoopExternalUserId(accessToken: string) {
  const response = await fetch(WHOOP_BASIC_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!response.ok) return null;
  const data = (await response.json().catch(() => ({}))) as WhoopBasicProfileResponse;
  const id = data.user_id ?? data.id ?? data.email ?? null;
  return id == null ? null : String(id);
}

function redirectToIntegration(res: Response, status: "connected" | "denied" | "error") {
  res.redirect(303, `/integrations/whoop?whoop=${status}`);
}

export async function handleWhoopCallback(req: Request, res: Response) {
  const denied = getQueryParam(req, "error");
  if (denied) return redirectToIntegration(res, denied === "access_denied" ? "denied" : "error");

  const code = getQueryParam(req, "code");
  const state = getQueryParam(req, "state");
  if (!code || !state) return redirectToIntegration(res, "error");

  try {
    const verified = verifyWhoopState(state);
    const token = await exchangeWhoopCodeForToken(code);
    const externalUserId = await fetchWhoopExternalUserId(token.access_token!);
    await saveWhoopConnection({
      userId: verified.userId,
      externalUserId,
      accessToken: token.access_token!,
      refreshToken: token.refresh_token ?? null,
      scope: token.scope ?? WHOOP_SCOPES.join(" "),
      tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
    });
    return redirectToIntegration(res, "connected");
  } catch (error) {
    console.error("[WHOOP] Callback failed", error instanceof Error ? error.message : "Unknown error");
    return redirectToIntegration(res, "error");
  }
}

export function verifyWhoopWebhookSignature(input: { rawBody: Buffer | string; signature?: string; timestamp?: string; now?: number }) {
  if (!isWhoopConfigured()) return false;
  if (!input.signature || !input.timestamp) return false;
  const timestampNumber = Number(input.timestamp);
  if (!Number.isFinite(timestampNumber)) return false;
  const timestampMs = timestampNumber > 10_000_000_000 ? timestampNumber : timestampNumber * 1000;
  if (Math.abs((input.now ?? Date.now()) - timestampMs) > WHOOP_WEBHOOK_TOLERANCE_MS) return false;

  const rawBody = Buffer.isBuffer(input.rawBody) ? input.rawBody : Buffer.from(input.rawBody, "utf8");
  const expected = crypto
    .createHmac("sha256", ENV.whoopClientSecret)
    .update(`${input.timestamp}${rawBody.toString("utf8")}`)
    .digest("base64");
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(input.signature);
  return expectedBuffer.length === actualBuffer.length && crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function handleWhoopWebhook(req: RequestWithRawBody, res: Response) {
  const signature = req.header("X-WHOOP-Signature") ?? undefined;
  const timestamp = req.header("X-WHOOP-Signature-Timestamp") ?? undefined;
  const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}), "utf8");
  if (!verifyWhoopWebhookSignature({ rawBody, signature, timestamp })) {
    return res.status(401).json({ ok: false });
  }

  const event = req.body as { user_id?: string; id?: string; type?: WhoopWebhookEventType; trace_id?: string };
  console.info("[WHOOP] Webhook accepted", {
    type: event.type ?? "unknown",
    userId: event.user_id ?? null,
    resourceId: event.id ?? null,
    traceId: event.trace_id ?? null,
  });
  return res.status(202).json({ ok: true });
}

export function registerWhoopRoutes(app: Express) {
  app.get("/api/whoop/callback", handleWhoopCallback);
  app.post("/api/whoop/webhook", handleWhoopWebhook);
}
