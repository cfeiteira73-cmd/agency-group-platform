-- =============================================================================
-- Agency Group — Buyer Intelligence Layer
-- Migration 007 — Wave Final: Deal Machine
-- Elevates contacts table into real buyer pool
-- Adds deal_priority_score + top 3 buyer routing to offmarket_leads
-- SAFE: only adds columns that don't exist; never destroys existing data
-- =============================================================================

-- ── STEP 1: Buyer Intelligence fields on contacts ───────────────────────────

-- Buyer type classification
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS buyer_type TEXT
  CHECK (buyer_type IN ('individual','family_office','developer','fund','operator','investor','unknown'))
  DEFAULT 'individual';

-- Liquidity profile — how fast can they close
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS liquidity_profile TEXT
  CHECK (liquidity_profile IN ('immediate','under_30_days','financed','unknown'))
  DEFAULT 'unknown';

-- Proof of funds verification state
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS proof_of_funds_status TEXT
  CHECK (proof_of_funds_status IN ('verified','partial','unknown'))
  DEFAULT 'unknown';

-- Ticket size preference (free text, e.g. "€500K-€1.5M", "€1M+")
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS ticket_preference TEXT;

-- Investment strategy / mandate
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS target_strategy TEXT
  CHECK (target_strategy IN ('yield','redevelopment','luxury_resi','hotel','land','opportunistic','mixed','unknown'))
  DEFAULT 'unknown';

-- Historical closing data
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deals_closed_count INTEGER DEFAULT 0 NOT NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS avg_close_days    INTEGER; -- NULL = no data

-- Behavioral profile
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS negotiation_style TEXT
  CHECK (negotiation_style IN ('aggressive','conservative','fast','institutional','unknown'))
  DEFAULT 'unknown';

-- Reliability and responsiveness scores (0-100)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS reliability_score SMALLINT
  DEFAULT NULL CHECK (reliability_score IS NULL OR (reliability_score >= 0 AND reliability_score <= 100));

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS response_rate SMALLINT
  DEFAULT NULL CHECK (response_rate IS NULL OR (response_rate >= 0 AND response_rate <= 100));

-- Computed buyer score (0–100) — updated by function/trigger below
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS buyer_score        SMALLINT DEFAULT NULL
  CHECK (buyer_score IS NULL OR (buyer_score >= 0 AND buyer_score <= 100));

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS buyer_score_reason TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS buyer_scored_at    TIMESTAMPTZ;

-- Operational active status (separate from contact_status which is broader)
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS active_status TEXT
  CHECK (active_status IN ('active','dormant','inactive'))
  DEFAULT 'active';

-- Indexes for buyer pool queries
CREATE INDEX IF NOT EXISTS idx_contacts_buyer_score    ON contacts (buyer_score DESC NULLS LAST) WHERE buyer_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_liquidity      ON contacts (liquidity_profile) WHERE liquidity_profile != 'unknown';
CREATE INDEX IF NOT EXISTS idx_contacts_active_status  ON contacts (active_status) WHERE active_status = 'active';
CREATE INDEX IF NOT EXISTS idx_contacts_buyer_type     ON contacts (buyer_type);
CREATE INDEX IF NOT EXISTS idx_contacts_deals_closed   ON contacts (deals_closed_count DESC);

-- ── STEP 2: Deal routing fields on offmarket_leads ──────────────────────────

-- Top 3 buyer IDs for this lead
ALTER TABLE offmarket_leads ADD COLUMN IF NOT EXISTS primary_buyer_id   UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE offmarket_leads ADD COLUMN IF NOT EXISTS secondary_buyer_id UUID REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE offmarket_leads ADD COLUMN IF NOT EXISTS tertiary_buyer_id  UUID REFERENCES contacts(id) ON DELETE SET NULL;

-- Deal priority score (0–100): ranks what to attack first
ALTER TABLE offmarket_leads ADD COLUMN IF NOT EXISTS deal_priority_score SMALLINT DEFAULT NULL
  CHECK (deal_priority_score IS NULL OR (deal_priority_score >= 0 AND deal_priority_score <= 100));

-- Deal path state machine
ALTER TABLE offmarket_leads ADD COLUMN IF NOT EXISTS deal_path TEXT
  CHECK (deal_path IN ('outreach','buyer_matching','preclose','nurture','negotiation','cpcv','escritura'))
  DEFAULT 'outreach';

-- Attack recommendation (generated text)
ALTER TABLE offmarket_leads ADD COLUMN IF NOT EXISTS attack_recommendation TEXT;
ALTER TABLE offmarket_leads ADD COLUMN IF NOT EXISTS preclose_notes        TEXT;
ALTER TABLE offmarket_leads ADD COLUMN IF NOT EXISTS buyer_triad_notes     TEXT;

