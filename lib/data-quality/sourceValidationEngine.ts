// =============================================================================
// Agency Group — SH-ROS | AMI: 22506
// Source Validation Engine — Every data point carries source lineage + trust
// Wave 44 Agent 6 — Production Lock
// =============================================================================

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

let log: { info: (m: string, c?: Record<string, unknown>) => void; warn: (m: string, c?: Record<string, unknown>) => void; error: (m: string, c?: Record<string, unknown>) => void }
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { logger } = require('@/lib/observability/logger')
  log = logger
} catch {
  log = {
    info: (m: string, c?: Record<string, unknown>) => console.log('[source-validation]', m, c ?? {}),
    warn: (m: string, c?: Record<string, unknown>) => console.warn('[source-validation]', m, c ?? {}),
    error: (m: string, c?: Record<string, unknown>) => console.error('[source-validation]', m, c ?? {}),
  }
}

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ── Types ──────────────────────────────────────────────────────────────────────

export type DataSource =
  | 'IDEALISTA_PT' | 'IDEALISTA_ES'
  | 'CASAFARI' | 'CITIUS'
  | 'BANK_NPL' | 'BROKER_CRM'
  | 'PUBLIC_REGISTRY' | 'INE' | 'AT' | 'REGISTO_PREDIAL'
  | 'MANUAL_ENTRY' | 'UNKNOWN'

export const SOURCE_TRUST_SCORES: Record<DataSource, number> = {
  PUBLIC_REGISTRY: 0.98,
  REGISTO_PREDIAL: 0.97,
  AT: 0.96,
  INE: 0.95,
  CITIUS: 0.92,
  BANK_NPL: 0.90,
  IDEALISTA_PT: 0.85,
  IDEALISTA_ES: 0.85,
  CASAFARI: 0.82,
  BROKER_CRM: 0.75,
  MANUAL_ENTRY: 0.60,
  UNKNOWN: 0.10,
}

export interface ValidatedDataPoint {
  data_id: string
  source: DataSource
  source_id: string
  trust_score: number
  legal_origin_flag: boolean
  timestamp: string
  ingested_at: string
  tenant_id: string
  payload_hash: string
  validation_status: 'VALID' | 'REJECTED' | 'PENDING_VERIFICATION'
  rejection_reason: string | null
}

export interface ValidationResult {
  valid: boolean
  trust_score: number
  legal_origin_flag: boolean
  rejection_reason: string | null
  warnings: string[]
}

// ── Core: validate (pure synchronous) ──────────────────────────────────────────

export function validateDataPoint(
  source: DataSource,
  sourceId: string,
  timestamp: string,
  payload: Record<string, unknown>,
): ValidationResult {
  const warnings: string[] = []
  const trust_score = SOURCE_TRUST_SCORES[source]
  const legal_origin_flag = trust_score >= 0.90

  // Reject unknown source
  if (source === 'UNKNOWN') {
    return {
      valid: false,
      trust_score,
      legal_origin_flag,
      rejection_reason: 'UNVERIFIABLE_SOURCE',
      warnings,
    }
  }

  // Reject invalid or future timestamp
  const ts = new Date(timestamp)
  if (isNaN(ts.getTime())) {
    return {
      valid: false,
      trust_score,
      legal_origin_flag,
      rejection_reason: 'INVALID_TIMESTAMP',
      warnings,
    }
  }
  const nowPlusOneHour = Date.now() + 60 * 60 * 1000
  if (ts.getTime() > nowPlusOneHour) {
    return {
      valid: false,
      trust_score,
      legal_origin_flag,
      rejection_reason: 'FUTURE_TIMESTAMP',
      warnings,
    }
  }

  // Reject empty payload
  if (Object.keys(payload).length === 0) {
    return {
      valid: false,
      trust_score,
      legal_origin_flag,
      rejection_reason: 'EMPTY_PAYLOAD',
      warnings,
    }
  }

  // Warnings
  if (trust_score < 0.75) warnings.push('LOW_TRUST_SOURCE')
  if (!legal_origin_flag) warnings.push('NO_LEGAL_ORIGIN')

  // Suppress unused param warning
  void sourceId

  return { valid: true, trust_score, legal_origin_flag, rejection_reason: null, warnings }
}

// ── Ingest: persist to DB ──────────────────────────────────────────────────────

