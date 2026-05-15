// AGENCY GROUP — SH-ROS Feedback: Reward Calibration Engine | AMI: 22506
// Maps economic signals to calibrated reward scores for agent learning
// Uses outcome history to continuously recalibrate reward functions
// =============================================================================

import type { EconomicSignal, SignalSource } from './economicSignalIngestor'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RewardSignal {
  signal_id: string
  org_id: string
  agent_id: string           // which agent made the decision being rewarded
  entity_id: string
  raw_reward: number         // pre-calibration reward
  calibrated_reward: number  // post-calibration reward (primary output)
  reward_components: RewardComponent[]
  temporal_discount: number  // γ factor applied for delayed signals
  calibration_version: number
  computed_at: string
}

export interface RewardComponent {
  name: string
  value: number
  weight: number
  contribution: number  // value * weight
}

export interface CalibrationState {
  org_id: string
  version: number
  reward_scale: number         // global scale factor (drift correction)
  source_weights: Record<SignalSource, number>
  baseline_close_rate: number  // org's historical close rate
  baseline_deal_value: number  // org's avg deal value
  last_calibrated_at: string
  calibrations_applied: number
}

export interface RewardDistribution {
  mean: number
  std_dev: number
  p10: number
  p50: number
  p90: number
  sample_count: number
}

// ─── Portugal Market Baselines ─────────────────────────────────────────────────

const MARKET_BASELINE = {
  close_rate:      0.18,   // 18% base close rate
  avg_deal_value:  320_000, // €320K avg
  days_to_close:   210,
  price_per_sqm:   3_076,
}

// ─── Reward Calibration Engine ────────────────────────────────────────────────

export class RewardCalibrationEngine {
  private _calibrations = new Map<string, CalibrationState>()  // org_id
  private _reward_history = new Map<string, number[]>()         // org_id → rewards

  /**
   * Compute calibrated reward from an economic signal.
   * Core function of the feedback loop.
   */
  computeReward(
    signal: EconomicSignal,
    agent_id: string,
    delay_days = 0
  ): RewardSignal {
    const calibration = this._getOrInitCalibration(signal.org_id)

    // Build reward components
    const components: RewardComponent[] = []

    // 1. Outcome component (was the signal positive or negative?)
    const outcome_value = this._outcomeValue(signal)
    const outcome_weight = calibration.source_weights[signal.source] ?? 0.5
    components.push({
      name: 'outcome',
      value: outcome_value,
      weight: outcome_weight,
      contribution: outcome_value * outcome_weight,
    })

    // 2. Value component (how big was the deal/signal?)
    const value_component = this._valueComponent(signal, calibration)
    components.push({
      name: 'value',
      value: value_component,
      weight: 0.3,
      contribution: value_component * 0.3,
    })

    // 3. Speed component (faster close = higher reward)
    const speed_component = this._speedComponent(signal)
    components.push({
      name: 'speed',
      value: speed_component,
      weight: 0.15,
      contribution: speed_component * 0.15,
    })

    // 4. Quality component (signal confidence)
    components.push({
      name: 'confidence',
      value: signal.confidence,
      weight: 0.05,
      contribution: signal.confidence * 0.05,
    })

    // Sum components
    const raw_reward = components.reduce((s, c) => s + c.contribution, 0)

    // Apply temporal discount (delayed signals are worth less)
    const temporal_discount = Math.pow(0.99, delay_days)  // γ=0.99

    // Apply calibration scale (corrects for reward drift)
    const calibrated_reward = raw_reward * temporal_discount * calibration.reward_scale

    // Record for distribution tracking
    const history = this._reward_history.get(signal.org_id) ?? []
    history.push(calibrated_reward)
    if (history.length > 1000) history.shift()  // rolling window
    this._reward_history.set(signal.org_id, history)

    const result: RewardSignal = {
      signal_id: signal.signal_id,
      org_id: signal.org_id,
      agent_id,
      entity_id: signal.entity_id,
      raw_reward,
      calibrated_reward: Math.round(calibrated_reward * 1000) / 1000,
      reward_components: components,
      temporal_discount,
      calibration_version: calibration.version,
      computed_at: new Date().toISOString(),
    }

    logger.info('[RewardCalibration] Reward computed', {
      signal_id: signal.signal_id,
      agent_id,
      raw: raw_reward.toFixed(3),
      calibrated: calibrated_reward.toFixed(3),
      discount: temporal_discount.toFixed(3),
    })

    return result
  }

