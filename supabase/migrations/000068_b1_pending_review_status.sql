-- Migration 068: Extend properties_status_check to include 'pending_review'
-- Required for Phase 2C.B1 — partner-submitted properties land as pending_review
-- until manually verified by an admin. The B1 double boundary (status != 'active'
-- AND is_off_market = true) ensures they are never visible on the public API.

ALTER TABLE public.properties
  DROP CONSTRAINT IF EXISTS properties_status_check;

ALTER TABLE public.properties
  ADD CONSTRAINT properties_status_check
  CHECK (status IN ('active', 'sold', 'reserved', 'pending_review'));
