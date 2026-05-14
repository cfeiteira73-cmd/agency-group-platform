// AGENCY GROUP — SH-ROS Observability: economicMetrics | AMI: 22506

import { metricsRegistry } from './metricsRegistry'

export interface EconomicHealthReport {
  org_id: string
  period_h: number
  total_ev_score: number
  avg_ev_per_event: number
  total_revenue_impact_eur: number
  roi_accuracy_pct: number
  top_performing_agent: string
  worst_performing_agent: string
  computed_at: string
}

interface EVRecord {
  agent_id: string
  ev: number
  timestamp: number
}

interface RevenueRecord {
  agent_id: string
  impact_eur: number
  timestamp: number
}

interface ROIRecord {
  predicted_eur: number
  actual_eur: number
  timestamp: number
}

const WINDOW_SIZE = 1000

export class EconomicMetricsCollector {
  private readonly _evRecords: Map<string, EVRecord[]> = new Map()
  private readonly _revenueRecords: Map<string, RevenueRecord[]> = new Map()
  private readonly _roiRecords: Map<string, ROIRecord[]> = new Map()

  recordEVScore(org_id: string, agent_id: string, ev: number): void {
    metricsRegistry.histogram('shros_ev_score', { org_id, agent_id }).observe(ev)

    const key = org_id
    const records = this._evRecords.get(key) ?? []
    records.push({ agent_id, ev, timestamp: Date.now() })
    if (records.length > WINDOW_SIZE) records.shift()
    this._evRecords.set(key, records)
  }

  recordRevenueImpact(org_id: string, agent_id: string, impact_eur: number): void {
    metricsRegistry.histogram('shros_revenue_impact_eur', { org_id, agent_id }).observe(impact_eur)

    const key = org_id
    const records = this._revenueRecords.get(key) ?? []
    records.push({ agent_id, impact_eur, timestamp: Date.now() })
    if (records.length > WINDOW_SIZE) records.shift()
    this._revenueRecords.set(key, records)
  }

  recordROI(org_id: string, predicted_eur: number, actual_eur: number): void {
    const key = org_id
    const records = this._roiRecords.get(key) ?? []
    records.push({ predicted_eur, actual_eur, timestamp: Date.now() })
    if (records.length > WINDOW_SIZE) records.shift()
    this._roiRecords.set(key, records)
  }

  getEconomicHealth(org_id: string): EconomicHealthReport {
    const evRecords = this._evRecords.get(org_id) ?? []
    const revenueRecords = this._revenueRecords.get(org_id) ?? []
    const roiRecords = this._roiRecords.get(org_id) ?? []

    const total_ev_score = evRecords.reduce((sum, r) => sum + r.ev, 0)
    const avg_ev_per_event = evRecords.length > 0 ? total_ev_score / evRecords.length : 0
    const total_revenue_impact_eur = revenueRecords.reduce((sum, r) => sum + r.impact_eur, 0)

    // ROI accuracy: avg absolute % deviation between predicted and actual
    let roi_accuracy_pct = 100
    if (roiRecords.length > 0) {
      const totalDeviation = roiRecords.reduce((sum, r) => {
        if (r.actual_eur === 0) return sum
        const dev = Math.abs((r.predicted_eur - r.actual_eur) / r.actual_eur) * 100
        return sum + dev
      }, 0)
      roi_accuracy_pct = Math.max(0, 100 - totalDeviation / roiRecords.length)
    }

    // Top/worst performing agents by total EV
    const agentEV: Map<string, number> = new Map()
    for (const r of evRecords) {
      agentEV.set(r.agent_id, (agentEV.get(r.agent_id) ?? 0) + r.ev)
    }

    let top_performing_agent = 'none'
    let worst_performing_agent = 'none'
    let maxEV = -Infinity
    let minEV = Infinity

    for (const [agent_id, total] of agentEV.entries()) {
      if (total > maxEV) { maxEV = total; top_performing_agent = agent_id }
      if (total < minEV) { minEV = total; worst_performing_agent = agent_id }
    }

    return {
      org_id,
      period_h: 24,
      total_ev_score,
      avg_ev_per_event,
      total_revenue_impact_eur,
      roi_accuracy_pct,
      top_performing_agent,
      worst_performing_agent,
      computed_at: new Date().toISOString(),
    }
  }
}

export const economicMetrics = new EconomicMetricsCollector()
