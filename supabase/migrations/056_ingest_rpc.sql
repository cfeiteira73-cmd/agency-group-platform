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
  p_activity_type       TEXT,
  p_activity_subject    TEXT,
  p_activity_body       TEXT,
  p_activity_metadata   JSONB,
  p_activity_source_url TEXT,
  p_submission_id       UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_contact_id          BIGINT;
  v_is_new              BOOLEAN := FALSE;
  v_activity_id         UUID;
  v_existing_act_id     UUID;
  v_found_email         TEXT;
  v_meta                JSONB;
BEGIN
  -- Guard: must supply at least email or phone
  IF (p_email IS NULL OR p_email = '') AND (p_phone IS NULL OR p_phone = '') THEN
    RETURN jsonb_build_object('success', false, 'error', 'email or phone required');
  END IF;

  -- Guard: activity type must be a valid Phase 2A ingest type
  IF p_activity_type NOT IN ('property_enquiry', 'contact_form', 'sofia_handoff') THEN
    RAISE EXCEPTION 'invalid activity_type for ingest_commercial_lead_v1: %', p_activity_type;
  END IF;

  -- Idempotency: if this submission_id already produced an activity, return it immediately
  IF p_submission_id IS NOT NULL THEN
    SELECT id, contact_id INTO v_existing_act_id, v_contact_id
    FROM activities
    WHERE metadata->>'submission_id' = p_submission_id::TEXT
    LIMIT 1;
    IF FOUND THEN
      RETURN jsonb_build_object('success', true, 'contact_id', v_contact_id,
        'is_new', false, 'activity_id', v_existing_act_id, 'duplicate', true);
    END IF;
  END IF;

  -- ── Contact resolution ────────────────────────────────────────────────────
  -- Step 1: Look up by email (primary identity signal)
  IF p_email IS NOT NULL AND p_email <> '' THEN
    SELECT id INTO v_contact_id FROM contacts WHERE email = p_email LIMIT 1;
  END IF;

  -- Step 2: Look up by phone (secondary, only if email lookup missed)
  IF v_contact_id IS NULL AND p_phone IS NOT NULL AND p_phone <> '' THEN
    SELECT id, email INTO v_contact_id, v_found_email
    FROM contacts WHERE phone = p_phone LIMIT 1;

    -- Identity conflict: phone matches an existing contact that already has a DIFFERENT email.
    -- A new email signals a new person — do not merge. Reset to force new contact creation.
    IF v_contact_id IS NOT NULL
       AND v_found_email IS NOT NULL AND v_found_email <> ''
       AND p_email IS NOT NULL AND p_email <> ''
       AND lower(v_found_email) <> lower(p_email) THEN
      v_contact_id := NULL;
    END IF;
  END IF;

  IF v_contact_id IS NOT NULL THEN
    -- Update existing contact (never overwrite source — first-touch attribution)
    UPDATE contacts SET
      full_name           = COALESCE(NULLIF(p_name, ''), full_name),
      name                = COALESCE(NULLIF(p_name, ''), name),
      -- Only set email/phone if this contact didn't have one yet
      email               = CASE WHEN email IS NULL THEN NULLIF(p_email, '') ELSE email END,
      phone               = CASE WHEN phone IS NULL THEN NULLIF(p_phone, '') ELSE phone END,
      notes               = COALESCE(p_notes, notes),
      preferred_locations = COALESCE(p_preferred_locations, preferred_locations),
      timeline            = COALESCE(p_timeline, timeline),
      last_contact_at     = NOW(),
      page_url            = COALESCE(p_page_url, page_url),
      updated_at          = NOW()
    WHERE id = v_contact_id;
    v_is_new := FALSE;
  ELSE
    -- New contact (includes identity-conflict case: new person, don't merge)
    INSERT INTO contacts (
      email, phone, full_name, name, source, notes,
      preferred_locations, timeline, last_contact_at, next_followup_at, page_url, status
    ) VALUES (
      NULLIF(p_email, ''),
      NULLIF(p_phone, ''),
      COALESCE(NULLIF(p_name, ''), 'Website Lead'),
      COALESCE(NULLIF(p_name, ''), 'Website Lead'),
      p_source,
      p_notes,
      p_preferred_locations,
      p_timeline,
      NOW(),
      p_next_followup_at,
      p_page_url,
      'lead'
    )
    RETURNING id INTO v_contact_id;
    v_is_new := TRUE;
  END IF;

  -- ── Build activity metadata ───────────────────────────────────────────────
  v_meta := COALESCE(p_activity_metadata, '{}'::jsonb);
  IF p_submission_id IS NOT NULL THEN
    v_meta := jsonb_set(v_meta, '{submission_id}', to_jsonb(p_submission_id::TEXT));
  END IF;
  IF p_intent IS NOT NULL THEN
    v_meta := jsonb_set(v_meta, '{intent}', to_jsonb(p_intent));
  END IF;

  -- ── Activity insert (atomic with contact in same PL/pgSQL block) ──────────
  INSERT INTO activities (
    contact_id, type, subject, body, outcome,
    is_automated, source_url, metadata, occurred_at
  ) VALUES (
    v_contact_id,
    p_activity_type,
    p_activity_subject,
    p_activity_body,
    CASE WHEN v_is_new THEN 'new_lead' ELSE 'repeat_enquiry' END,
    TRUE,
    p_activity_source_url,
    v_meta,
    NOW()
  )
  RETURNING id INTO v_activity_id;

  RETURN jsonb_build_object(
    'success',     true,
    'contact_id',  v_contact_id,
    'is_new',      v_is_new,
    'activity_id', v_activity_id
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_commercial_lead_v1 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingest_commercial_lead_v1 TO service_role;
