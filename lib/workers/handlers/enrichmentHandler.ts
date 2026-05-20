// Agency Group — Enrichment Worker Handler
// lib/workers/handlers/enrichmentHandler.ts
//
// Derives enriched fields from raw property data (price_per_m2, investment_tier,
// geo_tier), patches only null columns, then enqueues a scoring job.
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import { getQueueAdapter } from '@/lib/queue/adapter'
import type { WorkerJob, WorkerResult } from '../types'

// ─── Payload ──────────────────────────────────────────────────────────────────

export interface EnrichmentJobPayload {
  property_id: string
  tenant_id:   string
  provider?:   string
}

// ─── Tier helpers ─────────────────────────────────────────────────────────────

type InvestmentTier = 'entry' | 'mid' | 'premium' | 'luxury'
type GeoTier        = 'prime' | 'secondary' | 'emerging'

function resolveInvestmentTier(price: number): InvestmentTier {
  if (price >= 3_000_000) return 'luxury'
  if (price >= 1_000_000) return 'premium'
  if (price >= 300_000)   return 'mid'
  return 'entry'
}

const PRIME_ZONES     = ['lisboa', 'cascais', 'sintra', 'estoril', 'oeiras']
const SECONDARY_ZONES = ['porto', 'algarve', 'faro', 'albufeira', 'vilamoura', 'vila nova de gaia', 'matosinhos']

function resolveGeoTier(property: Record<string, unknown>): GeoTier {
  const candidates = [
    property.city,
    property.zone,
    property.concelho,
    property.address,
  ]
    .filter(Boolean)
    .map(v => String(v).toLowerCase())

  for (const val of candidates) {
    if (PRIME_ZONES.some(z => val.includes(z))) return 'prime'
  }
  for (const val of candidates) {
    if (SECONDARY_ZONES.some(z => val.includes(z))) return 'secondary'
  }
  return 'emerging'
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function enrichmentHandler(
  job: WorkerJob<EnrichmentJobPayload>,
): Promise<WorkerResult> {
  const start = Date.now()
  const { property_id, tenant_id } = job.payload

  try {
    // 1. Fetch property
    const { data: property, error: fetchErr } = await (supabaseAdmin as any)
      .from('properties')
      .select('*')
      .eq('id', property_id)
      .eq('tenant_id', tenant_id)
      .single()

    if (fetchErr || !property) {
      return {
        jobId:      job.jobId,
        success:    false,
        durationMs: Date.now() - start,
        error:      `Property not found: ${property_id} — ${fetchErr?.message ?? 'no data'}`,
      }
    }

    const p = property as Record<string, unknown>

    // 2. Derive enriched fields
    const price  = typeof p.price  === 'number' ? p.price  : 0
    const area   = typeof p.area_m2 === 'number' ? p.area_m2 : 0

    const derivedPricePerM2: number | null =
      price > 0 && area > 0 ? Math.round(price / area) : null

    const investmentTier = resolveInvestmentTier(price)
    const geoTier        = resolveGeoTier(p)

    // 3. Build safe PATCH — only overwrite fields that are currently null
    const patch: Record<string, unknown> = {}

    if (p.price_per_m2 == null && derivedPricePerM2 !== null) {
      patch.price_per_m2 = derivedPricePerM2
    }
    if (p.investment_tier == null) {
      patch.investment_tier = investmentTier
    }
    if (p.geo_tier == null) {
      patch.geo_tier = geoTier
    }

    if (Object.keys(patch).length > 0) {
      patch.updated_at = new Date().toISOString()

      const { error: updateErr } = await (supabaseAdmin as any)
        .from('properties')
        .update(patch)
        .eq('id', property_id)
        .eq('tenant_id', tenant_id)

      if (updateErr) {
        console.error(`[enrichmentHandler] update failed for ${property_id}:`, updateErr.message)
        return {
          jobId:      job.jobId,
          success:    false,
          durationMs: Date.now() - start,
          error:      `properties update failed: ${updateErr.message}`,
        }
      }
    }

    // 4. Enqueue scoring job
    try {
      await getQueueAdapter().enqueue(
        'scoring_jobs',
        { property_id, tenant_id },
        { tenant_id },
      )
    } catch (enqueueErr) {
      // Non-fatal — enrichment succeeded; log and continue
      console.warn(
        `[enrichmentHandler] failed to enqueue scoring job for ${property_id}:`,
        enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr),
      )
    }

    return {
      jobId:      job.jobId,
      success:    true,
      durationMs: Date.now() - start,
      output: {
        property_id,
        fields_enriched: Object.keys(patch).filter(k => k !== 'updated_at'),
        investment_tier: investmentTier,
        geo_tier:        geoTier,
        price_per_m2:    derivedPricePerM2,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[enrichmentHandler] unexpected error for job ${job.jobId}:`, msg)
    return {
      jobId:      job.jobId,
      success:    false,
      durationMs: Date.now() - start,
      error:      msg,
    }
  }
}
