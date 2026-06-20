import { and, asc, desc, eq, gte, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { accountSettings, calorieOutSummaries, chatMessages, exerciseLogEntries, foodLogEntries, InsertAccountSettings, InsertCalorieOutSummary, InsertChatMessage, InsertExerciseLogEntry, InsertFoodLogEntry, InsertJimmiProfile, InsertJimmiProgram, InsertUser, InsertWearableConnection, jimmiProfiles, jimmiPrograms, programGenerationEvents, stripeCustomers, stripeSubscriptions, InsertStripeCustomer, InsertStripeSubscription, stripeInvoices, InsertStripeInvoice, users, wearableConnections } from "../drizzle/schema";
import { ENV } from "./_core/env";

// Stripe helper functions
export async function getOrCreateStripeCustomer(userId: number, stripeCustomerId: string) {
  const db = await getDb();
  if (!db) return undefined;
  
  const existing = await db.select().from(stripeCustomers).where(eq(stripeCustomers.userId, userId)).limit(1);
  if (existing.length > 0) return existing[0];
  
  await db.insert(stripeCustomers).values({ userId, stripeCustomerId });
  return { id: 0, userId, stripeCustomerId, createdAt: new Date() };
}

export async function getStripeCustomerByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(stripeCustomers).where(eq(stripeCustomers.userId, userId)).limit(1);
  return result[0];
}

export async function createStripeSubscription(data: InsertStripeSubscription) {
  const db = await getDb();
  if (!db) return undefined;
  
  await db.insert(stripeSubscriptions).values(data);
  return data;
}

export async function getStripeSubscriptionByUserId(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(stripeSubscriptions).where(eq(stripeSubscriptions.userId, userId)).limit(1);
  return result[0];
}

export async function updateStripeSubscription(stripeSubscriptionId: string, data: Partial<InsertStripeSubscription>) {
  const db = await getDb();
  if (!db) return;
  
  await db.update(stripeSubscriptions)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(stripeSubscriptions.stripeSubscriptionId, stripeSubscriptionId));
}

export async function createStripeInvoice(data: InsertStripeInvoice) {
  const db = await getDb();
  if (!db) return undefined;
  
  await db.insert(stripeInvoices).values(data);
  return data;
}

export async function getStripeInvoicesByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const result = await db.select().from(stripeInvoices)
    .where(eq(stripeInvoices.userId, userId))
    .orderBy(desc(stripeInvoices.createdAt));
  return result;
}

export async function getStripeInvoiceById(invoiceId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(stripeInvoices)
    .where(eq(stripeInvoices.stripeInvoiceId, invoiceId))
    .limit(1);
  return result[0];
}

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");

  const db = await getDb();
  if (!db) return;

  const shouldPromoteOwner = user.openId === ENV.ownerOpenId;
  const values: InsertUser = {
    openId: user.openId,
    name: user.name ?? null,
    email: user.email ?? null,
    loginMethod: user.loginMethod ?? null,
    role: shouldPromoteOwner ? "admin" : user.role ?? "user",
    lastSignedIn: user.lastSignedIn ?? new Date(),
  };

  const duplicateSet: Partial<InsertUser> & { updatedAt: Date } = {
    lastSignedIn: new Date(),
    updatedAt: new Date(),
  };

  if (user.name !== undefined) duplicateSet.name = values.name;
  if (user.email !== undefined) duplicateSet.email = values.email;
  if (user.loginMethod !== undefined) duplicateSet.loginMethod = values.loginMethod;
  if (shouldPromoteOwner || user.role !== undefined) duplicateSet.role = values.role;

  await db.insert(users).values(values).onDuplicateKeyUpdate({
    set: duplicateSet,
  });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function getUserByGoogleId(googleId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
  return result[0];
}

export async function updateUserPasswordHash(userId: number, passwordHash: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function updateUserGoogleId(userId: number, googleId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ googleId, emailVerified: true, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function setEmailVerified(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ emailVerified: true, updatedAt: new Date() }).where(eq(users.id, userId));
}

export async function getUserById(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return result[0];
}

export async function updateUserRole(userId: number, role: "admin" | "user") {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId));
  return getUserById(userId);
}

export async function updateUserTier(userId: number, tier: "free" | "core" | "pro" | "elite") {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(users).set({ tier, updatedAt: new Date() }).where(eq(users.id, userId));
  return getUserById(userId);
}

