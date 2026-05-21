-- =============================================================================
-- Agency Group — Phantom Tables Migration
-- 20260521000013_phantom_tables.sql
--
-- Creates all 34 tables that are queried/inserted by production code but have
-- no existing migration. Schemas are inferred directly from the source files.
--
-- Rules applied:
--   • CREATE TABLE IF NOT EXISTS — idempotent
--   • Every table: id uuid PK, created_at timestamptz NOT NULL DEFAULT now()
--   • Service-level tables: tenant_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'
--   • All tables: RLS enabled + service_role bypass policy
--   • Indexes: CREATE INDEX IF NOT EXISTS for obvious lookup patterns
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. agent_memory
-- Source: lib/ai/memory/index.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent_memory (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  text        NOT NULL,
  scope      text        NOT NULL,   -- 'tenant' | 'deal' | 'buyer' | 'agent_session'
  entity_id  text        NOT NULL,
  key        text        NOT NULL,
  value      jsonb       NOT NULL DEFAULT '{}',
  ttl_days   int,
  version    int         NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, scope, entity_id, key)
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_entity
  ON agent_memory(tenant_id, scope, entity_id);

ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_memory' AND policyname = 'service_role_all_agent_memory'
  ) THEN
    CREATE POLICY service_role_all_agent_memory ON agent_memory
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. policy_tuning_log
-- Source: lib/ai/policyTuning.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS policy_tuning_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text        NOT NULL,
  parameter   text        NOT NULL,
  old_value   numeric,
  new_value   numeric     NOT NULL,
  applied_by  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_policy_tuning_tenant
  ON policy_tuning_log(tenant_id, parameter, created_at DESC);

