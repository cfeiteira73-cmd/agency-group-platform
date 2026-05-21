// =============================================================================
// Agency Group — Liquidity Score Engine
// lib/investors/liquidityEngine.ts
//
// Computes per-asset liquidity grades based on capital pool depth,
// investor demand pressure, ML conversion signals, and urgency.
//
// liquidity_score = capital_match*0.30 + demand_pressure*0.25 +
//                   conversion_probability*0.25 + urgency_index*0.20
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LiquidityScore {
  asset_id:    string          // canonical_id or property_id
  tenant_id:   string

  // Component scores
  capital_match_score:           number   // 0–100
  demand_pressure_score:         number   // 0–100
  conversion_probability_score:  number   // 0–100
  urgency_index_score:           number   // 0–100

  // Composite
  liquidity_score: number   // weighted sum 0–100

  // Grade
  grade: 'S' | 'A' | 'B' | 'C' | 'D'

  // Market depth
  active_investors_count:    number
  estimated_days_to_match:   number

  computed_at: string
}

// ─── Internal DB row shapes ───────────────────────────────────────────────────

interface PropertyRow {
  preco:     number
  listed_at: string | null
}

interface InvestorCapitalRow {
  id:              string
  capital_max_eur: number | null
}

// ─── Private helpers ──────────────────────────────────────────────────────────

function gradeFromScore(score: number): LiquidityScore['grade'] {
  if (score >= 85) return 'S'
  if (score >= 70) return 'A'
  if (score >= 55) return 'B'
  if (score >= 40) return 'C'
  return 'D'
}

function urgencyIndexFromDaysListed(daysListed: number): number {
  if (daysListed < 30)        return 100
  if (daysListed < 60)        return 80
  if (daysListed < 90)        return 60
  if (daysListed < 180)       return 40
  return 20
}

function estimatedDaysToMatch(grade: LiquidityScore['grade']): number {
  switch (grade) {
    case 'S': return 14
    case 'A': return 30
    case 'B': return 60
    case 'C': return 90
    case 'D': return 180
  }
}

// ─── computeLiquidityScore ────────────────────────────────────────────────────

/**
 * Compute the liquidity score for a single property.
 */
export async function computeLiquidityScore(
  propertyId: string,
  tenantId:   string,
): Promise<LiquidityScore> {
  const db = supabaseAdmin as any

  const blank: LiquidityScore = {
    asset_id:                     propertyId,
    tenant_id:                    tenantId,
    capital_match_score:          0,
    demand_pressure_score:        0,
    conversion_probability_score: 0,
    urgency_index_score:          0,
    liquidity_score:              0,
    grade:                        'D',
    active_investors_count:       0,
    estimated_days_to_match:      180,
    computed_at:                  new Date().toISOString(),
  }

  try {
    // ── 1. Load property ──────────────────────────────────────────────────────
    const { data: propRaw, error: propErr } = await db
      .from('properties')
      .select('preco, listed_at')
      .eq('id', propertyId)
      .eq('tenant_id', tenantId)
      .single()

    if (propErr || !propRaw) {
      log.error('[LiquidityEngine] property not found', undefined, { error: propErr?.message, property_id: propertyId })
      return blank
    }

    const prop       = propRaw as PropertyRow
    const priceEur   = prop.preco ?? 0
    const listedAt   = prop.listed_at ? new Date(prop.listed_at) : new Date()
    const daysListed = Math.max(0, Math.floor((Date.now() - listedAt.getTime()) / 86_400_000))

    // ── 2. Capital match score ─────────────────────────────────────────────────
    // Count active investors with capital_max_eur >= price * 0.5
    const minCapital = priceEur * 0.5

    const { data: capRaw, error: capErr } = await db
      .from('investors')
      .select('id, capital_max_eur')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .gte('capital_max_eur', minCapital)

    if (capErr) {
      log.error('[LiquidityEngine] failed to load investor capital', undefined, { error: capErr.message })
    }

    const capRows       = (capRaw ?? []) as InvestorCapitalRow[]
    const capCount      = capRows.length
    const capital_match = Math.min(100, capCount * 10)

    // ── 3. Demand pressure score ───────────────────────────────────────────────
    // Zone heat index from liquidity_heatmap
    let demand_pressure = 50   // default neutral

    try {
      const { data: propZone } = await db
        .from('properties')
        .select('zona')
        .eq('id', propertyId)
        .eq('tenant_id', tenantId)
        .single()

      if (propZone?.zona) {
        const { data: heatRaw } = await db
          .from('liquidity_heatmap')
          .select('heat_index')
          .eq('tenant_id', tenantId)
          .eq('zone', propZone.zona)
          .order('snapshot_date', { ascending: false })
          .limit(1)
          .single()

        if (heatRaw?.heat_index !== undefined) {
          demand_pressure = Math.min(100, Math.max(0, heatRaw.heat_index as number))
        }
      }
    } catch {
      // best-effort
    }

    // ── 4. Conversion probability score ───────────────────────────────────────
    // Based on aggregate engagement events on this property
    const { count: offerCount } = await db
      .from('investor_engagement_events')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('event_type', 'offer_made')
      .eq('tenant_id', tenantId)

    const { count: viewCount } = await db
      .from('investor_engagement_events')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', propertyId)
      .eq('event_type', 'match_viewed')
      .eq('tenant_id', tenantId)

    const offers  = offerCount  ?? 0
    const views   = viewCount   ?? 0
    const convRate = views > 0 ? offers / views : 0
    const conversion_probability = Math.min(100, Math.round(convRate * 200 + views * 2))

    // ── 5. Urgency index ───────────────────────────────────────────────────────
    const urgency_index = urgencyIndexFromDaysListed(daysListed)

    // ── 6. Weighted composite ──────────────────────────────────────────────────
    const liquidity_score = Math.round(
      capital_match        * 0.30 +
      demand_pressure      * 0.25 +
      conversion_probability * 0.25 +
      urgency_index        * 0.20,
    )

    const grade                  = gradeFromScore(liquidity_score)
    const estimated_days_to_match = estimatedDaysToMatch(grade)

    // ── 7. Persist to liquidity_scores table (upsert) ─────────────────────────
    void db
      .from('liquidity_scores')
      .upsert(
        {
          tenant_id:                    tenantId,
          asset_id:                     propertyId,
          liquidity_score,
          grade,
          capital_match_score:          capital_match,
          demand_pressure_score:        demand_pressure,
          conversion_probability_score: conversion_probability,
          urgency_index_score:          urgency_index,
          active_investors_count:       capCount,
          estimated_days_to_match,
          computed_at:                  new Date().toISOString(),
        },
        { onConflict: 'tenant_id,asset_id' },
      )
      .then(({ error }: { error: { message: string } | null }) => {
        if (error) {
          log.error('[LiquidityEngine] upsert liquidity_scores failed', undefined, { error: error.message })
        }
      })

    return {
      asset_id:                     propertyId,
      tenant_id:                    tenantId,
      capital_match_score:          capital_match,
      demand_pressure_score:        demand_pressure,
      conversion_probability_score: conversion_probability,
      urgency_index_score:          urgency_index,
      liquidity_score,
      grade,
      active_investors_count:       capCount,
      estimated_days_to_match,
      computed_at:                  new Date().toISOString(),
    }
  } catch (err) {
    log.error(
      '[LiquidityEngine] computeLiquidityScore exception',
      err instanceof Error ? err : undefined,
      { error: err instanceof Error ? err.message : String(err), property_id: propertyId },
    )
    return blank
  }
}

