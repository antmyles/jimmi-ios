import { useEffect, useRef, useCallback } from "react";
import { Platform, AppState } from "react-native";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  requestAppleHealthPermissions,
  subscribeToWorkouts,
  sendWorkoutNotification,
  fetchTodayCalories,
  getTodayDateString,
} from "../services/appleHealth";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "https://askjimmi.com/api";

// Configure notification handler once
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

async function getAuthToken(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem("auth_token");
  } catch {
    return null;
  }
}

async function syncCaloriesToBackend(
  logDate: string,
  activeCalories: number,
  restingCalories: number
): Promise<void> {
  // Build headers — prefer shared WebView cookie (credentials: include),
  // fall back to Bearer token for native Google/Apple sign-in flows
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  try {
    await fetch(`${API_BASE_URL}/trpc/account.syncAppleHealthCalories`, {
      method: "POST",
      credentials: "include", // sends shared WebView cookie automatically on iOS
      headers,
      body: JSON.stringify({
        json: { logDate, activeCalories, restingCalories },
      }),
    });
  } catch (e) {
    console.error("[AppleHealth] Failed to sync calories:", e);
  }
}

export function useAppleHealth(isConnected: boolean) {
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const lastWorkoutEndRef = useRef<Date | null>(null);

  const handleWorkout = useCallback(
    async (workout: {
      workoutType: string;
      duration: number;
      activeCalories: number;
      startDate: Date;
      endDate: Date;
    }) => {
      // Debounce: ignore if same workout end time seen within 5s
      if (
        lastWorkoutEndRef.current &&
        Math.abs(workout.endDate.getTime() - lastWorkoutEndRef.current.getTime()) < 5000
      ) {
        return;
      }
      lastWorkoutEndRef.current = workout.endDate;
      await sendWorkoutNotification({
        workoutType: workout.workoutType,
        activeCalories: workout.activeCalories,
      });
    },
    []
  );

  // Handle notification tap — user confirmed logging the workout
  useEffect(() => {
    if (!isConnected || Platform.OS !== "ios") return;

    const subscription = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const data = response.notification.request.content.data as any;
        if (data?.type === "workout_complete") {
          const calories = await fetchTodayCalories();
          await syncCaloriesToBackend(
            getTodayDateString(),
            calories.activeCalories,
            calories.restingCalories
          );
        }
      }
    );

    return () => subscription.remove();
  }, [isConnected]);

  // Subscribe to HealthKit workout changes
  useEffect(() => {
    if (!isConnected || Platform.OS !== "ios") return;

    let active = true;

    const setup = async () => {
      const granted = await requestAppleHealthPermissions();
      if (!granted || !active) return;
      const unsub = await subscribeToWorkouts(handleWorkout);
      if (active) {
        unsubscribeRef.current = unsub;
      } else {
        unsub();
      }
    };

    setup();

    return () => {
      active = false;
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [isConnected, handleWorkout]);

  // Sync calories when app comes to foreground
  useEffect(() => {
    if (!isConnected || Platform.OS !== "ios") return;

    const sub = AppState.addEventListener("change", async (nextState) => {
      if (nextState === "active") {
        const calories = await fetchTodayCalories();
        if (calories.activeCalories > 0 || calories.restingCalories > 0) {
          await syncCaloriesToBackend(
            getTodayDateString(),
            calories.activeCalories,
            calories.restingCalories
          );
        }
      }
    });

    return () => sub.remove();
  }, [isConnected]);
}
