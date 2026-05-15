// AGENCY GROUP — SH-ROS | AMI: 22506
import { logger } from '@/lib/observability/logger'

export interface SwitchingCostComponent {
  component: string
  category: 'data' | 'integration' | 'training' | 'process' | 'economic' | 'risk'
  cost_eur: number
  time_weeks: number
  description: string
}

export interface SwitchingCostAnalysis {
  org_id: string
  total_cost_eur: number
  total_time_weeks: number
  components: SwitchingCostComponent[]
  payback_months_for_competitor: number  // how long competitor needs to offer value before switching makes sense
  moat_strength: 'weak' | 'moderate' | 'strong' | 'impenetrable'
  recommendation: string
  analyzed_at: Date
}

export interface SwitchingContext {
  agent_count: number
  months_active: number
  custom_workflows: number
  integrations: number
  monthly_platform_cost_eur: number
  deals_in_platform: number
}

const MOAT_THRESHOLDS = { weak: 15000, moderate: 50000, strong: 100000 } // >100K = impenetrable

class SwitchingCostAnalyzer {
  analyze(orgId: string, context: SwitchingContext): SwitchingCostAnalysis {
    const components: SwitchingCostComponent[] = [
      this.calculateDataMigrationCost(context.months_active, context.deals_in_platform),
      this.calculateTrainingCost(context.agent_count),
      this.calculateIntegrationCost(context.integrations),
      this.calculateProcessRedesignCost(context.custom_workflows),
      this.calculateEconomicRisk(
        context.monthly_platform_cost_eur * 4, // rough revenue proxy: assume platform drives 4× its cost
        context.monthly_platform_cost_eur,
      ),
    ]

    const total_cost_eur = components.reduce((sum, c) => sum + c.cost_eur, 0)
    const total_time_weeks = Math.max(...components.map((c) => c.time_weeks))
    const moat_strength = this.getMoatStrength(total_cost_eur)

    // Payback: months of saved platform cost needed to recover switching cost
    const payback_months_for_competitor =
      context.monthly_platform_cost_eur > 0
        ? Math.round(total_cost_eur / context.monthly_platform_cost_eur)
        : 99

    const recommendation = this._buildRecommendation(moat_strength, total_cost_eur)

    logger.info('[SwitchingCostAnalyzer] analysis complete', {
      orgId,
      total_cost_eur,
      moat_strength,
      payback_months_for_competitor,
    })

    return {
      org_id: orgId,
      total_cost_eur,
      total_time_weeks,
      components,
      payback_months_for_competitor,
      moat_strength,
      recommendation,
      analyzed_at: new Date(),
    }
  }

  calculateDataMigrationCost(
    monthsActive: number,
    dealsInPlatform: number,
  ): SwitchingCostComponent {
    const raw = 5000 + dealsInPlatform * 2 + monthsActive * 500
    const cost_eur = Math.min(60000, raw)
    return {
      component: 'Data Migration',
      category: 'data',
      cost_eur,
      time_weeks: Math.ceil(cost_eur / 5000), // 1 week per €5K of migration effort
      description: `Export, cleanse and re-import ${dealsInPlatform} deals and ${monthsActive} months of history into a new platform`,
    }
  }

  calculateTrainingCost(agentCount: number): SwitchingCostComponent {
    const cost_eur = agentCount * 1500
    return {
      component: 'Agent Retraining',
      category: 'training',
      cost_eur,
      time_weeks: Math.ceil(agentCount / 5) * 2, // 5 agents per 2-week cohort
      description: `Lost productivity and formal retraining for ${agentCount} agents at an average cost of €1,500 per person`,
    }
  }

  calculateIntegrationCost(integrationCount: number): SwitchingCostComponent {
    const cost_eur = integrationCount * 4000
    return {
      component: 'Integration Rebuild',
      category: 'integration',
      cost_eur,
      time_weeks: integrationCount * 1.5, // 1.5 weeks per integration
      description: `Rebuilding ${integrationCount} active integrations with external systems at €4,000 each`,
    }
  }

  calculateProcessRedesignCost(customWorkflows: number): SwitchingCostComponent {
    const cost_eur = customWorkflows * 2500
    return {
      component: 'Process Redesign',
      category: 'process',
      cost_eur,
      time_weeks: customWorkflows * 1, // 1 week per custom workflow
      description: `Redesigning and documenting ${customWorkflows} custom workflows to match a new platform's paradigm`,
    }
  }

  calculateEconomicRisk(
    monthlyRevenuePlatform: number,
    monthlyPlatformCost: number,
  ): SwitchingCostComponent {
    const cost_eur = monthlyRevenuePlatform * 3
    return {
      component: 'Economic Disruption Risk',
      category: 'economic',
      cost_eur,
      time_weeks: 12, // 3 months of disruption window
      description: `Three months of potential revenue disruption (€${monthlyRevenuePlatform.toLocaleString('pt-PT')}/mo) while the team transitions; platform cost €${monthlyPlatformCost.toLocaleString('pt-PT')}/mo`,
    }
  }

  getMoatStrength(totalCost: number): SwitchingCostAnalysis['moat_strength'] {
    if (totalCost <= MOAT_THRESHOLDS.weak) return 'weak'
    if (totalCost <= MOAT_THRESHOLDS.moderate) return 'moderate'
    if (totalCost <= MOAT_THRESHOLDS.strong) return 'strong'
    return 'impenetrable'
  }

  private _buildRecommendation(
    strength: SwitchingCostAnalysis['moat_strength'],
    totalCost: number,
  ): string {
    const formatted = `€${Math.round(totalCost).toLocaleString('pt-PT')}`
    switch (strength) {
      case 'weak':
        return `Switching cost of ${formatted} is low. Focus on deepening integrations and adding data-rich workflows to raise the moat before the next renewal cycle.`
      case 'moderate':
        return `Switching cost of ${formatted} provides moderate protection. Prioritise custom workflow creation and team certification to push into "strong" territory.`
      case 'strong':
        return `Switching cost of ${formatted} creates a strong retention signal. Maintain momentum through executive dashboard adoption and API integrations.`
      case 'impenetrable':
        return `Switching cost of ${formatted} makes this account mission-critical. Focus on expansion and upsell — churn risk is negligible without a major service failure.`
    }
  }
}

export const switchingCostAnalyzer = new SwitchingCostAnalyzer()
export default switchingCostAnalyzer
