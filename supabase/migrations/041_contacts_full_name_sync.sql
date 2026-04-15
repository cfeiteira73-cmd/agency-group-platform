-- =============================================================================
-- MIGRATION 041 — Contacts: back-fill full_name from legacy name column
-- Safe: UPDATE only rows where full_name IS NULL but name IS NOT NULL
-- Also updates last_contact_at from last_contact where needed
-- Also adds source column default if missing
-- =============================================================================

-- 1. Back-fill full_name from name (legacy column)
UPDATE contacts
SET full_name = name
WHERE full_name IS NULL AND name IS NOT NULL;

-- 2. Back-fill last_contact_at from last_contact (legacy column)
--    last_contact was stored as DATE text (YYYY-MM-DD), cast to timestamptz
UPDATE contacts
SET last_contact_at = (last_contact || 'T00:00:00Z')::TIMESTAMPTZ
WHERE last_contact_at IS NULL
  AND last_contact IS NOT NULL
  AND last_contact ~ '^\d{4}-\d{2}-\d{2}$';

-- 3. Back-fill preferred_locations from zonas (legacy column)
UPDATE contacts
SET preferred_locations = zonas
WHERE preferred_locations IS NULL AND zonas IS NOT NULL AND array_length(zonas, 1) > 0;

-- 4. Ensure source column has fallback from origin (legacy column)
-- (Only if origin column exists — wrapped in DO to be safe)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'contacts' AND column_name = 'origin') THEN
    UPDATE contacts
    SET source = origin
    WHERE source IS NULL AND origin IS NOT NULL;
  END IF;
END$$;

-- 5. Create index on full_name for faster search (if not exists)
CREATE INDEX IF NOT EXISTS idx_contacts_full_name ON contacts(full_name);

-- VERIFY:
-- SELECT count(*) FROM contacts WHERE full_name IS NULL AND name IS NOT NULL;
-- Should return 0 after this migration.
