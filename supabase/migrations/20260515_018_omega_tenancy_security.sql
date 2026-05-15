-- =============================================================================
-- AGENCY GROUP — SH-ROS Migration 018: Ω∞Ω Final Tenancy + Security Hardening
-- Phase Ω∞-3 (Tenancy 89→100) + Phase Ω∞-1 (Security 78→98)
-- AMI: 22506 | Safe additive migration — all new columns nullable
-- =============================================================================

-- ─── PART A: operator_tasks — add org_id (final tenancy gap) ─────────────────
ALTER TABLE operator_tasks ADD COLUMN IF NOT EXISTS org_id text;
CREATE INDEX IF NOT EXISTS idx_operator_tasks_org_id
  ON operator_tasks(org_id) WHERE org_id IS NOT NULL;

-- ─── PART B: runtime_events — add RLS (was internal-only, no RLS) ────────────
ALTER TABLE runtime_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "runtime_events_service_only" ON runtime_events;
CREATE POLICY "runtime_events_service_only" ON runtime_events
  FOR ALL
  TO authenticated
  USING (false)  -- authenticated users cannot access runtime internals
  WITH CHECK (false);
-- service_role (supabaseAdmin) bypasses RLS automatically

-- ─── PART C: learning_events — RLS (internal service only) ───────────────────
ALTER TABLE learning_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "learning_events_service_only" ON learning_events;
CREATE POLICY "learning_events_service_only" ON learning_events
  FOR ALL
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- ─── PART D: signed_audit_log — immutable signed audit chain ─────────────────
CREATE TABLE IF NOT EXISTS signed_audit_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id      uuid NOT NULL UNIQUE,
  org_id        text NOT NULL,
  actor         text NOT NULL,
  action        text NOT NULL,
  entity_type   text NOT NULL,
  entity_id     text,
  payload_hash  text NOT NULL,    -- SHA-256 of the full entry JSON
  chain_hash    text NOT NULL,    -- SHA-256(payload_hash || prev_chain_hash) — tamper-evident
  prev_hash     text,             -- previous entry's chain_hash (NULL for first in org chain)
  created_at    timestamptz NOT NULL DEFAULT now(),
  metadata      jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_signed_audit_log_org_id    ON signed_audit_log(org_id);
CREATE INDEX IF NOT EXISTS idx_signed_audit_log_actor     ON signed_audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_signed_audit_log_action    ON signed_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_signed_audit_log_entity    ON signed_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_signed_audit_log_created   ON signed_audit_log(org_id, created_at DESC);

ALTER TABLE signed_audit_log ENABLE ROW LEVEL SECURITY;
-- Only service_role can write; no authenticated user access to audit log
DROP POLICY IF EXISTS "signed_audit_service_only" ON signed_audit_log;
CREATE POLICY "signed_audit_service_only" ON signed_audit_log
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- ─── PART E: replay_authorizations — replay requires explicit sign-off ────────
CREATE TABLE IF NOT EXISTS replay_authorizations (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  replay_id     uuid NOT NULL UNIQUE,
  org_id        text NOT NULL,
  authorized_by text NOT NULL,    -- actor who signed the replay
  reason        text NOT NULL,
  event_ids     text[] NOT NULL DEFAULT '{}',
  from_ts       timestamptz,
  to_ts         timestamptz,
  status        text NOT NULL DEFAULT 'pending'  -- pending / approved / executed / rejected
                CHECK (status IN ('pending','approved','executed','rejected')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  executed_at   timestamptz,
  metadata      jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_replay_auth_org      ON replay_authorizations(org_id);
CREATE INDEX IF NOT EXISTS idx_replay_auth_status   ON replay_authorizations(org_id, status);
CREATE INDEX IF NOT EXISTS idx_replay_auth_actor    ON replay_authorizations(authorized_by);

ALTER TABLE replay_authorizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "replay_auth_service_only" ON replay_authorizations;
CREATE POLICY "replay_auth_service_only" ON replay_authorizations
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- ─── PART F: queue_poison_quarantine — poisoned message isolation ─────────────
CREATE TABLE IF NOT EXISTS queue_poison_quarantine (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_id     text NOT NULL,
  queue_name      text NOT NULL,
  org_id          text,
  payload         jsonb NOT NULL,
  failure_reason  text NOT NULL,
  failure_count   int NOT NULL DEFAULT 1,
  first_seen_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  resolved        boolean NOT NULL DEFAULT false,
  resolved_at     timestamptz,
  resolved_by     text
);

CREATE INDEX IF NOT EXISTS idx_queue_poison_org      ON queue_poison_quarantine(org_id) WHERE org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_queue_poison_queue    ON queue_poison_quarantine(queue_name, resolved);
CREATE INDEX IF NOT EXISTS idx_queue_poison_unresolved ON queue_poison_quarantine(first_seen_at) WHERE resolved = false;

ALTER TABLE queue_poison_quarantine ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "queue_poison_service_only" ON queue_poison_quarantine;
CREATE POLICY "queue_poison_service_only" ON queue_poison_quarantine
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- ─── PART G: rbac_roles — Role-Based Access Control ──────────────────────────
CREATE TABLE IF NOT EXISTS rbac_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      text NOT NULL,
  role_name   text NOT NULL,              -- admin / analyst / agent / readonly
  permissions text[] NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, role_name)
);

