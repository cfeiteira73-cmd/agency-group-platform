-- =============================================================================
-- Rollback: 20260502_006_elite_moat.sql
-- =============================================================================

DROP VIEW IF EXISTS v_sla_breach_summary;
DROP VIEW IF EXISTS v_cron_health;
DROP VIEW IF EXISTS v_market_trend_comparison;
DROP VIEW IF EXISTS v_model_version_history;

DROP TABLE IF EXISTS cron_lock                CASCADE;
DROP TABLE IF EXISTS market_segment_trends    CASCADE;
DROP TABLE IF EXISTS calibration_simulations  CASCADE;
DROP TABLE IF EXISTS model_versions           CASCADE;
