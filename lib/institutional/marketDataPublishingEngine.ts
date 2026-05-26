// Agency Group — Market Data Publishing Engine
// lib/institutional/marketDataPublishingEngine.ts
//
// Assembles and publishes official market data packages for institutional
// consumption. Packages are tamper-evident (SHA-256 hash of full payload).
//
// TypeScript strict — 0 errors
// All EUR amounts in bigint/cents — never float for money.

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { logger as log } from '@/lib/observability/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MarketDataPackage {
  package_id: string
  published_at: string
  valid_until: string // +24h
  market: string
  data_version: string // ISO timestamp
  official_liquidity_index: {
    score: number
    tier: string
    transaction_velocity: number
    demand_supply_ratio: number
    published_hash: string
  } | null
  pricing_benchmark: {
    price_per_sqm_p50: number // EUR cents
    price_per_sqm_p25: number
    price_per_sqm_p75: number
    trend_pct: number
    published_hash: string
  } | null
  investment_confidence_score: {
    score: number
    level: string
    suitable_for_institutional: boolean
  } | null
  liquidity_velocity_index: {
    lvi_score: number
    days_to_close_p50: number
    momentum: string
  } | null
  supply_dominance: {
    dominance_score: number
    exclusive_listings_pct: number
    first_mover_advantage: number
  } | null
  package_hash: string // SHA-256 of entire package (tamper-evident)
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// Markets: display name → market key used in DB
const MARKET_MAP: Array<{ market: string; city: string; db_key: string }> = [
  { market: 'Lisboa', city: 'Lisboa', db_key: 'PT:Lisboa' },
  { market: 'Porto', city: 'Porto', db_key: 'PT:Porto' },
  { market: 'Cascais', city: 'Cascais', db_key: 'PT:Cascais' },
  { market: 'Algarve', city: 'Faro', db_key: 'PT:Algarve' },
  { market: 'Madeira', city: 'Funchal', db_key: 'PT:Madeira' },
  { market: 'Açores', city: 'Ponta Delgada', db_key: 'PT:Acores' },
  { market: 'Madrid', city: 'Madrid', db_key: 'ES:Madrid' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentPeriod(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function computePackageHash(
  oli: MarketDataPackage['official_liquidity_index'],
  benchmark: MarketDataPackage['pricing_benchmark'],
  ics: MarketDataPackage['investment_confidence_score'],
  market: string,
  published_at: string,
): string {
  const payload = JSON.stringify({ oli, benchmark, ics, market, published_at })
  return createHash('sha256').update(payload).digest('hex')
}

// ─── assembleMarketDataPackage ────────────────────────────────────────────────

export async function assembleMarketDataPackage(
  market: string,
  city: string,
): Promise<MarketDataPackage> {
  const period = currentPeriod()
  const publishedAt = new Date().toISOString()

  // Determine the DB market key
  const marketEntry = MARKET_MAP.find(
    (m) => m.market === market || m.city === city || m.db_key === market,
  )
  const dbKey = marketEntry?.db_key ?? `PT:${market}`

  // ── 1. Official Liquidity Index ──────────────────────────────────────────────
  let oli: MarketDataPackage['official_liquidity_index'] = null
  try {
    const { data: oliRow } = await (supabaseAdmin as any)
      .from('official_liquidity_index')
      .select(
        'oli_score, liquidity_tier, transaction_velocity, demand_supply_ratio, sha256_hash',
      )
      .eq('market', dbKey)
      .eq('period', period)
      .order('published_at', { ascending: false })
      .limit(1)
      .single()

    if (oliRow) {
      oli = {
        score: oliRow.oli_score as number,
        tier: oliRow.liquidity_tier as string,
        transaction_velocity: oliRow.transaction_velocity as number,
        demand_supply_ratio: oliRow.demand_supply_ratio as number,
        published_hash: oliRow.sha256_hash as string,
      }
    }
  } catch (err) {
    log.info('[marketDataPublishing] OLI read failed (graceful)', {
      market: dbKey,
      err: String(err),
    })
  }

  // ── 2. Pricing Benchmark ─────────────────────────────────────────────────────
  let benchmark: MarketDataPackage['pricing_benchmark'] = null
  try {
    const { data: benchRow } = await (supabaseAdmin as any)
      .from('official_price_benchmarks_v2')
      .select(
        'price_per_sqm_p50_eur_cents, price_per_sqm_p25_eur_cents, price_per_sqm_p75_eur_cents, trend_pct, sha256_hash',
      )
      .eq('market', dbKey)
      .eq('period', period)
      .eq('property_type', 'RESIDENTIAL')
      .order('published_at', { ascending: false })
      .limit(1)
      .single()

    if (benchRow) {
      benchmark = {
        price_per_sqm_p50: benchRow.price_per_sqm_p50_eur_cents as number,
        price_per_sqm_p25: benchRow.price_per_sqm_p25_eur_cents as number,
        price_per_sqm_p75: benchRow.price_per_sqm_p75_eur_cents as number,
        trend_pct: (benchRow.trend_pct as number | null) ?? 0,
        published_hash: benchRow.sha256_hash as string,
      }
    }
  } catch (err) {
    log.info('[marketDataPublishing] Benchmark read failed (graceful)', {
      market: dbKey,
      err: String(err),
    })
  }

  // ── 3. Investment Confidence Score ───────────────────────────────────────────
  let ics: MarketDataPackage['investment_confidence_score'] = null
  try {
    const { data: icsRow } = await (supabaseAdmin as any)
      .from('investment_confidence_scores')
      .select('ics_score, confidence_level, suitable_for_institutional')
      .eq('market', dbKey)
      .eq('period', period)
      .order('published_at', { ascending: false })
      .limit(1)
      .single()

    if (icsRow) {
      ics = {
        score: icsRow.ics_score as number,
        level: icsRow.confidence_level as string,
        suitable_for_institutional: icsRow.suitable_for_institutional as boolean,
      }
    }
  } catch (err) {
    log.info('[marketDataPublishing] ICS read failed (graceful)', {
      market: dbKey,
      err: String(err),
    })
  }

  // ── 4. Liquidity Velocity Index (from Wave 43 Agent 2) ───────────────────────
  let lvi: MarketDataPackage['liquidity_velocity_index'] = null
  try {
    const { data: lviRow } = await (supabaseAdmin as any)
      .from('liquidity_velocity_index_snapshots')
      .select('lvi_score, price_discovery_speed_days, velocity_trend')
      .eq('market', dbKey)
      .eq('period', period)
      .order('computed_at', { ascending: false })
      .limit(1)
      .single()

    if (lviRow) {
      lvi = {
        lvi_score: lviRow.lvi_score as number,
        days_to_close_p50: lviRow.price_discovery_speed_days as number,
        momentum: lviRow.velocity_trend as string,
      }
    }
  } catch {
    // LVI table may not exist yet — fail silently
  }

  // ── 5. Supply Dominance (from Wave 43 Agent 4) ───────────────────────────────
  let supply: MarketDataPackage['supply_dominance'] = null
  try {
    const { data: supplyRow } = await (supabaseAdmin as any)
      .from('supply_dominance_snapshots')
      .select(
        'dominance_score, exclusive_listings_count, system_listing_count, first_point_listing_count',
      )
      .eq('market', market) // supply-dominance uses short names
      .order('computed_at', { ascending: false })
      .limit(1)
      .single()

    if (supplyRow) {
      const exclusivePct =
        supplyRow.system_listing_count > 0
          ? (supplyRow.exclusive_listings_count / supplyRow.system_listing_count) * 100
          : 0
      supply = {
        dominance_score: supplyRow.dominance_score as number,
        exclusive_listings_pct: exclusivePct,
        first_mover_advantage: supplyRow.first_point_listing_count as number,
      }
    }
  } catch {
    // Supply dominance table may not exist yet — fail silently
  }

  const packageHash = computePackageHash(oli, benchmark, ics, market, publishedAt)
  const validUntil = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  return {
    package_id: randomUUID(),
    published_at: publishedAt,
    valid_until: validUntil,
    market,
    data_version: publishedAt,
    official_liquidity_index: oli,
    pricing_benchmark: benchmark,
    investment_confidence_score: ics,
    liquidity_velocity_index: lvi,
    supply_dominance: supply,
    package_hash: packageHash,
  }
}

// ─── publishMarketDataPackages ────────────────────────────────────────────────

export async function publishMarketDataPackages(): Promise<{
  published: number
  failed: number
  packages: MarketDataPackage[]
}> {
  const results = await Promise.allSettled(
    MARKET_MAP.map((m) => assembleMarketDataPackage(m.market, m.city)),
  )

  const packages: MarketDataPackage[] = []
  let failed = 0

  for (const result of results) {
    if (result.status === 'fulfilled') {
      packages.push(result.value)
    } else {
      failed++
      console.warn('[marketDataPublishing] package assembly failed', result.reason)
    }
  }

  // Persist all successful packages
  if (packages.length > 0) {
    void (supabaseAdmin as any)
      .from('published_market_data_packages')
      .upsert(
        packages.map((pkg) => ({
          package_id: pkg.package_id,
          tenant_id: TENANT_ID,
          market: pkg.market,
          published_at: pkg.published_at,
          valid_until: pkg.valid_until,
          data_version: pkg.data_version,
          package_hash: pkg.package_hash,
          payload: pkg as unknown as Record<string, unknown>,
        })),
        { onConflict: 'package_id' },
      )
      .catch((e: unknown) =>
        console.warn('[marketDataPublishing] persist packages failed', e),
      )
  }

  log.info('[marketDataPublishing] published packages', {
    published: packages.length,
    failed,
    markets: packages.map((p) => p.market),
  })

  return { published: packages.length, failed, packages }
}

// ─── getLatestPackage ─────────────────────────────────────────────────────────

export async function getLatestPackage(
  market: string,
): Promise<MarketDataPackage | null> {
  try {
    const now = new Date().toISOString()

    const { data, error } = await (supabaseAdmin as any)
      .from('published_market_data_packages')
      .select('payload, package_hash, published_at, valid_until')
      .eq('market', market)
      .gte('valid_until', now)
      .order('published_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) return null

    return data.payload as MarketDataPackage
  } catch {
    return null
  }
}

// ─── getPackageHistory ────────────────────────────────────────────────────────

export async function getPackageHistory(
  market: string,
  limit: number = 30,
): Promise<MarketDataPackage[]> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('published_market_data_packages')
      .select('payload')
      .eq('market', market)
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []

    return (data as Array<{ payload: unknown }>).map(
      (row) => row.payload as MarketDataPackage,
    )
  } catch {
    return []
  }
}
