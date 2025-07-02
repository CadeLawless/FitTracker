/*
  # Add Custom Exercise Creation

  1. Changes
    - Add `user_id` column to exercises table to support user-created exercises
    - Add `is_custom` boolean to distinguish between default and custom exercises
    - Update RLS policies to allow users to create and manage their own exercises
    - Keep existing exercises as global (user_id = null)

  2. Security
    - Users can create their own custom exercises
    - Users can read all exercises (global + their custom ones)
    - Users can only edit/delete their own custom exercises
*/

-- Add user_id and is_custom columns to exercises table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exercises' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE exercises ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'exercises' AND column_name = 'is_custom'
  ) THEN
    ALTER TABLE exercises ADD COLUMN is_custom boolean DEFAULT false;
  END IF;
END $$;

-- Update existing exercises to be global (not custom)
UPDATE exercises SET is_custom = false WHERE is_custom IS NULL;

-- Update RLS policies for exercises
DROP POLICY IF EXISTS "Anyone can read exercises" ON exercises;

-- New policies for exercises
CREATE POLICY "Users can read all exercises"
  ON exercises
  FOR SELECT
  TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can create custom exercises"
  ON exercises
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() AND is_custom = true);

CREATE POLICY "Users can update own custom exercises"
  ON exercises
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid() AND is_custom = true)
  WITH CHECK (user_id = auth.uid() AND is_custom = true);

CREATE POLICY "Users can delete own custom exercises"
  ON exercises
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid() AND is_custom = true);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_exercises_user_id ON exercises(user_id);
CREATE INDEX IF NOT EXISTS idx_exercises_custom ON exercises(is_custom);