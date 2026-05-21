// =============================================================================
// Agency Group — Canonical Property System
// lib/ingestion/canonicalProperty.ts
//
// Global canonical property entity system.
// 1 real property = 1 canonical record globally (per tenant).
//
// Flow:
//   resolveOrCreateCanonical()
//     ├─ Lookup existing canonical by source_id
//     ├─ If not found → run dedup engine (fuzzy match)
//     │    ├─ confidence >= 0.85 → merge into existing
//     │    └─ no match → create new canonical record
//     └─ Emit property.canonical_resolved event
//
//   mergeCanonicals() — merge duplicate into primary, preserve history
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin }  from '@/lib/supabase'
import { findDuplicates } from './dedupEngine'
import { computeFreshnessScore } from './decayModel'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CanonicalProperty {
  canonical_id: string           // GLOBAL UUID — stable across sources
  tenant_id:    string
  source_ids:   Record<string, string> // { casafari: '...', idealista: '...', manual: '...' }

  // Normalized fields
  title:       string
  description: string | null

  // Location
  address:   string
  city:      string
  zone:      string
  country:   string          // ISO 3166-1 alpha-2 ('PT', 'ES', 'FR', 'DE')
  latitude:  number | null
  longitude: number | null

  // Physical
  property_type: string     // 'apartment' | 'house' | 'villa' | 'land' | 'commercial'
  area_m2:       number
  bedrooms:      number | null
  bathrooms:     number | null
  floor:         number | null

  // Financial
  price_eur:             number
  price_per_m2:          number
  estimated_yield_pct:   number | null

  // Market state
  listing_status: 'active' | 'sold' | 'reserved' | 'expired'
  listed_at:      string
  freshness_score: number    // 0-100

  // Intelligence
  demand_score:     number | null
  fraud_risk_score: number
  is_canonical:     boolean
  merged_from:      string[] // canonical_ids of merged duplicates

  computed_at: string
}

export interface ResolveResult {
  canonical_id: string
  was_merged:   boolean
  confidence:   number
}

// ─── Raw Data Normalizer ─────────────────────────────────────────────────────

function normalizeRawData(rawData: Record<string, unknown>): Omit<
  CanonicalProperty,
  'canonical_id' | 'tenant_id' | 'source_ids' | 'freshness_score' | 'fraud_risk_score'
  | 'demand_score' | 'is_canonical' | 'merged_from' | 'computed_at'
> {
  const str = (v: unknown, fallback = '') =>
    typeof v === 'string' && v.trim() !== '' ? v.trim() : fallback

  const num = (v: unknown, fallback = 0): number => {
    const n = parseFloat(String(v))
    return isFinite(n) ? n : fallback
  }

  const optNum = (v: unknown): number | null => {
    if (v == null || v === '') return null
    const n = parseFloat(String(v))
    return isFinite(n) ? n : null
  }

  const priceEur  = num(rawData.price_eur ?? rawData.price ?? rawData.valor, 0)
  const areaM2    = num(rawData.area_m2   ?? rawData.area  ?? rawData.area_bruta, 0)
  const pricePerM2 = areaM2 > 0 ? Math.round((priceEur / areaM2) * 100) / 100 : 0

  return {
    title:       str(rawData.title ?? rawData.titulo ?? rawData.name, 'Untitled Property'),
    description: typeof rawData.description === 'string' ? rawData.description : null,

    address:  str(rawData.address  ?? rawData.morada  ?? rawData.direccion, ''),
    city:     str(rawData.city     ?? rawData.cidade   ?? rawData.ciudad, ''),
    zone:     str(rawData.zone     ?? rawData.zona     ?? rawData.district ?? rawData.city ?? rawData.cidade ?? ''),
    country:  str(rawData.country  ?? rawData.pais     ?? 'PT'),
    latitude: optNum(rawData.latitude  ?? rawData.lat),
    longitude: optNum(rawData.longitude ?? rawData.lng ?? rawData.lon),

    property_type: str(
      rawData.property_type ?? rawData.tipo ?? rawData.type_property,
      'apartment',
    ).toLowerCase(),
    area_m2:    areaM2,
    bedrooms:   optNum(rawData.bedrooms  ?? rawData.quartos    ?? rawData.habitaciones),
    bathrooms:  optNum(rawData.bathrooms ?? rawData.wc         ?? rawData.banos),
    floor:      optNum(rawData.floor     ?? rawData.andar      ?? rawData.planta),

    price_eur:           priceEur,
    price_per_m2:        pricePerM2,
    estimated_yield_pct: optNum(rawData.yield ?? rawData.rental_yield ?? rawData.yield_estimado),

    listing_status: (['active', 'sold', 'reserved', 'expired'] as const).includes(
      (rawData.listing_status ?? rawData.status ?? 'active') as 'active',
    )
      ? (rawData.listing_status ?? rawData.status ?? 'active') as CanonicalProperty['listing_status']
      : 'active',

    listed_at: typeof rawData.listed_at === 'string' && rawData.listed_at
      ? rawData.listed_at
      : new Date().toISOString(),
  }
}

