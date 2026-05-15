// AGENCY GROUP — SH-ROS | AMI: 22506
import { logger } from '@/lib/observability/logger'

export interface WorkflowDependency {
  workflow_id: string
  org_id: string
  name: string
  revenue_critical: boolean
  daily_executions: number
  data_dependencies: string[]
  external_integrations: string[]
  team_size_dependent: number
  switching_complexity: 'low' | 'medium' | 'high' | 'critical'
}

export interface DependencyScore {
  org_id: string
  total_workflows: number
  critical_workflows: number
  dependency_score: number
  daily_executions_total: number
  switching_complexity_avg: string
  most_critical: WorkflowDependency[]
}

class WorkflowDependencyScorer {
  private catalog: Map<string, WorkflowDependency[]> = new Map()

  registerWorkflow(dep: WorkflowDependency): void {
    const existing = this.catalog.get(dep.org_id) ?? []
    const index = existing.findIndex((w) => w.workflow_id === dep.workflow_id)
    if (index >= 0) {
      existing[index] = dep
    } else {
      existing.push(dep)
    }
    this.catalog.set(dep.org_id, existing)
    logger.info('[WorkflowDependencyScorer] workflow registered', {
      workflow_id: dep.workflow_id,
      org_id: dep.org_id,
    })
  }

  scoreOrg(orgId: string): DependencyScore {
    const deps = this.catalog.get(orgId) ?? []

    if (deps.length === 0) {
      logger.warn('[WorkflowDependencyScorer] no workflows found for org', { orgId })
      return {
        org_id: orgId,
        total_workflows: 0,
        critical_workflows: 0,
        dependency_score: 0,
        daily_executions_total: 0,
        switching_complexity_avg: 'low',
        most_critical: [],
      }
    }

    const criticalWorkflows = deps.filter((d) => d.revenue_critical).length
    const dailyExecutionsTotal = deps.reduce((sum, d) => sum + d.daily_executions, 0)
    const score = this.calculateScore(deps)

    const complexityOrder = ['low', 'medium', 'high', 'critical']
    const avgComplexityIndex = Math.round(
      deps.reduce(
        (sum, d) => sum + complexityOrder.indexOf(d.switching_complexity),
        0
      ) / deps.length
    )
    const switching_complexity_avg = complexityOrder[avgComplexityIndex] ?? 'medium'

    const mostCritical = [...deps]
      .sort((a, b) => {
        const scoreA =
          this.complexityMultiplier(a.switching_complexity) *
          (a.revenue_critical ? 2 : 1) *
          a.daily_executions
        const scoreB =
          this.complexityMultiplier(b.switching_complexity) *
          (b.revenue_critical ? 2 : 1) *
          b.daily_executions
        return scoreB - scoreA
      })
      .slice(0, 5)

    logger.info('[WorkflowDependencyScorer] org scored', { orgId, score, criticalWorkflows })

    return {
      org_id: orgId,
      total_workflows: deps.length,
      critical_workflows: criticalWorkflows,
      dependency_score: score,
      daily_executions_total: dailyExecutionsTotal,
      switching_complexity_avg,
      most_critical: mostCritical,
    }
  }

  getCriticalWorkflows(orgId: string): WorkflowDependency[] {
    return (this.catalog.get(orgId) ?? []).filter((d) => d.revenue_critical)
  }

  calculateScore(deps: WorkflowDependency[]): number {
    if (deps.length === 0) return 0

    let rawScore = 0
    const maxPossible = deps.length * 5 * 2 * 100 // max per workflow: critical(5) * revenue_critical(2) * executions norm(100)

    for (const dep of deps) {
      const complexityMult = this.complexityMultiplier(dep.switching_complexity)
      const revenueMult = dep.revenue_critical ? 2 : 1
      const dataMult = 1 + dep.data_dependencies.length * 0.1
      const integrationMult = 1 + dep.external_integrations.length * 0.05
      const teamMult = 1 + dep.team_size_dependent * 0.02

      rawScore +=
        complexityMult *
        revenueMult *
        dataMult *
        integrationMult *
        teamMult *
        Math.min(dep.daily_executions, 100)
    }

    // Normalize to 0-100
    const normalized = Math.min(100, Math.round((rawScore / Math.max(maxPossible, 1)) * 100))

    // Apply volume multiplier: more workflows = higher lock-in
    const volumeBonus = Math.min(15, Math.floor(deps.length / 5) * 3)
    return Math.min(100, normalized + volumeBonus)
  }

  complexityMultiplier(c: WorkflowDependency['switching_complexity']): number {
    const map: Record<WorkflowDependency['switching_complexity'], number> = {
      low: 1,
      medium: 2,
      high: 3,
      critical: 5,
    }
    return map[c]
  }
}

export const workflowDependencyScorer = new WorkflowDependencyScorer()
export default workflowDependencyScorer
