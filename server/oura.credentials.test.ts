import { describe, expect, it } from "vitest";

const OURA_TOKEN_URL = "https://api.ouraring.com/oauth/token";

const redact = (value: string | undefined) => {
  if (!value) return "missing";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
};

describe("Oura OAuth credential configuration", () => {
  it("has server-side Oura credentials available in the test environment", () => {
    expect(process.env.OURA_CLIENT_ID, "OURA_CLIENT_ID should be configured").toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(process.env.OURA_CLIENT_SECRET, "OURA_CLIENT_SECRET should be configured").toBeTruthy();
    expect(process.env.OURA_CLIENT_SECRET?.length).toBeGreaterThan(24);
  });

  it(
    "reaches Oura's token endpoint using the configured client credentials without an invalid-client rejection",
    async () => {
      const clientId = process.env.OURA_CLIENT_ID;
      const clientSecret = process.env.OURA_CLIENT_SECRET;

      expect(clientId, "OURA_CLIENT_ID should be configured").toBeTruthy();
      expect(clientSecret, "OURA_CLIENT_SECRET should be configured").toBeTruthy();

      const body = new URLSearchParams({
        grant_type: "authorization_code",
        code: "jimmi-credential-validation-placeholder-code",
        redirect_uri: "https://askjimmi.com/api/oura/callback",
        client_id: clientId!,
        client_secret: clientSecret!,
      });

      const response = await fetch(OURA_TOKEN_URL, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
        },
        body,
      });

      const responseText = await response.text();
      let parsed: { error?: string; error_description?: string } = {};
      try {
        parsed = JSON.parse(responseText) as typeof parsed;
      } catch {
        parsed = { error_description: responseText.slice(0, 160) };
      }

      expect(
        response.status,
        `Oura credential validation should not fail as an invalid client for ${redact(clientId)}. Response: ${responseText.slice(0, 200)}`,
      ).not.toBe(401);
      expect(parsed.error, `Unexpected invalid client response: ${responseText.slice(0, 200)}`).not.toBe("invalid_client");
    },
    15_000,
  );
});
