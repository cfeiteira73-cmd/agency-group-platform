// AGENCY GROUP — SH-ROS | AMI: 22506

import { logger } from '@/lib/observability/logger'
import { COMMISSION_RATE } from '@/lib/constants/pipeline'

// Portugal market baseline: 18% close rate
const BASELINE_CONVERSION_RATE = 0.18
const MIN_SAMPLE_FOR_CONFIDENCE = 20
const AVG_DEAL_VALUE_EUR = 320_000

export interface ConversionSnapshot {
  snapshot_id: string
  org_id: string
  period_start: Date
  period_end: Date
  conversion_rate: number // 0-1
  deals_attempted: number
  deals_closed: number
  ai_assisted: boolean
  sample_size: number
}

export interface UpliftAnalysis {
  org_id: string
  baseline_rate: number
  current_rate: number
  uplift_absolute: number   // current - baseline
  uplift_pct: number        // (current - baseline) / baseline * 100
  revenue_impact_eur: number
  confidence: number        // 0-1 based on sample size
  sample_size: number
  methodology: string
  period: string
}

export class ConversionUpliftTracker {
  private snapshots: Map<string, ConversionSnapshot[]> = new Map()

  recordSnapshot(snapshot: Omit<ConversionSnapshot, 'snapshot_id'>): ConversionSnapshot {
    const full: ConversionSnapshot = {
      ...snapshot,
      snapshot_id: crypto.randomUUID(),
    }

    const existing = this.snapshots.get(snapshot.org_id) ?? []
    existing.push(full)
    this.snapshots.set(snapshot.org_id, existing)

    logger.info('ConversionUpliftTracker: snapshot recorded', {
      org_id: snapshot.org_id,
      conversion_rate: snapshot.conversion_rate,
      sample_size: snapshot.sample_size,
    })

    return full
  }

  calculateUplift(orgId: string): UpliftAnalysis {
    const records = this.snapshots.get(orgId) ?? []

    if (records.length === 0) {
      logger.warn('ConversionUpliftTracker: no snapshots found for org', { org_id: orgId })
      return this._emptyAnalysis(orgId, 'all')
    }

    const totalAttempted = records.reduce((s, r) => s + r.deals_attempted, 0)
    const totalClosed = records.reduce((s, r) => s + r.deals_closed, 0)
    const currentRate = totalAttempted > 0 ? totalClosed / totalAttempted : 0
    const upliftAbsolute = currentRate - BASELINE_CONVERSION_RATE
    const upliftPct = BASELINE_CONVERSION_RATE > 0
      ? (upliftAbsolute / BASELINE_CONVERSION_RATE) * 100
      : 0
    const confidence = this.calculateConfidence(totalAttempted)
    const revenueImpact = this.estimateRevenueImpact(upliftAbsolute, totalAttempted)

    const analysis: UpliftAnalysis = {
      org_id: orgId,
      baseline_rate: BASELINE_CONVERSION_RATE,
      current_rate: currentRate,
      uplift_absolute: upliftAbsolute,
      uplift_pct: upliftPct,
      revenue_impact_eur: revenueImpact,
      confidence,
      sample_size: totalAttempted,
      methodology: 'Comparison against Portugal market baseline (18% close rate). Commission-adjusted revenue impact.',
      period: 'all',
    }

    logger.info('ConversionUpliftTracker: uplift calculated', {
      org_id: orgId,
      uplift_pct: upliftPct,
      revenue_impact_eur: revenueImpact,
    })

    return analysis
  }

  getUpliftReport(orgId: string, period: '30d' | '90d' | 'ytd'): UpliftAnalysis {
    const records = this.snapshots.get(orgId) ?? []
    const cutoff = this._periodCutoff(period)
    const filtered = records.filter(r => r.period_end >= cutoff)

    if (filtered.length === 0) {
      logger.warn('ConversionUpliftTracker: no records in period', { org_id: orgId, period })
      return this._emptyAnalysis(orgId, period)
    }

    const totalAttempted = filtered.reduce((s, r) => s + r.deals_attempted, 0)
    const totalClosed = filtered.reduce((s, r) => s + r.deals_closed, 0)
    const currentRate = totalAttempted > 0 ? totalClosed / totalAttempted : 0
    const upliftAbsolute = currentRate - BASELINE_CONVERSION_RATE
    const upliftPct = BASELINE_CONVERSION_RATE > 0
      ? (upliftAbsolute / BASELINE_CONVERSION_RATE) * 100
      : 0
    const confidence = this.calculateConfidence(totalAttempted)
    const revenueImpact = this.estimateRevenueImpact(upliftAbsolute, totalAttempted)

    logger.info('ConversionUpliftTracker: period report generated', { org_id: orgId, period, uplift_pct: upliftPct })

    return {
      org_id: orgId,
      baseline_rate: BASELINE_CONVERSION_RATE,
      current_rate: currentRate,
      uplift_absolute: upliftAbsolute,
      uplift_pct: upliftPct,
      revenue_impact_eur: revenueImpact,
      confidence,
      sample_size: totalAttempted,
      methodology: `Portugal market baseline comparison over ${period}. Commission @ 5%.`,
      period,
    }
  }

  calculateConfidence(sampleSize: number): number {
    if (sampleSize <= 0) return 0
    if (sampleSize >= MIN_SAMPLE_FOR_CONFIDENCE * 5) return 1.0
    if (sampleSize >= MIN_SAMPLE_FOR_CONFIDENCE) {
      return 0.5 + 0.5 * (sampleSize - MIN_SAMPLE_FOR_CONFIDENCE) / (MIN_SAMPLE_FOR_CONFIDENCE * 4)
    }
    return 0.5 * (sampleSize / MIN_SAMPLE_FOR_CONFIDENCE)
  }

  estimateRevenueImpact(
    uplift: number,
    dealsAttempted: number,
    avgDealValue: number = AVG_DEAL_VALUE_EUR,
  ): number {
    // Extra closed deals = uplift * dealsAttempted
    // Revenue = extra_deals * avgDealValue * commission
    const extraDeals = uplift * dealsAttempted
    return extraDeals * avgDealValue * COMMISSION_RATE
  }

  private _periodCutoff(period: '30d' | '90d' | 'ytd'): Date {
    const now = new Date()
    if (period === '30d') {
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    }
    if (period === '90d') {
      return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    }
    // ytd
    return new Date(now.getFullYear(), 0, 1)
  }

  private _emptyAnalysis(orgId: string, period: string): UpliftAnalysis {
    return {
      org_id: orgId,
      baseline_rate: BASELINE_CONVERSION_RATE,
      current_rate: 0,
      uplift_absolute: 0,
      uplift_pct: 0,
      revenue_impact_eur: 0,
      confidence: 0,
      sample_size: 0,
      methodology: 'No data available',
      period,
    }
  }
}

export const conversionUpliftTracker = new ConversionUpliftTracker()
