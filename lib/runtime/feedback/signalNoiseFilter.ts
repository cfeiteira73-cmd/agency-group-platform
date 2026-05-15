// AGENCY GROUP — SH-ROS Feedback: Signal/Noise Filter | AMI: 22506
// Separates genuine learning signals from noise before they reach training
// Prevents model poisoning from outliers, data corruption, or adversarial inputs
// =============================================================================

import type { EconomicSignal } from './economicSignalIngestor'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FilterResult {
  signal_id: string
  passed: boolean
  noise_score: number      // 0=clean, 1=pure noise
  filters_triggered: string[]
  reason: string | null
  filtered_at: string
}

export interface FilterStats {
  org_id: string
  total_processed: number
  total_passed: number
  total_filtered: number
  filter_rate: number
  noise_by_type: Record<string, number>
  last_filtered_at: string | null
}

export interface OutlierBounds {
  mean: number
  std_dev: number
  lower_bound: number   // mean - 3*std
  upper_bound: number   // mean + 3*std
  sample_count: number
}

// ─── Filter Rules ─────────────────────────────────────────────────────────────

type FilterFn = (signal: EconomicSignal, ctx: FilterContext) => FilterViolation | null

interface FilterViolation {
  filter_name: string
  reason: string
  noise_contribution: number  // how much noise this adds (0–1)
}

interface FilterContext {
  org_history: EconomicSignal[]
  value_bounds: OutlierBounds | null
}

// ─── Signal/Noise Filter ───────────────────────────────────────────────────────

export class SignalNoiseFilter {
  private _org_history  = new Map<string, EconomicSignal[]>()
  private _filter_stats = new Map<string, FilterStats>()

  // ─── Core Filter ──────────────────────────────────────────────────────────

  /**
   * Filter a single economic signal.
   * Returns FilterResult — caller decides whether to use the signal.
   */
  filter(signal: EconomicSignal): FilterResult {
    const history = this._org_history.get(signal.org_id) ?? []
    const bounds  = this._computeValueBounds(history, signal.source)

    const ctx: FilterContext = { org_history: history, value_bounds: bounds }

    const violations: FilterViolation[] = []

    for (const rule of this._rules) {
      const violation = rule(signal, ctx)
      if (violation) violations.push(violation)
    }

    const noise_score = violations.length === 0
      ? 0
      : Math.min(1, violations.reduce((s, v) => s + v.noise_contribution, 0))

    const passed = noise_score < 0.5 && violations.filter(v => v.noise_contribution >= 0.7).length === 0

    const result: FilterResult = {
      signal_id:         signal.signal_id,
      passed,
      noise_score,
      filters_triggered: violations.map(v => v.filter_name),
      reason:            violations.length > 0 ? violations.map(v => v.reason).join('; ') : null,
      filtered_at:       new Date().toISOString(),
    }

    // Update history
    if (passed) {
      history.push(signal)
      if (history.length > 500) history.shift()
      this._org_history.set(signal.org_id, history)
    }

    // Update stats
    this._updateStats(signal.org_id, result)

    if (!passed) {
      logger.info('[SignalNoiseFilter] Signal filtered', {
        signal_id: signal.signal_id,
        source:    signal.source,
        noise:     noise_score.toFixed(2),
        reasons:   result.reason,
      })
    }

    return result
  }

  /**
   * Filter a batch — returns only the signals that pass.
   */
  filterBatch(signals: EconomicSignal[]): {
    clean:    EconomicSignal[]
    filtered: EconomicSignal[]
    results:  FilterResult[]
  } {
    const clean: EconomicSignal[]    = []
    const filtered: EconomicSignal[] = []
    const results: FilterResult[]    = []

    for (const signal of signals) {
      const result = this.filter(signal)
      results.push(result)
      if (result.passed) clean.push(signal)
      else filtered.push(signal)
    }

    if (filtered.length > 0) {
      logger.info('[SignalNoiseFilter] Batch filtered', {
        total:    signals.length,
        clean:    clean.length,
        filtered: filtered.length,
        rate:     (filtered.length / signals.length * 100).toFixed(1) + '%',
      })
    }

    return { clean, filtered, results }
  }

  /**
   * Get filter statistics for an org.
   */
  getStats(org_id: string): FilterStats | null {
    return this._filter_stats.get(org_id) ?? null
  }

  /**
   * Compute value bounds for outlier detection (3-sigma rule).
   */
  computeOutlierBounds(org_id: string, source: EconomicSignal['source']): OutlierBounds | null {
    const history = this._org_history.get(org_id) ?? []
    return this._computeValueBounds(history, source)
  }

  // ─── Filter Rules ─────────────────────────────────────────────────────────

