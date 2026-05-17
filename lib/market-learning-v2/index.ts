// AGENCY GROUP — SH-ROS | AMI: 22506

export interface MarketState {
  zone_key: string
  updated_at: Date

  price_elasticity: number
  price_sensitivity_score: number
  optimal_price_band_deviation: number

  intent_distribution: {
    investor: number
    luxury_buyer: number
    family: number
    relocating: number
    international: number
    other: number
  }

  avg_days_to_inquiry: number
  avg_days_to_offer: number
  avg_days_to_close: number
  liquidity_velocity_score: number

  data_points: number
  confidence: number
}

// ---------------------------------------------------------------------------
// Zone defaults for Portugal 2026
// ---------------------------------------------------------------------------

interface ZoneDefaults {
  price_elasticity: number
  price_sensitivity_score: number
  avg_days_to_close: number
  liquidity_velocity_score: number
}

const ZONE_DEFAULTS: Record<string, ZoneDefaults> = {
  lisboa: {
    price_elasticity: -1.8,
    price_sensitivity_score: 45,
    avg_days_to_close: 180,
    liquidity_velocity_score: 62,
  },
  cascais: {
    price_elasticity: -1.5,
    price_sensitivity_score: 38,
    avg_days_to_close: 160,
    liquidity_velocity_score: 68,
  },
  algarve: {
    price_elasticity: -2.0,
    price_sensitivity_score: 52,
    avg_days_to_close: 200,
    liquidity_velocity_score: 55,
  },
  porto: {
    price_elasticity: -2.2,
    price_sensitivity_score: 55,
    avg_days_to_close: 190,
    liquidity_velocity_score: 58,
  },
  madeira: {
    price_elasticity: -2.5,
    price_sensitivity_score: 60,
    avg_days_to_close: 220,
    liquidity_velocity_score: 48,
  },
}

const DEFAULT_ZONE: ZoneDefaults = {
  price_elasticity: -2.0,
  price_sensitivity_score: 50,
  avg_days_to_close: 210,
  liquidity_velocity_score: 52,
}

