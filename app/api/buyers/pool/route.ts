// =============================================================================
// Agency Group — Buyer Pool Executive Report
// FASE 21: GET /api/buyers/pool
// Returns comprehensive buyer pool intelligence for portal and reporting
// Sections: summary, tier_breakdown, top_buyers, audit, zone_coverage, type_coverage
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'

// Safe query wrapper
async function safeQuery<T>(
  fn: () => Promise<{ data: T | null; error: unknown; count?: number | null }>,
  defaultData: T
): Promise<{ data: T; ok: boolean }> {
  try {
    const r = await fn()
    if (r.error) return { data: defaultData, ok: false }
    return { data: r.data ?? defaultData, ok: true }
  } catch {
    return { data: defaultData, ok: false }
  }
}

async function safeCount(fn: () => Promise<{ count: number | null; error: unknown }>): Promise<number> {
  try {
    const r = await fn()
    if (r.error) return 0
    return r.count ?? 0
  } catch {
    return 0
  }
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const limit = Math.min(200, parseInt(searchParams.get('limit') ?? '100'))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = supabaseAdmin as any

    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000).toISOString()

    const ACTIVE_STATUSES = ['active', 'prospect', 'lead', 'qualified', 'negotiating', 'client', 'vip']

    // ── Section A: Pool counts ────────────────────────────────────────────────
    const [totalBuyers, tierACnt, tierBCnt, tierCCnt, activeLast30, withBudget] = await Promise.all([
      safeCount(() => s.from('contacts').select('*', { count: 'exact', head: true }).in('status', ACTIVE_STATUSES)),
      safeCount(() => s.from('contacts').select('*', { count: 'exact', head: true }).in('status', ACTIVE_STATUSES).eq('lead_tier', 'A')),
      safeCount(() => s.from('contacts').select('*', { count: 'exact', head: true }).in('status', ACTIVE_STATUSES).eq('lead_tier', 'B')),
      safeCount(() => s.from('contacts').select('*', { count: 'exact', head: true }).in('status', ACTIVE_STATUSES).eq('lead_tier', 'C')),
      safeCount(() => s.from('contacts').select('*', { count: 'exact', head: true }).in('status', ACTIVE_STATUSES).gte('last_contact_at', thirtyDaysAgo)),
      safeCount(() => s.from('contacts').select('*', { count: 'exact', head: true }).in('status', ACTIVE_STATUSES).not('budget_max', 'is', null)),
    ])

    // ── Section B: Buyer intelligence counts (migration 007 columns) ─────────
    let immediateCount = 0
    let under30Count = 0
    let financedCount = 0
    let avgBuyerScore = 0
    let scoredCount = 0
    let immediateOk = false

    try {
      const [imm, u30, fin, scoresResult] = await Promise.all([
        safeCount(() => s.from('contacts').select('*', { count: 'exact', head: true }).in('status', ACTIVE_STATUSES).eq('liquidity_profile', 'immediate')),
        safeCount(() => s.from('contacts').select('*', { count: 'exact', head: true }).in('status', ACTIVE_STATUSES).eq('liquidity_profile', 'under_30_days')),
        safeCount(() => s.from('contacts').select('*', { count: 'exact', head: true }).in('status', ACTIVE_STATUSES).eq('liquidity_profile', 'financed')),
        safeQuery(
          () => s.from('contacts').select('buyer_score').in('status', ACTIVE_STATUSES).not('buyer_score', 'is', null),
          [] as { buyer_score: number }[]
        ),
      ])
      immediateCount = imm
      under30Count = u30
      financedCount = fin
      const scores = (scoresResult.data as { buyer_score: number }[]).map(r => r.buyer_score)
      scoredCount = scores.length
      avgBuyerScore = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0
      immediateOk = true
    } catch {
      console.warn('[buyers/pool] migration 007 columns not present — partial data')
    }

    // ── Section C: Top buyers ─────────────────────────────────────────────────
    const topBuyersResult = await safeQuery(
      () => s.from('contacts')
        .select([
          'id', 'full_name', 'email', 'phone', 'whatsapp',
          'budget_min', 'budget_max', 'preferred_locations', 'typologies_wanted',
          'status', 'lead_tier', 'lead_score', 'last_contact_at', 'next_followup_at',
          'buyer_type', 'liquidity_profile', 'deals_closed_count', 'avg_close_days',
          'reliability_score', 'buyer_score', 'active_status',
        ].join(', '))
        .in('status', ACTIVE_STATUSES)
        .order('lead_score', { ascending: false })
        .limit(limit),
      [] as Record<string, unknown>[]
    )

    // Fallback if migration 007 columns missing
    let topBuyers: Record<string, unknown>[] = topBuyersResult.data as Record<string, unknown>[]
    if (!topBuyersResult.ok) {
      const fallback = await safeQuery(
        () => s.from('contacts')
          .select('id, full_name, email, phone, budget_min, budget_max, preferred_locations, typologies_wanted, status, lead_tier, lead_score, last_contact_at')
          .in('status', ACTIVE_STATUSES)
          .order('lead_score', { ascending: false })
          .limit(limit),
        [] as Record<string, unknown>[]
      )
      topBuyers = fallback.data as Record<string, unknown>[]
    }

    // ── Section D: Audit — incomplete buyer profiles ──────────────────────────
    const auditResult = await safeQuery(
      () => s.from('contacts')
        .select('id, full_name, status, lead_tier, budget_min, budget_max, preferred_locations, typologies_wanted, last_contact_at')
        .in('status', ACTIVE_STATUSES)
        .or('budget_max.is.null,preferred_locations.is.null')
        .order('lead_score', { ascending: false })
        .limit(50),
      [] as Record<string, unknown>[]
    )

    const incompleteProfiles = (auditResult.data as Record<string, unknown>[]).map(c => ({
      id: c.id,
      full_name: c.full_name,
      status: c.status,
      lead_tier: c.lead_tier,
      missing: [
        ...(c.budget_max == null ? ['budget'] : []),
        ...(Array.isArray(c.preferred_locations) && c.preferred_locations.length === 0 || !c.preferred_locations ? ['zones'] : []),
        ...(Array.isArray(c.typologies_wanted) && c.typologies_wanted.length === 0 || !c.typologies_wanted ? ['types'] : []),
      ],
    }))

    // ── Section E: Zone coverage (top zones requested) ────────────────────────
    const zoneCoverage: Record<string, number> = {}
    for (const buyer of topBuyers) {
      const zones = buyer.preferred_locations as string[] | null
      if (Array.isArray(zones)) {
        for (const z of zones) {
          const zn = z.trim()
          zoneCoverage[zn] = (zoneCoverage[zn] || 0) + 1
        }
      }
    }
    const topZones = Object.entries(zoneCoverage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([zone, count]) => ({ zone, count }))

    // ── Section F: Asset type coverage ───────────────────────────────────────
    const typeCoverage: Record<string, number> = {}
    for (const buyer of topBuyers) {
      const types = buyer.typologies_wanted as string[] | null
      if (Array.isArray(types)) {
        for (const t of types) {
          const tn = t.trim().toLowerCase()
          typeCoverage[tn] = (typeCoverage[tn] || 0) + 1
        }
      }
    }
    const topTypes = Object.entries(typeCoverage)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([type, count]) => ({ type, count }))

    // ── Section G: Budget distribution ───────────────────────────────────────
    const budgetBands = { hnwi_3m_plus: 0, premium_1m_3m: 0, mid_500k_1m: 0, entry_under_500k: 0, undefined: 0 }
    for (const buyer of topBuyers) {
      const bMax = buyer.budget_max as number | null
      if (!bMax) { budgetBands.undefined++; continue }
      if (bMax >= 3_000_000) budgetBands.hnwi_3m_plus++
      else if (bMax >= 1_000_000) budgetBands.premium_1m_3m++
      else if (bMax >= 500_000) budgetBands.mid_500k_1m++
      else budgetBands.entry_under_500k++
    }

    // ── Section H: Recent activity stats ─────────────────────────────────────
    const recentActive = topBuyers.filter(b => {
      const lc = b.last_contact_at as string | null
      return lc && new Date(lc) > new Date(thirtyDaysAgo)
    }).length

    const dormant = topBuyers.filter(b => {
      const lc = b.last_contact_at as string | null
      return !lc || new Date(lc) < new Date(ninetyDaysAgo)
    }).length

    return NextResponse.json({
      summary: {
        total_buyers:       totalBuyers,
        tier_a:             tierACnt,
        tier_b:             tierBCnt,
        tier_c:             tierCCnt,
        with_budget:        withBudget,
        active_last_30d:    activeLast30,
        // Migration 007 fields
        immediate_liquidity: immediateCount,
        under_30_days:       under30Count,
        financed:            financedCount,
        avg_buyer_score:     avgBuyerScore,
        scored_buyers:       scoredCount,
        // Activity
        recent_active_30d:  recentActive,
        dormant_90d:        dormant,
        incomplete_profiles: incompleteProfiles.length,
      },
      tier_breakdown: [
        { tier: 'A', count: tierACnt, pct: totalBuyers > 0 ? Math.round(tierACnt / totalBuyers * 100) : 0 },
        { tier: 'B', count: tierBCnt, pct: totalBuyers > 0 ? Math.round(tierBCnt / totalBuyers * 100) : 0 },
        { tier: 'C', count: tierCCnt, pct: totalBuyers > 0 ? Math.round(tierCCnt / totalBuyers * 100) : 0 },
      ],
      budget_distribution: budgetBands,
      top_buyers:          topBuyers,
      incomplete_profiles: incompleteProfiles,
      zone_coverage:       topZones,
      type_coverage:       topTypes,
      partial:             !immediateOk,
      generated_at:        now.toISOString(),
    })
  } catch (err) {
    console.error('[buyers/pool GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
