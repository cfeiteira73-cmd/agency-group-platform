-- Wave 58 — ASEL Autonomous Security Execution Layer
-- Tables: asel_defense_runs, system_isolation_flags, asel_healing_log,
--         asel_certifications, dr_activations

CREATE TABLE IF NOT EXISTS asel_defense_runs (
  id bigserial PRIMARY KEY,
  incident_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  event_type text NOT NULL,
  risk_level text NOT NULL DEFAULT 'LOW',
  risk_score numeric(3,2) NOT NULL DEFAULT 0,
  capital_frozen boolean NOT NULL DEFAULT false,
  soc_triggered boolean NOT NULL DEFAULT false,
  actions_json jsonb NOT NULL DEFAULT '[]',
  processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE asel_defense_runs ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='asel_defense_runs' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON asel_defense_runs FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_asel_defense_tenant ON asel_defense_runs (tenant_id);
CREATE INDEX IF NOT EXISTS idx_asel_defense_risk   ON asel_defense_runs (risk_level);
CREATE INDEX IF NOT EXISTS idx_asel_defense_date   ON asel_defense_runs (processed_at DESC);

CREATE TABLE IF NOT EXISTS system_isolation_flags (
  id bigserial PRIMARY KEY,
  flag_id text NOT NULL UNIQUE,
  tenant_id uuid NOT NULL,
  scope text NOT NULL,
  isolated boolean NOT NULL DEFAULT false,
  reason text NOT NULL DEFAULT '',
  activated_at timestamptz NOT NULL DEFAULT now(),
  deactivated_at timestamptz
);
ALTER TABLE system_isolation_flags ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='system_isolation_flags' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON system_isolation_flags FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_iso_flags_tenant ON system_isolation_flags (tenant_id);
CREATE INDEX IF NOT EXISTS idx_iso_flags_scope  ON system_isolation_flags (scope);
CREATE INDEX IF NOT EXISTS idx_iso_flags_active ON system_isolation_flags (isolated);

CREATE TABLE IF NOT EXISTS asel_healing_log (
  id bigserial PRIMARY KEY,
  healing_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  anomaly_type text NOT NULL,
  action text NOT NULL,
  healed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE asel_healing_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='asel_healing_log' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON asel_healing_log FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_asel_heal_tenant ON asel_healing_log (tenant_id);
CREATE INDEX IF NOT EXISTS idx_asel_heal_date   ON asel_healing_log (created_at DESC);

CREATE TABLE IF NOT EXISTS asel_certifications (
  id bigserial PRIMARY KEY,
  cert_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  overall_status text NOT NULL DEFAULT 'MANUAL_OVERSIGHT_REQUIRED',
  red_team_score numeric(5,2) NOT NULL DEFAULT 0,
  log_valid boolean NOT NULL DEFAULT false,
  vault_status text NOT NULL DEFAULT 'CRITICAL',
  capital_safe boolean NOT NULL DEFAULT false,
  cert_hash text NOT NULL,
  report_json jsonb NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE asel_certifications ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='asel_certifications' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON asel_certifications FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_asel_cert_tenant ON asel_certifications (tenant_id);
CREATE INDEX IF NOT EXISTS idx_asel_cert_status ON asel_certifications (overall_status);
CREATE INDEX IF NOT EXISTS idx_asel_cert_date   ON asel_certifications (generated_at DESC);

CREATE TABLE IF NOT EXISTS dr_activations (
  id bigserial PRIMARY KEY,
  activation_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  trigger_status text NOT NULL,
  detail_json jsonb NOT NULL DEFAULT '[]',
  soc_notified boolean NOT NULL DEFAULT false,
  activated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE dr_activations ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='dr_activations' AND policyname='service_role_all') THEN CREATE POLICY service_role_all ON dr_activations FOR ALL TO service_role USING (true) WITH CHECK (true); END IF; END $$;
CREATE INDEX IF NOT EXISTS idx_dr_act_tenant ON dr_activations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_dr_act_date   ON dr_activations (activated_at DESC);
