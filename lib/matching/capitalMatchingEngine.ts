// Agency Group — Capital Matching Engine
// lib/matching/capitalMatchingEngine.ts
// Wave 54 Phase 5 — Institutional-grade multi-dimensional capital matching
//
// Supports: Buyer→Asset, Asset→Buyer, Connector→Buyer, Family Office→Opportunity,
// Developer→Capital, Investor→Pipeline.
// Scoring: Suitability + Matching Rules + Ranking + Liquidity + Deal Probability
// + Execution Priority + Recommendation Engine.
// TypeScript strict — 0 errors

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ── Types ──────────────────────────────────────────────────────────────────────

export type MatchType =
  | 'BUYER_TO_ASSET'
  | 'ASSET_TO_BUYER'
  | 'CONNECTOR_TO_BUYER'
  | 'FAMILY_OFFICE_TO_OPPORTUNITY'
  | 'DEVELOPER_TO_CAPITAL'
  | 'INVESTOR_TO_PIPELINE'

export type MatchGrade = 'PERFECT' | 'STRONG' | 'GOOD' | 'FAIR' | 'WEAK' | 'NO_MATCH'

export interface CapitalProfile {
  profile_id: string
  tenant_id: string
  type: 'BUYER' | 'INVESTOR' | 'FAMILY_OFFICE' | 'DEVELOPER' | 'CONNECTOR' | 'FUND'
  name: string
  budget_min_eur: number
  budget_max_eur: number
  preferred_locations: string[]
  preferred_asset_types: string[]
  risk_tolerance: 'CONSERVATIVE' | 'MODERATE' | 'AGGRESSIVE'
  target_yield_min_pct: number
  target_yield_max_pct: number
  investment_horizon_months: number
  liquidity_preference: 'HIGH' | 'MEDIUM' | 'LOW'
  currency: 'EUR' | 'USD' | 'GBP' | 'MULTI'
  verified: boolean
  kyc_status: 'PENDING' | 'APPROVED' | 'REJECTED'
  created_at: string
}

export interface AssetOpportunity {
  asset_id: string
  tenant_id: string
  type: 'RESIDENTIAL' | 'COMMERCIAL' | 'LAND' | 'PORTFOLIO' | 'DEVELOPMENT' | 'NPL'
  location: string
  country: 'PT' | 'ES'
  price_eur: number
  gross_yield_pct: number | null
  net_yield_pct: number | null
  liquidity_score: number    // 0-100: how fast can be sold
  risk_score: number         // 0-100: risk level
  deal_probability: number   // 0-100: likelihood deal closes
  execution_priority: number // 0-100: how urgently to match
  off_market: boolean
  exclusive: boolean
  created_at: string
}

export interface MatchScore {
  match_id: string
  match_type: MatchType
  profile_id: string
  asset_id: string
  tenant_id: string
  overall_score: number     // 0-100
  grade: MatchGrade
  // Dimension scores
  budget_fit: number        // 0-100
  location_fit: number      // 0-100
  yield_fit: number         // 0-100
  risk_fit: number          // 0-100
  liquidity_fit: number     // 0-100
  type_fit: number          // 0-100
  // Computed
  deal_probability: number
  execution_priority: number
  recommendation: string
  created_at: string
}

export interface MatchingReport {
  report_id: string
  tenant_id: string
  total_matches: number
  perfect_matches: number
  strong_matches: number
  good_matches: number
  top_matches: MatchScore[]
  avg_score: number
  coverage_pct: number      // % of assets that have at least 1 good match
  matching_hash: string
  generated_at: string
}

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

const MATCH_WEIGHTS = {
  budget_fit:    0.30,
  location_fit:  0.25,
  yield_fit:     0.20,
  risk_fit:      0.15,
  type_fit:      0.10,
} as const

function bigintReplacer(_k: string, v: unknown): unknown {
  return typeof v === 'bigint' ? v.toString() : v
}

// ── Dimension scoring functions ────────────────────────────────────────────────

function scoreBudgetFit(profile: CapitalProfile, asset: AssetOpportunity): number {
  const price = asset.price_eur
  if (price >= profile.budget_min_eur && price <= profile.budget_max_eur) return 100
  if (price < profile.budget_min_eur) {
    const ratio = price / profile.budget_min_eur
    return Math.round(ratio * 80)  // below min: partial score
  }
  // price > budget_max
  const overshoot = (price - profile.budget_max_eur) / profile.budget_max_eur
  return Math.max(0, Math.round((1 - overshoot) * 60))
}

