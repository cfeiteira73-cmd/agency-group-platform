// AGENCY GROUP — SH-ROS | AMI: 22506
// GET /api/revenue-command/summary — Single source of truth for Revenue Command Center
// Aggregates pipeline value, leakage, top actions, funnel health.
// Auth: isPortalAuth (portal cookie or CRON_SECRET)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/observability/logger'
import {
  detectRevenueLeakage,
  predictRevenue,
  type ListingRevenueSummary,
  type AgentPerformanceSummary,
  type RevenueLeakageItem,
} from '@/lib/executive-revenue-v2'
import {
  computeImpactCard,
  rankActionsByImpact,
  type RevenueImpactCard,
  type ActionType,
} from '@/lib/value-attribution-engine'
import { COMMISSION_RATE } from '@/lib/constants/pipeline'

export const runtime = 'nodejs'
export const maxDuration = 15

// ---------------------------------------------------------------------------
// Supabase type escape — simple version without chained query overloading
// ---------------------------------------------------------------------------

type AnyQuery = {
  data: unknown[] | null
  error: unknown
}

type DB = {
  from: (table: string) => Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Row shapes
// ---------------------------------------------------------------------------

interface SubmissionRow {
  submission_id: string
  status: string
  city?: string | null
  listing_price?: number | null
  area_sqm?: number | null
  days_on_market?: number | null
}

interface IntelRow {
  submission_id: string
  demand_score?: number | null
  homepage_placement_score?: number | null
  luxury_score?: number | null
}

interface DealRow {
  id: string
  status?: string | null
  value_eur?: number | null
  commission_eur?: number | null
  agent_id?: string | null
}

interface ContactRow {
  id: string
  score?: number | null
  status?: string | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type FunnelHealth = 'strong' | 'moderate' | 'weak'

function computeFunnelHealth(avg_demand: number, live_count: number): FunnelHealth {
  if (avg_demand >= 65 && live_count >= 3) return 'strong'
  if (avg_demand < 40 || live_count === 0) return 'weak'
  return 'moderate'
}

async function safeQuery(db: DB, table: string, select: string, filters?: Record<string, unknown>): Promise<unknown[]> {
  try {
    let q = (db.from(table) as Record<string, unknown>)
    q = (q['select'] as (s: string) => unknown)(select) as Record<string, unknown>
    if (filters) {
      for (const [key, val] of Object.entries(filters)) {
        q = ((q as Record<string, unknown>)['eq'] as (k: string, v: unknown) => unknown)(key, val) as Record<string, unknown>
      }
    }
    q = ((q as Record<string, unknown>)['limit'] as (n: number) => unknown)(200) as Record<string, unknown>
    const result = await (q as unknown as Promise<AnyQuery>)
    return result.data ?? []
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Build top actions from listings using computeImpactCard
// ---------------------------------------------------------------------------

const ACTION_TYPES_TO_SCORE: ActionType[] = [
  'inquiry_response',
  'visit_booking',
  'price_reduction',
  'photo_upgrade',
  'homepage_boost',
  'follow_up_call',
]

function buildTopActions(listings: ListingRevenueSummary[]): RevenueImpactCard[] {
  if (listings.length === 0) return []

  const cards: RevenueImpactCard[] = []

  for (const listing of listings.slice(0, 10)) { // cap at 10 listings
    const closeProb = Math.max(0.04, Math.min(0.5, listing.demand_score / 200))

    for (const actionType of ACTION_TYPES_TO_SCORE) {
      try {
        const card = computeImpactCard(
          actionType,
          listing.listing_price_eur,
          closeProb,
          COMMISSION_RATE,  // Wave 19: canonical constant — never hardcode commission rate
          listing.property_id,
        )
        cards.push(card)
      } catch {
        // skip
      }
    }
  }

  return rankActionsByImpact(cards).slice(0, 3)
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = supabaseAdmin as unknown as DB
  const now = new Date().toISOString()

  // ── 1. Fetch submissions ─────────────────────────────────────────────────
  const submissionsRaw = await safeQuery(
    db,
    'property_ai_submissions',
    'submission_id, status, city, listing_price, area_sqm, days_on_market',
    { org_id: 'agency-group' },
  )
  const submissions = submissionsRaw as SubmissionRow[]

  // ── 2. Fetch intelligence scores ─────────────────────────────────────────
  const intelRaw = await safeQuery(
    db,
    'property_ai_intelligence',
    'submission_id, demand_score, homepage_placement_score, luxury_score',
  )
  const intelligenceRows = intelRaw as IntelRow[]

  const intelMap = new Map<string, IntelRow>()
  for (const row of intelligenceRows) {
    intelMap.set(row.submission_id, row)
  }

  // ── 3. Fetch deals ───────────────────────────────────────────────────────
  const dealsRaw = await safeQuery(db, 'deals', 'id, status, value_eur, commission_eur, agent_id')
  const deals = dealsRaw as DealRow[]

  // ── 4. Fetch hot contacts ────────────────────────────────────────────────
  // safeQuery applies .limit(200) — sufficient for hot_leads_count heuristic
  const contactsRaw = await safeQuery(db, 'contacts', 'id, score, status')
  const contacts = contactsRaw as ContactRow[]

  // ── 5. Portfolio metrics ─────────────────────────────────────────────────
  const liveSubmissions = submissions.filter(s => s.status === 'live')
  const live_count = liveSubmissions.length

  const pipeline_value_eur = liveSubmissions.reduce((sum, s) => sum + (s.listing_price ?? 0), 0)
  const commission_potential_eur = Math.round(pipeline_value_eur * COMMISSION_RATE)

  const withDemand = liveSubmissions
    .map(s => intelMap.get(s.submission_id)?.demand_score ?? null)
    .filter((v): v is number => v !== null)

  const avg_demand_score =
    withDemand.length > 0
      ? Math.round(withDemand.reduce((a, b) => a + b, 0) / withDemand.length)
      : 0

  const hot_leads_count = contacts.filter(c => (c.score ?? 0) >= 75).length

  // ── 6. Revenue prediction ────────────────────────────────────────────────
  const listingsSummary: ListingRevenueSummary[] = liveSubmissions.map(s => {
    const intel = intelMap.get(s.submission_id)
    return {
      property_id: s.submission_id,
      listing_price_eur: s.listing_price ?? 0,
      avm_base_eur: s.listing_price ?? 0, // use listing price as AVM proxy
      days_on_market: s.days_on_market ?? 0,
      demand_score: intel?.demand_score ?? 50,
      inquiry_count: 0,
    }
  })

  const agentsSummary: AgentPerformanceSummary[] = []
  const { monthly: monthly_forecast_eur } = predictRevenue(listingsSummary, agentsSummary)

  // ── 7. Revenue leakage ───────────────────────────────────────────────────
  const leakageItems: RevenueLeakageItem[] = detectRevenueLeakage(listingsSummary)
  const total_leakage_eur = leakageItems.reduce((sum, l) => sum + l.estimated_leakage_eur, 0)
  const listings_with_leakage = leakageItems.length

  // ── 8. Top 3 revenue actions ─────────────────────────────────────────────
  let top_actions: RevenueImpactCard[] = []
  try {
    top_actions = buildTopActions(listingsSummary)
  } catch (err) {
    logger.warn('[revenue-command/summary] buildTopActions failed', { err })
  }

  // ── 9. Deal metrics ──────────────────────────────────────────────────────
  const active_deals = deals.filter(d => d.status === 'active' || d.status === 'negotiating').length
  const closed_deals_total_commission = deals
    .filter(d => d.status === 'closed')
    .reduce((sum, d) => sum + (d.commission_eur ?? 0), 0)

  // ── 10. Funnel health ────────────────────────────────────────────────────
  const funnel_health: FunnelHealth = computeFunnelHealth(avg_demand_score, live_count)

  logger.info('[revenue-command/summary] computed', {
    live_count, pipeline_value_eur, monthly_forecast_eur, total_leakage_eur, funnel_health,
  })

  return NextResponse.json({
    pipeline_value_eur,
    commission_potential_eur,
    monthly_forecast_eur,
    total_leakage_eur,
    listings_with_leakage,
    live_count,
    avg_demand_score,
    hot_leads_count,
    top_actions,
    funnel_health,
    active_deals,
    closed_deals_total_commission,
    computed_at: now,
  })
}
