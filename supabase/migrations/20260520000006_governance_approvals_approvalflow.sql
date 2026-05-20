-- =============================================================================
-- Agency Group — Migration: governance_approvals table for approvalFlow.ts
-- 20260520000006_governance_approvals_approvalflow.sql
-- (Renamed from 000005 to avoid conflict with 000005_fix_permissive_rls.sql)
--
-- The approvalFlow.ts module (lib/governance/approvalFlow.ts) inserts records
-- with specific columns. Previous migrations created governance_approvals with
-- incompatible schemas (wrong column names). This migration creates or alters
-- the table to match what the code actually inserts.
--
-- ApprovalRequest fields inserted by code:
--   approval_id, tenant_id, actor_id, action_type, resource_type, resource_id,
--   risk_level, description, context, status, requested_at, expires_at,
--   reviewed_by, reviewed_at, review_note
--
-- Safe: uses IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- =============================================================================

DO $$
BEGIN
  -- Check if approval_id column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'governance_approvals'
      AND column_name  = 'approval_id'
  ) THEN
    -- Add the approvalFlow-required columns to whatever governance_approvals exists
    ALTER TABLE public.governance_approvals
      ADD COLUMN IF NOT EXISTS approval_id   TEXT UNIQUE,
      ADD COLUMN IF NOT EXISTS tenant_id     TEXT,
      ADD COLUMN IF NOT EXISTS actor_id      TEXT,
      ADD COLUMN IF NOT EXISTS action_type   TEXT,
      ADD COLUMN IF NOT EXISTS resource_type TEXT,
      ADD COLUMN IF NOT EXISTS resource_id   TEXT,
      ADD COLUMN IF NOT EXISTS risk_level    TEXT,
      ADD COLUMN IF NOT EXISTS description   TEXT,
      ADD COLUMN IF NOT EXISTS context       JSONB NOT NULL DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS status        TEXT NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      ADD COLUMN IF NOT EXISTS expires_at    TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS reviewed_by   TEXT,
      ADD COLUMN IF NOT EXISTS reviewed_at   TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS review_note   TEXT;
  END IF;
END
$$;

-- Ensure index on approval_id for checkApproval() query
CREATE INDEX IF NOT EXISTS idx_governance_approvals_approval_id
  ON public.governance_approvals (approval_id)
  WHERE approval_id IS NOT NULL;

-- Ensure index on tenant_id + status for listPendingApprovals()
CREATE INDEX IF NOT EXISTS idx_governance_approvals_tenant_status_flow
  ON public.governance_approvals (tenant_id, status)
  WHERE tenant_id IS NOT NULL;

-- RLS: service_role has full access
ALTER TABLE public.governance_approvals ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'governance_approvals'
      AND policyname = 'governance_approvals_service_role'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "governance_approvals_service_role"
        ON public.governance_approvals
        FOR ALL TO service_role
        USING (true) WITH CHECK (true)
    $policy$;
  END IF;
END
$$;

SELECT '20260520000006: governance_approvals columns patched for approvalFlow.ts' AS status;
