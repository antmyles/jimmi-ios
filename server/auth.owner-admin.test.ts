import { describe, expect, it, afterEach } from "vitest";
import { ENV } from "./_core/env";
import { canUnlockAdminWithPassword, canUnlockOwnerAdminAccess, isAdminFallbackPasswordConfigured, withOwnerAdminRole } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthUser = NonNullable<TrpcContext["user"]>;

const originalOwnerOpenId = ENV.ownerOpenId;
const originalAdminFallbackPassword = ENV.adminFallbackPassword;

function createUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: 1,
    openId: "owner-open-id",
    email: "owner@example.com",
    name: "Owner",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    lastSignedIn: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

afterEach(() => {
  ENV.ownerOpenId = originalOwnerOpenId;
  ENV.adminFallbackPassword = originalAdminFallbackPassword;
});

describe("owner admin role normalization", () => {
  it("returns nullish auth users unchanged", () => {
    expect(withOwnerAdminRole(null)).toBeNull();
    expect(withOwnerAdminRole(undefined)).toBeUndefined();
  });

  it("exposes the configured project owner as admin to the frontend", () => {
    ENV.ownerOpenId = "owner-open-id";

    expect(withOwnerAdminRole(createUser()).role).toBe("admin");
  });

  it("does not promote unrelated users", () => {
    ENV.ownerOpenId = "different-owner-open-id";

    expect(withOwnerAdminRole(createUser()).role).toBe("user");
  });

  it("keeps persisted admins as admin", () => {
    ENV.ownerOpenId = "owner-open-id";

    expect(withOwnerAdminRole(createUser({ role: "admin" })).role).toBe("admin");
  });
});

describe("password admin unlock authorization", () => {
  it("allows the configured admin password to unlock access", () => {
    ENV.adminFallbackPassword = "correct-admin-password";

    expect(isAdminFallbackPasswordConfigured()).toBe(true);
    expect(canUnlockAdminWithPassword("correct-admin-password")).toBe(true);
  });

  it("rejects incorrect admin passwords", () => {
    ENV.adminFallbackPassword = "correct-admin-password";

    expect(canUnlockAdminWithPassword("wrong-admin-password")).toBe(false);
  });

  it("rejects password unlock when no secure password is configured", () => {
    ENV.adminFallbackPassword = "";

    expect(isAdminFallbackPasswordConfigured()).toBe(false);
    expect(canUnlockAdminWithPassword("correct-admin-password")).toBe(false);
  });
});

describe("owner admin unlock authorization", () => {
  it("allows the configured owner account to unlock admin access", () => {
    ENV.ownerOpenId = "owner-open-id";

    expect(canUnlockOwnerAdminAccess(createUser())).toBe(true);
  });

  it("allows already-persisted admins to refresh admin access", () => {
    ENV.ownerOpenId = "different-owner-open-id";

    expect(canUnlockOwnerAdminAccess(createUser({ role: "admin" }))).toBe(true);
  });

  it("rejects signed-in users who are neither owner nor admin", () => {
    ENV.ownerOpenId = "different-owner-open-id";

    expect(canUnlockOwnerAdminAccess(createUser())).toBe(false);
  });

  it("rejects nullish users", () => {
    expect(canUnlockOwnerAdminAccess(null)).toBe(false);
    expect(canUnlockOwnerAdminAccess(undefined)).toBe(false);
  });
});
