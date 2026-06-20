import { HealthKitData, getHealthKitAuthorizationStatus, requestHealthKitAuthorization, queryHealthKitSampleType } from 'expo-health';
import { WorkoutData, StepsData, SleepData, CalorieData } from '../types';
import { authService } from './authService';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api/trpc';

export class HealthService {
  private static instance: HealthService;

  private constructor() {}

  static getInstance(): HealthService {
    if (!HealthService.instance) {
      HealthService.instance = new HealthService();
    }
    return HealthService.instance;
  }

  async requestHealthKitPermissions(): Promise<boolean> {
    try {
      const permissions = [
        'HKWorkoutTypeIdentifier',
        'HKStepCountSampleTypeIdentifier',
        'HKCategoryTypeIdentifierSleepAnalysis',
        'HKEnergyBurned',
      ];

      const result = await requestHealthKitAuthorization(permissions);
      return result;
    } catch (error) {
      console.error('Failed to request HealthKit permissions:', error);
      return false;
    }
  }

  async fetchWorkouts(startDate: Date, endDate: Date): Promise<WorkoutData[]> {
    try {
      // This is a simplified example - actual implementation depends on expo-health API
      const workouts: WorkoutData[] = [];
      
      // Query HKWorkoutTypeIdentifier from HealthKit
      // Parse and convert to WorkoutData format
      
      return workouts;
    } catch (error) {
      console.error('Failed to fetch workouts:', error);
      return [];
    }
  }

  async fetchSteps(startDate: Date, endDate: Date): Promise<StepsData[]> {
    try {
      const steps: StepsData[] = [];
      
      // Query HKStepCountSampleTypeIdentifier from HealthKit
      // Parse and convert to StepsData format
      
      return steps;
    } catch (error) {
      console.error('Failed to fetch steps:', error);
      return [];
    }
  }

  async fetchSleep(startDate: Date, endDate: Date): Promise<SleepData[]> {
    try {
      const sleep: SleepData[] = [];
      
      // Query HKCategoryTypeIdentifierSleepAnalysis from HealthKit
      // Parse and convert to SleepData format
      
      return sleep;
    } catch (error) {
      console.error('Failed to fetch sleep:', error);
      return [];
    }
  }

  async fetchCalories(startDate: Date, endDate: Date): Promise<CalorieData[]> {
    try {
      const calories: CalorieData[] = [];
      
      // Query HKEnergyBurned from HealthKit
      // Parse and convert to CalorieData format
      
      return calories;
    } catch (error) {
      console.error('Failed to fetch calories:', error);
      return [];
    }
  }

