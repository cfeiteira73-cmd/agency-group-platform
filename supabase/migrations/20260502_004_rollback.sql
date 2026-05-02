-- =============================================================================
-- Agency Group — Production Hardening ROLLBACK
-- 20260502_004_rollback.sql
--
-- Safely reverses 20260502_004_production_hardening.sql.
-- Run ONLY if rollback is explicitly required.
-- =============================================================================

DROP VIEW IF EXISTS v_revenue_by_grade;
DROP VIEW IF EXISTS v_system_health;
DROP VIEW IF EXISTS v_active_distribution_controls;
DROP VIEW IF EXISTS v_review_queue_pending;

DROP TABLE IF EXISTS audit_log              CASCADE;
DROP TABLE IF EXISTS admin_roles            CASCADE;
DROP TABLE IF EXISTS partner_tiers          CASCADE;
DROP TABLE IF EXISTS commission_records     CASCADE;
DROP TABLE IF EXISTS revenue_attribution    CASCADE;
DROP TABLE IF EXISTS data_quality_flags     CASCADE;
DROP TABLE IF EXISTS job_queue             CASCADE;
DROP TABLE IF EXISTS system_alerts         CASCADE;
DROP TABLE IF EXISTS sla_tracking          CASCADE;
DROP TABLE IF EXISTS distribution_controls CASCADE;
DROP TABLE IF EXISTS deal_review_queue     CASCADE;

DO $$
BEGIN
  RAISE NOTICE '20260502_004_rollback.sql: Production Hardening Layer rolled back.';
END $$;
