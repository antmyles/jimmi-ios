import { db } from "./_core/db";
import { wearableConnections, calorieOutSummaries } from "../drizzle/schema";
import { eq, and, lt } from "drizzle-orm";

export const APPLE_HEALTH_PROVIDER = "apple_health";

export function isAppleHealthConfigured(): boolean {
  return true;
}

export async function connectAppleHealth(userId: number): Promise<void> {
  const existing = await db
    .select()
    .from(wearableConnections)
    .where(
      and(
        eq(wearableConnections.userId, userId),
        eq(wearableConnections.provider, APPLE_HEALTH_PROVIDER)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(wearableConnections)
      .set({ status: "connected", lastSyncedAt: new Date() })
      .where(
        and(
          eq(wearableConnections.userId, userId),
          eq(wearableConnections.provider, APPLE_HEALTH_PROVIDER)
        )
      );
  } else {
    await db.insert(wearableConnections).values({
      userId,
      provider: APPLE_HEALTH_PROVIDER,
      status: "connected",
      connectedAt: new Date(),
      lastSyncedAt: new Date(),
    });
  }
}

export async function disconnectAppleHealth(userId: number): Promise<void> {
  await db
    .update(wearableConnections)
    .set({ status: "disconnected" })
    .where(
      and(
        eq(wearableConnections.userId, userId),
        eq(wearableConnections.provider, APPLE_HEALTH_PROVIDER)
      )
    );
}

export async function getAppleHealthConnection(userId: number) {
  const rows = await db
    .select()
    .from(wearableConnections)
    .where(
      and(
        eq(wearableConnections.userId, userId),
        eq(wearableConnections.provider, APPLE_HEALTH_PROVIDER)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function saveAppleHealthCalories(
  userId: number,
  logDate: string,
  activeCalories: number,
  restingCalories: number,
  connectionId?: number
): Promise<void> {
  const totalCalories = activeCalories + restingCalories;

  const existing = await db
    .select()
    .from(calorieOutSummaries)
    .where(
      and(
        eq(calorieOutSummaries.userId, userId),
        eq(calorieOutSummaries.logDate, logDate),
        eq(calorieOutSummaries.sourceProvider, APPLE_HEALTH_PROVIDER)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(calorieOutSummaries)
      .set({ activeCalories, restingCalories, totalCalories, updatedAt: new Date() })
      .where(
        and(
          eq(calorieOutSummaries.userId, userId),
          eq(calorieOutSummaries.logDate, logDate),
          eq(calorieOutSummaries.sourceProvider, APPLE_HEALTH_PROVIDER)
        )
      );
  } else {
    await db.insert(calorieOutSummaries).values({
      userId,
      logDate,
      activeCalories,
      restingCalories,
      totalCalories,
      sourceProvider: APPLE_HEALTH_PROVIDER,
      sourceConfidence: "synced",
      wearableConnectionId: connectionId ?? null,
    });
  }
}

export async function pruneOldAppleHealthData(userId: number): Promise<void> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  await db
    .delete(calorieOutSummaries)
    .where(
      and(
        eq(calorieOutSummaries.userId, userId),
        eq(calorieOutSummaries.sourceProvider, APPLE_HEALTH_PROVIDER),
        lt(calorieOutSummaries.createdAt, sevenDaysAgo)
      )
    );
}
