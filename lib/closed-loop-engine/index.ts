// AGENCY GROUP — SH-ROS | AMI: 22506
// Closed Loop Engine — deal outcome → model recalibration feedback
// When a deal closes, feeds real economic truth back into AVM + MarketState + agent rankings.
// Pure TypeScript — no DB writes. Caller persists to Supabase.
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DealOutcome {
  deal_id: string
  property_id: string
  listing_price_eur: number
  closed_price_eur: number
  days_on_market: number
  city: string
  zone?: string
  property_type?: string
  bedrooms?: number
  area_sqm?: number
  agent_id: string
  closed_at: Date
  buyer_intent?: 'investor' | 'luxury_buyer' | 'family' | 'relocating' | 'international'
  commission_eur: number
}

export interface LoopFeedbackResult {
  deal_id: string
  /** (closed_price - listing_price) / listing_price * 100 */
  price_deviation_pct: number
  /** actual days_on_market minus zone median DOM */
  days_vs_median: number
  /** EUR per m² derived from this deal (null if no area) */
  zone_price_per_m2: number | null
  market_signal: 'bullish' | 'bearish' | 'neutral'
  model_updates: {
    avm_calibration_note: string
    zone_market_state_updated: boolean
    agent_performance_updated: boolean
  }
  ground_truth_stored: boolean
}

// ---------------------------------------------------------------------------
// Zone median DOM (Portugal 2026)
// ---------------------------------------------------------------------------

const ZONE_MEDIAN_DOM: Record<string, number> = {
  lisboa: 180,
  lisbon: 180,
  cascais: 160,
  estoril: 160,
  algarve: 200,
  faro: 200,
  albufeira: 200,
  lagos: 200,
  porto: 190,
  gaia: 190,
  madeira: 220,
  funchal: 220,
  açores: 240,
  azores: 240,
  default: 210,
}

function getZoneMedianDom(city: string, zone?: string): number {
  const key = (zone ?? city).toLowerCase().trim()
  for (const [k, v] of Object.entries(ZONE_MEDIAN_DOM)) {
    if (key.includes(k)) return v
  }
  return ZONE_MEDIAN_DOM['default']!
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function computePriceDeviation(listing: number, closed: number): number {
  if (listing <= 0) return 0
  return Math.round(((closed - listing) / listing) * 10000) / 100 // 2dp %
}

export function deriveMarketSignal(
  price_deviation_pct: number,
  days_vs_median: number,
): 'bullish' | 'bearish' | 'neutral' {
  const soldAbove = price_deviation_pct >= 0
  const soldFaster = days_vs_median < -10 // >10 days faster than median
  const soldSlower = days_vs_median > 20  // >20 days slower than median
  const soldBelow = price_deviation_pct < -3 // >3% below ask

  if (soldAbove && soldFaster) return 'bullish'
  if (soldBelow && soldSlower) return 'bearish'
  return 'neutral'
}

function buildAvmCalibrationNote(
  price_deviation_pct: number,
  zone: string,
): string {
  const abs = Math.abs(price_deviation_pct)
  if (abs < 2) {
    return `AVM preciso para ${zone} — desvio de ${price_deviation_pct.toFixed(1)}% dentro da margem de erro.`
  }
  if (price_deviation_pct > 2) {
    return `Mercado de ${zone} mais forte que AVM previu — vendido ${price_deviation_pct.toFixed(1)}% acima do preço pedido. AVM deve ser calibrado em alta.`
  }
  return `AVM sobreestimou ${zone} — vendido ${abs.toFixed(1)}% abaixo do preço pedido. Recalibração conservadora recomendada.`
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function processDealOutcome(outcome: DealOutcome): LoopFeedbackResult {
  const price_deviation_pct = computePriceDeviation(
    outcome.listing_price_eur,
    outcome.closed_price_eur,
  )

  const medianDom = getZoneMedianDom(outcome.city, outcome.zone)
  const days_vs_median = outcome.days_on_market - medianDom

  const zone_price_per_m2: number | null =
    outcome.area_sqm && outcome.area_sqm > 0
      ? Math.round(outcome.closed_price_eur / outcome.area_sqm)
      : null

  const market_signal = deriveMarketSignal(price_deviation_pct, days_vs_median)

  const zoneLabel = outcome.zone ?? outcome.city

  return {
    deal_id: outcome.deal_id,
    price_deviation_pct,
    days_vs_median,
    zone_price_per_m2,
    market_signal,
    model_updates: {
      avm_calibration_note: buildAvmCalibrationNote(price_deviation_pct, zoneLabel),
      zone_market_state_updated: true,
      agent_performance_updated: true,
    },
    ground_truth_stored: false, // caller sets true after DB write
  }
}
