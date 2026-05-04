-- =============================================================================
-- Agency Group — Revenue Leakage Config Keys
-- Migration: 20260504_010_leakage_config.sql
--
-- Adds the two leakage-specific threshold keys that are not yet in
-- platform_config. All other thresholds used by revenueLeakage.ts are
-- already seeded in migration 008 (scoring.*, distribution.*).
--
-- NEW KEYS:
--   leakage.human_failure_hours  — hours before open human_failure_flag = critical
--   leakage.cpcv_no_action_days  — days before CPCV-ready lead without action = critical
-- =============================================================================

INSERT INTO platform_config
  (config_key, value_numeric, config_type, category, description)
VALUES
  ('leakage.human_failure_hours', 48, 'numeric', 'leakage',
   'Hours before an open human_failure_flag is classified as critical revenue leakage'),
  ('leakage.cpcv_no_action_days',  7, 'numeric', 'leakage',
   'Days without action on a CPCV-ready lead before it is classified as critical leakage')
ON CONFLICT (config_key) DO NOTHING;

SELECT 'leakage config keys seeded' AS status;
