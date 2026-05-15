// AGENCY GROUP — SH-ROS | AMI: 22506

import { logger } from '@/lib/observability/logger'


const RECOVERY_AUTOMATION_COST_EUR_PER_MONTH = 200 // estimated operational cost
const COMMISSION_RATE = 0.05
const AVG_DEAL_VALUE_EUR = 320_000

export interface RecoveredLead {
  recovery_id: string
  lead_id: string
  org_id: string
  days_stale: number
  recovery_action: string
  recovered_at: Date
  converted: boolean
  deal_value_eur: number
  time_to_close_after_recovery?: number
}

export interface LeadRecoveryReport {
  org_id: string
  period: string
  total_recovered: number
  total_converted: number
  conversion_rate: number
  total_value_recovered_eur: number
  avg_days_to_recover: number
  roi_multiplier: number    // revenue / cost of recovery automation
  summary: string
}

export class LeadRecoveryImpact {
  private recovered: Map<string, RecoveredLead[]> = new Map()

  recordRecovery(record: Omit<RecoveredLead, 'recovery_id'>): RecoveredLead {
    const full: RecoveredLead = {
      ...record,
      recovery_id: crypto.randomUUID(),
    }

    const existing = this.recovered.get(record.org_id) ?? []
    existing.push(full)
    this.recovered.set(record.org_id, existing)

    logger.info('LeadRecoveryImpact: recovery recorded', {
      org_id: record.org_id,
      lead_id: record.lead_id,
      converted: record.converted,
      deal_value_eur: record.deal_value_eur,
    })

    return full
  }

  getImpact(orgId: string, period?: string): LeadRecoveryReport {
    const records = this.recovered.get(orgId) ?? []
    const filtered = period ? this._filterByPeriod(records, period) : records

    if (filtered.length === 0) {
      logger.warn('LeadRecoveryImpact: no recovery records', { org_id: orgId, period })
      return this._emptyReport(orgId, period ?? 'all')
    }

    const totalConverted = filtered.filter(r => r.converted).length
    const conversionRate = filtered.length > 0 ? totalConverted / filtered.length : 0
    const totalValue = this.getTotalValueRecovered(orgId)
    const avgDays = filtered.reduce((s, r) => s + r.days_stale, 0) / filtered.length
    const roi = this.getROI(orgId)

    const base: Omit<LeadRecoveryReport, 'summary'> = {
      org_id: orgId,
      period: period ?? 'all',
      total_recovered: filtered.length,
      total_converted: totalConverted,
      conversion_rate: conversionRate,
      total_value_recovered_eur: totalValue,
      avg_days_to_recover: avgDays,
      roi_multiplier: roi,
    }

    const summary = this._buildSummary(base)

    logger.info('LeadRecoveryImpact: impact report generated', {
      org_id: orgId,
      total_recovered: filtered.length,
      total_converted: totalConverted,
      roi_multiplier: roi,
    })

    return { ...base, summary }
  }

  getROI(orgId: string): number {
    const records = this.recovered.get(orgId) ?? []
    if (records.length === 0) return 0

    const totalRevenue = this.getTotalValueRecovered(orgId)
    // Estimate months of data to calculate cost
    const spanMonths = this._getSpanMonths(records)
    const totalCost = RECOVERY_AUTOMATION_COST_EUR_PER_MONTH * Math.max(spanMonths, 1)

    if (totalCost <= 0) return 0
    return totalRevenue / totalCost
  }

  getTotalValueRecovered(orgId: string): number {
    const records = this.recovered.get(orgId) ?? []
    return records
      .filter(r => r.converted)
      .reduce((s, r) => s + (r.deal_value_eur > 0 ? r.deal_value_eur : AVG_DEAL_VALUE_EUR) * COMMISSION_RATE, 0)
  }

  private _buildSummary(report: Omit<LeadRecoveryReport, 'summary'>): string {
    const convPct = (report.conversion_rate * 100).toFixed(1)
    const value = report.total_value_recovered_eur.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
    return (
      `SH-ROS recovered ${report.total_recovered} stale leads in ${report.period}, ` +
      `converting ${report.total_converted} (${convPct}%) for ${value} in commission revenue. ` +
      `ROI multiplier: ${report.roi_multiplier.toFixed(1)}x vs automation cost.`
    )
  }

  private _filterByPeriod(records: RecoveredLead[], period: string): RecoveredLead[] {
    const now = new Date()
    let cutoff: Date

    if (period === '30d') {
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    } else if (period === '90d') {
      cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    } else if (period === 'ytd') {
      cutoff = new Date(now.getFullYear(), 0, 1)
    } else {
      return records
    }

    return records.filter(r => r.recovered_at >= cutoff)
  }

  private _getSpanMonths(records: RecoveredLead[]): number {
    if (records.length < 2) return 1
    const dates = records.map(r => r.recovered_at.getTime())
    const spanMs = Math.max(...dates) - Math.min(...dates)
    return Math.max(spanMs / (1000 * 60 * 60 * 24 * 30), 1)
  }

  private _emptyReport(orgId: string, period: string): LeadRecoveryReport {
    return {
      org_id: orgId,
      period,
      total_recovered: 0,
      total_converted: 0,
      conversion_rate: 0,
      total_value_recovered_eur: 0,
      avg_days_to_recover: 0,
      roi_multiplier: 0,
      summary: 'No recovery data available for this period.',
    }
  }
}

export const leadRecoveryImpact = new LeadRecoveryImpact()
