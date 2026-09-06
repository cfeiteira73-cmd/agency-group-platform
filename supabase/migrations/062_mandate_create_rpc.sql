-- =============================================================================
-- Migration 062: Demand Mandate Creation RPC
-- Atomic multi-table mandate creation via SECURITY DEFINER function.
-- Any failure rolls back all inserts atomically (PL/pgSQL savepoint semantics).
--
-- Security:
--   - SECURITY DEFINER with pinned search_path
--   - owner_id must match a real profiles row (FK enforced)
--   - EXECUTE granted to service_role ONLY
--   - anon and authenticated roles explicitly revoked
--
-- Authorization note: the calling API layer MUST verify that the owner
-- has CRM access to the holder_contact_id BEFORE calling this RPC.
-- The RPC does not re-check CRM authorization — that is the API's responsibility.
--
-- Test project: felxvahczmrrvfqrbvyp ONLY
-- Production: FORBIDDEN until explicit gate
-- =============================================================================

CREATE OR REPLACE FUNCTION public.create_demand_mandate_v1(
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_mandate_id          UUID    := gen_random_uuid();
  v_holder_contact_id   BIGINT;
  v_owner_id            UUID;
  v_transaction_mode    TEXT;
  v_purpose             TEXT;
  v_lifecycle_state     TEXT;
  v_budget_min          NUMERIC;
  v_budget_max          NUMERIC;
  v_currency_code       CHAR(3);
  v_budget_provenance   TEXT;
  v_origin              TEXT;
  v_notes               TEXT;
  v_expires_at          TIMESTAMPTZ;
  v_mandate_type        TEXT;
BEGIN
  -- ── Extract required scalar fields ─────────────────────────────────────────
  v_holder_contact_id := (p_payload ->> 'holder_contact_id')::BIGINT;
  v_owner_id          := (p_payload ->> 'owner_id')::UUID;
  v_transaction_mode  := p_payload ->> 'transaction_mode';
  v_purpose           := p_payload ->> 'purpose';
  v_lifecycle_state   := COALESCE(p_payload ->> 'lifecycle_state', 'DRAFT');
  v_budget_provenance := COALESCE(p_payload ->> 'budget_provenance', 'AGENT_VERIFIED');
  v_origin            := COALESCE(p_payload ->> 'origin', 'AGENT_ENTRY');
  v_notes             := p_payload ->> 'notes';
  v_mandate_type      := LOWER(COALESCE(p_payload ->> 'mandate_type', ''));

  -- Budget (nullable)
  v_budget_min     := NULLIF(p_payload ->> 'budget_min', '')::NUMERIC;
  v_budget_max     := NULLIF(p_payload ->> 'budget_max', '')::NUMERIC;
  v_currency_code  := UPPER(COALESCE(NULLIF(p_payload ->> 'currency_code', ''), 'EUR'));
  v_expires_at     := NULLIF(p_payload ->> 'expires_at', '')::TIMESTAMPTZ;

  -- ── Validate minimum required fields ───────────────────────────────────────
  IF v_holder_contact_id IS NULL THEN
    RAISE EXCEPTION 'holder_contact_id is required' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'owner_id is required' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_transaction_mode IS NULL OR v_transaction_mode NOT IN ('BUY', 'RENT') THEN
    RAISE EXCEPTION 'transaction_mode must be BUY or RENT' USING ERRCODE = 'invalid_parameter_value';
  END IF;
  IF v_purpose IS NULL THEN
    RAISE EXCEPTION 'purpose is required' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── Insert core mandate ────────────────────────────────────────────────────
  INSERT INTO public.demand_mandates (
    id, holder_contact_id, owner_id,
    transaction_mode, purpose, lifecycle_state,
    budget_min, budget_max, currency_code, budget_provenance,
    origin, notes, expires_at
  ) VALUES (
    v_mandate_id, v_holder_contact_id, v_owner_id,
    v_transaction_mode, v_purpose, v_lifecycle_state,
    v_budget_min, v_budget_max, v_currency_code, v_budget_provenance,
    v_origin, v_notes, v_expires_at
  );

  -- ── Insert buyer detail (if provided) ──────────────────────────────────────
  IF v_mandate_type = 'buyer' AND (p_payload ? 'buyer_details') THEN
    INSERT INTO public.buyer_mandate_details (
      mandate_id,
      bedrooms_min, bedrooms_max, bathrooms_min,
      area_min_m2, area_max_m2,
      financing_type, timeline, proof_of_funds,
      golden_visa_required, mortgage_preapproved
    ) VALUES (
      v_mandate_id,
      NULLIF(p_payload -> 'buyer_details' ->> 'bedrooms_min', '')::SMALLINT,
      NULLIF(p_payload -> 'buyer_details' ->> 'bedrooms_max', '')::SMALLINT,
      NULLIF(p_payload -> 'buyer_details' ->> 'bathrooms_min', '')::SMALLINT,
      NULLIF(p_payload -> 'buyer_details' ->> 'area_min_m2', '')::NUMERIC,
      NULLIF(p_payload -> 'buyer_details' ->> 'area_max_m2', '')::NUMERIC,
      p_payload -> 'buyer_details' ->> 'financing_type',
      p_payload -> 'buyer_details' ->> 'timeline',
      COALESCE(p_payload -> 'buyer_details' ->> 'proof_of_funds', 'NONE'),
      COALESCE((p_payload -> 'buyer_details' ->> 'golden_visa_required')::BOOLEAN, FALSE),
      COALESCE((p_payload -> 'buyer_details' ->> 'mortgage_preapproved')::BOOLEAN, FALSE)
    );
  END IF;

  -- ── Insert investor detail (if provided) ───────────────────────────────────
  IF v_mandate_type = 'investor' AND (p_payload ? 'investor_details') THEN
    INSERT INTO public.investor_mandate_details (
      mandate_id,
      target_yield_min_pct, target_yield_max_pct,
      ticket_min, ticket_max, ticket_currency_code,
      risk_tolerance, requires_management, open_to_off_market
    ) VALUES (
      v_mandate_id,
      NULLIF(p_payload -> 'investor_details' ->> 'target_yield_min_pct', '')::NUMERIC,
      NULLIF(p_payload -> 'investor_details' ->> 'target_yield_max_pct', '')::NUMERIC,
      NULLIF(p_payload -> 'investor_details' ->> 'ticket_min', '')::NUMERIC,
      NULLIF(p_payload -> 'investor_details' ->> 'ticket_max', '')::NUMERIC,
      UPPER(COALESCE(NULLIF(p_payload -> 'investor_details' ->> 'ticket_currency_code', ''), 'EUR')),
      p_payload -> 'investor_details' ->> 'risk_tolerance',
      COALESCE((p_payload -> 'investor_details' ->> 'requires_management')::BOOLEAN, FALSE),
      COALESCE((p_payload -> 'investor_details' ->> 'open_to_off_market')::BOOLEAN, TRUE)
    );
  END IF;

  -- ── Insert initial locations (if provided) ─────────────────────────────────
  IF (p_payload ? 'locations') AND jsonb_array_length(p_payload -> 'locations') > 0 THEN
    INSERT INTO public.demand_mandate_locations (
      mandate_id, geography_node_id, mode, preference_weight
    )
    SELECT
      v_mandate_id,
      (loc ->> 'geography_node_id')::UUID,
      COALESCE(loc ->> 'mode', 'INCLUDE'),
      COALESCE(NULLIF(loc ->> 'preference_weight', '')::SMALLINT, 50)
    FROM jsonb_array_elements(p_payload -> 'locations') loc;
  END IF;

  -- ── Insert initial criteria (if provided) ──────────────────────────────────
  IF (p_payload ? 'criteria') AND jsonb_array_length(p_payload -> 'criteria') > 0 THEN
    INSERT INTO public.demand_mandate_criteria (
      mandate_id, criterion_key, criterion_val, constraint_type, provenance
    )
    SELECT
      v_mandate_id,
      crit ->> 'criterion_key',
      crit ->> 'criterion_val',
      COALESCE(crit ->> 'constraint_type', 'HARD'),
      COALESCE(crit ->> 'provenance', 'AGENT_VERIFIED')
    FROM jsonb_array_elements(p_payload -> 'criteria') crit;
  END IF;

  -- ── Insert initial participants (if provided) ──────────────────────────────
  IF (p_payload ? 'participants') AND jsonb_array_length(p_payload -> 'participants') > 0 THEN
    INSERT INTO public.demand_mandate_participants (
      mandate_id, contact_id, role
    )
    SELECT
      v_mandate_id,
      (part ->> 'contact_id')::BIGINT,
      COALESCE(part ->> 'role', 'DECISION_MAKER')
    FROM jsonb_array_elements(p_payload -> 'participants') part;
  END IF;

  RETURN jsonb_build_object('ok', TRUE, 'mandate_id', v_mandate_id);

EXCEPTION WHEN OTHERS THEN
  -- All inserts in this block have been rolled back by PL/pgSQL savepoint.
  -- Return structured error — no partial data committed.
  RETURN jsonb_build_object(
    'ok', FALSE,
    'error', SQLERRM,
    'sqlstate', SQLSTATE
  );
END;
$$;

-- ── Grants: service_role ONLY ──────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.create_demand_mandate_v1(JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_demand_mandate_v1(JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_demand_mandate_v1(JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_demand_mandate_v1(JSONB) TO service_role;

COMMENT ON FUNCTION public.create_demand_mandate_v1(JSONB) IS
  'Atomic mandate creation: inserts demand_mandates + optional detail/location/criteria/participant rows. '
  'Returns {ok: true, mandate_id} or {ok: false, error}. '
  'Authorization must be enforced by the calling API layer BEFORE invoking this RPC. '
  'service_role only.';
