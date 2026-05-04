-- =============================================================================
-- Agency Group — Performance Indexes (Safe/Defensive)
-- Migration: 20260503_009_performance_indexes.sql
--
-- Adds missing compound indexes identified from actual query patterns.
-- Each index wrapped in column existence check — safe to run at any schema state.
--
-- TABLES TARGETED:
--   - governance_decisions  (actor filtering + audit queries)
--   - offmarket_leads       (alert engine hot path + revenue leakage)
--   - learning_events       (correlation_id compound index)
--   - contacts              (lead scoring + agent-scoped view)
--
-- TABLES EXCLUDED (not yet created in this schema):
--   - distribution_events   → indexes deferred until table is created
--   - deal_review_queue     → indexes deferred until table is created
--
-- SAFETY: DO $$ blocks check column existence before each CREATE INDEX.
--         All CREATE INDEX IF NOT EXISTS — idempotent.
-- =============================================================================

DO $$ BEGIN

  -- -------------------------------------------------------------------------
  -- governance_decisions — actor filtering + audit queries
  -- (existing: idx_governance_decisions_action, idx_governance_decisions_pending)
  -- -------------------------------------------------------------------------

  -- Filter by actor (triggered_by) with time ordering
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'governance_decisions'
      AND column_name = 'triggered_by'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_gd_triggered_by
      ON governance_decisions (triggered_by, created_at DESC)';
  END IF;

  -- Filter by decision outcome with time ordering
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'governance_decisions'
      AND column_name = 'decision'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_gd_decision_created
      ON governance_decisions (decision, created_at DESC)';
  END IF;

  -- -------------------------------------------------------------------------
  -- offmarket_leads — alert engine hot path
  -- (existing: idx_offmarket_leads_score, idx_offmarket_leads_status, ...)
  -- -------------------------------------------------------------------------

  -- Alert engine main query: fully-evaluated leads ready for alert
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='offmarket_leads' AND column_name='last_alerted_at')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='offmarket_leads' AND column_name='buyer_matched_at')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='offmarket_leads' AND column_name='gross_discount_pct')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='offmarket_leads' AND column_name='deal_evaluation_score')
  THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ol_alert_candidates
      ON offmarket_leads (score DESC, last_alerted_at)
      WHERE score IS NOT NULL
        AND buyer_matched_at IS NOT NULL
        AND gross_discount_pct IS NOT NULL
        AND deal_evaluation_score IS NOT NULL';
  END IF;

  -- Anti-spam window check: last alert time
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'offmarket_leads'
      AND column_name = 'last_alerted_at'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ol_last_alerted
      ON offmarket_leads (last_alerted_at DESC)
      WHERE last_alerted_at IS NOT NULL';
  END IF;

  -- Revenue leakage scan: high score + contact status
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'offmarket_leads'
      AND column_name = 'contacto'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ol_score_contact
      ON offmarket_leads (score DESC, contacto)
      WHERE score IS NOT NULL';
  END IF;

  -- CPCV trigger query: readiness + probability
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='offmarket_leads' AND column_name='deal_readiness_score')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='offmarket_leads' AND column_name='cpcv_probability')
  THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ol_cpcv_readiness
      ON offmarket_leads (deal_readiness_score DESC, cpcv_probability DESC)
      WHERE deal_readiness_score IS NOT NULL';
  END IF;

  -- Human failure flag: small partial index = very fast lookup
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'offmarket_leads'
      AND column_name = 'human_failure_flag'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_ol_human_failure
      ON offmarket_leads (human_failure_flag, created_at DESC)
      WHERE human_failure_flag = true';
  END IF;

  -- -------------------------------------------------------------------------
  -- learning_events — correlation_id compound index
  -- (existing: idx_learning_events_correlation on (correlation_id) — no created_at)
  -- (existing: idx_learning_events_type_time on (event_type, created_at DESC))
  -- NOTE: idx_le_event_type_created skipped — covered by idx_learning_events_type_time
  -- -------------------------------------------------------------------------

  -- Compound correlation lookup (cross-event tracing + time ordering)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'learning_events'
      AND column_name = 'correlation_id'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_le_correlation_id
      ON learning_events (correlation_id, created_at DESC)
      WHERE correlation_id IS NOT NULL';
  END IF;

  -- -------------------------------------------------------------------------
  -- contacts — lead scoring hot path
  -- (existing: idx_contacts_lead_score on (lead_score DESC) from 001)
  -- NOTE: _dated suffix avoids name collision with existing single-col index
  -- -------------------------------------------------------------------------

  -- Lead score with time ordering (portal CRM sort + pagination)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contacts'
      AND column_name = 'lead_score'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_contacts_lead_score_dated
      ON contacts (lead_score DESC NULLS LAST, created_at DESC)';
  END IF;

  -- Agent-scoped lead scoring view
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='agent_email')
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='contacts' AND column_name='lead_score')
  THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_contacts_agent_score
      ON contacts (agent_email, lead_score DESC NULLS LAST)
      WHERE agent_email IS NOT NULL';
  END IF;

END $$;

SELECT 'performance indexes (safe) applied' AS status;
