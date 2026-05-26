// =============================================================================
// Agency Group — Market Infrastructure Status Engine
// lib/infrastructure/marketInfrastructureStatusEngine.ts
//
// Aggregates all 10 system layers into a single infrastructure status view.
// What banks and institutional investors see when they evaluate the platform.
//
// Layers: SUPPLY | NORMALIZATION | OPPORTUNITY | CAPITAL |
//         DISTRIBUTION | EXECUTION | FEEDBACK | ML | REGULATORY | AUTHORITY
//
// TypeScript strict — 0 errors.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { runGoLiveAssessment, getLatestAssessment } from '@/lib/infrastructure/goLiveCriteriaValidator'

// ─── Types ────────────────────────────────────────────────────────────────────

export type InfrastructureLayer =
  | 'SUPPLY'
  | 'NORMALIZATION'
  | 'OPPORTUNITY'
  | 'CAPITAL'
  | 'DISTRIBUTION'
  | 'EXECUTION'
  | 'FEEDBACK'
  | 'ML'
  | 'REGULATORY'
  | 'AUTHORITY'

export interface LayerStatus {
  layer: InfrastructureLayer
  status: 'OPERATIONAL' | 'DEGRADED' | 'OFFLINE' | 'NOT_CONFIGURED'
  health_score: number  // 0–100
  last_activity_at: string | null
  record_count: number
  notes: string
}

export interface MarketInfrastructureStatus {
  status_id: string
  tenant_id: string

  // Overall
  overall_status: 'FULLY_OPERATIONAL' | 'PARTIALLY_OPERATIONAL' | 'DEGRADED' | 'OFFLINE'
  overall_health_score: number
  system_grade: string

  // All 10 layers
  layers: LayerStatus[]
  operational_layers: number
  degraded_layers: number
  offline_layers: number

  // Go-live status
  go_live_ready: boolean
  go_live_criteria_passed: number

  // Key metrics
  total_supply_records: number
  total_canonical_assets: number
  total_active_opportunities: number
  total_investors: number
  total_capital_eur_cents: number

  generated_at: string
}

// ─── Layer Configuration ──────────────────────────────────────────────────────

interface LayerConfig {
  table: string
  countField: string
  activityField: string
}

const LAYER_CONFIG: Record<InfrastructureLayer, LayerConfig> = {
  SUPPLY:         { table: 'raw_opportunity_stream',      countField: 'id', activityField: 'ingested_at' },
  NORMALIZATION:  { table: 'canonical_assets_v2',         countField: 'id', activityField: 'last_updated_at' },
  OPPORTUNITY:    { table: 'detected_opportunities',      countField: 'id', activityField: 'detected_at' },
  CAPITAL:        { table: 'investor_capital_profiles',   countField: 'id', activityField: 'updated_at' },
  DISTRIBUTION:   { table: 'distribution_queue',         countField: 'id', activityField: 'queued_at' },
  EXECUTION:      { table: 'capital_execution_pipelines', countField: 'id', activityField: 'started_at' },
  FEEDBACK:       { table: 'feedback_signals',            countField: 'id', activityField: 'occurred_at' },
  ML:             { table: 'ml_reality_alignments',       countField: 'id', activityField: 'assessed_at' },
  REGULATORY:     { table: 'compliance_reports',          countField: 'id', activityField: 'generated_at' },
  AUTHORITY:      { table: 'official_liquidity_index',   countField: 'id', activityField: 'published_at' },
}

// ─── Check Layer Status ───────────────────────────────────────────────────────

/**
 * For each layer, reads its primary table count and last activity.
 * OPERATIONAL: count > 0 and last_activity < 7 days
 * DEGRADED: last_activity 7–30 days
 * OFFLINE: > 30 days or count = 0
 * NOT_CONFIGURED: table query fails
 */