// ─── Resolve or Create Canonical ──────────────────────────────────────────────

/**
 * Resolves (or creates) a canonical property record for an incoming source listing.
 *
 * Steps:
 *   1. Look up existing canonical by source+source_id
 *   2. If not found: run dedup engine for fuzzy match
 *   3. Confidence >= 0.85 → merge into best match
 *   4. No match → create new canonical record
 *   5. Emit property.canonical_resolved event
 */
export async function resolveOrCreateCanonical(
  tenantId:  string,
  sourceId:  string,
  source:    'casafari' | 'idealista' | 'manual' | 'broker',
  rawData:   Record<string, unknown>,
): Promise<ResolveResult> {
  // ── Step 1: Look up by source_id ─────────────────────────────────────────────
  const { data: existing } = await supabaseAdmin
    .from('canonical_properties')
    .select('canonical_id, source_ids')
    .eq('tenant_id', tenantId)
    .contains('source_ids', { [source]: sourceId })
    .maybeSingle()

  if (existing) {
    // Already mapped — update the record with fresh data
    const normalized = normalizeRawData(rawData)
    const freshness  = computeFreshnessScore({
      canonical_id:        existing.canonical_id,
      listed_at:           normalized.listed_at,
      last_updated_at:     new Date().toISOString(),
      last_price_change_at: null,
      listing_status:      normalized.listing_status,
    })

    await supabaseAdmin
      .from('canonical_properties')
      .update({
        ...normalized,
        freshness_score: freshness.freshness_score,
        computed_at:     new Date().toISOString(),
      })
      .eq('canonical_id', existing.canonical_id)
      .eq('tenant_id', tenantId)

    await emitCanonicalResolved(tenantId, existing.canonical_id, false, 1.0)

    return {
      canonical_id: existing.canonical_id,
      was_merged:   false,
      confidence:   1.0,
    }
  }

  // ── Step 2: Normalize raw data ────────────────────────────────────────────────
  const normalized = normalizeRawData(rawData)

  // ── Step 3: Run dedup engine ─────────────────────────────────────────────────
  const dedupResult = await findDuplicates(tenantId, {
    address:       normalized.address,
    city:          normalized.city,
    price_eur:     normalized.price_eur,
    area_m2:       normalized.area_m2,
    property_type: normalized.property_type,
    title:         normalized.title,
    latitude:      normalized.latitude,
    longitude:     normalized.longitude,
  })

  // ── Step 4: Merge if high confidence ─────────────────────────────────────────
  if (
    dedupResult.best_match &&
    dedupResult.best_match.similarity_score >= 0.85
  ) {
    const targetId  = dedupResult.best_match.canonical_id
    const confidence = dedupResult.best_match.similarity_score

    // Add source_id mapping to the existing canonical
    const { data: target } = await supabaseAdmin
      .from('canonical_properties')
      .select('source_ids')
      .eq('canonical_id', targetId)
      .eq('tenant_id', tenantId)
      .single()

    const updatedSourceIds: Record<string, string> = {
      ...((target?.source_ids as Record<string, string>) ?? {}),
      [source]: sourceId,
    }

    const freshness = computeFreshnessScore({
      canonical_id:        targetId,
      listed_at:           normalized.listed_at,
      last_updated_at:     new Date().toISOString(),
      last_price_change_at: null,
      listing_status:      normalized.listing_status,
    })

    await supabaseAdmin
      .from('canonical_properties')
      .update({
        source_ids:      updatedSourceIds,
        freshness_score: freshness.freshness_score,
        computed_at:     new Date().toISOString(),
      })
      .eq('canonical_id', targetId)
      .eq('tenant_id', tenantId)

    // Record in ingestion_log for audit trail (incoming absorbed without creating a new canonical)
    void supabaseAdmin.from('ingestion_log').upsert(
      {
        run_id:       `dedup-${Date.now()}`,
        provider:     source,
        new_listings: 0,
        updated:      1,
        duplicates:   1,
        started_at:   new Date().toISOString(),
        errors:       {
          action:          'absorbed_into_canonical',
          canonical_id:    targetId,
          similarity:      confidence,
          match_factors:   dedupResult.best_match.match_factors,
        },
      },
      { onConflict: 'run_id,provider', ignoreDuplicates: true },
    )

    await emitCanonicalResolved(tenantId, targetId, true, confidence)

    return {
      canonical_id: targetId,
      was_merged:   true,
      confidence,
    }
  }

  // ── Step 5: Create new canonical ─────────────────────────────────────────────
  const freshness = computeFreshnessScore({
    listed_at:           normalized.listed_at,
    last_updated_at:     new Date().toISOString(),
    last_price_change_at: null,
    listing_status:      normalized.listing_status,
  })

  const newRecord = {
    tenant_id:         tenantId,
    source_ids:        { [source]: sourceId } as Record<string, string>,
    ...normalized,
    freshness_score:   freshness.freshness_score,
    fraud_risk_score:  0,
    is_canonical:      true,
    merged_from:       [] as string[],
    demand_score:      null,
    computed_at:       new Date().toISOString(),
  }

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('canonical_properties')
    .insert(newRecord)
    .select('canonical_id')
    .single()

  if (insertErr || !inserted) {
    throw new Error(`[CanonicalProperty] Failed to create canonical: ${insertErr?.message ?? 'no data'}`)
  }

  // If dedup found candidates just below threshold, queue for review
  if (dedupResult.best_match && dedupResult.best_match.similarity_score >= 0.70) {
    await supabaseAdmin
      .from('dedup_candidates')
      .upsert(
        {
          tenant_id:        tenantId,
          canonical_id_a:   inserted.canonical_id,
          canonical_id_b:   dedupResult.best_match.canonical_id,
          similarity_score: dedupResult.best_match.similarity_score,
          match_factors:    dedupResult.best_match.match_factors,
          auto_merge:       false,
          status:           'pending',
        },
        { onConflict: 'canonical_id_a,canonical_id_b', ignoreDuplicates: true },
      )
  }

  await emitCanonicalResolved(tenantId, inserted.canonical_id, false, 0)

  return {
    canonical_id: inserted.canonical_id,
    was_merged:   false,
    confidence:   0,
  }
}

