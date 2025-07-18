// Dashboard component - the main overview page
// This shows a summary of recent activity and key metrics

import { useState, useEffect } from 'react';
import { Scale, Ruler, Dumbbell, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { formatDate } from '../lib/date';
import type { WeightEntry, BodyMeasurement, WorkoutSession } from '../types';
import { useAuth } from '../contexts/AuthContext';

export default function Dashboard() {
  const { user, authLoading } = useAuth();
  const [stats, setStats] = useState({
    latestWeight: null as WeightEntry | null,
    latestMeasurement: null as BodyMeasurement | null,
    recentWorkouts: [] as WorkoutSession[],
    totalWorkouts: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if(authLoading) return;
    if(!user) return;

    loadDashboardData();
  }, [authLoading, user]);

  const loadDashboardData = async () => {
    try {   
      if(!user) return;
      // Load latest weight
      const { data: weightData } = await supabase
        .from('weight_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(1);

      // Load latest measurements using new structure
      const { data: measurementData } = await supabase
        .from('body_measurement_entries')
        .select(`
          *,
          values:body_measurement_values(
            *,
            field:measurement_fields(*)
          )
        `)
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(1);

      // Transform measurement to include the values array
      let transformedMeasurement = null;
      if (measurementData && measurementData.length > 0) {
        transformedMeasurement = {
          ...measurementData[0],
          values: measurementData[0].values || [],
        };
      }

      // Load recent workouts
      const { data: workoutData } = await supabase
        .from('workout_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(5);

      // Count total workouts
      const { count } = await supabase
        .from('workout_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      setStats({
        latestWeight: weightData?.[0] || null,
        latestMeasurement: transformedMeasurement,
        recentWorkouts: workoutData || [],
        totalWorkouts: count || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get body fat percentage from measurement values
  const getBodyFatPercentage = () => {
    if (!stats.latestMeasurement?.values) return null;
    
    const bodyFatValue = stats.latestMeasurement.values.find(
      value => value.field?.field_name === 'Body Fat %'
    );
    
    return bodyFatValue?.value || null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const bodyFatPercentage = getBodyFatPercentage();

  return (
    <div className="space-y-6 lg:space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
        <p className="mt-2 text-sm lg:text-base text-gray-600 dark:text-gray-400">Welcome back! Here's your fitness overview.</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {/* Latest Weight */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4 lg:p-6">
          <div className="flex items-center">
            <Scale className="h-6 w-6 lg:h-8 lg:w-8 text-link-theme flex-shrink-0" />
            <div className="ml-3 lg:ml-4 min-w-0 flex-1">
              <p className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">Latest Weight</p>
              <p className="text-lg lg:text-2xl font-bold text-gray-900 dark:text-gray-100 dark:text-white truncate">
                {stats.latestWeight ? `${stats.latestWeight.weight} lbs` : 'No data'}
              </p>
              {stats.latestWeight && (
                <p className="text-xs text-label-theme truncate">
                  {new Date(stats.latestWeight.date).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Body Fat */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4 lg:p-6">
          <div className="flex items-center">
            <Ruler className="h-6 w-6 lg:h-8 lg:w-8 text-green-600 flex-shrink-0" />
            <div className="ml-3 lg:ml-4 min-w-0 flex-1">
              <p className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">Body Fat</p>
              <p className="text-lg lg:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                {bodyFatPercentage ? `${bodyFatPercentage}%` : 'No data'}
              </p>
              {stats.latestMeasurement && (
                <p className="text-xs text-label-theme truncate">
                  {new Date(stats.latestMeasurement.date).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Total Workouts */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4 lg:p-6">
          <div className="flex items-center">
            <Dumbbell className="h-6 w-6 lg:h-8 lg:w-8 text-purple-600 flex-shrink-0" />
            <div className="ml-3 lg:ml-4 min-w-0 flex-1">
              <p className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">Total Workouts</p>
              <p className="text-lg lg:text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalWorkouts}</p>
              <p className="text-xs text-label-theme">All time</p>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 p-4 lg:p-6">
          <div className="flex items-center">
            <TrendingUp className="h-6 w-6 lg:h-8 lg:w-8 text-orange-600 flex-shrink-0" />
            <div className="ml-3 lg:ml-4 min-w-0 flex-1">
              <p className="text-xs lg:text-sm font-medium text-gray-600 dark:text-gray-400">This Week</p>
              <p className="text-lg lg:text-2xl font-bold text-gray-900 dark:text-gray-100">
                {stats.recentWorkouts.filter(w => 
                  new Date(w.date) >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                ).length}
              </p>
              <p className="text-xs text-label-theme">Workouts</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 lg:gap-8">
        {/* Recent Workouts */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
          <div className="p-4 lg:p-6 border-b border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <h2 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Workouts</h2>
              <Link 
                to="/workouts"
                className="text-link-theme text-sm font-medium"
              >
                View All
              </Link>
            </div>
          </div>
          <div className="p-3">
            {stats.recentWorkouts.length > 0 ? (
              <div>
                {stats.recentWorkouts.map((workout) => (
                  <Link
                    key={workout.id}
                    to={`/workouts/session/${workout.id}`}
                    className="block px-3 py-2 min-w-0 cursor-pointer rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{workout.name}</p>
                        <p className="text-sm text-label-theme truncate">
                          {formatDate(workout.date).toLocaleDateString()}
                          {workout.duration_minutes && ` • ${workout.duration_minutes} min`}
                        </p>
                      </div>
                      <Dumbbell className="h-5 w-5 text-gray-400 flex-shrink-0 ml-3" />
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Dumbbell className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-label-theme mb-2">No workouts yet</p>
                <Link
                  to="/workouts"
                  className="mt-2 text-link-theme hover:text-blue-700 text-sm font-medium"
                >
                  Start your first workout
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600">
          <div className="p-4 lg:p-6 border-b border-gray-200 dark:border-gray-600">
            <h2 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-gray-100">Quick Actions</h2>
          </div>
          <div className="p-4 lg:p-6">
            <div className="grid grid-cols-2 gap-3 lg:gap-4">
              <Link
                to="/weight"
                className="flex flex-col items-center p-3 lg:p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
              >
                <Scale className="h-6 w-6 lg:h-8 lg:w-8 text-link-theme mb-2" />
                <span className="text-xs lg:text-sm font-medium text-gray-900 dark:text-gray-100 text-center">Log Weight</span>
              </Link>
              <Link
                to="/measurements"
                className="flex flex-col items-center p-3 lg:p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
              >
                <Ruler className="h-6 w-6 lg:h-8 lg:w-8 text-green-600 mb-2" />
                <span className="text-xs lg:text-sm font-medium text-gray-900 dark:text-gray-100 text-center">Measurements</span>
              </Link>
              <Link
                to="/workouts"
                className="flex flex-col items-center p-3 lg:p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
              >
                <Dumbbell className="h-6 w-6 lg:h-8 lg:w-8 text-purple-600 mb-2" />
                <span className="text-xs lg:text-sm font-medium text-gray-900 dark:text-gray-100 text-center">New Workout</span>
              </Link>
              <Link
                to="/progress"
                className="flex flex-col items-center p-3 lg:p-4 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
              >
                <TrendingUp className="h-6 w-6 lg:h-8 lg:w-8 text-orange-600 mb-2" />
                <span className="text-xs lg:text-sm font-medium text-gray-900 dark:text-gray-100 text-center">View Progress</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}