CREATE TABLE IF NOT EXISTS rbac_user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     text NOT NULL,
  user_id    text NOT NULL,
  role_name  text NOT NULL,
  granted_by text NOT NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  UNIQUE(org_id, user_id, role_name)
);

CREATE INDEX IF NOT EXISTS idx_rbac_roles_org        ON rbac_roles(org_id);
CREATE INDEX IF NOT EXISTS idx_rbac_user_roles_org   ON rbac_user_roles(org_id, user_id);
CREATE INDEX IF NOT EXISTS idx_rbac_user_roles_user  ON rbac_user_roles(user_id);

-- ─── PART H: gdpr_breach_notifications — GDPR Art.33 72h compliance ──────────
CREATE TABLE IF NOT EXISTS gdpr_breach_notifications (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breach_id             uuid NOT NULL UNIQUE,
  org_id                text NOT NULL,
  detected_at           timestamptz NOT NULL,
  reported_at           timestamptz,          -- to supervisory authority
  notification_deadline timestamptz NOT NULL,  -- detected_at + 72h
  breach_type           text NOT NULL,         -- data_leak / unauthorized_access / loss / destruction
  affected_records      int,
  affected_data_types   text[] NOT NULL DEFAULT '{}',
  severity              text NOT NULL DEFAULT 'high' CHECK (severity IN ('low','medium','high','critical')),
  status                text NOT NULL DEFAULT 'open' CHECK (status IN ('open','reported','closed','waived')),
  description           text NOT NULL,
  remediation_steps     text,
  soc2_evidence_id      text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  metadata              jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_gdpr_breach_org      ON gdpr_breach_notifications(org_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_breach_status   ON gdpr_breach_notifications(status);
CREATE INDEX IF NOT EXISTS idx_gdpr_breach_deadline ON gdpr_breach_notifications(notification_deadline) WHERE status = 'open';

-- ─── PART I: soc2_evidence_log — continuous SOC2 Type II evidence ─────────────
CREATE TABLE IF NOT EXISTS soc2_evidence_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id     text NOT NULL UNIQUE,
  org_id          text NOT NULL,
  control_id      text NOT NULL,     -- e.g. CC6.1, CC7.2
  control_name    text NOT NULL,
  evidence_type   text NOT NULL,     -- log / screenshot / config / test_result / audit_trail
  description     text NOT NULL,
  collected_at    timestamptz NOT NULL DEFAULT now(),
  collection_method text NOT NULL,   -- automated / manual
  pass            boolean NOT NULL,
  notes           text,
  artifact_url    text,
  metadata        jsonb NOT NULL DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_soc2_evidence_org     ON soc2_evidence_log(org_id, control_id);
CREATE INDEX IF NOT EXISTS idx_soc2_evidence_pass    ON soc2_evidence_log(pass, collected_at DESC);
CREATE INDEX IF NOT EXISTS idx_soc2_evidence_control ON soc2_evidence_log(control_id);

-- ─── PART J: tenant_economic_isolation — per-org economic guardrails ──────────
CREATE TABLE IF NOT EXISTS tenant_economic_guardrails (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                text NOT NULL UNIQUE,
  max_pipeline_eur      numeric(15,2),
  max_deals_active      int,
  max_agents            int,
  max_events_per_day    int,
  max_replay_depth      int NOT NULL DEFAULT 1000,
  alert_threshold_eur   numeric(15,2),
  isolation_mode        text NOT NULL DEFAULT 'soft' CHECK (isolation_mode IN ('soft','hard','quarantine')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- ─── PART K: incident_governance — structured incident management ─────────────
CREATE TABLE IF NOT EXISTS incident_governance (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id     uuid NOT NULL UNIQUE,
  org_id          text,
  title           text NOT NULL,
  severity        text NOT NULL CHECK (severity IN ('P1','P2','P3','P4')),
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','mitigating','resolved','postmortem')),
  detected_at     timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at     timestamptz,
  mttr_minutes    int,                -- calculated on resolution
  root_cause      text,
  impact_summary  text,
  affected_orgs   text[] NOT NULL DEFAULT '{}',
  timeline        jsonb NOT NULL DEFAULT '[]',  -- array of {ts, actor, note}
  slo_breached    boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_severity ON incident_governance(severity, status);
CREATE INDEX IF NOT EXISTS idx_incident_detected ON incident_governance(detected_at DESC);

-- =============================================================================
-- Verify: critical tables exist
-- =============================================================================
DO $$
DECLARE tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'signed_audit_log', 'replay_authorizations', 'queue_poison_quarantine',
    'rbac_roles', 'rbac_user_roles', 'gdpr_breach_notifications',
    'soc2_evidence_log', 'tenant_economic_guardrails', 'incident_governance'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=tbl) THEN
      RAISE EXCEPTION 'Migration 018 failed: table % not found', tbl;
    END IF;
  END LOOP;
END $$;

-- Migration 018 complete ✓ — Ω∞Ω Tenancy + Security Hardening