  private readonly _rules: FilterFn[] = [

    // Rule 1: Zero/negative values for financial signals
    (signal) => {
      const financial_sources = ['deal_closed', 'deal_lost', 'proposal_accepted']
      if (!financial_sources.includes(signal.source)) return null
      if (signal.raw_value <= 0) {
        return {
          filter_name:         'zero_value',
          reason:              `Financial signal has non-positive value: ${signal.raw_value}`,
          noise_contribution:  0.8,
        }
      }
      return null
    },

    // Rule 2: Extreme outliers (>5 sigma from mean)
    (signal, ctx) => {
      if (!ctx.value_bounds || ctx.value_bounds.sample_count < 10) return null
      const { mean, std_dev } = ctx.value_bounds
      if (std_dev === 0) return null

      const z_score = Math.abs(signal.raw_value - mean) / std_dev
      if (z_score > 5) {
        return {
          filter_name:         'extreme_outlier',
          reason:              `Value z-score ${z_score.toFixed(1)} exceeds 5σ threshold`,
          noise_contribution:  0.7,
        }
      }
      return null
    },

    // Rule 3: Timestamp in the future
    (signal) => {
      const signal_ts = new Date(signal.ingested_at).getTime()
      const now       = Date.now()
      if (signal_ts > now + 60_000) {  // 1 min tolerance
        return {
          filter_name:         'future_timestamp',
          reason:              `Signal timestamp is in the future: ${signal.ingested_at}`,
          noise_contribution:  0.9,
        }
      }
      return null
    },

    // Rule 4: Confidence too low
    (signal) => {
      if (signal.confidence < 0.1) {
        return {
          filter_name:         'low_confidence',
          reason:              `Signal confidence ${signal.confidence} below minimum 0.1`,
          noise_contribution:  0.6,
        }
      }
      return null
    },

    // Rule 5: Duplicate signal (same entity + source within 5 minutes)
    (signal, ctx) => {
      const five_mins_ago = Date.now() - 5 * 60_000
      const duplicate = ctx.org_history.find(h =>
        h.entity_id === signal.entity_id &&
        h.source    === signal.source &&
        new Date(h.ingested_at).getTime() > five_mins_ago
      )
      if (duplicate) {
        return {
          filter_name:         'duplicate_signal',
          reason:              `Duplicate: entity ${signal.entity_id} had ${signal.source} at ${duplicate.ingested_at}`,
          noise_contribution:  0.75,
        }
      }
      return null
    },

    // Rule 6: Implausible deal value for Portugal market
    (signal) => {
      const financial_sources = ['deal_closed', 'deal_lost', 'proposal_accepted']
      if (!financial_sources.includes(signal.source)) return null

      const MAX_DEAL = 100_000_000  // €100M (Agency Group max)
      const MIN_DEAL = 50_000       // €50K (below market floor)

      if (signal.raw_value > MAX_DEAL) {
        return {
          filter_name:         'implausible_value_high',
          reason:              `Deal value €${signal.raw_value.toLocaleString()} exceeds €100M ceiling`,
          noise_contribution:  0.65,
        }
      }
      if (signal.raw_value < MIN_DEAL && signal.raw_value > 0) {
        return {
          filter_name:         'implausible_value_low',
          reason:              `Deal value €${signal.raw_value.toLocaleString()} below €50K floor`,
          noise_contribution:  0.5,
        }
      }
      return null
    },

    // Rule 7: Match score outside 0–100 range
    (signal) => {
      const match_sources = ['match_accepted', 'match_rejected']
      if (!match_sources.includes(signal.source)) return null
      if (signal.raw_value < 0 || signal.raw_value > 100) {
        return {
          filter_name:         'invalid_match_score',
          reason:              `Match score ${signal.raw_value} outside valid 0–100 range`,
          noise_contribution:  0.85,
        }
      }
      return null
    },
  ]

  // ─── Private ────────────────────────────────────────────────────────────────

  private _computeValueBounds(
    history: EconomicSignal[],
    source: EconomicSignal['source']
  ): OutlierBounds | null {
    const relevant = history.filter(h => h.source === source)
    if (relevant.length < 5) return null

    const values = relevant.map(h => h.raw_value)
    const mean = values.reduce((s, v) => s + v, 0) / values.length
    const variance = values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length
    const std_dev = Math.sqrt(variance)

    return {
      mean,
      std_dev,
      lower_bound: mean - 3 * std_dev,
      upper_bound: mean + 3 * std_dev,
      sample_count: values.length,
    }
  }

  private _updateStats(org_id: string, result: FilterResult): void {
    const existing = this._filter_stats.get(org_id)

    if (!existing) {
      const noise_by_type: Record<string, number> = {}
      for (const f of result.filters_triggered) noise_by_type[f] = 1

      this._filter_stats.set(org_id, {
        org_id,
        total_processed: 1,
        total_passed:    result.passed ? 1 : 0,
        total_filtered:  result.passed ? 0 : 1,
        filter_rate:     result.passed ? 0 : 1,
        noise_by_type,
        last_filtered_at: result.passed ? null : result.filtered_at,
      })
      return
    }

    const total    = existing.total_processed + 1
    const passed   = existing.total_passed    + (result.passed ? 1 : 0)
    const filtered = existing.total_filtered  + (result.passed ? 0 : 1)

    const noise_by_type = { ...existing.noise_by_type }
    for (const f of result.filters_triggered) {
      noise_by_type[f] = (noise_by_type[f] ?? 0) + 1
    }

    this._filter_stats.set(org_id, {
      ...existing,
      total_processed: total,
      total_passed:    passed,
      total_filtered:  filtered,
      filter_rate:     filtered / total,
      noise_by_type,
      last_filtered_at: result.passed ? existing.last_filtered_at : result.filtered_at,
    })
  }
}

export const signalNoiseFilter = new SignalNoiseFilter()
