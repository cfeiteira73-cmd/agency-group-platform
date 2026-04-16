-- =============================================================================
-- Migration 20260416_001 — investidores updated_at trigger
-- Context: investidores table was created in 20260407_001_investidores.sql but
--          the trigger was skipped due to dollar-quoting issues in browser
--          automation. Using single-quoted string body instead.
-- RUN IN: Supabase Dashboard → SQL Editor
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_investidores()
RETURNS TRIGGER LANGUAGE plpgsql AS
'BEGIN NEW.updated_at = NOW(); RETURN NEW; END;';

DROP TRIGGER IF EXISTS trg_investidores_updated_at ON investidores;

CREATE TRIGGER trg_investidores_updated_at
BEFORE UPDATE ON investidores
FOR EACH ROW EXECUTE FUNCTION update_updated_at_investidores();
