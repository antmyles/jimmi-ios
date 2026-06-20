import { describe, expect, it } from "vitest";

describe("Google Health OAuth credentials", () => {
  it("are present and accepted as an OAuth client by Google's token endpoint", async () => {
    const clientId = process.env.GOOGLE_HEALTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_HEALTH_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_HEALTH_REDIRECT_URI;

    expect(clientId, "GOOGLE_HEALTH_CLIENT_ID must be configured").toBeTruthy();
    expect(clientSecret, "GOOGLE_HEALTH_CLIENT_SECRET must be configured").toBeTruthy();
    expect(redirectUri, "GOOGLE_HEALTH_REDIRECT_URI must be configured").toBe(
      "https://askjimmi.com/api/google-health/callback",
    );

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        refresh_token: "intentionally-invalid-refresh-token-for-validation",
        grant_type: "refresh_token",
      }),
    });

    const body = (await response.json()) as { error?: string; error_description?: string };

    expect(body.error).toBe("invalid_grant");
    expect(body.error_description ?? "").not.toMatch(/client/i);
  }, 15000);
});
