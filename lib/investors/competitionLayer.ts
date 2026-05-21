// =============================================================================
// Agency Group — Multi-Investor Competition Layer
// lib/investors/competitionLayer.ts
//
// Ranks multiple investors competing for the same deal.
// competition_score = match_score*0.35 + capital_fit*0.20 +
//                     conversion_prob*100*0.20 + urgency*0.15 +
//                     (1/(response_time+1))*100*0.10
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CompetingInvestor {
  investor_id:              string
  match_score:              number
  capital_available_eur:    number
  conversion_probability:   number   // from ML calibration (0–1)
  response_time_hours_avg:  number   // historical average
  urgency_score:            number   // 0–100
  tier:                     'institutional' | 'premium' | 'standard'
}

export interface CompetitionResult {
  deal_id:      string
  property_id:  string
  tenant_id:    string

  ranked_investors: Array<{
    rank:                 number
    investor_id:          string
    competition_score:    number       // 0–100
    win_probability:      number       // probability this investor converts
    suggested_priority:   'immediate' | 'urgent' | 'standard' | 'watchlist'
    capital_fit:          'perfect' | 'over' | 'under'
    notes:                string[]
  }>

  optimal_distribution_strategy: 'exclusive' | 'limited' | 'broad'
  // exclusive: send to top 1-3 only (premium assets, fraud_risk_score < 20)
  // limited:   send to top 5-10 (standard, price >= 500K)
  // broad:     open distribution (fast liquidity)

  estimated_close_probability: number   // if top investor is contacted
  estimated_days_to_close:     number
  computed_at:                 string
}

// ─── DB row shapes ────────────────────────────────────────────────────────────

interface InvestorRow {
  id:              string
  capital_max_eur: number | null
  investor_type:   string | null
}

interface PropertyRow {
  preco:             number
  fraud_risk_score?: number | null
  listed_at?:        string | null
}

interface EngagementCountRow {
  investor_id: string
  event_type:  string
}

// ─── computeCapitalFitScore ───────────────────────────────────────────────────

/**
 * Compute capital fit score and label.
 * perfect: 0.8 <= capital/price <= 2.0
 * over:    capital/price > 2.0
 * under:   capital/price < 0.8
 */
export function computeCapitalFitScore(
  propertyPriceEur:  number,
  investorCapitalEur: number,
): { score: number; fit: 'perfect' | 'over' | 'under' } {
  if (propertyPriceEur <= 0) return { score: 0, fit: 'under' }

  const ratio = investorCapitalEur / propertyPriceEur

  if (ratio >= 0.8 && ratio <= 2.0) {
    // Perfect — score peaks at ratio 1.0
    const distanceFromIdeal = Math.abs(ratio - 1.0)
    const score = Math.max(0, 100 - distanceFromIdeal * 40)
    return { score: Math.round(score), fit: 'perfect' }
  }

  if (ratio > 2.0) {
    // Over-capitalised — diminishing score
    const score = Math.max(0, 70 - (ratio - 2.0) * 10)
    return { score: Math.round(score), fit: 'over' }
  }

  // Under-capitalised
  const score = Math.max(0, ratio / 0.8 * 50)
  return { score: Math.round(score), fit: 'under' }
}

// ─── computeCompetitionScore ──────────────────────────────────────────────────

function computeCompetitionScore(inv: CompetingInvestor, capitalFitScore: number): number {
  const responseComponent = (1 / (inv.response_time_hours_avg + 1)) * 100

  const raw =
    inv.match_score                 * 0.35 +
    capitalFitScore                 * 0.20 +
    inv.conversion_probability * 100 * 0.20 +
    inv.urgency_score               * 0.15 +
    responseComponent               * 0.10

  return Math.min(100, Math.max(0, Math.round(raw)))
}

// ─── suggestedPriority ────────────────────────────────────────────────────────

function suggestedPriority(score: number): 'immediate' | 'urgent' | 'standard' | 'watchlist' {
  if (score >= 85) return 'immediate'
  if (score >= 70) return 'urgent'
  if (score >= 50) return 'standard'
  return 'watchlist'
}

// ─── rankCompetingInvestors ───────────────────────────────────────────────────

