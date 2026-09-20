-- =============================================================================
-- Phase 2C.D2-B-DISCLOSURE-SAFETY-SR
-- Consent Truth · Resend Transport Safety · Webhook Infrastructure
--
-- 1. Add consent/suppression columns to contacts
--      gdpr_consent          BOOLEAN NULL        — unknown by default (no NOT NULL)
--      gdpr_consent_at       TIMESTAMPTZ NULL    — populated when consent is explicit
--      opt_out_marketing     BOOLEAN NOT NULL DEFAULT FALSE  — suppression: FALSE = no opt-out recorded
--      opt_out_whatsapp      BOOLEAN NOT NULL DEFAULT FALSE  — same suppression semantics
--
-- 2. Extend disclosure_deliveries.delivery_status CHECK
--      + 'delivered'  (provider confirmed receipt via webhook)
--      + 'bounced'    (hard/permanent bounce via webhook)
--
-- CONSENT SEMANTICS (PERMANENT INVARIANTS):
--   gdpr_consent = NULL    → unknown / no recorded consent / historical import
--   gdpr_consent = TRUE    → positive consent explicitly recorded with provenance
--   gdpr_consent = FALSE   → explicit refusal / withdrawal recorded (NOT the default)
--   opt_out_marketing = FALSE → no explicit marketing opt-out is recorded
--   opt_out_marketing = TRUE  → explicit marketing opt-out / suppression exists
--
--   UNKNOWN ≠ REFUSAL
--   NO RECORD ≠ FALSE
--   BOUNCE ≠ CONSENT WITHDRAWAL
--   COMPLAINT → opt_out_marketing suppression only (applied via webhook handler)
--
-- HISTORICAL BACKFILL:
--   30 existing production contacts:
--     gdpr_consent     = NULL  (unknown — no evidence of explicit consent exists)
--     gdpr_consent_at  = NULL  (no timestamp to assign)
--     opt_out_marketing = FALSE (no explicit opt-out recorded — per DEFAULT)
--     opt_out_whatsapp  = FALSE (no explicit opt-out recorded — per DEFAULT)
--
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Add consent/suppression columns to contacts
--    IF NOT EXISTS guards make this safe to re-run.
-- ---------------------------------------------------------------------------

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS gdpr_consent     BOOLEAN,
  ADD COLUMN IF NOT EXISTS gdpr_consent_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS opt_out_marketing BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS opt_out_whatsapp  BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for fast suppression queries (agent gate on opt_out_marketing)
CREATE INDEX IF NOT EXISTS idx_contacts_opt_out_marketing
  ON public.contacts (opt_out_marketing)
  WHERE opt_out_marketing = TRUE;

-- Index for consent queries
CREATE INDEX IF NOT EXISTS idx_contacts_gdpr_consent
  ON public.contacts (gdpr_consent)
  WHERE gdpr_consent IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. Extend disclosure_deliveries.delivery_status CHECK constraint
--    Drop and re-add to include new terminal states from webhook events.
--
--    Full lifecycle:
--      pending  → record created, transport not yet attempted
--      sending  → in-flight (Resend called, awaiting response)
--      sent     → provider accepted the email (V1 first_disclosed_at semantics)
--      delivered→ provider confirmed delivery (webhook: email.delivered)
--      bounced  → hard/permanent bounce (webhook: email.bounced)
--      failed   → explicit provider error response (retryable)
--      unknown  → timeout / ambiguous — requires operator reconciliation
-- ---------------------------------------------------------------------------
ALTER TABLE public.disclosure_deliveries
  DROP CONSTRAINT IF EXISTS disclosure_deliveries_delivery_status_check;

ALTER TABLE public.disclosure_deliveries
  ADD CONSTRAINT disclosure_deliveries_delivery_status_check
  CHECK (delivery_status IN ('pending','sending','sent','delivered','bounced','failed','unknown'));

-- Add webhook outcome timestamps (nullable — only set by webhook handler)
ALTER TABLE public.disclosure_deliveries
  ADD COLUMN IF NOT EXISTS delivered_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bounced_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS complained_at TIMESTAMPTZ;

COMMIT;
