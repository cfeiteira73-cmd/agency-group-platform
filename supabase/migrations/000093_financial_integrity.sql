-- 000093_financial_integrity.sql
-- Wave 45 Agent 3: Financial Integrity Certification tables
-- ledger_certifications: stores certification run results
-- reconciliation_validation_runs: stores reconciliation check results

CREATE TABLE IF NOT EXISTS ledger_certifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  certification_id TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  certified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_debits_cents BIGINT NOT NULL DEFAULT 0,
  total_credits_cents BIGINT NOT NULL DEFAULT 0,
  imbalance_cents BIGINT NOT NULL DEFAULT 0,
  balance_check TEXT NOT NULL DEFAULT 'PENDING',
  total_entries INTEGER NOT NULL DEFAULT 0,
  duplicate_idempotency_keys INTEGER NOT NULL DEFAULT 0,
  idempotency_check TEXT NOT NULL DEFAULT 'PENDING',
  total_escrow_positions INTEGER NOT NULL DEFAULT 0,
  bank_confirmed_count INTEGER NOT NULL DEFAULT 0,
  disputed_count INTEGER NOT NULL DEFAULT 0,
  escrow_vs_ledger_variance_cents BIGINT NOT NULL DEFAULT 0,
  escrow_check TEXT NOT NULL DEFAULT 'PENDING',
  orphan_escrow_count INTEGER NOT NULL DEFAULT 0,
  orphan_check TEXT NOT NULL DEFAULT 'PENDING',
  overall_status TEXT NOT NULL CHECK (overall_status IN ('PASS','FAIL','PENDING','INSUFFICIENT_DATA')) DEFAULT 'PENDING',
  certification_hash TEXT,
  issues TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS reconciliation_validation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  validated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reconciliation_rate_pct NUMERIC(6,2) NOT NULL DEFAULT 0,
  overall_status TEXT NOT NULL DEFAULT 'INSUFFICIENT_DATA',
  issues_count INTEGER NOT NULL DEFAULT 0,
  report_json JSONB NOT NULL DEFAULT '{}'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ledger_certifications_tenant
  ON ledger_certifications(tenant_id, certified_at DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_certifications_status
  ON ledger_certifications(overall_status, certified_at DESC);

CREATE INDEX IF NOT EXISTS idx_reconciliation_runs_tenant
  ON reconciliation_validation_runs(tenant_id, validated_at DESC);

-- RLS
ALTER TABLE ledger_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE reconciliation_validation_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ledger_certifications'
      AND policyname = 'service_role_ledger_certs'
  ) THEN
    CREATE POLICY "service_role_ledger_certs"
      ON ledger_certifications FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'reconciliation_validation_runs'
      AND policyname = 'service_role_recon_runs'
  ) THEN
    CREATE POLICY "service_role_recon_runs"
      ON reconciliation_validation_runs FOR ALL USING (true);
  END IF;
END $$;