export async function checkLayerStatus(
  layer: InfrastructureLayer,
  tenantId: string,
): Promise<LayerStatus> {
  const config = LAYER_CONFIG[layer]

  try {
    // Get total count
    const { count, error: countError } = await (supabaseAdmin as any)
      .from(config.table)
      .select(config.countField, { count: 'exact', head: true })
      .eq('tenant_id', tenantId)

    if (countError) {
      return {
        layer,
        status: 'NOT_CONFIGURED',
        health_score: 0,
        last_activity_at: null,
        record_count: 0,
        notes: `Table not configured: ${countError.message}`,
      }
    }

    const recordCount = count ?? 0

    if (recordCount === 0) {
      return {
        layer,
        status: 'OFFLINE',
        health_score: 0,
        last_activity_at: null,
        record_count: 0,
        notes: `No records in ${config.table}`,
      }
    }

    // Get last activity
    const { data: latestRow } = await (supabaseAdmin as any)
      .from(config.table)
      .select(config.activityField)
      .eq('tenant_id', tenantId)
      .order(config.activityField, { ascending: false })
      .limit(1)
      .maybeSingle()

    const lastActivityAt = latestRow ? String((latestRow as Record<string, unknown>)[config.activityField] ?? '') : null

    let daysSinceActivity = Infinity
    if (lastActivityAt) {
      daysSinceActivity = (Date.now() - new Date(lastActivityAt).getTime()) / 86_400_000
    }

    let status: LayerStatus['status']
    let health_score: number
    let notes: string

    if (daysSinceActivity < 7) {
      status = 'OPERATIONAL'
      health_score = 100 - Math.round(daysSinceActivity * 5)  // slight decay within 7 days
      notes = `${recordCount} records, last activity ${daysSinceActivity.toFixed(1)} days ago`
    } else if (daysSinceActivity < 30) {
      status = 'DEGRADED'
      health_score = Math.max(20, 70 - Math.round((daysSinceActivity - 7) * 2))
      notes = `${recordCount} records, stale — last activity ${daysSinceActivity.toFixed(1)} days ago`
    } else {
      status = 'OFFLINE'
      health_score = 0
      notes = `${recordCount} records but no activity for ${daysSinceActivity.toFixed(0)} days`
    }

    return {
      layer,
      status,
      health_score: Math.max(0, Math.min(100, health_score)),
      last_activity_at: lastActivityAt,
      record_count: recordCount,
      notes,
    }
  } catch (e) {
    return {
      layer,
      status: 'NOT_CONFIGURED',
      health_score: 0,
      last_activity_at: null,
      record_count: 0,
      notes: `Unexpected error: ${e instanceof Error ? e.message : String(e)}`,
    }
  }
}

// ─── Get Market Infrastructure Status ─────────────────────────────────────────

/**
 * Runs all 10 layer checks, reads go_live_assessment, aggregates into full status.
 * Persists to market_infrastructure_status_logs.
 */