export async function listAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id,
    openId: users.openId,
    name: users.name,
    email: users.email,
    role: users.role,
    tier: users.tier,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(users.createdAt);
}

export async function getJimmiProfile(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(jimmiProfiles).where(eq(jimmiProfiles.userId, userId)).limit(1);
  return result[0];
}

export async function upsertJimmiProfile(userId: number, input: Omit<InsertJimmiProfile, "userId">) {
  const db = await getDb();
  if (!db) return undefined;

  const values: InsertJimmiProfile = {
    ...input,
    userId,
    dietaryPreferences: input.dietaryPreferences ?? null,
    additionalInfo: input.additionalInfo ?? null,
    tourSeen: input.tourSeen ?? false,
  };

  await db.insert(jimmiProfiles).values(values).onDuplicateKeyUpdate({
    set: {
      firstName: values.firstName,
      birthday: values.birthday,
      gender: values.gender,
      weight: values.weight,
      targetWeight: values.targetWeight ?? null,
      height: values.height,
      healthComplications: values.healthComplications,
      dietRestrictions: values.dietRestrictions,
      dietaryPreferences: values.dietaryPreferences ?? null,
      foodAllergies: values.foodAllergies,
      fitnessLevel: values.fitnessLevel,
      activityLevel: values.activityLevel,
      fitnessGoals: values.fitnessGoals,
      additionalInfo: values.additionalInfo,
      avatarUrl: values.avatarUrl ?? null,
      updatedAt: new Date(),
    },
  });

  return getJimmiProfile(userId);
}

export async function updateJimmiProfileAvatar(userId: number, avatarUrl: string) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(jimmiProfiles).set({ avatarUrl, updatedAt: new Date() }).where(eq(jimmiProfiles.userId, userId));
  return getJimmiProfile(userId);
}

export async function markJimmiTourSeen(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(jimmiProfiles).set({ tourSeen: true, updatedAt: new Date() }).where(eq(jimmiProfiles.userId, userId));
  return getJimmiProfile(userId);
}

export async function listFoodLogEntries(userId: number, logDate: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(foodLogEntries)
    .where(and(eq(foodLogEntries.userId, userId), eq(foodLogEntries.logDate, logDate)))
    .orderBy(asc(foodLogEntries.createdAt), asc(foodLogEntries.id));
}

export async function createFoodLogEntry(input: InsertFoodLogEntry) {
  const db = await getDb();
  if (!db) return undefined;
  const values: InsertFoodLogEntry = {
    ...input,
    calories: input.calories ?? 0,
    protein: input.protein ?? 0,
    carbs: input.carbs ?? 0,
    fat: input.fat ?? 0,
    notes: input.notes ?? null,
  };
  await db.insert(foodLogEntries).values(values);
  return listFoodLogEntries(values.userId, values.logDate);
}

export async function updateFoodLogEntry(userId: number, id: number, input: Omit<InsertFoodLogEntry, "userId">) {
  const db = await getDb();
  if (!db) return [];
  const values = {
    logDate: input.logDate,
    mealType: input.mealType,
    foodName: input.foodName,
    calories: input.calories ?? 0,
    protein: input.protein ?? 0,
    carbs: input.carbs ?? 0,
    fat: input.fat ?? 0,
    notes: input.notes ?? null,
    updatedAt: new Date(),
  };
  await db.update(foodLogEntries).set(values).where(and(eq(foodLogEntries.userId, userId), eq(foodLogEntries.id, id)));
  return listFoodLogEntries(userId, values.logDate);
}

export async function deleteFoodLogEntry(userId: number, id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(foodLogEntries).where(and(eq(foodLogEntries.userId, userId), eq(foodLogEntries.id, id)));
}

export async function getJimmiProgram(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(jimmiPrograms).where(eq(jimmiPrograms.userId, userId)).limit(1);
  return result[0];
}

export async function upsertJimmiProgram(userId: number, input: Omit<InsertJimmiProgram, "userId">) {
  const db = await getDb();
  if (!db) return undefined;
  const values: InsertJimmiProgram = {
    ...input,
    userId,
    groceryListJson: input.groceryListJson ?? null,
    exportText: input.exportText ?? null,
  };

  await db.insert(jimmiPrograms).values(values).onDuplicateKeyUpdate({
    set: {
      title: values.title,
      macroCalories: values.macroCalories ?? 0,
      macroProtein: values.macroProtein ?? 0,
      macroCarbs: values.macroCarbs ?? 0,
      macroFat: values.macroFat ?? 0,
      planJson: values.planJson,
      groceryListJson: values.groceryListJson,
      exportText: values.exportText,
      updatedAt: new Date(),
    },
  });

  return getJimmiProgram(userId);
}

