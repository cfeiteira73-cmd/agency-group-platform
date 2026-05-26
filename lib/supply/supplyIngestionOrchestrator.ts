// =============================================================================
// Agency Group — Supply Ingestion Orchestrator
// lib/supply/supplyIngestionOrchestrator.ts
//
// Orchestrates all supply connectors in priority order:
//   Idealista → Casafari → (future providers)
//
// Rate-limit-safe: runs providers in sequence, not parallel.
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'
import {
  fetchIdealistaListings,
  type IdealistaMarket,
} from './idealista/idealistaConnector'
import {
  fetchCasafariListings,
  type CasafariMarket,
} from './casafari/casafariConnector'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SupplyProvider =
  | 'IDEALISTA'
  | 'CASAFARI'
  | 'CITIUS'
  | 'BANK_NPL'
  | 'BROKER_CRM'
  | 'PUBLIC_REGISTRY'

export interface IngestionRun {
  run_id: string
  tenant_id: string
  providers_attempted: SupplyProvider[]
  providers_succeeded: SupplyProvider[]
  total_raw_records: number
  new_records: number
  updated_records: number
  errors: Array<{ provider: SupplyProvider; error: string }>
  run_at: string
  duration_ms: number
}

export interface RawOpportunityRecord {
  id?: string
  tenant_id: string
  source: SupplyProvider
  source_id: string
  market: string            // country code
  city: string
  property_type: string
  size_sqm: number | null
  asking_price_eur_cents: number
  price_per_sqm_eur_cents: number | null
  listing_date: string
  days_on_market: number | null
  is_distressed: boolean    // bank-owned, auction, judicial
  confidence_score: number
  data_observed: Record<string, unknown>  // fields from API (observed)
  data_inferred: Record<string, unknown>  // computed fields (inferred)
  raw_payload: Record<string, unknown>
  ingested_at: string
  last_seen_at: string
  delisted_at: string | null
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

const IDEALISTA_MARKETS: IdealistaMarket[] = ['PT', 'ES']
const CASAFARI_MARKETS: CasafariMarket[] = ['PT', 'ES', 'FR']

async function persistIngestionRun(run: IngestionRun): Promise<void> {
  const { error } = await (supabaseAdmin as any)
    .from('ingestion_runs')
    .upsert(
      {
        run_id: run.run_id,
        tenant_id: run.tenant_id,
        providers_attempted: run.providers_attempted,
        providers_succeeded: run.providers_succeeded,
        total_raw_records: run.total_raw_records,
        new_records: run.new_records,
        updated_records: run.updated_records,
        errors: run.errors,
        run_at: run.run_at,
        duration_ms: run.duration_ms,
      },
      { onConflict: 'run_id' },
    )

  if (error) {
    log.warn('[supplyOrchestrator] failed to persist ingestion run', { error: String(error) })
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run a full ingestion cycle across Idealista (PT, ES) and Casafari (PT, ES, FR).
 * Runs providers in sequence to respect rate limits.
 * Persists an IngestionRun record to ingestion_runs table.
 */
export async function runIngestionCycle(
  tenantId: string,
  markets?: string[],
): Promise<IngestionRun> {
  const runId = randomUUID()
  const runAt = new Date().toISOString()
  const startMs = Date.now()

  const providersAttempted: SupplyProvider[] = []
  const providersSucceeded: SupplyProvider[] = []
  const errors: Array<{ provider: SupplyProvider; error: string }> = []
  let totalRaw = 0

  // ── 1. Idealista ─────────────────────────────────────────────────────────
  const idealistaMarkets = markets
    ? IDEALISTA_MARKETS.filter(m => markets.includes(m))
    : IDEALISTA_MARKETS

  if (idealistaMarkets.length > 0) {
    providersAttempted.push('IDEALISTA')
    let idealistaTotal = 0
    let idealistaOk = true

    for (const market of idealistaMarkets) {
      try {
        const listings = await fetchIdealistaListings(market, undefined, 50)
        idealistaTotal += listings.length
      } catch (e) {
        idealistaOk = false
        errors.push({ provider: 'IDEALISTA', error: `market=${market}: ${String(e)}` })
        log.warn('[supplyOrchestrator] Idealista market error', { market, error: String(e) })
      }
    }

    totalRaw += idealistaTotal
    if (idealistaOk) providersSucceeded.push('IDEALISTA')
    log.info('[supplyOrchestrator] Idealista complete', { total: idealistaTotal })
  }

  // ── 2. Casafari ──────────────────────────────────────────────────────────
  const casafariMarkets = markets
    ? CASAFARI_MARKETS.filter(m => markets.includes(m))
    : CASAFARI_MARKETS

  if (casafariMarkets.length > 0) {
    providersAttempted.push('CASAFARI')
    let casafariTotal = 0
    let casafariOk = true

    for (const market of casafariMarkets) {
      try {
        const listings = await fetchCasafariListings(market, undefined, 50)
        casafariTotal += listings.length
      } catch (e) {
        casafariOk = false
        errors.push({ provider: 'CASAFARI', error: `market=${market}: ${String(e)}` })
        log.warn('[supplyOrchestrator] Casafari market error', { market, error: String(e) })
      }
    }

    totalRaw += casafariTotal
    if (casafariOk) providersSucceeded.push('CASAFARI')
    log.info('[supplyOrchestrator] Casafari complete', { total: casafariTotal })
  }

  const durationMs = Date.now() - startMs

  const run: IngestionRun = {
    run_id: runId,
    tenant_id: tenantId,
    providers_attempted: providersAttempted,
    providers_succeeded: providersSucceeded,
    total_raw_records: totalRaw,
    new_records: totalRaw, // approximation — upsert doesn't return diff counts without extra query
    updated_records: 0,
    errors,
    run_at: runAt,
    duration_ms: durationMs,
  }

  void persistIngestionRun(run).catch(e =>
    console.warn('[supplyOrchestrator] persist run error', e),
  )

  log.info('[supplyOrchestrator] ingestion cycle complete', {
    run_id: runId,
    total: totalRaw,
    duration_ms: durationMs,
    providers_succeeded: providersSucceeded.join(','),
  })

  return run
}

/**
 * Mark records from a source as delisted when they are no longer present
 * in the current fetch. Updates delisted_at = now() for missing records.
 */
export async function markDelistedRecords(
  tenantId: string,
  source: SupplyProvider,
  currentSourceIds: string[],
): Promise<{ delisted: number }> {
  if (currentSourceIds.length === 0) {
    // Safety guard — if caller passes empty array, do not delist everything
    return { delisted: 0 }
  }

  try {
    const now = new Date().toISOString()
    const { data, error } = await (supabaseAdmin as any)
      .from('raw_opportunity_stream')
      .update({ delisted_at: now })
      .eq('tenant_id', tenantId)
      .eq('source', source)
      .is('delisted_at', null)
      .not('source_id', 'in', `(${currentSourceIds.map(id => `'${id}'`).join(',')})`)
      .select('id')

    if (error) {
      log.warn('[supplyOrchestrator] markDelisted error', { error: String(error) })
      return { delisted: 0 }
    }

    const delisted = Array.isArray(data) ? data.length : 0
    log.info('[supplyOrchestrator] marked delisted', { source, delisted })
    return { delisted }
  } catch (e) {
    log.warn('[supplyOrchestrator] markDelisted exception', { error: String(e) })
    return { delisted: 0 }
  }
}

/**
 * Retrieve ingestion run history for a tenant.
 */
export async function getIngestionHistory(
  tenantId: string,
  limit = 20,
): Promise<IngestionRun[]> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('ingestion_runs')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('run_at', { ascending: false })
      .limit(limit)

    if (error) {
      log.warn('[supplyOrchestrator] getIngestionHistory error', { error: String(error) })
      return []
    }

    return (data as IngestionRun[]) ?? []
  } catch (e) {
    log.warn('[supplyOrchestrator] getIngestionHistory exception', { error: String(e) })
    return []
  }
}

/**
 * Read raw opportunity stream with optional filters.
 */
export async function getRawOpportunityStream(
  tenantId: string,
  filters?: {
    source?: SupplyProvider
    market?: string
    min_price?: number
    max_price?: number
    is_distressed?: boolean
    limit?: number
  },
): Promise<RawOpportunityRecord[]> {
  try {
    let query = (supabaseAdmin as any)
      .from('raw_opportunity_stream')
      .select('*')
      .eq('tenant_id', tenantId)
      .is('delisted_at', null)
      .order('ingested_at', { ascending: false })

    if (filters?.source) query = query.eq('source', filters.source)
    if (filters?.market) query = query.eq('market', filters.market)
    if (filters?.min_price != null) query = query.gte('asking_price_eur_cents', filters.min_price)
    if (filters?.max_price != null) query = query.lte('asking_price_eur_cents', filters.max_price)
    if (filters?.is_distressed != null) query = query.eq('is_distressed', filters.is_distressed)
    query = query.limit(filters?.limit ?? 50)

    const { data, error } = await query

    if (error) {
      log.warn('[supplyOrchestrator] getRawOpportunityStream error', { error: String(error) })
      return []
    }

    return (data as RawOpportunityRecord[]) ?? []
  } catch (e) {
    log.warn('[supplyOrchestrator] getRawOpportunityStream exception', { error: String(e) })
    return []
  }
}

/**
 * Aggregate supply stats for a tenant — totals, by source, by market, avg confidence.
 */
export async function getSupplyStats(
  tenantId: string,
): Promise<{
  total_active: number
  by_source: Record<string, number>
  by_market: Record<string, number>
  avg_confidence: number
}> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('raw_opportunity_stream')
      .select('source, market, confidence_score')
      .eq('tenant_id', tenantId)
      .is('delisted_at', null)

    if (error) {
      log.warn('[supplyOrchestrator] getSupplyStats error', { error: String(error) })
      return { total_active: 0, by_source: {}, by_market: {}, avg_confidence: 0 }
    }

    const rows = (data as Array<{ source: string; market: string; confidence_score: number }>) ?? []
    const by_source: Record<string, number> = {}
    const by_market: Record<string, number> = {}
    let confidenceSum = 0

    for (const row of rows) {
      by_source[row.source] = (by_source[row.source] ?? 0) + 1
      by_market[row.market] = (by_market[row.market] ?? 0) + 1
      confidenceSum += Number(row.confidence_score ?? 0)
    }

    const total = rows.length
    return {
      total_active: total,
      by_source,
      by_market,
      avg_confidence: total > 0 ? Math.round((confidenceSum / total) * 1000) / 1000 : 0,
    }
  } catch (e) {
    log.warn('[supplyOrchestrator] getSupplyStats exception', { error: String(e) })
    return { total_active: 0, by_source: {}, by_market: {}, avg_confidence: 0 }
  }
}
