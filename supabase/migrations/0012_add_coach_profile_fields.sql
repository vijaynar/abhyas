-- supabase/migrations/0012_add_coach_profile_fields.sql
-- Add detailed profile fields to the coaches table
ALTER TABLE public.coaches
  ADD COLUMN IF NOT EXISTS employee_id VARCHAR(50),
  ADD COLUMN IF NOT EXISTS designation VARCHAR(100),
  ADD COLUMN IF NOT EXISTS department VARCHAR(100),
  ADD COLUMN IF NOT EXISTS specialization VARCHAR(200),
  ADD COLUMN IF NOT EXISTS employee_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS working_days VARCHAR(100),
  ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name VARCHAR(100),
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship VARCHAR(50),
  ADD COLUMN IF NOT EXISTS emergency_contact_phone VARCHAR(20),
  ADD COLUMN IF NOT EXISTS emergency_contact_address TEXT;

-- Add notification preferences JSONB column to public.users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "sms": false, "whatsapp": false, "attendance_reminders": true, "announcement_alerts": true}'::jsonb;

-- Add bank account holder name to coach financial settings
ALTER TABLE public.coach_financial_settings
  ADD COLUMN IF NOT EXISTS bank_account_holder_name VARCHAR(150);
