// AGENCY GROUP — SH-ROS | AMI: 22506

import { logger } from '@/lib/observability/logger'

const ELITE_BASE_MONTHLY_EUR = 4_500
const INSTITUTIONAL_BASE_MONTHLY_EUR = 9_000
const AGENT_RATE_EUR = 150 // per additional agent/month

export interface EnterpriseSLA {
  uptime_pct: number
  response_time_hours: number
  incident_response_hours: number
  dedicated_support: boolean
  custom_sla: boolean
}

export interface EnterpriseCommitment {
  org_id: string
  tier: 'elite' | 'institutional'
  contract_months: number  // 12 | 24 | 36
  annual_value_eur: number
  discount_pct: number
  support_model: string
  sla: EnterpriseSLA
  custom_integrations: boolean
  dedicated_region: boolean
  audit_reporting: boolean
  data_residency: string[]
}

const SLA_MAP: Record<'elite' | 'institutional', EnterpriseSLA> = {
  elite: {
    uptime_pct: 99.95,
    response_time_hours: 4,
    incident_response_hours: 1,
    dedicated_support: true,
    custom_sla: false,
  },
  institutional: {
    uptime_pct: 99.99,
    response_time_hours: 1,
    incident_response_hours: 0.25, // 15 minutes
    dedicated_support: true,
    custom_sla: true,
  },
}

const SUPPORT_MODELS: Record<'elite' | 'institutional', string> = {
  elite: 'Dedicated Customer Success Manager + Priority Support Queue (4h response)',
  institutional: 'Dedicated Solutions Engineer + Executive Sponsor + 24/7 Support (1h response)',
}

export class EnterpriseTiering {
  buildCommitment(
    orgId: string,
    tier: 'elite' | 'institutional',
    months: number,
    agentCount: number,
  ): EnterpriseCommitment {
    const baseMonthly = tier === 'elite' ? ELITE_BASE_MONTHLY_EUR : INSTITUTIONAL_BASE_MONTHLY_EUR
    const agentSurcharge = Math.max(0, agentCount - (tier === 'elite' ? 25 : 0)) * AGENT_RATE_EUR
    const monthlyWithAgents = baseMonthly + agentSurcharge

    const discountPct = this.calculateDiscount(months, tier)
    const monthlyAfterDiscount = monthlyWithAgents * (1 - discountPct / 100)
    const annualValue = monthlyAfterDiscount * months

    const commitment: EnterpriseCommitment = {
      org_id: orgId,
      tier,
      contract_months: months,
      annual_value_eur: annualValue,
      discount_pct: discountPct,
      support_model: SUPPORT_MODELS[tier],
      sla: this.getSLA(tier),
      custom_integrations: true,
      dedicated_region: tier === 'institutional',
      audit_reporting: true,
      data_residency: tier === 'institutional' ? ['EU', 'PT', 'ES'] : ['EU'],
    }

    logger.info('EnterpriseTiering: commitment built', {
      org_id: orgId,
      tier,
      contract_months: months,
      annual_value_eur: annualValue,
      discount_pct: discountPct,
    })

    return commitment
  }

  calculateDiscount(months: number, tier: string): number {
    // Base discounts by contract length
    let discount = 0
    if (months >= 36) {
      discount = 25
    } else if (months >= 24) {
      discount = 17
    } else if (months >= 12) {
      discount = 10
    }

    // Additional 3% for institutional tier on 24+ month commitments
    if (tier === 'institutional' && months >= 24) {
      discount += 3
    }

    return discount
  }

  getSLA(tier: 'elite' | 'institutional'): EnterpriseSLA {
    return { ...SLA_MAP[tier] }
  }

  estimateAnnualValue(agentCount: number): number {
    // Determine tier, apply 12-month commitment pricing
    const tier: 'elite' | 'institutional' = agentCount > 25 ? 'institutional' : 'elite'
    const base = tier === 'elite' ? ELITE_BASE_MONTHLY_EUR : INSTITUTIONAL_BASE_MONTHLY_EUR
    const agentSurcharge = Math.max(0, agentCount - (tier === 'elite' ? 25 : 0)) * AGENT_RATE_EUR
    const monthly = base + agentSurcharge
    const discount = this.calculateDiscount(12, tier) / 100
    const annualValue = monthly * (1 - discount) * 12

    logger.info('EnterpriseTiering: annual value estimated', {
      tier,
      agentCount,
      annual_value_eur: annualValue,
    })

    return annualValue
  }
}

export const enterpriseTiering = new EnterpriseTiering()