export const PROGRAM_GENERATION_LIMIT = 2;
export const PROGRAM_GENERATION_CYCLE_DAYS = 30;

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function getProgramGenerationQuota(userId: number, now = new Date()) {
  const db = await getDb();
  const cycleWindowStart = addDays(now, -PROGRAM_GENERATION_CYCLE_DAYS);
  if (!db) {
    return {
      limit: PROGRAM_GENERATION_LIMIT,
      used: 0,
      remaining: PROGRAM_GENERATION_LIMIT,
      daysRemaining: PROGRAM_GENERATION_CYCLE_DAYS,
      cycleStartedAt: null as Date | null,
      cycleEndsAt: addDays(now, PROGRAM_GENERATION_CYCLE_DAYS),
    };
  }

  const events = await db
    .select()
    .from(programGenerationEvents)
    .where(and(eq(programGenerationEvents.userId, userId), gte(programGenerationEvents.generatedAt, cycleWindowStart)))
    .orderBy(asc(programGenerationEvents.generatedAt), asc(programGenerationEvents.id));

  const cycleStartedAt = events[0]?.generatedAt ? new Date(events[0].generatedAt) : null;
  const cycleEndsAt = cycleStartedAt ? addDays(cycleStartedAt, PROGRAM_GENERATION_CYCLE_DAYS) : addDays(now, PROGRAM_GENERATION_CYCLE_DAYS);
  const remainingMilliseconds = Math.max(0, cycleEndsAt.getTime() - now.getTime());
  const daysRemaining = cycleStartedAt ? Math.max(0, Math.ceil(remainingMilliseconds / (24 * 60 * 60 * 1000))) : PROGRAM_GENERATION_CYCLE_DAYS;
  const used = events.length;

  return {
    limit: PROGRAM_GENERATION_LIMIT,
    used,
    remaining: Math.max(0, PROGRAM_GENERATION_LIMIT - used),
    daysRemaining,
    cycleStartedAt,
    cycleEndsAt,
  };
}

export async function recordProgramGeneration(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.insert(programGenerationEvents).values({ userId, generatedAt: new Date() });
}

export async function updateJimmiProgramGroceryList(userId: number, groceryListJson: string, exportText: string) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(jimmiPrograms).set({ groceryListJson, exportText, updatedAt: new Date() }).where(eq(jimmiPrograms.userId, userId));
  return getJimmiProgram(userId);
}

export async function listUsersForAdminManagement() {
  const db = await getDb();
  if (!db) return [];
  const [userRows, profileRows, programRows, settingsRows, wearableRows] = await Promise.all([
    db.select().from(users).orderBy(asc(users.createdAt), asc(users.id)),
    db.select().from(jimmiProfiles),
    db.select().from(jimmiPrograms),
    db.select().from(accountSettings),
    db.select().from(wearableConnections).orderBy(asc(wearableConnections.createdAt), asc(wearableConnections.id)),
  ]);
  const profilesByUserId = new Map(profileRows.map((profile) => [profile.userId, profile]));
  const programsByUserId = new Map(programRows.map((program) => [program.userId, program]));
  const settingsByUserId = new Map(settingsRows.map((settings) => [settings.userId, settings]));
  const connectedWearablesByUserId = new Map(wearableRows.filter((connection) => connection.status === "connected").map((connection) => [connection.userId, connection]));

  return userRows.map((user) => {
    const profile = profilesByUserId.get(user.id);
    const program = programsByUserId.get(user.id);
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastSignedIn: user.lastSignedIn,
      hasOnboarding: Boolean(profile),
      onboardingName: profile?.firstName ?? null,
      onboardingUpdatedAt: profile?.updatedAt ?? null,
      hasProgram: Boolean(program),
      programTitle: program?.title ?? null,
      programUpdatedAt: program?.updatedAt ?? null,
      planTier: settingsByUserId.get(user.id)?.planTier ?? "free",
      subscriptionStatus: settingsByUserId.get(user.id)?.subscriptionStatus ?? "active",
      autoRenew: Boolean(settingsByUserId.get(user.id)?.autoRenew ?? true),
      hasWearableConnection: Boolean(connectedWearablesByUserId.get(user.id)),
      wearableProvider: connectedWearablesByUserId.get(user.id)?.provider ?? null,
      wearableStatus: connectedWearablesByUserId.get(user.id)?.status ?? null,
      wearableLastSyncedAt: connectedWearablesByUserId.get(user.id)?.lastSyncedAt ?? null,
    };
  });
}

