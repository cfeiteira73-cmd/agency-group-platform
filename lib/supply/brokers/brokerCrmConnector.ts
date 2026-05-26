// =============================================================================
// Agency Group — Broker CRM Connector
// lib/supply/brokers/brokerCrmConnector.ts
//
// Broker CRM feeds — exclusive off-market deals.
// Highest quality, lowest volume. Manual ingestion by broker partners.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BrokerCRMListing {
  source_id: string
  source: 'BROKER_CRM'
  broker_name: string
  broker_id: string
  is_exclusive: boolean        // true = off-market, only available through this broker
  market: string
  city: string
  property_type: string
  size_sqm: number | null
  bedrooms: number | null
  asking_price_eur_cents: number
  seller_motivation: 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN'  // seller urgency
  days_available: number | null
  url: string | null
  notes: string | null
  confidence_score: number     // 0.75 for broker CRM (depends on broker quality)
  fetched_at: string
  raw_payload: Record<string, unknown>
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CONFIDENCE_SCORE = 0.75

const SELLER_MOTIVATION_SCORES: Record<BrokerCRMListing['seller_motivation'], number> = {
  HIGH: 0.9,
  MEDIUM: 0.6,
  LOW: 0.3,
  UNKNOWN: 0.5,
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateRequiredFields(
  listing: Omit<BrokerCRMListing, 'fetched_at'>,
): string | null {
  if (!listing.source_id?.trim()) return 'source_id is required'
  if (!listing.broker_id?.trim()) return 'broker_id is required'
  if (!listing.broker_name?.trim()) return 'broker_name is required'
  if (!listing.city?.trim()) return 'city is required'
  if (!listing.market?.trim()) return 'market is required'
  if (!listing.property_type?.trim()) return 'property_type is required'
  if (!listing.asking_price_eur_cents || listing.asking_price_eur_cents <= 0)
    return 'asking_price_eur_cents must be a positive integer'
  return null
}

// ─── Persistence ──────────────────────────────────────────────────────────────

async function persistListing(
  listing: Omit<BrokerCRMListing, 'fetched_at'>,
  tenantId: string,
): Promise<void> {
  const now = new Date().toISOString()
  const motivationScore = SELLER_MOTIVATION_SCORES[listing.seller_motivation ?? 'UNKNOWN']

  const row = {
    tenant_id: tenantId,
    source: listing.source,
    source_id: listing.source_id,
    market: listing.market,
    city: listing.city,
    property_type: listing.property_type,
    size_sqm: listing.size_sqm,
    asking_price_eur_cents: listing.asking_price_eur_cents,
    price_per_sqm_eur_cents:
      listing.size_sqm && listing.size_sqm > 0
        ? Math.round(listing.asking_price_eur_cents / listing.size_sqm)
        : null,
    listing_date: now,
    days_on_market: listing.days_available,
    is_distressed: false,
    confidence_score: listing.confidence_score,
    data_observed: {
      source_id: listing.source_id,
      broker_name: listing.broker_name,
      broker_id: listing.broker_id,
      is_exclusive: listing.is_exclusive,
      market: listing.market,
      city: listing.city,
      property_type: listing.property_type,
      size_sqm: listing.size_sqm,
      bedrooms: listing.bedrooms,
      asking_price_eur_cents: listing.asking_price_eur_cents,
      seller_motivation: listing.seller_motivation,
      days_available: listing.days_available,
      url: listing.url,
      notes: listing.notes,
    },
    data_inferred: {
      seller_motivation: listing.seller_motivation,
      seller_motivation_score: motivationScore,
      is_exclusive: listing.is_exclusive,
      broker_id: listing.broker_id,
    },
    raw_payload: listing.raw_payload,
    ingested_at: now,
    last_seen_at: now,
    delisted_at: null,
  }

  const { error } = await (supabaseAdmin as any)
    .from('raw_opportunity_stream')
    .upsert(row, { onConflict: 'source,source_id', ignoreDuplicates: false })

  if (error) {
    throw new Error(`Supabase upsert error: ${String(error.message ?? error)}`)
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Manual ingestion endpoint for a single broker CRM listing.
 * Validates required fields, upserts to raw_opportunity_stream.
 */
export async function ingestBrokerListing(
  listing: Omit<BrokerCRMListing, 'fetched_at'>,
  tenantId: string,
): Promise<void> {
  const validationError = validateRequiredFields(listing)
  if (validationError) {
    throw new Error(`[brokerCrmConnector] Validation failed: ${validationError}`)
  }

  // Ensure confidence_score is set
  const normalised: Omit<BrokerCRMListing, 'fetched_at'> = {
    ...listing,
    confidence_score: listing.confidence_score ?? CONFIDENCE_SCORE,
    seller_motivation: listing.seller_motivation ?? 'UNKNOWN',
  }

  try {
    await persistListing(normalised, tenantId)
    log.info('[brokerCrmConnector] ingested listing', {
      source_id: listing.source_id,
      broker_id: listing.broker_id,
      tenantId,
    })
  } catch (e) {
    log.warn('[brokerCrmConnector] ingestBrokerListing error', { error: String(e) })
    throw e
  }
}

/**
 * Bulk ingestion for multiple broker CRM listings.
 * Uses individual upserts (validating each) — returns ingested/failed counts.
 */
export async function bulkIngestBrokerListings(
  listings: Omit<BrokerCRMListing, 'fetched_at'>[],
  tenantId: string,
): Promise<{ ingested: number; failed: number }> {
  let ingested = 0
  let failed = 0

  for (const listing of listings) {
    try {
      await ingestBrokerListing(listing, tenantId)
      ingested++
    } catch (e) {
      log.warn('[brokerCrmConnector] bulk item failed', {
        source_id: listing.source_id,
        error: String(e),
      })
      failed++
    }
  }

  log.info('[brokerCrmConnector] bulk ingest complete', { ingested, failed, tenantId })
  return { ingested, failed }
}

/**
 * Aggregate stats for broker CRM listings for a tenant.
 */
export async function getBrokerFeedStats(tenantId: string): Promise<{
  total: number
  by_broker: Record<string, number>
  exclusive_count: number
}> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('raw_opportunity_stream')
      .select('data_observed')
      .eq('source', 'BROKER_CRM')
      .eq('tenant_id', tenantId)
      .is('delisted_at', null)

    if (error) {
      log.warn('[brokerCrmConnector] getBrokerFeedStats error', { error: String(error) })
      return { total: 0, by_broker: {}, exclusive_count: 0 }
    }

    const rows =
      (data as Array<{ data_observed: Record<string, unknown> }>) ?? []

    const by_broker: Record<string, number> = {}
    let exclusiveCount = 0

    for (const row of rows) {
      const brokerName = String(row.data_observed?.['broker_name'] ?? 'unknown')
      by_broker[brokerName] = (by_broker[brokerName] ?? 0) + 1
      if (row.data_observed?.['is_exclusive'] === true) {
        exclusiveCount++
      }
    }

    return {
      total: rows.length,
      by_broker,
      exclusive_count: exclusiveCount,
    }
  } catch (e) {
    log.warn('[brokerCrmConnector] getBrokerFeedStats exception', { error: String(e) })
    return { total: 0, by_broker: {}, exclusive_count: 0 }
  }
}
