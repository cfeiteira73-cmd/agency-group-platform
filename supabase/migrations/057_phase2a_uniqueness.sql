-- =============================================================================
-- Migration 057 — Phase 2A: Concurrency safety, schema integrity, security
-- Additive only. Safe to re-run (IF NOT EXISTS / DROP CONSTRAINT IF EXISTS).
-- Applied 2026-09-05 to live project isbfiofwpxqqpgxoftph.
-- =============================================================================

-- Unique index on activities.metadata->>'submission_id'
-- Guarantees exactly-once activity creation under concurrent requests.
-- Only indexes rows where submission_id IS NOT NULL (partial index).
-- Applied after confirming 0 existing submission_id values.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_activities_submission_id
  ON activities ((metadata->>'submission_id'))
  WHERE metadata->>'submission_id' IS NOT NULL;

-- Partial unique index on contacts.email (allows NULLs, prevents duplicate ingestion).
-- Applied after confirming 0 duplicate emails in existing data.
CREATE UNIQUE INDEX IF NOT EXISTS contacts_email_unique
  ON contacts (email)
  WHERE email IS NOT NULL;

-- Extend activities_type_check to include Phase 2A ingest types.
-- Original constraint allowed: call, whatsapp, email, visit, note, proposal, cpcv, meeting, task.
-- Phase 2A adds: contact_form, property_enquiry, sofia_handoff.
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_type_check;
ALTER TABLE activities ADD CONSTRAINT activities_type_check
  CHECK (type = ANY (ARRAY[
    'call','whatsapp','email','visit','note','proposal','cpcv','meeting','task',
    'contact_form','property_enquiry','sofia_handoff'
  ]));

-- Security: revoke EXECUTE from anon and authenticated roles.
-- ingest_commercial_lead_v1 is SECURITY DEFINER; only service_role may call it.
REVOKE EXECUTE ON FUNCTION public.ingest_commercial_lead_v1 FROM anon;
REVOKE EXECUTE ON FUNCTION public.ingest_commercial_lead_v1 FROM authenticated;