export async function resetUserProgramGeneration(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(exerciseLogEntries).where(eq(exerciseLogEntries.userId, userId));
  await db.delete(jimmiPrograms).where(eq(jimmiPrograms.userId, userId));
  await db.delete(programGenerationEvents).where(eq(programGenerationEvents.userId, userId));
}

export async function resetUserOnboardingState(userId: number) {
  const db = await getDb();
  if (!db) return;
  await resetUserProgramGeneration(userId);
  await db.delete(jimmiProfiles).where(eq(jimmiProfiles.userId, userId));
}

export async function createExerciseLogEntry(input: InsertExerciseLogEntry) {
  const db = await getDb();
  if (!db) return undefined;
  const values: InsertExerciseLogEntry = {
    ...input,
    sets: input.sets ?? 0,
    reps: input.reps ?? 0,
    weight: input.weight ?? 0,
    notes: input.notes ?? null,
  };
  await db.insert(exerciseLogEntries).values(values);
  return listExerciseLogEntries(values.userId, values.programId);
}

export async function listExerciseLogEntries(userId: number, programId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(exerciseLogEntries)
    .where(and(eq(exerciseLogEntries.userId, userId), eq(exerciseLogEntries.programId, programId)))
    .orderBy(asc(exerciseLogEntries.loggedAt), asc(exerciseLogEntries.id));
}

export async function getAccountSettings(userId: number) {
  const db = await getDb();
  if (!db) return {
    planTier: "free" as const,
    subscriptionStatus: "active" as const,
    autoRenew: true,
  };
  const result = await db.select().from(accountSettings).where(eq(accountSettings.userId, userId)).limit(1);
  if (result[0]) return result[0];
  const values: InsertAccountSettings = {
    userId,
    planTier: "free",
    subscriptionStatus: "active",
    autoRenew: true,
  };
  await db.insert(accountSettings).values(values);
  const created = await db.select().from(accountSettings).where(eq(accountSettings.userId, userId)).limit(1);
  return created[0] ?? values;
}

export async function updateAccountSettings(userId: number, input: Partial<Pick<InsertAccountSettings, "planTier" | "subscriptionStatus" | "autoRenew">>) {
  const db = await getDb();
  if (!db) return {
    planTier: input.planTier ?? "free",
    subscriptionStatus: input.subscriptionStatus ?? "active",
    autoRenew: input.autoRenew ?? true,
  };
  const existing = await getAccountSettings(userId);
  const values: InsertAccountSettings = {
    userId,
    planTier: input.planTier ?? existing.planTier ?? "free",
    subscriptionStatus: input.subscriptionStatus ?? existing.subscriptionStatus ?? "active",
    autoRenew: input.autoRenew ?? existing.autoRenew ?? true,
  };
  await db.insert(accountSettings).values(values).onDuplicateKeyUpdate({
    set: {
      planTier: values.planTier,
      subscriptionStatus: values.subscriptionStatus,
      autoRenew: values.autoRenew,
      updatedAt: new Date(),
    },
  });
  return getAccountSettings(userId);
}

export async function updateUserPlanTier(userId: number, planTier: "free" | "core" | "pro" | "elite") {
  return updateAccountSettings(userId, { planTier, subscriptionStatus: "active", autoRenew: planTier !== "free" });
}

export async function getWearableConnectionState(userId: number) {
  const db = await getDb();
  if (!db) return { connected: false, provider: null as string | null, status: null as string | null, lastSyncedAt: null as Date | null };
  const result = await db
    .select()
    .from(wearableConnections)
    .where(eq(wearableConnections.userId, userId))
    .orderBy(asc(wearableConnections.createdAt), asc(wearableConnections.id));
  const connected = result.find((connection) => connection.status === "connected") ?? result[0];
  return {
    connected: connected?.status === "connected",
    provider: connected?.provider ?? null,
    status: connected?.status ?? null,
    lastSyncedAt: connected?.lastSyncedAt ?? null,
  };
}

