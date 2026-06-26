import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

// Only import HealthKit on iOS
let Healthkit: any = null;
if (Platform.OS === "ios") {
  try {
    Healthkit = require("@kingstinct/react-native-healthkit").default;
  } catch (e) {
    console.warn("HealthKit not available:", e);
  }
}

// HealthKit quantity types we want to read
const READ_TYPES = [
  "HKQuantityTypeIdentifierActiveEnergyBurned",
  "HKQuantityTypeIdentifierBasalEnergyBurned",
  "HKQuantityTypeIdentifierStepCount",
  "HKQuantityTypeIdentifierHeartRate",
  "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
  "HKCategoryTypeIdentifierSleepAnalysis",
  "HKWorkoutTypeIdentifier",
];

export async function requestAppleHealthPermissions(): Promise<boolean> {
  if (Platform.OS !== "ios" || !Healthkit) return false;
  try {
    await Healthkit.requestAuthorization(READ_TYPES, []);
    return true;
  } catch (e) {
    console.error("HealthKit permission error:", e);
    return false;
  }
}

export async function fetchTodayCalories(): Promise<{
  activeCalories: number;
  restingCalories: number;
}> {
  if (Platform.OS !== "ios" || !Healthkit) {
    return { activeCalories: 0, restingCalories: 0 };
  }
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const [activeSamples, restingSamples] = await Promise.all([
      Healthkit.queryQuantitySamples(
        "HKQuantityTypeIdentifierActiveEnergyBurned",
        { from: startOfDay, to: now, unit: "kcal" }
      ),
      Healthkit.queryQuantitySamples(
        "HKQuantityTypeIdentifierBasalEnergyBurned",
        { from: startOfDay, to: now, unit: "kcal" }
      ),
    ]);

    const activeCalories = activeSamples.reduce(
      (sum: number, s: any) => sum + (s.quantity ?? 0),
      0
    );
    const restingCalories = restingSamples.reduce(
      (sum: number, s: any) => sum + (s.quantity ?? 0),
      0
    );

    return {
      activeCalories: Math.round(activeCalories),
      restingCalories: Math.round(restingCalories),
    };
  } catch (e) {
    console.error("Error fetching calories:", e);
    return { activeCalories: 0, restingCalories: 0 };
  }
}

export async function fetchMostRecentWorkout(): Promise<{
  workoutType: string;
  duration: number;
  activeCalories: number;
  startDate: Date;
  endDate: Date;
} | null> {
  if (Platform.OS !== "ios" || !Healthkit) return null;
  try {
    const workouts = await Healthkit.queryWorkoutSamples({
      limit: 1,
      ascending: false,
    });
    if (!workouts || workouts.length === 0) return null;
    const w = workouts[0];
    return {
      workoutType: w.workoutActivityType ?? "Other",
      duration: w.duration ?? 0,
      activeCalories: Math.round(w.totalEnergyBurned?.quantity ?? 0),
      startDate: new Date(w.startDate),
      endDate: new Date(w.endDate),
    };
  } catch (e) {
    console.error("Error fetching workout:", e);
    return null;
  }
}

export async function subscribeToWorkouts(
  onNewWorkout: (workout: {
    workoutType: string;
    duration: number;
    activeCalories: number;
    startDate: Date;
    endDate: Date;
  }) => void
): Promise<() => void> {
  if (Platform.OS !== "ios" || !Healthkit) return () => {};
  try {
    const subscription = await Healthkit.subscribeToChanges(
      "HKWorkoutTypeIdentifier",
      async () => {
        const workout = await fetchMostRecentWorkout();
        if (workout) onNewWorkout(workout);
      }
    );
    return () => {
      if (subscription && typeof subscription.remove === "function") {
        subscription.remove();
      }
    };
  } catch (e) {
    console.error("Error subscribing to workouts:", e);
    return () => {};
  }
}

export async function sendWorkoutNotification(workout: {
  workoutType: string;
  activeCalories: number;
}): Promise<string | null> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== "granted") return null;

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Workout Complete",
        body: `Would you like to log this workout to your calorie tracker with JIMMI?`,
        data: {
          type: "workout_complete",
          workoutType: workout.workoutType,
          activeCalories: workout.activeCalories,
        },
        sound: true,
      },
      trigger: null, // deliver immediately
    });

    return notificationId;
  } catch (e) {
    console.error("Error sending workout notification:", e);
    return null;
  }
}

export function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
