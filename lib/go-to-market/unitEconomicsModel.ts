// AGENCY GROUP — SH-ROS GTM: Unit Economics Model | AMI: 22506
// Real-time SaaS unit economics: CAC, LTV, payback, cohort retention
// Tracks health of the revenue model — not individual deals
// =============================================================================

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UnitEconomics {
  computed_at:       string
  period:            string

  // Acquisition
  cac_blended:       number   // blended customer acquisition cost
  cac_organic:       number
  cac_paid:          number
  new_customers_mtd: number

  // Value
  arpu:              number   // average revenue per user (monthly)
  arr:               number   // annual recurring revenue
  mrr:               number   // monthly recurring revenue
  mrr_growth_mom:    number   // % MoM growth

  // Retention
  gross_churn:       number   // % customers lost per month
  net_churn:         number   // % ARR lost (negative = expansion)
  logo_retention:    number   // % customers retained (12-month)
  nrr:               number   // net revenue retention

  // Value ratios
  ltv:               number
  ltv_cac_ratio:     number
  payback_months:    number

  // Efficiency
  magic_number:      number   // growth efficiency: new ARR / S&M spend
  burn_multiple:     number   // burn / net new ARR (lower = better)
}

export interface CohortAnalysis {
  cohort_month:        string
  customers_start:     number
  revenue_start:       number
  retention_by_month:  number[]   // revenue retention % at month 1, 2, 3...12
  expansion_rate:      number     // net expansion after 12 months
  ltv_at_12m:          number
  payback_at_12m:      number
}

export interface GrowthForecast {
  month:          string
  mrr:            number
  arr:            number
  customers:      number
  new_customers:  number
  churned:        number
  net_new_mrr:    number
  cumulative_arr: number
}

// ─── Unit Economics Benchmarks (SaaS 2026) ────────────────────────────────────

const BENCHMARKS = {
  ltv_cac_ratio_target:  5.0,    // >5 = excellent
  payback_months_target: 12,     // <12 months = excellent
  gross_churn_max:       0.02,   // <2%/month
  nrr_target:            1.15,   // >115% = expansion-led growth
  magic_number_target:   0.75,   // >0.75 = efficient growth
}

// ─── Unit Economics Model ─────────────────────────────────────────────────────

export class UnitEconomicsModel {
  private _metrics_cache: UnitEconomics | null = null

  /**
   * Compute current unit economics.
   * In production: reads from Supabase billing + CRM tables.
   * Here: provides the model structure with Portugal market assumptions.
   */
  compute(inputs: {
    mrr:                  number
    mrr_last_month:       number
    customers:            number
    new_customers_mtd:    number
    churned_customers_mtd: number
    s_and_m_spend_monthly: number
    cac_paid?:            number
    avg_contract_months?: number
  }): UnitEconomics {
    const arpu          = inputs.mrr / Math.max(1, inputs.customers)
    const arr           = inputs.mrr * 12
    const mrr_growth    = inputs.mrr_last_month > 0
      ? (inputs.mrr - inputs.mrr_last_month) / inputs.mrr_last_month
      : 0

    const gross_churn   = inputs.churned_customers_mtd / Math.max(1, inputs.customers)
    const avg_months    = inputs.avg_contract_months ?? 24  // assumed 2-year avg
    const net_churn     = gross_churn - (mrr_growth * 0.3)  // expansion offsets gross churn

    const ltv           = arpu * avg_months * (1 - gross_churn)
    const cac_blended   = inputs.s_and_m_spend_monthly / Math.max(1, inputs.new_customers_mtd)
    const cac_paid      = inputs.cac_paid ?? cac_blended * 1.4  // paid typically 40% higher
    const cac_organic   = cac_blended * 0.6

    const ltv_cac       = ltv / Math.max(1, cac_blended)
    const payback       = cac_blended / Math.max(1, arpu * (1 - 0.3))  // 30% gross margin assumption

    const new_arr_monthly = inputs.new_customers_mtd * arpu * 12
    const magic_number    = new_arr_monthly / Math.max(1, inputs.s_and_m_spend_monthly)

    // NRR: if existing customers expand, NRR > 100%
    const nrr = 1 - net_churn + 0.05  // assume 5% expansion from upsells

    const result: UnitEconomics = {
      computed_at:       new Date().toISOString(),
      period:            'current_month',

      cac_blended:       Math.round(cac_blended),
      cac_organic:       Math.round(cac_organic),
      cac_paid:          Math.round(cac_paid),
      new_customers_mtd: inputs.new_customers_mtd,

      arpu:              Math.round(arpu),
      arr:               Math.round(arr),
      mrr:               Math.round(inputs.mrr),
      mrr_growth_mom:    Math.round(mrr_growth * 1000) / 10,

      gross_churn:       Math.round(gross_churn * 1000) / 10,
      net_churn:         Math.round(net_churn * 1000) / 10,
      logo_retention:    Math.round((1 - gross_churn * 12) * 100),
      nrr:               Math.round(nrr * 100),

      ltv:               Math.round(ltv),
      ltv_cac_ratio:     Math.round(ltv_cac * 10) / 10,
      payback_months:    Math.round(payback * 10) / 10,

      magic_number:      Math.round(magic_number * 100) / 100,
      burn_multiple:     Math.round((inputs.s_and_m_spend_monthly / Math.max(1, new_arr_monthly / 12)) * 10) / 10,
    }

    this._metrics_cache = result
    return result
  }

