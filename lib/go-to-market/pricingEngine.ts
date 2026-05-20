// AGENCY GROUP — SH-ROS GTM: Pricing Engine | AMI: 22506
// Dynamic pricing model for Agency Group SaaS + commission hybrid
// Calculates optimal pricing per segment, ROI proof, and expansion paths
// =============================================================================

import { COMMISSION_RATE } from '@/lib/constants/pipeline'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PricingTier {
  tier_id:         string
  name:            string
  segment:         string
  monthly_eur:     number
  annual_eur:      number      // 2 months free
  annual_discount: number      // %
  agents_included: number
  features:        string[]
  usage_limits:    Record<string, number>
  overage_rates:   Record<string, number>
}

export interface PricingQuote {
  org_id:          string
  tier:            PricingTier
  agents:          number
  monthly_total:   number
  annual_total:    number
  roi_estimate:    ROIEstimate
  payback_months:  number
  custom_items:    PricingLineItem[]
  total_contract_value: number
  quoted_at:       string
}

export interface ROIEstimate {
  current_deals_per_agent_per_year:  number
  projected_deals_per_agent_per_year: number
  current_avg_deal_value:             number
  projected_avg_deal_value:           number
  current_annual_gci:                 number
  projected_annual_gci:               number
  incremental_gci:                    number
  platform_cost:                      number
  roi_multiple:                       number    // incremental_gci / cost
  payback_months:                     number
}

export interface PricingLineItem {
  description:  string
  unit_price:   number
  quantity:     number
  total:        number
}

// ─── Pricing Tiers ────────────────────────────────────────────────────────────

export const PRICING_TIERS: Record<string, PricingTier> = {
  starter: {
    tier_id:         'starter',
    name:            'Starter',
    segment:         'Independent agents',
    monthly_eur:     400,
    annual_eur:      4_000,
    annual_discount: 17,
    agents_included: 1,
    features: [
      'AI lead scoring (unlimited leads)',
      'Automated deal pack generation',
      'Property matching engine',
      'WhatsApp/email automation',
      'Control Tower dashboard',
      'Supabase integration',
    ],
    usage_limits: {
      leads_per_month:      500,
      deal_packs_per_month: 50,
      api_calls_per_day:    10_000,
    },
    overage_rates: {
      leads_per_month:      0.50,   // €0.50/extra lead
      deal_packs_per_month: 5.00,
    },
  },

  professional: {
    tier_id:         'professional',
    name:            'Professional',
    segment:         'Boutique agencies (5–20 agents)',
    monthly_eur:     1_800,
    annual_eur:      18_000,
    annual_discount: 17,
    agents_included: 10,
    features: [
      'Everything in Starter',
      'Multi-agent pipeline management',
      'Revenue forecasting',
      'A/B testing for outreach',
      'n8n workflow automation',
      'Priority support (4h SLA)',
      'Custom match scoring weights',
      'Investor relations module',
    ],
    usage_limits: {
      leads_per_month:      5_000,
      deal_packs_per_month: 500,
      api_calls_per_day:    100_000,
    },
    overage_rates: {
      leads_per_month:      0.30,
      deal_packs_per_month: 3.00,
    },
  },

  enterprise: {
    tier_id:         'enterprise',
    name:            'Enterprise',
    segment:         'Large agencies & networks (20+ agents)',
    monthly_eur:     6_000,
    annual_eur:      60_000,
    annual_discount: 17,
    agents_included: 50,
    features: [
      'Everything in Professional',
      'Multi-region infrastructure',
      'Custom AI model training on your data',
      'Dedicated CSM',
      'SLA 99.99% uptime',
      'SSO / enterprise auth',
      'Audit logs + compliance exports',
      'API access for custom integrations',
      'White-label option',
      'Commission share partnership (optional)',
    ],
    usage_limits: {
      leads_per_month:      100_000,
      deal_packs_per_month: 10_000,
      api_calls_per_day:    10_000_000,
    },
    overage_rates: {
      leads_per_month:      0.10,
      deal_packs_per_month: 1.00,
    },
  },
}

// ─── Pricing Engine ───────────────────────────────────────────────────────────

export class PricingEngine {

