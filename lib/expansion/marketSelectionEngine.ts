// Agency Group — Market Selection Engine
// lib/expansion/marketSelectionEngine.ts
// Decides WHERE to expand based on Market Score formula:
// Market Score = Liquidity Weight + Capital Density + ROI Potential + Competition Gap
// OUTPUT: priority countries, priority cities, target investor segments per market
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import {
  analyzeMarket,
  type MarketIntelligence,
} from './marketIntelligenceEngine'

// ─── Constants ────────────────────────────────────────────────────────────────

const CANONICAL_TENANT = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarketScore {
  market_id: string
  tenant_id: string
  country: string
  city: string
  liquidity_weight: number
  capital_density: number
  roi_potential: number
  competition_gap: number
  total_score: number
  tier: 'PRIORITY_1' | 'PRIORITY_2' | 'PRIORITY_3' | 'MONITOR' | 'IGNORE'
  recommended_segments: string[]
  recommended_action: string
  scored_at: string
}

export interface MarketSelectionReport {
  tenant_id: string
  generated_at: string
  markets_scored: number
  priority_1_markets: MarketScore[]
  priority_2_markets: MarketScore[]
  recommended_expansion_order: string[]
  total_addressable_capital_eur_cents: number
  expansion_budget_suggestion_eur_cents: number
}

// ─── scoreMarket (pure function) ─────────────────────────────────────────────

export function scoreMarket(intelligence: MarketIntelligence): MarketScore {
  // liquidity_weight: liquidity_score / 100 × 30 (max 30 pts)
  const liquidity_weight =
    Math.round((intelligence.liquidity_score / 100) * 30 * 100) / 100

  // capital_density: min(30, capital_inflow / 100_000_00 × 10) (€100K = 10pts, max 30)
  const capital_density = Math.min(
    30,
    Math.round((intelligence.capital_inflow_30d_eur_cents / 10_000_000) * 10 * 100) / 100,
  )

  // roi_potential: min(20, avg_roi_pct × 2) (max 20 pts)
  const roi_potential = Math.min(
    20,
    Math.round(intelligence.avg_roi_pct * 2 * 100) / 100,
  )

  // competition_gap: max(0, 20 - competition_intensity × 20) (low competition = high gap = good, max 20)
  const competition_gap = Math.max(
    0,
    Math.round((20 - intelligence.competition_intensity * 20) * 100) / 100,
  )

  const total_score =
    Math.round(
      (liquidity_weight + capital_density + roi_potential + competition_gap) * 100,
    ) / 100

  // Tier
  let tier: MarketScore['tier']
  if (total_score >= 80) tier = 'PRIORITY_1'
  else if (total_score >= 60) tier = 'PRIORITY_2'
  else if (total_score >= 40) tier = 'PRIORITY_3'
  else if (total_score >= 20) tier = 'MONITOR'
  else tier = 'IGNORE'

  // Recommended segments
  const recommended_segments: string[] = []
  if (roi_potential > 15) {
    recommended_segments.push('INSTITUTIONAL_BUYER', 'HIGH_ROI_CONTRIBUTOR')
  }
  if (competition_gap > 15) {
    recommended_segments.push('OPPORTUNISTIC_BIDDER')
  }

  // Recommended action
  const actionMap: Record<MarketScore['tier'], string> = {
    PRIORITY_1: 'Launch full campaign + capital incentives',
    PRIORITY_2: 'Soft launch + brand awareness',
    PRIORITY_3: 'Monitor + targeted outreach',
    MONITOR: 'Track quarterly',
    IGNORE: 'No action',
  }
  const recommended_action = actionMap[tier]

  const market_id = `${intelligence.country.toLowerCase()}_${intelligence.city
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')}`

  return {
    market_id,
    tenant_id: intelligence.tenant_id,
    country: intelligence.country,
    city: intelligence.city,
    liquidity_weight,
    capital_density,
    roi_potential,
    competition_gap,
    total_score,
    tier,
    recommended_segments,
    recommended_action,
    scored_at: new Date().toISOString(),
  }
}

// ─── runMarketSelection ───────────────────────────────────────────────────────

