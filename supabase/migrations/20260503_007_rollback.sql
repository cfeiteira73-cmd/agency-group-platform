-- =============================================================================
-- Rollback: 007_economic_truth_governance
-- =============================================================================

DROP VIEW  IF EXISTS v_learning_system_health;
DROP VIEW  IF EXISTS v_governance_activity;
DROP VIEW  IF EXISTS v_economic_truth_summary;

DROP TABLE IF EXISTS market_feedback_signals;
DROP TABLE IF EXISTS distribution_feedback_weights;
DROP TABLE IF EXISTS override_events;
DROP TABLE IF EXISTS governance_decisions;
DROP TABLE IF EXISTS rollback_events;
DROP TABLE IF EXISTS auto_model_updates;
DROP TABLE IF EXISTS transactional_decisions;
DROP TABLE IF EXISTS economic_truth_events;

SELECT '007_rollback: all tables + views dropped' AS status;
