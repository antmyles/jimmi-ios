import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const baseProfile = {
  id: 1,
  userId: 7,
  firstName: "Alex",
  birthday: "1990-01-01",
  gender: "Male",
  weight: 180,
  targetWeight: null,
  height: "5 ft 10 in",
  healthComplications: "None",
  dietRestrictions: "None",
  foodAllergies: "None",
  fitnessLevel: "Intermediate",
  activityLevel: "Moderate",
  fitnessGoals: "Build muscle",
  additionalInfo: null,
  tourSeen: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const generatedPlan = {
  title: "JIMMI Strength Foundation",
  overview: "A focused starter plan for strength and consistency.",
  programDuration: "4 weeks",
  durationRationale: "Four weeks gives enough time to establish baseline strength and recovery habits.",
  phaseSummary: [{ phase: "Foundation", focus: "Technique and consistency", weeks: "Weeks 1-4" }],
  progressTracking: [{ checkpoint: "Weekly", action: "Log workouts", metric: "Completed sessions" }],
  trainingPlan: [{
    day: "Day 1",
    focus: "Full body strength",
    warmup: "5 minutes of brisk walking",
    exercises: [{ key: "squat", name: "Goblet Squat", sets: 3, reps: "8-10", rest: "60 seconds", cues: "Brace and control the descent.", youtubeUrl: "https://www.youtube.com/results?search_query=goblet+squat+demo" }],
  }],
  mealPlan: {
    macroTargets: { calories: 2200, protein: 160, carbs: 220, fat: 70 },
    days: [{ day: "Day 1", meals: [{ mealType: "Breakfast", name: "Protein oats", ingredients: ["oats", "protein"], calories: 450, protein: 35, carbs: 55, fat: 10, notes: "Simple high-protein breakfast." }] }],
  },
};

vi.mock("./db", () => ({
  getJimmiProfile: vi.fn(async () => null),
  markJimmiTourSeen: vi.fn(async () => baseProfile),
  upsertJimmiProfile: vi.fn(async (_userId: number, input: any) => ({
    ...baseProfile,
    ...input,
  })),
  updateJimmiProfileAvatar: vi.fn(async (_userId: number, avatarUrl: string) => ({
    ...baseProfile,
    avatarUrl,
  })),
  getJimmiProgram: vi.fn(async () => null),
  upsertJimmiProgram: vi.fn(async (userId: number, input: any) => ({
    id: 99,
    userId,
    ...input,
    createdAt: new Date(),
    updatedAt: new Date(),
  })),
  updateJimmiProgramGroceryList: vi.fn(async () => null),
  listExerciseLogEntries: vi.fn(async () => []),
  createExerciseLogEntry: vi.fn(async () => []),
  getProgramGenerationQuota: vi.fn(async () => ({ limit: 2, used: 0, remaining: 2, daysRemaining: 30, cycleStartedAt: null, cycleEndsAt: null })),
  recordProgramGeneration: vi.fn(async () => undefined),
  resetUserProgramGeneration: vi.fn(async () => ({ programsDeleted: 0, quotaEventsDeleted: 0 })),
  resetUserOnboardingState: vi.fn(async () => ({ profilesDeleted: 0 })),
  listUsersForAdminManagement: vi.fn(async () => []),
  updateUserPlanTier: vi.fn(async (_userId: number, planTier: "standard" | "premium") => ({ planTier, subscriptionStatus: planTier === "premium" ? "active" : "trial", autoRenew: planTier === "premium" })),
  setBetaWearableConnection: vi.fn(async (_userId: number, connected: boolean) => ({ connected, provider: "terra", status: connected ? "connected" : "disconnected" })),
  getWearableConnectionState: vi.fn(async () => ({ connected: false, provider: null, status: "not_connected" })),
  getCalorieBalanceForDate: vi.fn(async () => ({ premiumActive: false, wearableConnected: false, caloriesIn: 0, activeCaloriesOut: 0, restingCaloriesOut: 0, totalCaloriesOut: 0, netCalories: 0, balanceDirection: "premium_required", sourceProvider: null, sourceConfidence: "none" })),
  createFoodLogEntry: vi.fn(async () => []),
  listFoodLogEntries: vi.fn(async () => []),
  updateFoodLogEntry: vi.fn(async () => []),
  deleteFoodLogEntry: vi.fn(async () => []),
  getAccountSettings: vi.fn(async () => ({})),
  updateAccountSettings: vi.fn(async () => ({})),
  deleteUserAccountData: vi.fn(async () => ({ deleted: true })),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getUserById: vi.fn(),
  usersDueForReminder: vi.fn(async () => []),
  listChatMessages: vi.fn(async () => []),
  createChatMessage: vi.fn(async (_userId: number, input: any) => ({ id: 100, userId: _userId, ...input, createdAt: new Date() })),
  deleteExpiredChatMessages: vi.fn(async () => ({ deleted: 0, cutoff: new Date() })),
  countTodayUserChatMessages: vi.fn(async () => 0),
  listEliteUsersForCoach: vi.fn(async () => []),
  getCalorieBalanceRange: vi.fn(async () => []),
  listFoodLogEntriesForCoach: vi.fn(async () => []),
  listExerciseLogEntriesForCoach: vi.fn(async () => []),
  coachOverrideMacros: vi.fn(async () => null),
  coachOverrideProgram: vi.fn(async () => null),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async () => ({
    choices: [{ message: { content: "Start with two strength sessions and daily walks. Want more detail?" } }],
  })),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(async () => ({ key: "avatars/user-7/profile.png", url: "/manus-storage/avatars/user-7/profile.png" })),
}));

