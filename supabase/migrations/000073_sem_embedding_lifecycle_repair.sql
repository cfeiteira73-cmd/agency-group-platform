-- Migration 073: SEM — Extend embedding invalidation to all canonical semantic fields
-- Phase 2C.C0-SEM-IMPL-RV | 2026-09-19
--
-- PROBLEM FIXED:
--   The original trigger (20260407_property_embeddings) only nulled embedding
--   on descricao change. The canonical property semantic document (SEM-IMPL)
--   depends on 10 fields: nome, tipo, zona, bairro, descricao, features,
--   amenities, lifestyle_tags, quartos, area.
--
--   A change to nome, tipo, zona, bairro, features, amenities, lifestyle_tags,
--   quartos, or area would silently leave the stored embedding valid even though
--   the document text had changed, producing stale embeddings.
--
-- FIX:
--   Replace the trigger function body to null embedding whenever any of the
--   10 canonical semantic document fields changes. The trigger binding itself
--   is unchanged (BEFORE UPDATE, FOR EACH ROW).
--
-- EXCLUDED from invalidation (structural, operational, or not in semantic doc):
--   preco, status, is_off_market, agent_id, images, timestamps, tenant_id,
--   commission_pct, seller_id, mandate_id, source, and all other fields.
--
-- NULL-SAFE: Uses IS DISTINCT FROM throughout (NULL→value, value→NULL, A→B
--   all detected; same-value → no invalidation).
--
-- IDEMPOTENT: CREATE OR REPLACE FUNCTION replaces the body; trigger binding
--   is already in place from the original migration.

CREATE OR REPLACE FUNCTION public.properties_needs_embedding()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    OLD.nome           IS DISTINCT FROM NEW.nome           OR
    OLD.tipo           IS DISTINCT FROM NEW.tipo           OR
    OLD.zona           IS DISTINCT FROM NEW.zona           OR
    OLD.bairro         IS DISTINCT FROM NEW.bairro         OR
    OLD.descricao      IS DISTINCT FROM NEW.descricao      OR
    OLD.features       IS DISTINCT FROM NEW.features       OR
    OLD.amenities      IS DISTINCT FROM NEW.amenities      OR
    OLD.lifestyle_tags IS DISTINCT FROM NEW.lifestyle_tags OR
    OLD.quartos        IS DISTINCT FROM NEW.quartos        OR
    OLD.area           IS DISTINCT FROM NEW.area
  ) THEN
    NEW.embedding := NULL;
  END IF;
  RETURN NEW;
END;
$$;
