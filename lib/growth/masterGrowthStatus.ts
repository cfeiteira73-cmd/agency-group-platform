// Agency Group — Master Growth Status
// lib/growth/masterGrowthStatus.ts
// Assembles the complete growth + expansion system status.
// Single call to get the full picture: growth engine + expansion + network effect.
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MasterGrowthStatus {
  tenant_id: string
  generated_at: string
  growth_engine: {
    growth_score: number
    loop_status: string
    flywheel_velocity: string
    capital_acquired_30d_eur_cents: number
    active_campaigns: number
    dormant_capital_eur_cents: number
    optimization_decisions_pending: number
  }
  expansion_engine: {
    markets_analyzed: number
    priority_1_markets: number
    active_expansion_plans: number
    capital_in_migration_eur_cents: number
    arbitrage_opportunities: number
  }
  network_effect: {
    score: number
    stage: string
    moat_strength: string
    investor_count: number
    geographic_coverage: number
    virtuous_cycle_active: boolean
  }
  attribution: {
    top_channel: string | null
    best_roi_multiple: number
    avg_cac_eur_cents: number
    avg_ltv_eur_cents: number
    ltv_cac_ratio: number
  }
  system_status:
    | 'MARKET_ORGANISM'
    | 'SELF_GROWING'
    | 'SCALING'
    | 'BUILDING'
    | 'EARLY_STAGE'
  ready_for_institutional: boolean
  alerts: string[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CANONICAL_TENANT =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toNum(v: unknown): number {
  const n = Number(v)
  return isNaN(n) ? 0 : n
}

function toStr(v: unknown, fallback: string): string {
  if (typeof v === 'string' && v.length > 0) return v
  return fallback
}

// ─── getMasterGrowthStatus ────────────────────────────────────────────────────

/**
 * Assembles the full growth + expansion + network system status.
 * All queries are graceful — returns 0/null if a table is empty or missing.
 * Persists the result to master_growth_status_history.
 */
export async function getMasterGrowthStatus(
  tenantId: string,
): Promise<MasterGrowthStatus> {
  const tid = tenantId || CANONICAL_TENANT
  const generated_at = new Date().toISOString()

  // ── 1. Growth dashboard snapshot (latest) ─────────────────────────────────
  let growthScore = 0
  let loopStatus = 'UNKNOWN'
  let flywheelVelocity = 'UNKNOWN'
  let capitalAcquired30d = 0
  let activeCampaigns = 0
  let dormantCapital = 0
  let optimizationDecisionsPending = 0

  try {
    const { data: dashRows } = await (supabaseAdmin as any)
      .from('growth_dashboard_snapshots')
      .select(
        'growth_score, loop_status, flywheel_velocity, capital_acquired_30d_eur_cents, active_campaigns, dormant_capital_eur_cents, optimization_decisions_pending',
      )
      .eq('tenant_id', tid)
      .order('generated_at', { ascending: false })
      .limit(1)

    if (Array.isArray(dashRows) && dashRows.length > 0) {
      const r = dashRows[0] as Record<string, unknown>
      growthScore = toNum(r['growth_score'])
      loopStatus = toStr(r['loop_status'], 'UNKNOWN')
      flywheelVelocity = toStr(r['flywheel_velocity'], 'UNKNOWN')
      capitalAcquired30d = toNum(r['capital_acquired_30d_eur_cents'])
      activeCampaigns = toNum(r['active_campaigns'])
      dormantCapital = toNum(r['dormant_capital_eur_cents'])
      optimizationDecisionsPending = toNum(r['optimization_decisions_pending'])
    } else {
      // Fall back to growth_kpi_snapshots which is populated by growthKpiEngine
      const { data: kpiRows } = await (supabaseAdmin as any)
        .from('growth_kpi_snapshots')
        .select('overall_growth_score, capital_acquired_eur_cents, active_campaigns_count')
        .eq('tenant_id', tid)
        .order('computed_at', { ascending: false })
        .limit(1)

      if (Array.isArray(kpiRows) && kpiRows.length > 0) {
        const k = kpiRows[0] as Record<string, unknown>
        growthScore = toNum(k['overall_growth_score'])
        capitalAcquired30d = toNum(k['capital_acquired_eur_cents'])
        activeCampaigns = toNum(k['active_campaigns_count'])
      }
    }
  } catch (e) {
    log.warn('[masterGrowthStatus] growth_dashboard_snapshots query failed', {
      error: String(e),
    })
  }

  // Derive loop_status from closedLoopGrowth if not populated
  if (loopStatus === 'UNKNOWN') {
    try {
      const { data: loopRows } = await (supabaseAdmin as any)
        .from('closed_loop_snapshots')
        .select('loop_status, loop_velocity_score')
        .eq('tenant_id', tid)
        .order('measured_at', { ascending: false })
        .limit(1)

      if (Array.isArray(loopRows) && loopRows.length > 0) {
        const l = loopRows[0] as Record<string, unknown>
        loopStatus = toStr(l['loop_status'], 'UNKNOWN')
        flywheelVelocity = toStr(
          l['loop_velocity_score'] !== undefined
            ? String(l['loop_velocity_score'])
            : null,
          'UNKNOWN',
        )
      }
    } catch (e) {
      log.warn('[masterGrowthStatus] closed_loop_snapshots query failed', {
        error: String(e),
      })
    }
  }

  // ── 2. Market selection reports (latest priority_1 count) ─────────────────
  let marketsAnalyzed = 0
  let priority1Markets = 0

  try {
    const { data: msRows } = await (supabaseAdmin as any)
      .from('market_selection_reports')
      .select('markets_scored, priority_1_markets')
      .order('generated_at', { ascending: false })
      .limit(1)

    if (Array.isArray(msRows) && msRows.length > 0) {
      const r = msRows[0] as Record<string, unknown>
      marketsAnalyzed = toNum(r['markets_scored'])
      const p1 = r['priority_1_markets']
      if (Array.isArray(p1)) {
        priority1Markets = p1.length
      } else if (typeof p1 === 'string') {
        try {
          const parsed = JSON.parse(p1) as unknown
          priority1Markets = Array.isArray(parsed) ? parsed.length : toNum(p1)
        } catch {
          priority1Markets = 0
        }
      } else {
        priority1Markets = toNum(p1)
      }
    }
  } catch (e) {
    log.warn('[masterGrowthStatus] market_selection_reports query failed', {
      error: String(e),
    })
  }

  // ── 3. Expansion plans (active count) ─────────────────────────────────────
  let activeExpansionPlans = 0

  try {
    const { data: epRows, error: epErr } = await (supabaseAdmin as any)
      .from('expansion_plans')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tid)
      .in('status', ['ACTIVE', 'IN_PROGRESS', 'EXECUTING'])

    if (!epErr) {
      activeExpansionPlans = toNum(
        (epRows as { count?: number } | null)?.count ?? 0,
      )
    }
  } catch (e) {
    log.warn('[masterGrowthStatus] expansion_plans query failed', {
      error: String(e),
    })
  }

  // ── 4. Migration opportunities (sum capital) ───────────────────────────────
  let capitalInMigration = 0

  try {
    const { data: moRows } = await (supabaseAdmin as any)
      .from('migration_opportunities')
      .select('potential_capital_eur_cents')
      .eq('tenant_id', tid)
      .in('status', ['IDENTIFIED', 'ACTIVE', 'IN_PROGRESS'])

    if (Array.isArray(moRows)) {
      capitalInMigration = moRows.reduce((acc: number, r: Record<string, unknown>) => {
        return acc + toNum(r['potential_capital_eur_cents'])
      }, 0)
    }
  } catch (e) {
    log.warn('[masterGrowthStatus] migration_opportunities query failed', {
      error: String(e),
    })
  }

  // ── 5. Supply-demand signals (ARBITRAGE type count) ────────────────────────
  let arbitrageOpportunities = 0

  try {
    const { data: sdRows } = await (supabaseAdmin as any)
      .from('supply_demand_signals')
      .select('id')
      .eq('tenant_id', tid)
      .eq('signal_type', 'ARBITRAGE')
      .eq('active', true)

    if (Array.isArray(sdRows)) {
      arbitrageOpportunities = sdRows.length
    }
  } catch (e) {
    log.warn('[masterGrowthStatus] supply_demand_signals query failed', {
      error: String(e),
    })
  }

  // ── 6. Network effect snapshots (latest) ──────────────────────────────────
  let networkScore = 0
  let networkStage = 'SPARK'
  let moatStrength = 'WEAK'
  let investorCount = 0
  let geographicCoverage = 0
  let virtuousCycleActive = false

  try {
    const { data: neRows } = await (supabaseAdmin as any)
      .from('network_effect_snapshots')
      .select(
        'flywheel_score, flywheel_stage, active_investors, competition_index, capital_velocity, network_density',
      )
      .eq('tenant_id', tid)
      .order('period', { ascending: false })
      .limit(1)

    if (Array.isArray(neRows) && neRows.length > 0) {
      const r = neRows[0] as Record<string, unknown>
      networkScore = toNum(r['flywheel_score'])
      const rawStage = toStr(r['flywheel_stage'], 'seed')
      // Normalise to our enum
      const stageMap: Record<string, string> = {
        seed: 'SPARK',
        growth: 'IGNITION',
        acceleration: 'MOMENTUM',
        maturity: 'FLYWHEEL',
        SPARK: 'SPARK',
        IGNITION: 'IGNITION',
        MOMENTUM: 'MOMENTUM',
        FLYWHEEL: 'FLYWHEEL',
        COMPOUNDING: 'COMPOUNDING',
      }
      networkStage = stageMap[rawStage] ?? 'SPARK'
      investorCount = toNum(r['active_investors'])
      geographicCoverage = marketsAnalyzed
      const density = toNum(r['network_density'])
      moatStrength = density > 0.7 ? 'STRONG' : density > 0.4 ? 'MODERATE' : 'WEAK'
      virtuousCycleActive = networkScore > 50
    }
  } catch (e) {
    log.warn('[masterGrowthStatus] network_effect_snapshots query failed', {
      error: String(e),
    })
  }

  // ── 7. Channel attribution summaries (top channel by capital) ─────────────
  let topChannel: string | null = null

  try {
    const { data: caRows } = await (supabaseAdmin as any)
      .from('channel_attribution_summaries')
      .select('channel, total_capital_attributed_eur_cents')
      .eq('tenant_id', tid)
      .order('total_capital_attributed_eur_cents', { ascending: false })
      .limit(1)

    if (Array.isArray(caRows) && caRows.length > 0) {
      const r = caRows[0] as Record<string, unknown>
      topChannel = toStr(r['channel'], '') || null
    }
  } catch (e) {
    log.warn('[masterGrowthStatus] channel_attribution_summaries query failed', {
      error: String(e),
    })
  }

  // ── 8. Campaign ROI results (best roi_multiple) ────────────────────────────
  let bestRoiMultiple = 0

  try {
    const { data: roiRows } = await (supabaseAdmin as any)
      .from('campaign_roi_results')
      .select('roi_multiple')
      .eq('tenant_id', tid)
      .order('roi_multiple', { ascending: false })
      .limit(1)

    if (Array.isArray(roiRows) && roiRows.length > 0) {
      const r = roiRows[0] as Record<string, unknown>
      bestRoiMultiple = toNum(r['roi_multiple'])
    }
  } catch (e) {
    log.warn('[masterGrowthStatus] campaign_roi_results query failed', {
      error: String(e),
    })
  }

  // ── 9. CAC metrics (latest avg_cac) ───────────────────────────────────────
  let avgCac = 0

  try {
    const { data: cacRows } = await (supabaseAdmin as any)
      .from('cac_metrics')
      .select('cac_eur_cents')
      .eq('tenant_id', tid)
      .order('computed_at', { ascending: false })
      .limit(10)

    if (Array.isArray(cacRows) && cacRows.length > 0) {
      const total = cacRows.reduce((acc: number, r: Record<string, unknown>) => {
        return acc + toNum(r['cac_eur_cents'])
      }, 0)
      avgCac = Math.round(total / cacRows.length)
    }
  } catch (e) {
    log.warn('[masterGrowthStatus] cac_metrics query failed', { error: String(e) })
  }

  // ── 10. LTV metrics (avg ltv) ─────────────────────────────────────────────
  let avgLtv = 0

  try {
    const { data: ltvRows } = await (supabaseAdmin as any)
      .from('ltv_metrics')
      .select('ltv_eur_cents')
      .eq('tenant_id', tid)
      .order('computed_at', { ascending: false })
      .limit(10)

    if (Array.isArray(ltvRows) && ltvRows.length > 0) {
      const total = ltvRows.reduce((acc: number, r: Record<string, unknown>) => {
        return acc + toNum(r['ltv_eur_cents'])
      }, 0)
      avgLtv = Math.round(total / ltvRows.length)
    }
  } catch (e) {
    log.warn('[masterGrowthStatus] ltv_metrics query failed', { error: String(e) })
  }

  // ── Derived metrics ────────────────────────────────────────────────────────

  const ltvCacRatio =
    avgCac > 0 ? parseFloat((avgLtv / avgCac).toFixed(2)) : 0

  // ── System status computation ──────────────────────────────────────────────

  let system_status: MasterGrowthStatus['system_status'] = 'EARLY_STAGE'

  if (
    (networkStage === 'COMPOUNDING' && loopStatus === 'COMPOUNDING') ||
    (networkStage === 'COMPOUNDING' && loopStatus === 'GROWING')
  ) {
    system_status = 'MARKET_ORGANISM'
  } else if (networkStage === 'FLYWHEEL' || networkStage === 'COMPOUNDING') {
    system_status = 'SELF_GROWING'
  } else if (growthScore > 60) {
    system_status = 'SCALING'
  } else if (growthScore > 40) {
    system_status = 'BUILDING'
  } else {
    system_status = 'EARLY_STAGE'
  }

  // ── Ready for institutional ────────────────────────────────────────────────

  const totalCapital = capitalAcquired30d + capitalInMigration
  const ready_for_institutional =
    investorCount >= 10 &&
    marketsAnalyzed >= 3 &&
    totalCapital > 100_000_00 // > €1,000,000

  // ── Alerts ────────────────────────────────────────────────────────────────

  const alerts: string[] = []

  const totalKnownCapital = capitalAcquired30d > 0 ? capitalAcquired30d : 1
  if (dormantCapital > totalKnownCapital * 0.2) {
    alerts.push(
      `Dormant capital (${dormantCapital} cents) exceeds 20% of total — activate re-engagement campaigns.`,
    )
  }

  if (activeCampaigns === 0) {
    alerts.push('No active campaigns — growth engine is idle.')
  }

  if (ltvCacRatio < 2 && (avgCac > 0 || avgLtv > 0)) {
    alerts.push(
      `LTV/CAC ratio is ${ltvCacRatio} (< 2) — review acquisition cost and lifetime value strategy.`,
    )
  }

  // ── Assemble status ────────────────────────────────────────────────────────

  const status: MasterGrowthStatus = {
    tenant_id: tid,
    generated_at,
    growth_engine: {
      growth_score: growthScore,
      loop_status: loopStatus,
      flywheel_velocity: flywheelVelocity,
      capital_acquired_30d_eur_cents: capitalAcquired30d,
      active_campaigns: activeCampaigns,
      dormant_capital_eur_cents: dormantCapital,
      optimization_decisions_pending: optimizationDecisionsPending,
    },
    expansion_engine: {
      markets_analyzed: marketsAnalyzed,
      priority_1_markets: priority1Markets,
      active_expansion_plans: activeExpansionPlans,
      capital_in_migration_eur_cents: capitalInMigration,
      arbitrage_opportunities: arbitrageOpportunities,
    },
    network_effect: {
      score: networkScore,
      stage: networkStage,
      moat_strength: moatStrength,
      investor_count: investorCount,
      geographic_coverage: geographicCoverage,
      virtuous_cycle_active: virtuousCycleActive,
    },
    attribution: {
      top_channel: topChannel,
      best_roi_multiple: bestRoiMultiple,
      avg_cac_eur_cents: avgCac,
      avg_ltv_eur_cents: avgLtv,
      ltv_cac_ratio: ltvCacRatio,
    },
    system_status,
    ready_for_institutional,
    alerts,
  }

  // ── Persist to master_growth_status_history ────────────────────────────────

  void (supabaseAdmin as any)
    .from('master_growth_status_history')
    .insert({
      tenant_id: tid,
      generated_at,
      growth_engine: status.growth_engine,
      expansion_engine: status.expansion_engine,
      network_effect: status.network_effect,
      attribution: status.attribution,
      system_status,
      ready_for_institutional,
      alerts,
    })
    .catch((e: unknown) =>
      log.warn('[masterGrowthStatus] persist failed', { error: String(e) }),
    )

  log.info('[masterGrowthStatus] getMasterGrowthStatus complete', {
    tenant_id: tid,
    system_status,
    growth_score: growthScore,
    network_stage: networkStage,
    ready_for_institutional,
    alerts_count: alerts.length,
  })

  return status
}
