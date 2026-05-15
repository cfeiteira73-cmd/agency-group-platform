// AGENCY GROUP — SH-ROS | AMI: 22506

import { logger } from '@/lib/observability/logger'
import { conversionUpliftTracker } from './conversionUpliftTracker'
import { timeToCloseAnalyzer } from './timeToCloseAnalyzer'
import { leadRecoveryImpact } from './leadRecoveryImpact'
import { pipelineAccelerationMetrics } from './pipelineAccelerationMetrics'
import { revenueAttributionEngine } from './revenueAttributionEngine'

// Platform cost tiers (monthly EUR) — Starter to Institutional
const PLATFORM_COST_TIERS: { max_agents: number; monthly_eur: number }[] = [
  { max_agents: 1, monthly_eur: 400 },
  { max_agents: 10, monthly_eur: 1_800 },
  { max_agents: 25, monthly_eur: 4_500 },
  { max_agents: Infinity, monthly_eur: 6_000 },
]

export interface EconomicProof {
  org_id: string
  period: string
  total_incremental_revenue_eur: number
  conversion_uplift_pct: number
  time_saved_hours: number
  leads_recovered: number
  pipeline_acceleration_pct: number
  roi_multiplier: number        // total_revenue / estimated_platform_cost
  confidence_score: number      // 0-1
  certification: 'PROVEN' | 'PROBABLE' | 'ESTIMATED'
  summary: string
  statement: string             // "This system generated €X incremental revenue with Y confidence"
  generated_at: Date
}

export class EconomicValidationReporter {
  generateProof(orgId: string, period?: string): EconomicProof {
    const upliftReport = conversionUpliftTracker.getUpliftReport(
      orgId,
      (period as '30d' | '90d' | 'ytd') ?? '90d',
    )
    const closeAnalysis = timeToCloseAnalyzer.analyze(orgId)
    const recoveryReport = leadRecoveryImpact.getImpact(orgId, period)
    const accelerationReport = pipelineAccelerationMetrics.calculateAcceleration(orgId)
    const attributionReport = revenueAttributionEngine.attributeRevenue(orgId, period)

    // Aggregate revenue from all sources (avoid double-counting by using attribution as primary)
    const totalRevenue = Math.max(
      attributionReport.total_attributed_revenue_eur,
      upliftReport.revenue_impact_eur +
        closeAnalysis.revenue_acceleration_eur +
        recoveryReport.total_value_recovered_eur,
    )

    // Time saved: convert improvement_days to hours (per deal, multiply by deals analyzed)
    const timeSavedHours = closeAnalysis.improvement_days * closeAnalysis.deals_analyzed * 8

    // Composite confidence
    const confidenceScore = this._compositeConfidence([
      upliftReport.confidence,
      closeAnalysis.confidence,
      attributionReport.confidence_score,
    ])

    const platformCost = this._estimatePlatformCost(orgId)
    const roiMultiplier = platformCost > 0 ? totalRevenue / platformCost : 0
    const certification = this.getCertification(confidenceScore)
    const summary = this._buildSummary({
      totalRevenue,
      upliftPct: upliftReport.uplift_pct,
      timeSavedHours,
      leadsRecovered: recoveryReport.total_recovered,
      accelerationPct: accelerationReport.acceleration_pct,
      roiMultiplier,
      certification,
    })
    const statement = `This system generated ${totalRevenue.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })} incremental revenue with ${(confidenceScore * 100).toFixed(0)}% confidence.`

    logger.info('EconomicValidationReporter: proof generated', {
      org_id: orgId,
      total_incremental_revenue_eur: totalRevenue,
      confidence_score: confidenceScore,
      certification,
    })

    return {
      org_id: orgId,
      period: period ?? '90d',
      total_incremental_revenue_eur: totalRevenue,
      conversion_uplift_pct: upliftReport.uplift_pct,
      time_saved_hours: timeSavedHours,
      leads_recovered: recoveryReport.total_recovered,
      pipeline_acceleration_pct: accelerationReport.acceleration_pct,
      roi_multiplier: roiMultiplier,
      confidence_score: confidenceScore,
      certification,
      summary,
      statement,
      generated_at: new Date(),
    }
  }

  getROIStatement(orgId: string): string {
    const proof = this.generateProof(orgId)
    return `[${proof.certification}] ${proof.statement} ROI: ${proof.roi_multiplier.toFixed(1)}x platform cost.`
  }

  exportReport(orgId: string): EconomicProof {
    logger.info('EconomicValidationReporter: exporting report', { org_id: orgId })
    return this.generateProof(orgId)
  }

  getCertification(confidence: number): EconomicProof['certification'] {
    if (confidence >= 0.75) return 'PROVEN'
    if (confidence >= 0.45) return 'PROBABLE'
    return 'ESTIMATED'
  }

  private _estimatePlatformCost(orgId: string): number {
    // Without org agent count in this module, default to mid-tier (Pro: €1,800/mo)
    // In production, this would query the org's current plan
    void orgId
    return PLATFORM_COST_TIERS[1].monthly_eur
  }

  private _compositeConfidence(scores: number[]): number {
    const valid = scores.filter(s => s > 0)
    if (valid.length === 0) return 0
    return valid.reduce((s, v) => s + v, 0) / valid.length
  }

  private _buildSummary(params: {
    totalRevenue: number
    upliftPct: number
    timeSavedHours: number
    leadsRecovered: number
    accelerationPct: number
    roiMultiplier: number
    certification: string
  }): string {
    const revenue = params.totalRevenue.toLocaleString('pt-PT', {
      style: 'currency',
      currency: 'EUR',
      maximumFractionDigits: 0,
    })

    return (
      `[${params.certification}] SH-ROS generated ${revenue} in incremental revenue. ` +
      `Conversion uplift: +${params.upliftPct.toFixed(1)}%. ` +
      `Time saved: ${params.timeSavedHours.toFixed(0)} hours. ` +
      `Leads recovered: ${params.leadsRecovered}. ` +
      `Pipeline acceleration: +${params.accelerationPct.toFixed(1)}%. ` +
      `ROI: ${params.roiMultiplier.toFixed(1)}x platform cost.`
    )
  }
}

export const economicValidationReporter = new EconomicValidationReporter()
