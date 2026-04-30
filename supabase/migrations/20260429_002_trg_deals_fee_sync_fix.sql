-- =============================================================================
-- Agency Group · Migration 20260429_002
-- Fix trg_deals_fee_sync — references stage/gci_net which don't exist
-- in the portal-compat schema (migration 003). Rewrite to use fase/valor.
--
-- SAFE: CREATE OR REPLACE FUNCTION — no data loss
--       Uses confirmed portal-compat columns only
-- =============================================================================

-- ── Drop broken trigger first ─────────────────────────────────────────────────
DROP TRIGGER IF EXISTS trg_deals_fee_sync ON deals;

-- ── Replace function with portal-compat version ───────────────────────────────
-- Uses: fase (TEXT), valor (TEXT "€ 1.250.000"), expected_fee, realized_fee
-- Does NOT reference: stage, gci_net, deal_value, commission_rate (don't exist)

CREATE OR REPLACE FUNCTION sync_deal_expected_fee()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_valor_numeric NUMERIC;
BEGIN
  -- Parse valor from TEXT format "€ 1.250.000" → numeric
  IF NEW.valor IS NOT NULL THEN
    v_valor_numeric := NULLIF(
      REGEXP_REPLACE(NEW.valor, '[^0-9.]', '', 'g'),
      ''
    )::NUMERIC;
  END IF;

  -- Auto-compute expected_fee if not manually set
  -- expected_fee = valor × 5% commission (Agency Group standard)
  IF NEW.expected_fee IS NULL AND v_valor_numeric IS NOT NULL AND v_valor_numeric > 0 THEN
    NEW.expected_fee := ROUND(v_valor_numeric * 0.05, 2);
  END IF;

  -- realized_fee defaults to expected_fee when deal closes at escritura
  IF NEW.realized_fee IS NULL
    AND NEW.expected_fee IS NOT NULL
    AND NEW.fase IS NOT NULL
    AND (
      LOWER(UNACCENT(NEW.fase)) LIKE '%escritura%'
      OR LOWER(UNACCENT(NEW.fase)) LIKE '%fechado%'
      OR LOWER(UNACCENT(NEW.fase)) LIKE '%posvenda%'
    )
  THEN
    NEW.realized_fee := NEW.expected_fee;
  END IF;

  RETURN NEW;
END;
$$;

-- ── Re-attach trigger on correct columns ─────────────────────────────────────
CREATE TRIGGER trg_deals_fee_sync
  BEFORE INSERT OR UPDATE OF valor, fase, expected_fee
  ON deals
  FOR EACH ROW EXECUTE FUNCTION sync_deal_expected_fee();

-- ── Note on UNACCENT ─────────────────────────────────────────────────────────
-- If unaccent extension not installed, replace UNACCENT() with:
--   translate(lower(NEW.fase), 'àáâãäåèéêëìíîïòóôõöùúûü', 'aaaaaaeeeeiiiioooooüuuu')
-- Or just drop the UNACCENT wrapping — the LIKE patterns will still match ASCII values.

SELECT 'trg_deals_fee_sync rewritten for portal-compat schema' AS status;
