/*
  # Add Routine Exercises Table

  1. New Tables
    - `routine_exercises`
      - `id` (uuid, primary key)
      - `routine_id` (uuid, foreign key to workout_routines)
      - `exercise_id` (uuid, foreign key to exercises)
      - `order_index` (integer) - order of exercises in routine
      - `target_sets` (integer) - planned number of sets
      - `target_reps` (integer, optional) - planned reps per set
      - `target_weight` (decimal, optional) - planned weight
      - `rest_seconds` (integer, optional) - planned rest between sets
      - `notes` (text, optional)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on routine_exercises table
    - Add policies for users to manage their own routine exercises
*/

-- Create routine_exercises table
CREATE TABLE IF NOT EXISTS routine_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  routine_id uuid REFERENCES workout_routines(id) ON DELETE CASCADE NOT NULL,
  exercise_id uuid REFERENCES exercises(id) ON DELETE CASCADE NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  target_sets integer NOT NULL DEFAULT 3,
  target_reps integer,
  target_weight decimal(6,1),
  rest_seconds integer DEFAULT 60,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE routine_exercises ENABLE ROW LEVEL SECURITY;

-- Create policies for routine_exercises
CREATE POLICY "Users can read own routine exercises"
  ON routine_exercises
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_routines 
      WHERE workout_routines.id = routine_exercises.routine_id 
      AND workout_routines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own routine exercises"
  ON routine_exercises
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_routines 
      WHERE workout_routines.id = routine_exercises.routine_id 
      AND workout_routines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own routine exercises"
  ON routine_exercises
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_routines 
      WHERE workout_routines.id = routine_exercises.routine_id 
      AND workout_routines.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workout_routines 
      WHERE workout_routines.id = routine_exercises.routine_id 
      AND workout_routines.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own routine exercises"
  ON routine_exercises
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workout_routines 
      WHERE workout_routines.id = routine_exercises.routine_id 
      AND workout_routines.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_routine_exercises_routine_id ON routine_exercises(routine_id);
CREATE INDEX IF NOT EXISTS idx_routine_exercises_exercise_id ON routine_exercises(exercise_id);
CREATE INDEX IF NOT EXISTS idx_routine_exercises_order ON routine_exercises(routine_id, order_index);