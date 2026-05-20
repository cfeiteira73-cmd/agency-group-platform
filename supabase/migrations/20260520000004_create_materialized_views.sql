-- =============================================================================
-- SUPERSEDED — 20260520000004_create_materialized_views.sql
--
-- This migration is superseded by 20260521000003_create_materialized_views.sql
-- which is more complete (includes anomaly_baselines table, IF NOT EXISTS guards,
-- proper CONCURRENT refresh RPC, security hardening).
--
-- This file is intentionally a no-op to avoid duplicate view creation.
-- The canonical mat-views migration is: 20260521000003_create_materialized_views.sql
-- =============================================================================

SELECT '20260520000004: no-op — superseded by 20260521000003' AS status;
