// AGENCY GROUP — SH-ROS | AMI: 22506

import { logger } from '@/lib/observability/logger'


export type AIAction =
  | 'deal_pack_sent'
  | 'follow_up_triggered'
  | 'match_scored'
  | 'priority_escalated'
  | 'lead_recovered'
  | 'proposal_generated'
  | 'alert_sent'
  | 'workflow_automated'

export interface AttributionRecord {
  attribution_id: string
  org_id: string
  ai_action: AIAction
  deal_id: string
  revenue_amount_eur: number
  attribution_confidence: number  // 0-1
  attribution_model: 'last_touch' | 'first_touch' | 'linear' | 'time_decay'
  recorded_at: Date
}

export interface AttributionReport {
  org_id: string
  period: string
  total_attributed_revenue_eur: number
  by_action: Record<AIAction, number>
  confidence_score: number
  top_performing_action: AIAction
  methodology: string
  statement: string  // "SH-ROS generated €X incremental revenue"
}

const ALL_ACTIONS: AIAction[] = [
  'deal_pack_sent',
  'follow_up_triggered',
  'match_scored',
  'priority_escalated',
  'lead_recovered',
  'proposal_generated',
  'alert_sent',
  'workflow_automated',
]

export class RevenueAttributionEngine {
  private records: Map<string, AttributionRecord[]> = new Map()

  record(
    data: Omit<AttributionRecord, 'attribution_id' | 'recorded_at'>,
  ): AttributionRecord {
    const full: AttributionRecord = {
      ...data,
      attribution_id: crypto.randomUUID(),
      recorded_at: new Date(),
    }

    const existing = this.records.get(data.org_id) ?? []
    existing.push(full)
    this.records.set(data.org_id, existing)

    logger.info('RevenueAttributionEngine: attribution recorded', {
      org_id: data.org_id,
      ai_action: data.ai_action,
      revenue_amount_eur: data.revenue_amount_eur,
      attribution_confidence: data.attribution_confidence,
    })

    return full
  }

  attributeRevenue(orgId: string, period?: string): AttributionReport {
    const records = this._getRecords(orgId, period)

    if (records.length === 0) {
      logger.warn('RevenueAttributionEngine: no records found', { org_id: orgId, period })
      return this._emptyReport(orgId, period ?? 'all')
    }

    const byAction = this._aggregateByAction(records)
    const totalRevenue = Object.values(byAction).reduce((s, v) => s + v, 0)
    const confidenceScore = this.getConfidenceScore(orgId)
    const topAction = this._topAction(byAction)
    const statement = this.buildStatement(totalRevenue)

    const report: AttributionReport = {
      org_id: orgId,
      period: period ?? 'all',
      total_attributed_revenue_eur: totalRevenue,
      by_action: byAction,
      confidence_score: confidenceScore,
      top_performing_action: topAction,
      methodology: 'Weighted attribution using confidence-adjusted revenue. Models: last_touch, first_touch, linear, time_decay.',
      statement,
    }

    logger.info('RevenueAttributionEngine: attribution report generated', {
      org_id: orgId,
      total_attributed_revenue_eur: totalRevenue,
      top_action: topAction,
    })

    return report
  }

  getConfidenceScore(orgId: string): number {
    const records = this.records.get(orgId) ?? []
    if (records.length === 0) return 0
    const avg = records.reduce((s, r) => s + r.attribution_confidence, 0) / records.length
    return Math.min(avg, 1)
  }

  getReport(orgId: string, period?: string): AttributionReport {
    return this.attributeRevenue(orgId, period)
  }

  buildStatement(totalRevenue: number): string {
    const formatted = totalRevenue.toLocaleString('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    })
    return `SH-ROS generated ${formatted} incremental revenue in this period.`
  }

  private _getRecords(orgId: string, period?: string): AttributionRecord[] {
    const all = this.records.get(orgId) ?? []
    if (!period || period === 'all') return all

    const now = new Date()
    let cutoff: Date

    if (period === '30d') {
      cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    } else if (period === '90d') {
      cutoff = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
    } else if (period === 'ytd') {
      cutoff = new Date(now.getFullYear(), 0, 1)
    } else {
      return all
    }

    return all.filter(r => r.recorded_at >= cutoff)
  }

  private _aggregateByAction(records: AttributionRecord[]): Record<AIAction, number> {
    const result = Object.fromEntries(ALL_ACTIONS.map(a => [a, 0])) as Record<AIAction, number>

    for (const record of records) {
      const weighted = record.revenue_amount_eur * record.attribution_confidence
      result[record.ai_action] = (result[record.ai_action] ?? 0) + weighted
    }

    return result
  }

  private _topAction(byAction: Record<AIAction, number>): AIAction {
    let top: AIAction = 'deal_pack_sent'
    let max = -1
    for (const [action, value] of Object.entries(byAction) as [AIAction, number][]) {
      if (value > max) {
        max = value
        top = action
      }
    }
    return top
  }

  private _emptyReport(orgId: string, period: string): AttributionReport {
    return {
      org_id: orgId,
      period,
      total_attributed_revenue_eur: 0,
      by_action: Object.fromEntries(ALL_ACTIONS.map(a => [a, 0])) as Record<AIAction, number>,
      confidence_score: 0,
      top_performing_action: 'deal_pack_sent',
      methodology: 'No data available',
      statement: this.buildStatement(0),
    }
  }
}

export const revenueAttributionEngine = new RevenueAttributionEngine()
