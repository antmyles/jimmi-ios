import type { Request, Response } from "express";
import { deleteExpiredChatMessages } from "./db";

export async function sendScheduledReminders(_req: Request, res: Response) {
  const utcHour = new Date().getUTCHours();
  console.log(`[JIMMI Scheduled] UTC hour ${utcHour}. Scheduled content is disabled during the clean rebuild foundation phase.`);
  res.json({ success: true, deferred: true, utcHour, phase: "clean-foundation" });
}

export async function cleanupExpiredChats(req: Request, res: Response) {
  const startedAt = new Date();
  try {
    const result = await deleteExpiredChatMessages(startedAt);
    console.log(`[JIMMI Scheduled] Chat retention cleanup removed ${result.deleted} expired messages before ${result.cutoff.toISOString()}.`);
    res.json({ success: true, deleted: result.deleted, retentionDays: 7, cutoff: result.cutoff.toISOString(), taskUid: req.headers["x-manus-cron-task-uid"] ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ success: false, error: message, context: { url: req.originalUrl }, timestamp: new Date().toISOString() });
  }
}
