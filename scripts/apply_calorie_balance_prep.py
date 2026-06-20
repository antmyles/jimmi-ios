from pathlib import Path


def replace_once(path: str, find: str, replace: str):
    p = Path(path)
    source = p.read_text()
    if find not in source:
        raise SystemExit(f"Expected text not found in {path}: {find[:140]!r}")
    p.write_text(source.replace(find, replace, 1))

schema = '/home/ubuntu/jimmi-fit-recovery/drizzle/schema.ts'
replace_once(schema, '''export const exerciseLogEntries = mysqlTable("exerciseLogEntries", {''', '''export const wearableConnections = mysqlTable("wearableConnections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  provider: varchar("provider", { length: 64 }).default("terra").notNull(),
  externalUserId: varchar("externalUserId", { length: 180 }),
  status: mysqlEnum("wearableConnectionStatus", ["connected", "disconnected", "pending"]).default("connected").notNull(),
  connectedAt: timestamp("connectedAt").defaultNow().notNull(),
  lastSyncedAt: timestamp("lastSyncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const calorieOutSummaries = mysqlTable("calorieOutSummaries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  logDate: varchar("logDate", { length: 10 }).notNull(),
  activeCalories: int("activeCalories").default(0).notNull(),
  restingCalories: int("restingCalories").default(0).notNull(),
  totalCalories: int("totalCalories").default(0).notNull(),
  sourceProvider: varchar("sourceProvider", { length: 64 }).default("terra").notNull(),
  sourceConfidence: mysqlEnum("calorieOutSourceConfidence", ["synced", "estimated", "manual", "beta"]).default("beta").notNull(),
  wearableConnectionId: int("wearableConnectionId"),
  rawPayloadKey: text("rawPayloadKey"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const exerciseLogEntries = mysqlTable("exerciseLogEntries", {''')
replace_once(schema, '''export type ExerciseLogEntry = typeof exerciseLogEntries.$inferSelect;
export type InsertExerciseLogEntry = typeof exerciseLogEntries.$inferInsert;

export type AccountSettings = typeof accountSettings.$inferSelect;
export type InsertAccountSettings = typeof accountSettings.$inferInsert;''', '''export type WearableConnection = typeof wearableConnections.$inferSelect;
export type InsertWearableConnection = typeof wearableConnections.$inferInsert;
export type CalorieOutSummary = typeof calorieOutSummaries.$inferSelect;
export type InsertCalorieOutSummary = typeof calorieOutSummaries.$inferInsert;
export type ExerciseLogEntry = typeof exerciseLogEntries.$inferSelect;
export type InsertExerciseLogEntry = typeof exerciseLogEntries.$inferInsert;

export type AccountSettings = typeof accountSettings.$inferSelect;
export type InsertAccountSettings = typeof accountSettings.$inferInsert;''')

db = '/home/ubuntu/jimmi-fit-recovery/server/db.ts'
replace_once(db, '''import { accountSettings, exerciseLogEntries, foodLogEntries, InsertAccountSettings, InsertExerciseLogEntry, InsertFoodLogEntry, InsertJimmiProfile, InsertJimmiProgram, InsertUser, jimmiProfiles, jimmiPrograms, programGenerationEvents, users } from "../drizzle/schema";''', '''import { accountSettings, calorieOutSummaries, exerciseLogEntries, foodLogEntries, InsertAccountSettings, InsertCalorieOutSummary, InsertExerciseLogEntry, InsertFoodLogEntry, InsertJimmiProfile, InsertJimmiProgram, InsertUser, InsertWearableConnection, jimmiProfiles, jimmiPrograms, programGenerationEvents, users, wearableConnections } from "../drizzle/schema";''')
replace_once(db, '''  const [userRows, profileRows, programRows] = await Promise.all([
    db.select().from(users).orderBy(asc(users.createdAt), asc(users.id)),
    db.select().from(jimmiProfiles),
    db.select().from(jimmiPrograms),
  ]);
  const profilesByUserId = new Map(profileRows.map((profile) => [profile.userId, profile]));
  const programsByUserId = new Map(programRows.map((program) => [program.userId, program]));''', '''  const [userRows, profileRows, programRows, settingsRows, wearableRows] = await Promise.all([
    db.select().from(users).orderBy(asc(users.createdAt), asc(users.id)),
    db.select().from(jimmiProfiles),
    db.select().from(jimmiPrograms),
    db.select().from(accountSettings),
    db.select().from(wearableConnections).orderBy(asc(wearableConnections.createdAt), asc(wearableConnections.id)),
  ]);
  const profilesByUserId = new Map(profileRows.map((profile) => [profile.userId, profile]));
  const programsByUserId = new Map(programRows.map((program) => [program.userId, program]));
  const settingsByUserId = new Map(settingsRows.map((settings) => [settings.userId, settings]));
  const connectedWearablesByUserId = new Map(wearableRows.filter((connection) => connection.status === "connected").map((connection) => [connection.userId, connection]));''')