  /**
   * Update calibration based on recent reward distribution.
   * Prevents reward inflation or deflation over time.
   */
  recalibrate(org_id: string): CalibrationState {
    const calibration = this._getOrInitCalibration(org_id)
    const history = this._reward_history.get(org_id) ?? []

    if (history.length < 10) return calibration  // need minimum samples

    const mean = history.reduce((s, v) => s + v, 0) / history.length

    // Target mean reward ≈ 0.5 (normalized)
    const target_mean = 0.5
    let new_scale = calibration.reward_scale

    if (Math.abs(mean - target_mean) > 0.1) {
      // Drift detected — adjust scale
      new_scale = calibration.reward_scale * (target_mean / Math.max(0.01, mean))
      new_scale = Math.min(3.0, Math.max(0.1, new_scale))  // clamp

      logger.info('[RewardCalibration] Scale adjusted', {
        org_id,
        prev_scale: calibration.reward_scale.toFixed(3),
        new_scale: new_scale.toFixed(3),
        mean: mean.toFixed(3),
      })
    }

    const updated: CalibrationState = {
      ...calibration,
      reward_scale: new_scale,
      version: calibration.version + 1,
      last_calibrated_at: new Date().toISOString(),
      calibrations_applied: calibration.calibrations_applied + 1,
    }

    this._calibrations.set(org_id, updated)
    return updated
  }

  /**
   * Update org baselines (called when new market data arrives).
   */
  updateBaselines(org_id: string, baselines: {
    close_rate?: number
    avg_deal_value?: number
  }): void {
    const calibration = this._getOrInitCalibration(org_id)
    this._calibrations.set(org_id, {
      ...calibration,
      baseline_close_rate: baselines.close_rate ?? calibration.baseline_close_rate,
      baseline_deal_value: baselines.avg_deal_value ?? calibration.baseline_deal_value,
      version: calibration.version + 1,
    })
  }

  /**
   * Get reward distribution for an org.
   * Used to assess learning quality.
   */
  getDistribution(org_id: string): RewardDistribution | null {
    const history = this._reward_history.get(org_id) ?? []
    if (history.length < 5) return null

    const sorted = [...history].sort((a, b) => a - b)
    const mean = sorted.reduce((s, v) => s + v, 0) / sorted.length
    const variance = sorted.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / sorted.length

    return {
      mean,
      std_dev: Math.sqrt(variance),
      p10: sorted[Math.floor(sorted.length * 0.1)],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p90: sorted[Math.floor(sorted.length * 0.9)],
      sample_count: sorted.length,
    }
  }

  /**
   * Get calibration state for an org.
   */
  getCalibration(org_id: string): CalibrationState {
    return this._getOrInitCalibration(org_id)
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private _getOrInitCalibration(org_id: string): CalibrationState {
    if (this._calibrations.has(org_id)) return this._calibrations.get(org_id)!

    // Initialize with Portugal market defaults
    const init: CalibrationState = {
      org_id,
      version: 1,
      reward_scale: 1.0,
      source_weights: {
        deal_closed:         1.0,
        deal_lost:          -0.8,
        proposal_accepted:   0.7,
        match_accepted:      0.5,
        proposal_sent:       0.2,
        price_negotiation:   0.3,
        time_to_close:       0.4,
        match_rejected:     -0.3,
        market_price_update: 0.1,
        agent_feedback:      0.3,
      },
      baseline_close_rate:  MARKET_BASELINE.close_rate,
      baseline_deal_value:  MARKET_BASELINE.avg_deal_value,
      last_calibrated_at:   new Date().toISOString(),
      calibrations_applied: 0,
    }
    this._calibrations.set(org_id, init)
    return init
  }

  private _outcomeValue(signal: EconomicSignal): number {
    // Positive outcomes: 1.0, negative outcomes: -1.0, neutral: 0.5
    switch (signal.source) {
      case 'deal_closed':
      case 'proposal_accepted':
      case 'match_accepted':
        return 1.0

      case 'deal_lost':
      case 'match_rejected':
        return 0.0   // 0 rather than negative — losses still provide info

      case 'proposal_sent':
      case 'agent_feedback':
        return 0.5

      case 'time_to_close':
        // signal.value is already normalized (faster=higher)
        return signal.value

      case 'price_negotiation':
      case 'market_price_update':
        return signal.value

      default:
        return 0.5
    }
  }

  private _valueComponent(signal: EconomicSignal, calibration: CalibrationState): number {
    if (!['deal_closed', 'deal_lost', 'proposal_accepted'].includes(signal.source)) {
      return 0.5  // no value component for non-financial signals
    }

    // How does this deal compare to org baseline?
    const ratio = signal.raw_value / Math.max(1, calibration.baseline_deal_value)
    // Normalize: 1.0 at baseline, cap at 3x
    return Math.min(1, ratio / 3)
  }

  private _speedComponent(signal: EconomicSignal): number {
    if (signal.source !== 'time_to_close') return 0.5

    const days = signal.raw_value
    const benchmark = MARKET_BASELINE.days_to_close

    if (days <= benchmark * 0.5) return 1.0   // 2x faster than avg
    if (days <= benchmark)       return 0.75
    if (days <= benchmark * 1.5) return 0.5
    return 0.25  // very slow
  }
}

export const rewardCalibrationEngine = new RewardCalibrationEngine()
