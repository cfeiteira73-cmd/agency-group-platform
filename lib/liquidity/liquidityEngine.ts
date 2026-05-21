// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Liquidity Engine
// lib/liquidity/liquidityEngine.ts
//
// Computes financial liquidity grade (S/A/B/C/D) for any property based on
// capital depth, bid pressure, time pressure (MPI), and investor competition.
// Persists snapshots to liquidity_snapshots for historical analysis.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { computePropertyMPI } from '@/lib/market/marketPressureIndex'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LiquidityGrade = 'S' | 'A' | 'B' | 'C' | 'D'

export interface LiquidityAssessment {
  property_id: string
  tenant_id: string
  grade: LiquidityGrade
  score: number                     // 0–100
  time_to_execution_days: number    // estimated days to close
  probability_of_close: number      // 0.0–1.0
  capital_absorption_rate: number   // EUR/day the market can absorb
  components: {
    capital_depth: number           // 0–100
    bid_pressure: number            // 0–100
    time_pressure: number           // 0–100
    investor_competition: number    // 0–100
  }
  computed_at: string
}

// ─── Internal row shapes ──────────────────────────────────────────────────────

interface BidRow {
  investor_id: string
  bid_amount: number
}

interface PropertyPriceRow {
  preco: number | null
}

// ─── Grade helpers ────────────────────────────────────────────────────────────

function scoreToGrade(score: number): LiquidityGrade {
  if (score >= 85) return 'S'
  if (score >= 70) return 'A'
  if (score >= 55) return 'B'
  if (score >= 40) return 'C'
  return 'D'
}

function gradeToTimeDays(grade: LiquidityGrade): number {
  const map: Record<LiquidityGrade, number> = {
    S: 15,
    A: 45,
    B: 90,
    C: 195,
    D: 365,
  }
  return map[grade]
}

function gradeToProbability(grade: LiquidityGrade): number {
  const map: Record<LiquidityGrade, number> = {
    S: 0.92,
    A: 0.78,
    B: 0.58,
    C: 0.35,
    D: 0.15,
  }
  return map[grade]
}

// ─── computeLiquidityGrade ────────────────────────────────────────────────────

