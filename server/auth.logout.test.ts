import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext; clearedCookies: CookieCall[] } {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  const projectRoot = process.cwd();
  const useAuthSource = readFileSync(join(projectRoot, "client/src/_core/hooks/useAuth.ts"), "utf8");
  const mainSource = readFileSync(join(projectRoot, "client/src/main.tsx"), "utf8");
  const memberMenuSource = readFileSync(join(projectRoot, "client/src/components/MemberMenu.tsx"), "utf8");
  const dashboardLayoutSource = readFileSync(join(projectRoot, "client/src/components/DashboardLayout.tsx"), "utf8");

  it("clears the session cookie and reports success", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      sameSite: "none",
      httpOnly: true,
      path: "/",
    });
  });

  it("marks logout as an intentional landing-page redirect before clearing auth state", () => {
    expect(useAuthSource).toContain('LANDING_LOGOUT_REDIRECT_KEY = "jimmi.logout.redirectLanding"');
    expect(useAuthSource).toContain("LANDING_LOGOUT_SUPPRESSION_MS = 15_000");
    expect(useAuthSource).toContain("window.sessionStorage.setItem(LANDING_LOGOUT_REDIRECT_KEY, String(Date.now()))");
    expect(useAuthSource).toContain("redirectToLandingAfterLogout");
    expect(useAuthSource).toContain('window.location.replace("/")');
    expect(useAuthSource).toContain("utils.auth.me.setData(undefined, null);");
    expect(useAuthSource).toContain("utils.auth.me.cancel();");
    expect(useAuthSource).not.toContain("await utils.auth.me.invalidate();");
  });

  it("prevents the global unauthorized guard from sending intentional logout users to sign in", () => {
    expect(mainSource).toContain("LANDING_LOGOUT_REDIRECT_KEY");
    expect(mainSource).toContain("LANDING_LOGOUT_SUPPRESSION_MS");
    expect(mainSource).toContain("logoutRedirectStartedAt");
    expect(mainSource).toContain("isIntentionalLogout");
    expect(mainSource).toContain('window.location.replace("/")');
    expect(mainSource).toContain('window.sessionStorage.removeItem(LANDING_LOGOUT_REDIRECT_KEY)');
    expect(mainSource).toContain("window.location.href = getLoginUrl(getCurrentReturnPath());");
  });

  it("returns both visible logout controls to the public landing page", () => {
    expect(memberMenuSource).toContain("markLogoutRedirectToLanding();");
    expect(memberMenuSource).toContain("redirectToLandingAfterLogout()");
    expect(memberMenuSource).toContain('data-logout-confirmation-redirect="landing"');

    expect(dashboardLayoutSource).toContain("const handleLogout = async () =>");
    expect(dashboardLayoutSource).toContain("redirectToLandingAfterLogout();");
    expect(dashboardLayoutSource).toContain('data-logout-redirect="landing"');
  });
});
