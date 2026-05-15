// AGENCY GROUP — SH-ROS | AMI: 22506
// Revenue Narrator — translates pipeline numbers into plain-English executive stories
// Portugal 2026: €3.076/m² median · 210 days avg close · 18% close rate · 5% commission
// =============================================================================

import { logger } from '@/lib/observability/logger'

// ─── Constants ─────────────────────────────────────────────────────────────────

const AVG_DEAL_VALUE = 320_000
const COMMISSION_RATE = 0.05
const CLOSE_RATE_BASELINE = 0.18
const AVG_DAYS_TO_CLOSE = 210
const MONTHLY_TARGET = 50_000

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface RevenueMomentum {
  label: 'accelerating' | 'steady' | 'slowing' | 'declining'
  description: string
  driver: string
}

export interface RevenueNarrative {
  org_id: string
  period: '7d' | '30d' | '90d'
  headline: string
  pipeline_story: string
  momentum_story: string
  risk_story: string
  projection_story: string
  one_liner: string
  momentum: RevenueMomentum
  generated_at: Date
}

// ─── Revenue Narrator ─────────────────────────────────────────────────────────

export class RevenueNarrator {
  /**
   * Generate a full revenue narrative for the given period.
   */
  narrate(orgId: string, period: '7d' | '30d' | '90d'): RevenueNarrative {
    logger.info('[RevenueNarrator] Generating narrative', {
      route: 'executive/narrator',
      correlation_id: orgId,
    })

    // Baseline pipeline — in production hydrated from businessPrimitiveEngine
    const dealsActive = 8
    const pipelineValue = dealsActive * AVG_DEAL_VALUE
    const closeRate = CLOSE_RATE_BASELINE
    const expectedRevenue = pipelineValue * closeRate * COMMISSION_RATE
    const momentum = this.getMomentum(closeRate)

    const pipeline_story = this._buildPipelineStory(pipelineValue, expectedRevenue)
    const momentum_story = this._buildMomentumStory(momentum, closeRate)
    const risk_story = this._buildRiskStory(pipelineValue, closeRate, period)
    const projection_story = this._buildProjection(pipelineValue, closeRate, AVG_DAYS_TO_CLOSE)
    const one_liner = this.getOneLiner(orgId)

    const headline = this._buildHeadline(period, pipelineValue, momentum)

    const narrative: RevenueNarrative = {
      org_id: orgId,
      period,
      headline,
      pipeline_story,
      momentum_story,
      risk_story,
      projection_story,
      one_liner,
      momentum,
      generated_at: new Date(),
    }

    logger.info('[RevenueNarrator] Narrative ready', {
      route: 'executive/narrator',
      correlation_id: orgId,
    })

    return narrative
  }

  /**
   * Return a single executive summary line.
   */
  getOneLiner(orgId: string): string {
    const pipelineValue = 8 * AVG_DEAL_VALUE
    const expectedCommission = pipelineValue * CLOSE_RATE_BASELINE * COMMISSION_RATE
    const targetPct = Math.round((expectedCommission / MONTHLY_TARGET) * 100)

    return `Pipeline of ${this._formatEur(pipelineValue)} yields expected commission of ${this._formatEur(expectedCommission)} — ${targetPct}% of ${this._formatEur(MONTHLY_TARGET)} monthly target at Portugal's 18% close rate.`
  }

  /**
   * Classify revenue momentum based on close rate vs baseline.
   */
  getMomentum(closeRate: number, baselineCloseRate?: number): RevenueMomentum {
    const baseline = baselineCloseRate ?? CLOSE_RATE_BASELINE
    const ratio = closeRate / baseline

    if (ratio >= 1.2) {
      return {
        label: 'accelerating',
        description: 'Close rate is significantly above Portugal baseline — revenue is outperforming expectations.',
        driver: 'Higher-than-average qualification quality and proposal conversion',
      }
    }
    if (ratio >= 0.95) {
      return {
        label: 'steady',
        description: 'Close rate is in line with Portugal market baseline — revenue is tracking as expected.',
        driver: 'Consistent execution across lead qualification and deal management',
      }
    }
    if (ratio >= 0.75) {
      return {
        label: 'slowing',
        description: 'Close rate is below baseline — revenue generation is losing pace.',
        driver: 'Proposal quality or follow-up cadence requires review',
      }
    }
    return {
      label: 'declining',
      description: 'Close rate is significantly below Portugal baseline — revenue is at risk.',
      driver: 'Pipeline conversion breakdown — immediate review of deal stages required',
    }
  }

  // ─── Private methods ─────────────────────────────────────────────────────────

  private _formatEur(value: number): string {
    return `€${value.toLocaleString('pt-PT', { maximumFractionDigits: 0 })}`
  }

