// AGENCY GROUP — SH-ROS | AMI: 22506

import { logger } from '@/lib/observability/logger'


const PORTUGAL_BASELINE_DAYS = 210

export interface VelocitySnapshot {
  snapshot_id: string
  org_id: string
  captured_at: Date
  deals_per_month: number
  avg_deal_value_eur: number
  pipeline_value_eur: number
  pipeline_velocity: number  // pipeline_value / avg_days_to_close * 30
  close_rate: number
}

export interface AccelerationReport {
  org_id: string
  baseline_velocity: number
  current_velocity: number
  acceleration_pct: number
  projected_annual_uplift_eur: number
  snapshots_analyzed: number
  trend: 'accelerating' | 'steady' | 'decelerating'
  recommendation: string
}

export class PipelineAccelerationMetrics {
  private velocityHistory: Map<string, VelocitySnapshot[]> = new Map()

  captureVelocity(
    snapshot: Omit<VelocitySnapshot, 'snapshot_id' | 'pipeline_velocity'>,
  ): VelocitySnapshot {
    const velocity = this.calculateVelocity(
      snapshot.pipeline_value_eur,
      PORTUGAL_BASELINE_DAYS,
    )

    const full: VelocitySnapshot = {
      ...snapshot,
      snapshot_id: crypto.randomUUID(),
      pipeline_velocity: velocity,
    }

    const existing = this.velocityHistory.get(snapshot.org_id) ?? []
    existing.push(full)
    this.velocityHistory.set(snapshot.org_id, existing)

    logger.info('PipelineAccelerationMetrics: velocity snapshot captured', {
      org_id: snapshot.org_id,
      pipeline_velocity: velocity,
      pipeline_value_eur: snapshot.pipeline_value_eur,
    })

    return full
  }

  calculateAcceleration(orgId: string): AccelerationReport {
    const history = this.velocityHistory.get(orgId) ?? []

    if (history.length === 0) {
      logger.warn('PipelineAccelerationMetrics: no history for org', { org_id: orgId })
      return this._emptyReport(orgId)
    }

    // Sort chronologically
    const sorted = [...history].sort((a, b) => a.captured_at.getTime() - b.captured_at.getTime())

    const baselineVelocity = sorted[0].pipeline_velocity
    const currentVelocity = sorted[sorted.length - 1].pipeline_velocity

    const accelerationPct = baselineVelocity > 0
      ? ((currentVelocity - baselineVelocity) / baselineVelocity) * 100
      : 0

    const trend = this.getTrend(sorted)
    const annualUplift = this.projectAnnualImpact(orgId)
    const recommendation = this._buildRecommendation(trend, accelerationPct)

    logger.info('PipelineAccelerationMetrics: acceleration report generated', {
      org_id: orgId,
      acceleration_pct: accelerationPct,
      trend,
    })

    return {
      org_id: orgId,
      baseline_velocity: baselineVelocity,
      current_velocity: currentVelocity,
      acceleration_pct: accelerationPct,
      projected_annual_uplift_eur: annualUplift,
      snapshots_analyzed: history.length,
      trend,
      recommendation,
    }
  }

  projectAnnualImpact(orgId: string): number {
    const history = this.velocityHistory.get(orgId) ?? []
    if (history.length < 2) return 0

    const sorted = [...history].sort((a, b) => a.captured_at.getTime() - b.captured_at.getTime())
    const latest = sorted[sorted.length - 1]
    const baseline = sorted[0]

    const velocityGain = latest.pipeline_velocity - baseline.pipeline_velocity
    if (velocityGain <= 0) return 0

    // Annual impact = monthly velocity gain * 12
    return velocityGain * 12
  }

  getTrend(snapshots: VelocitySnapshot[]): AccelerationReport['trend'] {
    if (snapshots.length < 3) return 'steady'

    const sorted = [...snapshots].sort((a, b) => a.captured_at.getTime() - b.captured_at.getTime())
    const midpoint = Math.floor(sorted.length / 2)

    const earlyAvg = sorted.slice(0, midpoint).reduce((s, r) => s + r.pipeline_velocity, 0) / midpoint
    const lateAvg = sorted.slice(midpoint).reduce((s, r) => s + r.pipeline_velocity, 0) / (sorted.length - midpoint)

    const changePct = earlyAvg > 0 ? ((lateAvg - earlyAvg) / earlyAvg) * 100 : 0

    if (changePct > 5) return 'accelerating'
    if (changePct < -5) return 'decelerating'
    return 'steady'
  }

  calculateVelocity(pipelineValue: number, avgDaysToClose: number): number {
    if (avgDaysToClose <= 0) return 0
    return (pipelineValue / avgDaysToClose) * 30
  }

  private _buildRecommendation(
    trend: AccelerationReport['trend'],
    accelerationPct: number,
  ): string {
    if (trend === 'accelerating') {
      return `Pipeline velocity increasing ${accelerationPct.toFixed(1)}%. Maintain current AI-assisted workflows and consider scaling deal volume.`
    }
    if (trend === 'decelerating') {
      return `Pipeline velocity declining ${Math.abs(accelerationPct).toFixed(1)}%. Review stalled deals, activate SH-ROS re-engagement workflows, and audit top-of-funnel quality.`
    }
    return `Pipeline velocity stable. Activate SH-ROS acceleration protocols to drive uplift beyond current ${accelerationPct.toFixed(1)}% baseline.`
  }

  private _emptyReport(orgId: string): AccelerationReport {
    return {
      org_id: orgId,
      baseline_velocity: 0,
      current_velocity: 0,
      acceleration_pct: 0,
      projected_annual_uplift_eur: 0,
      snapshots_analyzed: 0,
      trend: 'steady',
      recommendation: 'No pipeline data available. Begin capturing velocity snapshots to enable analysis.',
    }
  }
}

export const pipelineAccelerationMetrics = new PipelineAccelerationMetrics()
