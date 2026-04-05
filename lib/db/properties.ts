// =============================================================================
// AGENCY GROUP — Properties Service
// Managed listings: exclusives, mandates, off-market, investor pipeline
// Semantic search via pgvector 1536-dim (match_properties RPC)
// =============================================================================

import { supabase, supabaseAdmin } from '../supabase'
import type { Database, PropertyStatus, PropertyType } from '../database.types'

type Property = Database['public']['Tables']['properties']['Row']
type PropertyInsert = Database['public']['Tables']['properties']['Insert']
type PropertyUpdate = Database['public']['Tables']['properties']['Update']

// ---------------------------------------------------------------------------
// FILTER TYPES
// ---------------------------------------------------------------------------

export interface PropertyFilters {
  zone?: string
  city?: string
  type?: PropertyType
  status?: PropertyStatus
  minPrice?: number
  maxPrice?: number
  minBedrooms?: number
  maxBedrooms?: number
  isExclusive?: boolean
  isOffMarket?: boolean
  investorSuitable?: boolean
}

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

/**
 * Get properties with optional filters.
 * Ordered by opportunity_score desc — highest opportunity first.
 */
export async function getProperties(
  filters?: PropertyFilters,
  limit = 100
): Promise<Property[]> {
  let query = supabase
    .from('properties')
    .select('*')
    .order('opportunity_score', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (filters?.zone) query = query.eq('zone', filters.zone)
  if (filters?.city) query = query.eq('city', filters.city)
  if (filters?.type) query = query.eq('type', filters.type)
  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.minPrice !== undefined) query = query.gte('price', filters.minPrice)
  if (filters?.maxPrice !== undefined) query = query.lte('price', filters.maxPrice)
  if (filters?.minBedrooms !== undefined) query = query.gte('bedrooms', filters.minBedrooms)
  if (filters?.maxBedrooms !== undefined) query = query.lte('bedrooms', filters.maxBedrooms)
  if (filters?.isExclusive !== undefined) query = query.eq('is_exclusive', filters.isExclusive)
  if (filters?.isOffMarket !== undefined) query = query.eq('is_off_market', filters.isOffMarket)
  if (filters?.investorSuitable !== undefined) {
    query = query.eq('investor_suitable', filters.investorSuitable)
  }

  const { data, error } = await query
  if (error) throw new Error(`getProperties: ${error.message}`)
  return data
}

/**
 * Get a single property by ID.
 */
export async function getPropertyById(id: string): Promise<Property> {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(`getPropertyById(${id}): ${error.message}`)
  return data
}

/**
 * Get active listings suitable for investor deal memos.
 */
export async function getInvestorProperties(limit = 20): Promise<Property[]> {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('investor_suitable', true)
    .eq('status', 'active')
    .order('opportunity_score', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getInvestorProperties: ${error.message}`)
  return data
}

/**
 * Get off-market properties for private distribution.
 */
export async function getOffMarketProperties(): Promise<Property[]> {
  const { data, error } = await supabase
    .from('properties')
    .select('*')
    .eq('is_off_market', true)
    .eq('status', 'active')
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getOffMarketProperties: ${error.message}`)
  return data
}

/**
 * Semantic vector search — calls match_properties() RPC.
 * Requires pgvector extension and 1536-dim embedding on properties table.
 *
 * @param embedding - 1536-dim float array from OpenAI or Voyage AI
 * @param matchThreshold - cosine similarity threshold (0-1), default 0.7
 * @param matchCount - max results, default 10
 * @param filters - additional metadata filters passed to RPC
 */
export async function searchPropertiesVector(
  embedding: number[],
  matchThreshold = 0.7,
  matchCount = 10,
  filters?: Record<string, unknown>
): Promise<
  Array<{
    id: string
    title: string
    zone: string | null
    price: number
    type: PropertyType
    bedrooms: number | null
    area_m2: number | null
    similarity: number
  }>
> {
  const { data, error } = await supabase.rpc('match_properties', {
    query_embedding: embedding,
    match_threshold: matchThreshold,
    match_count: matchCount,
    filter: filters ?? {},
  })

  if (error) throw new Error(`searchPropertiesVector: ${error.message}`)
  return data
}

// ---------------------------------------------------------------------------
// WRITE
// ---------------------------------------------------------------------------

/**
 * Upsert a property. Useful for scraper pipelines and manual entry.
 */
export async function upsertProperty(property: PropertyInsert): Promise<Property> {
  const { data, error } = await supabase
    .from('properties')
    .upsert({
      ...property,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw new Error(`upsertProperty: ${error.message}`)
  return data
}

/**
 * Update a property by ID.
 */
export async function updateProperty(
  id: string,
  updates: PropertyUpdate
): Promise<Property> {
  const { data, error } = await supabase
    .from('properties')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`updateProperty(${id}): ${error.message}`)
  return data
}

/**
 * Increment views_total counter for a property.
 */
export async function incrementPropertyViews(id: string): Promise<void> {
  const property = await getPropertyById(id)

  const { error } = await supabase
    .from('properties')
    .update({
      views_total: (property.views_total ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(`incrementPropertyViews(${id}): ${error.message}`)
}

// ---------------------------------------------------------------------------
// ADMIN — SERVER ONLY
// ---------------------------------------------------------------------------

/**
 * SERVER ONLY — use in API routes.
 * Bulk upsert properties from scraper pipeline.
 */
export async function bulkUpsertProperties(
  properties: PropertyInsert[]
): Promise<Property[]> {
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('properties')
    .upsert(properties.map((p) => ({ ...p, updated_at: now })))
    .select()

  if (error) throw new Error(`bulkUpsertProperties: ${error.message}`)
  return data
}

/**
 * SERVER ONLY — use in API routes.
 * Store the pgvector embedding for semantic matching.
 */
export async function setPropertyEmbedding(
  id: string,
  embedding: number[]
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('properties')
    .update({
      embedding,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(`setPropertyEmbedding(${id}): ${error.message}`)
}