export async function setBetaWearableConnection(userId: number, connected: boolean) {
  const db = await getDb();
  if (!db) return getWearableConnectionState(userId);
  const existing = await db.select().from(wearableConnections).where(eq(wearableConnections.userId, userId)).limit(1);
  const values: InsertWearableConnection = {
    userId,
    provider: "terra",
    externalUserId: `beta-terra-${userId}`,
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
    scope: null,
    status: connected ? "connected" : "disconnected",
    connectedAt: new Date(),
    lastSyncedAt: connected ? new Date() : null,
  };
  if (existing[0]) {
    await db.update(wearableConnections).set({
      provider: values.provider,
      externalUserId: values.externalUserId,
      accessToken: values.accessToken,
      refreshToken: values.refreshToken,
      tokenExpiresAt: values.tokenExpiresAt,
      scope: values.scope,
      status: values.status,
      lastSyncedAt: values.lastSyncedAt,
      updatedAt: new Date(),
    }).where(eq(wearableConnections.id, existing[0].id));
  } else {
    await db.insert(wearableConnections).values(values);
  }

  if (connected) {
    const today = new Date().toISOString().slice(0, 10);
    await upsertCalorieOutSummary({
      userId,
      logDate: today,
      activeCalories: 520,
      restingCalories: 1720,
      totalCalories: 2240,
      sourceProvider: "terra",
      sourceConfidence: "beta",
      rawPayloadKey: "beta/terra-placeholder",
    });
  }

  return getWearableConnectionState(userId);
}

export async function saveOuraConnection(input: {
  userId: number;
  externalUserId: string | null;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  scope: string | null;
}) {
  const db = await getDb();
  if (!db) return getWearableConnectionState(input.userId);
  const existing = await db
    .select()
    .from(wearableConnections)
    .where(and(eq(wearableConnections.userId, input.userId), eq(wearableConnections.provider, "oura")))
    .limit(1);
  const values: InsertWearableConnection = {
    userId: input.userId,
    provider: "oura",
    externalUserId: input.externalUserId,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    tokenExpiresAt: input.tokenExpiresAt,
    scope: input.scope,
    status: "connected",
    connectedAt: new Date(),
    lastSyncedAt: null,
  };
  if (existing[0]) {
    await db.update(wearableConnections).set({
      externalUserId: values.externalUserId,
      accessToken: values.accessToken,
      refreshToken: values.refreshToken,
      tokenExpiresAt: values.tokenExpiresAt,
      scope: values.scope,
      status: values.status,
      connectedAt: values.connectedAt,
      updatedAt: new Date(),
    }).where(eq(wearableConnections.id, existing[0].id));
  } else {
    await db.insert(wearableConnections).values(values);
  }
  return getWearableConnectionState(input.userId);
}

export async function disconnectOuraConnection(userId: number) {
  const db = await getDb();
  if (!db) return getWearableConnectionState(userId);
  await db.update(wearableConnections).set({
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
    status: "disconnected",
    updatedAt: new Date(),
  }).where(and(eq(wearableConnections.userId, userId), eq(wearableConnections.provider, "oura")));
  return getWearableConnectionState(userId);
}

export async function saveWhoopConnection(input: {
  userId: number;
  externalUserId: string | null;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  scope: string | null;
}) {
  const db = await getDb();
  if (!db) return getWearableConnectionState(input.userId);
  const existing = await db
    .select()
    .from(wearableConnections)
    .where(and(eq(wearableConnections.userId, input.userId), eq(wearableConnections.provider, "whoop")))
    .limit(1);
  const values: InsertWearableConnection = {
    userId: input.userId,
    provider: "whoop",
    externalUserId: input.externalUserId,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    tokenExpiresAt: input.tokenExpiresAt,
    scope: input.scope,
    status: "connected",
    connectedAt: new Date(),
    lastSyncedAt: null,
  };
  if (existing[0]) {
    await db.update(wearableConnections).set({
      externalUserId: values.externalUserId,
      accessToken: values.accessToken,
      refreshToken: values.refreshToken,
      tokenExpiresAt: values.tokenExpiresAt,
      scope: values.scope,
      status: values.status,
      connectedAt: values.connectedAt,
      updatedAt: new Date(),
    }).where(eq(wearableConnections.id, existing[0].id));
  } else {
    await db.insert(wearableConnections).values(values);
  }
  return getWearableConnectionState(input.userId);
}