/**
 * Rank all investors competing for a property deal.
 * Loads investor profiles, engagement history, and property data from Supabase.
 */
export async function rankCompetingInvestors(
  propertyId:    string,
  tenantId:      string,
  maxInvestors?: number,
): Promise<CompetitionResult> {
  const db      = supabaseAdmin as any
  const limit   = maxInvestors ?? 20
  const dealId  = `deal_${propertyId}_${Date.now()}`

  const fallback: CompetitionResult = {
    deal_id:                     dealId,
    property_id:                 propertyId,
    tenant_id:                   tenantId,
    ranked_investors:            [],
    optimal_distribution_strategy: 'broad',
    estimated_close_probability: 0,
    estimated_days_to_close:     90,
    computed_at:                 new Date().toISOString(),
  }

  try {
    // ── 1. Load property ──────────────────────────────────────────────────────
    const { data: propRaw, error: propErr } = await db
      .from('properties')
      .select('preco, fraud_risk_score, listed_at')
      .eq('id', propertyId)
      .eq('tenant_id', tenantId)
      .single()

    if (propErr || !propRaw) {
      log.error('[CompetitionLayer] property not found', undefined, { error: propErr?.message, property_id: propertyId })
      return fallback
    }

    const prop = propRaw as PropertyRow
    const priceEur         = prop.preco ?? 0
    const fraudRisk        = prop.fraud_risk_score ?? 50
    const listedAt         = prop.listed_at ? new Date(prop.listed_at) : new Date()
    const daysListed       = Math.max(0, Math.floor((Date.now() - listedAt.getTime()) / 86_400_000))

    // ── 2. Load stored investor match scores for this property ────────────────
    const { data: matchRaw, error: matchErr } = await db
      .from('investor_matches')
      .select('investor_id, match_score')
      .eq('property_id', propertyId)
      .eq('tenant_id', tenantId)
      .gte('match_score', 40)
      .order('match_score', { ascending: false })
      .limit(limit * 2)

    if (matchErr) {
      log.error('[CompetitionLayer] failed to load matches', undefined, { error: matchErr.message, property_id: propertyId })
      return fallback
    }

    const matchRows = (matchRaw ?? []) as { investor_id: string; match_score: number }[]

    if (matchRows.length === 0) return fallback

    const investorIds = matchRows.map(r => r.investor_id)

    // ── 3. Load investor profiles ─────────────────────────────────────────────
    const { data: invRaw, error: invErr } = await db
      .from('investors')
      .select('id, capital_max_eur, investor_type')
      .in('id', investorIds)
      .eq('tenant_id', tenantId)
      .eq('status', 'active')

    if (invErr) {
      log.error('[CompetitionLayer] failed to load investor profiles', undefined, { error: invErr.message })
      return fallback
    }

    const invMap = new Map<string, InvestorRow>(
      (invRaw ?? []).map((r: InvestorRow) => [r.id, r]),
    )

    // ── 4. Load engagement history for conversion probability + response time ──
    const { data: engRaw, error: engErr } = await db
      .from('investor_engagement_events')
      .select('investor_id, event_type, response_time_hours')
      .eq('tenant_id', tenantId)
      .in('investor_id', investorIds)
      .gte('occurred_at', new Date(Date.now() - 90 * 86_400_000).toISOString())

    if (engErr) {
      log.error('[CompetitionLayer] failed to load engagement events', undefined, { error: engErr.message })
    }

    const engRows = (engRaw ?? []) as (EngagementCountRow & { response_time_hours: number | null })[]

    // Build per-investor engagement stats
    const engByInvestor = new Map<string, {
      matchViewed: number
      dealClosed:  number
      responseTimes: number[]
    }>()

    for (const row of engRows) {
      const stats = engByInvestor.get(row.investor_id) ?? {
        matchViewed:   0,
        dealClosed:    0,
        responseTimes: [],
      }
      if (row.event_type === 'match_viewed')  stats.matchViewed++
      if (row.event_type === 'deal_closed')   stats.dealClosed++
      if (row.response_time_hours !== null)   stats.responseTimes.push(row.response_time_hours)
      engByInvestor.set(row.investor_id, stats)
    }

    // ── 5. Compute urgency from days listed ───────────────────────────────────
    let urgencyScore: number
    if (daysListed < 30)        urgencyScore = 100
    else if (daysListed < 60)   urgencyScore = 80
    else if (daysListed < 90)   urgencyScore = 60
    else if (daysListed < 180)  urgencyScore = 40
    else                         urgencyScore = 20

    // ── 6. Build CompetingInvestor objects ────────────────────────────────────
    const competitors: CompetingInvestor[] = []

    for (const match of matchRows) {
      const profile = invMap.get(match.investor_id)
      if (!profile) continue

      const eng            = engByInvestor.get(match.investor_id)
      const matchViewed    = eng?.matchViewed    ?? 0
      const dealClosed     = eng?.dealClosed     ?? 0
      const responseTimes  = eng?.responseTimes  ?? []

      const conversionProb = Math.min(dealClosed / Math.max(matchViewed, 1), 1.0)
      const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((s, h) => s + h, 0) / responseTimes.length
        : 48   // default 48h if no history

      // Derive tier from investor_type
      let tier: CompetingInvestor['tier'] = 'standard'
      if (profile.investor_type === 'institution' || profile.investor_type === 'fund') {
        tier = 'institutional'
      } else if (profile.investor_type === 'family_office') {
        tier = 'premium'
      }

      competitors.push({
        investor_id:             match.investor_id,
        match_score:             match.match_score,
        capital_available_eur:   profile.capital_max_eur ?? 0,
        conversion_probability:  conversionProb,
        response_time_hours_avg: avgResponseTime,
        urgency_score:           urgencyScore,
        tier,
      })
    }

    // ── 7. Score and rank ─────────────────────────────────────────────────────
    const scored = competitors.map(inv => {
      const { score: capitalFitScore, fit } = computeCapitalFitScore(priceEur, inv.capital_available_eur)
      const competitionScore = computeCompetitionScore(inv, capitalFitScore)
      const priority         = suggestedPriority(competitionScore)
      const winProb          = Math.min(1.0, inv.conversion_probability + competitionScore / 200)

      const notes: string[] = []
      if (fit === 'over')   notes.push('Investor capital significantly exceeds property price')
      if (fit === 'under')  notes.push('Investor capital may be insufficient for this asset')
      if (inv.tier === 'institutional') notes.push('Institutional-grade investor — disciplined bidder')
      if (inv.response_time_hours_avg < 8) notes.push('Fast responder — avg < 8h response time')
      if (inv.conversion_probability >= 0.3) notes.push('High historical conversion rate')

      return { inv, capitalFitScore, competitionScore, priority, winProb, fit, notes }
    })

    scored.sort((a, b) => b.competitionScore - a.competitionScore)

    const ranked = scored.slice(0, limit).map((item, idx) => ({
      rank:               idx + 1,
      investor_id:        item.inv.investor_id,
      competition_score:  item.competitionScore,
      win_probability:    Math.round(item.winProb * 100) / 100,
      suggested_priority: item.priority,
      capital_fit:        item.fit,
      notes:              item.notes,
    }))

    // ── 8. Distribution strategy ──────────────────────────────────────────────
    let strategy: CompetitionResult['optimal_distribution_strategy']
    if (priceEur >= 2_000_000 && fraudRisk < 20) {
      strategy = 'exclusive'
    } else if (priceEur >= 500_000) {
      strategy = 'limited'
    } else {
      strategy = 'broad'
    }

    // ── 9. Estimated close metrics ────────────────────────────────────────────
    const topWinProb        = ranked[0]?.win_probability ?? 0
    const estimatedDays     = daysListed < 30 ? 45 : daysListed < 90 ? 60 : 90

    return {
      deal_id:                     dealId,
      property_id:                 propertyId,
      tenant_id:                   tenantId,
      ranked_investors:            ranked,
      optimal_distribution_strategy: strategy,
      estimated_close_probability: Math.round(topWinProb * 100) / 100,
      estimated_days_to_close:     estimatedDays,
      computed_at:                 new Date().toISOString(),
    }
  } catch (err) {
    log.error(
      '[CompetitionLayer] rankCompetingInvestors exception',
      err instanceof Error ? err : undefined,
      { error: err instanceof Error ? err.message : String(err), property_id: propertyId },
    )
    return fallback
  }
}
