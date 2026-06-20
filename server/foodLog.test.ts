import { describe, expect, it, vi, beforeEach } from "vitest";
import type { TrpcContext } from "./_core/context";

const sampleEntries = [
  {
    id: 11,
    userId: 7,
    logDate: "2026-05-09",
    mealType: "Breakfast",
    foodName: "Greek yogurt bowl",
    calories: 420,
    protein: 38,
    carbs: 45,
    fat: 9,
    notes: "Added berries",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 12,
    userId: 7,
    logDate: "2026-05-09",
    mealType: "Lunch",
    foodName: "Chicken rice plate",
    calories: 640,
    protein: 52,
    carbs: 62,
    fat: 18,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

vi.mock("./db", () => ({
  getJimmiProfile: vi.fn(async () => null),
  markJimmiTourSeen: vi.fn(),
  upsertJimmiProfile: vi.fn(),
  updateJimmiProfileAvatar: vi.fn(),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getUserById: vi.fn(),
  usersDueForReminder: vi.fn(async () => []),
  listFoodLogEntries: vi.fn(async () => sampleEntries),
  createFoodLogEntry: vi.fn(async (entry: any) => [{ id: 99, ...entry, createdAt: new Date(), updatedAt: new Date() }]),
  updateFoodLogEntry: vi.fn(async (_userId: number, id: number, entry: any) => [{ id, userId: _userId, ...entry, createdAt: new Date(), updatedAt: new Date() }]),
  deleteFoodLogEntry: vi.fn(async () => []),
  getCalorieBalanceForDate: vi.fn(async () => ({
    premiumActive: true,
    wearableConnected: true,
    caloriesIn: 1060,
    activeCaloriesOut: 540,
    restingCaloriesOut: 1640,
    totalCaloriesOut: 2180,
    netCalories: -1120,
    balanceDirection: "deficit",
    sourceProvider: "terra",
    sourceConfidence: "beta",
  })),
  getWearableConnectionState: vi.fn(async () => ({ connected: true, provider: "terra", status: "connected" })),
  getAccountSettings: vi.fn(async () => ({ planTier: "premium", subscriptionStatus: "active", autoRenew: true })),
  listUsersForAdminManagement: vi.fn(async () => []),
  updateUserPlanTier: vi.fn(async (_userId: number, planTier: "standard" | "premium") => ({ planTier, subscriptionStatus: planTier === "premium" ? "active" : "trial", autoRenew: planTier === "premium" })),
  setBetaWearableConnection: vi.fn(async (_userId: number, connected: boolean) => ({ connected, provider: "terra", status: connected ? "connected" : "disconnected" })),
  resetUserOnboardingState: vi.fn(async () => {}),
  resetUserProgramGeneration: vi.fn(async () => {}),
  deleteUserAccountData: vi.fn(async () => {}),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async () => ({ choices: [{ message: { content: "Fuel your day with protein and steady movement." } }] })),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(async () => ({ key: "avatars/user-7/profile.png", url: "/manus-storage/avatars/user-7/profile.png" })),
}));

import { createFoodLogEntry, deleteFoodLogEntry, getCalorieBalanceForDate, listFoodLogEntries, updateFoodLogEntry } from "./db";
import { appRouter } from "./routers";

const authedUser = {
  id: 7,
  openId: "owner-open-id",
  name: "Alex",
  email: "alex@example.com",
  loginMethod: "oauth",
  role: "user" as const,
  createdAt: new Date(),
  updatedAt: new Date(),
  lastSignedIn: new Date(),
};

function createContext(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    req: { secure: true, headers: {}, get: vi.fn() } as any,
    res: { clearCookie: vi.fn() } as any,
    user: null,
    ...overrides,
  };
}

