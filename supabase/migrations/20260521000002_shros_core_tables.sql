-- =============================================================================
-- Agency Group — SH-ROS Core Tables
-- Migration: 20260521000002
-- Applied: 2026-05-20 (via browser Management API to project isbfiofwpxqqpgxoftph)
-- =============================================================================

-- ── Organizations ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS organizations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT UNIQUE NOT NULL,
  plan        TEXT NOT NULL DEFAULT 'starter',
  settings    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Org Members ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member'
              CHECK (role IN ('owner','admin','member','viewer')),
  invited_by  UUID,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_members_org_id  ON org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON org_members(user_id);

-- ── Runtime Events (SH-ROS event bus) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS runtime_events (
  event_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            UUID NOT NULL,
  type              TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','completed','failed','dlq')),
  retry_count       INT NOT NULL DEFAULT 0,
  payload           JSONB DEFAULT '{}',
  result            JSONB,
  agents_triggered  TEXT[],
  agents_failed     TEXT[],
  correlation_id    TEXT,
  event_timestamp   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_runtime_events_org_id         ON runtime_events(org_id);
CREATE INDEX IF NOT EXISTS idx_runtime_events_status         ON runtime_events(status);
CREATE INDEX IF NOT EXISTS idx_runtime_events_type           ON runtime_events(type);
CREATE INDEX IF NOT EXISTS idx_runtime_events_correlation_id ON runtime_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_runtime_events_event_timestamp ON runtime_events(event_timestamp DESC);

-- ── Incidents ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incidents (
  incident_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             UUID NOT NULL,
  title              TEXT NOT NULL,
  description        TEXT,
  severity           TEXT NOT NULL DEFAULT 'P3'
                     CHECK (severity IN ('P0','P1','P2','P3','P4')),
  status             TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','investigating','mitigating','resolved','closed')),
  affected_systems   TEXT[],
  correlation_id     TEXT,
  detected_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at        TIMESTAMPTZ,
  created_by         TEXT,
  assigned_to        TEXT,
  metadata           JSONB DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incidents_org_id      ON incidents(org_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status      ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity    ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_detected_at ON incidents(detected_at DESC);

-- ── Governance Approvals ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS governance_approvals (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          UUID NOT NULL,
  request_type    TEXT NOT NULL,
  requested_by    TEXT NOT NULL,
  approved_by     TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','approved','rejected','escalated','expired')),
  payload         JSONB DEFAULT '{}',
  reason          TEXT,
  risk_level      TEXT DEFAULT 'medium'
                  CHECK (risk_level IN ('low','medium','high','critical')),
  expires_at      TIMESTAMPTZ,
  decided_at      TIMESTAMPTZ,
  correlation_id  TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_governance_approvals_org_id       ON governance_approvals(org_id);
CREATE INDEX IF NOT EXISTS idx_governance_approvals_status       ON governance_approvals(status);
CREATE INDEX IF NOT EXISTS idx_governance_approvals_requested_by ON governance_approvals(requested_by);
CREATE INDEX IF NOT EXISTS idx_governance_approvals_created_at   ON governance_approvals(created_at DESC);

-- ── Incident ↔ Governance link ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incident_governance (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  UUID NOT NULL REFERENCES incidents(incident_id) ON DELETE CASCADE,
  approval_id  UUID NOT NULL REFERENCES governance_approvals(id) ON DELETE CASCADE,
  linked_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  linked_by    TEXT,
  notes        TEXT,
  UNIQUE (incident_id, approval_id)
);

CREATE INDEX IF NOT EXISTS idx_incident_governance_incident_id ON incident_governance(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_governance_approval_id ON incident_governance(approval_id);
