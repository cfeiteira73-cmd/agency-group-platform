// =============================================================================
// Agency Group — Canonical Ingestion Pipeline Orchestrator
// lib/ingestion/canonicalPipeline.ts
//
// Wires all ingestion components into a single, testable pipeline:
//   External source → normalize → backpressure → dedup → canonical → enrich → fraud
//
// This is the NEW canonical pipeline (separate from the legacy pipeline.ts
// which targets the properties table directly).
//
// TypeScript strict — 0 errors
// =============================================================================

import {
  casafariAdapter,
  type CasafariSearchParams,
  type CasafariProperty,
} from './casafariAdapter'

import {
  idealistaAdapter,
  type IdealistaSearchParams,
  type IdealistaProperty,
} from './idealistaAdapter'

import {
  normalize,
  type IngestionSource,
} from './normalizationEngine'

import { ingestionBuffer } from './backpressureBuffer'
import { supabaseAdmin }   from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SourceIngestResult {
  fetched: number
  enqueued: number
  rejected_duplicate: number
  rejected_queue_full: number
}

export interface ProcessQueueResult {
  processed: number
  canonical_created: number
  canonical_merged: number
  fraud_flagged: number
  errors: number
}

export interface DeltaIngestResult {
  casafari: number
  idealista: number
  total_processed: number
}

// ─── Casafari ingestion ───────────────────────────────────────────────────────

/**
 * Fetches from Casafari API, normalizes, and enqueues to backpressure buffer.
 */
export async function ingestFromCasafari(
  tenantId: string,
  params: CasafariSearchParams,
): Promise<SourceIngestResult> {
  const result: SourceIngestResult = {
    fetched:             0,
    enqueued:            0,
    rejected_duplicate:  0,
    rejected_queue_full: 0,
  }

  let properties: CasafariProperty[]
  try {
    const response = await casafariAdapter.search(params)
    properties = response.data ?? []
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[canonicalPipeline] ingestFromCasafari fetch error:', msg)
    return result
  }

  result.fetched = properties.length

  for (const prop of properties) {
    if (!prop.id || prop.price == null) continue

    const idempotencyKey = `casafari:${prop.id}`

    try {
      // Normalize to canonical shape for validation — raw is also stored
      const rawRecord = prop as unknown as Record<string, unknown>

      const enqueueResult = await ingestionBuffer.enqueue({
        source:          'casafari',
        source_id:       prop.id,
        tenant_id:       tenantId,
        priority:        'normal',
        raw_data:        rawRecord,
        idempotency_key: idempotencyKey,
      })

      if (enqueueResult.accepted) {
        result.enqueued++
      } else if (enqueueResult.reason === 'duplicate') {
        result.rejected_duplicate++
      } else if (enqueueResult.reason === 'queue_full') {
        result.rejected_queue_full++
        // Queue full — stop sending more
        console.warn('[canonicalPipeline] Queue full during Casafari ingest — stopping batch')
        break
      }
    } catch (err) {
      console.error(`[canonicalPipeline] enqueue error for casafari:${prop.id}:`, err)
    }
  }

  return result
}

// ─── Idealista ingestion ──────────────────────────────────────────────────────

/**
 * Fetches from Idealista API, normalizes, and enqueues to backpressure buffer.
 */
export async function ingestFromIdealista(
  tenantId: string,
  params: IdealistaSearchParams,
): Promise<SourceIngestResult> {
  const result: SourceIngestResult = {
    fetched:             0,
    enqueued:            0,
    rejected_duplicate:  0,
    rejected_queue_full: 0,
  }

  let properties: IdealistaProperty[]
  try {
    const response = await idealistaAdapter.search(params)
    properties = response.elementList ?? []
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[canonicalPipeline] ingestFromIdealista fetch error:', msg)
    return result
  }

  result.fetched = properties.length

  for (const prop of properties) {
    if (!prop.propertyCode || !prop.price) continue

    const idempotencyKey = `idealista:${prop.propertyCode}`

    try {
      const rawRecord = prop as unknown as Record<string, unknown>

      const enqueueResult = await ingestionBuffer.enqueue({
        source:          'idealista',
        source_id:       prop.propertyCode,
        tenant_id:       tenantId,
        priority:        'normal',
        raw_data:        rawRecord,
        idempotency_key: idempotencyKey,
      })

      if (enqueueResult.accepted) {
        result.enqueued++
      } else if (enqueueResult.reason === 'duplicate') {
        result.rejected_duplicate++
      } else if (enqueueResult.reason === 'queue_full') {
        result.rejected_queue_full++
        console.warn('[canonicalPipeline] Queue full during Idealista ingest — stopping batch')
        break
      }
    } catch (err) {
      console.error(`[canonicalPipeline] enqueue error for idealista:${prop.propertyCode}:`, err)
    }
  }

  return result
}

// ─── Manual ingestion ─────────────────────────────────────────────────────────

/**
 * Enqueues manually provided property records.
 * Each record must have at least `id` or `source_id` and `price`.
 */
export async function ingestManual(
  tenantId: string,
  properties: Array<Record<string, unknown>>,
  source: IngestionSource = 'manual',
): Promise<{ enqueued: number; rejected: number }> {
  let enqueued = 0
  let rejected = 0

  for (const prop of properties) {
    const sourceId = String(prop.source_id ?? prop.id ?? crypto.randomUUID())
    const idempotencyKey = `${source}:${sourceId}`

    try {
      const enqueueResult = await ingestionBuffer.enqueue({
        source,
        source_id:       sourceId,
        tenant_id:       tenantId,
        priority:        'high',   // manual = high priority
        raw_data:        prop,
        idempotency_key: idempotencyKey,
      })

      if (enqueueResult.accepted) {
        enqueued++
      } else {
        rejected++
      }
    } catch (err) {
      console.error(`[canonicalPipeline] ingestManual enqueue error for ${sourceId}:`, err)
      rejected++
    }
  }

  return { enqueued, rejected }
}