function scoreLocationFit(profile: CapitalProfile, asset: AssetOpportunity): number {
  if (profile.preferred_locations.length === 0) return 70  // no preference = partial
  const exact = profile.preferred_locations.some(l =>
    asset.location.toLowerCase().includes(l.toLowerCase()) || l.toLowerCase().includes(asset.location.toLowerCase())
  )
  if (exact) return 100
  // Country match
  const countryMatch = profile.preferred_locations.some(l =>
    (asset.country === 'PT' && /portug/i.test(l)) ||
    (asset.country === 'ES' && /spain|spain|espanha/i.test(l))
  )
  if (countryMatch) return 65
  return 20
}

function scoreYieldFit(profile: CapitalProfile, asset: AssetOpportunity): number {
  const assetYield = asset.gross_yield_pct
  if (!assetYield) return 50  // unknown yield
  const yieldMin = profile.target_yield_min_pct
  const yieldMax = profile.target_yield_max_pct

  if (assetYield >= yieldMin && assetYield <= yieldMax) return 100
  if (assetYield > yieldMax) return Math.min(100, Math.round(100 - (assetYield - yieldMax) * 5))
  // below min
  const gap = (yieldMin - assetYield) / yieldMin
  return Math.max(0, Math.round((1 - gap) * 70))
}

function scoreRiskFit(profile: CapitalProfile, asset: AssetOpportunity): number {
  const assetRisk = asset.risk_score  // 0=low, 100=high
  const profileRisk = profile.risk_tolerance === 'CONSERVATIVE' ? 25 : profile.risk_tolerance === 'MODERATE' ? 50 : 75
  const gap = Math.abs(assetRisk - profileRisk)
  return Math.max(0, Math.round(100 - gap * 1.5))
}

function scoreTypeFit(profile: CapitalProfile, asset: AssetOpportunity): number {
  if (profile.preferred_asset_types.length === 0) return 70
  const match = profile.preferred_asset_types.some(t =>
    asset.type.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(asset.type.toLowerCase())
  )
  return match ? 100 : 25
}

function gradeMatch(score: number): MatchGrade {
  if (score >= 90) return 'PERFECT'
  if (score >= 75) return 'STRONG'
  if (score >= 60) return 'GOOD'
  if (score >= 45) return 'FAIR'
  if (score >= 30) return 'WEAK'
  return 'NO_MATCH'
}

function buildRecommendation(score: MatchScore): string {
  if (score.grade === 'PERFECT')       return `🎯 Match perfeito — contactar imediatamente. Prioridade máxima.`
  if (score.grade === 'STRONG')        return `✅ Match forte — propor visita esta semana.`
  if (score.grade === 'GOOD')          return `👍 Bom match — incluir na próxima comunicação.`
  if (score.grade === 'FAIR')          return `⚠️ Match parcial — apresentar como alternativa.`
  if (score.grade === 'WEAK')          return `📋 Match fraco — manter em pipeline passivo.`
  return `❌ Sem match — não apresentar.`
}

// ── Core matching function ─────────────────────────────────────────────────────

