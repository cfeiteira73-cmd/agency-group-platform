// Agency Group — Supply-Demand Imbalance Engine
// lib/expansion/supplyDemandEngine.ts
// Detects:
//   underexploited markets (lots of capital, few assets)
//   capital surplus vs asset shortage (arbitrage opportunity)
//   geographic arbitrage opportunities
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import type { MarketIntelligence } from './marketIntelligenceEngine'

// ─── Constants ────────────────────────────────────────────────────────────────

const CANONICAL_TENANT = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'

// Estimated average asset price when no pricing data available: €500K = 50_000_000 cents
const DEFAULT_ASSET_PRICE_EUR_CENTS = 50_000_000

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImbalanceSignal {
  signal_id: string
  tenant_id: string
  country: string
  city: string
  signal_type:
    | 'CAPITAL_SURPLUS'
    | 'ASSET_SHORTAGE'
    | 'COMPETITION_VACUUM'
    | 'ARBITRAGE_OPPORTUNITY'
    | 'OVERSUPPLY'
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  capital_surplus_eur_cents: number | null
  asset_deficit: number | null
  opportunity_score: number
  recommended_action: string
  detected_at: string
}

export interface ImbalanceReport {
  tenant_id: string
  generated_at: string
  signals_detected: number
  critical_signals: number
  total_arbitrage_opportunity_eur_cents: number
  signals: ImbalanceSignal[]
  top_opportunity: ImbalanceSignal | null
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function classifySeverity(opportunity_score: number): ImbalanceSignal['severity'] {
  if (opportunity_score > 80) return 'CRITICAL'
  if (opportunity_score > 60) return 'HIGH'
  if (opportunity_score > 40) return 'MEDIUM'
  return 'LOW'
}

function makeSignalId(
  tenant_id: string,
  city: string,
  signal_type: string,
): string {
  return `sig_${tenant_id.slice(0, 8)}_${city
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')}_${signal_type.toLowerCase()}_${Date.now()}`
}

// ─── detectImbalances ─────────────────────────────────────────────────────────

export async function detectImbalances(
  tenantId: string,
): Promise<ImbalanceReport> {
  const tid = tenantId || CANONICAL_TENANT
  const generated_at = new Date().toISOString()

  // Read latest snapshot per market
  const snapshotsRes = await (supabaseAdmin as any)
    .from('market_intelligence_snapshots')
    .select('*')
    .eq('tenant_id', tid)
    .order('analyzed_at', { ascending: false })

  const rawSnapshots: MarketIntelligence[] =
    (snapshotsRes.data as MarketIntelligence[] | null) ?? []

  // Deduplicate — latest per market_id
  const latestByMarket = new Map<string, MarketIntelligence>()
  for (const snap of rawSnapshots) {
    if (!latestByMarket.has(snap.market_id)) {
      latestByMarket.set(snap.market_id, snap)
    }
  }

  const markets = Array.from(latestByMarket.values())
  const signals: ImbalanceSignal[] = []
  const detected_at = new Date().toISOString()

  for (const market of markets) {
    const assetValue = market.active_assets * DEFAULT_ASSET_PRICE_EUR_CENTS

    // 1. CAPITAL_SURPLUS: capital inflow > total asset value for market
    if (market.capital_inflow_30d_eur_cents > assetValue && assetValue > 0) {
      const surplus = market.capital_inflow_30d_eur_cents - assetValue
      const opportunity_score = Math.min(
        100,
        Math.round((surplus / Math.max(assetValue, 1)) * 100 * 10) / 10,
      )
      signals.push({
        signal_id: makeSignalId(tid, market.city, 'CAPITAL_SURPLUS'),
        tenant_id: tid,
        country: market.country,
        city: market.city,
        signal_type: 'CAPITAL_SURPLUS',
        severity: classifySeverity(opportunity_score),
        capital_surplus_eur_cents: surplus,
        asset_deficit: null,
        opportunity_score,
        recommended_action: `Deploy ${Math.round(surplus / 100)} EUR of surplus capital into new ${market.city} inventory — immediate acquisition opportunity.`,
        detected_at,
      })
    }

    // 2. ASSET_SHORTAGE: bid_pressure > 2 → HIGH competition for few assets
    if (market.bid_pressure > 2) {
      const opportunity_score = Math.min(
        100,
        Math.round(Math.min(market.bid_pressure * 25, 100) * 10) / 10,
      )
      const deficit = Math.max(
        0,
        market.active_bids - market.active_assets,
      )
      signals.push({
        signal_id: makeSignalId(tid, market.city, 'ASSET_SHORTAGE'),
        tenant_id: tid,
        country: market.country,
        city: market.city,
        signal_type: 'ASSET_SHORTAGE',
        severity: classifySeverity(opportunity_score),
        capital_surplus_eur_cents: null,
        asset_deficit: deficit,
        opportunity_score,
        recommended_action: `Source ${deficit} additional properties in ${market.city} — ${market.active_bids} active bids with only ${market.active_assets} assets available.`,
        detected_at,
      })
    }

    // 3. COMPETITION_VACUUM: investor_count < 3 AND active_assets > 5
    if (market.investor_count < 3 && market.active_assets > 5) {
      const opportunity_score = Math.min(
        100,
        Math.round(
          ((5 - Math.min(market.investor_count, 5)) / 5) * 60 +
            Math.min(market.active_assets / 10, 1) * 40,
        ),
      )
      signals.push({
        signal_id: makeSignalId(tid, market.city, 'COMPETITION_VACUUM'),
        tenant_id: tid,
        country: market.country,
        city: market.city,
        signal_type: 'COMPETITION_VACUUM',
        severity: classifySeverity(opportunity_score),
        capital_surplus_eur_cents: null,
        asset_deficit: null,
        opportunity_score,
        recommended_action: `${market.city} has ${market.active_assets} assets and only ${market.investor_count} investors — first-mover advantage with minimal competitive pressure.`,
        detected_at,
      })
    }

    // 5. OVERSUPPLY: active_assets > active_bids × 3
    if (market.active_assets > market.active_bids * 3 && market.active_assets > 3) {
      const excess = market.active_assets - market.active_bids * 3
      const opportunity_score = Math.min(
        100,
        Math.round(Math.min((excess / market.active_assets) * 100, 100) * 10) / 10,
      )
      signals.push({
        signal_id: makeSignalId(tid, market.city, 'OVERSUPPLY'),
        tenant_id: tid,
        country: market.country,
        city: market.city,
        signal_type: 'OVERSUPPLY',
        severity: classifySeverity(opportunity_score),
        capital_surplus_eur_cents: null,
        asset_deficit: null,
        opportunity_score,
        recommended_action: `${market.city} oversupply: ${market.active_assets} assets vs ${market.active_bids} bids — reduce acquisition pace and attract new investor capital.`,
        detected_at,
      })
    }
  }

  // 4. ARBITRAGE across markets: market A avg_roi < market B avg_roi by > 3%
  const marketsWithRoi = markets.filter(m => m.avg_roi_pct > 0)
  for (let i = 0; i < marketsWithRoi.length; i++) {
    for (let j = i + 1; j < marketsWithRoi.length; j++) {
      const a = marketsWithRoi[i]
      const b = marketsWithRoi[j]
      const roiDiff = Math.abs(a.avg_roi_pct - b.avg_roi_pct)
      if (roiDiff > 3) {
        const lowRoi = a.avg_roi_pct < b.avg_roi_pct ? a : b
        const highRoi = a.avg_roi_pct < b.avg_roi_pct ? b : a
        const opportunity_score = Math.min(100, Math.round(roiDiff * 10 * 10) / 10)
        signals.push({
          signal_id: makeSignalId(
            tid,
            `${lowRoi.city}_to_${highRoi.city}`,
            'ARBITRAGE_OPPORTUNITY',
          ),
          tenant_id: tid,
          country: highRoi.country,
          city: highRoi.city,
          signal_type: 'ARBITRAGE_OPPORTUNITY',
          severity: classifySeverity(opportunity_score),
          capital_surplus_eur_cents: lowRoi.capital_inflow_30d_eur_cents,
          asset_deficit: null,
          opportunity_score,
          recommended_action: `Redirect capital from ${lowRoi.city} (${lowRoi.avg_roi_pct.toFixed(2)}% ROI) to ${highRoi.city} (${highRoi.avg_roi_pct.toFixed(2)}% ROI) — ${roiDiff.toFixed(2)}% differential.`,
          detected_at,
        })
      }
    }
  }

  // Sort by opportunity_score DESC
  signals.sort((a, b) => b.opportunity_score - a.opportunity_score)

  const critical_signals = signals.filter(s => s.severity === 'CRITICAL').length
  const total_arbitrage_opportunity_eur_cents = signals
    .filter(s => s.signal_type === 'ARBITRAGE_OPPORTUNITY')
    .reduce((sum, s) => sum + (s.capital_surplus_eur_cents ?? 0), 0)
  const top_opportunity = signals[0] ?? null

  // Persist signals
  for (const signal of signals) {
    void (supabaseAdmin as any)
      .from('supply_demand_signals')
      .upsert(
        {
          id: randomUUID(),
          signal_id: signal.signal_id,
          tenant_id: tid,
          country: signal.country,
          city: signal.city,
          signal_type: signal.signal_type,
          severity: signal.severity,
          capital_surplus_eur_cents: signal.capital_surplus_eur_cents,
          asset_deficit: signal.asset_deficit,
          opportunity_score: signal.opportunity_score,
          recommended_action: signal.recommended_action,
          detected_at: signal.detected_at,
        },
        { onConflict: 'signal_id' },
      )
      .catch((e: unknown) =>
        log.warn('[supplyDemand] signal persist error', {
          error: String(e),
          signal_id: signal.signal_id,
        }),
      )
  }

  const report: ImbalanceReport = {
    tenant_id: tid,
    generated_at,
    signals_detected: signals.length,
    critical_signals,
    total_arbitrage_opportunity_eur_cents,
    signals,
    top_opportunity,
  }

  log.info('[supplyDemand] detectImbalances complete', {
    signals_detected: signals.length,
    critical_signals,
    total_arbitrage_opportunity_eur_cents,
  })

  return report
}

// ─── getArbitrageOpportunities ────────────────────────────────────────────────

export async function getArbitrageOpportunities(
  tenantId: string,
): Promise<
  Array<{
    from_market: string
    to_market: string
    roi_differential_pct: number
    transferable_capital_eur_cents: number
    expected_gain_eur_cents: number
  }>
> {
  const tid = tenantId || CANONICAL_TENANT

  const snapshotsRes = await (supabaseAdmin as any)
    .from('market_intelligence_snapshots')
    .select(
      'market_id, country, city, avg_roi_pct, capital_inflow_30d_eur_cents, analyzed_at',
    )
    .eq('tenant_id', tid)
    .order('analyzed_at', { ascending: false })

  const rawSnapshots: Array<{
    market_id: string
    country: string
    city: string
    avg_roi_pct: number
    capital_inflow_30d_eur_cents: number
    analyzed_at: string
  }> = (snapshotsRes.data as typeof rawSnapshots | null) ?? []

  // Deduplicate
  const latestByMarket = new Map<string, (typeof rawSnapshots)[number]>()
  for (const snap of rawSnapshots) {
    if (!latestByMarket.has(snap.market_id)) {
      latestByMarket.set(snap.market_id, snap)
    }
  }

  const markets = Array.from(latestByMarket.values()).filter(m => m.avg_roi_pct > 0)
  const opportunities: Array<{
    from_market: string
    to_market: string
    roi_differential_pct: number
    transferable_capital_eur_cents: number
    expected_gain_eur_cents: number
  }> = []

  for (let i = 0; i < markets.length; i++) {
    for (let j = i + 1; j < markets.length; j++) {
      const a = markets[i]
      const b = markets[j]
      const diff = Math.abs(a.avg_roi_pct - b.avg_roi_pct)
      if (diff < 2) continue

      const lowRoi = a.avg_roi_pct < b.avg_roi_pct ? a : b
      const highRoi = a.avg_roi_pct < b.avg_roi_pct ? b : a
      const transferable = lowRoi.capital_inflow_30d_eur_cents
      const expected_gain = Math.round(
        (transferable * diff) / 100,
      )

      opportunities.push({
        from_market: `${lowRoi.country}:${lowRoi.city}`,
        to_market: `${highRoi.country}:${highRoi.city}`,
        roi_differential_pct: Math.round(diff * 100) / 100,
        transferable_capital_eur_cents: transferable,
        expected_gain_eur_cents: expected_gain,
      })
    }
  }

  // Sort by expected_gain DESC
  opportunities.sort((a, b) => b.expected_gain_eur_cents - a.expected_gain_eur_cents)

  return opportunities
}
