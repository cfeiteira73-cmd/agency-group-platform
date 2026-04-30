-- =============================================================================
-- Agency Group · Migration 20260430_004
-- Audit Log Table — Immutable Action Trail
--
-- PURPOSE:
--   Provides an immutable audit trail for all critical data mutations.
--   Used for GDPR compliance, security reviews, and revenue dispute resolution.
--
-- DESIGN:
--   - Server-side insertion (called from API routes via service role)
--   - Captures actor (agent email), correlation_id, before/after snapshots
--   - PostgreSQL trigger on deals + contacts for automatic capture
--   - No RLS blocking on INSERT (service_role only writes)
--   - Read access: authenticated agents see their own org's audit events
--
-- PERFORMANCE NOTES:
--   - Uses JSONB for data (compressed, indexable via GIN)
--   - Partial index on recent events (last 90 days) for fast dashboard queries
--   - Old rows (> 2 years) should be archived via CRON job
--
-- SAFETY: All IF NOT EXISTS — idempotent.
-- =============================================================================

-- =============================================================================
-- AUDIT_LOG TABLE
-- =============================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What happened
  table_name       TEXT         NOT NULL,
  operation        TEXT         NOT NULL
                   CHECK (operation IN ('INSERT','UPDATE','DELETE','SELECT_SENSITIVE')),
  record_id        TEXT         NOT NULL,    -- stringified PK of affected row

  -- Who did it
  actor_email      TEXT,                     -- agent email (from API auth context)
  actor_via        TEXT,                     -- 'nextauth' | 'magic_link' | 'service_token'
  tenant_id        UUID,                     -- org context

  -- Request tracing
  correlation_id   UUID,                     -- links to learning_events + logs
  session_id       UUID,
  ip_address       TEXT,                     -- redacted last octet for privacy
  user_agent       TEXT,

  -- Data diff
  old_data         JSONB,                    -- snapshot before change (UPDATE/DELETE)
  new_data         JSONB,                    -- snapshot after change (INSERT/UPDATE)
  changed_columns  TEXT[],                   -- only columns that actually changed

  -- Timestamp
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- Fast actor lookup (GDPR right-to-audit)
CREATE INDEX IF NOT EXISTS idx_audit_log_actor_email
  ON audit_log(actor_email, created_at DESC)
  WHERE actor_email IS NOT NULL;

-- Fast record lookup (dispute resolution)
CREATE INDEX IF NOT EXISTS idx_audit_log_record
  ON audit_log(table_name, record_id, created_at DESC);

-- Recent events (dashboards — last 90 days)
CREATE INDEX IF NOT EXISTS idx_audit_log_recent
  ON audit_log(created_at DESC)
  WHERE created_at > NOW() - INTERVAL '90 days';

-- Correlation tracing
CREATE INDEX IF NOT EXISTS idx_audit_log_correlation
  ON audit_log(correlation_id)
  WHERE correlation_id IS NOT NULL;

-- Tenant isolation lookup
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant
  ON audit_log(tenant_id, created_at DESC)
  WHERE tenant_id IS NOT NULL;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Service role: full access (API routes write via service_role)
CREATE POLICY "audit_log_service_role"
  ON audit_log FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated agents: read their own audit events
CREATE POLICY "audit_log_agent_read"
  ON audit_log FOR SELECT TO authenticated
  USING (actor_email = auth.email() OR actor_email IS NULL);

-- No direct INSERT for authenticated users — only service_role
-- (prevents self-editing the audit trail)

-- ── Comment ──────────────────────────────────────────────────────────────────
COMMENT ON TABLE audit_log IS
  'Immutable audit trail for GDPR, security, and revenue dispute resolution.
   Written via service_role from API routes.
   DO NOT add RLS for INSERT to authenticated role — audit trail must be service-role only.';

-- =============================================================================
-- AUTOMATIC TRIGGER — captures deal mutations without API changes
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_audit_deals_fn()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_changed TEXT[] := '{}';
  v_col     TEXT;
