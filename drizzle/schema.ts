import { boolean, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  passwordHash: varchar("passwordHash", { length: 255 }),
  googleId: varchar("googleId", { length: 128 }),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  tier: mysqlEnum("tier", ["free", "core", "pro", "elite"]).default("free").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const jimmiProfiles = mysqlTable("jimmiProfiles", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  firstName: varchar("firstName", { length: 120 }).notNull(),
  birthday: varchar("birthday", { length: 20 }).notNull(),
  gender: varchar("gender", { length: 40 }).notNull(),
  weight: int("weight").notNull(),
  targetWeight: int("targetWeight"),
  height: varchar("height", { length: 20 }).notNull(),
  healthComplications: text("healthComplications").notNull(),
  dietRestrictions: text("dietRestrictions").notNull(),
  dietaryPreferences: text("dietaryPreferences"),
  foodAllergies: text("foodAllergies").notNull(),
  fitnessLevel: varchar("fitnessLevel", { length: 80 }).notNull(),
  activityLevel: varchar("activityLevel", { length: 80 }).default("moderate").notNull(),
  fitnessGoals: text("fitnessGoals").notNull(),
  additionalInfo: text("additionalInfo"),
  avatarUrl: text("avatarUrl"),
  tourSeen: boolean("tourSeen").default(false).notNull(),
  eventType: varchar("eventType", { length: 40 }).default("general"),
  weeksUntilRace: int("weeksUntilRace"),
  currentWeeklyVolume: varchar("currentWeeklyVolume", { length: 80 }),
  previousRaceTimes: text("previousRaceTimes"),
  availableTrainingDaysPerWeek: int("availableTrainingDaysPerWeek"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const foodLogEntries = mysqlTable("foodLogEntries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  logDate: varchar("logDate", { length: 10 }).notNull(),
  mealType: varchar("mealType", { length: 32 }).notNull(),
  foodName: text("foodName").notNull(),
  calories: int("calories").default(0).notNull(),
  protein: int("protein").default(0).notNull(),
  carbs: int("carbs").default(0).notNull(),
  fat: int("fat").default(0).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const jimmiPrograms = mysqlTable("jimmiPrograms", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  title: varchar("title", { length: 180 }).notNull(),
  macroCalories: int("macroCalories").default(0).notNull(),
  macroProtein: int("macroProtein").default(0).notNull(),
  macroCarbs: int("macroCarbs").default(0).notNull(),
  macroFat: int("macroFat").default(0).notNull(),
  coachMacroCalories: int("coachMacroCalories"),
  coachMacroProtein: int("coachMacroProtein"),
  coachMacroCarbs: int("coachMacroCarbs"),
  coachMacroFat: int("coachMacroFat"),
  coachNotes: text("coachNotes"),
  planJson: text("planJson").notNull(),
  groceryListJson: text("groceryListJson"),
  exportText: text("exportText"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const programGenerationEvents = mysqlTable("programGenerationEvents", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
});

export const chatMessages = mysqlTable("chatMessages", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["user", "assistant"]).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const accountSettings = mysqlTable("accountSettings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  planTier: mysqlEnum("planTier", ["free", "core", "pro", "elite"]).default("free").notNull(),
  subscriptionStatus: mysqlEnum("subscriptionStatus", ["active", "paused"]).default("active").notNull(),
  autoRenew: boolean("autoRenew").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const wearableConnections = mysqlTable("wearableConnections", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  provider: varchar("provider", { length: 64 }).default("terra").notNull(),
  externalUserId: varchar("externalUserId", { length: 180 }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: timestamp("tokenExpiresAt"),
  scope: text("scope"),
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

export const exerciseLogEntries = mysqlTable("exerciseLogEntries", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  programId: int("programId").notNull(),
  exerciseKey: varchar("exerciseKey", { length: 120 }).notNull(),
  exerciseName: text("exerciseName").notNull(),
  sets: int("sets").default(0).notNull(),
  reps: int("reps").default(0).notNull(),
  weight: int("weight").default(0).notNull(),
  notes: text("notes"),
  loggedAt: timestamp("loggedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const stripeCustomers = mysqlTable("stripeCustomers", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().unique(),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const stripeSubscriptions = mysqlTable("stripeSubscriptions", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }).notNull().unique(),
  stripePriceId: varchar("stripePriceId", { length: 255 }).notNull(),
  tier: mysqlEnum("tier", ["starter", "pro", "elite"]).notNull(),
  status: mysqlEnum("subscriptionStatus", ["active", "past_due", "canceled", "unpaid"]).notNull(),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  canceledAt: timestamp("canceledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const stripeInvoices = mysqlTable("stripeInvoices", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  stripeInvoiceId: varchar("stripeInvoiceId", { length: 255 }).notNull().unique(),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  amount: int("amount").notNull(), // in cents
  currency: varchar("currency", { length: 3 }).default("usd").notNull(),
  status: mysqlEnum("invoiceStatus", ["draft", "open", "paid", "void", "uncollectible"]).notNull(),
  paidAt: timestamp("paidAt"),
  dueDate: timestamp("dueDate"),
  periodStart: timestamp("periodStart"),
  periodEnd: timestamp("periodEnd"),
  invoiceUrl: text("invoiceUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type JimmiProfile = typeof jimmiProfiles.$inferSelect;
export type InsertJimmiProfile = typeof jimmiProfiles.$inferInsert;
export type FoodLogEntry = typeof foodLogEntries.$inferSelect;
export type InsertFoodLogEntry = typeof foodLogEntries.$inferInsert;
export type JimmiProgram = typeof jimmiPrograms.$inferSelect;
export type InsertJimmiProgram = typeof jimmiPrograms.$inferInsert;
export type ProgramGenerationEvent = typeof programGenerationEvents.$inferSelect;
export type InsertProgramGenerationEvent = typeof programGenerationEvents.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;
export type WearableConnection = typeof wearableConnections.$inferSelect;
export type InsertWearableConnection = typeof wearableConnections.$inferInsert;
export type CalorieOutSummary = typeof calorieOutSummaries.$inferSelect;
export type InsertCalorieOutSummary = typeof calorieOutSummaries.$inferInsert;
export type ExerciseLogEntry = typeof exerciseLogEntries.$inferSelect;
export type InsertExerciseLogEntry = typeof exerciseLogEntries.$inferInsert;

export type AccountSettings = typeof accountSettings.$inferSelect;
export type InsertAccountSettings = typeof accountSettings.$inferInsert;
export type StripeCustomer = typeof stripeCustomers.$inferSelect;
export type InsertStripeCustomer = typeof stripeCustomers.$inferInsert;
export type StripeSubscription = typeof stripeSubscriptions.$inferSelect;
export type InsertStripeSubscription = typeof stripeSubscriptions.$inferInsert;
export type StripeInvoice = typeof stripeInvoices.$inferSelect;
export type InsertStripeInvoice = typeof stripeInvoices.$inferInsert;
