-- =============================================================================
-- Migration 056 — Phase 2A: Atomic Commercial Lead Ingest RPC
-- Depends on: 055 (activity_type enum values, source_url, metadata columns)
-- MUST be applied after 055 in a separate transaction because ALTER TYPE ADD VALUE
-- cannot be used and then referenced in the same transaction block.
-- =============================================================================

-- Drop previous version if exists (idempotent)
DROP FUNCTION IF EXISTS public.ingest_commercial_lead_v1(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, TEXT, TIMESTAMPTZ,
  TEXT, TEXT, TEXT, JSONB, TEXT, UUID
);

CREATE OR REPLACE FUNCTION public.ingest_commercial_lead_v1(
  p_email               TEXT,
  p_phone               TEXT,
  p_name                TEXT,
  p_source              TEXT,
  p_notes               TEXT,
  p_preferred_locations TEXT[],
  p_timeline            TEXT,
  p_page_url            TEXT,
  p_intent              TEXT,
  p_next_followup_at    TIMESTAMPTZ,
  -- Activity
  p_activity_type       TEXT,
  p_activity_subject    TEXT,
  p_activity_body       TEXT,
  p_activity_metadata   JSONB,
  p_activity_source_url TEXT,
  -- Idempotency
  p_submission_id       UUID
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id    UUID;
  v_activity_id   UUID;
  v_is_new        BOOLEAN := FALSE;
  v_phone_email   TEXT;
  v_meta          JSONB;
BEGIN
  -- ── Identity guard ────────────────────────────────────────────────────────
  IF p_email IS NULL AND p_phone IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'error', 'email or phone required');
  END IF;

  -- ── Dedup: email first ────────────────────────────────────────────────────
  IF p_email IS NOT NULL THEN
    SELECT id INTO v_contact_id FROM contacts WHERE email = p_email LIMIT 1;
  END IF;

  -- ── Dedup: phone (only if email didn't match) ─────────────────────────────
  IF v_contact_id IS NULL AND p_phone IS NOT NULL THEN
    SELECT id, email INTO v_contact_id, v_phone_email
    FROM contacts WHERE phone = p_phone LIMIT 1;

    -- Identity conflict: phone matches existing contact with a DIFFERENT email
    IF v_contact_id IS NOT NULL
       AND v_phone_email IS NOT NULL
       AND p_email IS NOT NULL
       AND v_phone_email <> p_email THEN
      -- Do not merge — insert as new
      v_contact_id := NULL;
    END IF;
  END IF;

  -- ── Contact upsert ────────────────────────────────────────────────────────
  IF v_contact_id IS NOT NULL THEN
    -- UPDATE: preserve first_touch fields; overwrite current_touch fields
    UPDATE contacts SET
      full_name           = COALESCE(NULLIF(p_name, ''), full_name),
      name                = COALESCE(NULLIF(p_name, ''), name),
      email               = COALESCE(p_email, email),
      phone               = COALESCE(p_phone, phone),
      notes               = COALESCE(p_notes, notes),
      preferred_locations = COALESCE(p_preferred_locations, preferred_locations),
      timeline            = COALESCE(p_timeline, timeline),
      last_contact_at     = NOW(),
      page_url            = COALESCE(p_page_url, page_url)
    WHERE id = v_contact_id;
    v_is_new := FALSE;
  ELSE
    -- INSERT: new contact, unassigned (Amendment 11)
    INSERT INTO contacts (
      full_name, name, email, phone,
      status, source, notes,
      preferred_locations, timeline,
      last_contact_at, next_followup_at, page_url
    ) VALUES (
      COALESCE(NULLIF(p_name, ''), 'Website Lead'),
      COALESCE(NULLIF(p_name, ''), 'Website Lead'),
      p_email, p_phone,
      'lead', p_source, p_notes,
      p_preferred_locations, p_timeline,
      NOW(), p_next_followup_at, p_page_url
    )
    RETURNING id INTO v_contact_id;
    v_is_new := TRUE;
  END IF;

  -- ── Activity idempotency check ────────────────────────────────────────────
  -- If same submission_id already has an activity for this contact, skip insert
  IF p_submission_id IS NOT NULL THEN
    SELECT id INTO v_activity_id
    FROM activities
    WHERE contact_id = v_contact_id
      AND (metadata->>'submission_id') = p_submission_id::TEXT
    LIMIT 1;
  END IF;

  -- ── Activity insert (within same transaction — atomic with contact) ────────
  IF v_activity_id IS NULL THEN
    -- Embed submission_id into metadata for future idempotency lookups
    IF p_submission_id IS NOT NULL THEN
      v_meta := jsonb_set(
        COALESCE(p_activity_metadata, '{}'),
        '{submission_id}',
        to_jsonb(p_submission_id::TEXT)
      );
    ELSE
      v_meta := p_activity_metadata;
    END IF;

    INSERT INTO activities (
      contact_id,
      type,
      subject,
      body,
      outcome,
      is_automated,
      source_url,
      metadata,
      occurred_at
    ) VALUES (
      v_contact_id,
      p_activity_type::activity_type,
      p_activity_subject,
      p_activity_body,
      CASE WHEN v_is_new THEN 'new_lead' ELSE 'existing_lead_updated' END,
      TRUE,
      p_activity_source_url,
      v_meta,
      NOW()
    )
    RETURNING id INTO v_activity_id;
  END IF;

  RETURN jsonb_build_object(
    'success',     TRUE,
    'contact_id',  v_contact_id,
    'is_new',      v_is_new,
    'activity_id', v_activity_id
  );

EXCEPTION WHEN OTHERS THEN
  -- Transaction is rolled back automatically; return structured error
  RETURN jsonb_build_object(
    'success', FALSE,
    'error',   SQLERRM,
    'detail',  SQLSTATE
  );
END;
$$;

-- Revoke default PUBLIC execute (PostgreSQL grants EXECUTE to PUBLIC by default on new functions)
-- Must precede the service_role GRANT to ensure only service_role can call this SECURITY DEFINER function.
REVOKE ALL ON FUNCTION public.ingest_commercial_lead_v1(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, TEXT, TIMESTAMPTZ,
  TEXT, TEXT, TEXT, JSONB, TEXT, UUID
) FROM PUBLIC;

-- Grant execute to service_role only (used by supabaseAdmin via service key)
GRANT EXECUTE ON FUNCTION public.ingest_commercial_lead_v1(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[], TEXT, TEXT, TEXT, TIMESTAMPTZ,
  TEXT, TEXT, TEXT, JSONB, TEXT, UUID
) TO service_role;
