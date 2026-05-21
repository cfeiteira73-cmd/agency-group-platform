// Agency Group — Data Source Trust Scorer
// lib/data-trust/trustScorer.ts
// Per-source trust scoring based on freshness, consistency, validation pass rate.
// Sources: casafari, idealista, crm_manual, automation, ml_enrichment, external_api

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DataSource =
  | 'casafari'
  | 'idealista'
  | 'crm_manual'
  | 'automation'
  | 'ml_enrichment'
  | 'external_api'
  | 'internal'

export interface SourceTrustScore {
  source: DataSource
  trust_score: number
  freshness_score: number
  consistency_score: number
  validation_pass_rate: number
  last_seen_at: string | null
  record_count: number
  trend: 'IMPROVING' | 'STABLE' | 'DEGRADING'
}

export interface TrustReport {
  tenant_id: string
  generated_at: string
  sources: SourceTrustScore[]
  overall_trust_score: number
  least_trusted_source: DataSource | null
  recommendation: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALL_SOURCES: DataSource[] = [
  'casafari',
  'idealista',
  'crm_manual',
  'automation',
  'ml_enrichment',
  'external_api',
  'internal',
]

function freshnessScore(lastSeenAt: string | null): number {
  if (!lastSeenAt) return 0
  const ageMs = Date.now() - new Date(lastSeenAt).getTime()
  const ageHours = ageMs / (1000 * 60 * 60)
  if (ageHours <= 1) return 100
  if (ageHours <= 6) return 80
  if (ageHours <= 24) return 60
  if (ageHours <= 168) return 30 // 7 days
  return 0
}

/** Reads consistency from data_validation_results. Graceful fallback = 75. */
async function readConsistencyScore(
  tenantId: string,
  source: DataSource,
): Promise<number> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('data_validation_results')
      .select('consistency_score')
      .eq('tenant_id', tenantId)
      .eq('source_system', source)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return 75
    const score = Number((data as { consistency_score?: unknown }).consistency_score)
    return isNaN(score) ? 75 : Math.min(100, Math.max(0, score))
  } catch {
    return 75
  }
}

/**
 * Computes 7-day vs 30-day trust trend.
 * Returns IMPROVING / STABLE / DEGRADING based on delta.
 */
async function computeTrend(
  tenantId: string,
  source: DataSource,
): Promise<'IMPROVING' | 'STABLE' | 'DEGRADING'> {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  try {
    const [recent, older] = await Promise.all([
      (supabaseAdmin as any)
        .from('data_lineage_events')
        .select('timestamp, metadata')
        .eq('tenant_id', tenantId)
        .eq('source_system', source)
        .gte('timestamp', sevenDaysAgo)
        .order('timestamp', { ascending: false }),
      (supabaseAdmin as any)
        .from('data_lineage_events')
        .select('timestamp, metadata')
        .eq('tenant_id', tenantId)
        .eq('source_system', source)
        .gte('timestamp', thirtyDaysAgo)
        .lt('timestamp', sevenDaysAgo)
        .order('timestamp', { ascending: false }),
    ])

    const recentRows: Array<{ timestamp: string; metadata?: Record<string, unknown> }> =
      recent.data ?? []
    const olderRows: Array<{ timestamp: string; metadata?: Record<string, unknown> }> =
      older.data ?? []

    const passRate = (
      rows: Array<{ timestamp: string; metadata?: Record<string, unknown> }>,
    ): number => {
      if (rows.length === 0) return 0
      const valid = rows.filter(
        (r) => (r.metadata as Record<string, unknown>)?.['validation_status'] === 'valid',
      ).length
      return (valid / rows.length) * 100
    }

    const recentRate = passRate(recentRows)
    const olderRate = passRate(olderRows)

    if (olderRows.length === 0 && recentRows.length === 0) return 'STABLE'
    const delta = recentRate - olderRate
    if (delta > 5) return 'IMPROVING'
    if (delta < -5) return 'DEGRADING'
    return 'STABLE'
  } catch {
    return 'STABLE'
  }
}

// ─── computeSourceTrust ───────────────────────────────────────────────────────

/**
 * Computes per-source trust scores and persists to source_trust_reports.
 */
export async function computeSourceTrust(tenantId: string): Promise<TrustReport> {
  const generatedAt = new Date().toISOString()

  const sourceScores = await Promise.all(
    ALL_SOURCES.map(async (source): Promise<SourceTrustScore> => {
      // 1. Count + last_seen from data_lineage_events
      const { data: eventsData, error: eventsError } = await (supabaseAdmin as any)
        .from('data_lineage_events')
        .select('timestamp, metadata')
        .eq('tenant_id', tenantId)
        .eq('source_system', source)
        .order('timestamp', { ascending: false })

      if (eventsError) {
        log.warn('[trustScorer] events query failed', { error: eventsError, source })
      }

      const events: Array<{ timestamp: string; metadata?: Record<string, unknown> }> =
        (eventsData ?? []) as Array<{ timestamp: string; metadata?: Record<string, unknown> }>

      const record_count = events.length
      const last_seen_at = events.length > 0 ? events[0].timestamp : null

      // 2. freshness_score
      const fScore = freshnessScore(last_seen_at)

      // 3. consistency_score
      const cScore = await readConsistencyScore(tenantId, source)

      // 4. validation_pass_rate
      const validCount = events.filter(
        (e) =>
          (e.metadata as Record<string, unknown>)?.['validation_status'] === 'valid',
      ).length
      const vRate =
        record_count > 0 ? Math.round((validCount / record_count) * 100) : 0

      // 5. trust_score = freshness×0.4 + consistency×0.35 + validation×0.25
      const trust_score = Math.round(fScore * 0.4 + cScore * 0.35 + vRate * 0.25)

      // 6. trend
      const trend = await computeTrend(tenantId, source)

      return {
        source,
        trust_score,
        freshness_score: fScore,
        consistency_score: cScore,
        validation_pass_rate: vRate,
        last_seen_at,
        record_count,
        trend,
      }
    }),
  )

  const overall_trust_score =
    sourceScores.length > 0
      ? Math.round(
          sourceScores.reduce((acc, s) => acc + s.trust_score, 0) / sourceScores.length,
        )
      : 0

  const leastTrusted = sourceScores.reduce<SourceTrustScore | null>((min, s) => {
    if (!min) return s
    return s.trust_score < min.trust_score ? s : min
  }, null)

  const least_trusted_source = leastTrusted?.source ?? null

  const recommendation =
    leastTrusted && leastTrusted.trust_score < 50
      ? `Immediate attention required: source '${leastTrusted.source}' has trust score ${leastTrusted.trust_score}. Check ingestion pipeline and validation rules.`
      : overall_trust_score < 70
        ? 'Overall data trust is below threshold. Review staleness and consistency metrics across all sources.'
        : 'Data trust is healthy. Continue monitoring freshness and validation rates.'

  const report: TrustReport = {
    tenant_id: tenantId,
    generated_at: generatedAt,
    sources: sourceScores,
    overall_trust_score,
    least_trusted_source,
    recommendation,
  }

  // Persist to source_trust_reports (fire-and-forget)
  void (supabaseAdmin as any)
    .from('source_trust_reports')
    .insert({
      tenant_id: tenantId,
      generated_at: generatedAt,
      overall_trust_score,
      least_trusted_source,
      recommendation,
      sources: sourceScores,
    })
    .then(({ error }: { error: unknown }) => {
      if (error) log.warn('[trustScorer] persist failed', { error })
    })
    .catch((e: unknown) => console.warn('[trustScorer]', e))

  return report
}