  /**
   * Generate a pricing quote for a prospect.
   */
  quote(params: {
    org_id:                  string
    agents:                  number
    current_gci_per_year?:   number    // current gross commission income
    current_close_rate?:     number
    avg_deal_value?:         number
    annual_billing?:         boolean
    custom_items?:           PricingLineItem[]
  }): PricingQuote {
    const tier         = this._selectTier(params.agents)
    const extra_agents = Math.max(0, params.agents - tier.agents_included)
    const agent_fee    = extra_agents * 150  // €150/extra agent/month

    const base_monthly = tier.monthly_eur + agent_fee
    const base_annual  = params.annual_billing
      ? tier.annual_eur + extra_agents * 1_500
      : base_monthly * 12

    const custom_total = (params.custom_items ?? []).reduce((s, i) => s + i.total, 0)
    const annual_total = base_annual + custom_total

    const roi = this._computeROI({
      agents:             params.agents,
      current_gci:        params.current_gci_per_year ?? params.agents * 300_000,
      current_close_rate: params.current_close_rate ?? 0.18,
      avg_deal_value:     params.avg_deal_value ?? 500_000,
      annual_cost:        annual_total,
    })

    return {
      org_id:               params.org_id,
      tier,
      agents:               params.agents,
      monthly_total:        base_monthly,
      annual_total,
      roi_estimate:         roi,
      payback_months:       roi.payback_months,
      custom_items:         params.custom_items ?? [],
      total_contract_value: annual_total,
      quoted_at:            new Date().toISOString(),
    }
  }

  /**
   * Compute ROI for a prospect — used in sales calls.
   * Returns provable ROI numbers.
   */
  computeProspectROI(params: {
    agents:             number
    annual_gci:         number
    current_close_rate: number
    avg_deal_value:     number
  }): ROIEstimate {
    return this._computeROI({
      agents:             params.agents,
      current_gci:        params.annual_gci,
      current_close_rate: params.current_close_rate,
      avg_deal_value:     params.avg_deal_value,
      annual_cost:        this._selectTier(params.agents).annual_eur,
    })
  }

  /**
   * Get all pricing tiers.
   */
  getTiers(): PricingTier[] {
    return Object.values(PRICING_TIERS)
  }

  /**
   * Calculate expansion revenue opportunity within a customer.
   */
  expansionOpportunity(current_agents: number, potential_agents: number): {
    current_arr:   number
    potential_arr: number
    expansion_arr: number
    expansion_pct: number
  } {
    const current_tier   = this._selectTier(current_agents)
    const potential_tier = this._selectTier(potential_agents)

    const current_arr   = current_tier.annual_eur
    const potential_arr = potential_tier.annual_eur +
      Math.max(0, potential_agents - potential_tier.agents_included) * 1_500

    return {
      current_arr,
      potential_arr,
      expansion_arr: potential_arr - current_arr,
      expansion_pct: (potential_arr - current_arr) / current_arr,
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private _selectTier(agents: number): PricingTier {
    if (agents <= 1)  return PRICING_TIERS.starter
    if (agents <= 20) return PRICING_TIERS.professional
    return PRICING_TIERS.enterprise
  }

  private _computeROI(params: {
    agents:             number
    current_gci:        number
    current_close_rate: number
    avg_deal_value:     number
    annual_cost:        number
  }): ROIEstimate {
    // Agency Group benchmarks: +35% close rate, +23% avg deal value
    const projected_close_rate  = Math.min(0.50, params.current_close_rate * 1.35)
    const projected_deal_value  = params.avg_deal_value * 1.23
    const deals_per_agent       = params.current_gci / params.agents / params.avg_deal_value

    const current_deals         = deals_per_agent
    const projected_deals       = deals_per_agent * (projected_close_rate / params.current_close_rate)

    const current_gci_per_agent  = current_deals * params.avg_deal_value * COMMISSION_RATE
    const projected_gci_per_agent = projected_deals * projected_deal_value * COMMISSION_RATE

    const current_annual_gci  = current_gci_per_agent * params.agents
    const projected_annual_gci = projected_gci_per_agent * params.agents
    const incremental_gci     = projected_annual_gci - current_annual_gci

    const roi_multiple   = incremental_gci / params.annual_cost
    const payback_months = params.annual_cost / (incremental_gci / 12)

    return {
      current_deals_per_agent_per_year:   Math.round(current_deals * 10) / 10,
      projected_deals_per_agent_per_year: Math.round(projected_deals * 10) / 10,
      current_avg_deal_value:             params.avg_deal_value,
      projected_avg_deal_value:           Math.round(projected_deal_value),
      current_annual_gci:                 Math.round(current_annual_gci),
      projected_annual_gci:               Math.round(projected_annual_gci),
      incremental_gci:                    Math.round(incremental_gci),
      platform_cost:                      params.annual_cost,
      roi_multiple:                       Math.round(roi_multiple * 10) / 10,
      payback_months:                     Math.round(payback_months * 10) / 10,
    }
  }
}

export const pricingEngine = new PricingEngine()
