-- Migration 063: Sanitize RPC error messages to prevent SQL internals leaking to browser
-- Replaces create_demand_mandate_v1 EXCEPTION block with safe message mapping.
-- Raw SQLERRM is preserved server-side via RAISE LOG for observability.
-- SQLSTATE (5-char code) is safe to pass — it contains no schema/table/value data.
-- Our own RAISE EXCEPTION with ERRCODE='invalid_parameter_value' (22023) or P0001
-- produce messages we authored, so they are safe to pass through.

CREATE OR REPLACE FUNCTION public.create_demand_mandate_v1(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  v_holder_contact_id := (p_payload ->> 'holder_contact_id')::BIGINT;
  v_owner_id          := (p_payload ->> 'owner_id')::UUID;
  v_transaction_mode  := p_payload ->> 'transaction_mode';
  v_purpose           := p_payload ->> 'purpose';
  v_lifecycle_state   := COALESCE(p_payload ->> 'lifecycle_state', 'DRAFT');
  v_budget_provenance := COALESCE(p_payload ->> 'budget_provenance', 'AGENT_VERIFIED');
  v_origin            := COALESCE(p_payload ->> 'origin', 'AGENT_ENTRY');
  v_notes             := p_payload ->> 'notes';
  v_mandate_type      := LOWER(COALESCE(p_payload ->> 'mandate_type', ''));

  v_budget_min     := NULLIF(p_payload ->> 'budget_min', '')::NUMERIC;
  v_budget_max     := NULLIF(p_payload ->> 'budget_max', '')::NUMERIC;
  v_currency_code  := UPPER(COALESCE(NULLIF(p_payload ->> 'currency_code', ''), 'EUR'));
  v_expires_at     := NULLIF(p_payload ->> 'expires_at', '')::TIMESTAMPTZ;

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
  -- Server-side observability: full error detail in Postgres logs only, never in response
  RAISE LOG 'create_demand_mandate_v1 SQLSTATE=% SQLERRM=%', SQLSTATE, SQLERRM;
  RETURN jsonb_build_object(
    'ok',       FALSE,
    'sqlstate', SQLSTATE,
    'error', CASE SQLSTATE
      -- Our own authored RAISE EXCEPTION messages (safe: we wrote them)
      WHEN '22023' THEN SQLERRM   -- invalid_parameter_value → our validation messages
      WHEN 'P0001' THEN SQLERRM   -- generic RAISE EXCEPTION → our messages
      -- DB constraint violations: sanitized to safe generic messages
      WHEN '23503' THEN 'Contact not found'
      WHEN '23505' THEN 'A mandate with these parameters already exists'
      WHEN '23514' THEN 'Invalid field value'
      WHEN '23502' THEN 'Required field is missing'
      -- Type/format errors: reveal format expectation only, not internals
      WHEN '22P02' THEN 'Invalid input format'
      WHEN '22003' THEN 'Numeric value out of range'
      WHEN '22007' THEN 'Invalid date or time format'
      -- Everything else: opaque
      ELSE 'Internal error. Contact support.'
    END
  );
END;
$$;

-- Restore security settings
REVOKE ALL ON FUNCTION public.create_demand_mandate_v1(JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_demand_mandate_v1(JSONB) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.create_demand_mandate_v1(JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_demand_mandate_v1(JSONB) TO service_role;
