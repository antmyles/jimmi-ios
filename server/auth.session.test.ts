import { describe, expect, it } from "vitest";
import { sdk } from "./_core/sdk";

describe("auth session token compatibility", () => {
  it("creates a verifiable session token when OAuth does not provide a display name", async () => {
    const token = await sdk.createSessionToken("test-open-id-blank-name", { name: "" });
    const session = await sdk.verifySession(token);

    expect(session).toMatchObject({
      openId: "test-open-id-blank-name",
      name: "Manus user",
    });
    expect(session?.appId).toBeTruthy();
  });

  it("normalizes whitespace-only OAuth names instead of minting an invalid cookie", async () => {
    const token = await sdk.createSessionToken("test-open-id-whitespace-name", { name: "   " });
    const session = await sdk.verifySession(token);

    expect(session).toMatchObject({
      openId: "test-open-id-whitespace-name",
      name: "Manus user",
    });
  });
});
