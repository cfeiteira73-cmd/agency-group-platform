-- Wave 56 — Institutional Operating System
-- Tables: ios_runtime_audits, ios_self_tests, capital_finalization_log,
--         capital_freeze_log, soc_incidents, immutable_incident_log,
--         telemetry_events

CREATE TABLE IF NOT EXISTS ios_runtime_audits (
  id bigserial PRIMARY KEY,
  audit_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  in_memory_state_detected boolean NOT NULL DEFAULT false,
  silent_failure_detected boolean NOT NULL DEFAULT false,
  system_status text NOT NULL DEFAULT 'NOT_READY',
  reality_score numeric(5,2) NOT NULL DEFAULT 0,
  health_score numeric(5,2) NOT NULL DEFAULT 0,
  blocker_count integer NOT NULL DEFAULT 0,
  report_json jsonb NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ios_runtime_audits ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ios_runtime_audits' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON ios_runtime_audits FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_ios_audit_tenant ON ios_runtime_audits (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ios_audit_status ON ios_runtime_audits (system_status);
CREATE INDEX IF NOT EXISTS idx_ios_audit_date   ON ios_runtime_audits (generated_at DESC);

CREATE TABLE IF NOT EXISTS ios_self_tests (
  id bigserial PRIMARY KEY,
  test_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  final_status text NOT NULL DEFAULT 'NOT_READY',
  reality_score numeric(5,2) NOT NULL DEFAULT 0,
  health_score numeric(5,2) NOT NULL DEFAULT 0,
  capital_safe boolean NOT NULL DEFAULT false,
  soc_operational boolean NOT NULL DEFAULT false,
  anomalies_healed integer NOT NULL DEFAULT 0,
  anomalies_escalated integer NOT NULL DEFAULT 0,
  certification_hash text NOT NULL,
  report_json jsonb NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE ios_self_tests ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ios_self_tests' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON ios_self_tests FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_ios_test_tenant ON ios_self_tests (tenant_id);
CREATE INDEX IF NOT EXISTS idx_ios_test_status ON ios_self_tests (final_status);
CREATE INDEX IF NOT EXISTS idx_ios_test_date   ON ios_self_tests (generated_at DESC);

CREATE TABLE IF NOT EXISTS capital_finalization_log (
  id bigserial PRIMARY KEY,
  tx_id text NOT NULL,
  amount_eur_cents bigint NOT NULL DEFAULT 0,
  idempotency_key text NOT NULL,
  settlement_state text NOT NULL,
  verdict text NOT NULL DEFAULT 'APPROVED',
  approved_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE capital_finalization_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='capital_finalization_log' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON capital_finalization_log FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_cap_fin_log_tx ON capital_finalization_log (tx_id);
CREATE INDEX IF NOT EXISTS idx_cap_fin_log_date ON capital_finalization_log (approved_at DESC);

CREATE TABLE IF NOT EXISTS capital_freeze_log (
  id bigserial PRIMARY KEY,
  freeze_id uuid NOT NULL DEFAULT gen_random_uuid(),
  scope text NOT NULL,
  reason text NOT NULL,
  auto_resolved boolean NOT NULL DEFAULT false,
  frozen_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
ALTER TABLE capital_freeze_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='capital_freeze_log' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON capital_freeze_log FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_cap_freeze_date ON capital_freeze_log (frozen_at DESC);
CREATE INDEX IF NOT EXISTS idx_cap_freeze_resolved ON capital_freeze_log (auto_resolved);

CREATE TABLE IF NOT EXISTS soc_incidents (
  id bigserial PRIMARY KEY,
  incident_id uuid NOT NULL DEFAULT gen_random_uuid(),
  level text NOT NULL DEFAULT 'SEV4',
  type text NOT NULL,
  description text NOT NULL DEFAULT '',
  context_json jsonb NOT NULL DEFAULT '{}',
  human_ack_required boolean NOT NULL DEFAULT false,
  human_ack_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE soc_incidents ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='soc_incidents' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON soc_incidents FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_soc_inc_level   ON soc_incidents (level);
CREATE INDEX IF NOT EXISTS idx_soc_inc_ack     ON soc_incidents (human_ack_required, human_ack_at);
CREATE INDEX IF NOT EXISTS idx_soc_inc_date    ON soc_incidents (created_at DESC);

CREATE TABLE IF NOT EXISTS immutable_incident_log (
  id bigserial PRIMARY KEY,
  incident_id uuid NOT NULL DEFAULT gen_random_uuid(),
  level text NOT NULL,
  type text NOT NULL,
  description text NOT NULL DEFAULT '',
  chain_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE immutable_incident_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='immutable_incident_log' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON immutable_incident_log FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_imm_log_level ON immutable_incident_log (level);
CREATE INDEX IF NOT EXISTS idx_imm_log_date  ON immutable_incident_log (created_at DESC);

CREATE TABLE IF NOT EXISTS telemetry_events (
  id bigserial PRIMARY KEY,
  event_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  event_type text NOT NULL,
  source text NOT NULL,
  severity text NOT NULL DEFAULT 'INFO',
  critical boolean NOT NULL DEFAULT false,
  correlation_id text,
  data_json jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE telemetry_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='telemetry_events' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON telemetry_events FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_telemetry_tenant ON telemetry_events (tenant_id);
CREATE INDEX IF NOT EXISTS idx_telemetry_type   ON telemetry_events (event_type);
CREATE INDEX IF NOT EXISTS idx_telemetry_sev    ON telemetry_events (severity);
CREATE INDEX IF NOT EXISTS idx_telemetry_date   ON telemetry_events (created_at DESC);
