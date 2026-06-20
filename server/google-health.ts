import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { ENV } from "./_core/env";
import { saveGoogleHealthConnection } from "./db";

export const GOOGLE_HEALTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_HEALTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
export const GOOGLE_HEALTH_REDIRECT_URI = "https://askjimmi.com/api/google-health/callback";
export const GOOGLE_HEALTH_SCOPES = [
  "openid",
  "profile",
  "https://www.googleapis.com/auth/googlehealth.profile.readonly",
  "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
  "https://www.googleapis.com/auth/googlehealth.sleep.readonly",
  "https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly",
] as const;

const GOOGLE_HEALTH_STATE_TTL_MS = 15 * 60 * 1000;

type GoogleHealthStatePayload = {
  userId: number;
  issuedAt: number;
  nonce: string;
};

type SignedGoogleHealthState = GoogleHealthStatePayload & {
  signature: string;
};

type GoogleHealthTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

type GoogleIdTokenPayload = {
  sub?: string;
  email?: string;
};

function secretForGoogleHealthState() {
  if (!ENV.cookieSecret) throw new Error("JIMMI session secret is not configured.");
  return ENV.cookieSecret;
}

function signGoogleHealthState(payload: GoogleHealthStatePayload) {
  return crypto
    .createHmac("sha256", secretForGoogleHealthState())
    .update(`${payload.userId}.${payload.issuedAt}.${payload.nonce}`)
    .digest("base64url");
}

function encodeGoogleHealthState(payload: GoogleHealthStatePayload) {
  const signed: SignedGoogleHealthState = { ...payload, signature: signGoogleHealthState(payload) };
  return Buffer.from(JSON.stringify(signed), "utf8").toString("base64url");
}

export function verifyGoogleHealthState(state: string, now = Date.now()) {
  let parsed: SignedGoogleHealthState;
  try {
    parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    throw new Error("The Google Health connection state is invalid.");
  }

  if (!Number.isInteger(parsed.userId) || parsed.userId <= 0 || !Number.isFinite(parsed.issuedAt) || typeof parsed.nonce !== "string" || typeof parsed.signature !== "string") {
    throw new Error("The Google Health connection state is malformed.");
  }
  if (now - parsed.issuedAt > GOOGLE_HEALTH_STATE_TTL_MS || parsed.issuedAt - now > 60_000) {
    throw new Error("The Google Health connection state has expired. Please try connecting again.");
  }

  const expected = signGoogleHealthState({ userId: parsed.userId, issuedAt: parsed.issuedAt, nonce: parsed.nonce });
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(parsed.signature);
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new Error("The Google Health connection state signature is invalid.");
  }

  return { userId: parsed.userId, issuedAt: parsed.issuedAt, nonce: parsed.nonce };
}

function buildGoogleHealthCodeVerifier(input: { userId: number; issuedAt: number; nonce: string }) {
  return crypto
    .createHmac("sha256", secretForGoogleHealthState())
    .update(`google-health-pkce.${input.userId}.${input.issuedAt}.${input.nonce}`)
    .digest("base64url");
}

function buildGoogleHealthCodeChallenge(codeVerifier: string) {
  return crypto.createHash("sha256").update(codeVerifier).digest("base64url");
}

export function isGoogleHealthConfigured() {
  return Boolean(ENV.googleHealthClientId && ENV.googleHealthClientSecret);
}

export function buildGoogleHealthAuthUrl(userId: number) {
  if (!isGoogleHealthConfigured()) throw new Error("Google Health credentials are not configured yet.");
  const payload = { userId, issuedAt: Date.now(), nonce: crypto.randomBytes(16).toString("base64url") };
  const state = encodeGoogleHealthState(payload);
  const codeVerifier = buildGoogleHealthCodeVerifier(payload);
  const url = new URL(GOOGLE_HEALTH_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", ENV.googleHealthClientId);
  url.searchParams.set("redirect_uri", GOOGLE_HEALTH_REDIRECT_URI);
  url.searchParams.set("scope", GOOGLE_HEALTH_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("code_challenge", buildGoogleHealthCodeChallenge(codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

function getQueryParam(req: Request, key: string) {
  const value = req.query[key];
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.find((candidate): candidate is string => typeof candidate === "string");
  return undefined;
}

export async function exchangeGoogleHealthCode(code: string, codeVerifier: string) {
  if (!isGoogleHealthConfigured()) throw new Error("Google Health credentials are not configured yet.");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: GOOGLE_HEALTH_REDIRECT_URI,
    client_id: ENV.googleHealthClientId,
    client_secret: ENV.googleHealthClientSecret,
    code_verifier: codeVerifier,
  });
  const response = await fetch(GOOGLE_HEALTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const data = (await response.json().catch(() => ({}))) as GoogleHealthTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Google Health token exchange failed.");
  }
  return data;
}

export async function refreshGoogleHealthToken(refreshToken: string) {
  if (!isGoogleHealthConfigured()) throw new Error("Google Health credentials are not configured yet.");
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: ENV.googleHealthClientId,
    client_secret: ENV.googleHealthClientSecret,
  });
  const response = await fetch(GOOGLE_HEALTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const data = (await response.json().catch(() => ({}))) as GoogleHealthTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Google Health token refresh failed.");
  }
  return data;
}

function parseGoogleIdToken(idToken?: string) {
  if (!idToken) return null;
  const parts = idToken.split(".");
  if (parts.length < 2) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8")) as GoogleIdTokenPayload;
  } catch {
    return null;
  }
}

function redirectToIntegration(res: Response, status: "connected" | "denied" | "error") {
  res.redirect(303, `/integrations/fitbit?fitbit=${status}`);
}

export async function handleGoogleHealthCallback(req: Request, res: Response) {
  const denied = getQueryParam(req, "error");
  if (denied) return redirectToIntegration(res, denied === "access_denied" ? "denied" : "error");

  const code = getQueryParam(req, "code");
  const state = getQueryParam(req, "state");
  if (!code || !state) return redirectToIntegration(res, "error");

  try {
    const verified = verifyGoogleHealthState(state);
    const codeVerifier = buildGoogleHealthCodeVerifier(verified);
    const token = await exchangeGoogleHealthCode(code, codeVerifier);
    const idTokenPayload = parseGoogleIdToken(token.id_token);
    await saveGoogleHealthConnection({
      userId: verified.userId,
      externalUserId: idTokenPayload?.sub ?? idTokenPayload?.email ?? null,
      accessToken: token.access_token!,
      refreshToken: token.refresh_token ?? null,
      scope: token.scope ?? GOOGLE_HEALTH_SCOPES.join(" "),
      tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
    });
    return redirectToIntegration(res, "connected");
  } catch (error) {
    console.error("[Google Health] Callback failed", error instanceof Error ? error.message : "Unknown error");
    return redirectToIntegration(res, "error");
  }
}

export function registerGoogleHealthRoutes(app: Express) {
  app.get("/api/google-health/callback", handleGoogleHealthCallback);
}