replace_once(db, '''      programUpdatedAt: program?.updatedAt ?? null,
    };
  });
}''', '''      programUpdatedAt: program?.updatedAt ?? null,
      planTier: settingsByUserId.get(user.id)?.planTier ?? "standard",
      subscriptionStatus: settingsByUserId.get(user.id)?.subscriptionStatus ?? "active",
      autoRenew: Boolean(settingsByUserId.get(user.id)?.autoRenew ?? true),
      hasWearableConnection: Boolean(connectedWearablesByUserId.get(user.id)),
      wearableProvider: connectedWearablesByUserId.get(user.id)?.provider ?? null,
      wearableStatus: connectedWearablesByUserId.get(user.id)?.status ?? null,
      wearableLastSyncedAt: connectedWearablesByUserId.get(user.id)?.lastSyncedAt ?? null,
    };
  });
}''')
replace_once(db, '''export async function deleteUserAccountData(userId: number) {''', '''export async function updateUserPlanTier(userId: number, planTier: "standard" | "premium") {
  return updateAccountSettings(userId, { planTier, subscriptionStatus: "active", autoRenew: planTier === "premium" });
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
    status: connected ? "connected" : "disconnected",
    connectedAt: new Date(),
    lastSyncedAt: connected ? new Date() : null,
  };
  if (existing[0]) {
    await db.update(wearableConnections).set({
      provider: values.provider,
      externalUserId: values.externalUserId,
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
  const premiumActive = settings.planTier === "premium" && settings.subscriptionStatus === "active";
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

export async function deleteUserAccountData(userId: number) {''')
replace_once(db, '''  await db.delete(exerciseLogEntries).where(eq(exerciseLogEntries.userId, userId));
  await db.delete(foodLogEntries).where(eq(foodLogEntries.userId, userId));''', '''  await db.delete(exerciseLogEntries).where(eq(exerciseLogEntries.userId, userId));
  await db.delete(calorieOutSummaries).where(eq(calorieOutSummaries.userId, userId));
  await db.delete(wearableConnections).where(eq(wearableConnections.userId, userId));
  await db.delete(foodLogEntries).where(eq(foodLogEntries.userId, userId));''')

router = '/home/ubuntu/jimmi-fit-recovery/server/routers.ts'
replace_once(router, '''import { createExerciseLogEntry, createFoodLogEntry, deleteFoodLogEntry, deleteUserAccountData, getAccountSettings, getJimmiProfile, getJimmiProgram, getProgramGenerationQuota, getUserById, listExerciseLogEntries, listFoodLogEntries, listUsersForAdminManagement, markJimmiTourSeen, recordProgramGeneration, resetUserOnboardingState, resetUserProgramGeneration, updateAccountSettings, updateFoodLogEntry, updateJimmiProfileAvatar, updateJimmiProgramGroceryList, upsertJimmiProfile, upsertJimmiProgram } from "./db";''', '''import { createExerciseLogEntry, createFoodLogEntry, deleteFoodLogEntry, deleteUserAccountData, getAccountSettings, getCalorieBalanceForDate, getJimmiProfile, getJimmiProgram, getProgramGenerationQuota, getUserById, getWearableConnectionState, listExerciseLogEntries, listFoodLogEntries, listUsersForAdminManagement, markJimmiTourSeen, recordProgramGeneration, resetUserOnboardingState, resetUserProgramGeneration, setBetaWearableConnection, updateAccountSettings, updateFoodLogEntry, updateJimmiProfileAvatar, updateJimmiProgramGroceryList, updateUserPlanTier, upsertJimmiProfile, upsertJimmiProgram } from "./db";''')
replace_once(router, '''const adminResetTargetInput = z.object({ userId: z.coerce.number().int().positive() });''', '''const adminResetTargetInput = z.object({ userId: z.coerce.number().int().positive() });
const adminPlanTierInput = adminResetTargetInput.extend({ planTier: z.enum(["standard", "premium"]) });
const adminWearableConnectionInput = adminResetTargetInput.extend({ connected: z.boolean() });''')
replace_once(router, '''    daily: protectedProcedure.input(z.object({ logDate: logDateInput })).query(async ({ ctx, input }) => {
      const entries = await listFoodLogEntries(ctx.user.id, input.logDate);
      const totals = entries.reduce(
        (sum, entry) => ({
          calories: sum.calories + entry.calories,
          protein: sum.protein + entry.protein,
          carbs: sum.carbs + entry.carbs,
          fat: sum.fat + entry.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
      return { entries, totals };
    }),''', '''    daily: protectedProcedure.input(z.object({ logDate: logDateInput })).query(async ({ ctx, input }) => {
      const entries = await listFoodLogEntries(ctx.user.id, input.logDate);
      const totals = entries.reduce(
        (sum, entry) => ({
          calories: sum.calories + entry.calories,
          protein: sum.protein + entry.protein,
          carbs: sum.carbs + entry.carbs,
          fat: sum.fat + entry.fat,
        }),
        { calories: 0, protein: 0, carbs: 0, fat: 0 },
      );
      return { entries, totals };
    }),
    calorieBalance: protectedProcedure.input(z.object({ logDate: logDateInput })).query(async ({ ctx, input }) => {
      return getCalorieBalanceForDate(ctx.user.id, input.logDate);
    }),''')
