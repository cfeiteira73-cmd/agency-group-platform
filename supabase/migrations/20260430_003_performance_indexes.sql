-- =============================================================================
-- Agency Group · Migration 20260430_003
-- Performance Indexes — Missing Composite & Partial Indexes
--
-- AUDIT FINDINGS (query pattern analysis across 168 routes):
--   - Analytics routes: filter by agent_email + date range (no composite index)
--   - Pipeline routes: filter by fase + updated_at (sequential scan risk)
--   - Revenue loop: group by agent_email (full table scan on large deal_packs)
--   - Notification queries: owner_id + status without composite
--   - Forecast: open deals filtered by fase NOT LIKE patterns (sequential)
--   - Match buyer: lead_id + match_score ORDER BY (index exists but not covering)
--   - Event replay: correlation_id EXISTS, session_id EXISTS (added in 001)
--
-- SAFETY: All CREATE INDEX IF NOT EXISTS — idempotent, no data changes.
--         Supabase does not support CONCURRENTLY in migration context.
-- =============================================================================

-- =============================================================================
-- DEALS — Core pipeline table (most queried)
-- =============================================================================

-- Agent pipeline view: filter by agent_email, order by revenue impact
CREATE INDEX IF NOT EXISTS idx_deals_agent_email_fase
  ON deals(agent_email, fase)
  WHERE agent_email IS NOT NULL;

-- Revenue loop: open deals by updated_at for staleness detection
CREATE INDEX IF NOT EXISTS idx_deals_fase_updated_at
  ON deals(updated_at DESC)
  WHERE fase NOT ILIKE '%fechado%'
    AND fase NOT ILIKE '%escritura%'
    AND fase NOT ILIKE '%posvenda%';

-- Forecast endpoint: all non-cancelled/non-lost deals
CREATE INDEX IF NOT EXISTS idx_deals_open_pipeline
  ON deals(agent_email, expected_fee DESC NULLS LAST)
  WHERE fase NOT ILIKE '%cancelad%'
    AND fase NOT ILIKE '%perdido%';

-- Revenue analytics: realized_fee aggregation by agent
CREATE INDEX IF NOT EXISTS idx_deals_agent_realized_fee
  ON deals(agent_email, realized_fee DESC NULLS LAST)
  WHERE realized_fee IS NOT NULL;

-- Deals by tenant (SaaS readiness)
CREATE INDEX IF NOT EXISTS idx_deals_tenant_fase
  ON deals(tenant_id, fase)
  WHERE tenant_id IS NOT NULL;

-- =============================================================================
-- CONTACTS — High-volume query table
-- =============================================================================

-- Agent contact list with status filter
CREATE INDEX IF NOT EXISTS idx_contacts_agent_email_status
  ON contacts(agent_email, status)
  WHERE agent_email IS NOT NULL;

-- Lead scoring: contacts needing follow-up
CREATE INDEX IF NOT EXISTS idx_contacts_next_followup
  ON contacts(next_followup_at ASC)
  WHERE next_followup_at IS NOT NULL
    AND status NOT IN ('lost', 'client');

-- Buyer matching: budget range queries
CREATE INDEX IF NOT EXISTS idx_contacts_budget
  ON contacts(budget_min, budget_max)
  WHERE budget_min IS NOT NULL OR budget_max IS NOT NULL;

-- Dormant lead detection: last_contact_at with status
CREATE INDEX IF NOT EXISTS idx_contacts_dormant_detection
  ON contacts(last_contact_at ASC)
  WHERE status NOT IN ('lost', 'client', 'vip')
    AND last_contact_at IS NOT NULL;

-- =============================================================================
-- DEAL_PACKS — Frequently filtered by agent + status
-- =============================================================================

-- Agent deal pack list
CREATE INDEX IF NOT EXISTS idx_deal_packs_created_by_status
  ON deal_packs(created_by, status)
  WHERE created_by IS NOT NULL;

-- Sent packs awaiting view (for follow-up automation)
CREATE INDEX IF NOT EXISTS idx_deal_packs_sent_unviewed
  ON deal_packs(sent_at DESC)
  WHERE status = 'sent';

-- =============================================================================
-- MATCHES — Scoring-heavy queries
-- =============================================================================

-- Covering index for match listing: lead + score + status
CREATE INDEX IF NOT EXISTS idx_matches_lead_score_status
  ON matches(lead_id, match_score DESC, status)
  WHERE lead_id IS NOT NULL;

-- =============================================================================
-- LEARNING_EVENTS — Event bus analytics
-- =============================================================================

-- Revenue loop analytics: agent + event type + recent
CREATE INDEX IF NOT EXISTS idx_learning_events_agent_type_time
  ON learning_events(agent_email, event_type, created_at DESC)
  WHERE agent_email IS NOT NULL;

-- Funnel analysis: event type + time window
CREATE INDEX IF NOT EXISTS idx_learning_events_type_time_asc
  ON learning_events(event_type, created_at ASC);

-- =============================================================================
-- PRIORITY_ITEMS — Dashboard critical path
-- =============================================================================

-- Already has idx_priority_items_open and idx_priority_items_owner
-- Add composite for agent dashboard: owner + deadline + score
CREATE INDEX IF NOT EXISTS idx_priority_items_owner_score_deadline
  ON priority_items(owner_id, priority_score DESC, deadline ASC)
  WHERE status = 'open' AND owner_id IS NOT NULL;

-- Revenue-sorted priority items
CREATE INDEX IF NOT EXISTS idx_priority_items_revenue_impact
  ON priority_items(revenue_impact DESC NULLS LAST)
  WHERE status = 'open' AND revenue_impact IS NOT NULL;

-- =============================================================================
-- PROPERTIES — Search-heavy
-- =============================================================================

-- Public search: zone + status + price
CREATE INDEX IF NOT EXISTS idx_properties_zona_status
  ON properties(zona, status)
  WHERE status IN ('active','Ativo');

-- Price range queries (AVM + search)
CREATE INDEX IF NOT EXISTS idx_properties_preco_range
  ON properties(preco ASC)
  WHERE preco IS NOT NULL AND status IN ('active','Ativo');

-- Embedding search (if using pgvector)
-- NOTE: IVFFlat index requires at least 1 row with non-null embedding
-- CREATE INDEX IF NOT EXISTS idx_properties_embedding ON properties
--   USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- =============================================================================
-- KPI_SNAPSHOTS — Time-series analytics
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kpi_snapshots') THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_agent_date
      ON kpi_snapshots(agent_email, snapshot_date DESC)
      WHERE agent_email IS NOT NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_kpi_snapshots_date
      ON kpi_snapshots(snapshot_date DESC)';
  END IF;
END $$;

-- =============================================================================
-- NOTIFICATIONS — Real-time inbox
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'priority_items' AND column_name = 'owner_id') THEN
    -- Already indexed above
    NULL;
  END IF;
END $$;

-- Done
SELECT 'performance indexes created' AS status;

-- Verify key indexes
SELECT
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
