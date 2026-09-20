-- =============================================================================
-- Phase 2C.D2-B-DISCLOSURE-FOUNDATION
-- Email Disclosure Foundation (zero real emails sent in this phase)
--
-- 1. Extend activities_type_check → 'deal_pack_disclosed_email'
-- 2. Add matches.first_disclosed_at/by/channel (once-set COALESCE fields)
-- 3. Create disclosure_deliveries table (transport attempt + delivery record)
-- 4. finalize_deal_pack_email_disclosure() RPC (atomic DB finalization)
--
-- INVARIANTS (PERMANENT):
--   'deal_pack_disclosed_email' activity ≠ buyer interested
--   first_disclosed_at set ONCE via COALESCE — never overwritten
--   disclosure_deliveries.idempotency_key is server-generated, UNIQUE
--   RPC finalizes ONLY confirmed-sent deliveries
--   DEALPACK_EMAIL_SEND_ACTIVE=false means zero Resend calls (enforced at API layer)
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Extend activities_type_check — add deal_pack_disclosed_email
--    (drop 000080 constraint, re-add with D2-B-FOUNDATION type)
-- ---------------------------------------------------------------------------
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_type_check;
ALTER TABLE activities ADD CONSTRAINT activities_type_check CHECK (type IN (
  'call', 'whatsapp', 'email', 'visit', 'note', 'proposal', 'cpcv', 'meeting', 'task',
  'contact_form', 'property_enquiry', 'sofia_handoff',
  'match_agent_accepted', 'match_agent_rejected',
  'match_disclosure_authorized', 'match_disclosure_revoked',
  'deal_pack_disclosed_email'
));

-- ---------------------------------------------------------------------------
-- 2. Add first_disclosed_at / first_disclosed_by / first_disclosed_channel
--    to matches (once-set summary fields — finalized via COALESCE in RPC)
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
--   pending  : delivery record created, Resend not yet called
--   sending  : Resend called, outcome not yet confirmed
--   sent     : Resend confirmed success (data.id present)
--   failed   : Resend returned explicit error
--   unknown  : timeout / ambiguous (operator must resolve)
--
-- Idempotency:
--   idempotency_key UNIQUE prevents duplicate records at DB level.
--   Key is server-generated as: 'dpd:{pack_id}:{match_id}:{timestamp_ms}'
--   Multiple attempts for the same pack+match are permitted (new key each time)
--   except when a 'pending' or 'sending' record already exists (API blocks double-click).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS disclosure_deliveries (
  id                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Core links
  pack_id               UUID        NOT NULL REFERENCES deal_packs(id) ON DELETE RESTRICT,
  match_id              UUID        NOT NULL REFERENCES matches(id)     ON DELETE RESTRICT,
  contact_id            UUID        NOT NULL REFERENCES contacts(id)    ON DELETE RESTRICT,

  -- Transport
  channel               TEXT        NOT NULL DEFAULT 'email'
                                    CHECK (channel IN ('email', 'whatsapp', 'sms', 'portal', 'manual')),
  recipient_email       TEXT,

  -- Server-generated idempotency key (prevents duplicate records)
  idempotency_key       TEXT        NOT NULL UNIQUE,

  -- Delivery state machine
  delivery_status       TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (delivery_status IN ('pending','sending','sent','failed','unknown')),

  -- Provider response
  provider_name         TEXT        NOT NULL DEFAULT 'resend',
  provider_message_id   TEXT,
  provider_response     JSONB,

  -- Actor (server-resolved, never client-supplied)
  initiated_by          UUID        NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,

  -- Timestamps
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

ALTER TABLE disclosure_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "disclosure_deliveries_service_role"
  ON disclosure_deliveries FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION update_disclosure_deliveries_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_disclosure_deliveries_updated_at ON disclosure_deliveries;
CREATE TRIGGER trg_disclosure_deliveries_updated_at
  BEFORE UPDATE ON disclosure_deliveries
  FOR EACH ROW EXECUTE FUNCTION update_disclosure_deliveries_updated_at();

-- ---------------------------------------------------------------------------
-- 4. finalize_deal_pack_email_disclosure() — atomic DB finalization RPC
--
--    Called ONLY after the transport layer confirms provider acceptance.
--    Performs 4 operations atomically:
--      a. Mark delivery record → 'sent'
--      b. Update deal_packs.status → 'sent' (COALESCE sent_at — first send only)
--      c. Update matches.first_disclosed_* via COALESCE (never overwrite)
--      d. Insert activities event (deal_pack_disclosed_email)
--
--    Parameters are server-resolved at API layer — never client-supplied.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_deal_pack_email_disclosure(
  p_delivery_id       UUID,
  p_pack_id           UUID,
  p_match_id          UUID,
  p_contact_id        UUID,
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
  -- Lock delivery record to prevent concurrent finalization
  SELECT id, delivery_status
  INTO   v_delivery
  FROM   public.disclosure_deliveries
  WHERE  id = p_delivery_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'DELIVERY_NOT_FOUND: delivery % does not exist', p_delivery_id;
  END IF;

  -- Idempotency: already finalized → return without new events
  IF v_delivery.delivery_status = 'sent' THEN
    RETURN jsonb_build_object(
      'idempotent', TRUE,
      'delivery_id', p_delivery_id,
      'already_sent', TRUE
    );
  END IF;

  -- a. Mark delivery → sent
  UPDATE public.disclosure_deliveries SET
    delivery_status     = 'sent',
    sent_at             = v_now,
    provider_message_id = p_provider_msg_id,
    updated_at          = v_now
  WHERE id = p_delivery_id;

  -- b. Transition deal_packs → sent (COALESCE: first send only)
  UPDATE public.deal_packs SET
    status     = 'sent',
    sent_at    = COALESCE(sent_at, v_now),
    updated_at = v_now
  WHERE id = p_pack_id;

  -- c. Set matches.first_disclosed_* (COALESCE: once-set, never overwritten)
  UPDATE public.matches SET
    first_disclosed_at      = COALESCE(first_disclosed_at, v_now),
    first_disclosed_by      = COALESCE(first_disclosed_by, p_actor_id),
    first_disclosed_channel = COALESCE(first_disclosed_channel, 'email'),
    updated_at              = v_now
  WHERE id = p_match_id;

  -- d. Insert audit activity
  INSERT INTO public.activities (
    contact_id, agent_id, type, match_id,
    subject, body, is_automated,
    occurred_at, created_at
  ) VALUES (
    p_contact_id, p_actor_id, 'deal_pack_disclosed_email', p_match_id,
    'Deal Pack enviado por email',
    'Destinatário: ' || p_recipient_email,
    FALSE,
    v_now, v_now
  ) RETURNING id INTO v_act_id;

  RETURN jsonb_build_object(
    'idempotent',    FALSE,
    'delivery_id',   p_delivery_id,
    'activity_id',   v_act_id,
    'sent_at',       v_now
  );
END;
$$;

REVOKE ALL ON FUNCTION public.finalize_deal_pack_email_disclosure(UUID, UUID, UUID, UUID, UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.finalize_deal_pack_email_disclosure(UUID, UUID, UUID, UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_deal_pack_email_disclosure(UUID, UUID, UUID, UUID, UUID, TEXT, TEXT) TO service_role;

COMMIT;
