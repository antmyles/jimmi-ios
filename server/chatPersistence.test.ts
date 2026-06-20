import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import type { TrpcContext } from "./_core/context";

const sampleChatMessages = [
  { id: 1, userId: 7, role: "user" as const, content: "What should I train today?", createdAt: new Date("2026-05-11T13:00:00.000Z") },
  { id: 2, userId: 7, role: "assistant" as const, content: "Start with a controlled full-body session.", createdAt: new Date("2026-05-11T13:00:02.000Z") },
];

vi.mock("./db", () => ({
  createChatMessage: vi.fn(async (userId: number, input: { role: "user" | "assistant"; content: string }) => ({ id: 99, userId, ...input, createdAt: new Date("2026-05-11T14:00:00.000Z") })),
  listChatMessages: vi.fn(async () => sampleChatMessages),
  deleteExpiredChatMessages: vi.fn(async () => ({ deleted: 4, cutoff: new Date("2026-05-04T14:00:00.000Z") })),
  createExerciseLogEntry: vi.fn(),
  createFoodLogEntry: vi.fn(),
  deleteFoodLogEntry: vi.fn(),
  deleteUserAccountData: vi.fn(),
  getAccountSettings: vi.fn(async () => ({ planTier: "premium", subscriptionStatus: "active", autoRenew: true })),
  getCalorieBalanceForDate: vi.fn(),
  getJimmiProfile: vi.fn(async () => ({ firstName: "Alex", fitnessGoals: "strength", activityLevel: "moderate", fitnessLevel: "intermediate", dietRestrictions: "none", dietaryPreferences: "balanced", foodAllergies: "none", healthComplications: "none" })),
  getJimmiProgram: vi.fn(),
  getProgramGenerationQuota: vi.fn(),
  getUserById: vi.fn(),
  getWearableConnectionState: vi.fn(),
  listExerciseLogEntries: vi.fn(),
  listFoodLogEntries: vi.fn(),
  listUsersForAdminManagement: vi.fn(async () => []),
  markJimmiTourSeen: vi.fn(),
  recordProgramGeneration: vi.fn(),
  resetUserOnboardingState: vi.fn(),
  resetUserProgramGeneration: vi.fn(),
  setBetaWearableConnection: vi.fn(),
  updateAccountSettings: vi.fn(),
  updateFoodLogEntry: vi.fn(),
  updateJimmiProfileAvatar: vi.fn(),
  updateJimmiProgramGroceryList: vi.fn(),
  updateUserPlanTier: vi.fn(),
  upsertJimmiProfile: vi.fn(),
  upsertJimmiProgram: vi.fn(),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  usersDueForReminder: vi.fn(async () => []),
  countTodayUserChatMessages: vi.fn(async () => 0),
  listEliteUsersForCoach: vi.fn(async () => []),
  getCalorieBalanceRange: vi.fn(async () => []),
  listFoodLogEntriesForCoach: vi.fn(async () => []),
  listExerciseLogEntriesForCoach: vi.fn(async () => []),
  coachOverrideMacros: vi.fn(async () => null),
  coachOverrideProgram: vi.fn(async () => null),
}));

vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(async () => ({ choices: [{ message: { content: "Keep it concise and focus on form today." } }] })),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(async () => ({ key: "avatars/user-7/profile.png", url: "/manus-storage/avatars/user-7/profile.png" })),
}));

vi.mock("./restaurantNutrition", () => ({
  estimateRestaurantMacros: vi.fn(),
}));

import { chatMessages } from "../drizzle/schema";
import { createChatMessage, deleteExpiredChatMessages, listChatMessages } from "./db";
import { invokeLLM } from "./_core/llm";
import { appRouter, buildConciseVoiceSummary, _resetChatSendRateLimiter } from "./routers";
import { cleanupExpiredChats } from "./scheduled";

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

