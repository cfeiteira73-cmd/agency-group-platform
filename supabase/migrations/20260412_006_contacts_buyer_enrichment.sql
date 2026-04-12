-- =============================================================================
-- Agency Group — Contacts Buyer Enrichment
-- Migration 006 — Wave 12 Audit Fix
-- Ensures contacts table has all fields required for buyer matching
-- IMPORTANT: contacts already has preferred_locations + typologies_wanted
--            This migration adds helpers + audit view + buyer-matching index
-- =============================================================================

-- ── Add missing buyer-matching fields if not yet present ───────────────────

-- buyer_tier as text alias for lead_tier (more explicit naming in buyer context)
-- lead_tier ENUM('A','B','C') already exists → add denormalized text column for APIs
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS buyer_tier TEXT
  GENERATED ALWAYS AS (lead_tier::TEXT) STORED;

-- Ensure preferred_locations and typologies_wanted have GIN indexes for fast matching
CREATE INDEX IF NOT EXISTS idx_contacts_preferred_locations
  ON contacts USING GIN (preferred_locations);

CREATE INDEX IF NOT EXISTS idx_contacts_typologies_wanted
  ON contacts USING GIN (typologies_wanted);

-- Budget coverage index
CREATE INDEX IF NOT EXISTS idx_contacts_budget_range
  ON contacts (budget_min, budget_max)
  WHERE budget_min IS NOT NULL OR budget_max IS NOT NULL;

-- Buyer-ready partial index: active buyers with budget defined
CREATE INDEX IF NOT EXISTS idx_contacts_active_buyers
  ON contacts (lead_score DESC, lead_tier)
  WHERE status IN ('active', 'prospect', 'lead', 'qualified', 'negotiating', 'client', 'vip')
    AND (budget_min IS NOT NULL OR budget_max IS NOT NULL);

-- ── Buyer quality view for fast matching ───────────────────────────────────

CREATE OR REPLACE VIEW buyer_match_candidates AS
SELECT
  id,
  full_name,
  email,
  phone,
  whatsapp,
  budget_min,
  budget_max,
  preferred_locations,   -- zones array (was "zonas" in old code)
  typologies_wanted,     -- asset types array (was "tipos" in old code)
  status,
  lead_tier,
  lead_score,
  last_contact_at,
  next_followup_at,
  timeline,
  financing_type,
  -- Computed: how many zones does this buyer cover?
  COALESCE(array_length(preferred_locations, 1), 0) AS zone_count,
  -- Computed: budget range label
  CASE
    WHEN budget_max >= 3000000 THEN 'HNWI €3M+'
    WHEN budget_max >= 1000000 THEN 'Premium €1M-€3M'
    WHEN budget_max >= 500000  THEN 'Mid €500K-€1M'
    WHEN budget_max IS NOT NULL THEN 'Entry <€500K'
    ELSE 'Não definido'
  END AS budget_tier_label
FROM contacts
WHERE
  status IN ('active', 'prospect', 'lead', 'qualified', 'negotiating', 'client', 'vip')
  AND (budget_min IS NOT NULL OR budget_max IS NOT NULL);

-- ── Audit view: contacts missing buyer data ─────────────────────────────────

CREATE OR REPLACE VIEW contacts_buyer_audit AS
SELECT
  id,
  full_name,
  email,
  phone,
  status,
  lead_tier,
  lead_score,
  -- Flag missing fields
  CASE WHEN budget_min IS NULL AND budget_max IS NULL THEN TRUE ELSE FALSE END AS missing_budget,
  CASE WHEN preferred_locations IS NULL OR array_length(preferred_locations,1) = 0 THEN TRUE ELSE FALSE END AS missing_zones,
  CASE WHEN typologies_wanted IS NULL OR array_length(typologies_wanted,1) = 0 THEN TRUE ELSE FALSE END AS missing_tipos,
  CASE WHEN lead_tier IS NULL THEN TRUE ELSE FALSE END AS missing_tier,
  -- Readiness score 0-4
  (
    CASE WHEN budget_max IS NOT NULL THEN 1 ELSE 0 END +
    CASE WHEN array_length(preferred_locations,1) > 0 THEN 1 ELSE 0 END +
    CASE WHEN array_length(typologies_wanted,1) > 0 THEN 1 ELSE 0 END +
    CASE WHEN lead_tier IS NOT NULL THEN 1 ELSE 0 END
  ) AS buyer_readiness_score,
  created_at,
  last_contact_at
FROM contacts
WHERE status IN ('active', 'prospect', 'lead', 'qualified', 'vip', 'client')
  AND role = 'buyer'
ORDER BY lead_score DESC NULLS LAST;

-- RLS
GRANT SELECT ON buyer_match_candidates TO authenticated, service_role;
GRANT SELECT ON contacts_buyer_audit TO authenticated, service_role;

-- ── Seed: ensure minimum 3 sample buyers exist for testing ──────────────────
-- (These are placeholder buyers for dev/staging — replace with real data in prod)

DO $$
BEGIN
  -- Only insert if no buyers with budget exist yet (prevents re-seeding)
  IF NOT EXISTS (
    SELECT 1 FROM contacts WHERE budget_max IS NOT NULL AND status IN ('active','prospect','qualified') LIMIT 1
  ) THEN
    INSERT INTO contacts (
      full_name, email, phone, role, status, lead_tier, lead_score,
      budget_min, budget_max, preferred_locations, typologies_wanted,
      source, notes
    ) VALUES
    (
      'Comprador Teste A — Lisboa Premium',
      'buyer.a.teste@agencygroup.pt', '+351910000001',
      'buyer', 'qualified', 'A', 85,
      500000, 1500000,
      ARRAY['Lisboa', 'Cascais', 'Estoril', 'Sintra'],
      ARRAY['moradia', 'apartamento', 'villa'],
      'portal_test',
      'TESTE — comprador qualificado Lisboa premium €500K-€1.5M'
    ),
    (
      'Comprador Teste B — Algarve Investidor',
      'buyer.b.teste@agencygroup.pt', '+351910000002',
      'buyer', 'active', 'A', 78,
      800000, 3000000,
      ARRAY['Vilamoura', 'Quinta do Lago', 'Vale do Lobo', 'Lagos', 'Algarve'],
      ARRAY['moradia', 'quinta', 'hotel', 'resort'],
      'portal_test',
      'TESTE — investidor Algarve premium €800K-€3M'
    ),
    (
      'Comprador Teste C — Porto + Madeira',
      'buyer.c.teste@agencygroup.pt', '+351910000003',
      'buyer', 'prospect', 'B', 62,
      200000, 800000,
      ARRAY['Porto', 'Funchal', 'Madeira', 'Foz do Douro'],
      ARRAY['apartamento', 'moradia'],
      'portal_test',
      'TESTE — comprador Porto/Madeira €200K-€800K'
    );

    RAISE NOTICE 'Seeded 3 test buyer contacts for buyer matching validation';
  END IF;
END $$;
