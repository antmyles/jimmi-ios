/**
 * Health Dashboard Screen
 * 
 * Displays synced health data from Apple HealthKit including workouts,
 * steps, sleep, and calorie tracking with pull-to-refresh capability.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { healthService } from '../services/healthService';
import { healthSyncScheduler } from '../services/healthSyncScheduler';
import { WorkoutData, StepsData, SleepData, CalorieData } from '../types';

const { width } = Dimensions.get('window');

export function HealthDashboardScreen() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [workouts, setWorkouts] = useState<WorkoutData[]>([]);
  const [steps, setSteps] = useState<StepsData[]>([]);
  const [sleep, setSleep] = useState<SleepData[]>([]);
  const [calories, setCalories] = useState<CalorieData[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load health data on mount
  useEffect(() => {
    loadHealthData();
  }, []);

  // Initialize sync scheduler
  useEffect(() => {
    if (user) {
      healthSyncScheduler.initialize({
        intervalMinutes: 30,
        syncOnAppStart: false, // We're loading manually
        syncOnAppForeground: true,
      });
    }

    return () => {
      healthSyncScheduler.stop();
    };
  }, [user]);

  const loadHealthData = useCallback(async () => {
    if (!user) return;

    try {
      setError(null);
      setIsLoading(true);

      const [workoutData, stepsData, sleepData, calorieData] = await Promise.all([
        healthService.getWorkouts({ limit: 20 }),
        healthService.getSteps({ limit: 30 }),
        healthService.getSleep({ limit: 30 }),
        healthService.getCalories({ limit: 30 }),
      ]);

      setWorkouts(workoutData);
      setSteps(stepsData);
      setSleep(sleepData);
      setCalories(calorieData);
    } catch (err) {
      console.error('Failed to load health data:', err);
      setError('Failed to load health data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await healthSyncScheduler.syncNow();
      await loadHealthData();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadHealthData]);

  if (!user) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Please log in to view health data</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color="#E8FF00" />
        <Text style={styles.loadingText}>Loading health data...</Text>
      </View>
    );
  }

  const todaySteps = steps[0]?.count ?? 0;
  const todayCalories = calories[0];
  const lastWorkout = workouts[0];
  const lastSleep = sleep[0];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor="#E8FF00"
        />
      }
    >
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Steps Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Steps Today</Text>
        <View style={styles.cardContent}>
          <Text style={styles.largeNumber}>{todaySteps.toLocaleString()}</Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.min((todaySteps / 10000) * 100, 100)}%` },
              ]}
            />
          </View>
          <Text style={styles.progressLabel}>Goal: 10,000 steps</Text>
        </View>
      </View>

      {/* Calories Card */}
      {todayCalories && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Calories Burned</Text>
          <View style={styles.cardContent}>
            <View style={styles.calorieRow}>
              <View style={styles.calorieItem}>
                <Text style={styles.calorieLabel}>Active</Text>
                <Text style={styles.calorieValue}>
                  {todayCalories.burned ?? 0}
                </Text>
                <Text style={styles.calorieUnit}>kcal</Text>
              </View>
              <View style={styles.calorieItem}>
                <Text style={styles.calorieLabel}>Total</Text>
                <Text style={styles.calorieValue}>
                  {(todayCalories.burned ?? 0) + 1800}
                </Text>
                <Text style={styles.calorieUnit}>kcal</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Last Workout Card */}
      {lastWorkout && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Last Workout</Text>
          <View style={styles.cardContent}>
            <View style={styles.workoutRow}>
              <View>
                <Text style={styles.workoutType}>
                  {lastWorkout.type.replace(/_/g, ' ').toUpperCase()}
                </Text>
                <Text style={styles.workoutDate}>
                  {new Date(lastWorkout.date).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.workoutStats}>
                <Text style={styles.workoutStat}>
                  {lastWorkout.duration} min
                </Text>
                <Text style={styles.workoutStat}>
                  {lastWorkout.calories} kcal
                </Text>
                {lastWorkout.distance && (
                  <Text style={styles.workoutStat}>
                    {lastWorkout.distance.toFixed(1)} km
                  </Text>
                )}
              </View>
            </View>
          </View>
        </View>
      )}

      {/* Sleep Card */}
      {lastSleep && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Last Sleep</Text>
          <View style={styles.cardContent}>
            <View style={styles.sleepRow}>
              <View>
                <Text style={styles.sleepDuration}>
                  {Math.round(lastSleep.duration / 60)} hours{' '}
                  {lastSleep.duration % 60} min
                </Text>
                <Text style={styles.sleepDate}>
                  {new Date(lastSleep.date).toLocaleDateString()}
                </Text>
              </View>
              {lastSleep.quality && (
                <View style={styles.sleepQuality}>
                  <Text style={styles.sleepQualityLabel}>Quality</Text>
                  <Text style={styles.sleepQualityValue}>
                    {lastSleep.quality}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {/* Workouts List */}
      {workouts.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Recent Workouts</Text>
          <View style={styles.cardContent}>
            {workouts.slice(0, 5).map((workout, index) => (
              <View
                key={index}
                style={[
                  styles.listItem,
                  index < workouts.length - 1 && styles.listItemBorder,
                ]}
              >
                <View>
                  <Text style={styles.listItemTitle}>
                    {workout.type.replace(/_/g, ' ')}
                  </Text>
                  <Text style={styles.listItemDate}>
                    {new Date(workout.date).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.listItemValue}>
                  {workout.duration} min • {workout.calories} kcal
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Sync Status */}
      <View style={styles.syncStatus}>
        <Text style={styles.syncStatusText}>
          Last synced:{' '}
          {healthSyncScheduler.getStats().lastSyncTime
            ? new Date(
                healthSyncScheduler.getStats().lastSyncTime!
              ).toLocaleTimeString()
            : 'Never'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    padding: 16,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FAFAFA',
    marginBottom: 12,
  },
  cardContent: {
    gap: 12,
  },
  largeNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#E8FF00',
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#E8FF00',
  },
  progressLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  calorieRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  calorieItem: {
    alignItems: 'center',
  },
  calorieLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginBottom: 4,
  },
  calorieValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#E8FF00',
  },
  calorieUnit: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  workoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  workoutType: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FAFAFA',
  },
  workoutDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  workoutStats: {
    alignItems: 'flex-end',
    gap: 4,
  },
  workoutStat: {
    fontSize: 12,
    color: '#E8FF00',
  },
  sleepRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sleepDuration: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FAFAFA',
  },
  sleepDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  sleepQuality: {
    alignItems: 'center',
  },
  sleepQualityLabel: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  sleepQualityValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#E8FF00',
    marginTop: 4,
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  listItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  listItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FAFAFA',
  },
  listItemDate: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },
  listItemValue: {
    fontSize: 12,
    color: '#E8FF00',
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#EF4444',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
  },
  loadingText: {
    color: '#FAFAFA',
    fontSize: 14,
    marginTop: 12,
  },
  syncStatus: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  syncStatusText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
});