export async function computeLiquidityGrade(
  tenantId: string,
  propertyId: string,
  askPrice?: number,
): Promise<LiquidityAssessment> {
  const db  = supabaseAdmin as any
  const now = new Date().toISOString()

  const fallback: LiquidityAssessment = {
    property_id:              propertyId,
    tenant_id:                tenantId,
    grade:                    'D',
    score:                    0,
    time_to_execution_days:   365,
    probability_of_close:     0.15,
    capital_absorption_rate:  0,
    components: {
      capital_depth:        0,
      bid_pressure:         0,
      time_pressure:        0,
      investor_competition: 0,
    },
    computed_at: now,
  }

  try {
    // Resolve ask price
    let resolvedAsk = askPrice ?? 0
    if (!resolvedAsk) {
      const { data: propRaw, error: propErr } = await (db
        .from('properties')
        .select('preco')
        .eq('id', propertyId)
        .eq('tenant_id', tenantId)
        .single() as Promise<{ data: PropertyPriceRow | null; error: { message: string } | null }>)

      if (propErr || !propRaw) {
        log.warn('[liquidityEngine] computeLiquidityGrade: property not found', { property_id: propertyId })
        return fallback
      }
      resolvedAsk = propRaw.preco ?? 0
    }

    // Fetch active bids
    const { data: bidsRaw, error: bidsErr } = await (db
      .from('investor_bids')
      .select('investor_id, bid_amount')
      .eq('tenant_id', tenantId)
      .eq('property_id', propertyId)
      .eq('status', 'active') as Promise<{ data: BidRow[] | null; error: { message: string } | null }>)

    if (bidsErr) {
      log.warn('[liquidityEngine] bids query failed', { property_id: propertyId, error: bidsErr.message })
    }

    const bids = bidsRaw ?? []

    // Compute bid aggregates
    const activeBidCount      = bids.length
    const totalBidVolume      = bids.reduce((s, b) => s + b.bid_amount, 0)
    const distinctInvestors   = new Set(bids.map(b => b.investor_id)).size

    // Component scores
    const capital_depth = resolvedAsk > 0
      ? Math.min(100, (totalBidVolume / resolvedAsk) * 100)
      : 0

    const bid_pressure = Math.min(100, activeBidCount * 15)

    // Time pressure from MPI (mpi_score is already 0–100)
    const mpi = await computePropertyMPI(tenantId, propertyId)
    const time_pressure = mpi.mpi_score

    const investor_competition = Math.min(100, distinctInvestors * 20)

    // Composite score
    const score = Math.round(
      (capital_depth * 0.35
        + bid_pressure * 0.30
        + time_pressure * 0.20
        + investor_competition * 0.15) * 100,
    ) / 100

    const grade                   = scoreToGrade(score)
    const time_to_execution_days  = gradeToTimeDays(grade)
    const probability_of_close    = gradeToProbability(grade)
    const capital_absorption_rate = time_to_execution_days > 0
      ? Math.round((resolvedAsk / time_to_execution_days) * 100) / 100
      : 0

    const assessment: LiquidityAssessment = {
      property_id:             propertyId,
      tenant_id:               tenantId,
      grade,
      score,
      time_to_execution_days,
      probability_of_close,
      capital_absorption_rate,
      components: {
        capital_depth:        Math.round(capital_depth * 100) / 100,
        bid_pressure:         Math.round(bid_pressure * 100) / 100,
        time_pressure:        Math.round(time_pressure * 100) / 100,
        investor_competition: Math.round(investor_competition * 100) / 100,
      },
      computed_at: now,
    }

    log.info('[liquidityEngine] computeLiquidityGrade', {
      property_id: propertyId,
      grade,
      score,
    })

    return assessment
  } catch (err) {
    log.error('[liquidityEngine] computeLiquidityGrade exception', err instanceof Error ? err : undefined, {
      property_id: propertyId,
    })
    return fallback
  }
}

// ─── batchComputeLiquidity ────────────────────────────────────────────────────

export async function batchComputeLiquidity(
  tenantId: string,
  propertyIds: string[],
): Promise<LiquidityAssessment[]> {
  const results = await Promise.allSettled(
    propertyIds.map(pid => computeLiquidityGrade(tenantId, pid)),
  )

  return results.map((r, i) => {
    if (r.status === 'fulfilled') return r.value
    log.warn('[liquidityEngine] batchComputeLiquidity: one property failed', {
      property_id: propertyIds[i],
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    })
    return {
      property_id:             propertyIds[i] ?? '',
      tenant_id:               tenantId,
      grade:                   'D' as LiquidityGrade,
      score:                   0,
      time_to_execution_days:  365,
      probability_of_close:    0.15,
      capital_absorption_rate: 0,
      components: {
        capital_depth:        0,
        bid_pressure:         0,
        time_pressure:        0,
        investor_competition: 0,
      },
      computed_at: new Date().toISOString(),
    }
  })
}

// ─── persistLiquiditySnapshot ─────────────────────────────────────────────────

export async function persistLiquiditySnapshot(assessment: LiquidityAssessment): Promise<void> {
  const db = supabaseAdmin as any

  const { error } = await (db
    .from('liquidity_snapshots')
    .insert({
      tenant_id:               assessment.tenant_id,
      property_id:             assessment.property_id,
      grade:                   assessment.grade,
      score:                   assessment.score,
      time_to_execution_days:  assessment.time_to_execution_days,
      probability_of_close:    assessment.probability_of_close,
      capital_absorption_rate: assessment.capital_absorption_rate,
      components:              assessment.components,
      computed_at:             assessment.computed_at,
    }) as Promise<{ error: { message: string } | null }>)

  if (error) {
    log.warn('[liquidityEngine] persistLiquiditySnapshot failed', {
      property_id: assessment.property_id,
      error:       error.message,
    })
  }
}
