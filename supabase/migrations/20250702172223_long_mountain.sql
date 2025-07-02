/*
  # Create Custom Measurement Fields System

  1. New Tables
    - `measurement_fields`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `field_name` (text) - name of the measurement field
      - `unit` (text) - unit of measurement (inches, cm, etc.)
      - `is_active` (boolean) - whether field appears in add form
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Default Fields
    - Insert standard measurement fields for all users
    - All fields start as active

  3. Security
    - Enable RLS on measurement_fields table
    - Users can only manage their own measurement fields

  4. Constraints
    - Unique constraint on user_id + field_name + unit to prevent duplicates
*/

-- Create measurement_fields table
CREATE TABLE IF NOT EXISTS measurement_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  field_name text NOT NULL,
  unit text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, field_name, unit)
);

-- Enable Row Level Security
ALTER TABLE measurement_fields ENABLE ROW LEVEL SECURITY;

-- Create policies for measurement_fields
CREATE POLICY "Users can read own measurement fields"
  ON measurement_fields
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own measurement fields"
  ON measurement_fields
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own measurement fields"
  ON measurement_fields
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Note: No DELETE policy - we only deactivate fields

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_measurement_fields_user_id ON measurement_fields(user_id);
CREATE INDEX IF NOT EXISTS idx_measurement_fields_active ON measurement_fields(user_id, is_active);

-- Function to create default measurement fields for new users
CREATE OR REPLACE FUNCTION create_default_measurement_fields()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO measurement_fields (user_id, field_name, unit, is_active) VALUES
    (NEW.id, 'Chest', 'inches', true),
    (NEW.id, 'Waist', 'inches', true),
    (NEW.id, 'Hips', 'inches', true),
    (NEW.id, 'Bicep Left', 'inches', true),
    (NEW.id, 'Bicep Right', 'inches', true),
    (NEW.id, 'Thigh Left', 'inches', true),
    (NEW.id, 'Thigh Right', 'inches', true),
    (NEW.id, 'Neck', 'inches', true),
    (NEW.id, 'Body Fat %', '%', true);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically create default fields for new users
DROP TRIGGER IF EXISTS create_default_measurement_fields_trigger ON auth.users;
CREATE TRIGGER create_default_measurement_fields_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_measurement_fields();

-- Create default measurement fields for existing users
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN SELECT id FROM auth.users LOOP
    INSERT INTO measurement_fields (user_id, field_name, unit, is_active) VALUES
      (user_record.id, 'Chest', 'inches', true),
      (user_record.id, 'Waist', 'inches', true),
      (user_record.id, 'Hips', 'inches', true),
      (user_record.id, 'Bicep Left', 'inches', true),
      (user_record.id, 'Bicep Right', 'inches', true),
      (user_record.id, 'Thigh Left', 'inches', true),
      (user_record.id, 'Thigh Right', 'inches', true),
      (user_record.id, 'Neck', 'inches', true),
      (user_record.id, 'Body Fat %', '%', true)
    ON CONFLICT (user_id, field_name, unit) DO NOTHING;
  END LOOP;
END $$;