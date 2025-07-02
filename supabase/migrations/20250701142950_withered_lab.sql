/*
  # Add Session Status and Completion Tracking

  1. Changes
    - Add `status` column to workout_sessions table ('active', 'completed', 'cancelled')
    - Add `completed_at` timestamp for when session was finished
    - Update existing sessions to 'completed' status
    - Add index for better performance on status queries

  2. Security
    - No changes to RLS policies needed
*/

-- Add status and completed_at columns to workout_sessions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workout_sessions' AND column_name = 'status'
  ) THEN
    ALTER TABLE workout_sessions ADD COLUMN status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workout_sessions' AND column_name = 'completed_at'
  ) THEN
    ALTER TABLE workout_sessions ADD COLUMN completed_at timestamptz;
  END IF;
END $$;

-- Update existing sessions to completed status
UPDATE workout_sessions 
SET status = 'completed', completed_at = created_at 
WHERE status IS NULL OR status = 'active';

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_workout_sessions_status ON workout_sessions(user_id, status, date DESC);