// ─── Merge Canonicals ─────────────────────────────────────────────────────────

/**
 * Merges a duplicate canonical property into the primary record.
 * Preserves source_ids from both sides and updates merged_from history.
 */
export async function mergeCanonicals(
  primaryId:   string,
  duplicateId: string,
  tenantId:    string,
): Promise<void> {
  // Load both records
  const [{ data: primary }, { data: duplicate }] = await Promise.all([
    supabaseAdmin
      .from('canonical_properties')
      .select('source_ids, merged_from')
      .eq('canonical_id', primaryId)
      .eq('tenant_id', tenantId)
      .single(),
    supabaseAdmin
      .from('canonical_properties')
      .select('source_ids, merged_from')
      .eq('canonical_id', duplicateId)
      .eq('tenant_id', tenantId)
      .single(),
  ])

  if (!primary || !duplicate) {
    throw new Error(`[CanonicalProperty] mergeCanonicals: one or both records not found`)
  }

  const primarySourceIds   = (primary.source_ids   as Record<string, string>) ?? {}
  const duplicateSourceIds = (duplicate.source_ids as Record<string, string>) ?? {}
  const primaryMergedFrom  = (primary.merged_from  as string[]) ?? []
  const dupMergedFrom      = (duplicate.merged_from as string[]) ?? []

  const mergedSourceIds: Record<string, string> = { ...duplicateSourceIds, ...primarySourceIds }
  const mergedFrom = Array.from(new Set([...primaryMergedFrom, ...dupMergedFrom, duplicateId]))

  const now = new Date().toISOString()

  // Update primary: absorb source_ids and merged_from history
  await supabaseAdmin
    .from('canonical_properties')
    .update({
      source_ids:  mergedSourceIds,
      merged_from: mergedFrom,
      computed_at: now,
    })
    .eq('canonical_id', primaryId)
    .eq('tenant_id', tenantId)

  // Mark duplicate as non-canonical (do NOT delete — preserve history)
  await supabaseAdmin
    .from('canonical_properties')
    .update({
      is_canonical:   false,
      listing_status: 'expired',
      computed_at:    now,
    })
    .eq('canonical_id', duplicateId)
    .eq('tenant_id', tenantId)

  // Update dedup_candidates record — match rows that reference either ID on either side
  await supabaseAdmin
    .from('dedup_candidates')
    .update({ status: 'merged', reviewed_at: now })
    .eq('tenant_id', tenantId)
    .or(
      `canonical_id_a.eq.${primaryId},canonical_id_b.eq.${primaryId},` +
      `canonical_id_a.eq.${duplicateId},canonical_id_b.eq.${duplicateId}`,
    )

  // Emit event
  void supabaseAdmin.from('runtime_events').insert({
    org_id:  tenantId,
    type:    'property.canonicals_merged',
    status:  'completed',
    payload: {
      primary_id:   primaryId,
      duplicate_id: duplicateId,
      merged_at:    now,
    },
    correlation_id: primaryId,
    event_timestamp: now,
  })

  console.log(`[CanonicalProperty] Merged ${duplicateId} → ${primaryId}`)
}

// ─── Event Emission ───────────────────────────────────────────────────────────

async function emitCanonicalResolved(
  tenantId:    string,
  canonicalId: string,
  wasMerged:   boolean,
  confidence:  number,
): Promise<void> {
  try {
    await supabaseAdmin.from('runtime_events').insert({
      org_id:  tenantId,
      type:    'property.canonical_resolved',
      status:  'completed',
      payload: {
        canonical_id: canonicalId,
        was_merged:   wasMerged,
        confidence,
      },
      correlation_id: canonicalId,
      event_timestamp: new Date().toISOString(),
    })
  } catch (err) {
    // Non-blocking — log but don't fail
    console.warn('[CanonicalProperty] emitCanonicalResolved error:', err)
  }
}
