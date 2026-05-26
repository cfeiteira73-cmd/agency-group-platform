// =============================================================================
// Agency Group — Canonical Asset Graph v1.0
// Wave 42 | lib/normalization/canonicalAssetGraph.ts
// TypeScript strict — 0 errors
//
// The canonical asset is the single source of truth.
// This module manages the graph: relationships between assets, sources,
// markets, and investors.
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { haversineDistance } from '@/lib/normalization/deduplicationEngine'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssetLineage {
  asset_id: string
  tenant_id: string
  source_records: Array<{
    source: string
    source_id: string
    url: string | null
    fetched_at: string
    confidence: number
    is_primary: boolean
  }>
  normalization_history: Array<{
    normalized_at: string
    changes: string[]
    trigger: string
  }>
  price_timeline: Array<{
    price_eur_cents: number
    date: string
    source: string
    is_observed: boolean
  }>
  view_count: number
  bid_count: number
  closed: boolean
}

export interface AssetRelationship {
  asset_id: string
  related_asset_id: string
  relationship_type: 'SAME_BUILDING' | 'SAME_STREET' | 'COMPARABLE' | 'DUPLICATE'
  similarity_score: number  // 0–1
  detected_at: string
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function emptyLineage(assetId: string, tenantId: string): AssetLineage {
  return {
    asset_id: assetId,
    tenant_id: tenantId,
    source_records: [],
    normalization_history: [],
    price_timeline: [],
    view_count: 0,
    bid_count: 0,
    closed: false,
  }
}

function rowToLineage(row: Record<string, unknown>): AssetLineage {
  const rawSourceRecords = row['source_records']
  const sourceRecords = Array.isArray(rawSourceRecords)
    ? (rawSourceRecords as AssetLineage['source_records'])
    : []

  const rawNormHistory = row['normalization_history']
  const normalizationHistory = Array.isArray(rawNormHistory)
    ? (rawNormHistory as AssetLineage['normalization_history'])
    : []

  const rawPriceTimeline = row['price_timeline']
  const priceTimeline = Array.isArray(rawPriceTimeline)
    ? (rawPriceTimeline as AssetLineage['price_timeline'])
    : []

  return {
    asset_id: String(row['asset_id'] ?? ''),
    tenant_id: String(row['tenant_id'] ?? ''),
    source_records: sourceRecords,
    normalization_history: normalizationHistory,
    price_timeline: priceTimeline,
    view_count: Number(row['view_count'] ?? 0),
    bid_count: Number(row['bid_count'] ?? 0),
    closed: Boolean(row['closed']),
  }
}

function rowToRelationship(row: Record<string, unknown>): AssetRelationship {
  const validTypes = ['SAME_BUILDING', 'SAME_STREET', 'COMPARABLE', 'DUPLICATE'] as const
  type RelType = typeof validTypes[number]
  const rawType = String(row['relationship_type'] ?? 'COMPARABLE')
  const relationshipType: RelType = validTypes.includes(rawType as RelType)
    ? (rawType as RelType)
    : 'COMPARABLE'

  return {
    asset_id: String(row['asset_id'] ?? ''),
    related_asset_id: String(row['related_asset_id'] ?? ''),
    relationship_type: relationshipType,
    similarity_score: Number(row['similarity_score'] ?? 0),
    detected_at: String(row['detected_at'] ?? new Date().toISOString()),
  }
}

// ─── Public Functions ─────────────────────────────────────────────────────────

/**
 * Reads asset lineage from asset_lineage_records + enriches with raw_opportunity_stream.
 */
export async function getAssetLineage(
  assetId: string,
  tenantId: string
): Promise<AssetLineage> {
  // Primary: read from asset_lineage_records
  const { data: lineageRow, error: lineageError } = await (supabaseAdmin as any)
    .from('asset_lineage_records')
    .select('*')
    .eq('asset_id', assetId)
    .eq('tenant_id', tenantId)
    .single()

  let lineage: AssetLineage
  if (lineageError || !lineageRow) {
    lineage = emptyLineage(assetId, tenantId)
  } else {
    lineage = rowToLineage(lineageRow as Record<string, unknown>)
  }

  // Enrich source_records from raw_opportunity_stream if empty
  if (lineage.source_records.length === 0) {
    const { data: rawRecords } = await (supabaseAdmin as any)
      .from('raw_opportunity_stream')
      .select('source, external_id, url, fetched_at, confidence')
      .eq('asset_id', assetId)
      .eq('tenant_id', tenantId)
      .order('fetched_at', { ascending: true })

    if (Array.isArray(rawRecords) && rawRecords.length > 0) {
      lineage.source_records = (rawRecords as Record<string, unknown>[]).map(
        (r, idx) => ({
          source: String(r['source'] ?? 'UNKNOWN'),
          source_id: String(r['external_id'] ?? ''),
          url: r['url'] != null ? String(r['url']) : null,
          fetched_at: String(r['fetched_at'] ?? new Date().toISOString()),
          confidence: Number(r['confidence'] ?? 0.7),
          is_primary: idx === 0,
        })
      )
    }
  }

  return lineage
}

/**
 * Increments view count and fires event to asset_interaction_events.
 */
export async function recordAssetView(
  assetId: string,
  tenantId: string,
  investorId?: string
): Promise<void> {
  // Increment view_count in asset_lineage_records (upsert if not exists)
  const { data: existing } = await (supabaseAdmin as any)
    .from('asset_lineage_records')
    .select('view_count')
    .eq('asset_id', assetId)
    .eq('tenant_id', tenantId)
    .single()

  const currentViewCount: number = existing ? Number((existing as Record<string, unknown>)['view_count'] ?? 0) : 0

  void (supabaseAdmin as any)
    .from('asset_lineage_records')
    .upsert(
      {
        asset_id: assetId,
        tenant_id: tenantId,
        view_count: currentViewCount + 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'asset_id' }
    )
    .then(({ error }: { error: unknown }) => {
      if (error) log.warn('[canonicalAssetGraph] view_count upsert error', { error, assetId })
    })
    .catch((e: unknown) => log.warn('[canonicalAssetGraph] view_count upsert exception', { e, assetId }))

  // Fire event
  void (supabaseAdmin as any)
    .from('asset_interaction_events')
    .insert({
      tenant_id: tenantId,
      asset_id: assetId,
      investor_id: investorId ?? null,
      event_type: 'VIEW',
      amount_eur_cents: null,
      occurred_at: new Date().toISOString(),
    })
    .then(({ error }: { error: unknown }) => {
      if (error) log.warn('[canonicalAssetGraph] view event insert error', { error, assetId })
    })
    .catch((e: unknown) => log.warn('[canonicalAssetGraph] view event exception', { e, assetId }))
}

/**
 * Records a bid in asset_interaction_events and updates bid_count.
 */
export async function recordAssetBid(
  assetId: string,
  tenantId: string,
  investorId: string,
  bidAmountEurCents: number
): Promise<void> {
  // Increment bid_count
  const { data: existing } = await (supabaseAdmin as any)
    .from('asset_lineage_records')
    .select('bid_count')
    .eq('asset_id', assetId)
    .eq('tenant_id', tenantId)
    .single()

  const currentBidCount: number = existing ? Number((existing as Record<string, unknown>)['bid_count'] ?? 0) : 0

  void (supabaseAdmin as any)
    .from('asset_lineage_records')
    .upsert(
      {
        asset_id: assetId,
        tenant_id: tenantId,
        bid_count: currentBidCount + 1,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'asset_id' }
    )
    .then(({ error }: { error: unknown }) => {
      if (error) log.warn('[canonicalAssetGraph] bid_count upsert error', { error, assetId })
    })
    .catch((e: unknown) => log.warn('[canonicalAssetGraph] bid_count upsert exception', { e, assetId }))

  // Record bid event
  void (supabaseAdmin as any)
    .from('asset_interaction_events')
    .insert({
      tenant_id: tenantId,
      asset_id: assetId,
      investor_id: investorId,
      event_type: 'BID',
      amount_eur_cents: bidAmountEurCents,
      occurred_at: new Date().toISOString(),
    })
    .then(({ error }: { error: unknown }) => {
      if (error) log.warn('[canonicalAssetGraph] bid event insert error', { error, assetId })
    })
    .catch((e: unknown) => log.warn('[canonicalAssetGraph] bid event exception', { e, assetId }))
}

/**
 * Detects duplicates for an asset based on coordinates, price, and size.
 * Checks assets within 500m radius, similar price, same size ± 10%.
 * Persists relationships to asset_relationships.
 */
export async function detectDuplicates(
  assetId: string,
  tenantId: string
): Promise<AssetRelationship[]> {
  // Fetch the asset
  const { data: asset, error: assetError } = await (supabaseAdmin as any)
    .from('canonical_assets_v2')
    .select('*')
    .eq('asset_id', assetId)
    .eq('tenant_id', tenantId)
    .single()

  if (assetError || !asset) {
    log.warn('[canonicalAssetGraph] detectDuplicates asset not found', { assetId, assetError })
    return []
  }

  const a = asset as Record<string, unknown>
  const aLat = a['latitude'] != null ? Number(a['latitude']) : null
  const aLon = a['longitude'] != null ? Number(a['longitude']) : null
  const aPrice = Number(a['asking_price_eur_cents'] ?? 0)
  const aSize = a['size_sqm'] != null ? Number(a['size_sqm']) : null
  const aCity = String(a['city'] ?? '')

  // Fetch candidates in same city (exclude self)
  const { data: candidates, error: candidatesError } = await (supabaseAdmin as any)
    .from('canonical_assets_v2')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('city', aCity)
    .neq('asset_id', assetId)
    .neq('normalization_status', 'DEDUPLICATED')
    .limit(200)

  if (candidatesError || !candidates) {
    log.warn('[canonicalAssetGraph] detectDuplicates candidates error', { candidatesError })
    return []
  }

  const relationships: AssetRelationship[] = []

  for (const candidate of candidates as Record<string, unknown>[]) {
    const bLat = candidate['latitude'] != null ? Number(candidate['latitude']) : null
    const bLon = candidate['longitude'] != null ? Number(candidate['longitude']) : null
    const bPrice = Number(candidate['asking_price_eur_cents'] ?? 0)
    const bSize = candidate['size_sqm'] != null ? Number(candidate['size_sqm']) : null
    const bAssetId = String(candidate['asset_id'] ?? '')

    // Coordinate proximity
    let withinRadius = false
    if (aLat !== null && aLon !== null && bLat !== null && bLon !== null) {
      const distMeters = haversineDistance(aLat, aLon, bLat, bLon)
      withinRadius = distMeters <= 500
    }

    // Price similarity (within 5%)
    const priceClose = aPrice > 0 && bPrice > 0
      ? Math.abs(aPrice - bPrice) / Math.max(aPrice, bPrice) <= 0.05
      : false

    // Size similarity (within 10%)
    const sizeClose = aSize !== null && bSize !== null && aSize > 0 && bSize > 0
      ? Math.abs(aSize - bSize) / Math.max(aSize, bSize) <= 0.10
      : false

    // Compute simple similarity score for duplicate detection
    let score = 0
    if (withinRadius) score += 0.40
    if (priceClose) score += 0.35
    if (sizeClose) score += 0.25

    if (score < 0.35) continue  // not worth recording

    const relationshipType: AssetRelationship['relationship_type'] =
      score >= 0.75 ? 'DUPLICATE' :
      score >= 0.55 ? 'COMPARABLE' :
      withinRadius ? 'SAME_BUILDING' :
      'COMPARABLE'

    const relationship: AssetRelationship = {
      asset_id: assetId,
      related_asset_id: bAssetId,
      relationship_type: relationshipType,
      similarity_score: score,
      detected_at: new Date().toISOString(),
    }
    relationships.push(relationship)

    // Persist relationship (upsert)
    void (supabaseAdmin as any)
      .from('asset_relationships')
      .upsert(
        {
          asset_id: assetId,
          related_asset_id: bAssetId,
          tenant_id: tenantId,
          relationship_type: relationshipType,
          similarity_score: score,
          detected_at: relationship.detected_at,
        },
        { onConflict: 'asset_id,related_asset_id' }
      )
      .then(({ error }: { error: unknown }) => {
        if (error) log.warn('[canonicalAssetGraph] relationship upsert error', { error, assetId })
      })
      .catch((e: unknown) => log.warn('[canonicalAssetGraph] relationship upsert exception', { e, assetId }))
  }

  return relationships
}

/**
 * Merges duplicate into primary:
 * - Adds duplicate's source_ids to primary
 * - Marks duplicate as DEDUPLICATED
 * - Preserves full lineage
 */
export async function mergeAssets(
  primaryId: string,
  duplicateId: string,
  tenantId: string
): Promise<void> {
  // Fetch both assets
  const [{ data: primary, error: primaryError }, { data: duplicate, error: dupError }] =
    await Promise.all([
      (supabaseAdmin as any)
        .from('canonical_assets_v2')
        .select('*')
        .eq('asset_id', primaryId)
        .eq('tenant_id', tenantId)
        .single(),
      (supabaseAdmin as any)
        .from('canonical_assets_v2')
        .select('*')
        .eq('asset_id', duplicateId)
        .eq('tenant_id', tenantId)
        .single(),
    ])

  if (primaryError || !primary || dupError || !duplicate) {
    log.warn('[canonicalAssetGraph] mergeAssets missing assets', { primaryId, duplicateId, primaryError, dupError })
    return
  }

  const primaryRow = primary as Record<string, unknown>
  const duplicateRow = duplicate as Record<string, unknown>

  // Merge source_ids
  const primarySourceIds: Record<string, string> =
    primaryRow['source_ids'] && typeof primaryRow['source_ids'] === 'object' && !Array.isArray(primaryRow['source_ids'])
      ? (primaryRow['source_ids'] as Record<string, string>)
      : {}
  const duplicateSourceIds: Record<string, string> =
    duplicateRow['source_ids'] && typeof duplicateRow['source_ids'] === 'object' && !Array.isArray(duplicateRow['source_ids'])
      ? (duplicateRow['source_ids'] as Record<string, string>)
      : {}

  const mergedSourceIds = { ...duplicateSourceIds, ...primarySourceIds }  // primary wins on conflict

  // Update primary with merged source_ids
  void (supabaseAdmin as any)
    .from('canonical_assets_v2')
    .update({
      source_ids: mergedSourceIds,
      last_updated_at: new Date().toISOString(),
    })
    .eq('asset_id', primaryId)
    .eq('tenant_id', tenantId)
    .then(({ error }: { error: unknown }) => {
      if (error) log.warn('[canonicalAssetGraph] mergeAssets primary update error', { error, primaryId })
    })
    .catch((e: unknown) => log.warn('[canonicalAssetGraph] mergeAssets primary update exception', { e, primaryId }))

  // Mark duplicate as DEDUPLICATED
  void (supabaseAdmin as any)
    .from('canonical_assets_v2')
    .update({
      normalization_status: 'DEDUPLICATED',
      last_updated_at: new Date().toISOString(),
    })
    .eq('asset_id', duplicateId)
    .eq('tenant_id', tenantId)
    .then(({ error }: { error: unknown }) => {
      if (error) log.warn('[canonicalAssetGraph] mergeAssets duplicate update error', { error, duplicateId })
    })
    .catch((e: unknown) => log.warn('[canonicalAssetGraph] mergeAssets duplicate update exception', { e, duplicateId }))

  // Merge lineage records
  const [{ data: primaryLineage }, { data: duplicateLineage }] = await Promise.all([
    (supabaseAdmin as any)
      .from('asset_lineage_records')
      .select('*')
      .eq('asset_id', primaryId)
      .eq('tenant_id', tenantId)
      .single(),
    (supabaseAdmin as any)
      .from('asset_lineage_records')
      .select('*')
      .eq('asset_id', duplicateId)
      .eq('tenant_id', tenantId)
      .single(),
  ])

  if (duplicateLineage) {
    const dupLineageRow = duplicateLineage as Record<string, unknown>
    const primLineageRow = primaryLineage ? (primaryLineage as Record<string, unknown>) : null

    const dupSourceRecords = Array.isArray(dupLineageRow['source_records'])
      ? (dupLineageRow['source_records'] as unknown[])
      : []
    const primSourceRecords = primLineageRow && Array.isArray(primLineageRow['source_records'])
      ? (primLineageRow['source_records'] as unknown[])
      : []

    const mergedSourceRecords = [...primSourceRecords, ...dupSourceRecords]

    const mergeHistoryEntry = {
      normalized_at: new Date().toISOString(),
      changes: [`Merged duplicate asset ${duplicateId} into primary ${primaryId}`],
      trigger: 'MERGE',
    }

    const primNormHistory = primLineageRow && Array.isArray(primLineageRow['normalization_history'])
      ? (primLineageRow['normalization_history'] as unknown[])
      : []

    void (supabaseAdmin as any)
      .from('asset_lineage_records')
      .upsert(
        {
          asset_id: primaryId,
          tenant_id: tenantId,
          source_records: mergedSourceRecords,
          normalization_history: [...primNormHistory, mergeHistoryEntry],
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'asset_id' }
      )
      .then(({ error }: { error: unknown }) => {
        if (error) log.warn('[canonicalAssetGraph] mergeAssets lineage upsert error', { error, primaryId })
      })
      .catch((e: unknown) => log.warn('[canonicalAssetGraph] mergeAssets lineage upsert exception', { e, primaryId }))
  }

  // Record DUPLICATE relationship
  void (supabaseAdmin as any)
    .from('asset_relationships')
    .upsert(
      {
        asset_id: primaryId,
        related_asset_id: duplicateId,
        tenant_id: tenantId,
        relationship_type: 'DUPLICATE',
        similarity_score: 1.0,
        detected_at: new Date().toISOString(),
      },
      { onConflict: 'asset_id,related_asset_id' }
    )
    .then(({ error }: { error: unknown }) => {
      if (error) log.warn('[canonicalAssetGraph] mergeAssets relationship error', { error })
    })
    .catch((e: unknown) => log.warn('[canonicalAssetGraph] mergeAssets relationship exception', { e }))

  log.info('[canonicalAssetGraph] mergeAssets complete', { primaryId, duplicateId, tenantId })
}

/**
 * Reads all relationships for an asset.
 */
export async function getAssetRelationships(
  assetId: string,
  tenantId: string
): Promise<AssetRelationship[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('asset_relationships')
    .select('*')
    .eq('tenant_id', tenantId)
    .or(`asset_id.eq.${assetId},related_asset_id.eq.${assetId}`)
    .order('detected_at', { ascending: false })

  if (error || !data) {
    log.warn('[canonicalAssetGraph] getAssetRelationships error', { error, assetId })
    return []
  }

  return (data as Record<string, unknown>[]).map(rowToRelationship)
}