  /**
   * Check if unit economics are healthy.
   */
  healthCheck(metrics: UnitEconomics): {
    overall: 'excellent' | 'good' | 'warning' | 'critical'
    issues: string[]
    strengths: string[]
  } {
    const issues: string[]    = []
    const strengths: string[] = []

    // LTV:CAC
    if (metrics.ltv_cac_ratio >= BENCHMARKS.ltv_cac_ratio_target) {
      strengths.push(`LTV:CAC ${metrics.ltv_cac_ratio}x — excellent (target ≥${BENCHMARKS.ltv_cac_ratio_target}x)`)
    } else if (metrics.ltv_cac_ratio >= 3) {
      strengths.push(`LTV:CAC ${metrics.ltv_cac_ratio}x — acceptable`)
    } else {
      issues.push(`LTV:CAC ${metrics.ltv_cac_ratio}x below ${BENCHMARKS.ltv_cac_ratio_target}x target`)
    }

    // Payback
    if (metrics.payback_months <= BENCHMARKS.payback_months_target) {
      strengths.push(`${metrics.payback_months} month payback — excellent`)
    } else if (metrics.payback_months <= 18) {
      strengths.push(`${metrics.payback_months} month payback — acceptable`)
    } else {
      issues.push(`${metrics.payback_months} month payback exceeds 18-month threshold`)
    }

    // Churn
    if (metrics.gross_churn <= BENCHMARKS.gross_churn_max * 100) {
      strengths.push(`${metrics.gross_churn}% monthly gross churn — excellent`)
    } else {
      issues.push(`${metrics.gross_churn}% monthly gross churn too high (target <2%)`)
    }

    // NRR
    if (metrics.nrr >= BENCHMARKS.nrr_target * 100) {
      strengths.push(`${metrics.nrr}% NRR — expansion-led growth`)
    } else if (metrics.nrr >= 100) {
      strengths.push(`${metrics.nrr}% NRR — positive (no net revenue shrinkage)`)
    } else {
      issues.push(`${metrics.nrr}% NRR — revenue shrinking from existing customers`)
    }

    // Magic number
    if (metrics.magic_number >= BENCHMARKS.magic_number_target) {
      strengths.push(`Magic number ${metrics.magic_number} — efficient growth`)
    } else {
      issues.push(`Magic number ${metrics.magic_number} — S&M spend is inefficient`)
    }

    const overall: ReturnType<UnitEconomicsModel['healthCheck']>['overall'] =
      issues.length === 0     ? 'excellent' :
      issues.length <= 1      ? 'good' :
      issues.length <= 2      ? 'warning' : 'critical'

    return { overall, issues, strengths }
  }

  /**
   * Generate 12-month growth forecast.
   */
  forecast(params: {
    current_mrr:        number
    current_customers:  number
    monthly_growth_rate: number   // target MoM growth %
    new_customers_monthly: number
    gross_churn_rate:   number
  }): GrowthForecast[] {
    const forecasts: GrowthForecast[] = []
    let mrr       = params.current_mrr
    let customers = params.current_customers

    const now = new Date()

    for (let month = 1; month <= 12; month++) {
      const churned     = Math.floor(customers * params.gross_churn_rate)
      const new_cust    = params.new_customers_monthly
      customers         = customers - churned + new_cust

      const prev_mrr    = mrr
      mrr               = mrr * (1 + params.monthly_growth_rate)

      const month_date  = new Date(now.getFullYear(), now.getMonth() + month, 1)

      forecasts.push({
        month:           month_date.toISOString().slice(0, 7),
        mrr:             Math.round(mrr),
        arr:             Math.round(mrr * 12),
        customers,
        new_customers:   new_cust,
        churned,
        net_new_mrr:     Math.round(mrr - prev_mrr),
        cumulative_arr:  Math.round(mrr * 12 * month),
      })
    }

    return forecasts
  }

  /**
   * Get the ideal unit economics for Agency Group target state.
   */
  getTargetState(): UnitEconomics {
    return this.compute({
      mrr:                    250_000,   // €250K MRR target
      mrr_last_month:         225_000,
      customers:              120,       // 120 agency customers
      new_customers_mtd:      8,
      churned_customers_mtd:  1,
      s_and_m_spend_monthly:  40_000,
      avg_contract_months:    30,        // 2.5yr avg contract
    })
  }
}

export const unitEconomicsModel = new UnitEconomicsModel()
