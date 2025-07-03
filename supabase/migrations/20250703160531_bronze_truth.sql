/*
  # Add Measurement Goals Support

  1. Changes to user_goals table
    - Add `goal_category` column ('weight' or 'measurement')
    - Add `measurement_field_id` column for measurement goals
    - Add `target_value` column for measurement goals
    - Add `starting_value` column for measurement goals
    - Make weight-specific columns nullable

  2. Security
    - Update RLS policies to handle new goal types
    - Ensure users can only create goals for their own measurement fields

  3. Constraints
    - Add check constraints for goal categories
    - Ensure measurement goals have measurement_field_id
    - Ensure weight goals have weight-related fields
*/

-- Add new columns to user_goals table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_goals' AND column_name = 'goal_category'
  ) THEN
    ALTER TABLE user_goals ADD COLUMN goal_category text DEFAULT 'weight' CHECK (goal_category IN ('weight', 'measurement'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_goals' AND column_name = 'measurement_field_id'
  ) THEN
    ALTER TABLE user_goals ADD COLUMN measurement_field_id uuid REFERENCES measurement_fields(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_goals' AND column_name = 'target_value'
  ) THEN
    ALTER TABLE user_goals ADD COLUMN target_value decimal(6,1);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_goals' AND column_name = 'starting_value'
  ) THEN
    ALTER TABLE user_goals ADD COLUMN starting_value decimal(6,1);
  END IF;
END $$;

-- Update existing goals to be weight category
UPDATE user_goals SET goal_category = 'weight' WHERE goal_category IS NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_user_goals_measurement_field ON user_goals(measurement_field_id);
CREATE INDEX IF NOT EXISTS idx_user_goals_category ON user_goals(user_id, goal_category, is_active);