replace_once(router, '''      return {
        planTier: settings.planTier,
        subscriptionStatus: settings.subscriptionStatus,
        autoRenew: Boolean(settings.autoRenew),
      };
    }),''', '''      return {
        planTier: settings.planTier,
        subscriptionStatus: settings.subscriptionStatus,
        autoRenew: Boolean(settings.autoRenew),
      };
    }),
    wearableState: protectedProcedure.query(async ({ ctx }) => getWearableConnectionState(ctx.user.id)),''')
replace_once(router, '''    users: adminProcedure.query(async () => ({ users: await listUsersForAdminManagement() })),''', '''    users: adminProcedure.query(async () => ({ users: await listUsersForAdminManagement() })),
    setPlanTier: adminProcedure.input(adminPlanTierInput).mutation(async ({ input }) => {
      const targetUser = await getUserById(input.userId);
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "That user could not be found." });
      const settings = await updateUserPlanTier(input.userId, input.planTier);
      return { success: true, userId: input.userId, planTier: settings.planTier };
    }),
    setBetaWearableConnection: adminProcedure.input(adminWearableConnectionInput).mutation(async ({ input }) => {
      const targetUser = await getUserById(input.userId);
      if (!targetUser) throw new TRPCError({ code: "NOT_FOUND", message: "That user could not be found." });
      const wearable = await setBetaWearableConnection(input.userId, input.connected);
      return { success: true, userId: input.userId, wearable };
    }),''')

admin = '/home/ubuntu/jimmi-fit-recovery/client/src/pages/AdminManagement.tsx'
replace_once(admin, '''import { AlertTriangle, CheckCircle2, Loader2, RefreshCcw, RotateCcw, ShieldCheck, UserRoundCog } from "lucide-react";''', '''import { AlertTriangle, CheckCircle2, Crown, Loader2, PlugZap, RefreshCcw, RotateCcw, ShieldCheck, UserRoundCog } from "lucide-react";''')
replace_once(admin, '''  programTitle: string | null;
  programUpdatedAt: Date | string | null;
};''', '''  programTitle: string | null;
  programUpdatedAt: Date | string | null;
  planTier: "standard" | "premium";
  subscriptionStatus: "active" | "paused";
  autoRenew: boolean;
  hasWearableConnection: boolean;
  wearableProvider: string | null;
  wearableStatus: string | null;
  wearableLastSyncedAt: Date | string | null;
};''')
replace_once(admin, '''  const users = useMemo(() => (usersQuery.data?.users ?? []) as AdminUser[], [usersQuery.data?.users]);
  const activeMutation = resetProgram.isPending || resetOnboarding.isPending;''', '''  const setPlanTier = trpc.admin.setPlanTier.useMutation({
    onSuccess: async (result) => {
      const target = usersQuery.data?.users.find((candidate) => candidate.id === result.userId);
      setStatusMessage(`${target ? userLabel(target as AdminUser, user?.id) : "Selected user"} is now on the ${result.planTier} tier for beta testing.`);
      await utils.invalidate();
    },
  });

  const setBetaWearable = trpc.admin.setBetaWearableConnection.useMutation({
    onSuccess: async (result) => {
      const target = usersQuery.data?.users.find((candidate) => candidate.id === result.userId);
      setStatusMessage(`${target ? userLabel(target as AdminUser, user?.id) : "Selected user"}'s beta wearable connection is ${result.wearable.connected ? "connected" : "disconnected"}.`);
      await utils.invalidate();
    },
  });

  const users = useMemo(() => (usersQuery.data?.users ?? []) as AdminUser[], [usersQuery.data?.users]);
  const activeMutation = resetProgram.isPending || resetOnboarding.isPending || setPlanTier.isPending || setBetaWearable.isPending;''')