-- ── STEP 3: Buyer Scoring Function ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION compute_buyer_score(
  p_liquidity      TEXT,
  p_closed_count   INTEGER,
  p_avg_close_days INTEGER,
  p_reliability    SMALLINT,
  p_last_contact   TIMESTAMPTZ
) RETURNS SMALLINT AS $$
DECLARE
  s INTEGER := 0;
  days_ago INTEGER;
BEGIN
  -- 1. Liquidity (0–25) — how fast can money move
  CASE p_liquidity
    WHEN 'immediate'     THEN s := s + 25;
    WHEN 'under_30_days' THEN s := s + 18;
    WHEN 'financed'      THEN s := s + 10;
    ELSE                      s := s + 4;  -- unknown
  END CASE;

  -- 2. Historical closes (0–25) — proven executors win
  IF p_closed_count IS NULL OR p_closed_count = 0 THEN
    s := s + 5;
  ELSIF p_closed_count >= 6 THEN
    s := s + 25;
  ELSIF p_closed_count >= 2 THEN
    s := s + 18;
  ELSE
    s := s + 10;
  END IF;

  -- 3. Closing speed (0–20) — fast buyers are premium
  IF p_avg_close_days IS NULL THEN
    s := s + 5;  -- unknown = slight penalty
  ELSIF p_avg_close_days < 14 THEN
    s := s + 20;
  ELSIF p_avg_close_days < 30 THEN
    s := s + 15;
  ELSIF p_avg_close_days < 60 THEN
    s := s + 10;
  ELSE
    s := s + 5;
  END IF;

  -- 4. Reliability (0–20) — track record of doing what they say
  IF p_reliability IS NOT NULL THEN
    s := s + ROUND(p_reliability * 0.20)::INTEGER;
  ELSE
    s := s + 8;  -- default: slightly below average
  END IF;

  -- 5. Recent activity (0–10) — silent buyers lose priority
  IF p_last_contact IS NULL THEN
    s := s + 2;
  ELSE
    days_ago := EXTRACT(DAY FROM NOW() - p_last_contact)::INTEGER;
    IF    days_ago < 30  THEN s := s + 10;
    ELSIF days_ago < 90  THEN s := s + 6;
    ELSIF days_ago < 180 THEN s := s + 3;
    ELSE                       s := s + 1;
    END IF;
  END IF;

  RETURN LEAST(100, s)::SMALLINT;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── STEP 4: Buyer Score Reason Generator ────────────────────────────────────

CREATE OR REPLACE FUNCTION generate_buyer_score_reason(
  p_score        SMALLINT,
  p_liquidity    TEXT,
  p_closed_count INTEGER,
  p_close_days   INTEGER,
  p_reliability  SMALLINT,
  p_tier         TEXT
) RETURNS TEXT AS $$
DECLARE
  tier_label TEXT;
  liq_label  TEXT;
  spd_label  TEXT;
  parts      TEXT[] := '{}';
BEGIN
  -- Tier label
  tier_label := CASE WHEN p_score >= 80 THEN 'Tier A' WHEN p_score >= 60 THEN 'Tier B' ELSE 'Tier C' END;

  -- Liquidity
  liq_label := CASE p_liquidity
    WHEN 'immediate'     THEN 'liquidez imediata'
    WHEN 'under_30_days' THEN 'liquidez <30 dias'
    WHEN 'financed'      THEN 'financiamento confirmado'
    ELSE 'liquidez desconhecida'
  END;

  -- Speed
  IF p_close_days IS NOT NULL THEN
    spd_label := 'fecho médio ' || p_close_days || 'd';
    parts := array_append(parts, spd_label);
  END IF;

  -- Closes
  IF p_closed_count > 0 THEN
    parts := array_append(parts, p_closed_count || ' deals fechados');
  END IF;

  -- Reliability
  IF p_reliability IS NOT NULL AND p_reliability >= 70 THEN
    parts := array_append(parts, 'fiabilidade ' || p_reliability || '%');
  END IF;

  RETURN '[' || tier_label || ' — ' || p_score || '/100] ' || liq_label ||
         CASE WHEN array_length(parts, 1) > 0 THEN ' · ' || array_to_string(parts, ' · ') ELSE '' END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── STEP 5: Auto-score trigger for contacts ──────────────────────────────────

CREATE OR REPLACE FUNCTION sync_buyer_score() RETURNS TRIGGER AS $$
DECLARE
  new_score SMALLINT;