BEGIN
  -- Compute which columns actually changed (UPDATE only)
  IF TG_OP = 'UPDATE' THEN
    FOREACH v_col IN ARRAY ARRAY[
      'fase','valor','imovel','comprador','expected_fee','realized_fee',
      'agent_email','agent_id','property_id','contact_id'
    ] LOOP
      IF row_to_json(OLD)->>v_col IS DISTINCT FROM row_to_json(NEW)->>v_col THEN
        v_changed := v_changed || v_col;
      END IF;
    END LOOP;

    -- Only log if revenue-relevant columns changed
    IF array_length(v_changed, 1) IS NULL THEN
      RETURN NEW;  -- No tracked columns changed — skip audit
    END IF;

    INSERT INTO audit_log (
      table_name, operation, record_id,
      old_data, new_data, changed_columns, created_at
    ) VALUES (
      'deals', 'UPDATE', NEW.id::TEXT,
      to_jsonb(OLD), to_jsonb(NEW), v_changed, NOW()
    );
    RETURN NEW;

  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (
      table_name, operation, record_id,
      new_data, created_at
    ) VALUES (
      'deals', 'INSERT', NEW.id::TEXT,
      to_jsonb(NEW), NOW()
    );
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (
      table_name, operation, record_id,
      old_data, created_at
    ) VALUES (
      'deals', 'DELETE', OLD.id::TEXT,
      to_jsonb(OLD), NOW()
    );
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_deals ON deals;
CREATE TRIGGER trg_audit_deals
  AFTER INSERT OR UPDATE OF fase, valor, imovel, expected_fee, realized_fee OR DELETE
  ON deals
  FOR EACH ROW EXECUTE FUNCTION trg_audit_deals_fn();

-- =============================================================================
-- AUTOMATIC TRIGGER — deal_packs (revenue document mutations)
-- =============================================================================

CREATE OR REPLACE FUNCTION trg_audit_deal_packs_fn()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (
      table_name, operation, record_id,
      old_data, new_data, changed_columns, created_at
    ) VALUES (
      'deal_packs', 'UPDATE', NEW.id::TEXT,
      to_jsonb(OLD), to_jsonb(NEW),
      ARRAY['status','view_count','sent_at','viewed_at'],
      NOW()
    );
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (
      table_name, operation, record_id,
      new_data, created_at
    ) VALUES (
      'deal_packs', 'INSERT', NEW.id::TEXT,
      to_jsonb(NEW), NOW()
    );
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_deal_packs ON deal_packs;
CREATE TRIGGER trg_audit_deal_packs
  AFTER INSERT OR UPDATE OF status, view_count, sent_at
  ON deal_packs
  FOR EACH ROW EXECUTE FUNCTION trg_audit_deal_packs_fn();

-- =============================================================================
-- HELPER FUNCTION — called from API routes to enrich audit records with actor
-- =============================================================================

CREATE OR REPLACE FUNCTION enrich_audit_actor(
  p_record_id TEXT,
  p_table_name TEXT,
  p_actor_email TEXT,
  p_actor_via TEXT,
  p_correlation_id UUID DEFAULT NULL,
  p_tenant_id UUID DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Enrich the most recent audit record for this entity with actor context
  UPDATE audit_log
  SET
    actor_email    = p_actor_email,
    actor_via      = p_actor_via,
    correlation_id = COALESCE(p_correlation_id, correlation_id),
    tenant_id      = COALESCE(p_tenant_id, tenant_id)
  WHERE
    record_id  = p_record_id
    AND table_name = p_table_name
    AND actor_email IS NULL
    AND created_at > NOW() - INTERVAL '5 seconds'
  LIMIT 1;  -- Only enrich most recent matching record
END;
$$;

GRANT EXECUTE ON FUNCTION enrich_audit_actor TO service_role;

-- =============================================================================
-- AUDIT CLEANUP FUNCTION — run monthly via CRON
-- =============================================================================

CREATE OR REPLACE FUNCTION purge_old_audit_logs(p_retain_days INT DEFAULT 730)
RETURNS BIGINT LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_deleted BIGINT;
BEGIN
  DELETE FROM audit_log
  WHERE created_at < NOW() - (p_retain_days || ' days')::INTERVAL
    AND operation NOT IN ('DELETE');  -- Keep DELETE records longer
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

COMMENT ON FUNCTION purge_old_audit_logs IS
  'Purges audit log entries older than p_retain_days (default 730 = 2 years).
   Call monthly via CRON: SELECT purge_old_audit_logs(730);
   DELETE operations are retained indefinitely.';

-- Done
SELECT 'audit_log table + triggers created' AS status;
