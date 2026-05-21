-- Wave 33 Agent 3: Multi-Region Resilience + Security RBAC
-- 20260522000031_security_rbac.sql

CREATE TABLE IF NOT EXISTS region_health_log (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  region_id   text NOT NULL CHECK (region_id IN ('eu-west','eu-south','eu-central')),
  healthy     boolean NOT NULL,
  latency_ms  integer NOT NULL,
  error_rate  numeric(5,4),
  checked_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS routing_decisions (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id        uuid NOT NULL,
  selected_region  text NOT NULL,
  reason           text NOT NULL,
  fallback_used    boolean NOT NULL DEFAULT false,
  latency_ms       integer,
  decided_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_user_roles (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id   uuid NOT NULL,
  actor_id    text NOT NULL,
  role        text NOT NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  assigned_by text,
  UNIQUE (tenant_id, actor_id)
);

CREATE TABLE IF NOT EXISTS access_decisions_log (
  id                    uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id             uuid NOT NULL,
  actor_id              text NOT NULL,
  permission            text NOT NULL,
  allowed               boolean NOT NULL,
  role                  text,
  reason                text,
  evaluated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_region_health_log_checked ON region_health_log (region_id, checked_at DESC);
CREATE INDEX IF NOT EXISTS idx_routing_decisions_tenant ON routing_decisions (tenant_id, decided_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_user_roles ON tenant_user_roles (tenant_id, actor_id);
CREATE INDEX IF NOT EXISTS idx_access_decisions_tenant ON access_decisions_log (tenant_id, actor_id, evaluated_at DESC);

ALTER TABLE region_health_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE routing_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_decisions_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='region_health_log' AND policyname='service_role_all') THEN
    CREATE POLICY service_role_all ON region_health_log TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='routing_decisions' AND policyname='service_role_all') THEN
    CREATE POLICY service_role_all ON routing_decisions TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tenant_user_roles' AND policyname='service_role_all') THEN
    CREATE POLICY service_role_all ON tenant_user_roles TO service_role USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='access_decisions_log' AND policyname='service_role_all') THEN
    CREATE POLICY service_role_all ON access_decisions_log TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