  private _buildPipelineStory(pipelineValue: number, expectedRevenue: number): string {
    const dealsEstimate = Math.round(pipelineValue / AVG_DEAL_VALUE)
    const expectedCommission = pipelineValue * CLOSE_RATE_BASELINE * COMMISSION_RATE
    const targetPct = Math.round((expectedCommission / MONTHLY_TARGET) * 100)

    return (
      `Your pipeline stands at ${this._formatEur(pipelineValue)} across approximately ${dealsEstimate} active deals. ` +
      `At Portugal's 18% baseline close rate, this pipeline is expected to generate ${this._formatEur(expectedRevenue)} in net commission, ` +
      `representing ${targetPct}% of the ${this._formatEur(MONTHLY_TARGET)} monthly target. ` +
      `Average deal value in the current pipeline is ${this._formatEur(pipelineValue / dealsEstimate)}, ` +
      `${pipelineValue / dealsEstimate >= AVG_DEAL_VALUE ? 'above' : 'below'} the ${this._formatEur(AVG_DEAL_VALUE)} market average.`
    )
  }

  private _buildMomentumStory(momentum: RevenueMomentum, closeRate: number): string {
    const momentumLabel: Record<RevenueMomentum['label'], string> = {
      accelerating: 'accelerating — above Portugal benchmark',
      steady: 'steady — tracking Portugal benchmark',
      slowing: 'slowing — below Portugal benchmark',
      declining: 'declining — materially below Portugal benchmark',
    }

    return (
      `Revenue momentum is ${momentumLabel[momentum.label]}. ` +
      `${momentum.description} ` +
      `Current close rate is ${(closeRate * 100).toFixed(1)}% vs the ${(CLOSE_RATE_BASELINE * 100).toFixed(0)}% Portugal baseline. ` +
      `Primary driver: ${momentum.driver}.`
    )
  }

  private _buildRiskStory(pipelineValue: number, closeRate: number, period: string): string {
    const riskValue = pipelineValue * (1 - closeRate) * COMMISSION_RATE
    const dealsThinRisk = pipelineValue < AVG_DEAL_VALUE * 4
    const velocityRisk = closeRate < CLOSE_RATE_BASELINE * 0.8

    const risks: string[] = []

    if (dealsThinRisk) {
      risks.push(`thin pipeline (below 4× avg deal safety threshold)`)
    }
    if (velocityRisk) {
      risks.push(`close rate ${((CLOSE_RATE_BASELINE - closeRate) * 100).toFixed(1)}pp below Portugal baseline`)
    }
    risks.push(`${this._formatEur(riskValue)} commission at risk if close rate stays at current level`)

    if (period === '90d') {
      risks.push(`seasonality — August/December typically see 15–20% lower transaction volumes in Portugal`)
    }

    return (
      `The main risk is ${risks[0]}. ` +
      `Additionally: ${risks.slice(1).join('; ')}. ` +
      `Portugal's 210-day avg close cycle means today's pipeline health directly determines Q4 revenue.`
    )
  }

  private _buildProjection(pipelineValue: number, closeRate: number, avgDaysToClose: number): string {
    const dealsWon = Math.round((pipelineValue / AVG_DEAL_VALUE) * closeRate)
    const projectedCommission = dealsWon * AVG_DEAL_VALUE * COMMISSION_RATE
    const projectedDate = new Date()
    projectedDate.setDate(projectedDate.getDate() + avgDaysToClose)
    const projDateStr = projectedDate.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' })

    const annualRunRate = projectedCommission * (365 / avgDaysToClose)

    return (
      `At this rate, you are projected to close ${dealsWon} deal${dealsWon !== 1 ? 's' : ''} by ${projDateStr}, ` +
      `generating ${this._formatEur(projectedCommission)} in commission. ` +
      `Annual run rate at current pace: ${this._formatEur(annualRunRate)}. ` +
      `To reach the ${this._formatEur(MONTHLY_TARGET)} monthly target, ${Math.ceil(MONTHLY_TARGET / (AVG_DEAL_VALUE * COMMISSION_RATE))} deal closings per month are required.`
    )
  }

  private _buildHeadline(
    period: string,
    pipelineValue: number,
    momentum: RevenueMomentum,
  ): string {
    const periodLabels: Record<string, string> = {
      '7d': 'This week',
      '30d': 'This month',
      '90d': 'This quarter',
    }
    const label = periodLabels[period] ?? period
    const momentumShort: Record<RevenueMomentum['label'], string> = {
      accelerating: 'momentum is accelerating',
      steady: 'momentum is steady',
      slowing: 'momentum is slowing',
      declining: 'momentum is declining',
    }
    return `${label}: ${this._formatEur(pipelineValue)} pipeline — ${momentumShort[momentum.label]}`
  }
}

export const revenueNarrator = new RevenueNarrator()
