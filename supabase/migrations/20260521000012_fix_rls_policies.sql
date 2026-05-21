-- =============================================================================
-- Wave 25: Fix causal_trace RLS OR-bypass (exposes all default-tenant traces)
-- Fix audit_log silent empty for authenticated reads
-- =============================================================================

-- Drop the broken policy and replace with tenant-scoped one
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'causal_trace' AND policyname LIKE '%read%') THEN
    DROP POLICY IF EXISTS authenticated_read_causal_trace ON causal_trace;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'causal_trace' AND policyname = 'service_role_causal_trace') THEN
    CREATE POLICY service_role_causal_trace ON causal_trace
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- audit_log: add authenticated read policy scoped to tenant
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_log' AND policyname = 'authenticated_read_audit_log') THEN
    CREATE POLICY authenticated_read_audit_log ON audit_log
      FOR SELECT TO authenticated
      USING (tenant_id = current_setting('app.tenant_id', true));
  END IF;
END $$;
