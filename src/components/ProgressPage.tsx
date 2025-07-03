import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Scale, Ruler, Dumbbell, Calendar, Target, Award } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/date';
import type { WeightEntry, BodyMeasurement, WorkoutSession, UserGoal } from '../types';

interface ProgressStats {
  weightEntries: WeightEntry[];
  measurements: BodyMeasurement[];
  workouts: WorkoutSession[];
  goals: UserGoal[];
}

export default function ProgressPage() {
  const [stats, setStats] = useState<ProgressStats>({
    weightEntries: [],
    measurements: [],
    workouts: [],
    goals: [],
  });
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'week' | 'month' | 'quarter' | 'year'>('month');

  useEffect(() => {
    loadProgressData();
  }, []);

  const loadProgressData = async () => {
    try {
      const user = await supabase.auth.getUser();
      if (!user.data.user) return;

      // Load weight entries
      const { data: weightData } = await supabase
        .from('weight_entries')
        .select('*')
        .eq('user_id', user.data.user.id)
        .order('date', { ascending: false })
        .limit(50);

      // Load measurements using new structure
      const { data: measurementData } = await supabase
        .from('body_measurement_entries')
        .select(`
          *,
          values:body_measurement_values(
            *,
            field:measurement_fields(*)
          )
        `)
        .eq('user_id', user.data.user.id)
        .order('date', { ascending: false })
        .limit(50);

      // Transform measurements to include dynamic field access
      const transformedMeasurements = (measurementData || []).map(entry => {
        const transformed: BodyMeasurement = {
          ...entry,
          values: entry.values || [],
        };

        // Add dynamic field access for backward compatibility
        entry.values?.forEach((value: any) => {
          if (value.field) {
            const fieldKey = getFieldKey(value.field.field_name);
            transformed[fieldKey] = value.value;
          }
        });

        return transformed;
      });

      // Load workouts
      const { data: workoutData } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.data.user.id)
        .eq('status', 'completed') // Only count completed workouts
        .order('date', { ascending: false })
        .limit(100);

      // Load goals
      const { data: goalData } = await supabase
        .from('user_goals')
        .select('*')
        .eq('user_id', user.data.user.id)
        .order('created_at', { ascending: false });

      setStats({
        weightEntries: weightData || [],
        measurements: transformedMeasurements,
        workouts: workoutData || [],
        goals: goalData || [],
      });
    } catch (error) {
      console.error('Error loading progress data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFieldKey = (fieldName: string): string => {
    return fieldName.toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/%/g, '_percentage')
      .replace(/[^a-z0-9_]/g, '');
  };

  const getTimeframeData = <T extends { date: string }>(data: T[]): T[] => {
    const now = new Date();
    const cutoffDate = new Date();

    switch (timeframe) {
      case 'week':
        cutoffDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        cutoffDate.setMonth(now.getMonth() - 1);
        break;
      case 'quarter':
        cutoffDate.setMonth(now.getMonth() - 3);
        break;
      case 'year':
        cutoffDate.setFullYear(now.getFullYear() - 1);
        break;
    }

    return data.filter(item => new Date(item.date) >= cutoffDate);
  };

  const getWeightProgress = () => {
    const timeframeEntries = getTimeframeData(stats.weightEntries);
    if (timeframeEntries.length < 2) return null;

    const latest = timeframeEntries[0];
    const earliest = timeframeEntries[timeframeEntries.length - 1];
    const change = latest.weight - earliest.weight;

    // Get active goal to determine if this is good progress
    const activeGoal = stats.goals.find(g => g.is_active);
    let isGoodProgress = false;
    
    if (activeGoal) {
      switch (activeGoal.goal_type) {
        case 'cutting':
          isGoodProgress = change < 0;
          break;
        case 'bulking':
          isGoodProgress = change > 0;
          break;
        case 'maintaining':
          isGoodProgress = Math.abs(change) <= 2;
          break;
      }
    }

    return {
      current: latest.weight,
      change,
      percentage: ((change / earliest.weight) * 100),
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
      isGoodProgress,
      goalType: activeGoal?.goal_type,
    };
  };

  const getBodyFatProgress = () => {
    const measurementsWithBodyFat = stats.measurements.filter(m => m.body_fat_percentage != null);
    const timeframeMeasurements = getTimeframeData(measurementsWithBodyFat);
    if (timeframeMeasurements.length < 2) return null;

    const latest = timeframeMeasurements[0];
    const earliest = timeframeMeasurements[timeframeMeasurements.length - 1];
    const change = (latest.body_fat_percentage || 0) - (earliest.body_fat_percentage || 0);

    // Body fat decrease is generally good for all goal types
    const isGoodProgress = change <= 0;

    return {
      current: latest.body_fat_percentage,
      change,
      trend: change > 0 ? 'up' : change < 0 ? 'down' : 'stable',
      isGoodProgress,
    };
  };

  const getWorkoutProgress = () => {
    const timeframeWorkouts = getTimeframeData(stats.workouts);
    const totalDuration = timeframeWorkouts.reduce((sum, w) => sum + (w.duration_minutes || 0), 0);
    const avgDuration = timeframeWorkouts.length > 0 ? totalDuration / timeframeWorkouts.length : 0;

    return {
      count: timeframeWorkouts.length,
      totalDuration,
      avgDuration: Math.round(avgDuration),
    };
  };

  const getGoalProgress = () => {
    const activeGoal = stats.goals.find(g => g.is_active);
    if (!activeGoal || !activeGoal.target_weight || !activeGoal.starting_weight) return null;

    const currentWeight = stats.weightEntries[0]?.weight;
    if (!currentWeight) return null;

    const totalChange = activeGoal.target_weight - activeGoal.starting_weight;
    const currentChange = currentWeight - activeGoal.starting_weight;
    const progressPercentage = Math.abs(totalChange) > 0 ? (currentChange / totalChange) * 100 : 0;

    return {
      goal: activeGoal,
      currentWeight,
      progressPercentage: Math.min(Math.max(progressPercentage, 0), 100),
      remaining: activeGoal.target_weight - currentWeight,
    };
  };

  const weightProgress = getWeightProgress();
  const bodyFatProgress = getBodyFatProgress();
  const workoutProgress = getWorkoutProgress();
  const goalProgress = getGoalProgress();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-gray-900">Progress</h1>
          <p className="mt-2 text-sm lg:text-base text-gray-600">Track your fitness journey and achievements.</p>
        </div>
        
        {/* Timeframe Selector */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          {(['week', 'month', 'quarter', 'year'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setTimeframe(period)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                timeframe === period
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Goal Progress */}
      {goalProgress && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Target className="h-6 w-6 text-blue-600 mr-3" />
              <div>
                <h3 className="text-base lg:text-lg font-semibold text-gray-900">Current Goal</h3>
                <p className="text-sm text-gray-600 capitalize">{goalProgress.goal.goal_type} Goal</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-blue-600">{goalProgress.progressPercentage.toFixed(0)}%</p>
              <p className="text-sm text-gray-600">Complete</p>
            </div>
          </div>
          
          <div className="mb-4">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>{goalProgress.goal.starting_weight} lbs</span>
              <span>{goalProgress.goal.target_weight} lbs</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${goalProgress.progressPercentage}%` }}
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Current Weight</p>
              <p className="font-semibold text-gray-900">{goalProgress.currentWeight} lbs</p>
            </div>
            <div>
              <p className="text-gray-600">Remaining</p>
              <p className="font-semibold text-gray-900">
                {Math.abs(goalProgress.remaining).toFixed(1)} lbs
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Progress Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* Weight Progress */}
        {weightProgress && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
            <div className="flex items-center justify-between mb-3">
              <Scale className="h-6 w-6 lg:h-8 lg:w-8 text-blue-600" />
              {weightProgress.trend === 'up' ? (
                <TrendingUp className={`h-5 w-5 ${
                  weightProgress.isGoodProgress ? 'text-green-500' : 'text-red-500'
                }`} />
              ) : weightProgress.trend === 'down' ? (
                <TrendingDown className={`h-5 w-5 ${
                  weightProgress.isGoodProgress ? 'text-green-500' : 'text-red-500'
                }`} />
              ) : (
                <div className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="text-xs lg:text-sm font-medium text-gray-600">Weight Change</p>
              <p className={`text-lg lg:text-2xl font-bold ${
                weightProgress.isGoodProgress ? 'text-green-600' : 'text-red-600'
              }`}>
                {weightProgress.change > 0 ? '+' : ''}{weightProgress.change.toFixed(1)} lbs
              </p>
              <p className="text-xs text-gray-500">
                {weightProgress.goalType && `${weightProgress.goalType} goal`}
              </p>
            </div>
          </div>
        )}

        {/* Body Fat Progress */}
        {bodyFatProgress && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
            <div className="flex items-center justify-between mb-3">
              <Ruler className="h-6 w-6 lg:h-8 lg:w-8 text-green-600" />
              {bodyFatProgress.trend === 'down' ? (
                <TrendingDown className="h-5 w-5 text-green-500" />
              ) : bodyFatProgress.trend === 'up' ? (
                <TrendingUp className="h-5 w-5 text-red-500" />
              ) : (
                <div className="h-5 w-5" />
              )}
            </div>
            <div>
              <p className="text-xs lg:text-sm font-medium text-gray-600">Body Fat Change</p>
              <p className={`text-lg lg:text-2xl font-bold ${
                bodyFatProgress.isGoodProgress ? 'text-green-600' : 'text-red-600'
              }`}>
                {bodyFatProgress.change > 0 ? '+' : ''}{bodyFatProgress.change.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500">
                Current: {bodyFatProgress.current}%
              </p>
            </div>
          </div>
        )}

        {/* Workout Frequency */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center justify-between mb-3">
            <Dumbbell className="h-6 w-6 lg:h-8 lg:w-8 text-purple-600" />
            <Calendar className="h-5 w-5 text-gray-400" />
          </div>
          <div>
            <p className="text-xs lg:text-sm font-medium text-gray-600">Workouts</p>
            <p className="text-lg lg:text-2xl font-bold text-gray-900">{workoutProgress.count}</p>
            <p className="text-xs text-gray-500">
              {timeframe === 'week' ? 'This week' : 
               timeframe === 'month' ? 'This month' :
               timeframe === 'quarter' ? 'Last 3 months' : 'This year'}
            </p>
          </div>
        </div>

        {/* Workout Duration */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 lg:p-6">
          <div className="flex items-center justify-between mb-3">
            <Award className="h-6 w-6 lg:h-8 lg:w-8 text-orange-600" />
            <div className="text-xs text-gray-500">AVG</div>
          </div>
          <div>
            <p className="text-xs lg:text-sm font-medium text-gray-600">Avg Duration</p>
            <p className="text-lg lg:text-2xl font-bold text-gray-900">{workoutProgress.avgDuration}m</p>
            <p className="text-xs text-gray-500">
              Total: {Math.round(workoutProgress.totalDuration / 60)}h
            </p>
          </div>
        </div>
      </div>

      {/* Recent Activity Summary */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
        {/* Weight Trend */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 lg:p-6 border-b border-gray-200">
            <h3 className="text-base lg:text-lg font-semibold text-gray-900">Recent Weight Entries</h3>
          </div>
          <div className="p-4 lg:p-6">
            {stats.weightEntries.slice(0, 5).length > 0 ? (
              <div className="space-y-3">
                {stats.weightEntries.slice(0, 5).map((entry, index) => (
                  <div key={entry.id} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-3 ${
                        index === 0 ? 'bg-blue-600' : 'bg-gray-300'
                      }`} />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{entry.weight} lbs</p>
                        <p className="text-xs text-gray-500">
                          {formatDate(entry.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {index > 0 && stats.weightEntries[index - 1] && (
                      <div className="text-right">
                        <p className={`text-sm font-medium ${
                          entry.weight > stats.weightEntries[index - 1].weight
                            ? 'text-red-600'
                            : entry.weight < stats.weightEntries[index - 1].weight
                            ? 'text-green-600'
                            : 'text-gray-600'
                        }`}>
                          {entry.weight > stats.weightEntries[index - 1].weight ? '+' : ''}
                          {(entry.weight - stats.weightEntries[index - 1].weight).toFixed(1)}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Scale className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No weight entries yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Workouts */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="p-4 lg:p-6 border-b border-gray-200">
            <h3 className="text-base lg:text-lg font-semibold text-gray-900">Recent Workouts</h3>
          </div>
          <div className="p-4 lg:p-6">
            {stats.workouts.slice(0, 5).length > 0 ? (
              <div className="space-y-3">
                {stats.workouts.slice(0, 5).map((workout, index) => (
                  <div key={workout.id} className="flex items-center justify-between">
                    <div className="flex items-center min-w-0 flex-1">
                      <div className={`w-2 h-2 rounded-full mr-3 flex-shrink-0 ${
                        index === 0 ? 'bg-purple-600' : 'bg-gray-300'
                      }`} />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate">{workout.name}</p>
                        <p className="text-xs text-gray-500">
                          {formatDate(workout.date).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    {workout.duration_minutes && (
                      <div className="text-right ml-3 flex-shrink-0">
                        <p className="text-sm font-medium text-gray-600">
                          {workout.duration_minutes}m
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Dumbbell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No workouts logged yet</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}