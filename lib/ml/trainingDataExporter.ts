// Agency Group — ML Training Data Exporter
// lib/ml/trainingDataExporter.ts
// TypeScript strict — 0 errors
//
// Exports labeled feature snapshots as JSONL training data.
// Output format compatible with XGBoost/LightGBM Python pipelines.
// Does NOT train models — exports data for external training job.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

export interface TrainingRecord {
  id: string
  entity_type: string
  entity_id: string
  features: Record<string, unknown>
  label_outcome: string
  label_value: number   // 0.0 or 1.0
  feature_version: string
  computed_at: string
}

export interface ExportResult {
  tenant_id: string
  records_exported: number
  entity_types: string[]
  from_date: string
  to_date: string
  exported_at: string
  jsonl: string          // newline-delimited JSON string, one record per line
}

// ---------------------------------------------------------------------------
// exportTrainingData
// Export all labeled training records for a tenant.
// fromDate: ISO date — only include records after this date.
// ---------------------------------------------------------------------------

export async function exportTrainingData(tenantId: string, fromDate?: string): Promise<ExportResult> {
  const exportedAt = new Date().toISOString()

  const emptyResult: ExportResult = {
    tenant_id:        tenantId,
    records_exported: 0,
    entity_types:     [],
    from_date:        fromDate ?? '',
    to_date:          exportedAt,
    exported_at:      exportedAt,
    jsonl:            '',
  }

  try {
    let query = (supabaseAdmin as any)
      .from('ml_feature_snapshots')
      .select('id, entity_type, entity_id, features, label_outcome, label_value, feature_version, computed_at')
      .eq('tenant_id', tenantId)
      .not('label_outcome', 'is', null)
      .order('computed_at', { ascending: true })
      .limit(10000)

    if (fromDate) {
      query = query.gte('computed_at', fromDate)
    }

    const { data, error } = await query

    if (error) {
      log.error('[trainingDataExporter] exportTrainingData — query failed', undefined, { error: error.message })
      return emptyResult
    }

    const rows: Array<{
      id: string
      entity_type: string
      entity_id: string
      features: Record<string, unknown>
      label_outcome: string
      label_value: number
      feature_version: string
      computed_at: string
    }> = data ?? []

    if (rows.length === 0) return emptyResult

    const entityTypeSet = new Set<string>()
    const jsonlLines: string[] = []

    for (const row of rows) {
      entityTypeSet.add(row.entity_type)
      const record: TrainingRecord = {
        id:              row.id,
        entity_type:     row.entity_type,
        entity_id:       row.entity_id,
        features:        row.features ?? {},
        label_outcome:   row.label_outcome,
        label_value:     row.label_value ?? 0,
        feature_version: row.feature_version ?? 'v1',
        computed_at:     row.computed_at,
      }
      jsonlLines.push(JSON.stringify(record))
    }

    const dates = rows.map(r => r.computed_at).sort()

    return {
      tenant_id:        tenantId,
      records_exported: rows.length,
      entity_types:     Array.from(entityTypeSet),
      from_date:        fromDate ?? (dates[0] ?? ''),
      to_date:          dates[dates.length - 1] ?? exportedAt,
      exported_at:      exportedAt,
      jsonl:            jsonlLines.join('\n'),
    }
  } catch (err) {
    log.error('[trainingDataExporter] exportTrainingData — unexpected error', err instanceof Error ? err : undefined, { error: err instanceof Error ? err.message : String(err) })
    return emptyResult
  }
}

// ---------------------------------------------------------------------------
// getExportStats
// Get export statistics without exporting.
// ---------------------------------------------------------------------------

export async function getExportStats(tenantId: string): Promise<{
  labeled_records: number
  unlabeled_records: number
  entity_breakdown: Record<string, number>
  ready_for_training: boolean   // true if labeled_records >= 50
  min_records_needed: number    // 50
}> {
  const MIN_RECORDS = 50

  const empty = {
    labeled_records:   0,
    unlabeled_records: 0,
    entity_breakdown:  {},
    ready_for_training: false,
    min_records_needed: MIN_RECORDS,
  }

  try {
    // Count labeled records
    const { count: labeledCount, error: labeledErr } = await (supabaseAdmin as any)
      .from('ml_feature_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .not('label_outcome', 'is', null)

    if (labeledErr) {
      log.error('[trainingDataExporter] getExportStats — labeled count failed', undefined, { error: labeledErr.message })
      return empty
    }

    // Count unlabeled records
    const { count: unlabeledCount, error: unlabeledErr } = await (supabaseAdmin as any)
      .from('ml_feature_snapshots')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .is('label_outcome', null)

    if (unlabeledErr) {
      log.error('[trainingDataExporter] getExportStats — unlabeled count failed', undefined, { error: unlabeledErr.message })
    }

    // Entity breakdown (labeled only)
    const { data: breakdownData, error: breakdownErr } = await (supabaseAdmin as any)
      .from('ml_feature_snapshots')
      .select('entity_type, label_outcome')
      .eq('tenant_id', tenantId)
      .not('label_outcome', 'is', null)
      .limit(10000)

    if (breakdownErr) {
      log.error('[trainingDataExporter] getExportStats — breakdown query failed', undefined, { error: breakdownErr.message })
    }

    const entity_breakdown: Record<string, number> = {}
    const breakdownRows: { entity_type: string }[] = breakdownData ?? []
    for (const row of breakdownRows) {
      entity_breakdown[row.entity_type] = (entity_breakdown[row.entity_type] ?? 0) + 1
    }

    const labeled = labeledCount ?? 0

    return {
      labeled_records:    labeled,
      unlabeled_records:  unlabeledCount ?? 0,
      entity_breakdown,
      ready_for_training: labeled >= MIN_RECORDS,
      min_records_needed: MIN_RECORDS,
    }
  } catch (err) {
    log.error('[trainingDataExporter] getExportStats — unexpected error', err instanceof Error ? err : undefined, { error: err instanceof Error ? err.message : String(err) })
    return empty
  }
}
