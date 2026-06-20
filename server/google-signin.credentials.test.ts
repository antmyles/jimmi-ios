import { describe, it, expect } from "vitest";

describe("Google Sign-In credential configuration", () => {
  it("has GOOGLE_SIGNIN_CLIENT_ID set and in correct format", () => {
    const clientId = process.env.GOOGLE_SIGNIN_CLIENT_ID;
    expect(clientId).toBeTruthy();
    expect(clientId).toMatch(/\.apps\.googleusercontent\.com$/);
  });

  it("has GOOGLE_SIGNIN_CLIENT_SECRET set and in correct format", () => {
    const clientSecret = process.env.GOOGLE_SIGNIN_CLIENT_SECRET;
    expect(clientSecret).toBeTruthy();
    expect(clientSecret!.length).toBeGreaterThan(10);
  });

  it("can construct a valid Google OAuth authorization URL with the configured credentials", () => {
    const clientId = process.env.GOOGLE_SIGNIN_CLIENT_ID;
    const redirectUri = "https://askjimmi.com/api/auth/google/callback";
    const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    authUrl.searchParams.set("client_id", clientId!);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", "openid email profile");
    authUrl.searchParams.set("state", "test-state");

    expect(authUrl.toString()).toContain(clientId!);
    expect(authUrl.toString()).toContain("accounts.google.com");
    expect(authUrl.searchParams.get("response_type")).toBe("code");
  });
});