export async function runMarketSelection(
  tenantId: string,
): Promise<MarketSelectionReport> {
  const tid = tenantId || CANONICAL_TENANT
  const generated_at = new Date().toISOString()

  // Read latest snapshot per market from DB
  const snapshotsRes = await (supabaseAdmin as any)
    .from('market_intelligence_snapshots')
    .select('*')
    .eq('tenant_id', tid)
    .order('analyzed_at', { ascending: false })

  const rawSnapshots: MarketIntelligence[] =
    (snapshotsRes.data as MarketIntelligence[] | null) ?? []

  // Deduplicate: keep latest per market_id
  const latestByMarket = new Map<string, MarketIntelligence>()
  for (const snap of rawSnapshots) {
    if (!latestByMarket.has(snap.market_id)) {
      latestByMarket.set(snap.market_id, snap)
    }
  }

  // Known markets for fallback
  const KNOWN_MARKETS: Array<{ country: string; city: string }> = [
    { country: 'PT', city: 'Lisboa' },
    { country: 'PT', city: 'Porto' },
    { country: 'PT', city: 'Cascais' },
    { country: 'PT', city: 'Algarve' },
    { country: 'PT', city: 'Madeira' },
    { country: 'PT', city: 'Açores' },
    { country: 'ES', city: 'Madrid' },
    { country: 'ES', city: 'Barcelona' },
    { country: 'ES', city: 'Marbella' },
    { country: 'ES', city: 'Valencia' },
    { country: 'FR', city: 'Paris' },
    { country: 'FR', city: 'Côte d\'Azur' },
  ]

  // For markets without snapshots, call analyzeMarket
  const intelligenceList: MarketIntelligence[] = []
  for (const m of KNOWN_MARKETS) {
    const mid = `${m.country.toLowerCase()}_${m.city
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')}`
    if (latestByMarket.has(mid)) {
      intelligenceList.push(latestByMarket.get(mid)!)
    } else {
      const fresh = await analyzeMarket(m.country, m.city, tid)
      intelligenceList.push(fresh)
    }
  }

  // Score all markets
  const scored = intelligenceList.map(scoreMarket)

  // Sort by total_score DESC
  scored.sort((a, b) => b.total_score - a.total_score)

  const priority_1_markets = scored.filter(s => s.tier === 'PRIORITY_1')
  const priority_2_markets = scored.filter(s => s.tier === 'PRIORITY_2')
  const recommended_expansion_order = scored.map(s => `${s.country}:${s.city}`)

  const total_addressable_capital_eur_cents = intelligenceList.reduce(
    (sum, m) => sum + m.capital_inflow_30d_eur_cents,
    0,
  )
  const expansion_budget_suggestion_eur_cents = Math.round(
    total_addressable_capital_eur_cents * 0.05,
  )

  const report: MarketSelectionReport = {
    tenant_id: tid,
    generated_at,
    markets_scored: scored.length,
    priority_1_markets,
    priority_2_markets,
    recommended_expansion_order,
    total_addressable_capital_eur_cents,
    expansion_budget_suggestion_eur_cents,
  }

  // Persist
  void (supabaseAdmin as any)
    .from('market_selection_reports')
    .insert({
      id: randomUUID(),
      tenant_id: tid,
      generated_at,
      markets_scored: scored.length,
      priority_1_markets: JSON.stringify(priority_1_markets),
      priority_2_markets: JSON.stringify(priority_2_markets),
      recommended_expansion_order: JSON.stringify(recommended_expansion_order),
      total_addressable_capital_eur_cents,
      expansion_budget_suggestion_eur_cents,
    })
    .catch((e: unknown) =>
      log.warn('[marketSelection] report persist error', { error: String(e) }),
    )

  log.info('[marketSelection] runMarketSelection complete', {
    markets_scored: scored.length,
    priority_1_count: priority_1_markets.length,
    priority_2_count: priority_2_markets.length,
    expansion_budget_suggestion_eur_cents,
  })

  return report
}

// ─── getExpansionPriorities ───────────────────────────────────────────────────

export async function getExpansionPriorities(
  tenantId: string,
): Promise<MarketScore[]> {
  const tid = tenantId || CANONICAL_TENANT

  const snapshotsRes = await (supabaseAdmin as any)
    .from('market_intelligence_snapshots')
    .select('*')
    .eq('tenant_id', tid)
    .order('analyzed_at', { ascending: false })

  const rawSnapshots: MarketIntelligence[] =
    (snapshotsRes.data as MarketIntelligence[] | null) ?? []

  // Deduplicate
  const latestByMarket = new Map<string, MarketIntelligence>()
  for (const snap of rawSnapshots) {
    if (!latestByMarket.has(snap.market_id)) {
      latestByMarket.set(snap.market_id, snap)
    }
  }

  const scored = Array.from(latestByMarket.values()).map(scoreMarket)
  const priorities = scored
    .filter(s => s.tier === 'PRIORITY_1' || s.tier === 'PRIORITY_2')
    .sort((a, b) => b.total_score - a.total_score)

  return priorities
}
