// AGENCY GROUP — SH-ROS | AMI: 22506
import { logger } from '@/lib/observability/logger'

export interface RolloutPhase {
  phase_id: string
  name: string
  target_pct: number
  start_date: Date
  duration_days: number
  rollback_trigger: string
  success_criteria: string[]
  status: 'pending' | 'active' | 'completed' | 'rolled_back'
}

export interface RolloutPlan {
  rollout_id: string
  feature_name: string
  org_id: string
  phases: RolloutPhase[]
  current_phase: number
  total_exposure_pct: number
  can_rollback: boolean
  created_at: Date
}

const DEFAULT_PHASES: Omit<RolloutPhase, 'phase_id' | 'start_date'>[] = [
  {
    name: 'Canary',
    target_pct: 5,
    duration_days: 3,
    rollback_trigger: 'error_rate > 1% OR p95_latency_ms > 2000',
    success_criteria: [
      'Error rate < 0.5%',
      'p95 latency < 1000ms',
      'Zero critical alerts in 72h',
    ],
    status: 'pending',
  },
  {
    name: 'Early Access',
    target_pct: 25,
    duration_days: 7,
    rollback_trigger: 'error_rate > 0.5% OR satisfaction_score < 7',
    success_criteria: [
      'Error rate < 0.3%',
      'User satisfaction >= 8/10',
      'Feature adoption > 60% of exposed users',
    ],
    status: 'pending',
  },
  {
    name: 'Full Rollout',
    target_pct: 100,
    duration_days: 14,
    rollback_trigger: 'error_rate > 0.5% OR revenue_impact < -5%',
    success_criteria: [
      'Error rate < 0.2%',
      'All users migrated',
      'Legacy feature deprecated',
      'Positive revenue impact confirmed',
    ],
    status: 'pending',
  },
]

class EnterpriseRolloutManager {
  private rollouts: Map<string, RolloutPlan> = new Map()

  createRollout(
    orgId: string,
    featureName: string,
    phases?: Partial<RolloutPhase>[]
  ): RolloutPlan {
    const rolloutId = `rlt_${orgId}_${Date.now()}`
    const now = new Date()

    const resolvedPhases: RolloutPhase[] = (phases && phases.length > 0
      ? phases.map((p, i) => ({ ...DEFAULT_PHASES[i % DEFAULT_PHASES.length], ...p }))
      : DEFAULT_PHASES
    ).map((p, i) => ({
      phase_id: `ph_${rolloutId}_${i + 1}`,
      name: p.name ?? `Phase ${i + 1}`,
      target_pct: p.target_pct ?? DEFAULT_PHASES[i % DEFAULT_PHASES.length].target_pct,
      start_date: i === 0 ? now : new Date(now.getTime() + i * 7 * 86400000),
      duration_days: p.duration_days ?? DEFAULT_PHASES[i % DEFAULT_PHASES.length].duration_days,
      rollback_trigger: p.rollback_trigger ?? DEFAULT_PHASES[i % DEFAULT_PHASES.length].rollback_trigger,
      success_criteria: p.success_criteria ?? DEFAULT_PHASES[i % DEFAULT_PHASES.length].success_criteria,
      status: i === 0 ? ('active' as const) : ('pending' as const),
    }))

    const plan: RolloutPlan = {
      rollout_id: rolloutId,
      feature_name: featureName,
      org_id: orgId,
      phases: resolvedPhases,
      current_phase: 0,
      total_exposure_pct: resolvedPhases[0]?.target_pct ?? 5,
      can_rollback: true,
      created_at: now,
    }

    this.rollouts.set(rolloutId, plan)
    logger.info('[EnterpriseRolloutManager] rollout created', { rolloutId, orgId, featureName })
    return plan
  }

  advancePhase(rolloutId: string): RolloutPlan {
    const plan = this.rollouts.get(rolloutId)
    if (!plan) throw new Error(`[EnterpriseRolloutManager] rollout not found: ${rolloutId}`)

    const currentPhase = plan.phases[plan.current_phase]
    if (!currentPhase) throw new Error('[EnterpriseRolloutManager] no current phase')

    currentPhase.status = 'completed'

    const nextIndex = plan.current_phase + 1
    if (nextIndex >= plan.phases.length) {
      plan.can_rollback = false
      logger.info('[EnterpriseRolloutManager] rollout fully deployed', { rolloutId })
    } else {
      plan.phases[nextIndex].status = 'active'
      plan.phases[nextIndex].start_date = new Date()
      plan.current_phase = nextIndex
      plan.total_exposure_pct = plan.phases[nextIndex].target_pct
      logger.info('[EnterpriseRolloutManager] advanced to next phase', {
        rolloutId,
        phase: plan.phases[nextIndex].name,
        exposure_pct: plan.total_exposure_pct,
      })
    }

    this.rollouts.set(rolloutId, plan)
    return plan
  }

  rollback(rolloutId: string): RolloutPlan {
    const plan = this.rollouts.get(rolloutId)
    if (!plan) throw new Error(`[EnterpriseRolloutManager] rollout not found: ${rolloutId}`)
    if (!plan.can_rollback) {
      throw new Error(`[EnterpriseRolloutManager] rollback not allowed for ${rolloutId}`)
    }

    for (const phase of plan.phases) {
      if (phase.status === 'active' || phase.status === 'completed') {
        phase.status = 'rolled_back'
      }
    }
    plan.total_exposure_pct = 0
    plan.can_rollback = false

    this.rollouts.set(rolloutId, plan)
    logger.warn('[EnterpriseRolloutManager] rollout rolled back', { rolloutId })
    return plan
  }

  getActiveRollouts(orgId: string): RolloutPlan[] {
    return Array.from(this.rollouts.values()).filter(
      (r) => r.org_id === orgId && r.phases.some((p) => p.status === 'active')
    )
  }

  monitorHealth(rolloutId: string): { healthy: boolean; metrics: Record<string, number> } {
    const plan = this.rollouts.get(rolloutId)
    if (!plan) {
      logger.warn('[EnterpriseRolloutManager] monitorHealth: rollout not found', { rolloutId })
      return { healthy: false, metrics: {} }
    }

    // Real implementation would pull from observability stack
    const metrics: Record<string, number> = {
      error_rate_pct: 0.1,
      p95_latency_ms: 320,
      adoption_pct: plan.total_exposure_pct,
      satisfaction_score: 8.4,
    }

    const healthy =
      metrics['error_rate_pct'] < 1 &&
      metrics['p95_latency_ms'] < 2000 &&
      metrics['satisfaction_score'] >= 7

    return { healthy, metrics }
  }
}

export const enterpriseRolloutManager = new EnterpriseRolloutManager()
export default enterpriseRolloutManager
