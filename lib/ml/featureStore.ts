// =============================================================================
// Agency Group — ML Feature Store
// lib/ml/featureStore.ts
//
// Versioned feature store with tenant isolation and historical snapshots.
// Single source of truth for feature vectors consumed by the scoring pipeline.
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FeatureVector {
  entity_type: 'property' | 'investor' | 'deal' | 'match'
  entity_id: string
  tenant_id: string
  feature_version: string       // 'v1', 'v2', etc.
  features: Record<string, number | string | boolean | null>
  computed_at: string
  is_latest: boolean
  ttl_expires_at: string | null  // null = permanent
}

export interface FeatureDefinition {
  name: string
  entity_types: string[]
  data_type: 'numeric' | 'categorical' | 'boolean'
  description: string
  normalization?: 'min_max' | 'z_score' | 'log' | 'none'
  min?: number
  max?: number
}

// ---------------------------------------------------------------------------
// Feature Registry
// ---------------------------------------------------------------------------

export const FEATURE_DEFINITIONS: FeatureDefinition[] = [
  // Property features
  {
    name: 'price_eur',
    entity_types: ['property'],
    data_type: 'numeric',
    description: 'Listing price in EUR',
    normalization: 'log',
  },
  {
    name: 'price_per_m2',
    entity_types: ['property'],
    data_type: 'numeric',
    description: 'Price per square metre in EUR',
    normalization: 'z_score',
  },
  {
    name: 'area_m2',
    entity_types: ['property'],
    data_type: 'numeric',
    description: 'Usable area in m²',
    normalization: 'log',
  },
  {
    name: 'days_listed',
    entity_types: ['property'],
    data_type: 'numeric',
    description: 'Calendar days since listing creation',
    normalization: 'log',
  },
  {
    name: 'bedrooms',
    entity_types: ['property'],
    data_type: 'numeric',
    description: 'Number of bedrooms',
    normalization: 'min_max',
    min: 0,
    max: 10,
  },
  {
    name: 'estimated_yield_pct',
    entity_types: ['property'],
    data_type: 'numeric',
    description: 'Estimated gross rental yield (%)',
    normalization: 'min_max',
    min: 0,
    max: 20,
  },
  {
    name: 'freshness_score',
    entity_types: ['property'],
    data_type: 'numeric',
    description: 'Signal freshness 0–100 (higher = recently updated)',
    normalization: 'min_max',
    min: 0,
    max: 100,
  },
  {
    name: 'demand_score',
    entity_types: ['property'],
    data_type: 'numeric',
    description: 'Demand signal 0–100 based on view/contact velocity',
    normalization: 'min_max',
    min: 0,
    max: 100,
  },
  {
    name: 'fraud_risk_score',
    entity_types: ['property'],
    data_type: 'numeric',
    description: 'Fraud risk 0–100 (lower = safer)',
    normalization: 'min_max',
    min: 0,
    max: 100,
  },
  // Investor features
  {
    name: 'capital_available_eur',
    entity_types: ['investor'],
    data_type: 'numeric',
    description: 'Capital available for deployment in EUR',
    normalization: 'log',
  },
  {
    name: 'portfolio_size',
    entity_types: ['investor'],
    data_type: 'numeric',
    description: 'Number of properties in active portfolio',
    normalization: 'log',
  },
  {
    name: 'avg_yield_target_pct',
    entity_types: ['investor'],
    data_type: 'numeric',
    description: 'Target yield percentage',
    normalization: 'none',
  },
  {
    name: 'network_score',
    entity_types: ['investor'],
    data_type: 'numeric',
    description: 'Network influence score 0–100',
    normalization: 'min_max',
    min: 0,
    max: 100,
  },
  {
    name: 'conversion_rate_30d',
    entity_types: ['investor'],
    data_type: 'numeric',
    description: 'Ratio of deals closed vs matches in last 30 days',
    normalization: 'min_max',
    min: 0,
    max: 1,
  },
  // Deal features
  {
    name: 'deal_value_eur',
    entity_types: ['deal'],
    data_type: 'numeric',
    description: 'Deal value in EUR',
    normalization: 'log',
  },
  {
    name: 'days_in_pipeline',
    entity_types: ['deal'],
    data_type: 'numeric',
    description: 'Days since deal creation',
    normalization: 'log',
  },
  {
    name: 'match_score',
    entity_types: ['deal'],
    data_type: 'numeric',
    description: 'Investor-property match score 0–100',
    normalization: 'min_max',
    min: 0,
    max: 100,
  },
]

// ---------------------------------------------------------------------------
// Internal: lookup feature definition by name
// ---------------------------------------------------------------------------

function getDefinition(name: string): FeatureDefinition | undefined {
  return FEATURE_DEFINITIONS.find(d => d.name === name)
}

// ---------------------------------------------------------------------------
// getLatestFeatures
// Returns the most recent feature vector for an entity, or null if none.
// ---------------------------------------------------------------------------

export async function getLatestFeatures(
  entityType: string,
  entityId: string,
  tenantId: string,
): Promise<FeatureVector | null> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('ml_feature_snapshots')
      .select('entity_type, entity_id, tenant_id, feature_version, features, computed_at, is_latest, ttl_expires_at')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('tenant_id', tenantId)
      .eq('is_latest', true)
      .order('computed_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      log.error('[featureStore] getLatestFeatures — query failed', undefined, {
        error: error.message,
        entity_type: entityType,
        entity_id: entityId,
      })
      return null
    }

    if (!data) return null

    return {
      entity_type:    data.entity_type as FeatureVector['entity_type'],
      entity_id:      data.entity_id,
      tenant_id:      data.tenant_id,
      feature_version: data.feature_version ?? 'v1',
      features:       (data.features ?? {}) as Record<string, number | string | boolean | null>,
      computed_at:    data.computed_at,
      is_latest:      data.is_latest ?? true,
      ttl_expires_at: data.ttl_expires_at ?? null,
    }
  } catch (err) {
    log.error('[featureStore] getLatestFeatures — unexpected error', err instanceof Error ? err : undefined, {
      error: err instanceof Error ? err.message : String(err),
      entity_type: entityType,
      entity_id: entityId,
    })
    return null
  }
}

