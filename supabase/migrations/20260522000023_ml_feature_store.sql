-- =============================================================================
-- Agency Group — ML Feature Store, Counterfactual Labels, Retraining Runs
-- Migration: 20260522000023_ml_feature_store.sql
--
-- Creates three tables:
--   1. feature_vectors      — versioned, immutable feature vectors per entity
--   2. counterfactual_labels — negative training signals from missed opportunities
--   3. retraining_runs      — nightly retrain run audit log
-- =============================================================================

-- ---------------------------------------------------------------------------
-- feature_vectors
-- One active vector per (tenant_id, entity_type, entity_id).
-- Historical snapshots are retained with non-null valid_to.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.feature_vectors (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id            uuid        NOT NULL,
  entity_type          text        NOT NULL CHECK (entity_type IN ('property', 'investor')),
  tenant_id            uuid        NOT NULL,
  feature_version      text        NOT NULL DEFAULT 'v1',
  features             jsonb       NOT NULL DEFAULT '{}',
  feature_names        jsonb       NOT NULL DEFAULT '[]',
  computed_at          timestamptz NOT NULL DEFAULT now(),
  valid_from           timestamptz NOT NULL DEFAULT now(),
  valid_to             timestamptz,
  dataset_snapshot_id  uuid
);

-- Fast lookup by entity (supports both current and as-of-date queries)
CREATE INDEX IF NOT EXISTS idx_feature_vectors_entity
  ON public.feature_vectors (tenant_id, entity_type, entity_id);

-- Fast lookup for current active vector (valid_to IS NULL)
CREATE INDEX IF NOT EXISTS idx_feature_vectors_current
  ON public.feature_vectors (tenant_id, entity_type, entity_id)
  WHERE valid_to IS NULL;

-- ---------------------------------------------------------------------------
-- counterfactual_labels
-- Negative training signals derived from missed/rejected deals.
-- Indexed for fast model-specific training queries.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.counterfactual_labels (
  id                      uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               uuid           NOT NULL,
  investor_id             uuid           NOT NULL,
  property_id             uuid           NOT NULL,
  counterfactual_type     text           NOT NULL CHECK (counterfactual_type IN (
                                           'missed_recommendation',
                                           'rejected_bid',
                                           'lost_deal',
                                           'implicit_ignore'
                                         )),
  opportunity_value_eur   numeric(15, 2) NOT NULL DEFAULT 0,
  counterfactual_score    numeric(5, 4)  NOT NULL DEFAULT 0,
  actual_outcome          text           NOT NULL,
  reason                  text           NOT NULL,
  training_label          numeric(6, 4)  NOT NULL DEFAULT 0,
  model_name              text           NOT NULL,
  created_at              timestamptz    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_counterfactual_model
  ON public.counterfactual_labels (tenant_id, model_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_counterfactual_investor
  ON public.counterfactual_labels (tenant_id, investor_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- retraining_runs
-- Audit log of every nightly (or manual) retraining pipeline execution.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.retraining_runs (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid        NOT NULL,
  trigger              text        NOT NULL DEFAULT 'nightly_cron'
                                   CHECK (trigger IN ('nightly_cron', 'drift_detected', 'manual')),
  models_retrained     jsonb       NOT NULL DEFAULT '[]',
  models_skipped       jsonb       NOT NULL DEFAULT '[]',
  models_rolled_back   jsonb       NOT NULL DEFAULT '[]',
  results              jsonb       NOT NULL DEFAULT '{}',
  total_duration_ms    integer     NOT NULL DEFAULT 0,
  started_at           timestamptz NOT NULL DEFAULT now(),
  completed_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_retraining_runs_tenant
  ON public.retraining_runs (tenant_id, started_at DESC);

-- ---------------------------------------------------------------------------
-- RLS: enable row-level security (service role bypasses via BYPASSRLS)
-- ---------------------------------------------------------------------------
ALTER TABLE public.feature_vectors      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.counterfactual_labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retraining_runs       ENABLE ROW LEVEL SECURITY;

-- Service role policy (application backend — supabaseAdmin client)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'feature_vectors' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON public.feature_vectors
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'counterfactual_labels' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON public.counterfactual_labels
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'retraining_runs' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON public.retraining_runs
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END
$$;
