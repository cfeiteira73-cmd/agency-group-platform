// =============================================================================
// AGENCY GROUP — Market Data Service
// Daily market snapshots by zone/typology for BI and AVM model training
// Reference zones: Lisboa €5.000/m² | Cascais €4.713 | Algarve €3.941
//                  Porto €3.643 | Madeira €3.760 | Açores €1.952
// =============================================================================

import { supabase, supabaseAdmin } from '../supabase'
import type { Database } from '../database.types'

type MarketSnapshot = Database['public']['Tables']['market_snapshots']['Row']
type MarketSnapshotInsert = Database['public']['Tables']['market_snapshots']['Insert']

// ---------------------------------------------------------------------------
// ZONE REFERENCE DATA
// 18 prime zones tracked by Agency Group (Portugal + Madeira + Açores)
// ---------------------------------------------------------------------------

export const AGENCY_ZONES = [
  // Lisboa Metro
  'Chiado',
  'Príncipe Real',
  'Avenidas Novas',
  'Parque das Nações',
  'Belém',
  'Alcântara',
  // Cascais Line
  'Cascais',
  'Estoril',
  'Sintra',
  'Quinta da Marinha',
  // Porto
  'Foz do Douro',
  'Baixa do Porto',
  'Matosinhos',
  'Vila Nova de Gaia',
  // Algarve
  'Vilamoura',
  'Lagos',
  // Islands
  'Funchal',
  'Ponta Delgada',
] as const

export type AgencyZone = (typeof AGENCY_ZONES)[number]

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

/**
 * Get the most recent market snapshot(s).
 * If zone is provided, returns latest snapshot for that zone only.
 * Otherwise returns the latest snapshot for all 18 tracked zones.
 */
export async function getMarketSnapshot(
  zone?: string
): Promise<MarketSnapshot[]> {
  let query = supabase
    .from('market_snapshots')
    .select('*')
    .order('snapshot_date', { ascending: false })

  if (zone) {
    query = query.eq('zone', zone)
  }

  // Limit to most recent entries per zone
  query = query.limit(zone ? 1 : 18)

  const { data, error } = await query
  if (error) throw new Error(`getMarketSnapshot: ${error.message}`)
  return data
}

/**
 * Get market data for all 18 Agency Group tracked zones.
 * Returns the latest snapshot per zone — used for the market intelligence dashboard.
 */
export async function getZoneData(): Promise<MarketSnapshot[]> {
  // Get latest snapshot per zone using distinct on snapshot_date
  const { data, error } = await supabase
    .from('market_snapshots')
    .select('*')
    .in('zone', AGENCY_ZONES)
    .order('snapshot_date', { ascending: false })
    .limit(18 * 5) // buffer for multiple snapshots per zone

  if (error) throw new Error(`getZoneData: ${error.message}`)

  // Deduplicate — keep only the latest per zone
  const latestPerZone = new Map<string, MarketSnapshot>()
  for (const snapshot of data) {
    const key = snapshot.zone ?? snapshot.concelho
    if (!latestPerZone.has(key)) {
      latestPerZone.set(key, snapshot)
    }
  }

  return Array.from(latestPerZone.values())
}

/**
 * Get historical trend data for a zone (last N snapshots).
 */
export async function getZoneTrend(
  zone: string,
  limit = 30
): Promise<MarketSnapshot[]> {
  const { data, error } = await supabase
    .from('market_snapshots')
    .select('*')
    .eq('zone', zone)
    .order('snapshot_date', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getZoneTrend(${zone}): ${error.message}`)
  return data.reverse() // Return chronological order for charting
}

/**
 * Get the hottest zones ranked by hot_score.
 * Used for the "Hot Zones" widget on the dashboard.
 */
export async function getHotZones(limit = 10): Promise<MarketSnapshot[]> {
  // Get latest snapshot per zone
  const allZones = await getZoneData()

  return allZones
    .filter((s) => s.hot_score !== null)
    .sort((a, b) => (b.hot_score ?? 0) - (a.hot_score ?? 0))
    .slice(0, limit)
}

/**
 * Get median price per sqm for a specific zone (latest snapshot).
 * Returns null if no data available.
 */
export async function getZonePricePerSqm(zone: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('market_snapshots')
    .select('median_price_sqm, snapshot_date')
    .eq('zone', zone)
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // No data found
    throw new Error(`getZonePricePerSqm(${zone}): ${error.message}`)
  }

  return data.median_price_sqm
}

// ---------------------------------------------------------------------------
// WRITE
// ---------------------------------------------------------------------------

/**
 * Insert a new market snapshot.
 * Called by n8n Workflow B (Daily Market Intelligence).
 */
export async function insertMarketSnapshot(
  snapshot: MarketSnapshotInsert
): Promise<MarketSnapshot> {
  const { data, error } = await supabase
    .from('market_snapshots')
    .insert(snapshot)
    .select()
    .single()

  if (error) throw new Error(`insertMarketSnapshot: ${error.message}`)
  return data
}

// ---------------------------------------------------------------------------
// ADMIN — SERVER ONLY
// ---------------------------------------------------------------------------

/**
 * SERVER ONLY — use in API routes.
 * Bulk insert daily market snapshots from n8n market intelligence workflow.
 * Uses upsert to handle re-runs without duplicating data (unique on date+concelho+zone+typologia).
 */
export async function bulkInsertMarketSnapshots(
  snapshots: MarketSnapshotInsert[]
): Promise<MarketSnapshot[]> {
  const { data, error } = await supabaseAdmin
    .from('market_snapshots')
    .upsert(snapshots, {
      onConflict: 'snapshot_date,concelho,zone,typologia',
      ignoreDuplicates: false,
    })
    .select()

  if (error) throw new Error(`bulkInsertMarketSnapshots: ${error.message}`)
  return data
}
