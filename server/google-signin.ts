import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "./db";
import { getSessionCookieOptions } from "./_core/cookies";
import { sdk } from "./_core/sdk";

interface GoogleTokenResponse {
  access_token: string;
  id_token?: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

interface GoogleUserInfo {
  sub: string;        // Google's unique user ID
  email: string;
  email_verified: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerGoogleSignInRoutes(app: Express) {
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const error = getQueryParam(req, "error");

    if (error) {
      console.error("[GoogleSignIn] OAuth error from Google:", error);
      res.redirect("/login?error=google_denied");
      return;
    }

    if (!code) {
      res.redirect("/login?error=missing_code");
      return;
    }

    try {
      const googleClientId = process.env.GOOGLE_SIGNIN_CLIENT_ID;
      const googleClientSecret = process.env.GOOGLE_SIGNIN_CLIENT_SECRET;

      if (!googleClientId || !googleClientSecret) {
        console.error("[GoogleSignIn] Missing GOOGLE_SIGNIN_CLIENT_ID or GOOGLE_SIGNIN_CLIENT_SECRET");
        res.redirect("/login?error=not_configured");
        return;
      }

      // Use the fixed redirect URI from env (must exactly match what was registered in Google Cloud Console)
      const redirectUri = process.env.GOOGLE_SIGNIN_REDIRECT_URI ?? (() => {
        const protocol = req.headers["x-forwarded-proto"] ?? req.protocol;
        const host = req.headers["x-forwarded-host"] ?? req.headers.host;
        return `${protocol}://${host}/api/auth/google/callback`;
      })();

      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: googleClientId,
          client_secret: googleClientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        const body = await tokenRes.text();
        console.error("[GoogleSignIn] Token exchange failed:", body);
        res.redirect("/login?error=token_exchange_failed");
        return;
      }

      const tokens = (await tokenRes.json()) as GoogleTokenResponse;

      // Fetch user info from Google
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!userInfoRes.ok) {
        console.error("[GoogleSignIn] Failed to fetch user info from Google");
        res.redirect("/login?error=userinfo_failed");
        return;
      }

      const googleUser = (await userInfoRes.json()) as GoogleUserInfo;
      const { sub: googleId, email, name, email_verified } = googleUser;

      if (!email) {
        res.redirect("/login?error=no_email");
        return;
      }

      const normalizedEmail = email.toLowerCase().trim();

      // Check if a user with this Google ID already exists
      let user = await db.getUserByGoogleId(googleId);

      if (!user) {
        // Check if a user with this email exists (link accounts)
        const existingByEmail = await db.getUserByEmail(normalizedEmail);
        if (existingByEmail) {
          // Link Google ID to existing account
          await db.updateUserGoogleId(existingByEmail.id, googleId);
          user = await db.getUserByEmail(normalizedEmail);
        } else {
          // Create new user
          const openId = `google_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
          await db.upsertUser({
            openId,
            name: name?.trim() || null,
            email: normalizedEmail,
            loginMethod: "google",
            lastSignedIn: new Date(),
          });
          user = await db.getUserByEmail(normalizedEmail);
          if (user) {
            await db.updateUserGoogleId(user.id, googleId);
          }
        }
      } else {
        // Update last signed in
        await db.upsertUser({ openId: user.openId, lastSignedIn: new Date() });
      }

      if (!user) {
        console.error("[GoogleSignIn] Failed to find or create user after Google auth");
        res.redirect("/login?error=user_creation_failed");
        return;
      }

      // Create session
      const sessionToken = await sdk.createSessionToken(user.openId, {
        name: user.name ?? undefined,
        expiresInMs: ONE_YEAR_MS,
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      // Redirect to the frontend cache-seeder page which calls auth.googleComplete
      // to seed auth.me, onboarding.get, and chat.history before navigating.
      // This prevents the black screen caused by cold-start cache misses.
      res.redirect("/auth/google-complete");
    } catch (err) {
      console.error("[GoogleSignIn] Unexpected error:", err);
      res.redirect("/login?error=server_error");
    }
  });
}
