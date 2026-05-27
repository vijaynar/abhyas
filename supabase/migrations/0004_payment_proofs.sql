-- ============================================================
-- MIGRATION: 0004_payment_proofs.sql
-- Upasthiti — Fines Payment Proof Support
-- ============================================================

-- 1. Safely drop any existing CHECK constraint on fines.status
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT constraint_name 
        FROM information_schema.constraint_column_usage 
        WHERE table_name = 'fines' AND column_name = 'status'
    LOOP
        EXECUTE 'ALTER TABLE fines DROP CONSTRAINT ' || quote_ident(r.constraint_name);
    END LOOP;
END $$;

-- 2. Add payment details columns to the fines table
ALTER TABLE fines ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;
ALTER TABLE fines ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(100);
ALTER TABLE fines ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) 
    CONSTRAINT fines_payment_method_check CHECK (payment_method IN ('upi', 'bank_transfer', 'cash'));
ALTER TABLE fines ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- 3. Add the updated CHECK constraint for fines.status (including 'pending_verification')
ALTER TABLE fines ADD CONSTRAINT fines_status_check 
    CHECK (status IN ('unpaid', 'pending_verification', 'paid', 'waived'));
