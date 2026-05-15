// AGENCY GROUP — SH-ROS Ω∞∞ Operations: operationalAnomaly | AMI: 22506
// Detects operational anomalies — conversion drops, stall spikes, velocity degradation
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

export interface OperationalAnomaly {
  id: string
  org_id: string
  anomaly_type: 'conversion_drop' | 'stall_spike' | 'follow_up_gap' | 'velocity_degradation' | 'volume_collapse'
  severity: 'critical' | 'high' | 'medium' | 'low'
  description: string
  affected_metric: string
  current_value: number
  expected_value: number
  deviation_pct: number
  detected_at: string
  suggested_action: string
}

export class OperationalAnomalyDetector {
  async detectOrgAnomalies(
    org_id: string,
    period_days = 30
  ): Promise<OperationalAnomaly[]> {
    const anomalies: OperationalAnomaly[] = []
    const now = new Date().toISOString()

    // Fetch recent deals (current window)
    const recentFrom = new Date(Date.now() - period_days * 86_400_000).toISOString()
    const baselineFrom = new Date(Date.now() - period_days * 2 * 86_400_000).toISOString()

    const { data: recentDeals } = await sb
      .from('deals')
      .select('id, status, stage, updated_at, value_eur')
      .eq('org_id', org_id)
      .gte('created_at', recentFrom)
      .limit(500)

    const { data: baselineDeals } = await sb
      .from('deals')
      .select('id, status, stage, updated_at, value_eur')
      .eq('org_id', org_id)
      .gte('created_at', baselineFrom)
      .lt('created_at', recentFrom)
      .limit(500)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recent: any[] = recentDeals ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const baseline: any[] = baselineDeals ?? []

    // ── Conversion drop ──────────────────────────────────────────────────────
    const recentClose = recent.filter((d: any) => d.status === 'closed_won').length
    const baselineClose = baseline.filter((d: any) => d.status === 'closed_won').length
    const recentRate = recent.length > 0 ? recentClose / recent.length : 0
    const baselineRate = baseline.length > 0 ? baselineClose / baseline.length : 0.1

    if (recentRate < baselineRate * 0.8 && recent.length >= 5) {
      const dev = Math.round(((recentRate - baselineRate) / baselineRate) * 1000) / 10
      anomalies.push({
        id: randomUUID(), org_id, anomaly_type: 'conversion_drop',
        severity: recentRate < baselineRate * 0.5 ? 'critical' : 'high',
        description: `Conversion rate dropped from ${(baselineRate * 100).toFixed(1)}% to ${(recentRate * 100).toFixed(1)}%`,
        affected_metric: 'conversion_rate',
        current_value: Math.round(recentRate * 1000) / 10,
        expected_value: Math.round(baselineRate * 1000) / 10,
        deviation_pct: dev,
        detected_at: now,
        suggested_action: 'Review lead qualification criteria and agent follow-up patterns',
      })
    }

    // ── Stall spike ──────────────────────────────────────────────────────────
    const stall_threshold = new Date(Date.now() - 14 * 86_400_000).toISOString()
    const stalledCount = recent.filter((d: any) =>
      d.status === 'active' && (d.updated_at as string) < stall_threshold
    ).length
    const stallRate = recent.length > 0 ? stalledCount / recent.length : 0

    if (stallRate > 0.4 && recent.length >= 3) {
      anomalies.push({
        id: randomUUID(), org_id, anomaly_type: 'stall_spike',
        severity: stallRate > 0.6 ? 'critical' : 'high',
        description: `${(stallRate * 100).toFixed(0)}% of active deals have not been updated in >14 days`,
        affected_metric: 'stall_rate',
        current_value: Math.round(stallRate * 1000) / 10,
        expected_value: 15,
        deviation_pct: Math.round(stallRate * 100 - 15),
        detected_at: now,
        suggested_action: 'Trigger automated re-engagement workflow for stalled deals',
      })
    }

    // ── Volume collapse ──────────────────────────────────────────────────────
    if (baseline.length > 0 && recent.length < baseline.length * 0.6) {
      const dev = Math.round(((recent.length - baseline.length) / baseline.length) * 1000) / 10
      anomalies.push({
        id: randomUUID(), org_id, anomaly_type: 'volume_collapse',
        severity: recent.length < baseline.length * 0.4 ? 'critical' : 'medium',
        description: `Deal volume dropped ${Math.abs(dev)}% vs previous ${period_days}-day period`,
        affected_metric: 'deal_volume',
        current_value: recent.length,
        expected_value: baseline.length,
        deviation_pct: dev,
        detected_at: now,
        suggested_action: 'Review lead generation pipeline and marketing spend',
      })
    }

    logger.info('[OperationalAnomaly] Detection complete', { org_id, anomalies: anomalies.length })
    return anomalies
  }

  async generateAnomalyReport(
    org_id: string
  ): Promise<{ critical: number; high: number; anomalies: OperationalAnomaly[] }> {
    const anomalies = await this.detectOrgAnomalies(org_id)
    return {
      critical: anomalies.filter((a) => a.severity === 'critical').length,
      high: anomalies.filter((a) => a.severity === 'high').length,
      anomalies,
    }
  }
}

export const operationalAnomalyDetector = new OperationalAnomalyDetector()
