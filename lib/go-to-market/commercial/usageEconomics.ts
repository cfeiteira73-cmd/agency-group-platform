// AGENCY GROUP — SH-ROS | AMI: 22506

import { logger } from '@/lib/observability/logger'
import { PLANS, type PlanTier } from './packagingArchitecture'

export interface UsageUnit {
  unit: string
  price_eur: number
  included_in: PlanTier[]
  description: string
}

export interface UsageBill {
  org_id: string
  period: string
  base_plan: PlanTier
  base_cost_eur: number
  overage_units: Record<string, number>
  overage_cost_eur: number
  total_eur: number
  roi_multiple: number  // revenue_generated / total_cost
}

export const USAGE_UNITS: UsageUnit[] = [
  {
    unit: 'extra_agent',
    price_eur: 150,
    included_in: [],
    description: 'Additional AI agent beyond plan limit (per agent/month)',
  },
  {
    unit: 'extra_workflow_pack',
    price_eur: 200,
    included_in: [],
    description: 'Pack of 5 additional workflows beyond plan limit',
  },
  {
    unit: 'ai_execution_pack',
    price_eur: 50,
    included_in: [],
    description: 'Pack of 500 additional AI executions beyond plan limit',
  },
  {
    unit: 'premium_analytics',
    price_eur: 300,
    included_in: ['elite', 'institutional'],
    description: 'Advanced attribution analytics and predictive dashboards (per month)',
  },
  {
    unit: 'api_access',
    price_eur: 200,
    included_in: ['pro', 'elite', 'institutional'],
    description: 'REST API access with 10K calls/month baseline',
  },
  {
    unit: 'white_label',
    price_eur: 500,
    included_in: ['elite', 'institutional'],
    description: 'White-label branding removal from all client-facing outputs',
  },
]

const UNIT_PRICE_MAP: Record<string, number> = Object.fromEntries(
  USAGE_UNITS.map(u => [u.unit, u.price_eur]),
)

export class UsageEconomics {
  readonly USAGE_UNITS: UsageUnit[] = USAGE_UNITS

  calculateBill(
    orgId: string,
    planTier: PlanTier,
    usage: Record<string, number>,
    revenueGenerated?: number,
  ): UsageBill {
    const plan = PLANS[planTier]
    const baseCost = plan.price_monthly_eur

    const overageUnits: Record<string, number> = {}
    let overageCost = 0

    // Calculate agent overages
    if (usage['agents'] && usage['agents'] > plan.max_agents) {
      const extraAgents = usage['agents'] - plan.max_agents
      overageUnits['extra_agent'] = extraAgents
      overageCost += extraAgents * this.getOverageCost('extra_agent', 1)
    }

    // Calculate workflow overages (in packs of 5)
    if (usage['workflows'] && usage['workflows'] > plan.max_workflows) {
      const extraWorkflows = usage['workflows'] - plan.max_workflows
      const packs = Math.ceil(extraWorkflows / 5)
      overageUnits['extra_workflow_pack'] = packs
      overageCost += packs * this.getOverageCost('extra_workflow_pack', 1)
    }

    // Calculate AI execution overages (in packs of 500)
    if (usage['ai_executions'] && usage['ai_executions'] > plan.ai_executions_per_month) {
      const extraExecs = usage['ai_executions'] - plan.ai_executions_per_month
      const packs = Math.ceil(extraExecs / 500)
      overageUnits['ai_execution_pack'] = packs
      overageCost += packs * this.getOverageCost('ai_execution_pack', 1)
    }

    // Add-on modules
    for (const unit of USAGE_UNITS) {
      if (usage[unit.unit] && !unit.included_in.includes(planTier)) {
        overageUnits[unit.unit] = usage[unit.unit]
        overageCost += usage[unit.unit] * unit.price_eur
      }
    }

    const totalCost = baseCost + overageCost
    const roiMultiple = revenueGenerated && totalCost > 0
      ? this.calculateROIMultiple(totalCost, revenueGenerated)
      : 0

    const bill: UsageBill = {
      org_id: orgId,
      period: new Date().toISOString().slice(0, 7), // YYYY-MM
      base_plan: planTier,
      base_cost_eur: baseCost,
      overage_units: overageUnits,
      overage_cost_eur: overageCost,
      total_eur: totalCost,
      roi_multiple: roiMultiple,
    }

    logger.info('UsageEconomics: bill calculated', {
      org_id: orgId,
      plan: planTier,
      base_cost_eur: baseCost,
      overage_cost_eur: overageCost,
      total_eur: totalCost,
      roi_multiple: roiMultiple,
    })

    return bill
  }

  getOverageCost(unit: string, extraUnits: number): number {
    const pricePerUnit = UNIT_PRICE_MAP[unit] ?? 0
    return pricePerUnit * extraUnits
  }

  estimateMonthlyBill(
    agentCount: number,
    workflowCount: number,
    executions: number,
  ): number {
    // Determine best base plan
    let tier: PlanTier
    if (agentCount <= 1 && workflowCount <= 5 && executions <= 500) {
      tier = 'starter'
    } else if (agentCount <= 10 && workflowCount <= 25 && executions <= 5_000) {
      tier = 'pro'
    } else if (agentCount <= 25) {
      tier = 'elite'
    } else {
      tier = 'institutional'
    }

    const usage: Record<string, number> = {
      agents: agentCount,
      workflows: workflowCount,
      ai_executions: executions,
    }

    const bill = this.calculateBill('estimate', tier, usage)
    return bill.total_eur
  }

  calculateROIMultiple(platformCost: number, revenueGenerated: number): number {
    if (platformCost <= 0) return 0
    return revenueGenerated / platformCost
  }
}

export const usageEconomics = new UsageEconomics()
