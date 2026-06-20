/**
 * Health Data Sync Scheduler
 * 
 * Manages periodic syncing of health data from HealthKit to the backend.
 * Handles retry logic, error recovery, and background sync scheduling.
 */

import { healthKitService } from './healthKitService';
import { healthService } from './healthService';

export interface SyncScheduleConfig {
  intervalMinutes?: number; // How often to sync (default: 30 minutes)
  maxRetries?: number; // Max retry attempts (default: 3)
  retryDelayMs?: number; // Delay between retries (default: 5000ms)
  syncOnAppStart?: boolean; // Sync when app starts (default: true)
  syncOnAppForeground?: boolean; // Sync when app comes to foreground (default: true)
}

interface SyncState {
  isRunning: boolean;
  lastSyncTime: Date | null;
  nextSyncTime: Date | null;
  syncInProgress: boolean;
  lastError: Error | null;
  retryCount: number;
}

export class HealthSyncScheduler {
  private static instance: HealthSyncScheduler;
  private state: SyncState = {
    isRunning: false,
    lastSyncTime: null,
    nextSyncTime: null,
    syncInProgress: false,
    lastError: null,
    retryCount: 0,
  };
  private config: Required<SyncScheduleConfig> = {
    intervalMinutes: 30,
    maxRetries: 3,
    retryDelayMs: 5000,
    syncOnAppStart: true,
    syncOnAppForeground: true,
  };
  private syncTimer: NodeJS.Timeout | null = null;
  private retryTimer: NodeJS.Timeout | null = null;

  private constructor() {}

  static getInstance(): HealthSyncScheduler {
    if (!HealthSyncScheduler.instance) {
      HealthSyncScheduler.instance = new HealthSyncScheduler();
    }
    return HealthSyncScheduler.instance;
  }

  /**
   * Initialize the sync scheduler with custom config
   */
  initialize(config?: SyncScheduleConfig): void {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    if (this.config.syncOnAppStart) {
      this.syncNow();
    }

    this.start();
  }

  /**
   * Start the periodic sync scheduler
   */
  start(): void {
    if (this.state.isRunning) {
      console.log('[HealthSync] Scheduler already running');
      return;
    }

    this.state.isRunning = true;
    this.scheduleSyncTimer();
    console.log(
      `[HealthSync] Scheduler started (interval: ${this.config.intervalMinutes}m)`
    );
  }

  /**
   * Stop the periodic sync scheduler
   */
  stop(): void {
    if (!this.state.isRunning) {
      console.log('[HealthSync] Scheduler not running');
      return;
    }

    this.state.isRunning = false;
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
    console.log('[HealthSync] Scheduler stopped');
  }

  /**
   * Trigger a sync immediately
   */
  async syncNow(): Promise<boolean> {
    if (this.state.syncInProgress) {
      console.log('[HealthSync] Sync already in progress, skipping');
      return false;
    }

    this.state.syncInProgress = true;
    this.state.retryCount = 0;

    try {
      const success = await this.performSync();
      
      if (success) {
        this.state.lastSyncTime = new Date();
        this.state.lastError = null;
        this.state.retryCount = 0;
        console.log('[HealthSync] Sync completed successfully');
      } else if (this.state.retryCount < this.config.maxRetries) {
        this.scheduleRetry();
      }

      return success;
    } catch (error) {
      console.error('[HealthSync] Sync failed:', error);
      this.state.lastError = error as Error;
      
      if (this.state.retryCount < this.config.maxRetries) {
        this.scheduleRetry();
      }

      return false;
    } finally {
      this.state.syncInProgress = false;
    }
  }

  /**
   * Perform the actual sync operation
   */
  private async performSync(): Promise<boolean> {
    try {
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      console.log('[HealthSync] Fetching health data from HealthKit...');

      // Fetch data from HealthKit in parallel
      const [workouts, steps, sleep, calories] = await Promise.all([
        healthKitService.fetchWorkouts(oneDayAgo, now),
        healthKitService.fetchSteps(oneDayAgo, now),
        healthKitService.fetchSleep(oneDayAgo, now),
        healthKitService.fetchCalories(oneDayAgo, now),
      ]);

      console.log(
        `[HealthSync] Fetched: ${workouts.length} workouts, ${steps.length} step records, ` +
        `${sleep.length} sleep records, ${calories.length} calorie records`
      );

      // Sync to backend
      if (workouts.length > 0 || steps.length > 0 || sleep.length > 0 || calories.length > 0) {
        const success = await healthService.syncHealthDataToBackend(
          workouts,
          steps,
          sleep,
          calories
        );

        if (!success) {
          console.warn('[HealthSync] Backend sync failed');
          return false;
        }
      } else {
        console.log('[HealthSync] No health data to sync');
      }

      return true;
    } catch (error) {
      console.error('[HealthSync] Sync operation failed:', error);
      throw error;
    }
  }

  /**
   * Schedule the next sync timer
   */
  private scheduleSyncTimer(): void {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }

    const delayMs = this.config.intervalMinutes * 60 * 1000;
    this.state.nextSyncTime = new Date(Date.now() + delayMs);

    this.syncTimer = setTimeout(() => {
      this.syncNow();
      this.scheduleSyncTimer(); // Reschedule after sync completes
    }, delayMs);
  }

  /**
   * Schedule a retry after failure
   */
  private scheduleRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }

    this.state.retryCount++;
    const delayMs = this.config.retryDelayMs * this.state.retryCount;

    console.log(
      `[HealthSync] Scheduling retry ${this.state.retryCount}/${this.config.maxRetries} ` +
      `in ${delayMs}ms`
    );

    this.retryTimer = setTimeout(() => {
      this.syncNow();
    }, delayMs);
  }

  /**
   * Handle app coming to foreground
   */
  onAppForeground(): void {
    if (this.config.syncOnAppForeground && this.state.isRunning) {
      console.log('[HealthSync] App came to foreground, syncing now');
      this.syncNow();
    }
  }

  /**
   * Get current sync state
   */
  getState(): Readonly<SyncState> {
    return { ...this.state };
  }

  /**
   * Get sync statistics
   */
  getStats(): {
    isRunning: boolean;
    lastSyncTime: Date | null;
    nextSyncTime: Date | null;
    isSyncing: boolean;
    lastError: string | null;
    retryCount: number;
  } {
    return {
      isRunning: this.state.isRunning,
      lastSyncTime: this.state.lastSyncTime,
      nextSyncTime: this.state.nextSyncTime,
      isSyncing: this.state.syncInProgress,
      lastError: this.state.lastError?.message ?? null,
      retryCount: this.state.retryCount,
    };
  }
}

export const healthSyncScheduler = HealthSyncScheduler.getInstance();
