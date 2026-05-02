// =============================================================================
// Agency Group — National Ingestion Pipeline
// lib/ingestion/pipeline.ts
//
// Orchestrates data flow from all configured providers into the properties table:
//
//   1. Fetch listings from each enabled provider
//   2. Deduplicate against existing properties (pass 1: exact key, pass 3: metrics)
//   3. Upsert new listings into properties table
//   4. Update existing listings if data has changed (price, status)
//   5. Log results to automations_log
//
// Idempotent: safe to run multiple times — no duplicates created.
// Backward compatible: doesn't touch existing scoring/signal columns.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { batchCheckDuplicates } from '@/lib/ingestion/dedup'
import { resolvePropertyZone } from '@/lib/market/zones'
import { computePresentationScore } from '@/lib/scoring/presentationScore'
import {
  type ProviderAdapter,
  type ProviderListing,
  type ProviderIngestionResult,
  type PipelineRunResult,
  type ProviderFetchParams,
} from '@/lib/ingestion/types'

// Import provider adapters
import { idealistaAdapter }  from '@/lib/ingestion/providers/idealista'
import { bankListingsAdapter } from '@/lib/ingestion/providers/bankListings'
import { imovirtualAdapter } from '@/lib/ingestion/providers/imovirtual'
import { casafariAdapter }   from '@/lib/ingestion/providers/casafari'

// ---------------------------------------------------------------------------
// Provider registry — add new providers here
// ---------------------------------------------------------------------------

export const PROVIDER_REGISTRY: ProviderAdapter[] = [
  casafariAdapter,    // Highest confidence — run first to anchor dedup
  idealistaAdapter,
  imovirtualAdapter,
  bankListingsAdapter,
]

// ---------------------------------------------------------------------------
// Map ProviderListing → properties table row
// ---------------------------------------------------------------------------

// Property type → DB enum mapping
const TYPE_TO_DB_ENUM: Record<string, string> = {
  apartment:        'apartment',
  penthouse:        'penthouse',
  villa:            'villa',
  townhouse:        'townhouse',
  commercial:       'commercial',
  office:           'office',
  land:             'land',
  warehouse:        'warehouse',
  hotel:            'hotel',
  development_plot: 'development_plot',
  other:            'apartment',  // DB default
}

function listingToPropertyRow(
  listing: ProviderListing,
  existingId?: string | null,
): Record<string, unknown> {
  const zone_key = resolvePropertyZone({
    zone:    listing.zone ?? undefined,
    city:    listing.city ?? undefined,
    address: listing.address ?? undefined,
  })

  const row: Record<string, unknown> = {
    title:               listing.title,
    price:               listing.price,
    price_previous:      listing.price_previous ?? null,
    area_m2:             listing.area_m2 ?? null,
    bedrooms:            listing.bedrooms ?? null,
    bathrooms:           listing.bathrooms ?? null,
    type:                listing.type ? (TYPE_TO_DB_ENUM[listing.type] ?? 'apartment') : null,
    condition:           listing.condition ?? null,
    status:              listing.status === 'auction' ? 'active' : listing.status,  // normalize auction → active

    // Location
    zone:                listing.zone ?? null,
    zone_key,
    city:                listing.city ?? null,
    address:             listing.address ?? null,
    latitude:            listing.latitude ?? null,
    longitude:           listing.longitude ?? null,

    // Presentation
    description:         listing.description ?? null,
    photos:              listing.photos?.length ? listing.photos : null,
    features:            listing.features?.length ? listing.features : null,

    // Provider tracking
    source_provider:     listing.provider,
    source_confidence:   listing.source_confidence,
    provider_listing_id: listing.provider_listing_id,

    // Market timing
    days_on_market:      listing.listed_at
      ? Math.round((Date.now() - new Date(listing.listed_at).getTime()) / 86_400_000)
      : null,

    // Timestamps
    updated_at:          new Date().toISOString(),
  }

  // Compute presentation score at ingestion time from raw listing data
  // This captures quality data that is only available at this point
  if (!existingId) {
    const { presentation_score, presentation_flags, presentation_opportunity_bonus } =
      computePresentationScore({
        title:         listing.title,
        description:   listing.description,
        photos:        listing.photos,
        num_photos:    listing.num_photos,
        has_floorplan: listing.has_floorplan,
        has_video:     listing.has_video,
        features:      listing.features,
      })
    row.presentation_score             = presentation_score
    row.presentation_flags             = presentation_flags
    row.presentation_opportunity_bonus = presentation_opportunity_bonus
  }

  // Only set created_at for new rows
  if (!existingId) {
    row.created_at = new Date().toISOString()
    // Default scores — will be set by sync-listings cron
    row.opportunity_score = 0
    row.investor_suitable = false
  }

  return row
}

// ---------------------------------------------------------------------------
// Upsert listing into properties table
// ---------------------------------------------------------------------------