export async function disconnectWhoopConnection(userId: number) {
  const db = await getDb();
  if (!db) return getWearableConnectionState(userId);
  await db.update(wearableConnections).set({
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
    status: "disconnected",
    updatedAt: new Date(),
  }).where(and(eq(wearableConnections.userId, userId), eq(wearableConnections.provider, "whoop")));
  return getWearableConnectionState(userId);
}

export async function saveGoogleHealthConnection(input: {
  userId: number;
  externalUserId: string | null;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
  scope: string | null;
}) {
  const db = await getDb();
  if (!db) return getWearableConnectionState(input.userId);
  const existing = await db
    .select()
    .from(wearableConnections)
    .where(and(eq(wearableConnections.userId, input.userId), eq(wearableConnections.provider, "fitbit")))
    .limit(1);
  const values: InsertWearableConnection = {
    userId: input.userId,
    provider: "fitbit",
    externalUserId: input.externalUserId,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    tokenExpiresAt: input.tokenExpiresAt,
    scope: input.scope,
    status: "connected",
    connectedAt: new Date(),
    lastSyncedAt: null,
  };
  if (existing[0]) {
    await db.update(wearableConnections).set({
      externalUserId: values.externalUserId,
      accessToken: values.accessToken,
      refreshToken: values.refreshToken,
      tokenExpiresAt: values.tokenExpiresAt,
      scope: values.scope,
      status: values.status,
      connectedAt: values.connectedAt,
      updatedAt: new Date(),
    }).where(eq(wearableConnections.id, existing[0].id));
  } else {
    await db.insert(wearableConnections).values(values);
  }
  return getWearableConnectionState(input.userId);
}

export async function disconnectGoogleHealthConnection(userId: number) {
  const db = await getDb();
  if (!db) return getWearableConnectionState(userId);
  await db.update(wearableConnections).set({
    accessToken: null,
    refreshToken: null,
    tokenExpiresAt: null,
    status: "disconnected",
    updatedAt: new Date(),
  }).where(and(eq(wearableConnections.userId, userId), eq(wearableConnections.provider, "fitbit")));
  return getWearableConnectionState(userId);
}

export async function upsertCalorieOutSummary(input: InsertCalorieOutSummary) {
  const db = await getDb();
  if (!db) return undefined;
  const values: InsertCalorieOutSummary = {
    ...input,
    activeCalories: input.activeCalories ?? 0,
    restingCalories: input.restingCalories ?? 0,
    totalCalories: input.totalCalories ?? (input.activeCalories ?? 0) + (input.restingCalories ?? 0),
    sourceProvider: input.sourceProvider ?? "terra",
    sourceConfidence: input.sourceConfidence ?? "beta",
    rawPayloadKey: input.rawPayloadKey ?? null,
    wearableConnectionId: input.wearableConnectionId ?? null,
  };
  const existing = await db.select().from(calorieOutSummaries).where(and(eq(calorieOutSummaries.userId, values.userId), eq(calorieOutSummaries.logDate, values.logDate))).limit(1);
  if (existing[0]) {
    await db.update(calorieOutSummaries).set({
      activeCalories: values.activeCalories,
      restingCalories: values.restingCalories,
      totalCalories: values.totalCalories,
      sourceProvider: values.sourceProvider,
      sourceConfidence: values.sourceConfidence,
      wearableConnectionId: values.wearableConnectionId,
      rawPayloadKey: values.rawPayloadKey,
      updatedAt: new Date(),
    }).where(eq(calorieOutSummaries.id, existing[0].id));
  } else {
    await db.insert(calorieOutSummaries).values(values);
  }
  const saved = await db.select().from(calorieOutSummaries).where(and(eq(calorieOutSummaries.userId, values.userId), eq(calorieOutSummaries.logDate, values.logDate))).limit(1);
  return saved[0];
}