  /**
   * Sync workouts to backend via tRPC
   */
  async syncWorkouts(workouts: WorkoutData[]): Promise<boolean> {
    try {
      const token = authService.getToken();
      if (!token) throw new Error('User not authenticated');

      const payload = workouts.map(w => ({
        startTime: new Date(w.date),
        endTime: new Date(new Date(w.date).getTime() + w.duration * 60000),
        workoutType: w.type,
        duration: w.duration,
        calories: w.calories,
        distance: w.distance,
      }));

      const response = await fetch(`${API_BASE_URL}/health.syncWorkouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          json: payload,
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return true;
    } catch (error) {
      console.error('Failed to sync workouts:', error);
      return false;
    }
  }

  /**
   * Get workouts from backend via tRPC
   */
  async getWorkouts(limit?: number): Promise<WorkoutData[]> {
    try {
      const token = authService.getToken();
      if (!token) throw new Error('User not authenticated');

      const response = await fetch(`${API_BASE_URL}/health.getWorkouts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          json: { limit: limit ?? 50 },
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      return (data.result?.data ?? []).map((w: any) => ({
        id: w.id.toString(),
        date: new Date(w.startTime),
        type: w.workoutType,
        duration: w.duration,
        calories: w.calories ?? 0,
        distance: w.distance,
      }));
    } catch (error) {
      console.error('Failed to get workouts:', error);
      return [];
    }
  }

  /**
   * Sync steps to backend via tRPC
   */
  async syncSteps(steps: StepsData[]): Promise<boolean> {
    try {
      const token = authService.getToken();
      if (!token) throw new Error('User not authenticated');

      for (const step of steps) {
        const logDate = step.date.toISOString().split('T')[0]; // YYYY-MM-DD
        
        const response = await fetch(`${API_BASE_URL}/health.syncSteps`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            json: {
              logDate,
              stepCount: step.count,
            },
          }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      }
      return true;
    } catch (error) {
      console.error('Failed to sync steps:', error);
      return false;
    }
  }

  /**
   * Get steps from backend via tRPC
   */
  async getSteps(limit?: number): Promise<StepsData[]> {
    try {
      const token = authService.getToken();
      if (!token) throw new Error('User not authenticated');

      const response = await fetch(`${API_BASE_URL}/health.getSteps`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          json: { limit: limit ?? 30 },
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      return (data.result?.data ?? []).map((s: any) => ({
        date: new Date(s.logDate),
        count: s.stepCount,
      }));
    } catch (error) {
      console.error('Failed to get steps:', error);
      return [];
    }
  }

  /**
   * Sync sleep to backend via tRPC
   */
  async syncSleep(sleep: SleepData[]): Promise<boolean> {
    try {
      const token = authService.getToken();
      if (!token) throw new Error('User not authenticated');

      for (const s of sleep) {
        const endTime = new Date(s.date.getTime() + s.duration * 60000);
        
        const response = await fetch(`${API_BASE_URL}/health.syncSleep`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            json: {
              startTime: s.date,
              endTime,
              duration: s.duration,
              quality: s.quality,
            },
          }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      }
      return true;
    } catch (error) {
      console.error('Failed to sync sleep:', error);
      return false;
    }
  }

  /**
   * Get sleep from backend via tRPC
   */
  async getSleep(limit?: number): Promise<SleepData[]> {
    try {
      const token = authService.getToken();
      if (!token) throw new Error('User not authenticated');

      const response = await fetch(`${API_BASE_URL}/health.getSleep`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          json: { limit: limit ?? 30 },
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      return (data.result?.data ?? []).map((s: any) => ({
        date: new Date(s.startTime),
        duration: Math.round((new Date(s.endTime).getTime() - new Date(s.startTime).getTime()) / 60000),
        quality: s.quality,
      }));
    } catch (error) {
      console.error('Failed to get sleep:', error);
      return [];
    }
  }

  /**
   * Sync calories to backend via tRPC
   */
  async syncCalories(calories: CalorieData[]): Promise<boolean> {
    try {
      const token = authService.getToken();
      if (!token) throw new Error('User not authenticated');

      for (const cal of calories) {
        const logDate = cal.date.toISOString().split('T')[0]; // YYYY-MM-DD
        
        const response = await fetch(`${API_BASE_URL}/health.syncCalories`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            json: {
              logDate,
              activeCalories: cal.burned,
              restingCalories: 0, // Will be calculated by backend if needed
              totalCalories: cal.burned,
            },
          }),
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      }
      return true;
    } catch (error) {
      console.error('Failed to sync calories:', error);
      return false;
    }
  }

  /**
   * Get calories from backend via tRPC
   */
  async getCalories(limit?: number): Promise<CalorieData[]> {
    try {
      const token = authService.getToken();
      if (!token) throw new Error('User not authenticated');

      const response = await fetch(`${API_BASE_URL}/health.getCalories`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          json: { limit: limit ?? 30 },
        }),
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      
      return (data.result?.data ?? []).map((c: any) => ({
        date: new Date(c.logDate),
        burned: c.activeCalories ?? 0,
        consumed: undefined,
      }));
    } catch (error) {
      console.error('Failed to get calories:', error);
      return [];
    }
  }

  /**
   * Sync all health data to backend
   */
  async syncHealthDataToBackend(
    workouts: WorkoutData[],
    steps: StepsData[],
    sleep: SleepData[],
    calories: CalorieData[]
  ): Promise<boolean> {
    try {
      const results = await Promise.all([
        workouts.length > 0 ? this.syncWorkouts(workouts) : Promise.resolve(true),
        steps.length > 0 ? this.syncSteps(steps) : Promise.resolve(true),
        sleep.length > 0 ? this.syncSleep(sleep) : Promise.resolve(true),
        calories.length > 0 ? this.syncCalories(calories) : Promise.resolve(true),
      ]);

      return results.every(r => r === true);
    } catch (error) {
      console.error('Failed to sync health data:', error);
      return false;
    }
  }

  async saveWorkoutToHealthKit(workout: WorkoutData): Promise<boolean> {
    try {
      // Save workout back to HealthKit
      // Implementation depends on expo-health API capabilities
      
      return true;
    } catch (error) {
      console.error('Failed to save workout to HealthKit:', error);
      return false;
    }
  }
}

export const healthService = HealthService.getInstance();
