-- =============================================================================
-- Rollback: 20260502_005_institutional_completion.sql
-- =============================================================================

DROP VIEW IF EXISTS v_open_incidents;
DROP VIEW IF EXISTS v_pending_operator_tasks;
DROP VIEW IF EXISTS v_distribution_roi;
DROP VIEW IF EXISTS v_active_feature_flags;
DROP VIEW IF EXISTS v_rejection_taxonomy;
DROP VIEW IF EXISTS v_outcome_summary;

DROP TABLE IF EXISTS incident_log              CASCADE;
DROP TABLE IF EXISTS operator_tasks            CASCADE;
DROP TABLE IF EXISTS feature_flags             CASCADE;
DROP TABLE IF EXISTS recipient_performance_profiles CASCADE;
DROP TABLE IF EXISTS distribution_outcomes     CASCADE;
DROP TABLE IF EXISTS calibration_recommendations CASCADE;
DROP TABLE IF EXISTS opportunity_rejections    CASCADE;
DROP TABLE IF EXISTS negotiation_events        CASCADE;
DROP TABLE IF EXISTS transaction_outcomes      CASCADE;
