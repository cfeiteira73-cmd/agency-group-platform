// AGENCY GROUP — SH-ROS | AMI: 22506
// Strategic Forecast Digest — scenario planning for 30/90/180-day revenue horizons
// Portugal 2026: €3.076/m² median · 210 days avg close · 18% close rate · 5% commission
// =============================================================================

import { logger } from '@/lib/observability/logger'

// ─── Constants ─────────────────────────────────────────────────────────────────

const AVG_DEAL_VALUE = 320_000
const COMMISSION_RATE = 0.05
const CLOSE_RATE_BASE = 0.18
const CLOSE_RATE_UPSIDE = 0.28
const CLOSE_RATE_DOWNSIDE = 0.10
const MONTHLY_TARGET = 50_000

// ─── Interfaces ────────────────────────────────────────────────────────────────

export interface ForecastScenario {
  label: 'base' | 'upside' | 'downside'
  probability: number
  expected_revenue_eur: number
  expected_deals: number
  key_conditions: string[]
  narrative: string
}

export interface StrategicForecast {
  org_id: string
  horizon: '30d' | '90d' | '180d'
  base_case: ForecastScenario
  upside_case: ForecastScenario
  downside_case: ForecastScenario
  key_drivers: string[]
  strategic_recommendations: string[]
  confidence: number
  generated_at: Date
}

// ─── Strategic Forecast Digest ────────────────────────────────────────────────

export class StrategicForecastDigest {
  /**
   * Generate a full strategic forecast for the given horizon.
   */
  generate(orgId: string, horizon: '30d' | '90d' | '180d'): StrategicForecast {
    logger.info('[StrategicForecastDigest] Generating forecast', {
      route: 'executive/forecast',
      correlation_id: orgId,
    })

    // In production, pipelineValue is hydrated from businessPrimitiveEngine.
    const pipelineValue = 8 * AVG_DEAL_VALUE
    const historicalDataPoints = 12  // months of history available

    const base_case = this.buildScenario('base', pipelineValue, horizon)
    const upside_case = this.buildScenario('upside', pipelineValue, horizon)
    const downside_case = this.buildScenario('downside', pipelineValue, horizon)

    const key_drivers = this.getKeyDrivers(orgId)
    const confidence = this.calculateConfidence(pipelineValue, historicalDataPoints)
    const strategic_recommendations = this._buildRecommendations(
      base_case,
      upside_case,
      downside_case,
      horizon,
    )

    const forecast: StrategicForecast = {
      org_id: orgId,
      horizon,
      base_case,
      upside_case,
      downside_case,
      key_drivers,
      strategic_recommendations,
      confidence,
      generated_at: new Date(),
    }

    logger.info('[StrategicForecastDigest] Forecast ready', {
      route: 'executive/forecast',
      correlation_id: orgId,
    })

    return forecast
  }

  /**
   * Build a single forecast scenario for the given type, pipeline, and horizon.
   */
  buildScenario(
    type: ForecastScenario['label'],
    pipelineValue: number,
    horizon: string,
  ): ForecastScenario {
    const multiplier = this._horizonMultiplier(horizon)
    const closeRates: Record<ForecastScenario['label'], number> = {
      base: CLOSE_RATE_BASE,
      upside: CLOSE_RATE_UPSIDE,
      downside: CLOSE_RATE_DOWNSIDE,
    }
    const probabilities: Record<ForecastScenario['label'], number> = {
      base: 0.55,
      upside: 0.20,
      downside: 0.25,
    }

    const closeRate = closeRates[type]
    const scaledPipeline = pipelineValue * multiplier
    const dealsInPipeline = scaledPipeline / AVG_DEAL_VALUE
    const expected_deals = Math.round(dealsInPipeline * closeRate)
    const expected_revenue_eur = expected_deals * AVG_DEAL_VALUE * COMMISSION_RATE

    const key_conditions = this._buildKeyConditions(type, horizon)

    const partial: Omit<ForecastScenario, 'narrative'> = {
      label: type,
      probability: probabilities[type],
      expected_revenue_eur,
      expected_deals,
      key_conditions,
    }

    const narrative = this._buildNarrative(partial)

    return { ...partial, narrative }
  }

  /**
   * Return the primary business drivers affecting forecast accuracy.
   */
  getKeyDrivers(orgId: string): string[] {
    return [
      `Portugal close rate baseline (18%) — every +1pp adds ~€${Math.round(8 * AVG_DEAL_VALUE * 0.01 * COMMISSION_RATE).toLocaleString('pt-PT')} expected commission`,
      `Pipeline depth — minimum 5× avg deal value (€${(5 * AVG_DEAL_VALUE).toLocaleString('pt-PT')}) required for safe 90-day forecast`,
      `Buyer mix — North American (16%) and French (13%) buyers drive €500K+ segment; seasonality peaks Q2/Q3`,
      `Average deal cycle (210 days) — leads entered today convert in late Q4/early 2027`,
      `CPCV-to-Escritura conversion — 50% commission at each stage; delays compress cash flow`,
      `Market price appreciation (+17.6% YoY) — increases absolute commission on same unit count`,
    ]
  }

