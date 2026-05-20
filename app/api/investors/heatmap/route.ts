// =============================================================================
// Agency Group — Liquidity Heatmap API
// GET /api/investors/heatmap?country=PT
//
// Returns zone-level demand/supply/heat indices.
// Reads today's snapshot from DB; computes + persists on cache miss.
//
// Auth: requirePortalAuth
// Tenant: DEFAULT_TENANT_ID → SYSTEM_ORG_ID → CANONICAL_TENANT_UUID
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import {
  getHeatmap,
  computeHeatmap,
  persistHeatmap,
} from '@/lib/investors/heatmapEngine'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// Tenant helper
// ---------------------------------------------------------------------------

function resolveTenantId(): string {
  return (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    '00000000-0000-0000-0000-000000000001'
  )
}

// ---------------------------------------------------------------------------
// GET /api/investors/heatmap
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  const tenantId = resolveTenantId()

  try {
    const { searchParams } = new URL(req.url)
    const country = searchParams.get('country') ?? 'PT'

    // ── 1. Try cached snapshot (today) ──────────────────────────────────────
    let heatmap = await getHeatmap(tenantId, country)

    // ── 2. On cache miss: compute + persist ─────────────────────────────────
    if (heatmap.length === 0) {
      heatmap = await computeHeatmap(tenantId, country)

      if (heatmap.length > 0) {
        // Fire-and-forget persistence
        void persistHeatmap(tenantId, heatmap)
      }
    }

    // ── 3. Sort by heat_index DESC ──────────────────────────────────────────
    heatmap.sort((a, b) => b.heat_index - a.heat_index)

    return NextResponse.json({
      heatmap,
      computed_at: new Date().toISOString(),
      country,
      count: heatmap.length,
    })
  } catch (err) {
    console.error('[GET /api/investors/heatmap]', err, { tenant_id: tenantId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