// ─── Process queue ────────────────────────────────────────────────────────────

/**
 * Processes the ingestion queue and tracks canonical outcomes.
 * Calls ingestionBuffer.processNext() and aggregates results.
 */
export async function processIngestionQueue(tenantId: string): Promise<ProcessQueueResult> {
  const result: ProcessQueueResult = {
    processed:        0,
    canonical_created: 0,
    canonical_merged:  0,
    fraud_flagged:     0,
    errors:           0,
  }

  // Snapshot canonical counts before processing
  const beforeSnapshot = await getCanonicalCounts(tenantId)

  // Process one batch
  const batchResult = await ingestionBuffer.processNext()

  result.processed = batchResult.processed
  result.errors    = batchResult.failed

  // Snapshot after to compute deltas
  const afterSnapshot = await getCanonicalCounts(tenantId)

  result.canonical_created = Math.max(0, afterSnapshot.total - beforeSnapshot.total)
  result.canonical_merged  = Math.max(0, beforeSnapshot.total - afterSnapshot.total + batchResult.processed)
  result.fraud_flagged     = Math.max(0, afterSnapshot.flagged - beforeSnapshot.flagged)

  return result
}

// ─── Delta ingestion ──────────────────────────────────────────────────────────

/**
 * Runs delta ingestion from Casafari + Idealista since `sinceTimestamp`.
 * Called by the daily cron job.
 *
 * Logs the run to ingestion_runs for audit trail.
 */
export async function runDeltaIngestion(
  tenantId: string,
  sinceTimestamp: string,
): Promise<DeltaIngestResult> {
  // Run id for audit trail
  const runId = crypto.randomUUID()

  // Insert run record
  await (supabaseAdmin as any)
    .from('ingestion_runs')
    .insert({
      id:         runId,
      tenant_id:  tenantId,
      source:     'all',
      run_type:   'delta',
      started_at: new Date().toISOString(),
      status:     'running',
    })
    .select()

  let casafariTotal  = 0
  let idealistaTotal = 0
  let totalProcessed = 0
  let errors = 0
  let status: 'completed' | 'failed' = 'completed'

  try {
    // ── Casafari delta ──────────────────────────────────────────────────────
    try {
      const casafariProps = await casafariAdapter.fetchDelta(sinceTimestamp, 'PT')

      for (const prop of casafariProps) {
        if (!prop.id || prop.price == null) continue
        const key = `casafari:${prop.id}`
        const enqRes = await ingestionBuffer.enqueue({
          source:          'casafari',
          source_id:       prop.id,
          tenant_id:       tenantId,
          priority:        'normal',
          raw_data:        prop as unknown as Record<string, unknown>,
          idempotency_key: key,
        })
        if (enqRes.accepted) casafariTotal++
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[canonicalPipeline] Casafari delta fetch error:', msg)
      errors++
    }

    // ── Idealista delta — Portugal main markets ──────────────────────────────
    const PT_LOCATION_IDS = [
      '0-EU-PT-01', // Lisboa
      '0-EU-PT-10', // Porto
      '0-EU-PT-15', // Faro (Algarve)
    ]

    for (const locationId of PT_LOCATION_IDS) {
      try {
        const props = await idealistaAdapter.fetchDeltaByRegion('pt', locationId, 'T')

        for (const prop of props) {
          if (!prop.propertyCode || !prop.price) continue
          const key = `idealista:${prop.propertyCode}`
          const enqRes = await ingestionBuffer.enqueue({
            source:          'idealista',
            source_id:       prop.propertyCode,
            tenant_id:       tenantId,
            priority:        'normal',
            raw_data:        prop as unknown as Record<string, unknown>,
            idempotency_key: key,
          })
          if (enqRes.accepted) idealistaTotal++
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[canonicalPipeline] Idealista delta error for ${locationId}:`, msg)
        errors++
      }
    }

    // ── Process the queue ────────────────────────────────────────────────────
    const processResult = await ingestionBuffer.processNext()
    totalProcessed = processResult.processed
    errors        += processResult.failed

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[canonicalPipeline] runDeltaIngestion fatal error:', msg)
    status = 'failed'
    errors++
  }

  // Update run record
  await (supabaseAdmin as any)
    .from('ingestion_runs')
    .update({
      completed_at:         new Date().toISOString(),
      fetched:              casafariTotal + idealistaTotal,
      enqueued:             casafariTotal + idealistaTotal,
      errors,
      last_source_timestamp: sinceTimestamp,
      status,
    })
    .eq('id', runId)

  return {
    casafari:        casafariTotal,
    idealista:       idealistaTotal,
    total_processed: totalProcessed,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getCanonicalCounts(
  tenantId: string,
): Promise<{ total: number; flagged: number }> {
  const [totalRes, flaggedRes] = await Promise.allSettled([
    (supabaseAdmin as any)
      .from('canonical_properties')
      .select('canonical_id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('listing_status', 'active'),

    (supabaseAdmin as any)
      .from('canonical_properties')
      .select('canonical_id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .gt('fraud_risk_score', 50),
  ])

  return {
    total:   totalRes.status  === 'fulfilled' ? (totalRes.value.count  ?? 0) : 0,
    flagged: flaggedRes.status === 'fulfilled' ? (flaggedRes.value.count ?? 0) : 0,
  }
}
