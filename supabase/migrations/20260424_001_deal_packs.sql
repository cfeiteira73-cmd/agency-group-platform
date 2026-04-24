-- =============================================================================
-- Agency Group · Migration 20260424_001
-- Deal Packs + Matches tables
-- =============================================================================

-- ─── deal_packs ──────────────────────────────────────────────────────────────
-- One AI-generated deal presentation per deal/property
CREATE TABLE IF NOT EXISTS deal_packs (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id              UUID        REFERENCES deals(id) ON DELETE SET NULL,
  property_id          UUID        REFERENCES properties(id) ON DELETE SET NULL,
  lead_id              UUID        REFERENCES contacts(id) ON DELETE SET NULL,
  title                TEXT        NOT NULL,
  status               TEXT        NOT NULL DEFAULT 'draft'
                                   CHECK (status IN ('draft','ready','sent','viewed','archived')),

  -- Claude-generated content
  investment_thesis    TEXT,
  market_summary       TEXT,
  opportunity_score    SMALLINT    CHECK (opportunity_score BETWEEN 0 AND 100),

  -- Structured financial data
  financial_projections JSONB      DEFAULT '{}',
  comparables          JSONB       DEFAULT '[]',
  highlights           TEXT[]      DEFAULT '{}',

  -- Tracking
  generated_at         TIMESTAMPTZ DEFAULT NOW(),
  sent_at              TIMESTAMPTZ,
  viewed_at            TIMESTAMPTZ,
  view_count           INT         NOT NULL DEFAULT 0,

  -- Metadata
  created_by           TEXT        NOT NULL,   -- agent email
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deal_packs_deal   ON deal_packs(deal_id);
CREATE INDEX IF NOT EXISTS idx_deal_packs_lead   ON deal_packs(lead_id);
CREATE INDEX IF NOT EXISTS idx_deal_packs_status ON deal_packs(status);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_deal_packs_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_deal_packs_updated_at ON deal_packs;
CREATE TRIGGER trg_deal_packs_updated_at
  BEFORE UPDATE ON deal_packs
  FOR EACH ROW EXECUTE FUNCTION update_deal_packs_updated_at();

-- RLS
ALTER TABLE deal_packs ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "deal_packs_service_role"
  ON deal_packs FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "deal_packs_agent_read"
  ON deal_packs FOR SELECT USING (true);

-- ─── matches ─────────────────────────────────────────────────────────────────
-- Buyer ↔ Property match results (produced by /api/automation/match-buyer)
CREATE TABLE IF NOT EXISTS matches (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id         UUID        NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  property_id     UUID,                         -- nullable: may be external/off-market
  property_ref    TEXT,                         -- human-readable ref (e.g. 'AG-LX-0042')
  property_title  TEXT,

  -- Scoring
  match_score     SMALLINT    NOT NULL CHECK (match_score BETWEEN 0 AND 100),
  breakdown       JSONB       NOT NULL DEFAULT '{}',
  match_reasons   TEXT[]      DEFAULT '{}',
  explanation     TEXT,
  similarity      FLOAT,                        -- pgvector cosine similarity (0-1)
  estimated_yield DECIMAL(5,2),

  -- Workflow
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','viewed','interested','visit_scheduled','rejected')),
  notes           TEXT,

  -- Metadata
  matched_by      TEXT,                         -- agent email that triggered match
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_lead     ON matches(lead_id);
CREATE INDEX IF NOT EXISTS idx_matches_property ON matches(property_id);
CREATE INDEX IF NOT EXISTS idx_matches_status   ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_score    ON matches(match_score DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_matches_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_matches_updated_at ON matches;
CREATE TRIGGER trg_matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_matches_updated_at();

-- RLS
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "matches_service_role"
  ON matches FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY IF NOT EXISTS "matches_agent_read"
  ON matches FOR SELECT USING (true);
