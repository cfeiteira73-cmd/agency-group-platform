// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Canonical Asset Ledger (Wave 32 Layer 2)
// lib/assets/canonicalAssetLedger.ts
//
// Financial-grade canonical asset store.  Each external listing becomes exactly
// one canonical_assets row, keyed by (tenant_id, canonical_hash).
//
// UPSERT on (tenant_id, canonical_hash) — idempotent ingestion.
// SHA-256(external_id + source) → canonical_hash.
// =============================================================================

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import type { CanonicalPropertyInput } from '@/lib/ingestion/normalizationPipeline'
import type { AssetDecayResult }        from '@/lib/ingestion/decayModel'
import type { FraudCheckResult }        from '@/lib/ingestion/fraudDetection'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface CanonicalAsset {
  id: string
  tenant_id: string
  canonical_hash: string
  external_id: string
  source: string
  title: string
  price_eur: number
  area_sqm: number
  typology: string
  zone: string
  district: string
  country: string
  latitude: number | null
  longitude: number | null
  price_per_sqm: number | null
  liquidity_score: number | null
  risk_score: number | null
  capital_exposure_eur: number
  investor_demand_count: number
  decay_factor: number
  fraud_signals: string[]
  is_suspicious: boolean
  valuation_eur: number | null
  listed_at: string
  last_ingested_at: string
  created_at: string
  updated_at: string
}

// ─── Hash helper ─────────────────────────────────────────────────────────────

function canonicalHash(externalId: string, source: string): string {
  return createHash('sha256')
    .update(`${externalId}:${source}`)
    .digest('hex')
}

// ─── Upsert ──────────────────────────────────────────────────────────────────

export async function upsertCanonicalAsset(
  tenantId: string,
  input: CanonicalPropertyInput & { decay: AssetDecayResult; fraud: FraudCheckResult },
): Promise<CanonicalAsset> {
  const hash = canonicalHash(input.external_id, input.source)
  const now  = new Date().toISOString()

  const row = {
    tenant_id:             tenantId,
    canonical_hash:        hash,
    external_id:           input.external_id,
    source:                input.source,
    title:                 input.title,
    price_eur:             input.price_eur,
    area_sqm:              input.area_sqm,
    typology:              input.typology,
    zone:                  input.zone,
    district:              input.district,
    country:               input.country,
    latitude:              input.latitude,
    longitude:             input.longitude,
    price_per_sqm:         input.price_per_sqm,
    decay_factor:          input.decay.decay_factor,
    fraud_signals:         input.fraud.signals,
    is_suspicious:         input.fraud.is_suspicious,
    listed_at:             input.listed_at,
    last_ingested_at:      now,
    updated_at:            now,
  }

  const { data, error } = await (supabaseAdmin as any)
    .from('canonical_assets')
    .upsert(row, { onConflict: 'tenant_id,canonical_hash' })
    .select()
    .single()

  if (error) {
    log.error('[canonicalAssetLedger] upsert error', error as Error, {
      tenant_id:   tenantId,
      external_id: input.external_id,
      source:      input.source,
    })
    throw error
  }

  // Fire-and-forget price history record
  void (supabaseAdmin as any)
    .from('asset_price_history')
    .insert({
      tenant_id:   tenantId,
      asset_id:    (data as CanonicalAsset).id,
      price_eur:   input.price_eur,
      source:      input.source,
      recorded_at: now,
    })
    .catch((e: Error) => log.warn('[canonicalAssetLedger] price_history insert failed', { error: e.message }))

  return data as CanonicalAsset
}

// ─── Get single asset ─────────────────────────────────────────────────────────

export async function getCanonicalAsset(
  tenantId: string,
  externalId: string,
  source: string,
): Promise<CanonicalAsset | null> {
  const hash = canonicalHash(externalId, source)

  const { data, error } = await (supabaseAdmin as any)
    .from('canonical_assets')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('canonical_hash', hash)
    .single()

  if (error) {
    if ((error as { code?: string }).code === 'PGRST116') return null  // not found
    log.warn('[canonicalAssetLedger] getCanonicalAsset error', { error: (error as Error).message })
    return null
  }

  return data as CanonicalAsset
}

// ─── Get multiple assets ──────────────────────────────────────────────────────

export async function getCanonicalAssets(
  tenantId: string,
  opts?: {
    zone?: string
    limit?: number
    offset?: number
    exclude_suspicious?: boolean
  },
): Promise<CanonicalAsset[]> {
  const limit  = opts?.limit  ?? 50
  const offset = opts?.offset ?? 0

  let query = (supabaseAdmin as any)
    .from('canonical_assets')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('last_ingested_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (opts?.zone) {
    query = query.eq('zone', opts.zone)
  }

  if (opts?.exclude_suspicious) {
    query = query.eq('is_suspicious', false)
  }

  const { data, error } = await query

  if (error) {
    log.warn('[canonicalAssetLedger] getCanonicalAssets error', { error: (error as Error).message })
    return []
  }

  return (data ?? []) as CanonicalAsset[]
}

// ─── Update capital exposure ──────────────────────────────────────────────────

/**
 * Recomputes capital_exposure_eur and investor_demand_count from investor_bids.
 * Fire-and-forget safe — called after each successful upsert batch.
 */
export async function updateCapitalExposure(
  tenantId: string,
  assetId: string,
): Promise<void> {
  const { data, error } = await (supabaseAdmin as any)
    .from('investor_bids')
    .select('bid_amount')
    .eq('asset_id', assetId)
    .eq('status', 'active')

  if (error) {
    log.warn('[canonicalAssetLedger] updateCapitalExposure query error', {
      asset_id: assetId,
      error: (error as Error).message,
    })
    return
  }

  const rows = (data ?? []) as Array<{ bid_amount: number }>
  const total = rows.reduce((sum, r) => sum + Number(r.bid_amount ?? 0), 0)
  const count = rows.length

  const { error: updateErr } = await (supabaseAdmin as any)
    .from('canonical_assets')
    .update({
      capital_exposure_eur:  total,
      investor_demand_count: count,
      updated_at:            new Date().toISOString(),
    })
    .eq('id', assetId)
    .eq('tenant_id', tenantId)

  if (updateErr) {
    log.warn('[canonicalAssetLedger] updateCapitalExposure update error', {
      asset_id: assetId,
      error: (updateErr as Error).message,
    })
  }
}
