-- ============================================================
-- MIGRATION: 0009_create_coach_storage_buckets.sql
-- Create avatars, coach-documents, and coach-certificates buckets and define policies.
-- ============================================================

-- Create storage buckets if not exists
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true),
  ('coach-documents', 'coach-documents', true),
  ('coach-certificates', 'coach-certificates', true)
ON CONFLICT (id) DO NOTHING;

-- Configure storage policies for the new buckets
DROP POLICY IF EXISTS "Public Access avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public Access coach-documents" ON storage.objects;
DROP POLICY IF EXISTS "Public Access coach-certificates" ON storage.objects;

CREATE POLICY "Public Access avatars" ON storage.objects 
    FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Public Access coach-documents" ON storage.objects 
    FOR SELECT USING (bucket_id = 'coach-documents');
CREATE POLICY "Public Access coach-certificates" ON storage.objects 
    FOR SELECT USING (bucket_id = 'coach-certificates');

DROP POLICY IF EXISTS "Authenticated Insert avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Insert coach-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Insert coach-certificates" ON storage.objects;

CREATE POLICY "Authenticated Insert avatars" ON storage.objects 
    FOR INSERT WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Authenticated Insert coach-documents" ON storage.objects 
    FOR INSERT WITH CHECK (bucket_id = 'coach-documents');
CREATE POLICY "Authenticated Insert coach-certificates" ON storage.objects 
    FOR INSERT WITH CHECK (bucket_id = 'coach-certificates');

DROP POLICY IF EXISTS "Authenticated Update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update coach-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update coach-certificates" ON storage.objects;

CREATE POLICY "Authenticated Update avatars" ON storage.objects 
    FOR UPDATE USING (bucket_id = 'avatars');
CREATE POLICY "Authenticated Update coach-documents" ON storage.objects 
    FOR UPDATE USING (bucket_id = 'coach-documents');
CREATE POLICY "Authenticated Update coach-certificates" ON storage.objects 
    FOR UPDATE USING (bucket_id = 'coach-certificates');

DROP POLICY IF EXISTS "Authenticated Delete avatars" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete coach-documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete coach-certificates" ON storage.objects;

CREATE POLICY "Authenticated Delete avatars" ON storage.objects 
    FOR DELETE USING (bucket_id = 'avatars');
CREATE POLICY "Authenticated Delete coach-documents" ON storage.objects 
    FOR DELETE USING (bucket_id = 'coach-documents');
CREATE POLICY "Authenticated Delete coach-certificates" ON storage.objects 
    FOR DELETE USING (bucket_id = 'coach-certificates');
