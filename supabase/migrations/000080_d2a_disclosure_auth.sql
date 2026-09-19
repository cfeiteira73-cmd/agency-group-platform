-- =============================================================================
-- Phase 2C.D2-A: Disclosure Authorization Layer
-- Adds disclosure state to matches + extends activities type CHECK
-- + disclose_match() RPC for atomic state-change + audit-event
--
-- INVARIANTS (PERMANENT — must never be violated):
--   disclosure_status='authorized' ≠ actually disclosed ≠ buyer interested
--   Authorization identity always server-derived (never client-supplied)
--   DO NOT add disclosed_at, disclosed_by, or buyer_interested here (D2-B scope)
-- =============================================================================

BEGIN;

-- 1. Disclosure columns on matches
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS disclosure_status        TEXT CHECK (disclosure_status IN ('authorized', 'revoked')),
  ADD COLUMN IF NOT EXISTS disclosure_authorized_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disclosure_authorized_by  UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 2. Extend activities.type CHECK (drop 000077 constraint, re-add with D2-A event types)
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_type_check;
ALTER TABLE activities ADD CONSTRAINT activities_type_check CHECK (type IN (
  'call', 'whatsapp', 'email', 'visit', 'note', 'proposal', 'cpcv', 'meeting', 'task',
  'contact_form', 'property_enquiry', 'sofia_handoff',
  'match_agent_accepted', 'match_agent_rejected',
  'match_disclosure_authorized', 'match_disclosure_revoked'
));

-- 3. Atomic disclosure authorization RPC
--    Performs UPDATE matches + INSERT activities in ONE transaction.
--    Called only after the API layer has:
--      (a) rejected service_token sessions (human actor required)
--      (b) resolved p_authorized_by from the authenticated session email
--    Client never supplies p_authorized_by, agent_id, or contact_id.
CREATE OR REPLACE FUNCTION public.disclose_match(
  p_match_id      UUID,
  p_action        TEXT,        -- 'authorized' | 'revoked'
  p_authorized_by UUID,        -- server-resolved human actor (never client-supplied)
  p_reason        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER               -- runs as calling role (service_role); no priv escalation
SET search_path = public
AS $$
DECLARE
  v_match        RECORD;
  v_act_type     TEXT;
  v_subject      TEXT;
  v_now          TIMESTAMPTZ := now();
  v_activity_id  UUID;
BEGIN
  -- Validate action (defense-in-depth; API layer also validates)
  IF p_action NOT IN ('authorized', 'revoked') THEN
    RAISE EXCEPTION 'INVALID_ACTION: action must be authorized or revoked';
  END IF;

  -- Lock + read current match state atomically
  SELECT id, status, lead_id, disclosure_status
  INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'MATCH_NOT_FOUND: match % does not exist', p_match_id;
  END IF;

  -- Authorization requires reviewed_accepted (Section 19)
  IF p_action = 'authorized' AND v_match.status <> 'reviewed_accepted' THEN
    RAISE EXCEPTION 'INVALID_STATUS: authorization requires status reviewed_accepted, got %', v_match.status;
  END IF;

  -- Revocation requires currently authorized
  IF p_action = 'revoked' AND v_match.disclosure_status <> 'authorized' THEN
    RAISE EXCEPTION 'INVALID_REVOKE: cannot revoke, disclosure_status is %', v_match.disclosure_status;
  END IF;

  -- Idempotency: already in target state → return without new event
  IF v_match.disclosure_status = p_action THEN
    RETURN jsonb_build_object(
      'idempotent', TRUE,
      'activity', NULL,
      'match', jsonb_build_object(
        'id',                   v_match.id,
        'status',               v_match.status,
        'disclosure_status',    v_match.disclosure_status
      )
    );
  END IF;

  -- 1. Update match disclosure state (first half of atomic pair)
  UPDATE public.matches SET
    disclosure_status        = p_action,
    -- preserve original authorized_at/by on revocation (audit trail)
    disclosure_authorized_at = CASE WHEN p_action = 'authorized' THEN v_now
                                    ELSE disclosure_authorized_at END,
    disclosure_authorized_by = CASE WHEN p_action = 'authorized' THEN p_authorized_by
                                    ELSE disclosure_authorized_by END,
    updated_at               = v_now
  WHERE id = p_match_id;

  -- Activity type + subject
  v_act_type := CASE WHEN p_action = 'authorized'
    THEN 'match_disclosure_authorized' ELSE 'match_disclosure_revoked' END;
  v_subject  := CASE WHEN p_action = 'authorized'
    THEN 'Divulgação autorizada' ELSE 'Autorização revogada' END;

  -- 2. Insert audit activity (second half of atomic pair)
  --    contact_id derived from match.lead_id — never from client
  --    agent_id = server-resolved human actor — never from client
  INSERT INTO public.activities (
    contact_id, agent_id, type, match_id,
    subject, body, is_automated,
    occurred_at, created_at
  ) VALUES (
    v_match.lead_id, p_authorized_by, v_act_type, p_match_id,
    v_subject, p_reason, FALSE,
    v_now, v_now
  ) RETURNING id INTO v_activity_id;

  -- Both operations committed together; any exception rolls back both.
  -- Section 4/48: DISCLOSURE AUTHORIZED ≠ BUYER INTERESTED ≠ DEAL ≠ ACTUALLY DISCLOSED
  RETURN jsonb_build_object(
    'idempotent', FALSE,
    'match', jsonb_build_object(
      'id',                    p_match_id,
      'status',                v_match.status,
      'disclosure_status',     p_action,
      'disclosure_authorized_at', CASE WHEN p_action = 'authorized' THEN v_now ELSE NULL END,
      'disclosure_authorized_by', CASE WHEN p_action = 'authorized' THEN p_authorized_by ELSE NULL END
    ),
    'activity', jsonb_build_object(
      'id',         v_activity_id,
      'type',       v_act_type,
      'created_at', v_now
    )
  );
END;
$$;

-- Permissions: service_role and authenticated only; no anon execution
REVOKE ALL ON FUNCTION public.disclose_match(UUID, TEXT, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.disclose_match(UUID, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.disclose_match(UUID, TEXT, UUID, TEXT) TO service_role;

COMMIT;
