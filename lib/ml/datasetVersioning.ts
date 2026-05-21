// Agency Group — ML Dataset Versioning
// lib/ml/datasetVersioning.ts
// TypeScript strict — 0 errors
//
// Dataset version lineage — tracks every training dataset that was created,
// its features, and which models were trained on it.
// Tables: dataset_versions, dataset_model_links

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import crypto from 'crypto'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DatasetVersion {
  id:                 string
  tenant_id:          string
  dataset_name:       string        // e.g. 'deal_outcomes_v3', 'profit_labels_2026_q2'
  version:            string        // semver-like: '1.0.0', '1.1.0'
  entity_types:       string[]
  feature_version:    string        // which featureStore version
  record_count:       number
  label_distribution: Record<string, number>  // e.g. { won: 120, lost: 85 }
  checksum:           string        // SHA-256 of the JSONL content
  storage_path:       string        // Supabase Storage path
  from_date:          string | null
  to_date:            string | null
  trained_model_ids:  string[]      // model IDs trained on this dataset
  created_at:         string
}

export interface DatasetLineage {
  dataset_id:             string
  dataset_version:        string
  model_id:               string | null
  model_name:             string | null
  model_version:          string | null
  training_started_at:    string | null
  training_completed_at:  string | null
  metrics_achieved:       Record<string, number>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function rowToDatasetVersion(row: Record<string, unknown>): DatasetVersion {
  return {
    id:                 row['id']           as string,
    tenant_id:          row['tenant_id']    as string,
    dataset_name:       row['dataset_name'] as string,
    version:            row['version']      as string,
    entity_types:       (row['entity_types'] as string[])                      ?? [],
    feature_version:    (row['feature_version'] as string)                     ?? 'v1',
    record_count:       (row['record_count'] as number)                        ?? 0,
    label_distribution: (row['label_distribution'] as Record<string, number>)  ?? {},
    checksum:           (row['checksum']      as string)                       ?? '',
    storage_path:       (row['storage_path']  as string)                       ?? '',
    from_date:          (row['from_date']     as string | null)                ?? null,
    to_date:            (row['to_date']       as string | null)                ?? null,
    trained_model_ids:  (row['trained_model_ids'] as string[])                 ?? [],
    created_at:         row['created_at']    as string,
  }
}

// ---------------------------------------------------------------------------
// computeNextVersion — always bumps minor version
// ---------------------------------------------------------------------------

export function computeNextVersion(existingVersions: string[]): string {
  if (existingVersions.length === 0) return '1.0.0'

  let maxMajor = 1
  let maxMinor = 0

  for (const v of existingVersions) {
    const parts = v.replace(/^v/, '').split('.').map(Number)
    const major = isNaN(parts[0]) ? 1 : parts[0]
    const minor = isNaN(parts[1]) ? 0 : parts[1]

    if (major > maxMajor || (major === maxMajor && minor > maxMinor)) {
      maxMajor = major
      maxMinor = minor
    }
  }

  return `${maxMajor}.${maxMinor + 1}.0`
}

// ---------------------------------------------------------------------------
// registerDatasetVersion — register a new dataset version after export
// ---------------------------------------------------------------------------

export async function registerDatasetVersion(
  tenantId: string,
  params: {
    dataset_name:       string
    version:            string
    entity_types:       string[]
    feature_version:    string
    record_count:       number
    label_distribution: Record<string, number>
    checksum:           string
    storage_path:       string
    from_date:          string | null
    to_date:            string | null
  },
): Promise<DatasetVersion> {
  const { data, error } = await (supabaseAdmin as any)
    .from('dataset_versions')
    .insert({
      tenant_id:          tenantId,
      dataset_name:       params.dataset_name,
      version:            params.version,
      entity_types:       params.entity_types,
      feature_version:    params.feature_version,
      record_count:       params.record_count,
      label_distribution: params.label_distribution,
      checksum:           params.checksum,
      storage_path:       params.storage_path,
      from_date:          params.from_date ?? null,
      to_date:            params.to_date   ?? null,
      trained_model_ids:  [],
    })
    .select()
    .single()

  if (error || !data) {
    log.error('[datasetVersioning] registerDatasetVersion — insert failed', undefined, {
      dataset_name: params.dataset_name,
      version:      params.version,
      error:        error?.message ?? 'no data returned',
    })
    throw new Error(`registerDatasetVersion failed: ${error?.message ?? 'no data returned'}`)
  }

  log.info('[datasetVersioning] registerDatasetVersion — registered', {
    id:           data.id,
    dataset_name: params.dataset_name,
    version:      params.version,
    record_count: params.record_count,
  } as any)

  return rowToDatasetVersion(data as Record<string, unknown>)
}

// ---------------------------------------------------------------------------
// linkModelToDataset — M:M link between a training run and a dataset version
// ---------------------------------------------------------------------------

export async function linkModelToDataset(
  tenantId:   string,
  datasetId:  string,
  modelId:    string,
  metrics:    Record<string, number>,
): Promise<void> {
  const now = new Date().toISOString()

  const { error: linkErr } = await (supabaseAdmin as any)
    .from('dataset_model_links')
    .insert({
      tenant_id:             tenantId,
      dataset_id:            datasetId,
      model_id:              modelId,
      training_started_at:   null,
      training_completed_at: now,
      metrics_achieved:      metrics,
    })

  if (linkErr) {
    log.error('[datasetVersioning] linkModelToDataset — insert failed', undefined, {
      dataset_id: datasetId,
      model_id:   modelId,
      error:      linkErr.message,
    })
    throw new Error(`linkModelToDataset failed: ${linkErr.message}`)
  }

  // Also append model_id to dataset_versions.trained_model_ids array
  const { data: current, error: fetchErr } = await (supabaseAdmin as any)
    .from('dataset_versions')
    .select('trained_model_ids')
    .eq('id', datasetId)
    .maybeSingle()

  if (!fetchErr && current) {
    const existingIds: string[] = (current.trained_model_ids as string[]) ?? []
    if (!existingIds.includes(modelId)) {
      await (supabaseAdmin as any)
        .from('dataset_versions')
        .update({ trained_model_ids: [...existingIds, modelId] })
        .eq('id', datasetId)
    }
  }

  log.info('[datasetVersioning] linkModelToDataset — linked', {
    dataset_id: datasetId,
    model_id:   modelId,
  } as any)
}

// ---------------------------------------------------------------------------
// getModelLineage — which datasets trained a given model
// ---------------------------------------------------------------------------

export async function getModelLineage(
  tenantId: string,
  modelId:  string,
): Promise<DatasetLineage[]> {
  try {
    // Join dataset_model_links → dataset_versions + ml_model_registry
    const { data, error } = await (supabaseAdmin as any)
      .from('dataset_model_links')
      .select(`
        dataset_id,
        model_id,
        training_started_at,
        training_completed_at,
        metrics_achieved,
        dataset_versions!inner(
          version,
          dataset_name
        ),
        ml_model_registry(
          model_name,
          version
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('model_id', modelId)
      .order('training_completed_at', { ascending: false })

    if (error) {
      log.error('[datasetVersioning] getModelLineage — query failed', undefined, {
        model_id: modelId,
        error:    error.message,
      })
      return []
    }

    return ((data ?? []) as Record<string, unknown>[]).map((row) => {
      const dv  = row['dataset_versions'] as Record<string, unknown> | null
      const reg = row['ml_model_registry'] as Record<string, unknown> | null
      return {
        dataset_id:            row['dataset_id']             as string,
        dataset_version:       (dv?.['version']              as string) ?? '',
        model_id:              (row['model_id']              as string | null) ?? null,
        model_name:            (reg?.['model_name']          as string | null) ?? null,
        model_version:         (reg?.['version']             as string | null) ?? null,
        training_started_at:   (row['training_started_at']   as string | null) ?? null,
        training_completed_at: (row['training_completed_at'] as string | null) ?? null,
        metrics_achieved:      (row['metrics_achieved']      as Record<string, number>) ?? {},
      } satisfies DatasetLineage
    })
  } catch (err) {
    log.error('[datasetVersioning] getModelLineage — unexpected error', err instanceof Error ? err : undefined, {
      model_id: modelId,
      error:    err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ---------------------------------------------------------------------------
// listDatasetVersions — all dataset versions for a tenant (optionally filtered)
// ---------------------------------------------------------------------------

export async function listDatasetVersions(
  tenantId:     string,
  datasetName?: string,
): Promise<DatasetVersion[]> {
  try {
    let query = (supabaseAdmin as any)
      .from('dataset_versions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(100)

    if (datasetName) {
      query = query.eq('dataset_name', datasetName)
    }

    const { data, error } = await query

    if (error) {
      log.error('[datasetVersioning] listDatasetVersions — query failed', undefined, {
        dataset_name: datasetName,
        error:        error.message,
      })
      return []
    }

    return ((data ?? []) as Record<string, unknown>[]).map(rowToDatasetVersion)
  } catch (err) {
    log.error('[datasetVersioning] listDatasetVersions — unexpected error', err instanceof Error ? err : undefined, {
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ---------------------------------------------------------------------------
// computeDatasetChecksum — SHA-256 of JSONL content (utility)
// ---------------------------------------------------------------------------

export function computeDatasetChecksum(jsonl: string): string {
  return crypto.createHash('sha256').update(jsonl).digest('hex')
}
