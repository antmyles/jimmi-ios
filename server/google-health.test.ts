import { describe, expect, it } from "vitest";
import {
  GOOGLE_HEALTH_REDIRECT_URI,
  GOOGLE_HEALTH_SCOPES,
  buildGoogleHealthAuthUrl,
  isGoogleHealthConfigured,
  verifyGoogleHealthState,
} from "./google-health";

describe("Google Health OAuth helper", () => {
  it("uses the production Google Health callback and required beta health scopes", () => {
    expect(GOOGLE_HEALTH_REDIRECT_URI).toBe("https://askjimmi.com/api/google-health/callback");
    expect(GOOGLE_HEALTH_SCOPES).toContain("openid");
    expect(GOOGLE_HEALTH_SCOPES).toContain("profile");
    expect(GOOGLE_HEALTH_SCOPES).toContain("https://www.googleapis.com/auth/googlehealth.profile.readonly");
    expect(GOOGLE_HEALTH_SCOPES).toContain("https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly");
    expect(GOOGLE_HEALTH_SCOPES).toContain("https://www.googleapis.com/auth/googlehealth.sleep.readonly");
    expect(GOOGLE_HEALTH_SCOPES).toContain("https://www.googleapis.com/auth/googlehealth.health_metrics_and_measurements.readonly");
  });

  it("builds a Google OAuth authorization URL with signed state and PKCE", () => {
    expect(isGoogleHealthConfigured()).toBe(true);
    const authorizationUrl = new URL(buildGoogleHealthAuthUrl(42));

    expect(authorizationUrl.origin + authorizationUrl.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(authorizationUrl.searchParams.get("response_type")).toBe("code");
    expect(authorizationUrl.searchParams.get("client_id")).toBe(process.env.GOOGLE_HEALTH_CLIENT_ID);
    expect(authorizationUrl.searchParams.get("redirect_uri")).toBe(GOOGLE_HEALTH_REDIRECT_URI);
    expect(authorizationUrl.searchParams.get("access_type")).toBe("offline");
    expect(authorizationUrl.searchParams.get("prompt")).toBe("consent");
    expect(authorizationUrl.searchParams.get("include_granted_scopes")).toBe("true");
    expect(authorizationUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorizationUrl.searchParams.get("code_challenge")?.length).toBeGreaterThan(30);

    const scope = authorizationUrl.searchParams.get("scope") ?? "";
    for (const expectedScope of GOOGLE_HEALTH_SCOPES) expect(scope).toContain(expectedScope);

    const state = authorizationUrl.searchParams.get("state");
    expect(state).toBeTruthy();
    const verified = verifyGoogleHealthState(state!);
    expect(verified.userId).toBe(42);
    expect(verified.nonce.length).toBeGreaterThan(10);
  });
});
