// TypeScript types for our fitness tracking app
// This helps us catch errors early and provides better code completion

export interface User {
  id: string;
  email: string;
  name: string;
  birth_date?: string;
  gender?: 'male' | 'female' | 'other';
  created_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  birth_date?: string;
  gender?: 'male' | 'female' | 'other';
  height_inches?: number;
  activity_level?: 'sedentary' | 'lightly_active' | 'moderately_active' | 'very_active' | 'extremely_active';
  created_at: string;
  updated_at: string;
}

export interface UserGoal {
  id: string;
  user_id: string;
  goal_type: 'cutting' | 'bulking' | 'maintaining';
  starting_weight?: number;
  target_weight?: number;
  target_date?: string;
  weekly_goal?: number; // lbs per week
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WeightEntry {
  id: string;
  user_id: string;
  weight: number;
  date: string;
  notes?: string;
  created_at: string;
}

export interface MeasurementField {
  id: string;
  user_id: string;
  field_name: string;
  unit: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BodyMeasurementEntry {
  id: string;
  user_id: string;
  date: string;
  notes?: string;
  created_at: string;
}

export interface BodyMeasurementValue {
  id: string;
  entry_id: string;
  field_id: string;
  value: number;
  created_at: string;
  field?: MeasurementField; // Joined data
}

export interface BodyMeasurement {
  id: string;
  user_id: string;
  date: string;
  notes?: string;
  created_at: string;
  values: BodyMeasurementValue[];
  [key: string]: any; // Allow for dynamic field access
}

export interface WorkoutRoutine {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  created_at: string;
}

export interface Exercise {
  id: string;
  name: string;
  muscle_group: string;
  equipment?: string;
  instructions?: string;
  user_id?: string; // null for global exercises, user_id for custom exercises
  is_custom?: boolean;
  created_at: string;
}

export interface RoutineExercise {
  id: string;
  routine_id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number;
  require_reps?: boolean;
  target_reps?: number;
  require_weight?: boolean;
  target_weight?: number;
  rest_seconds?: number;
  notes?: string;
  created_at: string;
  exercise?: Exercise; // Joined data
}

export interface WorkoutSession {
  id: string;
  user_id: string;
  routine_id?: string;
  name: string;
  date: string;
  duration_minutes?: number;
  notes?: string;
  status: 'active' | 'completed' | 'cancelled';
  completed_at?: string;
  created_at: string;
  routine?: WorkoutRoutine; // Joined data
}

export interface ExerciseSet {
  id: string;
  workout_session_id: string;
  exercise_id: string;
  set_number: number;
  weight?: number;
  reps?: number;
  duration_seconds?: number;
  rest_seconds?: number;
  notes?: string;
  created_at: string;
  exercise?: Exercise; // Joined data
}