describe("food log procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listFoodLogEntries).mockResolvedValue(sampleEntries as any);
    vi.mocked(createFoodLogEntry).mockImplementation(async (entry: any) => [{ id: 99, ...entry, createdAt: new Date(), updatedAt: new Date() }] as any);
    vi.mocked(updateFoodLogEntry).mockImplementation(async (_userId: number, id: number, entry: any) => [{ id, userId: _userId, ...entry, createdAt: new Date(), updatedAt: new Date() }] as any);
    vi.mocked(deleteFoodLogEntry).mockResolvedValue([] as any);
    vi.mocked(getCalorieBalanceForDate).mockResolvedValue({
      premiumActive: true,
      wearableConnected: true,
      caloriesIn: 1060,
      activeCaloriesOut: 540,
      restingCaloriesOut: 1640,
      totalCaloriesOut: 2180,
      netCalories: -1120,
      balanceDirection: "deficit",
      sourceProvider: "terra",
      sourceConfidence: "beta",
    } as any);
  });

  it("requires authentication for daily food log access", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.foodLog.daily({ logDate: "2026-05-09" })).rejects.toThrow("Please login");
  });

  it("returns daily entries with macro totals for the signed-in user", async () => {
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    const result = await caller.foodLog.daily({ logDate: "2026-05-09" });

    expect(listFoodLogEntries).toHaveBeenCalledWith(7, "2026-05-09");
    expect(result.entries).toHaveLength(2);
    expect(result.totals).toEqual({ calories: 1060, protein: 90, carbs: 107, fat: 27 });
  });

  it("validates and creates a meal entry with the signed-in user id", async () => {
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    const result = await caller.foodLog.add({
      logDate: "2026-05-09",
      mealType: "Dinner",
      foodName: "Salmon recovery plate",
      calories: 710,
      protein: 58,
      carbs: 54,
      fat: 28,
      notes: "Post-lift meal",
    });

    expect(createFoodLogEntry).toHaveBeenCalledWith(expect.objectContaining({
      userId: 7,
      logDate: "2026-05-09",
      mealType: "Dinner",
      foodName: "Salmon recovery plate",
      calories: 710,
      protein: 58,
      carbs: 54,
      fat: 28,
      notes: "Post-lift meal",
    }));
    expect(result.entries[0]).toMatchObject({ id: 99, mealType: "Dinner", foodName: "Salmon recovery plate" });
  });

  it("updates an existing meal entry for the signed-in user", async () => {
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    const result = await caller.foodLog.update({
      id: 11,
      logDate: "2026-05-09",
      mealType: "Breakfast",
      foodName: "Greek yogurt bowl with oats",
      calories: 510,
      protein: 44,
      carbs: 58,
      fat: 11,
      notes: "Adjusted serving size",
    });

    expect(updateFoodLogEntry).toHaveBeenCalledWith(7, 11, expect.objectContaining({
      logDate: "2026-05-09",
      mealType: "Breakfast",
      foodName: "Greek yogurt bowl with oats",
      calories: 510,
      protein: 44,
      carbs: 58,
      fat: 11,
      notes: "Adjusted serving size",
    }));
    expect(result.entries[0]).toMatchObject({ id: 11, foodName: "Greek yogurt bowl with oats", calories: 510 });
  });

  it("rejects invalid dates and unsupported meal types before creating entries", async () => {
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    await expect(caller.foodLog.add({
      logDate: "05/09/2026",
      mealType: "Brunch" as any,
      foodName: "Protein smoothie",
      calories: 300,
      protein: 30,
      carbs: 24,
      fat: 8,
      notes: null,
    })).rejects.toThrow();

    expect(createFoodLogEntry).not.toHaveBeenCalled();
  });

  it("deletes only the signed-in user entry and returns the refreshed selected day", async () => {
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    await caller.foodLog.delete({ id: 11, logDate: "2026-05-09" });

    expect(deleteFoodLogEntry).toHaveBeenCalledWith(7, 11);
    expect(listFoodLogEntries).toHaveBeenCalledWith(7, "2026-05-09");
  });

  it("returns premium wearable calorie balance for the signed-in user", async () => {
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    const result = await caller.foodLog.calorieBalance({ logDate: "2026-05-09" });

    expect(getCalorieBalanceForDate).toHaveBeenCalledWith(7, "2026-05-09");
    expect(result).toMatchObject({
      premiumActive: true,
      wearableConnected: true,
      caloriesIn: 1060,
      activeCaloriesOut: 540,
      totalCaloriesOut: 2180,
      netCalories: -1120,
      balanceDirection: "deficit",
      sourceProvider: "terra",
    });
  });

  it("requires authentication for calorie balance access", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.foodLog.calorieBalance({ logDate: "2026-05-09" })).rejects.toThrow("Please login");
    expect(getCalorieBalanceForDate).not.toHaveBeenCalled();
  });
});