  /**
   * Calculate forecast confidence based on pipeline size and historical data points.
   * More data and larger pipeline = higher confidence.
   */
  calculateConfidence(pipelineValue: number, historicalDataPoints: number): number {
    // Pipeline size factor: full confidence at 10× avg deal (~€3.2M)
    const pipelineFactor = Math.min(pipelineValue / (10 * AVG_DEAL_VALUE), 1.0)

    // Data history factor: full confidence at 24 months
    const historyFactor = Math.min(historicalDataPoints / 24, 1.0)

    // Weighted: pipeline is more influential than history
    const raw = pipelineFactor * 0.65 + historyFactor * 0.35

    // Clamp to a realistic 0.35–0.92 range
    return Math.round(Math.max(0.35, Math.min(0.92, raw)) * 100) / 100
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private _horizonMultiplier(horizon: string): number {
    const map: Record<string, number> = {
      '30d': 1,
      '90d': 3,
      '180d': 6,
    }
    return map[horizon] ?? 1
  }

  private _buildNarrative(scenario: Omit<ForecastScenario, 'narrative'>): string {
    const labelText: Record<ForecastScenario['label'], string> = {
      base: 'Base case (55% probability)',
      upside: 'Upside case (20% probability)',
      downside: 'Downside case (25% probability)',
    }

    const targetCoverage = Math.round((scenario.expected_revenue_eur / MONTHLY_TARGET) * 100)
    const closeRateMap: Record<ForecastScenario['label'], number> = {
      base: CLOSE_RATE_BASE,
      upside: CLOSE_RATE_UPSIDE,
      downside: CLOSE_RATE_DOWNSIDE,
    }
    const closeRatePct = (closeRateMap[scenario.label] * 100).toFixed(0)

    return (
      `${labelText[scenario.label]}: At a ${closeRatePct}% close rate, ` +
      `the pipeline is expected to generate ${scenario.expected_deals} closed deal${scenario.expected_deals !== 1 ? 's' : ''} ` +
      `and €${scenario.expected_revenue_eur.toLocaleString('pt-PT')} in commission — ` +
      `${targetCoverage}% of the €${MONTHLY_TARGET.toLocaleString('pt-PT')} monthly target. ` +
      `Key conditions: ${scenario.key_conditions.join('; ')}.`
    )
  }

  private _buildKeyConditions(
    type: ForecastScenario['label'],
    horizon: string,
  ): string[] {
    const shared = [
      `Portugal market price remains above €3.000/m² (currently €3.076/m²)`,
      `Average deal cycle stays within 210-day baseline`,
    ]

    const byType: Record<ForecastScenario['label'], string[]> = {
      base: [
        `Close rate holds at 18% Portugal baseline`,
        `No material change in buyer mix or seasonal demand`,
        `Pipeline replenishment matches current 3–5 new leads/week pace`,
      ],
      upside: [
        `Close rate improves to 28% through enhanced qualification and proposal quality`,
        `At least 2 high-value (€600K+) deals close within the horizon`,
        `North American and French buyer segments remain active (peak seasonal interest)`,
        `New exclusive listings added in Cascais / Algarve high-demand micro-markets`,
      ],
      downside: [
        `Close rate drops to 10% due to macro headwinds or competing inventory`,
        `Key deals (>€500K) stall beyond the forecast horizon`,
        `Seasonal slowdown (August) compresses the ${horizon} window`,
        `Credit conditions tighten for international buyers`,
      ],
    }

    return [...byType[type], ...shared]
  }

  private _buildRecommendations(
    base: ForecastScenario,
    upside: ForecastScenario,
    downside: ForecastScenario,
    horizon: string,
  ): string[] {
    const upside_delta = upside.expected_revenue_eur - base.expected_revenue_eur
    const downside_risk = base.expected_revenue_eur - downside.expected_revenue_eur

    return [
      `Prioritise the ${Math.round(upside.expected_deals - base.expected_deals)} incremental deals required to reach the upside case — worth €${upside_delta.toLocaleString('pt-PT')} in additional commission`,
      `Hedge the €${downside_risk.toLocaleString('pt-PT')} downside risk by securing CPCV on the 2 highest-probability deals within 30 days`,
      horizon === '180d'
        ? `Build a diversified pipeline across 3+ buyer nationalities to reduce concentration risk over the 6-month window`
        : `Focus the ${horizon} horizon on deals already at proposal/negotiation stage to maximise expected realisation`,
      `Activate investor lead sequences for the €500K–€1M segment to support pipeline replenishment for the upside scenario`,
      `Track weekly close rate vs 18% baseline — a 2-week consecutive drop below 12% should trigger a pipeline review`,
    ]
  }
}

export const strategicForecastDigest = new StrategicForecastDigest()
