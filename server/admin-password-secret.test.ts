import { describe, expect, it } from "vitest";
import { ENV } from "./_core/env";
import { canUnlockAdminWithPassword, isAdminFallbackPasswordConfigured } from "./routers";

describe("admin password secret configuration", () => {
  it("has a configured ADMIN_FALLBACK_PASSWORD that the server unlock validator accepts", () => {
    expect(ENV.adminFallbackPassword).toBeTruthy();
    expect(ENV.adminFallbackPassword.length).toBeGreaterThanOrEqual(8);
    expect(isAdminFallbackPasswordConfigured()).toBe(true);
    expect(canUnlockAdminWithPassword(ENV.adminFallbackPassword)).toBe(true);
  });
});
