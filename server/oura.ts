import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { ENV } from "./_core/env";
import { saveOuraConnection } from "./db";

export const OURA_AUTHORIZE_URL = "https://cloud.ouraring.com/oauth/authorize";
export const OURA_TOKEN_URL = "https://api.ouraring.com/oauth/token";
export const OURA_PERSONAL_INFO_URL = "https://api.ouraring.com/v2/usercollection/personal_info";
export const OURA_REDIRECT_URI = "https://askjimmi.com/api/oura/callback";
export const OURA_SCOPES = ["personal", "daily"] as const;

const OURA_STATE_TTL_MS = 15 * 60 * 1000;

type OuraStatePayload = {
  userId: number;
  issuedAt: number;
  nonce: string;
};

type SignedOuraState = OuraStatePayload & {
  signature: string;
};

type OuraTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

type OuraPersonalInfoResponse = {
  id?: string;
  email?: string;
};

function secretForOuraState() {
  if (!ENV.cookieSecret) throw new Error("JIMMI session secret is not configured.");
  return ENV.cookieSecret;
}

function signOuraState(payload: OuraStatePayload) {
  return crypto
    .createHmac("sha256", secretForOuraState())
    .update(`${payload.userId}.${payload.issuedAt}.${payload.nonce}`)
    .digest("base64url");
}

function encodeOuraState(payload: OuraStatePayload) {
  const signed: SignedOuraState = { ...payload, signature: signOuraState(payload) };
  return Buffer.from(JSON.stringify(signed), "utf8").toString("base64url");
}

export function verifyOuraState(state: string, now = Date.now()) {
  let parsed: SignedOuraState;
  try {
    parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8"));
  } catch {
    throw new Error("The Oura connection state is invalid.");
  }

  if (!Number.isInteger(parsed.userId) || parsed.userId <= 0 || !Number.isFinite(parsed.issuedAt) || typeof parsed.nonce !== "string" || typeof parsed.signature !== "string") {
    throw new Error("The Oura connection state is malformed.");
  }
  if (now - parsed.issuedAt > OURA_STATE_TTL_MS || parsed.issuedAt - now > 60_000) {
    throw new Error("The Oura connection state has expired. Please try connecting again.");
  }

  const expected = signOuraState({ userId: parsed.userId, issuedAt: parsed.issuedAt, nonce: parsed.nonce });
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(parsed.signature);
  if (expectedBuffer.length !== actualBuffer.length || !crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
    throw new Error("The Oura connection state signature is invalid.");
  }

  return { userId: parsed.userId, issuedAt: parsed.issuedAt };
}

export function isOuraConfigured() {
  return Boolean(ENV.ouraClientId && ENV.ouraClientSecret);
}

export function createOuraAuthorizationUrl(userId: number) {
  if (!isOuraConfigured()) throw new Error("Oura credentials are not configured yet.");
  const state = encodeOuraState({ userId, issuedAt: Date.now(), nonce: crypto.randomBytes(16).toString("base64url") });
  const url = new URL(OURA_AUTHORIZE_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", ENV.ouraClientId);
  url.searchParams.set("redirect_uri", OURA_REDIRECT_URI);
  url.searchParams.set("scope", OURA_SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

function getQueryParam(req: Request, key: string) {
  const value = req.query[key];
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.find((candidate): candidate is string => typeof candidate === "string");
  return undefined;
}

async function exchangeOuraCodeForToken(code: string) {
  if (!isOuraConfigured()) throw new Error("Oura credentials are not configured yet.");
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: OURA_REDIRECT_URI,
    client_id: ENV.ouraClientId,
    client_secret: ENV.ouraClientSecret,
  });
  const response = await fetch(OURA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body,
  });
  const data = (await response.json().catch(() => ({}))) as OuraTokenResponse;
  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Oura token exchange failed.");
  }
  return data;
}

async function fetchOuraExternalUserId(accessToken: string) {
  const response = await fetch(OURA_PERSONAL_INFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!response.ok) return null;
  const data = (await response.json().catch(() => ({}))) as OuraPersonalInfoResponse;
  return data.id ?? data.email ?? null;
}

function redirectToIntegration(res: Response, status: "connected" | "denied" | "error") {
  res.redirect(303, `/integrations/oura?oura=${status}`);
}

export async function handleOuraCallback(req: Request, res: Response) {
  const denied = getQueryParam(req, "error");
  if (denied) return redirectToIntegration(res, denied === "access_denied" ? "denied" : "error");

  const code = getQueryParam(req, "code");
  const state = getQueryParam(req, "state");
  if (!code || !state) return redirectToIntegration(res, "error");

  try {
    const verified = verifyOuraState(state);
    const token = await exchangeOuraCodeForToken(code);
    const externalUserId = await fetchOuraExternalUserId(token.access_token!);
    await saveOuraConnection({
      userId: verified.userId,
      externalUserId,
      accessToken: token.access_token!,
      refreshToken: token.refresh_token ?? null,
      scope: token.scope ?? OURA_SCOPES.join(" "),
      tokenExpiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null,
    });
    return redirectToIntegration(res, "connected");
  } catch (error) {
    console.error("[Oura] Callback failed", error instanceof Error ? error.message : "Unknown error");
    return redirectToIntegration(res, "error");
  }
}

export function registerOuraRoutes(app: Express) {
  app.get("/api/oura/callback", handleOuraCallback);
}
