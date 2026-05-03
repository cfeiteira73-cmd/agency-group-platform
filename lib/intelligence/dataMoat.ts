// =============================================================================
// Agency Group — Data Moat & Network Effect Intelligence
// lib/intelligence/dataMoat.ts
//
// Phase 9: Data Moat / Network Effect Intelligence
//
// Quantifies the compounding defensibility of the platform data asset.
// Measures how unique/proprietary the data is and how much marginal
// value each new participant adds via network effects.
//
// MOAT DRIVERS:
//   - Data uniqueness: volume × recency × exclusivity
//   - Network effect: Metcalfe-like value = connections / max_connections
//   - Data depth: outcomes × negotiation events × behavioral signals
//   - Temporal advantage: how long we've been accumulating vs competitors
//
// PURE FUNCTIONS:
//   computeDataUniquenessScore, computeNetworkEffectValue,
//   computeMarginalValue, computeMoatScore,
//   classifyMoatStrength, buildMoatReport
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MoatStrength = 'dominant' | 'strong' | 'building' | 'early' | 'minimal'

export interface DataAsset {
  total_records:        number
  records_last_90d:     number      // recency proxy
  exclusive_records:    number      // not available in public datasets
  outcome_records:      number      // closed deals with full truth data
  behavioral_signals:   number      // engagement events, responses, negotiations
  months_accumulating:  number      // how long data collection has been running
}

export interface NetworkState {
  active_agents:     number
  active_investors:  number
  total_transactions: number
  zones_covered:     number
  asset_classes:     number
}

export interface MarginalValueResult {
  before_value:      number
  after_value:       number
  marginal_value:    number
  marginal_value_pct: number    // % increase
  driver:            string     // what drove the increase
}

export interface MoatReport {
  computed_at:          string
  uniqueness_score:     number    // 0-100
  network_effect_score: number    // 0-100
  depth_score:          number    // 0-100
  temporal_score:       number    // 0-100
  moat_score:           number    // 0-100 composite
  moat_strength:        MoatStrength
  defensibility_horizon_months: number   // estimated months to replicate
  key_advantages:       string[]
  key_gaps:             string[]
}

// ---------------------------------------------------------------------------
// PURE: Compute data uniqueness score (0-100)
// Combines volume, recency, and exclusivity
// ---------------------------------------------------------------------------

export function computeDataUniquenessScore(asset: DataAsset): number {
  // Volume score (0-33): log scale to prevent mega-datasets from dominating
  const volumeScore = Math.min(33, Math.round(Math.log10(Math.max(1, asset.total_records)) * 8))

  // Recency score (0-33): recent data is more valuable
  const recencyPct  = asset.total_records > 0 ? asset.records_last_90d / asset.total_records : 0
  const recencyScore = Math.round(recencyPct * 33)

  // Exclusivity score (0-34): proprietary data is the real moat
  const exclusivityPct = asset.total_records > 0 ? asset.exclusive_records / asset.total_records : 0
  const exclusivityScore = Math.round(exclusivityPct * 34)

  return Math.min(100, volumeScore + recencyScore + exclusivityScore)
}

// ---------------------------------------------------------------------------
// PURE: Compute network effect value (0-100)
// Based on Metcalfe's law: value ∝ n(n-1)/2 (number of potential connections)
// Normalized to 100 at a reference scale
// ---------------------------------------------------------------------------

export function computeNetworkEffectValue(
  activeAgents:     number,
  activeInvestors:  number,
  transactions:     number,
): number {
  // Bidirectional network: agents × investors = potential connections
  const connections    = activeAgents * activeInvestors
  // Normalize: 100 agents × 200 investors = 20,000 connections → score 50
  const normalizedConn = Math.min(80, Math.round(Math.sqrt(connections) * 0.8))

  // Transaction depth adds liquidity premium
  const txScore = Math.min(20, Math.round(Math.log10(Math.max(1, transactions)) * 5))

  return Math.min(100, normalizedConn + txScore)
}

// ---------------------------------------------------------------------------
// PURE: Compute data depth score (0-100)
// Outcomes + behavioral signals = real competitive moat
// ---------------------------------------------------------------------------

export function computeDataDepthScore(asset: DataAsset): number {
  // Outcome records are the most valuable (actual deal truth)
  const outcomeScore = Math.min(50, Math.round(Math.log10(Math.max(1, asset.outcome_records)) * 12))

  // Behavioral signals (negotiation events, responses) are hard to replicate
  const behaviorScore = Math.min(30, Math.round(Math.log10(Math.max(1, asset.behavioral_signals)) * 8))

  // Temporal advantage: harder to replicate the longer you've been building
  const temporalScore = Math.min(20, Math.round(asset.months_accumulating * 1.5))

  return Math.min(100, outcomeScore + behaviorScore + temporalScore)
}

// ---------------------------------------------------------------------------
// PURE: Compute temporal advantage score (0-100)
// Longer accumulation = higher barrier to entry
// ---------------------------------------------------------------------------

export function computeTemporalScore(monthsAccumulating: number): number {
  if (monthsAccumulating <= 1)  return 5
  if (monthsAccumulating <= 3)  return 15
  if (monthsAccumulating <= 6)  return 30
  if (monthsAccumulating <= 12) return 50
  if (monthsAccumulating <= 24) return 70
  if (monthsAccumulating <= 36) return 85
  return 95
}

