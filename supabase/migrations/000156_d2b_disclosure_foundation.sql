-- =============================================================================
-- Phase 2C.D2-B-DISCLOSURE-FOUNDATION
-- Email Disclosure Foundation (zero real emails sent in this phase)
--
-- 1. Extend activities_type_check:
--      + 'deal_pack_disclosed_email'  (platform email transport confirmed)
--      + 'match_disclosed_manual'     (human attestation, offline channel)
-- 2. Add matches.first_disclosed_at/by/channel (COALESCE once-set summary)
--      NOTE: first_disclosed_channel is a ONCE-SET COALESCE field (identical
--      pattern to first_disclosed_at / first_disclosed_by). It captures which
--      channel was used for the very first external disclosure. This is NOT the
--      mutable "matches.disclosure_channel" rejected by D2-B-DISCLOSURE-PF §5.
--      Detailed per-delivery channel truth lives in disclosure_deliveries.channel.
-- 3. Create disclosure_deliveries table (durable transport attempt + delivery)
-- 4. finalize_deal_pack_email_disclosure() RPC (atomic email disclosure close)
-- 5. record_manual_disclosure() RPC (atomic offline/verbal disclosure record)
--
-- INVARIANTS (PERMANENT):
--   deal_pack_disclosed_email activity  ≠ buyer interested
--   match_disclosed_manual activity     ≠ buyer interested
--   first_disclosed_at set ONCE via COALESCE — never overwritten
--   idempotency_key = server-computed from client action_id — UNIQUE
--   RPC finalizes ONLY confirmed-sent deliveries (email) / attested offline
--   DEALPACK_EMAIL_SEND_ACTIVE=false → zero Resend calls (enforced at API layer)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Extend activities_type_check
--    Adds: deal_pack_disclosed_email + match_disclosed_manual
-- ---------------------------------------------------------------------------
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_type_check;
ALTER TABLE activities ADD CONSTRAINT activities_type_check CHECK (type IN (
  'call', 'whatsapp', 'email', 'visit', 'note', 'proposal', 'cpcv', 'meeting', 'task',
  'contact_form', 'property_enquiry', 'sofia_handoff',
  'match_agent_accepted', 'match_agent_rejected',
  'match_disclosure_authorized', 'match_disclosure_revoked',
  'deal_pack_disclosed_email',
  'match_disclosed_manual'
));

-- ---------------------------------------------------------------------------
-- 2. Add first_disclosed_* to matches
--    These are permanent COALESCE once-set summary fields.
--    first_disclosed_channel: which channel was used for THE FIRST disclosure.
--    Subsequent disclosures through different channels are captured in
--    disclosure_deliveries only (not overwriting the first-disclosure summary).
-- ---------------------------------------------------------------------------
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS first_disclosed_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_disclosed_by       UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS first_disclosed_channel  TEXT
    CHECK (first_disclosed_channel IN ('email', 'whatsapp', 'sms', 'portal', 'manual'));

