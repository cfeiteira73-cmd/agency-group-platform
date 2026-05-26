// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Opportunity Feed Engine (Wave 42)
// lib/opportunity/opportunityFeedEngine.ts
//
// Generates the ranked opportunity feed — like a Bloomberg terminal for
// real estate capital. Builds human-readable headlines + tags in Portuguese.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'
import { getActiveOpportunities } from './opportunityDetectionEngine'
import { rankOpportunities } from './opportunityScorer'
import type { Opportunity, OpportunityType } from './opportunityDetectionEngine'

// ─── Re-exports ───────────────────────────────────────────────────────────────

export type { OpportunityType } from './opportunityDetectionEngine'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OpportunityFeedItem {
  opportunity_id: string
  asset_id: string
  rank: number
  opportunity_score: number
  opportunity_type: OpportunityType
  headline: string
  summary: string
  market: string
  city: string
  property_type: string
  size_sqm: number | null
  asking_price_eur_cents: number
  potential_gain_eur_cents: number
  roi_pct: number
  urgency_level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  time_to_expire_hours: number | null
  tags: string[]
  generated_at: string
}

export interface OpportunityFeed {
  feed_id: string
  tenant_id: string
  total_opportunities: number
  items: OpportunityFeedItem[]
  market_summary: Record<string, number>
  avg_opportunity_score: number
  top_opportunity_type: OpportunityType
  generated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toUrgencyLevel(urgency_score: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (urgency_score >= 80) return 'CRITICAL'
  if (urgency_score >= 55) return 'HIGH'
  if (urgency_score >= 30) return 'MEDIUM'
  return 'LOW'
}

function toNum(v: unknown, fallback = 0): number {
  const n = Number(v)
  return isFinite(n) ? n : fallback
}

function formatEur(cents: number): string {
  const eur = Math.round(cents / 100)
  if (eur >= 1_000_000) return `€${(eur / 1_000_000).toFixed(1)}M`
  if (eur >= 1_000) return `€${Math.round(eur / 1_000)}K`
  return `€${eur}`
}

function timeToExpireHours(expires_at: string | null | undefined): number | null {
  if (!expires_at) return null
  const diff = new Date(expires_at).getTime() - Date.now()
  if (diff <= 0) return 0
  return Math.round(diff / (1000 * 60 * 60))
}

// ─── generateHeadline ─────────────────────────────────────────────────────────

/**
 * Pure function — generates a Portuguese headline for the opportunity feed item.
 * Examples:
 *   "T3 Lisboa Belém | -18% vs mercado | Score 87/100"
 *   "Leilão judicial Porto | Ganho est. €42K | Urgente"
 *   "Apartamento T2 Cascais | Alta liquidez | ROI 12%"
 */
export function generateHeadline(opportunity: Record<string, unknown>): string {
  const city            = String(opportunity.city ?? '')
  const property_type   = String(opportunity.property_type ?? '')
  const type            = String(opportunity.opportunity_type ?? '')
  const score           = toNum(opportunity.opportunity_score, 0)
  const roi_pct         = toNum(opportunity.roi_pct, 0)
  const potentialGain   = toNum(opportunity.potential_gain_eur_cents, 0)
  const asking          = toNum(opportunity.asking_price_eur_cents, 0)
  const fair            = toNum(opportunity.fair_value_eur_cents, 0)
  const urgency_score   = toNum(opportunity.urgency_score, 0)
  const liquidity_score = toNum(opportunity.liquidity_score, 0)

  const undervaluation_pct =
    fair > 0 ? Math.round(((fair - asking) / fair) * 100) : 0

  const propLabel =
    property_type.length > 0 ? property_type : 'Imóvel'
  const cityLabel =
    city.length > 0 ? city : ''

  const locationPart =
    cityLabel.length > 0 ? `${propLabel} ${cityLabel}` : propLabel

  // Auction
  if (type === 'AUCTION_ARBITRAGE') {
    const gainLabel = potentialGain > 0 ? `Ganho est. ${formatEur(potentialGain)}` : 'Oportunidade'
    return `Leilão ${locationPart} | ${gainLabel} | Urgente`
  }

  // Distressed
  if (type === 'DISTRESSED_ASSET') {
    const discountLabel =
      undervaluation_pct > 0 ? `-${undervaluation_pct}% vs mercado` : 'Activo em stress'
    return `Activo distressed ${locationPart} | ${discountLabel} | Score ${Math.round(score)}/100`
  }

  // Cross-market arbitrage
  if (type === 'CROSS_MARKET_ARBITRAGE') {
    return `Arbitragem cross-market ${locationPart} | ROI ${roi_pct.toFixed(1)}% | Score ${Math.round(score)}/100`
  }

  // Institutional mispricing
  if (type === 'INSTITUTIONAL_MISPRICING') {
    return `Subavaliação institucional ${locationPart} | -${undervaluation_pct}% | ${formatEur(asking)}`
  }

  // High liquidity flip
  if (type === 'HIGH_LIQUIDITY_FLIP') {
    const liqLabel = liquidity_score >= 70 ? 'Alta liquidez' : 'Boa liquidez'
    return `${locationPart} | ${liqLabel} | ROI ${roi_pct.toFixed(1)}%`
  }

  // UNDERVALUED_ASSET (default)
  if (undervaluation_pct > 0) {
    return `${locationPart} | -${undervaluation_pct}% vs mercado | Score ${Math.round(score)}/100`
  }

  if (urgency_score >= 70) {
    return `${locationPart} | Alta urgência | ${formatEur(asking)}`
  }

  return `${locationPart} | Oportunidade identificada | Score ${Math.round(score)}/100`
}

// ─── generateTags ─────────────────────────────────────────────────────────────

/**
 * Pure function — generates tags for an opportunity.
 */
export function generateTags(opportunity: Record<string, unknown>): string[] {
  const tags: string[] = []
  const type          = String(opportunity.opportunity_type ?? '')
  const roi_pct       = toNum(opportunity.roi_pct, 0)
  const days_on_market = toNum(opportunity.days_on_market, 0)
  const asking        = toNum(opportunity.asking_price_eur_cents, 0)
  const fair          = toNum(opportunity.fair_value_eur_cents, 0)
  const undervaluation_pct =
    fair > 0 ? ((fair - asking) / fair) * 100 : 0
  const liquidity_score = toNum(opportunity.liquidity_score, 0)
  const size_sqm      = toNum(opportunity.size_sqm, 0)

  if (type === 'DISTRESSED_ASSET' || type === 'CROSS_MARKET_ARBITRAGE') {
    tags.push('distressed')
  }
  if (type === 'AUCTION_ARBITRAGE') {
    tags.push('auction')
    tags.push('judicial')
  }
  if (roi_pct > 10) {
    tags.push('high-roi')
  }
  // Flip candidate: high liquidity, small unit, undervalued
  if (type === 'HIGH_LIQUIDITY_FLIP' || (liquidity_score > 65 && undervaluation_pct > 8 && size_sqm < 150)) {
    tags.push('flip-candidate')
  }
  if (type === 'INSTITUTIONAL_MISPRICING') {
    tags.push('institutional')
  }
  if (type === 'CROSS_MARKET_ARBITRAGE') {
    tags.push('cross-market')
  }
  if (undervaluation_pct > 5) {
    tags.push('undervalued')
  }
  // Price reduced: on market > 60 days, not distressed
  if (days_on_market > 60 && type !== 'DISTRESSED_ASSET') {
    tags.push('price-reduced')
  }

  return [...new Set(tags)]
}

// ─── generateFeed ─────────────────────────────────────────────────────────────

export async function generateFeed(
  tenantId: string,
  options?: {
    market?: string
    city?: string
    limit?: number
    investor_profile?: Record<string, unknown>
  },
): Promise<OpportunityFeed> {
  const now = new Date().toISOString()
  const feed_id = randomUUID()

  const active = await getActiveOpportunities(tenantId, {
    market: options?.market,
    city:   options?.city,
    limit:  options?.limit ?? 200,
  })

  // Rank
  const ranked = rankOpportunities(active, options?.investor_profile)

  // Build feed items
  const items: OpportunityFeedItem[] = ranked.map((opp, idx) => {
    const oppRecord = opp as unknown as Record<string, unknown>
    return {
      opportunity_id:         opp.opportunity_id,
      asset_id:               opp.asset_id,
      rank:                   idx + 1,
      opportunity_score:      opp.opportunity_score,
      opportunity_type:       opp.opportunity_type,
      headline:               generateHeadline(oppRecord),
      summary:                buildSummary(oppRecord),
      market:                 opp.market,
      city:                   opp.city,
      property_type:          opp.property_type,
      size_sqm:               toNum(oppRecord.size_sqm, 0) > 0
                                ? toNum(oppRecord.size_sqm)
                                : null,
      asking_price_eur_cents: opp.asking_price_eur_cents,
      potential_gain_eur_cents: opp.potential_gain_eur_cents,
      roi_pct:                opp.roi_pct,
      urgency_level:          toUrgencyLevel(opp.urgency_score),
      time_to_expire_hours:   timeToExpireHours(opp.expires_at),
      tags:                   generateTags(oppRecord),
      generated_at:           now,
    }
  })

  // Market summary
  const market_summary: Record<string, number> = {}
  for (const item of items) {
    const key = `${item.market}:${item.city}`
    market_summary[key] = (market_summary[key] ?? 0) + 1
  }

  // Stats
  const avg_opportunity_score =
    items.length > 0
      ? Math.round(
          (items.reduce((s, i) => s + i.opportunity_score, 0) / items.length) * 100,
        ) / 100
      : 0

  // Top type by count
  const typeCounts: Partial<Record<OpportunityType, number>> = {}
  for (const item of items) {
    typeCounts[item.opportunity_type] = (typeCounts[item.opportunity_type] ?? 0) + 1
  }
  const top_opportunity_type = (Object.entries(typeCounts).sort(
    ([, a], [, b]) => b - a,
  )[0]?.[0] ?? 'UNDERVALUED_ASSET') as OpportunityType

  const feed: OpportunityFeed = {
    feed_id,
    tenant_id: tenantId,
    total_opportunities: items.length,
    items,
    market_summary,
    avg_opportunity_score,
    top_opportunity_type,
    generated_at: now,
  }

  // Persist fire-and-forget
  void (supabaseAdmin as any)
    .from('opportunity_feeds')
    .insert({
      feed_id,
      tenant_id:             tenantId,
      total_opportunities:   items.length,
      items:                 JSON.stringify(items),
      market_summary:        JSON.stringify(market_summary),
      avg_opportunity_score,
      top_opportunity_type,
      generated_at:          now,
    })
    .catch((e: unknown) => console.warn('[opportunityFeedEngine] feed persist', e))

  log.info('[opportunityFeedEngine] Feed generated', {
    feed_id,
    tenant_id: tenantId,
    total_opportunities: items.length,
    avg_opportunity_score,
  })

  return feed
}

// ─── buildSummary (private) ───────────────────────────────────────────────────

function buildSummary(opp: Record<string, unknown>): string {
  const type    = String(opp.opportunity_type ?? '')
  const asking  = toNum(opp.asking_price_eur_cents, 0)
  const gain    = toNum(opp.potential_gain_eur_cents, 0)
  const roi_pct = toNum(opp.roi_pct, 0)
  const city    = String(opp.city ?? '')
  const market  = String(opp.market ?? '')

  const loc = city || market

  if (type === 'AUCTION_ARBITRAGE') {
    return `Leilão em ${loc}. Ganho potencial ${formatEur(gain)} após comissão 5%. Prazo limitado — actuar com urgência.`
  }
  if (type === 'DISTRESSED_ASSET') {
    return `Activo em stress financeiro em ${loc}. Preço pedido ${formatEur(asking)}. ROI estimado ${roi_pct.toFixed(1)}%.`
  }
  if (type === 'INSTITUTIONAL_MISPRICING') {
    return `Grande activo sistematicamente subavaliado em ${loc}. Ganho est. ${formatEur(gain)} após comissão.`
  }
  if (type === 'CROSS_MARKET_ARBITRAGE') {
    return `Gap de preços entre mercados detectado em ${loc}. Oportunidade de arbitragem PT/ES/FR.`
  }
  if (type === 'HIGH_LIQUIDITY_FLIP') {
    return `Unidade compacta em mercado líquido em ${loc}. Flip rápido potencial — ROI ${roi_pct.toFixed(1)}%.`
  }
  return `Activo abaixo do valor de mercado em ${loc}. Preço pedido ${formatEur(asking)}, ganho potencial ${formatEur(gain)}.`
}

// ─── getLatestFeed ────────────────────────────────────────────────────────────

export async function getLatestFeed(
  tenantId: string,
  market?: string,
): Promise<OpportunityFeed | null> {
  try {
    let query = (supabaseAdmin as any)
      .from('opportunity_feeds')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('generated_at', { ascending: false })
      .limit(1)

    // market filter on market_summary is JSON — use ilike on jsonb text
    // For strict filtering, consumers should re-run generateFeed with market param
    if (market) {
      query = query.ilike('market_summary::text', `%${market}%`)
    }

    const { data, error } = await query.single()

    if (error || !data) return null

    const row = data as Record<string, unknown>

    return {
      feed_id:              String(row.feed_id ?? ''),
      tenant_id:            String(row.tenant_id ?? ''),
      total_opportunities:  Number(row.total_opportunities ?? 0),
      items:                parseJsonField(row.items, []),
      market_summary:       parseJsonField(row.market_summary, {}),
      avg_opportunity_score: Number(row.avg_opportunity_score ?? 0),
      top_opportunity_type: (row.top_opportunity_type as OpportunityType) ?? 'UNDERVALUED_ASSET',
      generated_at:         String(row.generated_at ?? ''),
    }
  } catch (err) {
    log.error('[opportunityFeedEngine] getLatestFeed error', err)
    return null
  }
}

// ─── getFeedHistory ───────────────────────────────────────────────────────────

export async function getFeedHistory(
  tenantId: string,
  limit = 20,
): Promise<Array<{ feed_id: string; generated_at: string; total_opportunities: number; avg_score: number }>> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('opportunity_feeds')
      .select('feed_id, generated_at, total_opportunities, avg_opportunity_score')
      .eq('tenant_id', tenantId)
      .order('generated_at', { ascending: false })
      .limit(limit)

    if (error) {
      log.error('[opportunityFeedEngine] getFeedHistory error', error)
      return []
    }

    return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
      feed_id:             String(row.feed_id ?? ''),
      generated_at:        String(row.generated_at ?? ''),
      total_opportunities: Number(row.total_opportunities ?? 0),
      avg_score:           Number(row.avg_opportunity_score ?? 0),
    }))
  } catch (err) {
    log.error('[opportunityFeedEngine] getFeedHistory error', err)
    return []
  }
}

// ─── parseJsonField ───────────────────────────────────────────────────────────

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'object') return value as T
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return fallback
}
