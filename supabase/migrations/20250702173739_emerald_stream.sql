/*
  # Normalize Body Measurements Structure

  1. New Tables
    - `body_measurement_entries`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `date` (date)
      - `notes` (text, optional)
      - `created_at` (timestamp)
    
    - `body_measurement_values`
      - `id` (uuid, primary key)
      - `entry_id` (uuid, foreign key to body_measurement_entries)
      - `field_id` (uuid, foreign key to measurement_fields)
      - `value` (decimal)
      - `created_at` (timestamp)

  2. Changes
    - Migrate existing data from body_measurements to new structure
    - Drop old body_measurements table
    - Update RLS policies for new tables

  3. Security
    - Enable RLS on new tables
    - Add policies for users to manage their own data
*/

-- Create body_measurement_entries table
CREATE TABLE IF NOT EXISTS body_measurement_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date date NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- Create body_measurement_values table
CREATE TABLE IF NOT EXISTS body_measurement_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid REFERENCES body_measurement_entries(id) ON DELETE CASCADE NOT NULL,
  field_id uuid REFERENCES measurement_fields(id) ON DELETE CASCADE NOT NULL,
  value decimal(6,1) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(entry_id, field_id)
);

-- Enable Row Level Security
ALTER TABLE body_measurement_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE body_measurement_values ENABLE ROW LEVEL SECURITY;

-- Create policies for body_measurement_entries
CREATE POLICY "Users can read own measurement entries"
  ON body_measurement_entries
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own measurement entries"
  ON body_measurement_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own measurement entries"
  ON body_measurement_entries
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own measurement entries"
  ON body_measurement_entries
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create policies for body_measurement_values
CREATE POLICY "Users can read own measurement values"
  ON body_measurement_values
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM body_measurement_entries 
      WHERE body_measurement_entries.id = body_measurement_values.entry_id 
      AND body_measurement_entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own measurement values"
  ON body_measurement_values
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM body_measurement_entries 
      WHERE body_measurement_entries.id = body_measurement_values.entry_id 
      AND body_measurement_entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own measurement values"
  ON body_measurement_values
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM body_measurement_entries 
      WHERE body_measurement_entries.id = body_measurement_values.entry_id 
      AND body_measurement_entries.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM body_measurement_entries 
      WHERE body_measurement_entries.id = body_measurement_values.entry_id 
      AND body_measurement_entries.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own measurement values"
  ON body_measurement_values
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM body_measurement_entries 
      WHERE body_measurement_entries.id = body_measurement_values.entry_id 
      AND body_measurement_entries.user_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_body_measurement_entries_user_id ON body_measurement_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_body_measurement_entries_date ON body_measurement_entries(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_body_measurement_values_entry_id ON body_measurement_values(entry_id);
CREATE INDEX IF NOT EXISTS idx_body_measurement_values_field_id ON body_measurement_values(field_id);

-- Migrate existing data from body_measurements to new structure
DO $$
DECLARE
  old_entry RECORD;
  new_entry_id uuid;
  field_record RECORD;
  field_value decimal;
BEGIN
  -- Loop through existing body_measurements
  FOR old_entry IN SELECT * FROM body_measurements ORDER BY created_at LOOP
    -- Create new entry
    INSERT INTO body_measurement_entries (user_id, date, notes, created_at)
    VALUES (old_entry.user_id, old_entry.date, old_entry.notes, old_entry.created_at)
    RETURNING id INTO new_entry_id;
    
    -- Get measurement fields for this user
    FOR field_record IN 
      SELECT id, field_name FROM measurement_fields 
      WHERE user_id = old_entry.user_id 
    LOOP
      -- Check each field and migrate if it has a value
      CASE field_record.field_name
        WHEN 'Chest' THEN field_value := old_entry.chest;
        WHEN 'Waist' THEN field_value := old_entry.waist;
        WHEN 'Hips' THEN field_value := old_entry.hips;
        WHEN 'Bicep Left' THEN field_value := old_entry.bicep_left;
        WHEN 'Bicep Right' THEN field_value := old_entry.bicep_right;
        WHEN 'Thigh Left' THEN field_value := old_entry.thigh_left;
        WHEN 'Thigh Right' THEN field_value := old_entry.thigh_right;
        WHEN 'Neck' THEN field_value := old_entry.neck;
        WHEN 'Body Fat %' THEN field_value := old_entry.body_fat_percentage;
        ELSE field_value := NULL;
      END CASE;
      
      -- Insert value if it exists
      IF field_value IS NOT NULL THEN
        INSERT INTO body_measurement_values (entry_id, field_id, value)
        VALUES (new_entry_id, field_record.id, field_value);
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- Drop the old body_measurements table
DROP TABLE IF EXISTS body_measurements;