ALTER TABLE policy_tuning_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'policy_tuning_log' AND policyname = 'service_role_all_policy_tuning_log'
  ) THEN
    CREATE POLICY service_role_all_policy_tuning_log ON policy_tuning_log
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 3. vault_snapshots
-- Source: lib/vault/snapshotManager.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vault_snapshots (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id      text        NOT NULL UNIQUE,
  tenant_id        text        NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  manifest         jsonb       NOT NULL DEFAULT '{}',
  vault_file_count int         NOT NULL DEFAULT 0,
  files_present    int         NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_snapshots_tenant_created
  ON vault_snapshots(tenant_id, created_at DESC);

ALTER TABLE vault_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vault_snapshots' AND policyname = 'service_role_all_vault_snapshots'
  ) THEN
    CREATE POLICY service_role_all_vault_snapshots ON vault_snapshots
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 4. vault_file_hashes
-- Source: lib/vault/hashEngine.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vault_file_hashes (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text        NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  path        text        NOT NULL,
  hash        text        NOT NULL,   -- SHA-256 hex
  size        bigint      NOT NULL DEFAULT 0,
  computed_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (path, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_vault_file_hashes_tenant
  ON vault_file_hashes(tenant_id, path);

ALTER TABLE vault_file_hashes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vault_file_hashes' AND policyname = 'service_role_all_vault_file_hashes'
  ) THEN
    CREATE POLICY service_role_all_vault_file_hashes ON vault_file_hashes
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 5. vault_integrity_scores
-- Source: lib/vault/integrityChecker.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vault_integrity_scores (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           text        NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  vault_completeness  int         NOT NULL DEFAULT 0,
  drift_score         int         NOT NULL DEFAULT 0,
  backup_freshness    int         NOT NULL DEFAULT 0,
  replay_readiness    int         NOT NULL DEFAULT 0,
  overall_score       int         NOT NULL DEFAULT 0,
  alerts              jsonb       NOT NULL DEFAULT '[]',
  computed_at         timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vault_integrity_tenant
  ON vault_integrity_scores(tenant_id, created_at DESC);

ALTER TABLE vault_integrity_scores ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'vault_integrity_scores' AND policyname = 'service_role_all_vault_integrity_scores'
  ) THEN
    CREATE POLICY service_role_all_vault_integrity_scores ON vault_integrity_scores
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 6. security_events
-- Source: lib/security/siem.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS security_events (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type     text        NOT NULL,
  severity       text        NOT NULL,   -- 'info' | 'warning' | 'error' | 'critical'
  tenant_id      text,
  correlation_id text,
  source         text        NOT NULL,
  description    text        NOT NULL,
  metadata       jsonb,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_events_tenant
  ON security_events(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_type
  ON security_events(event_type, created_at DESC);

ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'security_events' AND policyname = 'service_role_all_security_events'
  ) THEN
    CREATE POLICY service_role_all_security_events ON security_events
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 7. usage_events
-- Source: lib/billing/usageMeter.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS usage_events (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      text        NOT NULL,
  event_type     text        NOT NULL,
  quantity       int         NOT NULL DEFAULT 1,
  correlation_id text,
  agent_id       text,
  metadata       jsonb,
  billed_at      timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_tenant_month
  ON usage_events(tenant_id, billed_at DESC);

ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'usage_events' AND policyname = 'service_role_all_usage_events'
  ) THEN
    CREATE POLICY service_role_all_usage_events ON usage_events
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 8. cost_model_snapshots
-- Source: lib/billing/costModelEngine.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cost_model_snapshots (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        text        NOT NULL,
  period_start     timestamptz NOT NULL,
  period_end       timestamptz NOT NULL,
  ai_cost_eur      numeric     NOT NULL DEFAULT 0,
  infra_cost_eur   numeric     NOT NULL DEFAULT 0,
  storage_cost_eur numeric     NOT NULL DEFAULT 0,
  total_cost_eur   numeric     NOT NULL DEFAULT 0,
  revenue_eur      numeric     NOT NULL DEFAULT 0,
  margin_pct       numeric,
  breakdown        jsonb       NOT NULL DEFAULT '{}',
  computed_at      timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cost_model_tenant
  ON cost_model_snapshots(tenant_id, period_start DESC);

ALTER TABLE cost_model_snapshots ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'cost_model_snapshots' AND policyname = 'service_role_all_cost_model_snapshots'
  ) THEN
    CREATE POLICY service_role_all_cost_model_snapshots ON cost_model_snapshots
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 9. secret_rotation_log
-- Source: lib/security/secretsRotation.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS secret_rotation_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_name text        NOT NULL,
  rotated_at  timestamptz NOT NULL DEFAULT now(),
  rotated_by  text,
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_secret_rotation_name
  ON secret_rotation_log(secret_name, rotated_at DESC);

ALTER TABLE secret_rotation_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'secret_rotation_log' AND policyname = 'service_role_all_secret_rotation_log'
  ) THEN
    CREATE POLICY service_role_all_secret_rotation_log ON secret_rotation_log
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 10. economic_truth_events
-- Source: lib/intelligence/economicTruth.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS economic_truth_events (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id                 text        NOT NULL,
  deal_id                     text,
  distribution_event_id       text,
  zone_key                    text        NOT NULL,
  asset_class                 text        NOT NULL,
  price_band                  text        NOT NULL,
  avm_accuracy_score          numeric     NOT NULL DEFAULT 0,
  negotiation_score           numeric     NOT NULL DEFAULT 0,
  time_to_close_score         numeric     NOT NULL DEFAULT 0,
  routing_efficiency_score    numeric     NOT NULL DEFAULT 0,
  spread_vs_predicted_score   numeric     NOT NULL DEFAULT 0,
  raw_truth_score             numeric     NOT NULL DEFAULT 0,
  normalized_truth_score      numeric,
  avm_error_pct               numeric     NOT NULL DEFAULT 0,
  negotiation_delta_pct       numeric     NOT NULL DEFAULT 0,
  routing_precision_pct       numeric     NOT NULL DEFAULT 0,
  spread_error_pct            numeric     NOT NULL DEFAULT 0,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_economic_truth_property
  ON economic_truth_events(property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_economic_truth_zone
  ON economic_truth_events(zone_key, asset_class);
CREATE INDEX IF NOT EXISTS idx_economic_truth_normalized
  ON economic_truth_events(normalized_truth_score)
  WHERE normalized_truth_score IS NULL;

ALTER TABLE economic_truth_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'economic_truth_events' AND policyname = 'service_role_all_economic_truth_events'
  ) THEN
    CREATE POLICY service_role_all_economic_truth_events ON economic_truth_events
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 11a. transaction_outcomes
-- Source: lib/intelligence/outcomeCapture.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS transaction_outcomes (
  id                          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id                 text        NOT NULL,
  distribution_event_id       text,
  agent_email                 text,
  investor_id                 text,
  asking_price                numeric,
  final_sale_price            numeric,
  avm_value_at_time           numeric,
  negotiation_delta_pct       numeric,
  avm_error_pct               numeric,
  negotiation_duration_days   int,
  outcome_type                text        NOT NULL,   -- 'won' | 'lost' | 'withdrawn'
  closing_friction            text,
  score_at_time               numeric,
  grade_at_time               text,
  distribution_rank_at_time   int,
  distribution_tier_at_time   text,
  closed_at                   timestamptz,
  recorded_by                 text,
  notes                       text,
  recorded_at                 timestamptz NOT NULL DEFAULT now(),
  created_at                  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transaction_outcomes_property
  ON transaction_outcomes(property_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_transaction_outcomes_agent
  ON transaction_outcomes(agent_email, recorded_at DESC);

ALTER TABLE transaction_outcomes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'transaction_outcomes' AND policyname = 'service_role_all_transaction_outcomes'
  ) THEN
    CREATE POLICY service_role_all_transaction_outcomes ON transaction_outcomes
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 11b. opportunity_rejections
-- Source: lib/intelligence/outcomeCapture.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS opportunity_rejections (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id             text        NOT NULL,
  distribution_event_id   text,
  recipient_email         text,
  recipient_type          text,         -- 'agent' | 'investor'
  rejection_category      text        NOT NULL,
  rejection_reason        text,
  lost_to_competitor      boolean     NOT NULL DEFAULT false,
  competitor_price        numeric,
  score_at_time           numeric,
  grade_at_time           text,
  responded_at            timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_opportunity_rejections_property
  ON opportunity_rejections(property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opportunity_rejections_recipient
  ON opportunity_rejections(recipient_email, created_at DESC);

ALTER TABLE opportunity_rejections ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'opportunity_rejections' AND policyname = 'service_role_all_opportunity_rejections'
  ) THEN
    CREATE POLICY service_role_all_opportunity_rejections ON opportunity_rejections
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 11c. negotiation_events
-- Source: lib/intelligence/outcomeCapture.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS negotiation_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   text        NOT NULL,
  outcome_id    uuid        REFERENCES transaction_outcomes(id) ON DELETE SET NULL,
  event_type    text        NOT NULL,   -- 'offer_submitted' | 'counter_offer' | etc.
  event_date    date,
  offer_price   numeric,
  counter_price numeric,
  notes         text,
  recorded_by   text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_negotiation_events_property
  ON negotiation_events(property_id, created_at DESC);

ALTER TABLE negotiation_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'negotiation_events' AND policyname = 'service_role_all_negotiation_events'
  ) THEN
    CREATE POLICY service_role_all_negotiation_events ON negotiation_events
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 12. distribution_outcomes
-- Source: lib/intelligence/distributionOutcomes.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS distribution_outcomes (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_event_id   text        NOT NULL,
  property_id             text        NOT NULL,
  recipient_email         text        NOT NULL,
  recipient_type          text        NOT NULL,   -- 'agent' | 'investor'
  recipient_tier          text,
  distribution_rank       int,
  opened_at               timestamptz,
  replied_at              timestamptz,
  meeting_booked_at       timestamptz,
  offer_submitted_at      timestamptz,
  closed_at               timestamptz,
  outcome                 text,         -- 'no_response' | 'opened' | 'replied' | 'meeting' | 'offer' | 'won' | 'lost'
  rejection_reason        text,
  time_to_reply_hours     numeric,
  time_to_close_days      numeric,
  created_at              timestamptz NOT NULL DEFAULT now(),
  UNIQUE (distribution_event_id, recipient_email)
);

CREATE INDEX IF NOT EXISTS idx_distribution_outcomes_recipient
  ON distribution_outcomes(recipient_email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_distribution_outcomes_property
  ON distribution_outcomes(property_id, created_at DESC);

ALTER TABLE distribution_outcomes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'distribution_outcomes' AND policyname = 'service_role_all_distribution_outcomes'
  ) THEN
    CREATE POLICY service_role_all_distribution_outcomes ON distribution_outcomes
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 13. distribution_feedback_weights
-- Source: lib/intelligence/distributionFeedback.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS distribution_feedback_weights (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email     text        NOT NULL UNIQUE,
  acceptance_weight   numeric     NOT NULL DEFAULT 1.0,
  conversion_weight   numeric     NOT NULL DEFAULT 1.0,
  speed_weight        numeric     NOT NULL DEFAULT 1.0,
  composite_weight    numeric     NOT NULL DEFAULT 1.0,
  outcome_class       text,         -- 'excellent' | 'good' | 'neutral' | 'poor' | 'negative'
  recommended_action  text,         -- 'prioritize' | 'maintain' | 'reduce' | 'suppress'
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_distribution_feedback_email
  ON distribution_feedback_weights(recipient_email);

ALTER TABLE distribution_feedback_weights ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'distribution_feedback_weights' AND policyname = 'service_role_all_distribution_feedback_weights'
  ) THEN
    CREATE POLICY service_role_all_distribution_feedback_weights ON distribution_feedback_weights
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 14. recipient_performance_profiles
-- Source: lib/intelligence/distributionOutcomes.ts, engagementDecay.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS recipient_performance_profiles (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email         text        NOT NULL UNIQUE,
  recipient_type          text        NOT NULL DEFAULT 'agent',   -- 'agent' | 'investor'
  current_tier            text,
  total_distributions     int         NOT NULL DEFAULT 0,
  total_opens             int         NOT NULL DEFAULT 0,
  total_replies           int         NOT NULL DEFAULT 0,
  total_meetings          int         NOT NULL DEFAULT 0,
  total_offers            int         NOT NULL DEFAULT 0,
  total_won               int         NOT NULL DEFAULT 0,
  open_rate               numeric,
  reply_rate              numeric,
  meeting_rate            numeric,
  offer_rate              numeric,
  close_rate              numeric,
  avg_commission          numeric,
  total_commission        numeric,
  roi_score               numeric,
  distributions_last_7d   int         NOT NULL DEFAULT 0,
  distributions_last_30d  int         NOT NULL DEFAULT 0,
  last_distributed_at     timestamptz,
  fatigue_score           int         NOT NULL DEFAULT 0,
  is_fatigued             boolean     NOT NULL DEFAULT false,
  cooldown_until          timestamptz,
  last_computed_at        timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipient_profiles_email
  ON recipient_performance_profiles(recipient_email);
CREATE INDEX IF NOT EXISTS idx_recipient_profiles_roi
  ON recipient_performance_profiles(roi_score DESC);
CREATE INDEX IF NOT EXISTS idx_recipient_profiles_last_distributed
  ON recipient_performance_profiles(last_distributed_at);

ALTER TABLE recipient_performance_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'recipient_performance_profiles' AND policyname = 'service_role_all_recipient_performance_profiles'
  ) THEN
    CREATE POLICY service_role_all_recipient_performance_profiles ON recipient_performance_profiles
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 15a. auto_model_updates
-- Source: lib/intelligence/autoLearning.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS auto_model_updates (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name       text        NOT NULL,
  from_version     text        NOT NULL,
  to_version       text        NOT NULL,
  trigger_reason   text        NOT NULL,
  metrics_snapshot jsonb       NOT NULL DEFAULT '{}',
  initiated_at     timestamptz NOT NULL DEFAULT now(),
  status           text        NOT NULL DEFAULT 'initiated',  -- 'initiated' | 'promoted' | 'rolled_back' | 'aborted'
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auto_model_updates_status
  ON auto_model_updates(model_name, status, initiated_at DESC);

ALTER TABLE auto_model_updates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'auto_model_updates' AND policyname = 'service_role_all_auto_model_updates'
  ) THEN
    CREATE POLICY service_role_all_auto_model_updates ON auto_model_updates
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 15b. rollback_events
-- Source: lib/intelligence/autoLearning.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS rollback_events (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  model_name          text        NOT NULL,
  from_version        text        NOT NULL,   -- the promoted version being rolled back
  to_version          text        NOT NULL,   -- reverting to this version
  reason              text        NOT NULL,
  accuracy_drop_pct   numeric     NOT NULL DEFAULT 0,
  severity            text        NOT NULL,   -- 'none' | 'warning' | 'critical'
  triggered_at        timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rollback_events_model
  ON rollback_events(model_name, triggered_at DESC);

ALTER TABLE rollback_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rollback_events' AND policyname = 'service_role_all_rollback_events'
  ) THEN
    CREATE POLICY service_role_all_rollback_events ON rollback_events
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 16a. model_versions
-- Source: lib/intelligence/modelVersioning.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS model_versions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  version_name   text        NOT NULL,
  scorer_version text        NOT NULL,
  description    text,
  config         jsonb       NOT NULL DEFAULT '{}',
  status         text        NOT NULL DEFAULT 'draft',  -- 'draft' | 'staging' | 'production' | 'archived'
  backtest_score numeric,
  promoted_at    timestamptz,
  promoted_by    text,
  archived_at    timestamptz,
  archived_by    text,
  created_by     text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_versions_status
  ON model_versions(status, created_at DESC);

ALTER TABLE model_versions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'model_versions' AND policyname = 'service_role_all_model_versions'
  ) THEN
    CREATE POLICY service_role_all_model_versions ON model_versions
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 16b. calibration_simulations
-- Source: lib/intelligence/modelVersioning.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS calibration_simulations (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id  uuid        REFERENCES model_versions(id) ON DELETE CASCADE,
  simulation_name   text        NOT NULL,
  description       text,
  property_count    int,
  property_ids      jsonb,        -- array of property UUIDs
  status            text        NOT NULL DEFAULT 'running',  -- 'running' | 'complete' | 'failed'
  run_by            text        NOT NULL,
  score_results     jsonb,
  metrics           jsonb,
  comparison        jsonb,
  started_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calibration_simulations_version
  ON calibration_simulations(model_version_id, created_at DESC);

ALTER TABLE calibration_simulations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'calibration_simulations' AND policyname = 'service_role_all_calibration_simulations'
  ) THEN
    CREATE POLICY service_role_all_calibration_simulations ON calibration_simulations
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 17. market_feedback_signals
-- Source: lib/commercial/moat.ts (count query only — minimal placeholder)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS market_feedback_signals (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   text        NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001',
  signal_type text,
  source      text,
  data        jsonb       NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_feedback_tenant
  ON market_feedback_signals(tenant_id, created_at DESC);

ALTER TABLE market_feedback_signals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'market_feedback_signals' AND policyname = 'service_role_all_market_feedback_signals'
  ) THEN
    CREATE POLICY service_role_all_market_feedback_signals ON market_feedback_signals
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 18. property_ai_distribution
-- Source: lib/property-ai/distribution/distributionOrchestrator.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS property_ai_distribution (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id text        NOT NULL UNIQUE,
  submission_id   text        NOT NULL,
  channel         text        NOT NULL,
  status          text        NOT NULL DEFAULT 'pending',  -- 'pending' | 'published' | 'failed'
  asset_url       text,
  error           text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_ai_distribution_submission
  ON property_ai_distribution(submission_id, created_at DESC);

ALTER TABLE property_ai_distribution ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'property_ai_distribution' AND policyname = 'service_role_all_property_ai_distribution'
  ) THEN
    CREATE POLICY service_role_all_property_ai_distribution ON property_ai_distribution
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 19. property_ai_media
-- Source: lib/property-ai/media/mediaOrchestrator.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS property_ai_media (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id        text        NOT NULL UNIQUE,
  submission_id   text        NOT NULL,
  type            text        NOT NULL DEFAULT 'photo',
  url             text        NOT NULL,
  thumbnail_url   text,
  aesthetic_score numeric     NOT NULL DEFAULT 0,
  is_cover        boolean     NOT NULL DEFAULT false,
  sequence_order  int         NOT NULL DEFAULT 0,
  is_blurry       boolean     NOT NULL DEFAULT false,
  is_duplicate    boolean     NOT NULL DEFAULT false,
  social_crop_url text,
  hero_crop_url   text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_ai_media_submission
  ON property_ai_media(submission_id, sequence_order);

ALTER TABLE property_ai_media ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'property_ai_media' AND policyname = 'service_role_all_property_ai_media'
  ) THEN
    CREATE POLICY service_role_all_property_ai_media ON property_ai_media
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 20. property_ai_copilot
-- Source: lib/property-ai/copilot/copilotOrchestrator.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS property_ai_copilot (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  copilot_id              text        NOT NULL UNIQUE,
  submission_id           text        NOT NULL UNIQUE,
  org_id                  text,
  readiness_score         numeric,
  ready_to_publish        boolean     NOT NULL DEFAULT false,
  recommended_price_eur   numeric,
  strategy                text,
  recommended_publish_time timestamptz,
  primary_persona         text,
  ai_summary              text,
  action_items            jsonb       NOT NULL DEFAULT '[]',
  generated_at            timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_ai_copilot_org
  ON property_ai_copilot(org_id, generated_at DESC);

ALTER TABLE property_ai_copilot ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'property_ai_copilot' AND policyname = 'service_role_all_property_ai_copilot'
  ) THEN
    CREATE POLICY service_role_all_property_ai_copilot ON property_ai_copilot
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 21. property_ai_intelligence
-- Source: lib/property-ai/intelligence/propertyIntelligenceEngine.ts
--         app/api/daily-brief/route.ts, app/api/executive/dashboard/route.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS property_ai_intelligence (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  intel_id                  text        NOT NULL UNIQUE,
  submission_id             text        NOT NULL UNIQUE,
  org_id                    text,
  demand_score              numeric     NOT NULL DEFAULT 0,
  conversion_probability    numeric     NOT NULL DEFAULT 0,
  lead_attractiveness       numeric     NOT NULL DEFAULT 0,
  investor_attractiveness   numeric     NOT NULL DEFAULT 0,
  liquidity_speed_days      int,
  pricing_competitiveness   numeric     NOT NULL DEFAULT 0,
  featured_priority_score   numeric     NOT NULL DEFAULT 0,
  luxury_visibility_score   numeric     NOT NULL DEFAULT 0,
  homepage_placement_score  numeric     NOT NULL DEFAULT 0,
  listing_readiness_score   numeric     NOT NULL DEFAULT 0,
  inquiry_count             int         NOT NULL DEFAULT 0,
  computed_at               timestamptz NOT NULL DEFAULT now(),
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_ai_intelligence_org
  ON property_ai_intelligence(org_id, computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_ai_intelligence_demand
  ON property_ai_intelligence(demand_score DESC);

ALTER TABLE property_ai_intelligence ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'property_ai_intelligence' AND policyname = 'service_role_all_property_ai_intelligence'
  ) THEN
    CREATE POLICY service_role_all_property_ai_intelligence ON property_ai_intelligence
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 22. property_ai_listings
-- Source: lib/property-ai/listing-generator/listingOrchestrator.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS property_ai_listings (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id            text        NOT NULL UNIQUE,
  submission_id         text        NOT NULL,
  org_id                text,
  title                 jsonb       NOT NULL DEFAULT '{}',   -- Record<language, string>
  seo_title             jsonb       NOT NULL DEFAULT '{}',
  description           jsonb       NOT NULL DEFAULT '{}',
  short_description     jsonb       NOT NULL DEFAULT '{}',
  investor_description  jsonb       NOT NULL DEFAULT '{}',
  luxury_description    jsonb       NOT NULL DEFAULT '{}',
  social_caption        jsonb       NOT NULL DEFAULT '{}',
  meta_description      jsonb       NOT NULL DEFAULT '{}',
  seo_keywords          jsonb       NOT NULL DEFAULT '[]',   -- string[]
  estimated_price_eur   numeric,
  price_per_sqm         numeric,
  languages_generated   jsonb       NOT NULL DEFAULT '[]',   -- string[]
  confidence            numeric,
  generated_at          timestamptz NOT NULL DEFAULT now(),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_ai_listings_submission
  ON property_ai_listings(submission_id);
CREATE INDEX IF NOT EXISTS idx_property_ai_listings_org
  ON property_ai_listings(org_id, generated_at DESC);

ALTER TABLE property_ai_listings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'property_ai_listings' AND policyname = 'service_role_all_property_ai_listings'
  ) THEN
    CREATE POLICY service_role_all_property_ai_listings ON property_ai_listings
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 23. property_ai_analysis
-- Source: lib/property-ai/ingestion/mediaIngestionOrchestrator.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS property_ai_analysis (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id             text        NOT NULL UNIQUE,
  submission_id           text        NOT NULL UNIQUE,
  org_id                  text,
  property_type           text,
  bedrooms                int,
  bathrooms               int,
  area_sqm                numeric,
  floor                   int,
  condition               text,
  energy_class            text,
  has_pool                boolean     NOT NULL DEFAULT false,
  has_garden              boolean     NOT NULL DEFAULT false,
  has_parking             boolean     NOT NULL DEFAULT false,
  has_elevator            boolean     NOT NULL DEFAULT false,
  has_sea_view            boolean     NOT NULL DEFAULT false,
  has_golf_view           boolean     NOT NULL DEFAULT false,
  has_city_view           boolean     NOT NULL DEFAULT false,
  has_mountain_view       boolean     NOT NULL DEFAULT false,
  architecture_style      text,
  luxury_score            numeric     NOT NULL DEFAULT 0,
  renovation_probability  numeric     NOT NULL DEFAULT 0,
  sunlight_score          numeric     NOT NULL DEFAULT 0,
  staging_quality         text,
  location                jsonb,
  confidence              numeric     NOT NULL DEFAULT 0,
  analyzed_at             timestamptz NOT NULL DEFAULT now(),
  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_ai_analysis_org
  ON property_ai_analysis(org_id, analyzed_at DESC);

ALTER TABLE property_ai_analysis ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'property_ai_analysis' AND policyname = 'service_role_all_property_ai_analysis'
  ) THEN
    CREATE POLICY service_role_all_property_ai_analysis ON property_ai_analysis
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 24. property_ai_learning_adjustments
-- Source: lib/property-ai/learning/performanceFeedbackLoop.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS property_ai_learning_adjustments (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  adjustment_id text        NOT NULL UNIQUE,
  org_id        text        NOT NULL,
  feature       text        NOT NULL,
  old_weight    numeric     NOT NULL DEFAULT 0,
  new_weight    numeric     NOT NULL DEFAULT 0,
  reason        text,
  applied_at    timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_ai_learning_org
  ON property_ai_learning_adjustments(org_id, applied_at DESC);

ALTER TABLE property_ai_learning_adjustments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'property_ai_learning_adjustments' AND policyname = 'service_role_all_property_ai_learning_adjustments'
  ) THEN
    CREATE POLICY service_role_all_property_ai_learning_adjustments ON property_ai_learning_adjustments
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 25. property_ai_performance_events
-- Source: lib/property-ai/learning/listingPerformanceTracker.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS property_ai_performance_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id      text        NOT NULL UNIQUE,
  submission_id text        NOT NULL,
  org_id        text        NOT NULL,
  event_type    text        NOT NULL,  -- 'click' | 'save' | 'share' | 'inquiry' | etc.
  channel       text        NOT NULL,
  session_id    text,
  occurred_at   timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_property_ai_perf_events_submission
  ON property_ai_performance_events(submission_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_ai_perf_events_org
  ON property_ai_performance_events(org_id, occurred_at DESC);

ALTER TABLE property_ai_performance_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'property_ai_performance_events' AND policyname = 'service_role_all_property_ai_performance_events'
  ) THEN
    CREATE POLICY service_role_all_property_ai_performance_events ON property_ai_performance_events
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 26. portal_users
-- Source: lib/runtime/workflows/workflowRegistry.ts
--         (SELECT id, email, full_name WHERE role='agent')
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS portal_users (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     text        NOT NULL,
  email      text        NOT NULL,
  full_name  text,
  role       text        NOT NULL DEFAULT 'agent',  -- 'agent' | 'admin' | 'viewer'
  is_active  boolean     NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, email)
);

CREATE INDEX IF NOT EXISTS idx_portal_users_org_role
  ON portal_users(org_id, role);
CREATE INDEX IF NOT EXISTS idx_portal_users_email
  ON portal_users(email);

ALTER TABLE portal_users ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'portal_users' AND policyname = 'service_role_all_portal_users'
  ) THEN
    CREATE POLICY service_role_all_portal_users ON portal_users
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 27. agent_onboarding
-- Source: app/api/distribution/onboard/route.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS agent_onboarding (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id                 text        NOT NULL UNIQUE,
  email                    text        NOT NULL,
  steps_completed          jsonb       NOT NULL DEFAULT '[]',   -- string[]
  current_step             text        NOT NULL DEFAULT 'account',
  completion_pct           numeric     NOT NULL DEFAULT 0,
  is_activated             boolean     NOT NULL DEFAULT false,
  invite_code              text,
  invited_by               text,
  started_at               timestamptz NOT NULL DEFAULT now(),
  activated_at             timestamptz,
  time_to_activate_minutes numeric,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  created_at               timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_onboarding_email
  ON agent_onboarding(email);

ALTER TABLE agent_onboarding ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'agent_onboarding' AND policyname = 'service_role_all_agent_onboarding'
  ) THEN
    CREATE POLICY service_role_all_agent_onboarding ON agent_onboarding
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 28. kafka_metrics
-- Provided in task spec (lib/sre/drValidator.ts)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS kafka_metrics (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  consumer_group text        NOT NULL,
  topic          text        NOT NULL,
  consumer_lag   bigint      NOT NULL DEFAULT 0,
  recorded_at    timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kafka_metrics_group_topic
  ON kafka_metrics(consumer_group, topic, recorded_at DESC);

ALTER TABLE kafka_metrics ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'kafka_metrics' AND policyname = 'service_role_all_kafka_metrics'
  ) THEN
    CREATE POLICY service_role_all_kafka_metrics ON kafka_metrics
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 29. ai_feedback
-- Source: lib/ai/feedbackEngine.ts
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ai_feedback (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  correlation_id   text        NOT NULL,
  tenant_id        text        NOT NULL,
  agent_id         text        NOT NULL,
  decision_summary text,
  human_action     text,
  revenue_outcome  numeric,
  success_score    numeric     CHECK (success_score >= 0 AND success_score <= 1),
  feedback_source  text        NOT NULL,   -- 'automatic' | 'human' | 'revenue_event'
  metadata         jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_agent
  ON ai_feedback(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_tenant
  ON ai_feedback(tenant_id, created_at DESC);

ALTER TABLE ai_feedback ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'ai_feedback' AND policyname = 'service_role_all_ai_feedback'
  ) THEN
    CREATE POLICY service_role_all_ai_feedback ON ai_feedback
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