async function upsertListing(
  listing: ProviderListing,
  existingId: string | null,
): Promise<{ action: 'created' | 'updated' | 'skipped'; id?: string; error?: string }> {
  const row = listingToPropertyRow(listing, existingId)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const client = supabaseAdmin as any

  if (existingId) {
    // Update existing — only update price-sensitive and presentation fields
    // DO NOT touch scoring columns (opportunity_score, score_breakdown etc.)
    const updateFields = {
      price:               row.price,
      price_previous:      row.price_previous,
      photos:              row.photos,
      description:         row.description,
      features:            row.features,
      days_on_market:      row.days_on_market,
      source_confidence:   row.source_confidence,
      provider_listing_id: row.provider_listing_id,
      updated_at:          row.updated_at,
    }

    const { error } = await client
      .from('properties')
      .update(updateFields)
      .eq('id', existingId)

    if (error) return { action: 'skipped', error: error.message }
    return { action: 'updated', id: existingId }

  } else {
    // Insert new property
    const { data, error } = await client
      .from('properties')
      .insert(row)
      .select('id')
      .single()

    if (error) {
      // Unique constraint violation (provider key) = race condition with another run
      if (error.message.includes('unique') || error.message.includes('duplicate')) {
        return { action: 'skipped' }
      }
      return { action: 'skipped', error: error.message }
    }

    return { action: 'created', id: data?.id }
  }
}

// ---------------------------------------------------------------------------
// Log to automations_log
// ---------------------------------------------------------------------------

async function logPipelineRun(result: PipelineRunResult): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from('automations_log')
      .insert({
        workflow_name: 'national_ingestion_pipeline',
        trigger_type:  'cron',
        status:        result.total_errors === 0 ? 'success' : 'partial',
        started_at:    result.started_at,
        completed_at:  result.completed_at,
        duration_ms:   result.duration_ms,
        outcome: {
          run_id:        result.run_id,
          providers:     result.providers.map(p => p.provider),
          total_fetched: result.total_fetched,
          total_new:     result.total_new,
          total_updated: result.total_updated,
          total_errors:  result.total_errors,
        },
        error_message: result.warnings.length > 0 ? result.warnings.join('; ') : null,
      })
  } catch { /* silent — logging must never fail the pipeline */ }
}

// ---------------------------------------------------------------------------
// Run one provider
// ---------------------------------------------------------------------------

async function runProvider(
  adapter: ProviderAdapter,
  params:  ProviderFetchParams,
): Promise<ProviderIngestionResult> {
  const t0 = Date.now()
  const result: ProviderIngestionResult = {
    provider:           adapter.name,
    fetched:            0,
    new_listings:       0,
    updated:            0,
    duplicates_skipped: 0,
    errors:             [],
    duration_ms:        0,
  }

  if (!adapter.isConfigured()) {
    result.errors.push(`${adapter.name}: not configured — skipping`)
    result.duration_ms = Date.now() - t0
    return result
  }

  try {
    const listings = await adapter.fetchListings(params)
    result.fetched = listings.length

    if (listings.length === 0) {
      result.duration_ms = Date.now() - t0
      return result
    }

    // Batch dedup check
    const dedupResults = await batchCheckDuplicates(listings)

    for (const { listing, result: dedup } of dedupResults) {
      if (!dedup.is_new && dedup.merge_confidence >= 0.75 &&
          dedup.match_signals[0] === 'intra_batch_duplicate') {
        result.duplicates_skipped++
        continue
      }

      const upsertResult = await upsertListing(
        listing,
        dedup.canonical_id,
      )

      if (upsertResult.action === 'created')    result.new_listings++
      else if (upsertResult.action === 'updated') result.updated++
      else if (upsertResult.action === 'skipped') {
        if (upsertResult.error) result.errors.push(`${listing.provider_listing_id}: ${upsertResult.error}`)
        else result.duplicates_skipped++
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    result.errors.push(`${adapter.name} fatal: ${msg}`)
  }

  result.duration_ms = Date.now() - t0
  return result
}

// ---------------------------------------------------------------------------
// Main pipeline entry point
// ---------------------------------------------------------------------------

export async function runIngestionPipeline(
  params:    ProviderFetchParams = {},
  providers: ProviderAdapter[]  = PROVIDER_REGISTRY,
): Promise<PipelineRunResult> {
  const runId     = crypto.randomUUID()
  const startedAt = new Date().toISOString()
  const t0        = Date.now()

  const providerResults: ProviderIngestionResult[] = []
  const warnings: string[] = []

  // Run providers sequentially (avoids race conditions on dedup)
  for (const adapter of providers) {
    const r = await runProvider(adapter, params)
    providerResults.push(r)

    if (r.errors.length > 0) {
      warnings.push(...r.errors.map(e => `[${adapter.name}] ${e}`))
    }
  }

  const completedAt = new Date().toISOString()
  const durationMs  = Date.now() - t0

  const result: PipelineRunResult = {
    run_id:        runId,
    started_at:    startedAt,
    completed_at:  completedAt,
    duration_ms:   durationMs,
    providers:     providerResults,
    total_fetched: providerResults.reduce((s, r) => s + r.fetched, 0),
    total_new:     providerResults.reduce((s, r) => s + r.new_listings, 0),
    total_updated: providerResults.reduce((s, r) => s + r.updated, 0),
    total_errors:  warnings.length,
    warnings,
  }

  await logPipelineRun(result)

  return result
}
