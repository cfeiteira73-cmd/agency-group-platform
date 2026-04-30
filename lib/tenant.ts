// =============================================================================
// Agency Group — Tenant Context Helper
// lib/tenant.ts
//
// Provides tenant (organization) context for all API routes.
//
// CURRENT STATE (single-agency):
//   All requests resolve to the default Agency Group org.
//   tenant_id is stamped on all new records for SaaS readiness.
//
// FUTURE STATE (multi-tenant SaaS):
//   1. Configure Supabase JWT hook to include tenant_id claim:
//      Dashboard → Auth → Hooks → "Customize access token (JWT)"
//      Function body:
//        SELECT jsonb_build_object(
//          'tenant_id', (SELECT org_id FROM org_members WHERE email = auth.email() LIMIT 1)
//        )
//   2. Set TENANT_ISOLATION_ENABLED=true in environment
//   3. Run migration 20260430_005_tenant_rls_enforcement.sql
//
// USAGE:
//   import { getTenantId, requireTenantContext } from '@/lib/tenant'
//   const tenantId = await getTenantId(req)  // returns UUID or default
// =============================================================================

import { NextRequest } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'

// Default organization UUID for Agency Group (from migration 20260430_002)
export const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'

// Feature flag — set to true only after JWT includes tenant_id claim
const TENANT_ISOLATION_ENABLED = process.env.TENANT_ISOLATION_ENABLED === 'true'

// ---------------------------------------------------------------------------
// TenantContext — enriched request context
// ---------------------------------------------------------------------------

export interface TenantContext {
  tenantId: string           // UUID of the organization
  agentEmail: string         // Authenticated agent email
  via: string                // Auth method used
  isDefaultTenant: boolean   // true = single-agency mode
  enforcementActive: boolean // true = tenant_id RLS is being enforced
}

// ---------------------------------------------------------------------------
// getTenantId — extract tenant UUID from request
// ---------------------------------------------------------------------------

export async function getTenantId(req: NextRequest): Promise<string> {
  // When enforcement is active, try to read from JWT claim
  if (TENANT_ISOLATION_ENABLED) {
    // Future: extract from JWT
    // const jwt = req.headers.get('authorization')?.replace('Bearer ', '')
    // const decoded = decodeJwt(jwt)
    // if (decoded?.tenant_id) return decoded.tenant_id
  }

  // Default: single-agency mode
  return DEFAULT_TENANT_ID
}

// ---------------------------------------------------------------------------
// getTenantContext — full context resolution (auth + tenant)
// ---------------------------------------------------------------------------

export async function getTenantContext(
  req: NextRequest
): Promise<TenantContext | null> {
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return null

  const tenantId = await getTenantId(req)

  return {
    tenantId,
    agentEmail:          auth.email,
    via:                 auth.via,
    isDefaultTenant:     tenantId === DEFAULT_TENANT_ID,
    enforcementActive:   TENANT_ISOLATION_ENABLED,
  }
}

// ---------------------------------------------------------------------------
// stampTenantId — adds tenant_id to a record being inserted/updated
// ---------------------------------------------------------------------------

export async function stampTenantId(
  req: NextRequest,
  record: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const tenantId = await getTenantId(req)
  return { ...record, tenant_id: tenantId }
}

// ---------------------------------------------------------------------------
// tenantFilter — returns Supabase filter additions for tenant-scoped queries
// When enforcement is disabled, returns empty filter (no-op)
// ---------------------------------------------------------------------------

export async function tenantFilter(
  req: NextRequest
): Promise<{ tenant_id?: string }> {
  if (!TENANT_ISOLATION_ENABLED) return {}
  const tenantId = await getTenantId(req)
  return { tenant_id: tenantId }
}

// ---------------------------------------------------------------------------
// assertSameTenant — validates a record belongs to current tenant
// Throws if mismatch and enforcement is active
// ---------------------------------------------------------------------------

export async function assertSameTenant(
  req: NextRequest,
  recordTenantId: string | null | undefined
): Promise<void> {
  if (!TENANT_ISOLATION_ENABLED) return  // enforcement inactive — skip
  if (!recordTenantId) return            // null tenant_id = legacy data — allow

  const tenantId = await getTenantId(req)
  if (recordTenantId !== tenantId) {
    throw new Error(`Cross-tenant access denied: record belongs to a different organization`)
  }
}

// ---------------------------------------------------------------------------
// Tenant status summary — for admin/health endpoints
// ---------------------------------------------------------------------------

export function getTenantStatus(): {
  mode: 'single-agency' | 'multi-tenant'
  enforcement: boolean
  defaultTenantId: string
  jwtConfigured: boolean
} {
  return {
    mode:             TENANT_ISOLATION_ENABLED ? 'multi-tenant' : 'single-agency',
    enforcement:      TENANT_ISOLATION_ENABLED,
    defaultTenantId:  DEFAULT_TENANT_ID,
    jwtConfigured:    TENANT_ISOLATION_ENABLED, // assumption: if enabled, JWT is configured
  }
}
