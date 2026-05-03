-- =============================================================================
-- Agency Group — Performance Indexes
-- Migration: 20260503_009_performance_indexes.sql
--
-- Adds missing compound indexes identified from actual query patterns in:
--   - distribution_events   (analytics + agent history queries)
--   - governance_decisions  (actor filtering + audit queries)
--   - deal_review_queue     (status listing + reviewer history)
--   - offmarket_leads       (alert engine hot path queries)
--   - learning_events       (correlation_id + event replay)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- distribution_events — missing patterns
-- ---------------------------------------------------------------------------

-- Analytics query: .not('opportunity_score','is',null).gte('created_at', since)
CREATE INDEX IF NOT EXISTS idx_de_score_created
  ON distribution_events (opportunity_score, created_at DESC)
  WHERE opportunity_score IS NOT NULL;

-- Agent-specific distribution history
CREATE INDEX IF NOT EXISTS idx_de_distributed_by
  ON distribution_events (distributed_by, distributed_at DESC)
  WHERE distributed_by IS NOT NULL;

-- Event status + created_at (for ops dashboard queries by status)
CREATE INDEX IF NOT EXISTS idx_de_status_created
  ON distribution_events (event_status, created_at DESC);

-- ---------------------------------------------------------------------------
-- governance_decisions — missing patterns
-- ---------------------------------------------------------------------------

-- Filter by actor (triggered_by)
CREATE INDEX IF NOT EXISTS idx_gd_triggered_by
  ON governance_decisions (triggered_by, created_at DESC);

-- Filter by decision outcome
CREATE INDEX IF NOT EXISTS idx_gd_decision_created
  ON governance_decisions (decision, created_at DESC);

-- ---------------------------------------------------------------------------
-- deal_review_queue — missing patterns
-- ---------------------------------------------------------------------------

-- General status index (existing partial index only covers status='pending')
-- This supports non-pending status listing queries
CREATE INDEX IF NOT EXISTS idx_drq_status_general
  ON deal_review_queue (status, queued_at DESC);

-- Reviewer history queries
CREATE INDEX IF NOT EXISTS idx_drq_reviewer
  ON deal_review_queue (reviewer_email, reviewed_at DESC)
  WHERE reviewer_email IS NOT NULL;

-- Auto-queued analytics
CREATE INDEX IF NOT EXISTS idx_drq_auto_queued
  ON deal_review_queue (auto_queued, created_at DESC);

-- ---------------------------------------------------------------------------
-- offmarket_leads — alert engine hot path
-- ---------------------------------------------------------------------------

-- Alert engine main query: score+buyer+price+eval pipeline
-- Partial index: only fully-evaluated leads (the hot path)
CREATE INDEX IF NOT EXISTS idx_ol_alert_candidates
  ON offmarket_leads (score DESC, last_alerted_at)
  WHERE score IS NOT NULL
    AND buyer_matched_at IS NOT NULL
    AND gross_discount_pct IS NOT NULL
    AND deal_evaluation_score IS NOT NULL;

-- Anti-spam window check: last_alerted_at
CREATE INDEX IF NOT EXISTS idx_ol_last_alerted
  ON offmarket_leads (last_alerted_at DESC)
  WHERE last_alerted_at IS NOT NULL;

-- Revenue leakage scan: high score + no contact
CREATE INDEX IF NOT EXISTS idx_ol_score_contact
  ON offmarket_leads (score DESC, contacto)
  WHERE score IS NOT NULL;

-- CPCV trigger query: readiness + buyer pressure
CREATE INDEX IF NOT EXISTS idx_ol_cpcv_readiness
  ON offmarket_leads (deal_readiness_score DESC, cpcv_probability DESC)
  WHERE deal_readiness_score IS NOT NULL;

-- Human failure flag (small set, partial index = very fast)
CREATE INDEX IF NOT EXISTS idx_ol_human_failure
  ON offmarket_leads (human_failure_flag, created_at DESC)
  WHERE human_failure_flag = true;

-- ---------------------------------------------------------------------------
-- learning_events — correlation_id tracing + replay
-- ---------------------------------------------------------------------------

-- Correlation ID lookup (cross-event tracing)
CREATE INDEX IF NOT EXISTS idx_le_correlation_id
  ON learning_events (correlation_id, created_at DESC)
  WHERE correlation_id IS NOT NULL;

-- Event type + created_at (common filter pattern)
CREATE INDEX IF NOT EXISTS idx_le_event_type_created
  ON learning_events (event_type, created_at DESC);

-- ---------------------------------------------------------------------------
-- contacts — lead scoring hot path
-- ---------------------------------------------------------------------------

-- Lead score ordering (portal CRM sort)
CREATE INDEX IF NOT EXISTS idx_contacts_lead_score
  ON contacts (lead_score DESC NULLS LAST, created_at DESC);

-- Agent + lead_score (agent-scoped CRM view)
CREATE INDEX IF NOT EXISTS idx_contacts_agent_score
  ON contacts (agent_email, lead_score DESC NULLS LAST)
  WHERE agent_email IS NOT NULL;
