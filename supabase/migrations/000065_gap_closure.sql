-- Agency Group — Wave 41: Gap Closure System
-- supabase/migrations/000065_gap_closure.sql
--
-- Tables:
--   gap_closure_reports       — full system audit reports (persisted by orchestrator)
--   capital_reality_checks    — per-entry capital reality status
--   capital_reality_confirmations — external bank confirmations (immutable)
--   gap_audit_runs            — individual layer audit run metadata

-- ─── gap_closure_reports ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gap_closure_reports (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        text NOT NULL,
  report_id        text NOT NULL,
  total_gaps       integer NOT NULL DEFAULT 0,
  critical_gaps    integer NOT NULL DEFAULT 0,
  closed_gaps      integer NOT NULL DEFAULT 0,
  partial_gaps     integer NOT NULL DEFAULT 0,
  open_gaps        integer NOT NULL DEFAULT 0,
  production_ready boolean NOT NULL DEFAULT false,
  system_status    text NOT NULL DEFAULT 'SIMULATION_ONLY',
  gaps             jsonb NOT NULL DEFAULT '[]',
  generated_at     timestamptz NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gap_closure_reports_report_id_unique UNIQUE (report_id)
);

CREATE INDEX IF NOT EXISTS idx_gap_closure_reports_tenant_generated
  ON gap_closure_reports (tenant_id, generated_at DESC);

ALTER TABLE gap_closure_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gap_closure_reports'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON gap_closure_reports
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── capital_reality_checks ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS capital_reality_checks (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id                 text NOT NULL,
  tenant_id                text NOT NULL,
  entry_id                 text NOT NULL,
  entry_type               text NOT NULL DEFAULT 'UNKNOWN',
  amount_eur_cents         bigint NOT NULL DEFAULT 0,
  reality_status           text NOT NULL DEFAULT 'UNVERIFIED',
  bank_confirmation_ref    text,
  escrow_funding_confirmed boolean NOT NULL DEFAULT false,
  settlement_confirmed     boolean NOT NULL DEFAULT false,
  external_proof_url       text,
  blocking_execution       boolean NOT NULL DEFAULT false,
  checked_at               timestamptz NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT capital_reality_checks_check_id_unique UNIQUE (check_id)
);

CREATE INDEX IF NOT EXISTS idx_capital_reality_checks_tenant_entry
  ON capital_reality_checks (tenant_id, entry_id);

CREATE INDEX IF NOT EXISTS idx_capital_reality_checks_tenant_created
  ON capital_reality_checks (tenant_id, created_at DESC);

ALTER TABLE capital_reality_checks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'capital_reality_checks'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON capital_reality_checks
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── capital_reality_confirmations ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS capital_reality_confirmations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           text NOT NULL,
  entry_id            text NOT NULL,
  bank_ref            text NOT NULL,
  confirmation_hash   text NOT NULL,
  external_proof_url  text,
  confirmed_at        timestamptz NOT NULL DEFAULT now(),
  confirmed_by        text NOT NULL DEFAULT 'api',
  CONSTRAINT capital_reality_confirmations_hash_unique UNIQUE (confirmation_hash)
);

CREATE INDEX IF NOT EXISTS idx_capital_reality_confirmations_tenant_entry
  ON capital_reality_confirmations (tenant_id, entry_id);

CREATE INDEX IF NOT EXISTS idx_capital_reality_confirmations_tenant_created
  ON capital_reality_confirmations (tenant_id, confirmed_at DESC);

ALTER TABLE capital_reality_confirmations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'capital_reality_confirmations'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON capital_reality_confirmations
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;

-- ─── gap_audit_runs ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gap_audit_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    text NOT NULL,
  run_id       text NOT NULL,
  layer        text NOT NULL,
  gaps_found   integer NOT NULL DEFAULT 0,
  gaps_closed  integer NOT NULL DEFAULT 0,
  run_at       timestamptz NOT NULL DEFAULT now(),
  duration_ms  integer,
  CONSTRAINT gap_audit_runs_run_id_unique UNIQUE (run_id)
);

CREATE INDEX IF NOT EXISTS idx_gap_audit_runs_tenant_created
  ON gap_audit_runs (tenant_id, run_at DESC);

ALTER TABLE gap_audit_runs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'gap_audit_runs'
      AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY tenant_isolation ON gap_audit_runs
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;
