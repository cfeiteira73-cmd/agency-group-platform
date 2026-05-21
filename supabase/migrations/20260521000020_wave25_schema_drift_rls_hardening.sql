-- =============================================================================
-- Agency Group — Wave 25: Schema Drift + RLS Hardening
-- 20260521000020_wave25_schema_drift_rls_hardening.sql
--
-- Fixes:
--   1a. Add missing columns to deals (agent_id, zona) + indexes
--   1b. Add full_name to investors with bidirectional sync trigger
--   1c. Fix auth.email() → correct subquery in RLS policies (5 tables)
--   1d. Add RLS to tables missing it (7 tables)
--   1e. Enable RLS on economic_truth tables
--   1f. Add dedup unique index to ml_feature_snapshots
-- =============================================================================

-- ─── 1a. Add missing columns to deals ────────────────────────────────────────

ALTER TABLE deals ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS zona TEXT;

CREATE INDEX IF NOT EXISTS idx_deals_agent_id
  ON deals(tenant_id, agent_id)
  WHERE agent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_deals_zona
  ON deals(tenant_id, zona)
  WHERE zona IS NOT NULL;

-- ─── 1b. Fix investors.name vs full_name ─────────────────────────────────────

ALTER TABLE investors ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Backfill: copy existing name → full_name for all existing rows
UPDATE investors SET full_name = name WHERE full_name IS NULL AND name IS NOT NULL;

-- Bidirectional sync trigger: keep name ↔ full_name in sync on INSERT/UPDATE
CREATE OR REPLACE FUNCTION sync_investor_names() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.full_name IS NOT NULL AND NEW.name IS DISTINCT FROM NEW.full_name THEN
      NEW.name = NEW.full_name;
    ELSIF NEW.name IS NOT NULL AND NEW.full_name IS DISTINCT FROM NEW.name THEN
      NEW.full_name = NEW.name;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_investor_names ON investors;
CREATE TRIGGER trg_sync_investor_names
  BEFORE INSERT OR UPDATE ON investors
  FOR EACH ROW EXECUTE FUNCTION sync_investor_names();

-- ─── 1c. Fix auth.email() in RLS policies ────────────────────────────────────
-- auth.email() is not a valid Postgres function. Replace with:
--   (SELECT email FROM auth.users WHERE id = auth.uid())

DO $$ BEGIN
  DROP POLICY IF EXISTS "authenticated_read_properties_enriched" ON properties_enriched;
  CREATE POLICY "authenticated_read_properties_enriched" ON properties_enriched
    FOR SELECT TO authenticated
    USING (tenant_id IN (
      SELECT org_id FROM org_members
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "authenticated_read_commission_events" ON commission_events;
  CREATE POLICY "authenticated_read_commission_events" ON commission_events
    FOR SELECT TO authenticated
    USING (tenant_id IN (
      SELECT org_id FROM org_members
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "authenticated_read_revenue_snapshot" ON revenue_snapshot;
  CREATE POLICY "authenticated_read_revenue_snapshot" ON revenue_snapshot
    FOR SELECT TO authenticated
    USING (tenant_id IN (
      SELECT org_id FROM org_members
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "authenticated_read_market_liquidity_snapshot" ON market_liquidity_snapshot;
  CREATE POLICY "authenticated_read_market_liquidity_snapshot" ON market_liquidity_snapshot
    FOR SELECT TO authenticated
    USING (tenant_id IN (
      SELECT org_id FROM org_members
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  DROP POLICY IF EXISTS "authenticated_read_deal_lineage" ON deal_lineage;
  CREATE POLICY "authenticated_read_deal_lineage" ON deal_lineage
    FOR SELECT TO authenticated
    USING (tenant_id IN (
      SELECT org_id FROM org_members
      WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ));
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ─── 1d. Add RLS to tables missing it ────────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE public_saved_searches ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'public_saved_searches'
      AND policyname = 'service_role_public_saved_searches'
  ) THEN
    CREATE POLICY service_role_public_saved_searches
      ON public_saved_searches FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE nurture_log ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'nurture_log'
      AND policyname = 'service_role_nurture_log'
  ) THEN
    CREATE POLICY service_role_nurture_log
      ON nurture_log FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE property_alert_sent ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'property_alert_sent'
      AND policyname = 'service_role_property_alert_sent'
  ) THEN
    CREATE POLICY service_role_property_alert_sent
      ON property_alert_sent FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE agent_daily_discipline ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_daily_discipline'
      AND policyname = 'service_role_agent_daily_discipline'
  ) THEN
    CREATE POLICY service_role_agent_daily_discipline
      ON agent_daily_discipline FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE cron_lock ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cron_lock'
      AND policyname = 'service_role_cron_lock'
  ) THEN
    CREATE POLICY service_role_cron_lock
      ON cron_lock FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE ingestion_log ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ingestion_log'
      AND policyname = 'service_role_ingestion_log'
  ) THEN
    CREATE POLICY service_role_ingestion_log
      ON ingestion_log FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE soc2_evidence_log ENABLE ROW LEVEL SECURITY;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'soc2_evidence_log'
      AND policyname = 'service_role_soc2_evidence_log'
  ) THEN
    CREATE POLICY service_role_soc2_evidence_log
      ON soc2_evidence_log FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ─── 1e. Fix economic_truth_events RLS ───────────────────────────────────────

DO $$ BEGIN
  ALTER TABLE economic_truth_events ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE transactional_decisions ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE governance_decisions ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE override_events ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'governance_decisions'
      AND policyname = 'service_role_governance_decisions'
  ) THEN
    CREATE POLICY service_role_governance_decisions
      ON governance_decisions FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'override_events'
      AND policyname = 'service_role_override_events'
  ) THEN
    CREATE POLICY service_role_override_events
      ON override_events FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'economic_truth_events'
      AND policyname = 'service_role_economic_truth_events'
  ) THEN
    CREATE POLICY service_role_economic_truth_events
      ON economic_truth_events FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'transactional_decisions'
      AND policyname = 'service_role_transactional_decisions'
  ) THEN
    CREATE POLICY service_role_transactional_decisions
      ON transactional_decisions FOR ALL TO service_role
      USING (true) WITH CHECK (true);
  END IF;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- ─── 1f. Add ml_feature_snapshots dedup unique index ─────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_ml_feature_snapshots_dedup
  ON ml_feature_snapshots(
    tenant_id,
    entity_type,
    entity_id,
    feature_version,
    date_trunc('second', computed_at)
  );
