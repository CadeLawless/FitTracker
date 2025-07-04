/*
  # Add Fitness Phase to User Profiles

  1. Changes
    - Add `fitness_phase` column to user_profiles table
    - Remove `goal_type` requirement from user_goals table
    - Update existing goals to remove goal_type requirement

  2. Fitness Phase Options
    - 'cutting' - trying to lose weight/fat
    - 'bulking' - trying to gain weight/muscle
    - 'maintaining' - trying to maintain current state
    - 'none' - no specific phase, just living life

  3. Goal Logic
    - Individual goals are purely target-based (higher or lower than current)
    - If no specific goal exists, use fitness_phase to determine progress color
    - Goals no longer need to specify cutting/bulking/maintaining
*/

-- Add fitness_phase column to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'fitness_phase'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN fitness_phase text DEFAULT 'none' CHECK (fitness_phase IN ('cutting', 'bulking', 'maintaining', 'none'));
  END IF;
END $$;

-- Remove goal_type constraint from user_goals (make it optional)
ALTER TABLE user_goals ALTER COLUMN goal_type DROP NOT NULL;

-- Update existing user profiles to have a default fitness phase
UPDATE user_profiles SET fitness_phase = 'none' WHERE fitness_phase IS NULL;

-- Migrate existing goals: infer fitness phase from goal_type and set goals to be target-only
DO $$
DECLARE
  goal_record RECORD;
  inferred_phase text;
BEGIN
  FOR goal_record IN 
    SELECT ug.*, up.fitness_phase 
    FROM user_goals ug 
    JOIN user_profiles up ON ug.user_id = up.user_id 
    WHERE ug.goal_type IS NOT NULL 
  LOOP
    -- Infer fitness phase from goal type if profile doesn't have one set
    IF goal_record.fitness_phase = 'none' THEN
      UPDATE user_profiles 
      SET fitness_phase = goal_record.goal_type 
      WHERE user_id = goal_record.user_id;
    END IF;
  END LOOP;
END $$;

-- Clear goal_type from existing goals (they're now purely target-based)
UPDATE user_goals SET goal_type = NULL;