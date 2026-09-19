-- =============================================================================
-- Migration 077: D1-REVIEW Activity Type Extension
-- Phase 2C.D1-REVIEW — 2026-09-19
-- =============================================================================
-- Extends activities_type_check to allow D1-REVIEW match review event types.
-- Current set (migration 057): call, whatsapp, email, visit, note, proposal,
--   cpcv, meeting, task, contact_form, property_enquiry, sofia_handoff
-- D1-REVIEW adds: match_agent_accepted, match_agent_rejected
--
-- ADDITIVE ONLY. No rows deleted, no columns dropped, no data mutated.
-- =============================================================================

BEGIN;

ALTER TABLE public.activities DROP CONSTRAINT IF EXISTS activities_type_check;
ALTER TABLE public.activities ADD CONSTRAINT activities_type_check
  CHECK (type = ANY (ARRAY[
    'call','whatsapp','email','visit','note','proposal','cpcv','meeting','task',
    'contact_form','property_enquiry','sofia_handoff',
    'match_agent_accepted','match_agent_rejected'
  ]));

COMMIT;
