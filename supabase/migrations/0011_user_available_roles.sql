-- ============================================================
-- MIGRATION: 0011_user_available_roles.sql
-- Add available_roles array column to users table and backfill it
-- ============================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS available_roles VARCHAR(50)[] NOT NULL DEFAULT '{}';

-- Backfill existing users
UPDATE public.users SET available_roles = ARRAY[role] WHERE available_roles = '{}' OR available_roles IS NULL;
