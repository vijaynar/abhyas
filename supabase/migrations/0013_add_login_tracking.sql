-- supabase/migrations/0013_add_login_tracking.sql
-- Add login tracking columns to the users table

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS login_device TEXT;

-- Create an index to speed up queries filtering by last_login
CREATE INDEX IF NOT EXISTS idx_users_last_login ON public.users(last_login DESC);
