-- =============================================================================
-- Migration: 20260520000010_properties_dedup_index
-- Purpose: Enforce ref uniqueness per tenant + performance indexes for
--          tenant-scoped zone+price queries and ingestion dedup checks
-- =============================================================================

-- Unique constraint: one ref per tenant (prevents ingestion duplicates)
create unique index if not exists idx_properties_tenant_ref
  on properties(tenant_id, ref);

-- Performance: zone + price queries (most common filter pattern)
create index if not exists idx_properties_tenant_zona_preco
  on properties(tenant_id, zona, preco desc)
  where status IS DISTINCT FROM 'archived';

-- Performance: status filter (active listings)
create index if not exists idx_properties_tenant_status
  on properties(tenant_id, status, created_at desc);