replace_once(admin, '''              <h1 className="mt-6 font-display text-4xl font-light leading-tight tracking-tight md:text-6xl">Beta reset controls</h1>
              <p className="mt-5 text-sm leading-6 text-muted-foreground">Use these admin-only tools before beta testing to force a clean program generation cycle or a full onboarding redo for any selected user, including your own account.</p>''', '''              <h1 className="mt-6 font-display text-4xl font-light leading-tight tracking-tight md:text-6xl">Beta management controls</h1>
              <p className="mt-5 text-sm leading-6 text-muted-foreground">Use these admin-only tools before beta testing to manage account tiers, grant premium calorie-balance access, simulate a connected Terra wearable, or force a clean program generation cycle.</p>''')
replace_once(admin, '''                          {targetUser.role === "admin" ? <Badge className="rounded-full bg-primary/15 text-primary hover:bg-primary/15">Admin</Badge> : null}
                        </div>''', '''                          {targetUser.role === "admin" ? <Badge className="rounded-full bg-primary/15 text-primary hover:bg-primary/15">Admin</Badge> : null}
                          <Badge className={targetUser.planTier === "premium" ? "rounded-full bg-amber-300/15 text-amber-100 hover:bg-amber-300/15" : "rounded-full bg-white/10 text-muted-foreground hover:bg-white/10"} data-admin-account-tier-badge="true">
                            <Crown className="mr-1 size-3" /> {targetUser.planTier === "premium" ? "Premium" : "Standard"}
                          </Badge>
                          {targetUser.hasWearableConnection ? <Badge className="rounded-full bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/15" data-admin-wearable-connected-badge="true"><PlugZap className="mr-1 size-3" /> Wearable connected</Badge> : null}
                        </div>''')
replace_once(admin, '''                          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                            <p className="font-mono uppercase tracking-[0.16em] text-primary/80">Program</p>
                            <p className="mt-1 truncate text-foreground">{targetUser.programTitle || (targetUser.hasProgram ? "Generated program" : "Not generated")}</p>
                            <p className="mt-1">Updated {formatDate(targetUser.programUpdatedAt)}</p>
                          </div>''', '''                          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3">
                            <p className="font-mono uppercase tracking-[0.16em] text-primary/80">Program</p>
                            <p className="mt-1 truncate text-foreground">{targetUser.programTitle || (targetUser.hasProgram ? "Generated program" : "Not generated")}</p>
                            <p className="mt-1">Updated {formatDate(targetUser.programUpdatedAt)}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3" data-admin-account-tier-info="true">
                            <p className="font-mono uppercase tracking-[0.16em] text-primary/80">Account tier</p>
                            <p className="mt-1 text-foreground">{targetUser.planTier === "premium" ? "Premium beta" : "Standard"}</p>
                            <p className="mt-1">Subscription {targetUser.subscriptionStatus}</p>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-3" data-admin-wearable-beta-info="true">
                            <p className="font-mono uppercase tracking-[0.16em] text-primary/80">Wearable beta</p>
                            <p className="mt-1 text-foreground">{targetUser.hasWearableConnection ? `${targetUser.wearableProvider || "Terra"} connected` : "Not connected"}</p>
                            <p className="mt-1">Synced {formatDate(targetUser.wearableLastSyncedAt)}</p>
                          </div>''')
replace_once(admin, '''                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Button type="button" variant="outline" disabled={!targetUser.hasProgram || activeMutation} onClick={() => setPendingReset({ user: targetUser, action: "program" })} className="rounded-full border-white/10 bg-transparent" data-admin-reset-program-button="true">''', '''                      <div className="flex flex-wrap gap-2 lg:justify-end">
                        <Button type="button" variant="outline" disabled={activeMutation} onClick={() => setPlanTier.mutate({ userId: targetUser.id, planTier: targetUser.planTier === "premium" ? "standard" : "premium" })} className="rounded-full border-amber-300/25 bg-transparent text-amber-100 hover:bg-amber-300/10 hover:text-white" data-admin-premium-beta-toggle="true">
                          <Crown className="mr-2 size-4" /> {targetUser.planTier === "premium" ? "Remove premium" : "Grant premium"}
                        </Button>
                        <Button type="button" variant="outline" disabled={activeMutation || targetUser.planTier !== "premium"} onClick={() => setBetaWearable.mutate({ userId: targetUser.id, connected: !targetUser.hasWearableConnection })} className="rounded-full border-emerald-300/25 bg-transparent text-emerald-100 hover:bg-emerald-300/10 hover:text-white" data-admin-wearable-beta-toggle="true">
                          <PlugZap className="mr-2 size-4" /> {targetUser.hasWearableConnection ? "Disconnect wearable" : "Connect beta wearable"}
                        </Button>
                        <Button type="button" variant="outline" disabled={!targetUser.hasProgram || activeMutation} onClick={() => setPendingReset({ user: targetUser, action: "program" })} className="rounded-full border-white/10 bg-transparent" data-admin-reset-program-button="true">''')

