-- =============================================================================
-- MIGRATION 20260415_021 — Add missing index on push_subscriptions.user_id
--
-- PROBLEM: push_subscriptions.user_id has no index.
--   - Used in FK relationship and common lookups (WHERE user_id = ?)
--   - Missing index causes sequential scan on every lookup
--
-- FIX: Add index. Safe to run multiple times (IF NOT EXISTS).
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions(user_id);

-- Also ensure push_tokens has index on token (used for dedup lookups)
CREATE INDEX IF NOT EXISTS idx_push_tokens_token
  ON public.push_tokens(token);