-- ---------------------------------------------------------------------------
-- 3. disclosure_deliveries — durable transport attempt + delivery record
--
-- Lifecycle: pending → sending → sent | failed | unknown
--   pending  : delivery record created; transport not yet attempted
--   sending  : transport in-flight (Resend called, awaiting response)
--   sent     : provider confirmed receipt
--   failed   : provider returned explicit error (retryable with same action_id)
--   unknown  : timeout / ambiguous — requires operator reconciliation before retry
--
-- Idempotency:
--   idempotency_key UNIQUE prevents duplicate records.
--   Key is computed server-side: 'dpd:{pack_id}:{action_id}'
--   action_id is generated client-side before first attempt and reused on retry.
--   Same action_id → same delivery row → same-action retry resumes, not duplicates.
--   Multiple deliberate re-disclosures (new action) use a new action_id.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS disclosure_deliveries (
  id                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,

  pack_id               UUID        NOT NULL REFERENCES deal_packs(id) ON DELETE RESTRICT,
  match_id              UUID        NOT NULL REFERENCES matches(id)     ON DELETE RESTRICT,
  contact_id            BIGINT      NOT NULL REFERENCES contacts(id)    ON DELETE RESTRICT,

  channel               TEXT        NOT NULL DEFAULT 'email'
                                    CHECK (channel IN ('email', 'whatsapp', 'sms', 'portal', 'manual')),

  -- PII: server-derived, never client-supplied
  recipient_email       TEXT,

  -- Server-computed from client action_id: 'dpd:{pack_id}:{action_id}'
  -- UNIQUE prevents duplicate records; same action_id → same row (resumable)
  idempotency_key       TEXT        NOT NULL UNIQUE,

  delivery_status       TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (delivery_status IN ('pending','sending','sent','failed','unknown')),

  provider_name         TEXT        NOT NULL DEFAULT 'resend',
  provider_message_id   TEXT,
  provider_response     JSONB,

  -- Human actor (server-resolved)
  initiated_by          UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,

  attempt_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at               TIMESTAMPTZ,
  failed_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disclosure_deliveries_pack_id    ON disclosure_deliveries(pack_id);
CREATE INDEX IF NOT EXISTS idx_disclosure_deliveries_match_id   ON disclosure_deliveries(match_id);
CREATE INDEX IF NOT EXISTS idx_disclosure_deliveries_contact_id ON disclosure_deliveries(contact_id);
CREATE INDEX IF NOT EXISTS idx_disclosure_deliveries_idem_key   ON disclosure_deliveries(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_disclosure_deliveries_status     ON disclosure_deliveries(delivery_status);

-- RLS: service role only (delivery records contain PII + commercial truth)
-- No browser client can SELECT/INSERT/UPDATE directly
ALTER TABLE disclosure_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "disclosure_deliveries_service_role"
  ON disclosure_deliveries FOR ALL TO service_role USING (true) WITH CHECK (true);

-- No policy for 'authenticated' role → browser clients cannot access this table directly

CREATE OR REPLACE FUNCTION update_disclosure_deliveries_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_disclosure_deliveries_updated_at ON disclosure_deliveries;
CREATE TRIGGER trg_disclosure_deliveries_updated_at
  BEFORE UPDATE ON disclosure_deliveries
  FOR EACH ROW EXECUTE FUNCTION update_disclosure_deliveries_updated_at();

-- ---------------------------------------------------------------------------
-- 4. finalize_deal_pack_email_disclosure() — atomic email disclosure close
--
--    Called ONLY after the transport layer confirms provider acceptance.
--    4 operations atomically:
--      a. Mark delivery record → 'sent'
--      b. Update deal_packs.status → 'sent' (COALESCE sent_at — first only)
--      c. Update matches.first_disclosed_* via COALESCE (once-set)
--      d. Insert activities event (deal_pack_disclosed_email)
--
--    IDEMPOTENT: if delivery is already 'sent', returns {idempotent:true} with
--    no new events — safe to call twice if finalization is retried.
--
--    Parameters are server-resolved at API layer. Browsers/clients cannot call
--    this to fabricate disclosure truth (SECURITY INVOKER; no public GRANT).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_deal_pack_email_disclosure(
  p_delivery_id       UUID,
  p_pack_id           UUID,
  p_match_id          UUID,
  p_contact_id        BIGINT,
  p_actor_id          UUID,
  p_recipient_email   TEXT,
  p_provider_msg_id   TEXT  DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_delivery  RECORD;
  v_act_id    UUID;
  v_now       TIMESTAMPTZ := now();
BEGIN
  SELECT id, delivery_status
  INTO   v_delivery
  FROM   public.disclosure_deliveries
  WHERE  id = p_delivery_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DELIVERY_NOT_FOUND: delivery % does not exist', p_delivery_id;
  END IF;

  IF v_delivery.delivery_status = 'sent' THEN
    RETURN jsonb_build_object(
      'idempotent',  TRUE,
      'delivery_id', p_delivery_id,
      'already_sent', TRUE
    );
  END IF;

  UPDATE public.disclosure_deliveries SET
    delivery_status     = 'sent',
    sent_at             = v_now,
    provider_message_id = p_provider_msg_id,
    updated_at          = v_now
  WHERE id = p_delivery_id;

  UPDATE public.deal_packs SET
    status     = 'sent',
    sent_at    = COALESCE(sent_at, v_now),
    updated_at = v_now
  WHERE id = p_pack_id;

  UPDATE public.matches SET
    first_disclosed_at      = COALESCE(first_disclosed_at, v_now),
    first_disclosed_by      = COALESCE(first_disclosed_by, p_actor_id),
    first_disclosed_channel = COALESCE(first_disclosed_channel, 'email'),
    updated_at              = v_now
  WHERE id = p_match_id;

  INSERT INTO public.activities (
    contact_id, agent_id, type, match_id,
    subject, body, is_automated,
    occurred_at, created_at
  ) VALUES (
    p_contact_id, p_actor_id, 'deal_pack_disclosed_email', p_match_id,
    'Deal Pack enviado por email',
    'Destinatário: ' || p_recipient_email,
    FALSE, v_now, v_now
  ) RETURNING id INTO v_act_id;

  RETURN jsonb_build_object(
    'idempotent',  FALSE,
    'delivery_id', p_delivery_id,
    'activity_id', v_act_id,
    'sent_at',     v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_deal_pack_email_disclosure(UUID, UUID, UUID, BIGINT, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_deal_pack_email_disclosure(UUID, UUID, UUID, BIGINT, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_deal_pack_email_disclosure(UUID, UUID, UUID, BIGINT, UUID, TEXT, TEXT) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. record_manual_disclosure() — atomic offline/verbal disclosure record
--
--    Records that a human actor attested they disclosed the deal pack to a
--    buyer through a non-platform channel (phone, in-person, physical print…).
--    This is NOT an email/WhatsApp send. No digital communication is sent.
--
--    2 operations atomically:
--      a. Update matches.first_disclosed_* via COALESCE (once-set)
--      b. Insert activities event (match_disclosed_manual — explicit semantic)
--
--    'match_disclosed_manual' ≠ 'deal_pack_disclosed_email'
--    'match_disclosed_manual' ≠ buyer interested
--    manual disclosure does NOT change deal_packs.status or deal_packs.sent_at
--
--    IDEMPOTENCY: NOT idempotent by design — each call creates one activity.
--    The API layer ensures the human confirms before calling (confirmation_text).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_manual_disclosure(
  p_match_id     UUID,
  p_pack_id      UUID,
  p_contact_id   BIGINT,
  p_actor_id     UUID,
  p_method       TEXT,
  p_notes        TEXT,
  p_now          TIMESTAMPTZ DEFAULT NOW()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_act_id UUID;
BEGIN
  -- Set first_disclosed_* if not already set (COALESCE — once-set)
  UPDATE public.matches SET
    first_disclosed_at      = COALESCE(first_disclosed_at, p_now),
    first_disclosed_by      = COALESCE(first_disclosed_by, p_actor_id),
    first_disclosed_channel = COALESCE(first_disclosed_channel, 'manual'),
    updated_at              = p_now
  WHERE id = p_match_id;

  -- Insert audit activity with explicit semantic event type
  INSERT INTO public.activities (
    contact_id, agent_id, type, match_id,
    subject, body, is_automated,
    occurred_at, created_at
  ) VALUES (
    p_contact_id, p_actor_id, 'match_disclosed_manual', p_match_id,
    'Divulgação offline — ' || p_method,
    'Pack ' || p_pack_id::text || ' divulgado offline via ' || p_method || '. Notas: ' || p_notes,
    FALSE, p_now, p_now
  ) RETURNING id INTO v_act_id;

  RETURN jsonb_build_object(
    'activity_id', v_act_id,
    'recorded_at', p_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_manual_disclosure(UUID, UUID, BIGINT, UUID, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_manual_disclosure(UUID, UUID, BIGINT, UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_manual_disclosure(UUID, UUID, BIGINT, UUID, TEXT, TEXT, TIMESTAMPTZ) TO service_role;

COMMIT;