// ---------------------------------------------------------------------------
// PURE: Compute composite moat score (0-100)
// ---------------------------------------------------------------------------

export function computeMoatScore(
  uniquenessScore:    number,
  networkEffectScore: number,
  depthScore:         number,
  temporalScore:      number,
): number {
  return Math.round(
    uniquenessScore    * 0.30 +
    networkEffectScore * 0.25 +
    depthScore         * 0.30 +
    temporalScore      * 0.15,
  )
}

// ---------------------------------------------------------------------------
// PURE: Classify moat strength
// ---------------------------------------------------------------------------

export function classifyMoatStrength(moatScore: number): MoatStrength {
  if (moatScore >= 80) return 'dominant'
  if (moatScore >= 65) return 'strong'
  if (moatScore >= 45) return 'building'
  if (moatScore >= 25) return 'early'
  return 'minimal'
}

// ---------------------------------------------------------------------------
// PURE: Compute marginal value of adding a participant
// ---------------------------------------------------------------------------

export function computeMarginalValue(
  before: NetworkState,
  after:  NetworkState,
): MarginalValueResult {
  const beforeValue = computeNetworkEffectValue(
    before.active_agents, before.active_investors, before.total_transactions,
  )
  const afterValue = computeNetworkEffectValue(
    after.active_agents, after.active_investors, after.total_transactions,
  )
  const marginal    = afterValue - beforeValue
  const marginalPct = beforeValue > 0 ? marginal / beforeValue * 100 : 0

  // Identify what changed
  let driver = 'transaction'
  if (after.active_agents > before.active_agents)         driver = 'new_agent'
  else if (after.active_investors > before.active_investors) driver = 'new_investor'
  else if (after.zones_covered > before.zones_covered)    driver = 'new_zone'
  else if (after.asset_classes > before.asset_classes)    driver = 'new_asset_class'

  return {
    before_value:       beforeValue,
    after_value:        afterValue,
    marginal_value:     Math.round(marginal * 100) / 100,
    marginal_value_pct: Math.round(marginalPct * 100) / 100,
    driver,
  }
}

// ---------------------------------------------------------------------------
// PURE: Estimate defensibility horizon (months to replicate)
// ---------------------------------------------------------------------------

export function estimateDefensibilityHorizon(
  asset:   DataAsset,
  network: NetworkState,
): number {
  // Base: time to accumulate equivalent outcome records at 10/month
  const outcomesMonths = asset.outcome_records / 10

  // Network effect: each agent/investor takes ~2mo to recruit and activate
  const networkMonths  = (network.active_agents * 2 + network.active_investors) / 10

  // Exclusivity premium: 50% harder to get proprietary data
  const exclusivityPremium = asset.exclusive_records > 0
    ? (asset.exclusive_records / asset.total_records) * 12
    : 0

  return Math.round(outcomesMonths * 0.5 + networkMonths * 0.3 + exclusivityPremium * 0.2)
}

// ---------------------------------------------------------------------------
// PURE: Build full moat report
// ---------------------------------------------------------------------------

export function buildMoatReport(
  asset:   DataAsset,
  network: NetworkState,
): MoatReport {
  const uniqueness    = computeDataUniquenessScore(asset)
  const networkEffect = computeNetworkEffectValue(network.active_agents, network.active_investors, network.total_transactions)
  const depth         = computeDataDepthScore(asset)
  const temporal      = computeTemporalScore(asset.months_accumulating)
  const composite     = computeMoatScore(uniqueness, networkEffect, depth, temporal)
  const strength      = classifyMoatStrength(composite)
  const horizon       = estimateDefensibilityHorizon(asset, network)

  const advantages: string[] = []
  const gaps: string[] = []

  if (uniqueness >= 70)    advantages.push(`High data uniqueness (${uniqueness}/100)`)
  else                     gaps.push(`Low data uniqueness — increase exclusive record collection`)

  if (networkEffect >= 60) advantages.push(`Strong network effect (${networkEffect}/100)`)
  else                     gaps.push(`Small network — grow agent+investor base`)

  if (asset.outcome_records >= 100) advantages.push(`${asset.outcome_records} closed-deal truth records`)
  else                     gaps.push(`Only ${asset.outcome_records} outcome records — need 100+ for strong moat`)

  if (asset.months_accumulating >= 12) advantages.push(`${asset.months_accumulating} months of accumulation`)
  else                     gaps.push(`Only ${asset.months_accumulating} months — compound advantage building`)

  if (network.zones_covered >= 5) advantages.push(`${network.zones_covered} zones covered`)
  else                     gaps.push(`Expand zone coverage beyond ${network.zones_covered}`)

  return {
    computed_at:                  new Date().toISOString(),
    uniqueness_score:             uniqueness,
    network_effect_score:         networkEffect,
    depth_score:                  depth,
    temporal_score:               temporal,
    moat_score:                   composite,
    moat_strength:                strength,
    defensibility_horizon_months: horizon,
    key_advantages:               advantages,
    key_gaps:                     gaps,
  }
}