import { invokeLLM } from "./_core/llm";
import { getJimmiProfile, getProgramGenerationQuota, getUserById, recordProgramGeneration, setBetaWearableConnection, updateUserPlanTier, upsertJimmiProfile, updateJimmiProfileAvatar } from "./db";
import { storagePut } from "./storage";
import { appRouter, buildConciseVoiceSummary, _resetChatSendRateLimiter } from "./routers";

function createContext(overrides: Partial<TrpcContext> = {}): TrpcContext {
  return {
    req: { secure: true, headers: {}, get: vi.fn() } as any,
    res: { clearCookie: vi.fn() } as any,
    user: null,
    ...overrides,
  };
}

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

const adminUser = { ...authedUser, id: 1, role: "admin" as const };

describe("clean JIMMI foundation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetChatSendRateLimiter();
    vi.mocked(getJimmiProfile).mockResolvedValue(null as any);
    vi.mocked(upsertJimmiProfile).mockImplementation(async (_userId: number, input: any) => ({
      ...baseProfile,
      ...input,
    }));
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{ message: { content: "Start with two strength sessions and daily walks. Want more detail?" } }],
    } as any);
    vi.mocked(getProgramGenerationQuota).mockResolvedValue({ limit: 2, used: 0, remaining: 2, daysRemaining: 30, cycleStartedAt: null, cycleEndsAt: null } as any);
    vi.mocked(recordProgramGeneration).mockClear();
    vi.mocked(getUserById).mockImplementation(async (id: number) => ({ ...authedUser, id, role: "user" as const }) as any);
    vi.mocked(updateUserPlanTier).mockImplementation(async (_userId: number, planTier: "standard" | "premium") => ({ planTier, subscriptionStatus: planTier === "premium" ? "active" : "trial", autoRenew: planTier === "premium" }) as any);
    vi.mocked(setBetaWearableConnection).mockImplementation(async (_userId: number, connected: boolean) => ({ connected, provider: "terra", status: connected ? "connected" : "disconnected" }) as any);
  });

  it("exposes the public clean rebuild status", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.rebuild.status()).resolves.toMatchObject({
      brand: "JIMMI",
      phase: "onboarding-rebuild",
    });
  });

  it("returns null for unauthenticated auth.me during the landing gate", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.auth.me()).resolves.toBeNull();
  });

  it("lets admins grant premium beta permissions for Terra calorie testing", async () => {
    const caller = appRouter.createCaller(createContext({ user: adminUser }));

    const result = await caller.admin.setPlanTier({ userId: 7, planTier: "pro" });

    expect(getUserById).toHaveBeenCalledWith(7);
    expect(updateUserPlanTier).toHaveBeenCalledWith(7, "pro");
    expect(result).toEqual({ success: true, userId: 7, planTier: "pro" });
  });

  it("lets admins toggle a beta wearable connection state for premium UX testing", async () => {
    const caller = appRouter.createCaller(createContext({ user: adminUser }));

    const result = await caller.admin.setBetaWearableConnection({ userId: 7, connected: true });

    expect(getUserById).toHaveBeenCalledWith(7);
    expect(setBetaWearableConnection).toHaveBeenCalledWith(7, true);
    expect(result).toMatchObject({ success: true, userId: 7, wearable: { connected: true, provider: "terra", status: "connected" } });
  });

  it("blocks standard users from changing beta tester plan tiers", async () => {
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    await expect(caller.admin.setPlanTier({ userId: 7, planTier: "pro" })).rejects.toThrow("required permission");
    expect(updateUserPlanTier).not.toHaveBeenCalled();
  });

  it("rejects incomplete onboarding submissions before saving a profile", async () => {
    const caller = appRouter.createCaller(createContext({ user: authedUser }));
    await expect(
      caller.onboarding.complete({
        firstName: "Alex",
        birthday: "1990-01-01",
        gender: "Non-binary" as any,
        weight: 180,
        height: "5 ft 10 in",
        healthComplications: [],
        dietRestrictions: ["None"],
        foodAllergies: ["None"],
        fitnessLevel: "Intermediate",
        activityLevel: "Moderate",
        fitnessGoals: ["Build muscle"],
        additionalInfo: null,
      }),
    ).rejects.toThrow();
  });

  it("rejects first names shorter than two characters and users younger than 8", async () => {
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    await expect(caller.onboarding.complete({
      firstName: "A",
      birthday: "2010-01-01",
      gender: "Male",
      weight: 180,
      height: "5 ft 10 in",
      healthComplications: ["None"],
      dietRestrictions: ["None"],
      foodAllergies: ["None"],
      fitnessLevel: "Intermediate",
      activityLevel: "Moderate",
      fitnessGoals: ["Build muscle"],
      additionalInfo: null,
    })).rejects.toThrow();

    await expect(caller.onboarding.complete({
      firstName: "Alex",
      birthday: new Date().toISOString().slice(0, 10),
      gender: "Female",
      weight: 180,
      height: "5 ft 10 in",
      healthComplications: ["None"],
      dietRestrictions: ["None"],
      foodAllergies: ["None"],
      fitnessLevel: "Intermediate",
      activityLevel: "Moderate",
      fitnessGoals: ["Build muscle"],
      additionalInfo: null,
    })).rejects.toThrow();
  });

  it("saves complete onboarding and returns computed profile metadata", async () => {
    const caller = appRouter.createCaller(createContext({ user: authedUser }));
    const result = await caller.onboarding.complete({
      firstName: "Alex",
      birthday: "1990-01-01",
      gender: "Male",
      weight: 180,
      height: "5 ft 10 in",
      healthComplications: ["None"],
      dietRestrictions: ["None"],
      foodAllergies: ["None"],
      fitnessLevel: "Intermediate",
      activityLevel: "Moderate",
      fitnessGoals: ["Build muscle", "Improve energy"],
      additionalInfo: "Prefers morning workouts.",
    });

    expect(result).toMatchObject({
      firstName: "Alex",
      onboardingComplete: true,
      fitnessGoals: "Build muscle, Improve energy",
      targetWeight: null,
    });
    expect(result?.age).toBeGreaterThan(30);
  });

  it("requires a lower target weight when losing weight is selected", async () => {
    const caller = appRouter.createCaller(createContext({ user: authedUser }));
    const weightLossInput = {
      firstName: "Alex",
      birthday: "1990-01-01",
      gender: "Female" as const,
      weight: 180,
      height: "5 ft 10 in",
      healthComplications: ["None"],
      dietRestrictions: ["None"],
      foodAllergies: ["None"],
      fitnessLevel: "Intermediate",
      activityLevel: "Moderate",
      fitnessGoals: ["Lose weight"],
      additionalInfo: null,
    };

    await expect(caller.onboarding.complete(weightLossInput)).rejects.toThrow("Target weight is required when losing weight is a goal.");
    await expect(caller.onboarding.complete({ ...weightLossInput, targetWeight: 180 })).rejects.toThrow("Target weight must be less than your current weight.");

    const result = await caller.onboarding.complete({ ...weightLossInput, targetWeight: 160 });

    expect(result).toMatchObject({ targetWeight: 160, fitnessGoals: "Lose weight" });
    expect(upsertJimmiProfile).toHaveBeenLastCalledWith(7, expect.objectContaining({ targetWeight: 160 }));
  });

  it("returns birthday-derived age through the onboarding profile API for backend and profile consumers", async () => {
    vi.mocked(getJimmiProfile).mockResolvedValue({ ...baseProfile, birthday: "2000-05-08" } as any);
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    const result = await caller.onboarding.get();

    expect(result).toMatchObject({ birthday: "2000-05-08", onboardingComplete: true });
    expect(result?.age).toBeGreaterThanOrEqual(25);
    expect(result?.age).toBeLessThanOrEqual(26);
  });

  it("updates an editable profile while preserving one-time chat tour state", async () => {
    vi.mocked(getJimmiProfile).mockResolvedValue(baseProfile as any);
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    const result = await caller.onboarding.updateProfile({
      firstName: "Alexis",
      birthday: "1990-01-01",
      gender: "Male",
      weight: 178,
      targetWeight: 165,
      height: "5 ft 10 in",
      healthComplications: ["None"],
      dietRestrictions: ["High protein"],
      foodAllergies: ["None"],
      fitnessLevel: "Advanced",
      activityLevel: "High",
      fitnessGoals: ["Lose weight", "Run faster"],
      additionalInfo: "Prefers evening sessions.",
    });

    expect(result).toMatchObject({ firstName: "Alexis", tourSeen: true, onboardingComplete: true });
    expect(upsertJimmiProfile).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        tourSeen: true,
        dietRestrictions: "High protein",
        fitnessGoals: "Lose weight, Run faster",
        targetWeight: 165,
      }),
    );
  });

  it("persists serialized Other food allergy and health complication details through editable profile updates", async () => {
    vi.mocked(getJimmiProfile).mockResolvedValue({ ...baseProfile, tourSeen: true } as any);
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    await caller.onboarding.updateProfile({
      firstName: "Alex",
      birthday: "1990-01-01",
      gender: "Male",
      weight: 180,
      targetWeight: 150,
      height: "5 ft 10 in",
      healthComplications: ["Asthma", "Other: migraines"],
      dietRestrictions: ["None"],
      foodAllergies: ["Dairy", "Other: pineapple"],
      fitnessLevel: "Intermediate",
      activityLevel: "Moderate",
      fitnessGoals: ["Build muscle"],
      additionalInfo: null,
    });

    expect(upsertJimmiProfile).toHaveBeenCalledWith(
      7,
      expect.objectContaining({
        healthComplications: "Asthma, Other: migraines",
        foodAllergies: "Dairy, Other: pineapple",
        targetWeight: null,
        tourSeen: true,
      }),
    );
  });

  it("uploads and persists a profile avatar image", async () => {
    const caller = appRouter.createCaller(createContext({ user: authedUser }));
    const result = await caller.onboarding.updateAvatar({ imageDataUrl: "data:image/png;base64,aGVsbG8=" });

    expect(storagePut).toHaveBeenCalledWith("avatars/user-7/profile.png", expect.any(Buffer), "image/png");
    expect(updateJimmiProfileAvatar).toHaveBeenCalledWith(7, "/manus-storage/avatars/user-7/profile.png");
    expect(result).toMatchObject({ avatarUrl: "/manus-storage/avatars/user-7/profile.png", onboardingComplete: true });
  });

  it("lets Claude handle scope boundaries naturally instead of using a hard gate", async () => {
    vi.mocked(getJimmiProfile).mockResolvedValue(baseProfile as any);
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{
        message: {
          content: "I'm here to help with fitness and wellness — that's where I shine. What can I help you with on your fitness journey?"
        }
      }]
    } as any);
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    const result = await caller.chat.send({ messages: [{ role: "user", content: "Who won the film awards last night?" }] });

    // Claude should be called to handle the out-of-scope request naturally
    expect(invokeLLM).toHaveBeenCalled();
    expect(result.content).toContain("fitness and wellness");
  });

  it("answers gratitude-only messages with a warm acknowledgement instead of generic scope copy", async () => {
    vi.mocked(getJimmiProfile).mockResolvedValue(baseProfile as any);
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    const thanks = await caller.chat.send({ messages: [{ role: "user", content: "Thanks." }] });
    _resetChatSendRateLimiter();
    const thanksJimmi = await caller.chat.send({ messages: [{ role: "user", content: "Thanks, Jimmi." }] });
    _resetChatSendRateLimiter();
    const appreciateIt = await caller.chat.send({ messages: [{ role: "user", content: "Appreciate it coach" }] });

    expect(thanks.content).toBe("You’re welcome, Alex. Let me know if there’s anything else I can do to help.");
    expect(thanksJimmi.content).toBe("You’re welcome, Alex. Let me know if there’s anything else I can do to help.");
    expect(appreciateIt.content).toBe("You’re welcome, Alex. Let me know if there’s anything else I can do to help.");
    expect(invokeLLM).not.toHaveBeenCalled();
    expect(thanks.content).not.toContain("I’m here for your fitness, wellness, recovery, and nutrition work");
    expect(thanksJimmi.content).not.toContain("Ask me about training, meals, macros, sleep, hydration, or your onboarding goals");
  });

  it("does not duplicate equivalent help closers in spoken gratitude acknowledgements", () => {
    const spoken = buildConciseVoiceSummary("You’re welcome, Alex. Let me know if there’s anything else I can do to help.");

    expect(spoken).toBe("You’re welcome, Alex. Let me know if there’s anything else I can do to help.");
    expect(spoken).not.toContain("Let me know if there’s anything else I can do to help. Is there anything else I can help you with?");
    expect(spoken.match(/anything else/gi)).toHaveLength(1);
    expect(spoken.match(/help/gi)).toHaveLength(1);
  });

  it("answers a casual greeting with a deterministic personalized coaching welcome", async () => {
    vi.mocked(getJimmiProfile).mockResolvedValue(baseProfile as any);
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    const result = await caller.chat.send({ messages: [{ role: "user", content: "Hi JIMMI" }] });

    expect(result.content).toBe("Hi, Alex. I’m here to help you achieve your fitness goals. What can I do for you today?");
    expect(invokeLLM).not.toHaveBeenCalled();
    expect(result.content).not.toContain("only help with fitness");
    expect(result.content).not.toContain("Fitness goals");
    expect(result.content).not.toContain("Activity level");
  });

  it("mirrors time-of-day greetings with the user's first name", async () => {
    vi.mocked(getJimmiProfile).mockResolvedValue(baseProfile as any);
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    const result = await caller.chat.send({ messages: [{ role: "user", content: "Good morning JIMMI" }] });

    expect(result.content).toBe("Good morning, Alex. I’m here to help you achieve your fitness goals. What can I do for you today?");
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("normalizes compact and misspelled time-of-day greetings before mirroring them", async () => {
    vi.mocked(getJimmiProfile).mockResolvedValue(baseProfile as any);
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    const morning = await caller.chat.send({ messages: [{ role: "user", content: "Goodmorning Jimmi" }] });
    _resetChatSendRateLimiter();
    const misspelledMorning = await caller.chat.send({ messages: [{ role: "user", content: "goodmornin jimi" }] });
    _resetChatSendRateLimiter();
    const afternoon = await caller.chat.send({ messages: [{ role: "user", content: "goodafternon" }] });
    _resetChatSendRateLimiter();
    const evening = await caller.chat.send({ messages: [{ role: "user", content: "goodevenin coach" }] });

    expect(morning.content).toBe("Good morning, Alex. I’m here to help you achieve your fitness goals. What can I do for you today?");
    expect(misspelledMorning.content).toBe("Good morning, Alex. I’m here to help you achieve your fitness goals. What can I do for you today?");
    expect(afternoon.content).toBe("Good afternoon, Alex. I’m here to help you achieve your fitness goals. What can I do for you today?");
    expect(evening.content).toBe("Good evening, Alex. I’m here to help you achieve your fitness goals. What can I do for you today?");
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("sifts common fitness typos into coaching responses instead of off-topic redirects", async () => {
    vi.mocked(getJimmiProfile).mockResolvedValue(baseProfile as any);
    vi.mocked(invokeLLM).mockClear();
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    const result = await caller.chat.send({ messages: [{ role: "user", content: "How much protien after my workot for recovry?" }] });

    expect(result.content).toBe("Start with two strength sessions and daily walks. Want more detail?");
    expect(invokeLLM).toHaveBeenCalledOnce();
    expect(result.content).not.toContain("I’m here for your fitness, wellness, recovery, and nutrition work");
    expect(result.content).not.toContain("Ask me about training, meals, macros, sleep, hydration, or your onboarding goals");
  });

  it("answers low-content check-ins with a warm fitness-journey redirect", async () => {
    vi.mocked(getJimmiProfile).mockResolvedValue(baseProfile as any);
    vi.mocked(invokeLLM).mockClear();
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    const result = await caller.chat.send({ messages: [{ role: "user", content: "testing" }] });

    expect(result.content).toBe("All good, Alex. I’m here when you’re ready — training, meals, recovery, or anything else you want to work through.");
    expect(invokeLLM).not.toHaveBeenCalled();
    expect(result.content).not.toContain("only help with fitness");
    expect(result.content).not.toContain("Is there anything else I can help you with?");
    expect(result.content).not.toContain("how else I can assist you");
  });

  it("embeds a YouTube exercise demo and asks if the user wants a written explanation for trigger phrases", async () => {
    vi.mocked(getJimmiProfile).mockResolvedValue(baseProfile as any);
    vi.mocked(invokeLLM).mockClear();
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    const result = await caller.chat.send({ messages: [{ role: "user", content: "Can you show me how to do a push up?" }] });

    expect(result.content).toBe("Here’s a video demo for **Push Up**. Would you like a written explanation as well?");
    expect(result.videoEmbed).toMatchObject({
      provider: "youtube",
      exerciseName: "Push Up",
      title: "Push Up demo",
      embedUrl: "https://www.youtube.com/embed/IODxDxX7oi4?rel=0&modestbranding=1",
      watchUrl: "https://www.youtube.com/watch?v=IODxDxX7oi4",
    });
    expect(invokeLLM).not.toHaveBeenCalled();
  });

  it("blocks program generation when the 30-day two-program cycle is exhausted before invoking the LLM", async () => {
    vi.mocked(getJimmiProfile).mockResolvedValue(baseProfile as any);
    vi.mocked(getProgramGenerationQuota).mockResolvedValue({ limit: 2, used: 2, remaining: 0, daysRemaining: 12, cycleStartedAt: Date.now() - 18 * 24 * 60 * 60 * 1000, cycleEndsAt: Date.now() + 12 * 24 * 60 * 60 * 1000 } as any);
    vi.mocked(invokeLLM).mockClear();
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    await expect(caller.myProgram.generate({ programFocus: "Build strength" })).rejects.toThrow("You have used both program generations for this 30-day cycle. 12 days remaining before your limit resets.");
    expect(invokeLLM).not.toHaveBeenCalled();
    expect(recordProgramGeneration).not.toHaveBeenCalled();
  });

  it("records a quota event and returns updated remaining generations after creating a program", async () => {
    vi.mocked(getJimmiProfile).mockResolvedValue(baseProfile as any);
    vi.mocked(getProgramGenerationQuota)
      .mockResolvedValueOnce({ limit: 2, used: 1, remaining: 1, daysRemaining: 20, cycleStartedAt: Date.now() - 10 * 24 * 60 * 60 * 1000, cycleEndsAt: Date.now() + 20 * 24 * 60 * 60 * 1000 } as any)
      .mockResolvedValueOnce({ limit: 2, used: 2, remaining: 0, daysRemaining: 20, cycleStartedAt: Date.now() - 10 * 24 * 60 * 60 * 1000, cycleEndsAt: Date.now() + 20 * 24 * 60 * 60 * 1000 } as any);
    vi.mocked(invokeLLM).mockResolvedValue({ choices: [{ message: { content: JSON.stringify(generatedPlan) } }] } as any);
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    const result = await caller.myProgram.generate({ programFocus: "Build strength" });

    expect(recordProgramGeneration).toHaveBeenCalledWith(7);
    expect(result.generationQuota).toMatchObject({ limit: 2, used: 2, remaining: 0, daysRemaining: 20 });
    expect(result.program?.plan.title).toBe("JIMMI Strength Foundation");
  });

  it("personalizes allowed medical-adjacent chat and prefixes the physician disclaimer", async () => {
    vi.mocked(getJimmiProfile).mockResolvedValue({ ...baseProfile, healthComplications: "Knee pain" } as any);
    vi.mocked(invokeLLM).mockResolvedValue({
      choices: [{ message: { content: "Reduce jumping volume and choose low-impact strength work. Want more detail?" } }],
    } as any);
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    const result = await caller.chat.send({ messages: [{ role: "user", content: "How should I train with knee pain?" }] });

    expect(result.content).toMatch(/^JIMMI is not a medical professional — consult your physician\./);
    expect(invokeLLM).toHaveBeenCalledWith(expect.objectContaining({ messages: expect.arrayContaining([expect.objectContaining({ content: expect.stringContaining("First name: Alex") })]) }));
  });

  it("includes serialized food allergies and health complications in the personalized LLM context", async () => {
    vi.mocked(getJimmiProfile).mockResolvedValue({ ...baseProfile, healthComplications: "Asthma, Other: migraines", foodAllergies: "Peanuts, Other: strawberries" } as any);
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    await caller.chat.send({ messages: [{ role: "user", content: "What should I eat after training with my allergies and migraines?" }] });

    expect(invokeLLM).toHaveBeenCalledWith(expect.objectContaining({ messages: expect.arrayContaining([expect.objectContaining({ content: expect.stringContaining("Food allergies: Peanuts, Other: strawberries") })]) }));
    expect(invokeLLM).toHaveBeenCalledWith(expect.objectContaining({ messages: expect.arrayContaining([expect.objectContaining({ content: expect.stringContaining("Health complications: Asthma, Other: migraines") })]) }));
  });
});
