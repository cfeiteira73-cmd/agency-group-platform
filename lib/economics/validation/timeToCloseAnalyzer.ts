// AGENCY GROUP — SH-ROS | AMI: 22506

import { logger } from '@/lib/observability/logger'


// Portugal market baseline: 210 avg days to close
const PORTUGAL_BASELINE_DAYS = 210
const AVG_DEAL_VALUE_EUR = 320_000
const COMMISSION_RATE = 0.05
// Annual discount rate for time-value-of-money calculation (opportunity cost)
const ANNUAL_DISCOUNT_RATE = 0.08

export interface DealCloseRecord {
  record_id: string
  deal_id: string
  org_id: string
  days_to_close: number
  ai_assisted: boolean
  stage_durations: Record<string, number> // stage -> days
  deal_value_eur: number
  recorded_at: Date
}

export interface CloseTimeAnalysis {
  org_id: string
  avg_days_baseline: number   // default 210 (Portugal market)
  avg_days_current: number
  improvement_days: number
  improvement_pct: number
  revenue_acceleration_eur: number // value of closing faster (time value of money / opportunity cost)
  deals_analyzed: number
  confidence: number
}

export class TimeToCloseAnalyzer {
  private records: Map<string, DealCloseRecord[]> = new Map()

  recordDeal(
    record: Omit<DealCloseRecord, 'record_id' | 'recorded_at'>,
  ): DealCloseRecord {
    const full: DealCloseRecord = {
      ...record,
      record_id: crypto.randomUUID(),
      recorded_at: new Date(),
    }

    const existing = this.records.get(record.org_id) ?? []
    existing.push(full)
    this.records.set(record.org_id, existing)

    logger.info('TimeToCloseAnalyzer: deal recorded', {
      org_id: record.org_id,
      deal_id: record.deal_id,
      days_to_close: record.days_to_close,
      ai_assisted: record.ai_assisted,
    })

    return full
  }

  analyze(orgId: string): CloseTimeAnalysis {
    const records = this.records.get(orgId) ?? []

    if (records.length === 0) {
      logger.warn('TimeToCloseAnalyzer: no records found for org', { org_id: orgId })
      return this._emptyAnalysis(orgId)
    }

    const avgDays = records.reduce((s, r) => s + r.days_to_close, 0) / records.length
    const improvementDays = PORTUGAL_BASELINE_DAYS - avgDays
    const improvementPct = (improvementDays / PORTUGAL_BASELINE_DAYS) * 100
    const dealsPerYear = Math.round((records.length / this._getSpanDays(records)) * 365)
    const accelerationValue = this._calculateAccelerationValue(
      improvementDays,
      dealsPerYear,
      AVG_DEAL_VALUE_EUR,
    )
    const confidence = this._calculateConfidence(records.length)

    logger.info('TimeToCloseAnalyzer: analysis complete', {
      org_id: orgId,
      avg_days: avgDays,
      improvement_days: improvementDays,
      revenue_acceleration_eur: accelerationValue,
    })

    return {
      org_id: orgId,
      avg_days_baseline: PORTUGAL_BASELINE_DAYS,
      avg_days_current: avgDays,
      improvement_days: improvementDays,
      improvement_pct: improvementPct,
      revenue_acceleration_eur: accelerationValue,
      deals_analyzed: records.length,
      confidence,
    }
  }

  getAccelerationValue(orgId: string): number {
    const analysis = this.analyze(orgId)
    return analysis.revenue_acceleration_eur
  }

  getStageBreakdown(orgId: string): Record<string, number> {
    const records = this.records.get(orgId) ?? []

    if (records.length === 0) return {}

    const stageTotals: Record<string, number> = {}
    const stageCounts: Record<string, number> = {}

    for (const record of records) {
      for (const [stage, days] of Object.entries(record.stage_durations)) {
        stageTotals[stage] = (stageTotals[stage] ?? 0) + days
        stageCounts[stage] = (stageCounts[stage] ?? 0) + 1
      }
    }

    const avgByStage: Record<string, number> = {}
    for (const stage of Object.keys(stageTotals)) {
      avgByStage[stage] = stageTotals[stage] / stageCounts[stage]
    }

    logger.info('TimeToCloseAnalyzer: stage breakdown computed', { org_id: orgId, stages: Object.keys(avgByStage) })

    return avgByStage
  }

  private _calculateAccelerationValue(
    daysSaved: number,
    dealsPerYear: number,
    avgDealValue: number,
  ): number {
    if (daysSaved <= 0) return 0
    // Time-value: each deal closes daysSaved earlier
    // Value = commission * avgDeal * (daysSaved / 365) * discount_rate * dealsPerYear
    const dailyRate = ANNUAL_DISCOUNT_RATE / 365
    const commissionPerDeal = avgDealValue * COMMISSION_RATE
    return commissionPerDeal * daysSaved * dailyRate * dealsPerYear
  }

  private _getSpanDays(records: DealCloseRecord[]): number {
    if (records.length < 2) return 365 // default to 1 year
    const dates = records.map(r => r.recorded_at.getTime())
    const span = (Math.max(...dates) - Math.min(...dates)) / (1000 * 60 * 60 * 24)
    return Math.max(span, 1)
  }

  private _calculateConfidence(sampleSize: number): number {
    if (sampleSize <= 0) return 0
    if (sampleSize >= 50) return 1.0
    if (sampleSize >= 10) return 0.5 + (sampleSize - 10) / 80
    return sampleSize / 20
  }

  private _emptyAnalysis(orgId: string): CloseTimeAnalysis {
    return {
      org_id: orgId,
      avg_days_baseline: PORTUGAL_BASELINE_DAYS,
      avg_days_current: 0,
      improvement_days: 0,
      improvement_pct: 0,
      revenue_acceleration_eur: 0,
      deals_analyzed: 0,
      confidence: 0,
    }
  }
}

export const timeToCloseAnalyzer = new TimeToCloseAnalyzer()