const DEFAULT_INTENT_DISTRIBUTION: MarketState['intent_distribution'] = {
  investor: 0.25,
  luxury_buyer: 0.20,
  family: 0.28,
  relocating: 0.12,
  international: 0.10,
  other: 0.05,
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export function getDefaultMarketState(zone_key: string): MarketState {
  const key = zone_key.toLowerCase()
  const zd: ZoneDefaults = ZONE_DEFAULTS[key] ?? DEFAULT_ZONE

  return {
    zone_key,
    updated_at: new Date(),
    price_elasticity: zd.price_elasticity,
    price_sensitivity_score: zd.price_sensitivity_score,
    optimal_price_band_deviation: 3.5,
    intent_distribution: { ...DEFAULT_INTENT_DISTRIBUTION },
    avg_days_to_inquiry: 14,
    avg_days_to_offer: 60,
    avg_days_to_close: zd.avg_days_to_close,
    liquidity_velocity_score: zd.liquidity_velocity_score,
    data_points: 0,
    confidence: 0,
  }
}

const EMA_ALPHA = 0.1

function ema(current: number, newValue: number): number {
  return current * (1 - EMA_ALPHA) + newValue * EMA_ALPHA
}

type IntentKey = keyof MarketState['intent_distribution']

const INTENT_KEYS: IntentKey[] = [
  'investor',
  'luxury_buyer',
  'family',
  'relocating',
  'international',
  'other',
]

function normaliseIntentDistribution(
  dist: MarketState['intent_distribution'],
): MarketState['intent_distribution'] {
  const total = INTENT_KEYS.reduce((sum, k) => sum + dist[k], 0)
  if (total === 0) return { ...DEFAULT_INTENT_DISTRIBUTION }
  const result = { ...dist }
  for (const k of INTENT_KEYS) {
    result[k] = result[k] / total
  }
  return result
}

function updateIntentDistribution(
  dist: MarketState['intent_distribution'],
  buyerIntent: string | undefined,
): MarketState['intent_distribution'] {
  if (!buyerIntent) return dist

  const key = buyerIntent.toLowerCase() as IntentKey
  if (!INTENT_KEYS.includes(key)) return dist

  // Laplace-smoothed update: bump the observed intent, small nudge to others
  const updated = { ...dist }
  const LAPLACE_SMOOTH = 0.005

  for (const k of INTENT_KEYS) {
    if (k === key) {
      updated[k] = updated[k] + LAPLACE_SMOOTH * 10
    } else {
      updated[k] = updated[k] + LAPLACE_SMOOTH
    }
  }

  return normaliseIntentDistribution(updated)
}

export function updateMarketStateFromTransaction(
  state: MarketState,
  transaction: {
    days_to_close: number
    price_eur: number
    listed_price_eur: number
    buyer_intent?: string
  },
): MarketState {
  const newDataPoints = state.data_points + 1
  const newConfidence = Math.min(1, newDataPoints / 50)

  const newAvgDaysToClose = ema(state.avg_days_to_close, transaction.days_to_close)

  // Price deviation signal: actual / listed ratio
  const priceDeviation =
    transaction.listed_price_eur > 0
      ? ((transaction.price_eur / transaction.listed_price_eur) - 1) * 100
      : 0
  const newOptimalBand = ema(state.optimal_price_band_deviation, Math.abs(priceDeviation))

  const newIntentDist = updateIntentDistribution(
    state.intent_distribution,
    transaction.buyer_intent,
  )

  const updated: MarketState = {
    ...state,
    updated_at: new Date(),
    avg_days_to_close: Math.round(newAvgDaysToClose),
    optimal_price_band_deviation: Math.round(newOptimalBand * 100) / 100,
    intent_distribution: newIntentDist,
    data_points: newDataPoints,
    confidence: Math.round(newConfidence * 1000) / 1000,
  }

  updated.liquidity_velocity_score = computeLiquidityVelocity(updated)

  return updated
}

export function updateMarketStateFromInquiry(
  state: MarketState,
  inquiry: {
    days_from_listing: number
    buyer_intent?: string
  },
): MarketState {
  const newDataPoints = state.data_points + 1
  const newConfidence = Math.min(1, newDataPoints / 50)

  const newAvgDaysToInquiry = ema(state.avg_days_to_inquiry, inquiry.days_from_listing)

  const newIntentDist = updateIntentDistribution(
    state.intent_distribution,
    inquiry.buyer_intent,
  )

  return {
    ...state,
    updated_at: new Date(),
    avg_days_to_inquiry: Math.round(newAvgDaysToInquiry * 10) / 10,
    intent_distribution: newIntentDist,
    data_points: newDataPoints,
    confidence: Math.round(newConfidence * 1000) / 1000,
  }
}

export function computeLiquidityVelocity(state: MarketState): number {
  const raw = 100 * (210 / Math.max(1, state.avg_days_to_close))
  return Math.round(Math.max(0, Math.min(100, raw)))
}

export function classifyMarketRegime(
  state: MarketState,
): 'hot' | 'warm' | 'neutral' | 'cooling' | 'cold' {
  const { avg_days_to_close, liquidity_velocity_score } = state

  if (avg_days_to_close < 90 && liquidity_velocity_score > 75) return 'hot'
  if (avg_days_to_close < 150 && liquidity_velocity_score > 60) return 'warm'
  if (avg_days_to_close < 200) return 'neutral'
  if (avg_days_to_close < 250) return 'cooling'
  return 'cold'
}

export const marketLearningV2 = {
  getDefaultMarketState,
  updateMarketStateFromTransaction,
  updateMarketStateFromInquiry,
  computeLiquidityVelocity,
  classifyMarketRegime,
}