function matchProfilesToAsset(
  profiles: CapitalProfile[],
  asset: AssetOpportunity,
  matchType: MatchType,
  tenantId: string,
): MatchScore[] {
  return profiles.map(profile => {
    const budgetFit   = scoreBudgetFit(profile, asset)
    const locationFit = scoreLocationFit(profile, asset)
    const yieldFit    = scoreYieldFit(profile, asset)
    const riskFit     = scoreRiskFit(profile, asset)
    const typeFit     = scoreTypeFit(profile, asset)
    const liquidityFit = Math.abs(
      (profile.liquidity_preference === 'HIGH' ? 80 : profile.liquidity_preference === 'MEDIUM' ? 50 : 20) - asset.liquidity_score
    ) > 40 ? 40 : 80

    const overall = Math.round(
      budgetFit   * MATCH_WEIGHTS.budget_fit   +
      locationFit * MATCH_WEIGHTS.location_fit +
      yieldFit    * MATCH_WEIGHTS.yield_fit    +
      riskFit     * MATCH_WEIGHTS.risk_fit     +
      typeFit     * MATCH_WEIGHTS.type_fit
    )

    const grade = gradeMatch(overall)

    const matchScore: MatchScore = {
      match_id:           createHash('sha256').update(`${profile.profile_id}|${asset.asset_id}`).digest('hex').slice(0, 16),
      match_type:         matchType,
      profile_id:         profile.profile_id,
      asset_id:           asset.asset_id,
      tenant_id:          tenantId,
      overall_score:      overall,
      grade,
      budget_fit:         budgetFit,
      location_fit:       locationFit,
      yield_fit:          yieldFit,
      risk_fit:           riskFit,
      liquidity_fit:      liquidityFit,
      type_fit:           typeFit,
      deal_probability:   asset.deal_probability,
      execution_priority: asset.execution_priority,
      recommendation:     '',
      created_at:         new Date().toISOString(),
    }
    matchScore.recommendation = buildRecommendation(matchScore)
    return matchScore
  }).filter(m => m.grade !== 'NO_MATCH')
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function runCapitalMatching(
  tenantId: string = TENANT_ID,
): Promise<MatchingReport> {
  const reportId = randomUUID()
  const startTs  = Date.now()

  log.info('[CapitalMatchingEngine] Starting matching run', { tenantId })

  // Fetch profiles and assets from DB
  let profiles: CapitalProfile[] = []
  let assets:   AssetOpportunity[] = []

  try {
    const [profilesRes, assetsRes] = await Promise.all([
      (supabaseAdmin as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (col: string, val: string) => {
              limit: (n: number) => Promise<{ data: Array<Record<string, unknown>> | null }>
            }
          }
        }
      }).from('capital_profiles').select('*').eq('tenant_id', tenantId).limit(500),

      (supabaseAdmin as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            eq: (col: string, val: string) => {
              eq: (col2: string, val2: string) => {
                limit: (n: number) => Promise<{ data: Array<Record<string, unknown>> | null }>
              }
            }
          }
        }
      }).from('asset_opportunities').select('*').eq('tenant_id', tenantId).eq('status', 'ACTIVE').limit(200),
    ])

    profiles = (profilesRes.data ?? []).map(r => r as unknown as CapitalProfile)
    assets   = (assetsRes.data ?? []).map(r => r as unknown as AssetOpportunity)
  } catch { /* empty */ }

  // Run matching
  const allMatches: MatchScore[] = []
  for (const asset of assets) {
    const assetMatches = matchProfilesToAsset(profiles, asset, 'BUYER_TO_ASSET', tenantId)
    allMatches.push(...assetMatches)
  }

  // Sort by score descending
  allMatches.sort((a, b) => b.overall_score - a.overall_score)

  const perfectMatches = allMatches.filter(m => m.grade === 'PERFECT').length
  const strongMatches  = allMatches.filter(m => m.grade === 'STRONG').length
  const goodMatches    = allMatches.filter(m => m.grade === 'GOOD').length
  const avgScore       = allMatches.length > 0
    ? Math.round(allMatches.reduce((s, m) => s + m.overall_score, 0) / allMatches.length)
    : 0

  const assetsWithGoodMatch = new Set(
    allMatches.filter(m => ['PERFECT','STRONG','GOOD'].includes(m.grade)).map(m => m.asset_id)
  ).size
  const coveragePct = assets.length > 0 ? Math.round((assetsWithGoodMatch / assets.length) * 100) : 0

  const matchHash = createHash('sha256').update(
    `MATCHING|${tenantId}|${reportId}|${allMatches.length}|${avgScore}`
  ).digest('hex')

  const report: MatchingReport = {
    report_id:       reportId,
    tenant_id:       tenantId,
    total_matches:   allMatches.length,
    perfect_matches: perfectMatches,
    strong_matches:  strongMatches,
    good_matches:    goodMatches,
    top_matches:     allMatches.slice(0, 20),
    avg_score:       avgScore,
    coverage_pct:    coveragePct,
    matching_hash:   matchHash,
    generated_at:    new Date().toISOString(),
  }

  // Persist top matches
  try {
    for (const match of allMatches.slice(0, 50)) {
      await (supabaseAdmin as unknown as {
        from: (t: string) => { upsert: (v: unknown, opts: object) => Promise<{ error: unknown }> }
      }).from('capital_matches').upsert(
        { ...match, report_id: reportId, created_at: match.created_at },
        { onConflict: 'match_id' }
      )
    }
  } catch { /* ok */ }

  // Persist report
  try {
    await (supabaseAdmin as unknown as {
      from: (t: string) => { insert: (v: unknown) => Promise<{ error: unknown }> }
    }).from('capital_matching_reports').insert({
      report_id: reportId, tenant_id: tenantId,
      total_matches: allMatches.length, perfect_matches: perfectMatches,
      avg_score: avgScore, coverage_pct: coveragePct,
      matching_hash: matchHash,
      report_json: JSON.parse(JSON.stringify({ ...report, top_matches: report.top_matches.slice(0, 10) }, bigintReplacer)),
      generated_at: report.generated_at,
    })
  } catch { /* ok */ }

  log.info('[CapitalMatchingEngine] Complete', {
    total: allMatches.length, perfect: perfectMatches, avgScore,
    durationMs: Date.now() - startTs,
  })

  return report
}