// ─── getPortfolioLiquidityProfile ─────────────────────────────────────────────

/**
 * Compute liquidity scores for all active properties and return a
 * portfolio-level profile.
 */
export async function getPortfolioLiquidityProfile(tenantId: string): Promise<{
  assets:                       LiquidityScore[]
  portfolio_liquidity_score:    number
  grade_distribution:           Record<string, number>
  total_accessible_capital_eur: number
  total_asset_value_eur:        number
  liquidity_ratio:              number
}> {
  const db = supabaseAdmin as any

  const empty = {
    assets:                       [] as LiquidityScore[],
    portfolio_liquidity_score:    0,
    grade_distribution:           {} as Record<string, number>,
    total_accessible_capital_eur: 0,
    total_asset_value_eur:        0,
    liquidity_ratio:              0,
  }

  try {
    // ── 1. All active properties ───────────────────────────────────────────────
    const { data: propRaw, error: propErr } = await db
      .from('properties')
      .select('id, preco')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .limit(500)

    if (propErr) {
      log.error('[LiquidityEngine] getPortfolioLiquidityProfile load error', undefined, { error: propErr.message })
      return empty
    }

    const props = (propRaw ?? []) as { id: string; preco: number }[]
    if (props.length === 0) return empty

    // ── 2. Compute scores in batches ───────────────────────────────────────────
    const BATCH = 20
    const allScores: LiquidityScore[] = []

    for (let i = 0; i < props.length; i += BATCH) {
      const batch  = props.slice(i, i + BATCH)
      const scored = await Promise.all(batch.map(p => computeLiquidityScore(p.id, tenantId)))
      allScores.push(...scored)
    }

    // ── 3. Aggregate metrics ───────────────────────────────────────────────────
    const total_asset_value_eur = props.reduce((s, p) => s + (p.preco ?? 0), 0)

    const scoreSum = allScores.reduce((s, a) => s + a.liquidity_score, 0)
    const portfolio_liquidity_score = allScores.length > 0
      ? Math.round(scoreSum / allScores.length)
      : 0

    const grade_distribution: Record<string, number> = {}
    for (const a of allScores) {
      grade_distribution[a.grade] = (grade_distribution[a.grade] ?? 0) + 1
    }

    // Accessible capital: sum capital of investors that match at least 1 property
    const { data: capRaw } = await db
      .from('investors')
      .select('capital_max_eur')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .not('capital_max_eur', 'is', null)

    const total_accessible_capital_eur = ((capRaw ?? []) as { capital_max_eur: number }[])
      .reduce((s, r) => s + (r.capital_max_eur ?? 0), 0)

    const liquidity_ratio = total_asset_value_eur > 0
      ? Math.round((total_accessible_capital_eur / total_asset_value_eur) * 100) / 100
      : 0

    return {
      assets:                       allScores,
      portfolio_liquidity_score,
      grade_distribution,
      total_accessible_capital_eur,
      total_asset_value_eur,
      liquidity_ratio,
    }
  } catch (err) {
    log.error(
      '[LiquidityEngine] getPortfolioLiquidityProfile exception',
      err instanceof Error ? err : undefined,
      { error: err instanceof Error ? err.message : String(err) },
    )
    return empty
  }
}
