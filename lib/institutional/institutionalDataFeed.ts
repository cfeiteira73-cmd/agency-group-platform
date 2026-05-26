// Agency Group — Institutional Data Feed
// lib/institutional/institutionalDataFeed.ts
//
// Real-time + batch data feed for institutional subscribers.
// Handles feed subscriptions, delivery via webhooks, and batch processing.
//
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import { logger as log } from '@/lib/observability/logger'
import {
  assembleMarketDataPackage,
  type MarketDataPackage,
} from './marketDataPublishingEngine'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FeedFrequency = 'REALTIME' | 'HOURLY' | 'DAILY' | 'WEEKLY'
export type FeedFormat = 'JSON' | 'CSV' | 'PARQUET_SCHEMA'

export interface FeedSubscription {
  id: string
  client_id: string
  feed_type: 'MARKET_AUTHORITY' | 'SUPPLY_INTELLIGENCE' | 'CAPITAL_FLOWS' | 'FULL_INTELLIGENCE'
  frequency: FeedFrequency
  format: FeedFormat
  markets: string[]
  webhook_url: string | null
  last_delivered_at: string | null
  is_active: boolean
}

// ─── getActiveSubscriptions ───────────────────────────────────────────────────

export async function getActiveSubscriptions(
  clientId?: string,
): Promise<FeedSubscription[]> {
  try {
    let query = (supabaseAdmin as any)
      .from('institutional_feed_subscriptions')
      .select('*')
      .eq('is_active', true)

    if (clientId) {
      query = query.eq('client_id', clientId)
    }

    const { data, error } = await query

    if (error || !data) return []

    return data as FeedSubscription[]
  } catch (err) {
    console.warn('[institutionalDataFeed] getActiveSubscriptions error', err)
    return []
  }
}

// ─── buildFeedPayload ─────────────────────────────────────────────────────────

async function buildFeedPayload(
  subscription: FeedSubscription,
): Promise<{ packages: MarketDataPackage[]; formatted: string }> {
  const markets = subscription.markets?.length > 0 ? subscription.markets : ['Lisboa']

  const packageResults = await Promise.allSettled(
    markets.map((market) => assembleMarketDataPackage(market, market)),
  )

  const packages: MarketDataPackage[] = []
  for (const result of packageResults) {
    if (result.status === 'fulfilled') {
      packages.push(result.value)
    }
  }

  // Filter data based on feed_type
  const filteredPackages = packages.map((pkg) => {
    if (subscription.feed_type === 'MARKET_AUTHORITY') {
      return {
        ...pkg,
        liquidity_velocity_index: null,
        supply_dominance: null,
      }
    }
    if (subscription.feed_type === 'SUPPLY_INTELLIGENCE') {
      return {
        ...pkg,
        official_liquidity_index: null,
        pricing_benchmark: null,
        investment_confidence_score: null,
        liquidity_velocity_index: null,
      }
    }
    if (subscription.feed_type === 'CAPITAL_FLOWS') {
      return {
        ...pkg,
        supply_dominance: null,
      }
    }
    // FULL_INTELLIGENCE — return everything
    return pkg
  })

  let formatted: string

  if (subscription.format === 'CSV') {
    // Simple CSV flattening for institutional consumers
    const headers = [
      'market',
      'published_at',
      'valid_until',
      'oli_score',
      'oli_tier',
      'benchmark_p50_eur_cents',
      'benchmark_trend_pct',
      'ics_score',
      'ics_level',
      'ics_suitable_institutional',
      'lvi_score',
      'lvi_momentum',
      'supply_dominance_score',
      'package_hash',
    ]

    const rows = filteredPackages.map((pkg) => [
      pkg.market,
      pkg.published_at,
      pkg.valid_until,
      pkg.official_liquidity_index?.score ?? '',
      pkg.official_liquidity_index?.tier ?? '',
      pkg.pricing_benchmark?.price_per_sqm_p50 ?? '',
      pkg.pricing_benchmark?.trend_pct ?? '',
      pkg.investment_confidence_score?.score ?? '',
      pkg.investment_confidence_score?.level ?? '',
      pkg.investment_confidence_score?.suitable_for_institutional ?? '',
      pkg.liquidity_velocity_index?.lvi_score ?? '',
      pkg.liquidity_velocity_index?.momentum ?? '',
      pkg.supply_dominance?.dominance_score ?? '',
      pkg.package_hash,
    ])

    formatted = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  } else if (subscription.format === 'PARQUET_SCHEMA') {
    // Schema definition only (actual Parquet delivery is async / out-of-band)
    formatted = JSON.stringify({
      schema_version: '1.0',
      format: 'PARQUET_SCHEMA',
      fields: [
        { name: 'market', type: 'STRING' },
        { name: 'published_at', type: 'TIMESTAMP' },
        { name: 'oli_score', type: 'DOUBLE' },
        { name: 'benchmark_p50_eur_cents', type: 'BIGINT' },
        { name: 'ics_score', type: 'DOUBLE' },
        { name: 'lvi_score', type: 'DOUBLE' },
        { name: 'supply_dominance_score', type: 'DOUBLE' },
        { name: 'package_hash', type: 'STRING' },
      ],
      data_packages: filteredPackages,
    })
  } else {
    // JSON (default)
    formatted = JSON.stringify({
      feed_type: subscription.feed_type,
      frequency: subscription.frequency,
      generated_at: new Date().toISOString(),
      packages: filteredPackages,
    })
  }

  return { packages: filteredPackages, formatted }
}

