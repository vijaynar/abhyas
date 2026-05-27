-- ============================================================
-- MIGRATION: 0003_indexes.sql
-- Upasthiti — Performance Indexes & Row Level Security Policies
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- SECTION A: Multi-tenant isolation indexes
-- All high-traffic queries filter on tenant_id first.
-- ────────────────────────────────────────────────────────────

CREATE INDEX idx_users_tenant_id
    ON users (tenant_id);

CREATE INDEX idx_users_tenant_role
    ON users (tenant_id, role);

CREATE INDEX idx_students_tenant_id
    ON students (tenant_id);

CREATE INDEX idx_students_tenant_batch
    ON students (tenant_id, batch_id)
    WHERE status = 'active';                    -- partial index: only active students

CREATE INDEX idx_classes_tenant_id
    ON classes (tenant_id)
    WHERE is_active = true;

CREATE INDEX idx_batches_tenant_class
    ON batches (tenant_id, class_id)
    WHERE is_active = true;

CREATE INDEX idx_attendance_tenant_date
    ON attendance_logs (tenant_id, date DESC);  -- most recent date first

CREATE INDEX idx_attendance_student_date
    ON attendance_logs (student_id, date DESC);

CREATE INDEX idx_attendance_batch_date
    ON attendance_logs (batch_id, date DESC);

CREATE INDEX idx_fines_tenant_status
    ON fines (tenant_id, status);

CREATE INDEX idx_fines_student_id
    ON fines (student_id);

CREATE INDEX idx_face_samples_tenant
    ON student_face_samples (tenant_id);

CREATE INDEX idx_face_samples_student
    ON student_face_samples (student_id);

-- ────────────────────────────────────────────────────────────
-- SECTION B: pgvector IVFFlat index for fast ANN search
-- lists = 100 is a good default for up to ~1M vectors.
-- Rebuild with higher lists as dataset grows.
-- ────────────────────────────────────────────────────────────

CREATE INDEX idx_face_embedding_ivfflat
    ON student_face_samples
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- ────────────────────────────────────────────────────────────
-- SECTION C: Row Level Security (RLS) Policies
-- Enforces data isolation at the database layer.
-- ────────────────────────────────────────────────────────────

-- Enable RLS on all tables
ALTER TABLE tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE classes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches              ENABLE ROW LEVEL SECURITY;
ALTER TABLE students             ENABLE ROW LEVEL SECURITY;
ALTER TABLE parents              ENABLE ROW LEVEL SECURITY;
ALTER TABLE parent_student_map   ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_face_samples ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_settings      ENABLE ROW LEVEL SECURITY;
ALTER TABLE fines                ENABLE ROW LEVEL SECURITY;

-- Helper function: get calling user's tenant_id from JWT metadata
CREATE OR REPLACE FUNCTION auth_tenant_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
    SELECT (auth.jwt() -> 'app_metadata' ->> 'tenant_id')::UUID;
$$;

-- Helper function: get calling user's role from JWT metadata
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT
LANGUAGE sql STABLE
AS $$
    SELECT auth.jwt() -> 'app_metadata' ->> 'role';
$$;

-- ── tenants: admins see only their own tenant ──────────────
CREATE POLICY "tenants_select_own"
    ON tenants FOR SELECT
    USING (id = auth_tenant_id());

-- ── users: same-tenant reads; admins see all; students see self ──
CREATE POLICY "users_select_same_tenant"
    ON users FOR SELECT
    USING (tenant_id = auth_tenant_id());

CREATE POLICY "users_insert_admin"
    ON users FOR INSERT
    WITH CHECK (
        tenant_id = auth_tenant_id()
        AND auth_user_role() IN ('admin', 'superadmin')
    );

CREATE POLICY "users_update_admin_or_self"
    ON users FOR UPDATE
    USING (
        tenant_id = auth_tenant_id()
        AND (auth_user_role() IN ('admin', 'superadmin') OR id = auth.uid())
    );

-- ── classes & batches: tenant-scoped ──────────────────────
CREATE POLICY "classes_tenant_select"
    ON classes FOR SELECT
    USING (tenant_id = auth_tenant_id());

CREATE POLICY "classes_admin_write"
    ON classes FOR ALL
    USING (
        tenant_id = auth_tenant_id()
        AND auth_user_role() IN ('admin', 'superadmin')
    );

CREATE POLICY "batches_tenant_select"
    ON batches FOR SELECT
    USING (tenant_id = auth_tenant_id());

CREATE POLICY "batches_admin_write"
    ON batches FOR ALL
    USING (
        tenant_id = auth_tenant_id()
        AND auth_user_role() IN ('admin', 'superadmin')
    );

-- ── students: admins see all; students see self; parents see linked ──
CREATE POLICY "students_admin_all"
    ON students FOR ALL
    USING (
        tenant_id = auth_tenant_id()
        AND auth_user_role() IN ('admin', 'superadmin')
    );

CREATE POLICY "students_self_select"
    ON students FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "students_parent_select"
    ON students FOR SELECT
    USING (
        id IN (
            SELECT student_id FROM parent_student_map
            WHERE parent_id = auth.uid()
        )
    );

-- ── attendance_logs: tenant-scoped; students see own ──────
CREATE POLICY "attendance_tenant_admin"
    ON attendance_logs FOR ALL
    USING (
        tenant_id = auth_tenant_id()
        AND auth_user_role() IN ('admin', 'superadmin')
    );

CREATE POLICY "attendance_student_self"
    ON attendance_logs FOR SELECT
    USING (student_id = auth.uid());

CREATE POLICY "attendance_parent_children"
    ON attendance_logs FOR SELECT
    USING (
        student_id IN (
            SELECT student_id FROM parent_student_map
            WHERE parent_id = auth.uid()
        )
    );

-- ── fines: same pattern ───────────────────────────────────
CREATE POLICY "fines_tenant_admin"
    ON fines FOR ALL
    USING (
        tenant_id = auth_tenant_id()
        AND auth_user_role() IN ('admin', 'superadmin')
    );

CREATE POLICY "fines_student_self"
    ON fines FOR SELECT
    USING (student_id = auth.uid());

CREATE POLICY "fines_parent_children"
    ON fines FOR SELECT
    USING (
        student_id IN (
            SELECT student_id FROM parent_student_map
            WHERE parent_id = auth.uid()
        )
    );

-- ── face samples: admin-only write; RPC bypasses via SECURITY DEFINER ──
CREATE POLICY "face_samples_admin_write"
    ON student_face_samples FOR ALL
    USING (
        tenant_id = auth_tenant_id()
        AND auth_user_role() IN ('admin', 'superadmin')
    );

-- ── tenant_settings: admin-only ───────────────────────────
CREATE POLICY "settings_admin_all"
    ON tenant_settings FOR ALL
    USING (
        tenant_id = auth_tenant_id()
        AND auth_user_role() IN ('admin', 'superadmin')
    );
