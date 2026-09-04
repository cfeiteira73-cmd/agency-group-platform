-- =============================================================================
-- Migration 055 — Phase 2A: Real Inbound Capture
-- Additive only. Safe to re-run (IF NOT EXISTS on all statements).
-- Rollback: see end of file.
--
-- SCHEMA DRIFT NOTE (2026-09-04):
--   The live database was initialised from a simplified schema that omits
--   several columns defined in 001_initial_schema.sql but never applied.
--   This migration adds both the drift repair and the Phase 2A additions
--   in a single transaction so the resulting schema is consistent.
--
-- MUST be applied BEFORE migration 056 (which references these enum values
--   and column names). Apply in two separate SQL Editor executions:
--   1. This file (055) — committed before 056 is applied.
--   2. migration 056 — separate execution after 055 commits.
-- =============================================================================

-- ── Activity type enum extensions ─────────────────────────────────────────────
-- These already exist in the live DB (applied previously). IF NOT EXISTS guards
-- make this idempotent.
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'property_enquiry';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'contact_form';
ALTER TYPE activity_type ADD VALUE IF NOT EXISTS 'sofia_handoff';

-- ── contacts: repair schema drift ─────────────────────────────────────────────
-- assigned_to was defined in 001_initial_schema.sql but is missing from live DB.
-- Added without FK constraint to avoid dependency on profiles table existence.
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS assigned_to        UUID;

-- ── contacts: Phase 2A additions ─────────────────────────────────────────────
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS assigned_at        TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS first_response_at  TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS page_url           TEXT;

-- ── activities: repair schema drift ──────────────────────────────────────────
-- subject, body, is_automated, occurred_at defined in 001_initial_schema.sql
-- but missing from live DB. Required by RPC migration 056.
ALTER TABLE activities ADD COLUMN IF NOT EXISTS subject       TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS body          TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS is_automated  BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ── activities: Phase 2A additions ───────────────────────────────────────────
ALTER TABLE activities ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS metadata   JSONB;

-- ── Index for unassigned lead queue ──────────────────────────────────────────
-- Requires contacts.assigned_to and contacts.assigned_at to exist (added above).
CREATE INDEX IF NOT EXISTS idx_contacts_unassigned
  ON contacts(created_at DESC)
  WHERE assigned_to IS NULL AND assigned_at IS NULL;

-- =============================================================================
-- ROLLBACK (if needed — for schema repair columns, dropping may lose data):
--   ALTER TABLE contacts      DROP COLUMN IF EXISTS assigned_to;
--   ALTER TABLE contacts      DROP COLUMN IF EXISTS assigned_at;
--   ALTER TABLE contacts      DROP COLUMN IF EXISTS first_response_at;
--   ALTER TABLE contacts      DROP COLUMN IF EXISTS page_url;
--   ALTER TABLE activities    DROP COLUMN IF EXISTS subject;
--   ALTER TABLE activities    DROP COLUMN IF EXISTS body;
--   ALTER TABLE activities    DROP COLUMN IF EXISTS is_automated;
--   ALTER TABLE activities    DROP COLUMN IF EXISTS occurred_at;
--   ALTER TABLE activities    DROP COLUMN IF EXISTS source_url;
--   ALTER TABLE activities    DROP COLUMN IF EXISTS metadata;
--   DROP INDEX IF EXISTS idx_contacts_unassigned;
-- NOTE: enum values cannot be removed in Postgres.
-- =============================================================================
