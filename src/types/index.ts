// Authentication types
export type AuthMethod = 'google' | 'apple' | 'email';

export interface AuthUser {
  id: number;
  email: string;
  name: string;
  openId?: string;
  googleId?: string;
  loginMethod: AuthMethod;
}

export interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

// Health data types
export interface WorkoutData {
  id: string;
  date: Date;
  type: string; // e.g., 'running', 'cycling', 'strength_training'
  duration: number; // in minutes
  calories: number;
  distance?: number; // in km
  intensity?: 'low' | 'moderate' | 'high';
  notes?: string;
}

export interface StepsData {
  date: Date;
  count: number;
}

export interface SleepData {
  date: Date;
  duration: number; // in minutes
  quality?: 'poor' | 'fair' | 'good' | 'excellent';
}

export interface CalorieData {
  date: Date;
  burned: number;
  consumed?: number;
}

export interface HealthSyncData {
  workouts: WorkoutData[];
  steps: StepsData[];
  sleep: SleepData[];
  calories: CalorieData[];
  lastSyncedAt: Date;
}

// API types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SyncHealthDataPayload {
  userId: number;
  workouts: WorkoutData[];
  steps: StepsData[];
  sleep: SleepData[];
  calories: CalorieData[];
}
