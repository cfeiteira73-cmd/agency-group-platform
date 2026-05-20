// =============================================================================
// Agency Group — GET /api/system/org-check
// Diagnostic endpoint: validates SYSTEM_ORG_ID runtime state
//
// Returns:
//   - org validation (UUID format + tenants table lookup)
//   - revenue linkage test (deals count for tenant)
//   - RLS visibility test (can service role read tenant row)
//   - orphan deal detection (deals with null tenant_id)
//
// Auth: requirePortalAuth (NextAuth session | magic-link | CRON_SECRET header)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { validateSystemOrgId }       from '@/lib/bootstrap/systemOrgValidator'
import { requirePortalAuth }         from '@/lib/requirePortalAuth'
import { supabaseAdmin }             from '@/lib/supabase'

// ─── GET /api/system/org-check ────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  // Auth guard — portal session OR service token (CRON_SECRET)
  const auth = await requirePortalAuth(req)
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 1. Core validation ───────────────────────────────────────────────────────
  const validation = await validateSystemOrgId()

  // ── 2. Revenue linkage test ──────────────────────────────────────────────────
  let deals_for_tenant:        number | null = null
  let deals_with_revenue:      number | null = null  // deals where deal_value > 0
  let rls_visible:             boolean | null = null
  let orphan_deals_no_tenant:  number | null = null

  if (validation.ok && validation.org_id) {
    const [dealsRes, dealsWithValRes, tenantReadRes, orphanRes] = await Promise.all([
      // Count all deals for this tenant
      (supabaseAdmin as unknown as { from: (t: string) => unknown } as { from: (t: string) => {
        select: (c: string, o: { count: string; head: boolean }) => {
          eq: (col: string, val: string) => Promise<{ count: number | null; error: unknown }>
        }
      }}).from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', validation.org_id),

      // Count deals where deal_value > 0 (revenue is actually flowing)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any)
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', validation.org_id)
        .gt('deal_value', 0),

      // RLS visibility test: service role read on this org
      // NOTE: table is 'organizations', not 'tenants'
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any)
        .from('organizations')
        .select('id, slug, name, plan')
        .eq('id', validation.org_id)
        .single(),

      // Orphan detection: deals with null tenant_id (data hygiene check)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabaseAdmin as any)
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .is('tenant_id', null),
    ])

    deals_for_tenant       = dealsRes.count ?? 0
    deals_with_revenue     = dealsWithValRes.count ?? 0
    rls_visible            = !tenantReadRes.error && !!tenantReadRes.data
    orphan_deals_no_tenant = orphanRes.count ?? 0
  }

  const status = validation.ok ? 200 : 503

  return NextResponse.json(
    {
      validation,
      revenue_linkage: {
        deals_for_tenant,
        deals_with_revenue,
        revenue_live: deals_with_revenue !== null && deals_with_revenue > 0,
      },
      rls_check: {
        service_role_can_read_tenant: rls_visible,
      },
      orphan_check: {
        deals_with_null_tenant_id: orphan_deals_no_tenant,
        orphans_detected:          orphan_deals_no_tenant !== null && orphan_deals_no_tenant > 0,
      },
      health: validation.ok ? 'PASS' : 'FAIL',
      authenticated_as: auth.email ?? 'service',
      timestamp: new Date().toISOString(),
    },
    { status },
  )
}
