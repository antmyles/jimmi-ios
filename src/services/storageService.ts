/**
 * Local Storage Service
 * 
 * Manages persistent local storage for offline support and caching.
 * Uses AsyncStorage for React Native to persist data across app sessions.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutData, StepsData, SleepData, CalorieData } from '../types';

const STORAGE_KEYS = {
  HEALTH_WORKOUTS: '@jimmi/health_workouts',
  HEALTH_STEPS: '@jimmi/health_steps',
  HEALTH_SLEEP: '@jimmi/health_sleep',
  HEALTH_CALORIES: '@jimmi/health_calories',
  LAST_SYNC_TIME: '@jimmi/last_sync_time',
  PENDING_SYNCS: '@jimmi/pending_syncs',
  USER_PROFILE: '@jimmi/user_profile',
  AUTH_TOKEN: '@jimmi/auth_token',
};

export interface PendingSyncItem {
  type: 'workout' | 'steps' | 'sleep' | 'calories';
  data: WorkoutData | StepsData | SleepData | CalorieData;
  timestamp: number;
  retryCount: number;
}

export class StorageService {
  private static instance: StorageService;

  private constructor() {}

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService();
    }
    return StorageService.instance;
  }

  /**
   * Save workouts to local storage
   */
  async saveWorkouts(workouts: WorkoutData[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.HEALTH_WORKOUTS,
        JSON.stringify(workouts)
      );
      console.log(`[Storage] Saved ${workouts.length} workouts`);
    } catch (error) {
      console.error('Failed to save workouts:', error);
      throw error;
    }
  }

  /**
   * Get cached workouts from local storage
   */
  async getWorkouts(): Promise<WorkoutData[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.HEALTH_WORKOUTS);
      if (!data) return [];
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to get workouts:', error);
      return [];
    }
  }

  /**
   * Save steps to local storage
   */
  async saveSteps(steps: StepsData[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.HEALTH_STEPS,
        JSON.stringify(steps)
      );
      console.log(`[Storage] Saved ${steps.length} step records`);
    } catch (error) {
      console.error('Failed to save steps:', error);
      throw error;
    }
  }

  /**
   * Get cached steps from local storage
   */
  async getSteps(): Promise<StepsData[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.HEALTH_STEPS);
      if (!data) return [];
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to get steps:', error);
      return [];
    }
  }

  /**
   * Save sleep to local storage
   */
  async saveSleep(sleep: SleepData[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.HEALTH_SLEEP,
        JSON.stringify(sleep)
      );
      console.log(`[Storage] Saved ${sleep.length} sleep records`);
    } catch (error) {
      console.error('Failed to save sleep:', error);
      throw error;
    }
  }

  /**
   * Get cached sleep from local storage
   */
  async getSleep(): Promise<SleepData[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.HEALTH_SLEEP);
      if (!data) return [];
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to get sleep:', error);
      return [];
    }
  }

  /**
   * Save calories to local storage
   */
  async saveCalories(calories: CalorieData[]): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.HEALTH_CALORIES,
        JSON.stringify(calories)
      );
      console.log(`[Storage] Saved ${calories.length} calorie records`);
    } catch (error) {
      console.error('Failed to save calories:', error);
      throw error;
    }
  }

  /**
   * Get cached calories from local storage
   */
  async getCalories(): Promise<CalorieData[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.HEALTH_CALORIES);
      if (!data) return [];
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to get calories:', error);
      return [];
    }
  }

  /**
   * Save last sync time
   */
  async setLastSyncTime(timestamp: number): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.LAST_SYNC_TIME,
        timestamp.toString()
      );
    } catch (error) {
      console.error('Failed to save last sync time:', error);
    }
  }

  /**
   * Get last sync time
   */
  async getLastSyncTime(): Promise<number | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC_TIME);
      return data ? parseInt(data, 10) : null;
    } catch (error) {
      console.error('Failed to get last sync time:', error);
      return null;
    }
  }

  /**
   * Add item to pending sync queue (for offline support)
   */
  async addPendingSync(item: PendingSyncItem): Promise<void> {
    try {
      const pending = await this.getPendingSyncs();
      pending.push(item);
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_SYNCS,
        JSON.stringify(pending)
      );
      console.log(`[Storage] Added pending sync: ${item.type}`);
    } catch (error) {
      console.error('Failed to add pending sync:', error);
    }
  }

  /**
   * Get all pending syncs
   */
  async getPendingSyncs(): Promise<PendingSyncItem[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SYNCS);
      if (!data) return [];
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to get pending syncs:', error);
      return [];
    }
  }

  /**
   * Remove item from pending sync queue
   */
  async removePendingSync(index: number): Promise<void> {
    try {
      const pending = await this.getPendingSyncs();
      pending.splice(index, 1);
      await AsyncStorage.setItem(
        STORAGE_KEYS.PENDING_SYNCS,
        JSON.stringify(pending)
      );
    } catch (error) {
      console.error('Failed to remove pending sync:', error);
    }
  }

  /**
   * Clear all pending syncs
   */
  async clearPendingSyncs(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.PENDING_SYNCS);
      console.log('[Storage] Cleared all pending syncs');
    } catch (error) {
      console.error('Failed to clear pending syncs:', error);
    }
  }

  /**
   * Save user profile
   */
  async saveUserProfile(profile: any): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.USER_PROFILE,
        JSON.stringify(profile)
      );
    } catch (error) {
      console.error('Failed to save user profile:', error);
    }
  }

  /**
   * Get cached user profile
   */
  async getUserProfile(): Promise<any | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Failed to get user profile:', error);
      return null;
    }
  }

  /**
   * Save auth token
   */
  async saveAuthToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
    } catch (error) {
      console.error('Failed to save auth token:', error);
    }
  }

  /**
   * Get cached auth token
   */
  async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);
    } catch (error) {
      console.error('Failed to get auth token:', error);
      return null;
    }
  }

  /**
   * Clear all cached data
   */
  async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(Object.values(STORAGE_KEYS));
      console.log('[Storage] Cleared all cached data');
    } catch (error) {
      console.error('Failed to clear all data:', error);
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    workoutCount: number;
    stepRecordCount: number;
    sleepRecordCount: number;
    calorieRecordCount: number;
    pendingSyncCount: number;
  }> {
    try {
      const [workouts, steps, sleep, calories, pending] = await Promise.all([
        this.getWorkouts(),
        this.getSteps(),
        this.getSleep(),
        this.getCalories(),
        this.getPendingSyncs(),
      ]);

      return {
        workoutCount: workouts.length,
        stepRecordCount: steps.length,
        sleepRecordCount: sleep.length,
        calorieRecordCount: calories.length,
        pendingSyncCount: pending.length,
      };
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return {
        workoutCount: 0,
        stepRecordCount: 0,
        sleepRecordCount: 0,
        calorieRecordCount: 0,
        pendingSyncCount: 0,
      };
    }
  }
}

export const storageService = StorageService.getInstance();