BEGIN
  -- Only recompute for buyers
  IF NEW.role NOT IN ('buyer', 'investor') THEN
    RETURN NEW;
  END IF;

  new_score := compute_buyer_score(
    NEW.liquidity_profile,
    NEW.deals_closed_count,
    NEW.avg_close_days,
    NEW.reliability_score,
    NEW.last_contact_at
  );

  NEW.buyer_score       := new_score;
  NEW.buyer_score_reason := generate_buyer_score_reason(
    new_score,
    NEW.liquidity_profile,
    NEW.deals_closed_count,
    NEW.avg_close_days,
    NEW.reliability_score,
    NEW.lead_tier::TEXT
  );
  NEW.buyer_scored_at   := NOW();

  -- Auto-update lead_tier based on buyer_score
  IF new_score >= 80 THEN
    NEW.lead_tier := 'A';
  ELSIF new_score >= 60 THEN
    NEW.lead_tier := 'B';
  ELSE
    NEW.lead_tier := 'C';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_buyer_score ON contacts;
CREATE TRIGGER trg_sync_buyer_score
  BEFORE INSERT OR UPDATE OF liquidity_profile, deals_closed_count, avg_close_days,
                              reliability_score, last_contact_at, role
  ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION sync_buyer_score();

-- ── STEP 6: Deal Priority Score trigger on offmarket_leads ──────────────────

CREATE OR REPLACE FUNCTION compute_deal_priority_score() RETURNS TRIGGER AS $$
DECLARE
  lead_s        NUMERIC := COALESCE(NEW.score, 0);
  buyer_match_s NUMERIC := COALESCE(NEW.best_buyer_match_score, 0);
  tier_s        NUMERIC := 20;  -- default
  urgency_s     NUMERIC := 30;  -- default
  dps           NUMERIC;
BEGIN
  -- Buyer tier score (based on buyer_match_notes or matched_to_buyers)
  -- We approximate: if best_buyer_match_score >= 80 → Tier A buyer; 60 → B; else C
  IF NEW.best_buyer_match_score >= 80 THEN    tier_s := 100;
  ELSIF NEW.best_buyer_match_score >= 60 THEN tier_s := 65;
  ELSIF NEW.best_buyer_match_score >= 40 THEN tier_s := 35;
  END IF;

  -- Urgency score
  CASE NEW.urgency
    WHEN 'high'   THEN urgency_s := 100;
    WHEN 'medium' THEN urgency_s := 60;
    WHEN 'low'    THEN urgency_s := 30;
    ELSE               urgency_s := 30;
  END CASE;

  -- Weighted formula: lead 40% + buyer match 30% + tier 20% + urgency 10%
  dps := (lead_s * 0.40) + (buyer_match_s * 0.30) + (tier_s * 0.20) + (urgency_s * 0.10);

  NEW.deal_priority_score := LEAST(100, ROUND(dps))::SMALLINT;

  -- Auto-set deal_path based on current state
  IF NEW.escritura_done_at IS NOT NULL THEN
    NEW.deal_path := 'escritura';
  ELSIF NEW.cpcv_signed_at IS NOT NULL THEN
    NEW.deal_path := 'cpcv';
  ELSIF NEW.negotiation_status NOT IN ('idle', 'withdrawn') THEN
    NEW.deal_path := 'negotiation';
  ELSIF NEW.preclose_candidate = TRUE THEN
    NEW.deal_path := 'preclose';
  ELSIF NEW.matched_to_buyers = TRUE THEN
    NEW.deal_path := 'buyer_matching';
  ELSIF NEW.outreach_ready = TRUE THEN
    NEW.deal_path := 'outreach';
  ELSE
    NEW.deal_path := 'nurture';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_compute_deal_priority ON offmarket_leads;
CREATE TRIGGER trg_compute_deal_priority
  BEFORE INSERT OR UPDATE OF score, best_buyer_match_score, urgency,
                               preclose_candidate, matched_to_buyers, outreach_ready,
                               cpcv_signed_at, escritura_done_at, negotiation_status
  ON offmarket_leads
  FOR EACH ROW
  EXECUTE FUNCTION compute_deal_priority_score();

-- ── STEP 7: Buyer Pool View (elevates buyer_match_candidates from 006) ───────

