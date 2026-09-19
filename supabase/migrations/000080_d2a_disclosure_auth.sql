-- =============================================================================
-- Phase 2C.D2-A: Disclosure Authorization Layer
-- Adds disclosure state to matches + extends activities type CHECK
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

COMMIT;
