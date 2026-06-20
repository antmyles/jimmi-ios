import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Context helpers ──────────────────────────────────────────────────────────

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@jimmi.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };
  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => {} } as unknown as TrpcContext["res"],
  };
}

// ─── Router contract tests ────────────────────────────────────────────────────

describe("coach router — admin access control", () => {
  it("coach.listEliteUsers is accessible to admin", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    // With no DB in test env this will return empty array, not throw
    const result = await caller.coach.listEliteUsers();
    expect(result).toHaveProperty("users");
    expect(Array.isArray(result.users)).toBe(true);
  });

  it("coach.listEliteUsers is blocked for non-admin users", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.coach.listEliteUsers()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("coach.getUserCalorieBalance rejects non-admin", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.coach.getUserCalorieBalance({ userId: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("coach.getUserFoodLogs rejects non-admin", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.coach.getUserFoodLogs({ userId: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("coach.getUserWorkoutLogs rejects non-admin", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(caller.coach.getUserWorkoutLogs({ userId: 1 })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  it("coach.overrideMacros rejects non-admin", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(
      caller.coach.overrideMacros({ userId: 1, calories: 2000, protein: 150, carbs: 200, fat: 60, notes: null })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("coach.overrideProgram rejects non-admin", async () => {
    const caller = appRouter.createCaller(createUserContext());
    await expect(
      caller.coach.overrideProgram({ userId: 1, title: "Test", planJson: '{"weeks":[]}' })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("coach router — input validation", () => {
  it("coach.overrideMacros rejects negative calorie values", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(
      caller.coach.overrideMacros({ userId: 1, calories: -100, protein: 150, carbs: 200, fat: 60, notes: null })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("coach.overrideMacros accepts null values to reset override", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    // userId 999 doesn't exist — should throw NOT_FOUND, not BAD_REQUEST
    // This confirms null values pass schema validation
    await expect(
      caller.coach.overrideMacros({ userId: 999, calories: null, protein: null, carbs: null, fat: null, notes: null })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("coach.overrideProgram rejects empty title", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(
      caller.coach.overrideProgram({ userId: 1, title: "", planJson: '{"weeks":[]}' })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("coach.getUserCalorieBalance requires positive integer userId", async () => {
    const caller = appRouter.createCaller(createAdminContext());
    await expect(
      caller.coach.getUserCalorieBalance({ userId: -1 })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// ─── UI source contract tests ─────────────────────────────────────────────────

describe("CoachPanel UI — source contracts", () => {
  const projectRoot = process.cwd();
  const coachPanelSource = readFileSync(join(projectRoot, "client/src/pages/CoachPanel.tsx"), "utf8");
  const adminManagementSource = readFileSync(join(projectRoot, "client/src/pages/AdminManagement.tsx"), "utf8");
  const appSource = readFileSync(join(projectRoot, "client/src/App.tsx"), "utf8");

  it("CoachPanel is registered as a route in App.tsx", () => {
    expect(appSource).toContain('path="/coach-panel"');
    expect(appSource).toContain("CoachPanel");
  });

  it("CoachPanel requires admin role to render the panel", () => {
    expect(coachPanelSource).toContain('user?.role === "admin"');
    expect(coachPanelSource).toContain("Coach access required");
  });

  it("CoachPanel uses coach.listEliteUsers tRPC query", () => {
    expect(coachPanelSource).toContain("trpc.coach.listEliteUsers.useQuery");
  });

  it("CoachPanel uses coach.getUserCalorieBalance tRPC query", () => {
    expect(coachPanelSource).toContain("trpc.coach.getUserCalorieBalance.useQuery");
  });

  it("CoachPanel uses coach.getUserFoodLogs tRPC query", () => {
    expect(coachPanelSource).toContain("trpc.coach.getUserFoodLogs.useQuery");
  });

  it("CoachPanel uses coach.getUserWorkoutLogs tRPC query", () => {
    expect(coachPanelSource).toContain("trpc.coach.getUserWorkoutLogs.useQuery");
  });

  it("CoachPanel uses coach.overrideMacros mutation", () => {
    expect(coachPanelSource).toContain("trpc.coach.overrideMacros.useMutation");
  });

  it("CoachPanel uses coach.overrideProgram mutation", () => {
    expect(coachPanelSource).toContain("trpc.coach.overrideProgram.useMutation");
  });

  it("CoachPanel shows empty state with link to admin management when no Elite users", () => {
    expect(coachPanelSource).toContain('data-coach-empty-state="no-elite-users"');
    expect(coachPanelSource).toContain("/admin-management");
  });

  it("CoachPanel shows coach override badge when override is active", () => {
    expect(coachPanelSource).toContain("Coach override active");
  });

  it("CoachPanel renders calorie balance chart with recharts", () => {
    expect(coachPanelSource).toContain("BarChart");
    expect(coachPanelSource).toContain("data-coach-calorie-chart");
  });

  it("CoachPanel renders food log table", () => {
    expect(coachPanelSource).toContain('data-coach-food-log-table="true"');
  });

  it("CoachPanel renders workout log table", () => {
    expect(coachPanelSource).toContain('data-coach-workout-log-table="true"');
  });

  it("CoachPanel renders macro override form", () => {
    expect(coachPanelSource).toContain('data-coach-macro-override-form="true"');
  });

  it("CoachPanel renders program override form", () => {
    expect(coachPanelSource).toContain('data-coach-program-override-form="true"');
  });

  it("AdminManagement header includes a link to the Coach Panel", () => {
    expect(adminManagementSource).toContain("/coach-panel");
    expect(adminManagementSource).toContain("Coach panel");
  });
});

describe("coach DB helpers — schema contracts", () => {
  const schemaSource = readFileSync(join(process.cwd(), "drizzle/schema.ts"), "utf8");
  const dbSource = readFileSync(join(process.cwd(), "server/db.ts"), "utf8");

  it("jimmiPrograms schema includes coach macro override columns", () => {
    expect(schemaSource).toContain("coachMacroCalories");
    expect(schemaSource).toContain("coachMacroProtein");
    expect(schemaSource).toContain("coachMacroCarbs");
    expect(schemaSource).toContain("coachMacroFat");
    expect(schemaSource).toContain("coachNotes");
  });

  it("db.ts exports listEliteUsersForCoach", () => {
    expect(dbSource).toContain("export async function listEliteUsersForCoach");
  });

  it("db.ts exports coachOverrideMacros", () => {
    expect(dbSource).toContain("export async function coachOverrideMacros");
  });

  it("db.ts exports coachOverrideProgram", () => {
    expect(dbSource).toContain("export async function coachOverrideProgram");
  });

  it("db.ts exports getCalorieBalanceRange", () => {
    expect(dbSource).toContain("export async function getCalorieBalanceRange");
  });

  it("db.ts exports listFoodLogEntriesForCoach", () => {
    expect(dbSource).toContain("export async function listFoodLogEntriesForCoach");
  });

  it("db.ts exports listExerciseLogEntriesForCoach", () => {
    expect(dbSource).toContain("export async function listExerciseLogEntriesForCoach");
  });

  it("listEliteUsersForCoach filters only elite-tier users", () => {
    expect(dbSource).toContain("=== \"elite\"");
  });
});