// ---------------------------------------------------------------------------
// saveFeatures
// Upserts the feature vector as is_latest=true and demotes previous records.
// ---------------------------------------------------------------------------

export async function saveFeatures(
  entityType: string,
  entityId: string,
  tenantId: string,
  features: Record<string, unknown>,
  featureVersion: string = 'v1',
): Promise<void> {
  try {
    const db = supabaseAdmin as any

    // 1. Demote all previous is_latest snapshots for this entity
    const { error: demoteErr } = await db
      .from('ml_feature_snapshots')
      .update({ is_latest: false })
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .eq('tenant_id', tenantId)
      .eq('is_latest', true)

    if (demoteErr) {
      log.error('[featureStore] saveFeatures — demote failed (continuing)', undefined, {
        error: demoteErr.message,
        entity_type: entityType,
        entity_id: entityId,
      })
    }

    // 2. Insert new snapshot as is_latest=true
    const { error: insertErr } = await db
      .from('ml_feature_snapshots')
      .insert({
        tenant_id:       tenantId,
        entity_type:     entityType,
        entity_id:       entityId,
        features,
        feature_version: featureVersion,
        is_latest:       true,
        computed_at:     new Date().toISOString(),
      })

    if (insertErr) {
      log.error('[featureStore] saveFeatures — insert failed', undefined, {
        error: insertErr.message,
        entity_type: entityType,
        entity_id: entityId,
      })
    }
  } catch (err) {
    log.error('[featureStore] saveFeatures — unexpected error', err instanceof Error ? err : undefined, {
      error: err instanceof Error ? err.message : String(err),
      entity_type: entityType,
      entity_id: entityId,
    })
  }
}

// ---------------------------------------------------------------------------
// normalizeFeature
// Applies the normalization strategy defined for a feature.
// ---------------------------------------------------------------------------

export function normalizeFeature(
  value: number,
  definition: FeatureDefinition,
  stats?: { mean: number; std: number; min: number; max: number },
): number {
  const strategy = definition.normalization ?? 'none'

  switch (strategy) {
    case 'log': {
      // log1p for numerical stability with 0 values
      return Math.log1p(Math.max(0, value))
    }
    case 'min_max': {
      const min = stats?.min ?? definition.min ?? 0
      const max = stats?.max ?? definition.max ?? 1
      if (max === min) return 0
      return Math.min(1, Math.max(0, (value - min) / (max - min)))
    }
    case 'z_score': {
      if (!stats || stats.std === 0) return 0
      return (value - stats.mean) / stats.std
    }
    case 'none':
    default:
      return value
  }
}

// ---------------------------------------------------------------------------
// denormalizeFeature
// Inverts the normalization to recover the original value.
// ---------------------------------------------------------------------------

export function denormalizeFeature(
  normalizedValue: number,
  definition: FeatureDefinition,
  stats?: { mean: number; std: number; min: number; max: number },
): number {
  const strategy = definition.normalization ?? 'none'

  switch (strategy) {
    case 'log': {
      // inverse of log1p
      return Math.expm1(normalizedValue)
    }
    case 'min_max': {
      const min = stats?.min ?? definition.min ?? 0
      const max = stats?.max ?? definition.max ?? 1
      return normalizedValue * (max - min) + min
    }
    case 'z_score': {
      if (!stats) return normalizedValue
      return normalizedValue * stats.std + stats.mean
    }
    case 'none':
    default:
      return normalizedValue
  }
}

// ---------------------------------------------------------------------------
// getFeatureStats
// Computes descriptive statistics from the last 10,000 snapshots for a
// given entity type + feature combination. Used for z-score normalization.
// ---------------------------------------------------------------------------

export async function getFeatureStats(
  entityType: string,
  featureName: string,
  tenantId: string,
): Promise<{ mean: number; std: number; min: number; max: number; count: number } | null> {
  const def = getDefinition(featureName)
  if (!def) return null

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('ml_feature_snapshots')
      .select('features')
      .eq('entity_type', entityType)
      .eq('tenant_id', tenantId)
      .order('computed_at', { ascending: false })
      .limit(10000)

    if (error) {
      log.error('[featureStore] getFeatureStats — query failed', undefined, {
        error: error.message,
        entity_type: entityType,
        feature: featureName,
      })
      return null
    }

    const rows: Array<{ features: Record<string, unknown> }> = data ?? []
    const values: number[] = []

    for (const row of rows) {
      const raw = row.features?.[featureName]
      if (typeof raw === 'number' && isFinite(raw)) {
        values.push(raw)
      }
    }

    if (values.length === 0) return null

    const count = values.length
    const min   = Math.min(...values)
    const max   = Math.max(...values)
    const mean  = values.reduce((s, v) => s + v, 0) / count
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / count
    const std   = Math.sqrt(variance)

    return { mean, std, min, max, count }
  } catch (err) {
    log.error('[featureStore] getFeatureStats — unexpected error', err instanceof Error ? err : undefined, {
      error: err instanceof Error ? err.message : String(err),
      entity_type: entityType,
      feature: featureName,
    })
    return null
  }
}