export async function getCalorieBalanceForDate(userId: number, logDate: string) {
  const [settings, wearable, entries] = await Promise.all([getAccountSettings(userId), getWearableConnectionState(userId), listFoodLogEntries(userId, logDate)]);
  const caloriesIn = entries.reduce((sum, entry) => sum + entry.calories, 0);
  const premiumActive = (settings.planTier === "pro" || settings.planTier === "elite") && settings.subscriptionStatus === "active";
  const db = await getDb();
  const summary = db ? (await db.select().from(calorieOutSummaries).where(and(eq(calorieOutSummaries.userId, userId), eq(calorieOutSummaries.logDate, logDate))).limit(1))[0] : undefined;
  const activeCaloriesOut = summary?.activeCalories ?? 0;
  const restingCaloriesOut = summary?.restingCalories ?? 0;
  const totalCaloriesOut = summary?.totalCalories ?? activeCaloriesOut + restingCaloriesOut;
  const netCalories = caloriesIn - totalCaloriesOut;
  const balanceDirection = !premiumActive ? "premium_required" : !wearable.connected ? "wearable_required" : totalCaloriesOut === 0 ? "sync_pending" : netCalories > 0 ? "surplus" : netCalories < 0 ? "deficit" : "balanced";
  return {
    logDate,
    premiumActive,
    wearableConnected: wearable.connected,
    wearableProvider: wearable.provider,
    wearableStatus: wearable.status,
    wearableLastSyncedAt: wearable.lastSyncedAt,
    caloriesIn,
    activeCaloriesOut,
    restingCaloriesOut,
    totalCaloriesOut,
    netCalories,
    balanceDirection,
    sourceConfidence: summary?.sourceConfidence ?? null,
    sourceProvider: summary?.sourceProvider ?? wearable.provider,
  };
}

export const CHAT_RETENTION_DAYS = 7;

export function chatRetentionCutoff(now = new Date()) {
  return new Date(now.getTime() - CHAT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
}

export async function listChatMessages(userId: number, now = new Date()) {
  const db = await getDb();
  if (!db) return [];
  await deleteExpiredChatMessages(now);
  // Cap to the 50 most recent messages to keep initial load fast at scale.
  // Sort DESC to get the newest 50, then reverse so the client receives them oldest-first.
  const rows = await db
    .select()
    .from(chatMessages)
    .where(and(eq(chatMessages.userId, userId), gte(chatMessages.createdAt, chatRetentionCutoff(now))))
    .orderBy(desc(chatMessages.createdAt), desc(chatMessages.id))
    .limit(50);
  return rows.reverse();
}

export async function countTodayUserChatMessages(userId: number, now = new Date()) {
  const db = await getDb();
  if (!db) return 0;
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const rows = await db
    .select({ id: chatMessages.id })
    .from(chatMessages)
    .where(and(eq(chatMessages.userId, userId), eq(chatMessages.role, "user"), gte(chatMessages.createdAt, startOfDay), lt(chatMessages.createdAt, endOfDay)));
  return rows.length;
}

export async function createChatMessage(userId: number, input: Omit<InsertChatMessage, "userId" | "createdAt"> & { createdAt?: Date }) {
  const db = await getDb();
  if (!db) return undefined;
  const values: InsertChatMessage = {
    userId,
    role: input.role,
    content: input.content,
    createdAt: input.createdAt ?? new Date(),
  };
  await db.insert(chatMessages).values(values);
  const result = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.userId, userId))
    .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id));
  return result[result.length - 1];
}

export async function deleteExpiredChatMessages(now = new Date()) {
  const db = await getDb();
  if (!db) return { deleted: 0, cutoff: chatRetentionCutoff(now) };
  const cutoff = chatRetentionCutoff(now);
  const result = await db.delete(chatMessages).where(lt(chatMessages.createdAt, cutoff));
  const deleted = Number((result as { rowsAffected?: number; affectedRows?: number })?.rowsAffected ?? (result as { affectedRows?: number })?.affectedRows ?? 0);
  return { deleted, cutoff };
}