describe("chat persistence procedures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetChatSendRateLimiter();
    vi.mocked(listChatMessages).mockResolvedValue(sampleChatMessages as any);
    vi.mocked(createChatMessage).mockImplementation(async (userId: number, input: any) => ({ id: 99, userId, ...input, createdAt: new Date("2026-05-11T14:00:00.000Z") }) as any);
    vi.mocked(deleteExpiredChatMessages).mockResolvedValue({ deleted: 4, cutoff: new Date("2026-05-04T14:00:00.000Z") } as any);
  });

  it("requires authentication before returning saved chat history", async () => {
    const caller = appRouter.createCaller(createContext());

    await expect(caller.chat.history()).rejects.toThrow("Please login");
  });

  it("returns the signed-in user's saved chat history with the seven-day retention metadata", async () => {
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    const result = await caller.chat.history();

    expect(listChatMessages).toHaveBeenCalledWith(7);
    expect(result.retentionDays).toBe(7);
    expect(result.messages).toEqual(sampleChatMessages);
  });

  it("maps saved chat message role values to the live role column", () => {
    expect((chatMessages.role as any).name).toBe("role");
  });

  it("saves a single signed-in chat message with user ownership", async () => {
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    const result = await caller.chat.saveMessage({ role: "assistant", content: "Recover hard, then train again tomorrow." });

    expect(createChatMessage).toHaveBeenCalledWith(7, { role: "assistant", content: "Recover hard, then train again tomorrow." });
    expect(result.retentionDays).toBe(7);
    expect(result.message).toMatchObject({ userId: 7, role: "assistant" });
  });

  it("persists user and assistant turns created by chat.send", async () => {
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    const result = await caller.chat.send({ messages: [{ role: "user", content: "What should I train today?" }] });

    expect(createChatMessage).toHaveBeenNthCalledWith(1, 7, { role: "user", content: "What should I train today?" });
    expect(createChatMessage).toHaveBeenNthCalledWith(2, 7, { role: "assistant", content: result.content });
  });

  it.each([
    "Nothing. Thank you.",
    "Nothing at the moment, thank you.",
    "Nothing at the moment thank you",
    "Nothing for now, thanks.",
    "Nothing today, thank you.",
    "Right now. Thank you.",
    "No thank you",
    "No, that's it.",
  ])("treats polite no-help decline '%s' as an idle acknowledgement", async (declineText) => {
    const caller = appRouter.createCaller(createContext({ user: authedUser }));

    const result = await caller.chat.send({ messages: [{ role: "user", content: declineText }] });

    expect(result.content).toBe("You got it, Alex. I’ll be here when you’re ready.");
    expect(result.content).not.toContain("what would you like to work on next");
    expect(result.content).not.toContain("?");
    expect(invokeLLM).not.toHaveBeenCalled();
    expect(createChatMessage).toHaveBeenNthCalledWith(1, 7, { role: "user", content: declineText });
    expect(createChatMessage).toHaveBeenNthCalledWith(2, 7, { role: "assistant", content: result.content });
  });

  it("does not append a spoken follow-up question to declined follow-up idle acknowledgements", () => {
    const spoken = buildConciseVoiceSummary("You got it, Alex. I’ll be here when you’re ready.");

    expect(spoken).toBe("You got it, Alex. I’ll be here when you’re ready.");
    expect(spoken).not.toContain("Is there anything else I can help you with?");
    expect(spoken).not.toContain("?");
  });

  it("keeps PDF workout program import wired from scanProgramFile through My Program persistence", () => {
    const routerSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");

    expect(routerSource).toContain('input.mimeType === "application/pdf"');
    expect(routerSource).toContain('file_url: { url: input.fileDataUrl, mime_type: "application/pdf" as const }');
    expect(routerSource).toContain('normalizeImportedProgramPlan(llmResponse.choices[0]?.message.content, macros, input.fileName)');
    expect(routerSource).toContain('upsertJimmiProgram(ctx.user.id');
    expect(routerSource).toContain('planJson: JSON.stringify(importedPlan)');
    expect(routerSource).toContain('exportText: buildImportedProgramExport(importedPlan)');
    expect(routerSource).toContain('imported: true as const');
    expect(routerSource).toContain('importMessage: "JIMMI imported this PDF into My Program."');
    expect(routerSource).toContain('route: "/my-program"');
    expect(routerSource).toContain('trainingDayCount: importedPlan.trainingPlan.length');
  });

  it("renders imported PDF program confirmation and My Program navigation in chat", () => {
    const chatSource = readFileSync(new URL("../client/src/pages/Chat.tsx", import.meta.url), "utf8");

    expect(chatSource).toContain("imported?: boolean;");
    expect(chatSource).toContain("importMessage?: string;");
    expect(chatSource).toContain("importedProgram?: {");
    expect(chatSource).toContain("programScanResult: result");
    expect(chatSource).toContain('data-chat-inline-program-import-card="pdf-imported-my-program"');
    expect(chatSource).toContain('data-chat-program-import-message="my-program-confirmation"');
    expect(chatSource).toContain('JIMMI imported this PDF into My Program.');
    expect(chatSource).toContain('data-chat-program-import-view-my-program="true"');
    expect(chatSource).toContain('View My Program');
    expect(chatSource).toContain('href={message.programScanResult.importedProgram?.route ?? "/my-program"}');
  });

  it("deletes expired chat messages from the scheduled cleanup endpoint", async () => {
    const statusMock = vi.fn().mockReturnThis();
    const jsonMock = vi.fn();
    const req = { headers: {}, originalUrl: "/api/scheduled/cleanup-expired-chats" } as any;
    const res = { status: statusMock, json: jsonMock } as any;

    await cleanupExpiredChats(req, res);

    expect(deleteExpiredChatMessages).toHaveBeenCalledTimes(1);
    expect(statusMock).not.toHaveBeenCalled();
    expect(jsonMock).toHaveBeenCalledWith(expect.objectContaining({ success: true, deleted: 4, retentionDays: 7 }));
  });
});