CREATE OR REPLACE VIEW buyer_pool AS
SELECT
  c.id,
  c.full_name,
  c.email,
  c.phone,
  c.whatsapp,
  -- Budget
  c.budget_min,
  c.budget_max,
  CASE
    WHEN c.budget_max >= 3000000 THEN 'HNWI €3M+'
    WHEN c.budget_max >= 1000000 THEN 'Premium €1M–€3M'
    WHEN c.budget_max >= 500000  THEN 'Mid €500K–€1M'
    WHEN c.budget_max IS NOT NULL THEN 'Entry <€500K'
    ELSE 'Não definido'
  END AS budget_tier_label,
  -- Buyer intelligence
  c.buyer_type,
  c.liquidity_profile,
  c.proof_of_funds_status,
  c.target_strategy,
  c.negotiation_style,
  -- Zones and types
  c.preferred_locations,
  c.typologies_wanted,
  -- Performance
  c.buyer_score,
  c.buyer_score_reason,
  c.buyer_scored_at,
  c.lead_tier,
  c.lead_score,
  c.deals_closed_count,
  c.avg_close_days,
  c.reliability_score,
  c.response_rate,
  c.active_status,
  -- Engagement
  c.last_contact_at,
  c.next_followup_at,
  c.total_interactions,
  c.created_at,
  -- Derived
  EXTRACT(DAY FROM NOW() - c.last_contact_at)::INTEGER AS days_since_contact,
  CASE
    WHEN c.last_contact_at > NOW() - INTERVAL '30 days' THEN 'quente'
    WHEN c.last_contact_at > NOW() - INTERVAL '90 days' THEN 'morno'
    ELSE 'frio'
  END AS engagement_temperature
FROM contacts c
WHERE
  c.role IN ('buyer', 'investor')
  AND c.status NOT IN ('lost', 'referrer')
  AND c.active_status != 'inactive';

-- ── STEP 8: Buyer Pool Audit View ────────────────────────────────────────────

CREATE OR REPLACE VIEW buyer_pool_audit AS
SELECT
  id, full_name, email, phone, status, lead_tier, buyer_score, active_status,
  CASE WHEN budget_max IS NULL AND budget_min IS NULL THEN TRUE ELSE FALSE END AS missing_budget,
  CASE WHEN preferred_locations IS NULL OR array_length(preferred_locations,1) = 0 THEN TRUE ELSE FALSE END AS missing_zones,
  CASE WHEN typologies_wanted IS NULL OR array_length(typologies_wanted,1) = 0 THEN TRUE ELSE FALSE END AS missing_types,
  CASE WHEN liquidity_profile = 'unknown' OR liquidity_profile IS NULL THEN TRUE ELSE FALSE END AS missing_liquidity,
  CASE WHEN deals_closed_count IS NULL OR deals_closed_count = 0 THEN TRUE ELSE FALSE END AS no_deal_history,
  -- Readiness score 0–5: how many key fields are filled
  (
    CASE WHEN budget_max IS NOT NULL THEN 1 ELSE 0 END +
    CASE WHEN array_length(preferred_locations,1) > 0 THEN 1 ELSE 0 END +
    CASE WHEN array_length(typologies_wanted,1) > 0 THEN 1 ELSE 0 END +
    CASE WHEN liquidity_profile != 'unknown' THEN 1 ELSE 0 END +
    CASE WHEN deals_closed_count > 0 THEN 1 ELSE 0 END
  ) AS buyer_readiness_score,
  buyer_scored_at,
  last_contact_at
FROM contacts
WHERE role IN ('buyer', 'investor')
ORDER BY buyer_score DESC NULLS LAST;

GRANT SELECT ON buyer_pool TO authenticated, service_role;
GRANT SELECT ON buyer_pool_audit TO authenticated, service_role;

-- ── STEP 9: Backfill buyer scores for existing contacts ──────────────────────

UPDATE contacts
SET
  buyer_score = compute_buyer_score(
    COALESCE(liquidity_profile, 'unknown'),
    COALESCE(deals_closed_count, 0),
    avg_close_days,
    reliability_score,
    last_contact_at
  ),
  buyer_scored_at = NOW()
WHERE role IN ('buyer', 'investor')
  AND buyer_score IS NULL;

-- ── STEP 10: Backfill deal_priority_score for existing leads ─────────────────

UPDATE offmarket_leads
SET deal_priority_score = LEAST(100, ROUND(
  COALESCE(score, 0) * 0.40 +
  COALESCE(best_buyer_match_score, 0) * 0.30 +
  CASE
    WHEN COALESCE(best_buyer_match_score, 0) >= 80 THEN 100
    WHEN COALESCE(best_buyer_match_score, 0) >= 60 THEN 65
    WHEN COALESCE(best_buyer_match_score, 0) >= 40 THEN 35
    ELSE 20
  END * 0.20 +
  CASE urgency WHEN 'high' THEN 100 WHEN 'medium' THEN 60 ELSE 30 END * 0.10
))::SMALLINT
WHERE deal_priority_score IS NULL;