export async function deleteUserAccountData(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
  await db.delete(exerciseLogEntries).where(eq(exerciseLogEntries.userId, userId));
  await db.delete(calorieOutSummaries).where(eq(calorieOutSummaries.userId, userId));
  await db.delete(wearableConnections).where(eq(wearableConnections.userId, userId));
  await db.delete(foodLogEntries).where(eq(foodLogEntries.userId, userId));
  await db.delete(jimmiPrograms).where(eq(jimmiPrograms.userId, userId));
  await db.delete(jimmiProfiles).where(eq(jimmiProfiles.userId, userId));
  await db.delete(accountSettings).where(eq(accountSettings.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

export async function usersDueForReminder(_utcHour: number) {
  return [] as Array<typeof users.$inferSelect>;
}

// ─── Coach Panel Helpers ────────────────────────────────────────────────────

export async function listEliteUsersForCoach() {
  const db = await getDb();
  if (!db) return [];
  const [userRows, profileRows, programRows, settingsRows] = await Promise.all([
    db.select().from(users).orderBy(asc(users.createdAt), asc(users.id)),
    db.select().from(jimmiProfiles),
    db.select().from(jimmiPrograms),
    db.select().from(accountSettings),
  ]);
  const profilesByUserId = new Map(profileRows.map((p) => [p.userId, p]));
  const programsByUserId = new Map(programRows.map((p) => [p.userId, p]));
  const settingsByUserId = new Map(settingsRows.map((s) => [s.userId, s]));
  return userRows
    .filter((u) => {
      const settings = settingsByUserId.get(u.id);
      return (settings?.planTier ?? u.tier) === "elite";
    })
    .map((u) => {
      const profile = profilesByUserId.get(u.id);
      const program = programsByUserId.get(u.id);
      const settings = settingsByUserId.get(u.id);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        tier: settings?.planTier ?? u.tier,
        createdAt: u.createdAt,
        lastSignedIn: u.lastSignedIn,
        hasProfile: Boolean(profile),
        firstName: profile?.firstName ?? null,
        fitnessGoals: profile?.fitnessGoals ?? null,
        fitnessLevel: profile?.fitnessLevel ?? null,
        activityLevel: profile?.activityLevel ?? null,
        healthComplications: profile?.healthComplications ?? null,
        dietRestrictions: profile?.dietRestrictions ?? null,
        foodAllergies: profile?.foodAllergies ?? null,
        weight: profile?.weight ?? null,
        targetWeight: profile?.targetWeight ?? null,
        height: profile?.height ?? null,
        birthday: profile?.birthday ?? null,
        hasProgram: Boolean(program),
        programTitle: program?.title ?? null,
        programUpdatedAt: program?.updatedAt ?? null,
        macroCalories: program?.macroCalories ?? 0,
        macroProtein: program?.macroProtein ?? 0,
        macroCarbs: program?.macroCarbs ?? 0,
        macroFat: program?.macroFat ?? 0,
        coachMacroCalories: program?.coachMacroCalories ?? null,
        coachMacroProtein: program?.coachMacroProtein ?? null,
        coachMacroCarbs: program?.coachMacroCarbs ?? null,
        coachMacroFat: program?.coachMacroFat ?? null,
        coachNotes: program?.coachNotes ?? null,
      };
    });
}

export async function getCalorieBalanceRange(userId: number, days = 7) {
  const db = await getDb();
  const results: Array<Awaited<ReturnType<typeof getCalorieBalanceForDate>>> = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const logDate = d.toISOString().slice(0, 10);
    results.push(await getCalorieBalanceForDate(userId, logDate));
  }
  return results;
}

export async function listFoodLogEntriesForCoach(userId: number, limitDays = 14) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - limitDays);
  return db
    .select()
    .from(foodLogEntries)
    .where(and(eq(foodLogEntries.userId, userId), gte(foodLogEntries.createdAt, cutoff)))
    .orderBy(desc(foodLogEntries.createdAt), desc(foodLogEntries.id));
}

export async function listExerciseLogEntriesForCoach(userId: number, limitDays = 30) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - limitDays);
  return db
    .select()
    .from(exerciseLogEntries)
    .where(and(eq(exerciseLogEntries.userId, userId), gte(exerciseLogEntries.loggedAt, cutoff)))
    .orderBy(desc(exerciseLogEntries.loggedAt), desc(exerciseLogEntries.id));
}

export async function coachOverrideMacros(userId: number, overrides: { calories: number | null; protein: number | null; carbs: number | null; fat: number | null; notes: string | null }) {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(jimmiPrograms).set({
    coachMacroCalories: overrides.calories,
    coachMacroProtein: overrides.protein,
    coachMacroCarbs: overrides.carbs,
    coachMacroFat: overrides.fat,
    coachNotes: overrides.notes,
    updatedAt: new Date(),
  }).where(eq(jimmiPrograms.userId, userId));
  return getJimmiProgram(userId);
}

export async function coachOverrideProgram(userId: number, planJson: string, title: string) {
  const db = await getDb();
  if (!db) return undefined;
  const existing = await getJimmiProgram(userId);
  if (!existing) return undefined;
  await db.update(jimmiPrograms).set({
    title,
    planJson,
    updatedAt: new Date(),
  }).where(eq(jimmiPrograms.userId, userId));
  return getJimmiProgram(userId);
}
