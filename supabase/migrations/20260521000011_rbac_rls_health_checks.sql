-- =============================================================================
-- Wave 25: Fix missing RLS on critical security tables
-- Add health_checks table for DR validator
-- =============================================================================

-- RBAC tables need RLS to prevent privilege escalation
ALTER TABLE IF EXISTS rbac_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS rbac_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tenant_economic_guardrails ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS operator_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS gdpr_breach_notifications ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rbac_roles' AND policyname = 'service_role_rbac_roles') THEN
    CREATE POLICY service_role_rbac_roles ON rbac_roles
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'rbac_user_roles' AND policyname = 'service_role_rbac_user_roles') THEN
    CREATE POLICY service_role_rbac_user_roles ON rbac_user_roles
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tenant_economic_guardrails' AND policyname = 'service_role_guardrails') THEN
    CREATE POLICY service_role_guardrails ON tenant_economic_guardrails
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'operator_tasks' AND policyname = 'service_role_operator_tasks') THEN
    CREATE POLICY service_role_operator_tasks ON operator_tasks
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gdpr_breach_notifications' AND policyname = 'service_role_gdpr_breach') THEN
    CREATE POLICY service_role_gdpr_breach ON gdpr_breach_notifications
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- health_checks table for DR validator write-access verification
CREATE TABLE IF NOT EXISTS health_checks (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  service    text        NOT NULL DEFAULT 'dr-validator',
  status     text        NOT NULL DEFAULT 'ok'
);

ALTER TABLE health_checks ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'health_checks' AND policyname = 'service_role_health_checks') THEN
    CREATE POLICY service_role_health_checks ON health_checks
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
