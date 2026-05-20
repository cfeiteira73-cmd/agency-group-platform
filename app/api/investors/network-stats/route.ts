// Agency Group — Investor Network Stats API
// app/api/investors/network-stats/route.ts
// GET /api/investors/network-stats?investor_id=UUID
// GET /api/investors/network-stats?top=20
// Auth: requirePortalAuth
// TypeScript strict — 0 errors

import { NextRequest, NextResponse }         from 'next/server'
import { requirePortalAuth }                 from '@/lib/requirePortalAuth'
import { computeInvestorNetworkStats }       from '@/lib/investors/networkFeedbackProcessor'
import { supabaseAdmin }                     from '@/lib/supabase'

export const runtime = 'nodejs'

// ─── Tenant helper ─────────────────────────────────────────────────────────────

function resolveTenantId(): string {
  return (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID     ??
    '00000000-0000-0000-0000-000000000001'
  )
}

// ─── GET /api/investors/network-stats ─────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  const tenantId     = resolveTenantId()
  const { searchParams } = new URL(req.url)
  const investor_id  = searchParams.get('investor_id')
  const topParam     = searchParams.get('top')

  try {
    // ── Single investor ────────────────────────────────────────────────────────
    if (investor_id) {
      const stats = await computeInvestorNetworkStats(investor_id, tenantId)

      return NextResponse.json({
        ok:   true,
        data: stats,
      })
    }

    // ── Top N investors by network_score ──────────────────────────────────────
    if (topParam !== null) {
      const limit = Math.min(Math.max(1, parseInt(topParam, 10) || 20), 100)

      const db = supabaseAdmin as any

      // Get all active investor IDs
      const { data: investorData, error: investorErr } = await db
        .from('investors')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .limit(500)

      if (investorErr) {
        console.error('[GET /api/investors/network-stats] failed to load investors:', investorErr.message)
        return NextResponse.json({ error: 'Failed to load investors' }, { status: 500 })
      }

      const rows = (investorData ?? []) as { id: string }[]

      // Compute stats for all investors, then sort and slice
      const BATCH = 20
      const allStats = []

      for (let i = 0; i < rows.length; i += BATCH) {
        const batch = rows.slice(i, i + BATCH)
        const batchStats = await Promise.all(
          batch.map(r => computeInvestorNetworkStats(r.id, tenantId))
        )
        allStats.push(...batchStats)
      }

      const sorted = allStats
        .sort((a, b) => b.network_score - a.network_score)
        .slice(0, limit)

      return NextResponse.json({
        ok:    true,
        data:  sorted,
        count: sorted.length,
        total: rows.length,
      })
    }

    // ── Neither param provided ─────────────────────────────────────────────────
    return NextResponse.json(
      { error: 'Provide investor_id=UUID or top=N query param' },
      { status: 400 },
    )
  } catch (err) {
    console.error('[GET /api/investors/network-stats] unhandled error:', err, { tenant_id: tenantId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
