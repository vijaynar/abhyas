-- =========================================================================
-- MIGRATION: 0008_coach_module_redesign.sql
-- Upasthiti — Enterprise Coach Management Module Schema
-- =========================================================================

-- Enable pgvector if not enabled
CREATE EXTENSION IF NOT EXISTS "vector";

-- 1. Update the users table role check constraint
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role IN ('superadmin', 'admin', 'student', 'parent', 'coach'));

-- 2. Drop existing dependent tables if they exist to start fresh
DROP TABLE IF EXISTS public.coach_audit_logs CASCADE;
DROP TABLE IF EXISTS public.coach_attendance CASCADE;
DROP TABLE IF EXISTS public.coach_reviews CASCADE;
DROP TABLE IF EXISTS public.coach_payouts CASCADE;
DROP TABLE IF EXISTS public.coach_financial_settings CASCADE;
DROP TABLE IF EXISTS public.coach_leaves CASCADE;
DROP TABLE IF EXISTS public.coach_availability CASCADE;
DROP TABLE IF EXISTS public.coach_face_data CASCADE;
DROP TABLE IF EXISTS public.coach_documents CASCADE;
DROP TABLE IF EXISTS public.coaches CASCADE;

-- 3. Re-create public.coaches
CREATE TABLE public.coaches (
    id                      UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    -- Professional Info
    primary_skill           VARCHAR(100) NOT NULL,
    experience_years        INTEGER NOT NULL CHECK (experience_years >= 0),
    service_types           VARCHAR(50)[] NOT NULL DEFAULT '{Offline}' 
                                CHECK (service_types <= ARRAY['Online', 'Offline', 'Hybrid']::VARCHAR(50)[]),
    class_types             VARCHAR(50)[] NOT NULL DEFAULT '{Group Classes}' 
                                CHECK (class_types <= ARRAY['One-to-One', 'Group Classes']::VARCHAR(50)[]),
    languages_known         VARCHAR(50)[] NOT NULL DEFAULT '{English}',
    qualification           TEXT,
    certifications_summary  TEXT,
    joining_date            DATE NOT NULL DEFAULT CURRENT_DATE,
    bio                     TEXT,
    
    -- Location constraints
    country                 VARCHAR(100) DEFAULT 'India',
    state                   VARCHAR(100),
    city                    VARCHAR(100),
    area                    VARCHAR(200),
    
    -- Status & Approvals
    employment_status       VARCHAR(50) NOT NULL DEFAULT 'Inactive'
                                CHECK (employment_status IN ('Active', 'On Leave', 'Inactive', 'Terminated')),
    
    -- SEO / Marketing
    public_profile_slug     VARCHAR(150) UNIQUE,
    achievements            TEXT[] NOT NULL DEFAULT '{}',
    gallery_urls            TEXT[] NOT NULL DEFAULT '{}',
    
    -- Cached Stats for high performance
    avg_rating              NUMERIC(3,2) DEFAULT 0.00 CHECK (avg_rating BETWEEN 0.00 AND 5.00),
    retention_rate          NUMERIC(5,2) DEFAULT 0.00,
    conversion_rate         NUMERIC(5,2) DEFAULT 0.00,
    satisfaction_score      NUMERIC(5,2) DEFAULT 0.00,
    
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Re-create coach_documents
CREATE TABLE public.coach_documents (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id                UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    document_type           VARCHAR(100) NOT NULL 
                                CHECK (document_type IN ('Government ID', 'Resume', 'Employment Contract', 'Certification', 'Other')),
    document_name           VARCHAR(255) NOT NULL,
    file_url                TEXT NOT NULL,
    expiry_date             DATE,
    
    verification_status     VARCHAR(50) NOT NULL DEFAULT 'Pending'
                                CHECK (verification_status IN ('Pending', 'Verified', 'Rejected')),
    rejection_reason        TEXT,
    
    verified_by             UUID REFERENCES public.users(id),
    verified_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Re-create coach_face_data
CREATE TABLE public.coach_face_data (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id                UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    label                   VARCHAR(50) NOT NULL CHECK (label IN ('front', 'left', 'right')),
    photo_url               TEXT NOT NULL,
    embedding               vector(128) NOT NULL,
    confidence_score        NUMERIC(5,2),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Re-create coach_availability
CREATE TABLE public.coach_availability (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id                UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    day_of_week             SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- 1: Mon, 7: Sun
    start_time              TIME NOT NULL,
    end_time                TIME NOT NULL,
    is_recurring            BOOLEAN NOT NULL DEFAULT true,
    
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_avail_range CHECK (end_time > start_time)
);

-- 7. Re-create coach_leaves
CREATE TABLE public.coach_leaves (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id                UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    start_date              DATE NOT NULL,
    end_date                DATE NOT NULL,
    reason                  TEXT NOT NULL,
    status                  VARCHAR(50) NOT NULL DEFAULT 'Pending'
                                CHECK (status IN ('Pending', 'Approved', 'Rejected')),
    approved_by             UUID REFERENCES public.users(id),
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT valid_leave_range CHECK (end_date >= start_date)
);

-- 8. Re-create coach_financial_settings
CREATE TABLE public.coach_financial_settings (
    coach_id                UUID PRIMARY KEY REFERENCES public.coaches(id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    salary_type             VARCHAR(50) NOT NULL DEFAULT 'Fixed Monthly'
                                CHECK (salary_type IN ('Fixed Monthly', 'Per Class', 'Revenue Share', 'Hybrid')),
    
    fixed_salary            NUMERIC(10,2) DEFAULT 0.00 CHECK (fixed_salary >= 0.00),
    per_class_rate          NUMERIC(10,2) DEFAULT 0.00 CHECK (per_class_rate >= 0.00),
    revenue_share_pct       NUMERIC(5,2) DEFAULT 0.00 CHECK (revenue_share_pct BETWEEN 0.00 AND 100.00),
    
    -- Bank Information
    bank_account_number     VARCHAR(100),
    bank_ifsc_code          VARCHAR(50),
    bank_name               VARCHAR(150),
    upi_id                  VARCHAR(100),
    pan_number              VARCHAR(50),
    
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Re-create coach_payouts
CREATE TABLE public.coach_payouts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id                UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    period_start            DATE NOT NULL,
    period_end              DATE NOT NULL,
    
    base_salary_earned      NUMERIC(10,2) DEFAULT 0.00,
    class_sessions_conducted INTEGER DEFAULT 0,
    class_rate_earned       NUMERIC(10,2) DEFAULT 0.00,
    revenue_share_earned    NUMERIC(10,2) DEFAULT 0.00,
    incentives              NUMERIC(10,2) DEFAULT 0.00,
    deductions              NUMERIC(10,2) DEFAULT 0.00,
    net_payout              NUMERIC(10,2) NOT NULL CHECK (net_payout >= 0.00),
    
    status                  VARCHAR(50) NOT NULL DEFAULT 'Draft'
                                CHECK (status IN ('Draft', 'Processing', 'Paid', 'Cancelled')),
    paid_at                 TIMESTAMPTZ,
    transaction_reference   VARCHAR(150),
    
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Re-create coach_reviews
CREATE TABLE public.coach_reviews (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id                UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    rated_by                UUID REFERENCES public.users(id) ON DELETE SET NULL,
    
    discipline              INTEGER NOT NULL CHECK (discipline BETWEEN 1 AND 5),
    communication           INTEGER NOT NULL CHECK (communication BETWEEN 1 AND 5),
    student_feedback        INTEGER NOT NULL CHECK (student_feedback BETWEEN 1 AND 5),
    attendance              INTEGER NOT NULL CHECK (attendance BETWEEN 1 AND 5),
    teaching_quality        INTEGER NOT NULL CHECK (teaching_quality BETWEEN 1 AND 5),
    professionalism         INTEGER NOT NULL CHECK (professionalism BETWEEN 1 AND 5),
    overall_rating          NUMERIC(3,2) NOT NULL,
    
    review_period           VARCHAR(50) NOT NULL,
    comments                TEXT,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 11. Re-create coach_attendance
CREATE TABLE public.coach_attendance (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id                UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    
    date                    DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in                TIMESTAMPTZ,
    check_out               TIMESTAMPTZ,
    status                  VARCHAR(50) NOT NULL DEFAULT 'absent'
                                CHECK (status IN ('present', 'late', 'absent', 'on_leave', 'holiday')),
    method                  VARCHAR(50) CHECK (method IN ('face_recognition', 'qr_code', 'manual', 'geofenced')),
    confidence_score        NUMERIC(5,2),
    geo_lat                 NUMERIC(10,8),
    geo_lng                 NUMERIC(11,8),
    verified_by             UUID REFERENCES public.users(id),
    notes                   TEXT,
    
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (coach_id, date)
);

-- 12. Re-create coach_audit_logs
CREATE TABLE public.coach_audit_logs (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id               UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    actor_id                UUID REFERENCES public.users(id) ON DELETE SET NULL,
    coach_id                UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
    
    action_type             VARCHAR(100) NOT NULL,
    description             TEXT NOT NULL,
    ip_address              VARCHAR(50),
    device_info             TEXT,
    meta_data               JSONB,
    
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 13. Create Indexes
CREATE INDEX IF NOT EXISTS idx_coaches_tenant ON public.coaches(tenant_id);
CREATE INDEX IF NOT EXISTS idx_coaches_slug ON public.coaches(public_profile_slug);
CREATE INDEX IF NOT EXISTS idx_coach_docs_unverified ON public.coach_documents(tenant_id, verification_status) WHERE verification_status = 'Pending';
CREATE INDEX IF NOT EXISTS idx_coach_attendance_date ON public.coach_attendance(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_coach_payouts_unpaid ON public.coach_payouts(tenant_id, status) WHERE status IN ('Draft', 'Processing');

-- Face matching vector index (HNSW index for high speed sub-10ms similarity queries)
CREATE INDEX IF NOT EXISTS idx_coach_face_vectors ON public.coach_face_data USING hnsw (embedding vector_cosine_ops);

-- 14. Setup Triggers for update_updated_at_column
CREATE TRIGGER trg_coaches_updated_at BEFORE UPDATE ON public.coaches FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_coach_docs_updated_at BEFORE UPDATE ON public.coach_documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_coach_financials_updated_at BEFORE UPDATE ON public.coach_financial_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_coach_payouts_updated_at BEFORE UPDATE ON public.coach_payouts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_coach_attendance_updated_at BEFORE UPDATE ON public.coach_attendance FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
