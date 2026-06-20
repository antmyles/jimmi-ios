/**
 * Tests for custom email/password authentication procedures.
 * Covers: auth.signup, auth.login, auth.googleAuthUrl
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import bcrypt from "bcryptjs";
import { _resetChatSendRateLimiter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getUserByEmail: vi.fn(),
    getUserByGoogleId: vi.fn(),
    updateUserPasswordHash: vi.fn(),
    updateUserGoogleId: vi.fn(),
    upsertUser: vi.fn(),
    getJimmiProfile: vi.fn(),
  };
});

vi.mock("./_core/sdk", () => ({
  sdk: {
    createSessionToken: vi.fn().mockResolvedValue("mock-session-token"),
    exchangeCodeForToken: vi.fn(),
    getUserInfo: vi.fn(),
  },
}));

// ─── Helper: create a tRPC caller with a mock request/response ────────────────

function makeCaller() {
  const cookieSpy = vi.fn();
  const ctx: TrpcContext = {
    user: null,
    req: { headers: { host: "localhost:3000" }, protocol: "http" } as TrpcContext["req"],
    res: { cookie: cookieSpy } as unknown as TrpcContext["res"],
  };
  return { caller: appRouter.createCaller(ctx), cookieSpy };
}

// ─── auth.signup ──────────────────────────────────────────────────────────────

describe("auth.signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetChatSendRateLimiter();
  });

  it("creates a new user and sets a session cookie", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue(null);
    vi.mocked(db.upsertUser).mockResolvedValue(undefined as never);
    vi.mocked(db.updateUserPasswordHash).mockResolvedValue(undefined as never);
    // After upsert, getUserByEmail is called again to get the new user
    vi.mocked(db.getUserByEmail)
      .mockResolvedValueOnce(null)  // First call: check for duplicate
      .mockResolvedValueOnce({      // Second call: fetch newly created user
        id: 1,
        openId: "email_123_abc",
        name: "Test User",
        email: "test@example.com",
        passwordHash: null,
        googleId: null,
        emailVerified: false,
        role: "user",
        planTier: "free",
        loginMethod: "email",
        lastSignedIn: new Date(),
        createdAt: new Date(),
      } as never);

    const { caller, cookieSpy } = makeCaller();
    const result = await caller.auth.signup({
      name: "Test User",
      email: "test@example.com",
      password: "password123",
    });

    expect(result.success).toBe(true);
    expect(result.returnPath).toBe("/onboarding");
    expect(cookieSpy).toHaveBeenCalledOnce();
    expect(db.updateUserPasswordHash).toHaveBeenCalledOnce();
  });

  it("throws CONFLICT when email already exists", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue({
      id: 1,
      openId: "email_existing",
      email: "existing@example.com",
    } as never);

    const { caller } = makeCaller();
    await expect(
      caller.auth.signup({
        name: "Test User",
        email: "existing@example.com",
        password: "password123",
      })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("normalizes email to lowercase", async () => {
    vi.mocked(db.getUserByEmail)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 1, openId: "email_123", name: "Test", email: "test@example.com", passwordHash: null } as never);
    vi.mocked(db.upsertUser).mockResolvedValue(undefined as never);
    vi.mocked(db.updateUserPasswordHash).mockResolvedValue(undefined as never);

    const { caller } = makeCaller();
    await caller.auth.signup({
      name: "Test User",
      email: "TEST@EXAMPLE.COM",
      password: "password123",
    });

    expect(db.getUserByEmail).toHaveBeenCalledWith("test@example.com");
  });

  it("rejects passwords shorter than 8 characters", async () => {
    const { caller } = makeCaller();
    await expect(
      caller.auth.signup({ name: "Test", email: "test@example.com", password: "short" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("rejects invalid email addresses", async () => {
    const { caller } = makeCaller();
    await expect(
      caller.auth.signup({ name: "Test", email: "not-an-email", password: "password123" })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// ─── auth.login ───────────────────────────────────────────────────────────────

describe("auth.login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetChatSendRateLimiter();
  });

  it("logs in with correct credentials and sets session cookie", async () => {
    const passwordHash = await bcrypt.hash("correctpassword", 10);
    vi.mocked(db.getUserByEmail).mockResolvedValue({
      id: 1,
      openId: "email_123_abc",
      name: "Test User",
      email: "test@example.com",
      passwordHash,
      role: "user",
      planTier: "free",
    } as never);
    vi.mocked(db.upsertUser).mockResolvedValue(undefined as never);
    vi.mocked(db.getJimmiProfile).mockResolvedValue({ id: 1 } as never);

    const { caller, cookieSpy } = makeCaller();
    const result = await caller.auth.login({
      email: "test@example.com",
      password: "correctpassword",
    });

    expect(result.success).toBe(true);
    expect(result.returnPath).toBe("/chat");
    expect(cookieSpy).toHaveBeenCalledOnce();
  });

  it("sends to /onboarding when user has no profile", async () => {
    const passwordHash = await bcrypt.hash("correctpassword", 10);
    vi.mocked(db.getUserByEmail).mockResolvedValue({
      id: 2,
      openId: "email_456",
      name: "New User",
      email: "new@example.com",
      passwordHash,
    } as never);
    vi.mocked(db.upsertUser).mockResolvedValue(undefined as never);
    vi.mocked(db.getJimmiProfile).mockResolvedValue(null);

    const { caller } = makeCaller();
    const result = await caller.auth.login({
      email: "new@example.com",
      password: "correctpassword",
    });

    expect(result.returnPath).toBe("/onboarding");
  });

  it("throws UNAUTHORIZED for wrong password", async () => {
    const passwordHash = await bcrypt.hash("correctpassword", 10);
    vi.mocked(db.getUserByEmail).mockResolvedValue({
      id: 1,
      openId: "email_123",
      email: "test@example.com",
      passwordHash,
    } as never);

    const { caller } = makeCaller();
    await expect(
      caller.auth.login({ email: "test@example.com", password: "wrongpassword" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws UNAUTHORIZED for unknown email (prevents enumeration)", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue(null);

    const { caller } = makeCaller();
    await expect(
      caller.auth.login({ email: "nobody@example.com", password: "anypassword" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("throws UNAUTHORIZED when user has no password hash (Google-only account)", async () => {
    vi.mocked(db.getUserByEmail).mockResolvedValue({
      id: 3,
      openId: "google_123",
      email: "google@example.com",
      passwordHash: null,
    } as never);

    const { caller } = makeCaller();
    await expect(
      caller.auth.login({ email: "google@example.com", password: "anypassword" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

// ─── auth.googleAuthUrl ───────────────────────────────────────────────────────

describe("auth.googleAuthUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetChatSendRateLimiter();
  });

  it("throws NOT_IMPLEMENTED when GOOGLE_SIGNIN_CLIENT_ID is not set", async () => {
    const originalEnv = process.env.GOOGLE_SIGNIN_CLIENT_ID;
    delete process.env.GOOGLE_SIGNIN_CLIENT_ID;

    const { caller } = makeCaller();
    await expect(
      caller.auth.googleAuthUrl({ origin: "https://askjimmi.com" })
    ).rejects.toMatchObject({ code: "NOT_IMPLEMENTED" });

    process.env.GOOGLE_SIGNIN_CLIENT_ID = originalEnv;
  });

  it("returns a Google OAuth URL when client ID is configured", async () => {
    process.env.GOOGLE_SIGNIN_CLIENT_ID = "test-client-id.apps.googleusercontent.com";

    const { caller } = makeCaller();
    const result = await caller.auth.googleAuthUrl({ origin: "https://askjimmi.com" });

    expect(result.url).toContain("accounts.google.com/o/oauth2/v2/auth");
    expect(result.url).toContain("test-client-id.apps.googleusercontent.com");
    expect(result.url).toContain(encodeURIComponent("askjimmi.com/api/auth/google/callback"));
    expect(result.url).toContain("scope=openid+email+profile");

    delete process.env.GOOGLE_SIGNIN_CLIENT_ID;
  });
});