export async function getMarketInfrastructureStatus(
  tenantId: string,
): Promise<MarketInfrastructureStatus> {
  const generatedAt = new Date().toISOString()
  const statusId = crypto.randomUUID()

  const allLayers: InfrastructureLayer[] = [
    'SUPPLY', 'NORMALIZATION', 'OPPORTUNITY', 'CAPITAL',
    'DISTRIBUTION', 'EXECUTION', 'FEEDBACK', 'ML', 'REGULATORY', 'AUTHORITY',
  ]

  // Run all 10 layer checks in parallel
  const layerResults = await Promise.allSettled(
    allLayers.map(layer => checkLayerStatus(layer, tenantId)),
  )

  const layers: LayerStatus[] = layerResults.map((result, idx) => {
    if (result.status === 'fulfilled') return result.value
    return {
      layer: allLayers[idx],
      status: 'NOT_CONFIGURED' as const,
      health_score: 0,
      last_activity_at: null,
      record_count: 0,
      notes: `Check threw error: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`,
    }
  })

  // Get latest go-live assessment (don't run a fresh one — use cached or null)
  const latestAssessment = await getLatestAssessment(tenantId)

  // Aggregate layer counts
  const operational_layers = layers.filter(l => l.status === 'OPERATIONAL').length
  const degraded_layers = layers.filter(l => l.status === 'DEGRADED').length
  const offline_layers = layers.filter(l => l.status === 'OFFLINE' || l.status === 'NOT_CONFIGURED').length

  // Overall status
  let overall_status: MarketInfrastructureStatus['overall_status']
  if (operational_layers >= 8) overall_status = 'FULLY_OPERATIONAL'
  else if (operational_layers >= 5) overall_status = 'PARTIALLY_OPERATIONAL'
  else if (operational_layers >= 2) overall_status = 'DEGRADED'
  else overall_status = 'OFFLINE'

  // Overall health score = weighted avg of all layer health scores
  const overall_health_score = Math.round(
    layers.reduce((sum, l) => sum + l.health_score, 0) / layers.length,
  )

  // Key metrics from SUPPLY, NORMALIZATION, OPPORTUNITY, CAPITAL layers
  const supplyLayer = layers.find(l => l.layer === 'SUPPLY')
  const normLayer = layers.find(l => l.layer === 'NORMALIZATION')
  const oppLayer = layers.find(l => l.layer === 'OPPORTUNITY')
  const capitalLayer = layers.find(l => l.layer === 'CAPITAL')

  const total_supply_records = supplyLayer?.record_count ?? 0
  const total_canonical_assets = normLayer?.record_count ?? 0
  const total_active_opportunities = oppLayer?.record_count ?? 0
  const total_investors = capitalLayer?.record_count ?? 0

  // Total capital: read from investor_capital_profiles sum
  let total_capital_eur_cents = 0
  try {
    const { data: capitalData } = await (supabaseAdmin as any)
      .from('investor_capital_profiles')
      .select('available_capital_eur_cents')
      .eq('tenant_id', tenantId)
      .limit(10000)
    if (capitalData) {
      total_capital_eur_cents = (capitalData as { available_capital_eur_cents: number }[])
        .reduce((sum, r) => sum + (Number(r.available_capital_eur_cents) || 0), 0)
    }
  } catch {
    // Non-critical — keep 0
  }

  const status: MarketInfrastructureStatus = {
    status_id: statusId,
    tenant_id: tenantId,
    overall_status,
    overall_health_score,
    system_grade: latestAssessment?.system_grade ?? 'EARLY_STAGE',
    layers,
    operational_layers,
    degraded_layers,
    offline_layers,
    go_live_ready: latestAssessment?.go_live_ready ?? false,
    go_live_criteria_passed: latestAssessment?.pass_count ?? 0,
    total_supply_records,
    total_canonical_assets,
    total_active_opportunities,
    total_investors,
    total_capital_eur_cents,
    generated_at: generatedAt,
  }

  // Persist — fire-and-forget
  void (supabaseAdmin as any)
    .from('market_infrastructure_status_logs')
    .insert({
      status_id: statusId,
      tenant_id: tenantId,
      overall_status,
      overall_health_score,
      system_grade: status.system_grade,
      layers,
      operational_layers,
      degraded_layers,
      offline_layers,
      go_live_ready: status.go_live_ready,
      go_live_criteria_passed: status.go_live_criteria_passed,
      total_supply_records,
      total_canonical_assets,
      total_active_opportunities,
      total_investors,
      total_capital_eur_cents,
      generated_at: generatedAt,
    })
    .catch((e: unknown) => console.warn('[marketInfrastructureStatusEngine] persist failed', e))

  log.info('[marketInfrastructureStatusEngine] Status generated', {
    route: 'marketInfrastructureStatusEngine',
    overall_status,
    overall_health_score,
    operational_layers,
  })

  return status
}

// ─── Get Status History ───────────────────────────────────────────────────────

export async function getStatusHistory(
  tenantId: string,
  limit = 30,
): Promise<Array<{ generated_at: string; overall_status: string; health_score: number; operational_layers: number }>> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('market_infrastructure_status_logs')
      .select('generated_at, overall_status, overall_health_score, operational_layers')
      .eq('tenant_id', tenantId)
      .order('generated_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []

    return (data as Array<{
      generated_at: string
      overall_status: string
      overall_health_score: number
      operational_layers: number
    }>).map(row => ({
      generated_at: row.generated_at,
      overall_status: row.overall_status,
      health_score: Number(row.overall_health_score),
      operational_layers: row.operational_layers,
    }))
  } catch (e) {
    log.warn('[marketInfrastructureStatusEngine] getStatusHistory failed', { route: 'marketInfrastructureStatusEngine', error: String(e) })
    return []
  }
}

// Re-export runGoLiveAssessment for convenience (used by route)
export { runGoLiveAssessment, getLatestAssessment }
