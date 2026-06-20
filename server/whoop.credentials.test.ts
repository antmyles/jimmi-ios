import { describe, expect, it } from "vitest";

const UUID_V4ISH_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX_SECRET_PATTERN = /^[0-9a-f]{64}$/i;

describe("WHOOP credential environment", () => {
  it("exposes server-side WHOOP OAuth credentials with expected non-public formats", () => {
    const clientId = process.env.WHOOP_CLIENT_ID;
    const clientSecret = process.env.WHOOP_CLIENT_SECRET;

    expect(clientId, "WHOOP_CLIENT_ID should be configured server-side").toBeTruthy();
    expect(clientSecret, "WHOOP_CLIENT_SECRET should be configured server-side").toBeTruthy();
    expect(clientId).toMatch(UUID_V4ISH_PATTERN);
    expect(clientSecret).toMatch(HEX_SECRET_PATTERN);
    expect(clientSecret).not.toContain(" ");
  });
});
