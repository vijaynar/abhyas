-- ============================================================
-- MIGRATION: 0005_remove_email_unique.sql
-- Allow multiple users to share the same email address
-- ============================================================

-- Drop the unique constraint on email column in public.users table
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;

-- Create student-portraits storage bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('student-portraits', 'student-portraits', true)
ON CONFLICT (id) DO NOTHING;

-- Configure storage policies for the student-portraits bucket
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Insert" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete" ON storage.objects;

CREATE POLICY "Public Access" ON storage.objects
    FOR SELECT USING (bucket_id = 'student-portraits');

CREATE POLICY "Authenticated Insert" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'student-portraits');

CREATE POLICY "Authenticated Update" ON storage.objects
    FOR UPDATE USING (bucket_id = 'student-portraits');

CREATE POLICY "Authenticated Delete" ON storage.objects
    FOR DELETE USING (bucket_id = 'student-portraits');