food = '/home/ubuntu/jimmi-fit-recovery/client/src/pages/FoodLog.tsx'
replace_once(food, '''import { ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";''', '''import { ChevronLeft, ChevronRight, Crown, Loader2, Pencil, Plus, Sparkles, Trash2, TrendingDown, TrendingUp, Watch } from "lucide-react";''')
replace_once(food, '''  const dailyQuery = trpc.foodLog.daily.useQuery({ logDate: selectedDate }, { enabled: Boolean(user), staleTime: 15_000 });''', '''  const dailyQuery = trpc.foodLog.daily.useQuery({ logDate: selectedDate }, { enabled: Boolean(user), staleTime: 15_000 });
  const calorieBalanceQuery = trpc.foodLog.calorieBalance.useQuery({ logDate: selectedDate }, { enabled: Boolean(user), staleTime: 15_000 });''')
replace_once(food, '''  const totals = dailyQuery.data?.totals ?? localTotals;''', '''  const totals = dailyQuery.data?.totals ?? localTotals;
  const calorieBalance = calorieBalanceQuery.data;''')
replace_once(food, '''        <section className="mt-8 grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">''', '''        <section className="mt-6 rounded-[2rem] border border-white/10 bg-card p-5 text-card-foreground md:p-6" data-premium-calorie-balance-tracker="true">
          {calorieBalanceQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin text-primary" /> Loading calorie balance...</div>
          ) : !calorieBalance?.premiumActive ? (
            <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-center" data-calorie-balance-premium-gate="true">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-300/10 text-amber-100"><Crown className="size-5" /></div>
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">Premium calorie balance</p>
                <h2 className="mt-2 text-xl font-medium tracking-tight">Track surplus and deficit once wearable calories are enabled.</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">This premium tracker will compare calories in from your food log against active and total calories out from a connected wearable.</p>
              </div>
              <Button asChild className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90">
                <Link href="/account-settings">Upgrade access</Link>
              </Button>
            </div>
          ) : !calorieBalance.wearableConnected ? (
            <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-center" data-calorie-balance-wearable-required="true">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-300/10 text-emerald-100"><Watch className="size-5" /></div>
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">Wearable connection required</p>
                <h2 className="mt-2 text-xl font-medium tracking-tight">Your premium account is ready for Terra beta testing.</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Once a wearable is connected, JIMMI will unlock the calorie balance tracker for weight-loss deficits and muscle-building surpluses.</p>
              </div>
              <span className="rounded-full border border-white/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">Coming with Terra</span>
            </div>
          ) : (
            <div data-calorie-balance-connected-tracker="true">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.22em] text-primary">Calorie balance tracker</p>
                  <h2 className="mt-2 text-2xl font-medium tracking-tight">{calorieBalance.balanceDirection === "surplus" ? "Surplus day" : calorieBalance.balanceDirection === "deficit" ? "Deficit day" : calorieBalance.balanceDirection === "sync_pending" ? "Waiting for synced calories out" : "Balanced day"}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Calories in are compared against active and total calories out from your connected {calorieBalance.sourceProvider || "wearable"} source.</p>
                </div>
                <div className={`inline-flex items-center rounded-full px-3 py-1 text-sm ${calorieBalance.netCalories >= 0 ? "bg-amber-300/10 text-amber-100" : "bg-emerald-300/10 text-emerald-100"}`}>
                  {calorieBalance.netCalories >= 0 ? <TrendingUp className="mr-2 size-4" /> : <TrendingDown className="mr-2 size-4" />}
                  {calorieBalance.netCalories >= 0 ? "+" : ""}{calorieBalance.netCalories} kcal net
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-4">
                {[
                  ["Calories in", calorieBalance.caloriesIn],
                  ["Active out", calorieBalance.activeCaloriesOut],
                  ["Total out", calorieBalance.totalCaloriesOut],
                  ["Net balance", calorieBalance.netCalories],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.025] p-4">
                    <p className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-primary/80">{label}</p>
                    <p className="mt-2 text-2xl font-semibold tracking-tight">{Number(value).toLocaleString()} kcal</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.88fr_1.12fr]">''')

print('Calorie balance preparation edits applied.')
