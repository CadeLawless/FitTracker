/*
  # Fitness Tracker Database Schema

  1. New Tables
    - `user_profiles`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `height_inches` (integer)
      - `activity_level` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `user_goals`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `goal_type` (text: cutting, bulking, maintaining)
      - `starting_weight` (decimal)
      - `target_weight` (decimal)
      - `target_date` (date, optional)
      - `weekly_goal` (decimal, optional)
      - `is_active` (boolean)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `weight_entries`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `weight` (decimal)
      - `date` (date)
      - `notes` (text, optional)
      - `created_at` (timestamp)
    
    - `body_measurements`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `chest` (decimal, optional)
      - `waist` (decimal, optional)
      - `hips` (decimal, optional)
      - `bicep_left` (decimal, optional)
      - `bicep_right` (decimal, optional)
      - `thigh_left` (decimal, optional)
      - `thigh_right` (decimal, optional)
      - `neck` (decimal, optional)
      - `body_fat_percentage` (decimal, optional)
      - `date` (date)
      - `notes` (text, optional)
      - `created_at` (timestamp)
    
    - `exercises`
      - `id` (uuid, primary key)
      - `name` (text)
      - `muscle_group` (text)
      - `equipment` (text, optional)
      - `instructions` (text, optional)
      - `created_at` (timestamp)
    
    - `workout_routines`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `name` (text)
      - `description` (text, optional)
      - `created_at` (timestamp)
    
    - `workout_sessions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `routine_id` (uuid, foreign key to workout_routines, optional)
      - `name` (text)
      - `date` (date)
      - `duration_minutes` (integer, optional)
      - `notes` (text, optional)
      - `created_at` (timestamp)
    
    - `exercise_sets`
      - `id` (uuid, primary key)
      - `workout_session_id` (uuid, foreign key to workout_sessions)
      - `exercise_id` (uuid, foreign key to exercises)
      - `set_number` (integer)
      - `weight` (decimal, optional)
      - `reps` (integer, optional)
      - `duration_seconds` (integer, optional)
      - `rest_seconds` (integer, optional)
      - `notes` (text, optional)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Public read access for exercises table
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  height_inches integer,
  activity_level text CHECK (activity_level IN ('sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id)
);

-- Create user_goals table
CREATE TABLE IF NOT EXISTS user_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  goal_type text CHECK (goal_type IN ('cutting', 'bulking', 'maintaining')) NOT NULL,
  starting_weight decimal(5,1),
  target_weight decimal(5,1),
  target_date date,
  weekly_goal decimal(3,1),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create weight_entries table
CREATE TABLE IF NOT EXISTS weight_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  weight decimal(5,1) NOT NULL,
  date date NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create body_measurements table
CREATE TABLE IF NOT EXISTS body_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  chest decimal(4,1),
  waist decimal(4,1),
  hips decimal(4,1),
  bicep_left decimal(4,1),
  bicep_right decimal(4,1),
  thigh_left decimal(4,1),
  thigh_right decimal(4,1),
  neck decimal(4,1),
  body_fat_percentage decimal(4,1),
  date date NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create exercises table (shared across all users)
CREATE TABLE IF NOT EXISTS exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  muscle_group text NOT NULL,
  equipment text,
  instructions text,
  created_at timestamptz DEFAULT now()
);

-- Create workout_routines table
CREATE TABLE IF NOT EXISTS workout_routines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Create workout_sessions table
CREATE TABLE IF NOT EXISTS workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  routine_id uuid REFERENCES workout_routines(id) ON DELETE SET NULL,
  name text NOT NULL,
  date date NOT NULL,
  duration_minutes integer,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create exercise_sets table
CREATE TABLE IF NOT EXISTS exercise_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_session_id uuid REFERENCES workout_sessions(id) ON DELETE CASCADE NOT NULL,
  exercise_id uuid REFERENCES exercises(id) ON DELETE CASCADE NOT NULL,
  set_number integer NOT NULL,
  weight decimal(6,1),
  reps integer,
  duration_seconds integer,
  rest_seconds integer,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE weight_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_measurements ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_sets ENABLE ROW LEVEL SECURITY;

-- Create policies for user_profiles
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policies for user_goals
CREATE POLICY "Users can read own goals"
  ON user_goals
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own goals"
  ON user_goals
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own goals"
  ON user_goals
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Create policies for weight_entries
CREATE POLICY "Users can read own weight entries"
  ON weight_entries
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weight entries"
  ON weight_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weight entries"
  ON weight_entries
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own weight entries"
  ON weight_entries
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for body_measurements
CREATE POLICY "Users can read own measurements"
  ON body_measurements
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own measurements"
  ON body_measurements
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own measurements"
  ON body_measurements
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own measurements"
  ON body_measurements
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for exercises (public read, admin write)
CREATE POLICY "Anyone can read exercises"
  ON exercises
  FOR SELECT
  TO authenticated
  USING (true);

-- Create policies for workout_routines
CREATE POLICY "Users can read own routines"
  ON workout_routines
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own routines"
  ON workout_routines
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own routines"
  ON workout_routines
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own routines"
  ON workout_routines
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for workout_sessions
CREATE POLICY "Users can read own workout sessions"
  ON workout_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own workout sessions"
  ON workout_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own workout sessions"
  ON workout_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own workout sessions"
  ON workout_sessions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for exercise_sets
CREATE POLICY "Users can read own exercise sets"
  ON exercise_sets
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions 
      WHERE workout_sessions.id = exercise_sets.workout_session_id 
      AND workout_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own exercise sets"
  ON exercise_sets
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_sessions 
      WHERE workout_sessions.id = exercise_sets.workout_session_id 
      AND workout_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own exercise sets"
  ON exercise_sets
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions 
      WHERE workout_sessions.id = exercise_sets.workout_session_id 
      AND workout_sessions.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_sessions 
      WHERE workout_sessions.id = exercise_sets.workout_session_id 
      AND workout_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own exercise sets"
  ON exercise_sets
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_sessions 
      WHERE workout_sessions.id = exercise_sets.workout_session_id 
      AND workout_sessions.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_user_id ON user_goals(user_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_active ON user_goals(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_weight_entries_user_id ON weight_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_weight_entries_date ON weight_entries(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_body_measurements_user_id ON body_measurements(user_id);
CREATE INDEX IF NOT EXISTS idx_body_measurements_date ON body_measurements(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_workout_routines_user_id ON workout_routines(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_user_id ON workout_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_workout_sessions_date ON workout_sessions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_exercise_sets_workout_session ON exercise_sets(workout_session_id);

-- Insert some basic exercises
INSERT INTO exercises (name, muscle_group, equipment, instructions) VALUES
  ('Push-ups', 'Chest', 'Bodyweight', 'Start in plank position, lower body until chest nearly touches floor, push back up'),
  ('Squats', 'Legs', 'Bodyweight', 'Stand with feet shoulder-width apart, lower body as if sitting back into chair, return to standing'),
  ('Pull-ups', 'Back', 'Pull-up bar', 'Hang from bar with palms facing away, pull body up until chin clears bar, lower with control'),
  ('Bench Press', 'Chest', 'Barbell', 'Lie on bench, lower barbell to chest, press back up to full arm extension'),
  ('Deadlift', 'Back', 'Barbell', 'Stand with feet hip-width apart, bend at hips and knees to grab bar, lift by extending hips and knees'),
  ('Overhead Press', 'Shoulders', 'Barbell', 'Stand with feet shoulder-width apart, press barbell from shoulders to overhead, lower with control'),
  ('Barbell Row', 'Back', 'Barbell', 'Bend at hips with slight knee bend, pull barbell to lower chest, lower with control'),
  ('Dumbbell Curl', 'Arms', 'Dumbbells', 'Stand with dumbbells at sides, curl weights up by flexing biceps, lower with control')
ON CONFLICT DO NOTHING;