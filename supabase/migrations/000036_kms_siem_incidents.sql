-- 000036: KMS, SIEM, and Incident Response tables

-- Tenant DEKs (envelope encryption)
CREATE TABLE IF NOT EXISTS tenant_deks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('aws_kms','gcp_kms','local_aes')),
  encrypted_dek_base64 TEXT NOT NULL,
  key_arn_or_name TEXT NOT NULL DEFAULT 'local',
  algorithm TEXT NOT NULL DEFAULT 'AES-256-GCM',
  active BOOLEAN NOT NULL DEFAULT true,
  rotated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Only one active DEK per tenant (partial unique index is safer than UNIQUE constraint on nullable)
CREATE UNIQUE INDEX IF NOT EXISTS idx_tenant_deks_one_active
  ON tenant_deks(tenant_id) WHERE active = true;

-- Entity signatures
CREATE TABLE IF NOT EXISTS entity_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('audit_entry','settlement','replay_archive','ledger_entry','manifest')),
  entity_id TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  signature_base64 TEXT NOT NULL,
  signing_key_id TEXT NOT NULL,
  backend TEXT NOT NULL CHECK (backend IN ('aws_cloudhsm','pkcs11','hmac_sha256')),
  verified BOOLEAN NOT NULL DEFAULT false,
  verified_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SIEM events (local fallback — always written)
CREATE TABLE IF NOT EXISTS siem_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  actor_id TEXT,
  actor_type TEXT NOT NULL DEFAULT 'unknown',
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  outcome TEXT NOT NULL DEFAULT 'success',
  source_ip TEXT,
  geo_region TEXT,
  raw_event JSONB NOT NULL DEFAULT '{}',
  correlation_id TEXT,
  mitre_technique TEXT,
  routed_to_siem BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Threat signals
CREATE TABLE IF NOT EXISTS threat_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  threat_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'low',
  actor_id TEXT,
  evidence JSONB NOT NULL DEFAULT '{}',
  confidence INTEGER NOT NULL DEFAULT 50,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  response_actions JSONB NOT NULL DEFAULT '[]',
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Security incidents
CREATE TABLE IF NOT EXISTS security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  threat_signal_id UUID,
  severity TEXT NOT NULL DEFAULT 'low',
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  actions_taken JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','contained','resolved','false_positive')),
  responder_id TEXT,
  timeline JSONB NOT NULL DEFAULT '[]',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Replay pause flags
CREATE TABLE IF NOT EXISTS replay_pause_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  incident_id UUID NOT NULL,
  paused_by TEXT NOT NULL DEFAULT 'incident_response_engine',
  reason TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Incident response log
CREATE TABLE IF NOT EXISTS incident_response_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  action TEXT NOT NULL,
  success BOOLEAN NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  executed_by TEXT NOT NULL DEFAULT 'system',
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tenant security locks (for lock_privileged_actions)
CREATE TABLE IF NOT EXISTS tenant_security_locks (
  tenant_id UUID PRIMARY KEY,
  privileged_locked BOOLEAN NOT NULL DEFAULT false,
  locked_at TIMESTAMPTZ,
  locked_by TEXT
);

-- Tenant isolation status (for quarantine_tenant)
CREATE TABLE IF NOT EXISTS tenant_isolation_status (
  tenant_id UUID PRIMARY KEY,
  quarantined BOOLEAN NOT NULL DEFAULT false,
  quarantined_at TIMESTAMPTZ,
  quarantined_by TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenant_deks_tenant_active ON tenant_deks(tenant_id, active);
CREATE INDEX IF NOT EXISTS idx_entity_signatures_entity ON entity_signatures(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_siem_events_tenant_created ON siem_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_siem_events_severity ON siem_events(severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_threat_signals_tenant ON threat_signals(tenant_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_incidents_tenant ON security_incidents(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_incident_response_log_incident ON incident_response_log(incident_id);

-- RLS
ALTER TABLE tenant_deks ENABLE ROW LEVEL SECURITY;
ALTER TABLE siem_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_incidents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenant_deks' AND policyname='tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON tenant_deks USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='siem_events' AND policyname='tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON siem_events USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='threat_signals' AND policyname='tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON threat_signals USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='security_incidents' AND policyname='tenant_isolation') THEN
    CREATE POLICY tenant_isolation ON security_incidents USING (tenant_id::text = current_setting('app.tenant_id', true));
  END IF;
END $$;