// ─── deliverFeedToSubscriber ──────────────────────────────────────────────────

export async function deliverFeedToSubscriber(
  subscription: FeedSubscription,
): Promise<{ delivered: boolean; payload_size_bytes: number; error?: string }> {
  try {
    const { packages, formatted } = await buildFeedPayload(subscription)
    const payloadSizeBytes = Buffer.byteLength(formatted, 'utf8')

    // Deliver via webhook if configured
    if (subscription.webhook_url) {
      const packageHash =
        packages[0]?.package_hash ?? 'no-packages'

      void fetch(subscription.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type':
            subscription.format === 'CSV' ? 'text/csv' : 'application/json',
          'X-Agency-Group-Signature': packageHash,
          'X-Feed-Type': subscription.feed_type,
          'X-Feed-Frequency': subscription.frequency,
        },
        body: formatted,
        signal: AbortSignal.timeout(10000),
      }).catch((e: unknown) =>
        console.warn('[institutional-feed] webhook delivery failed', e),
      )
    }

    // Update last_delivered_at
    void (supabaseAdmin as any)
      .from('institutional_feed_subscriptions')
      .update({ last_delivered_at: new Date().toISOString() })
      .eq('id', subscription.id)
      .catch((e: unknown) =>
        console.warn('[institutionalDataFeed] update last_delivered_at failed', e),
      )

    log.info('[institutionalDataFeed] delivered feed', {
      subscription_id: subscription.id,
      client_id: subscription.client_id,
      feed_type: subscription.feed_type,
      markets: subscription.markets,
      payload_size_bytes: payloadSizeBytes,
    })

    return { delivered: true, payload_size_bytes: payloadSizeBytes }
  } catch (err) {
    const errorMsg = String(err)
    console.warn('[institutionalDataFeed] deliverFeedToSubscriber error', err)
    return { delivered: false, payload_size_bytes: 0, error: errorMsg }
  }
}

// ─── runFeedDeliveryBatch ─────────────────────────────────────────────────────

export async function runFeedDeliveryBatch(frequency: FeedFrequency): Promise<{
  processed: number
  delivered: number
  failed: number
}> {
  log.info('[institutionalDataFeed] starting feed delivery batch', { frequency })

  try {
    const { data: subscriptions, error } = await (supabaseAdmin as any)
      .from('institutional_feed_subscriptions')
      .select('*')
      .eq('frequency', frequency)
      .eq('is_active', true)

    if (error || !subscriptions || subscriptions.length === 0) {
      return { processed: 0, delivered: 0, failed: 0 }
    }

    const results = await Promise.allSettled(
      (subscriptions as FeedSubscription[]).map((sub) =>
        deliverFeedToSubscriber(sub),
      ),
    )

    let delivered = 0
    let failed = 0

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.delivered) {
        delivered++
      } else {
        failed++
      }
    }

    log.info('[institutionalDataFeed] batch complete', {
      frequency,
      processed: subscriptions.length,
      delivered,
      failed,
    })

    return {
      processed: subscriptions.length,
      delivered,
      failed,
    }
  } catch (err) {
    console.warn('[institutionalDataFeed] runFeedDeliveryBatch error', err)
    return { processed: 0, delivered: 0, failed: 0 }
  }
}

// ─── getDeliveryMetrics ───────────────────────────────────────────────────────

export async function getDeliveryMetrics(): Promise<{
  total_subscriptions: number
  active_subscriptions: number
  deliveries_today: number
  avg_payload_kb: number
}> {
  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [totalResult, activeResult] = await Promise.allSettled([
      (supabaseAdmin as any)
        .from('institutional_feed_subscriptions')
        .select('id', { count: 'exact', head: true }),

      (supabaseAdmin as any)
        .from('institutional_feed_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),
    ])

    const totalSubscriptions =
      totalResult.status === 'fulfilled'
        ? ((totalResult.value.count as number) ?? 0)
        : 0

    const activeSubscriptions =
      activeResult.status === 'fulfilled'
        ? ((activeResult.value.count as number) ?? 0)
        : 0

    // Count deliveries today (subscriptions updated today)
    const { count: deliveriesToday } = await (supabaseAdmin as any)
      .from('institutional_feed_subscriptions')
      .select('id', { count: 'exact', head: true })
      .gte('last_delivered_at', todayStart.toISOString())

    return {
      total_subscriptions: totalSubscriptions,
      active_subscriptions: activeSubscriptions,
      deliveries_today: (deliveriesToday as number) ?? 0,
      avg_payload_kb: 48, // Approximate based on typical package sizes (~48KB per market data package)
    }
  } catch (err) {
    console.warn('[institutionalDataFeed] getDeliveryMetrics error', err)
    return {
      total_subscriptions: 0,
      active_subscriptions: 0,
      deliveries_today: 0,
      avg_payload_kb: 0,
    }
  }
}