export async function ingestValidatedPoint(
  source: DataSource,
  sourceId: string,
  timestamp: string,
  payload: Record<string, unknown>,
  tenantId: string = TENANT_ID,
): Promise<ValidatedDataPoint | null> {
  const validation = validateDataPoint(source, sourceId, timestamp, payload)
  const payloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex')
  const dataId = randomUUID()
  const ingestedAt = new Date().toISOString()

  const point: ValidatedDataPoint = {
    data_id: dataId,
    source,
    source_id: sourceId,
    trust_score: validation.trust_score,
    legal_origin_flag: validation.legal_origin_flag,
    timestamp,
    ingested_at: ingestedAt,
    tenant_id: tenantId,
    payload_hash: payloadHash,
    validation_status: validation.valid ? 'VALID' : 'REJECTED',
    rejection_reason: validation.rejection_reason,
  }

  void (supabaseAdmin as any).from('validated_data_points').insert({
    data_id: point.data_id,
    tenant_id: point.tenant_id,
    source: point.source,
    source_id: point.source_id,
    trust_score: point.trust_score,
    legal_origin_flag: point.legal_origin_flag,
    timestamp: point.timestamp,
    ingested_at: point.ingested_at,
    payload_hash: point.payload_hash,
    validation_status: point.validation_status,
    rejection_reason: point.rejection_reason,
  }).catch((e: unknown) => console.warn('[source-validation] insert error', e))

  if (!validation.valid) {
    log.warn('Data point rejected', {
      source,
      source_id: sourceId,
      reason: validation.rejection_reason,
    })
    return null
  }

  if (validation.warnings.length > 0) {
    log.warn('Data point ingested with warnings', { source, warnings: validation.warnings })
  }

  return point
}

// ── Source quality report ──────────────────────────────────────────────────────

export async function getSourceQualityReport(
  tenantId: string = TENANT_ID,
): Promise<Array<{
  source: DataSource
  total_ingested: number
  rejection_rate_pct: number
  avg_trust_score: number
  legal_origin_pct: number
}>> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('validated_data_points')
      .select('source, validation_status, trust_score, legal_origin_flag')
      .eq('tenant_id', tenantId)

    if (error || !data) {
      log.warn('getSourceQualityReport query failed', { error })
      return []
    }

    // Group by source
    const grouped: Record<string, { total: number; rejected: number; trustSum: number; legalCount: number }> = {}
    for (const row of data as Array<{ source: string; validation_status: string; trust_score: number; legal_origin_flag: boolean }>) {
      if (!grouped[row.source]) {
        grouped[row.source] = { total: 0, rejected: 0, trustSum: 0, legalCount: 0 }
      }
      grouped[row.source].total++
      if (row.validation_status === 'REJECTED') grouped[row.source].rejected++
      grouped[row.source].trustSum += row.trust_score ?? 0
      if (row.legal_origin_flag) grouped[row.source].legalCount++
    }

    return Object.entries(grouped).map(([src, stats]) => ({
      source: src as DataSource,
      total_ingested: stats.total,
      rejection_rate_pct: stats.total > 0 ? (stats.rejected / stats.total) * 100 : 0,
      avg_trust_score: stats.total > 0 ? stats.trustSum / stats.total : 0,
      legal_origin_pct: stats.total > 0 ? (stats.legalCount / stats.total) * 100 : 0,
    }))
  } catch (e) {
    log.error('getSourceQualityReport exception', { error: String(e) })
    return []
  }
}

// ── Reject unverifiable sources ────────────────────────────────────────────────

export async function rejectUnverifiableSources(
  tenantId: string = TENANT_ID,
  dryRun = false,
): Promise<{ affected: number; sources: string[] }> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('validated_data_points')
      .select('id, source')
      .eq('tenant_id', tenantId)
      .eq('validation_status', 'VALID')
      .or('source.eq.UNKNOWN,trust_score.lt.0.50')

    if (error || !data) {
      log.warn('rejectUnverifiableSources query failed', { error })
      return { affected: 0, sources: [] }
    }

    const rows = data as Array<{ id: string; source: string }>
    const affected = rows.length
    const sources = [...new Set(rows.map(r => r.source))]

    if (!dryRun && affected > 0) {
      const ids = rows.map(r => r.id)
      void (supabaseAdmin as any)
        .from('validated_data_points')
        .update({ validation_status: 'REJECTED', rejection_reason: 'RETROACTIVE_UNVERIFIABLE' })
        .in('id', ids)
        .catch((e: unknown) => console.warn('[source-validation] bulk reject error', e))
    }

    log.info('rejectUnverifiableSources', { affected, sources, dryRun })
    return { affected, sources }
  } catch (e) {
    log.error('rejectUnverifiableSources exception', { error: String(e) })
    return { affected: 0, sources: [] }
  }
}
