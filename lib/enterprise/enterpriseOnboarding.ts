// AGENCY GROUP — SH-ROS | AMI: 22506
import { logger } from '@/lib/observability/logger'

export type OnboardingPhase =
  | 'kickoff'
  | 'data_import'
  | 'workflow_config'
  | 'team_training'
  | 'go_live'
  | 'success_review'

export interface OnboardingMilestone {
  phase: OnboardingPhase
  title: string
  description: string
  owner: 'customer' | 'platform' | 'shared'
  duration_days: number
  dependencies: OnboardingPhase[]
  completion_criteria: string[]
  is_completed: boolean
  completed_at?: Date
}

export interface OnboardingPlan {
  org_id: string
  plan_id: string
  tier: string
  total_duration_days: number
  milestones: OnboardingMilestone[]
  success_criteria: string[]
  executive_sponsor?: string
  kickoff_date?: Date
  go_live_target?: Date
  health_score: number
}

export const MILESTONE_TEMPLATES: Record<
  OnboardingPhase,
  Omit<OnboardingMilestone, 'is_completed' | 'completed_at'>
> = {
  kickoff: {
    phase: 'kickoff',
    title: 'Project Kickoff & Alignment',
    description:
      'Align stakeholders on project scope, timelines, success criteria, and team responsibilities.',
    owner: 'shared',
    duration_days: 3,
    dependencies: [],
    completion_criteria: [
      'Kickoff meeting completed with all stakeholders',
      'Project charter signed',
      'Communication cadence agreed',
      'Success criteria documented',
    ],
  },
  data_import: {
    phase: 'data_import',
    title: 'Data Migration & Import',
    description:
      'Migrate existing CRM data, property listings, contacts, and deal history into the platform.',
    owner: 'shared',
    duration_days: 7,
    dependencies: ['kickoff'],
    completion_criteria: [
      'Historical deals imported (last 24 months)',
      'Contact database migrated and deduplicated',
      'Property portfolio synced',
      'Data quality validation passed (>95% accuracy)',
    ],
  },
  workflow_config: {
    phase: 'workflow_config',
    title: 'Workflow Configuration',
    description:
      'Configure automations, pipelines, templates, and integration connections.',
    owner: 'platform',
    duration_days: 5,
    dependencies: ['data_import'],
    completion_criteria: [
      'Core workflows activated (lead nurture, deal progression)',
      'Email templates configured',
      'Integration connections verified',
      'Automation rules tested end-to-end',
    ],
  },
  team_training: {
    phase: 'team_training',
    title: 'Team Training & Enablement',
    description: 'Train all end-users, managers, and admins on platform usage and best practices.',
    owner: 'platform',
    duration_days: 5,
    dependencies: ['workflow_config'],
    completion_criteria: [
      'All agents completed core training module',
      'Managers completed reporting & analytics training',
      'Admins completed platform administration training',
      'Q&A session conducted',
    ],
  },
  go_live: {
    phase: 'go_live',
    title: 'Go-Live',
    description: 'Transition from legacy systems to full platform operation.',
    owner: 'shared',
    duration_days: 2,
    dependencies: ['team_training'],
    completion_criteria: [
      'Legacy system decommission plan in place',
      'All users logged into production environment',
      'First live deal created on platform',
      'Monitoring dashboards active',
    ],
  },
  success_review: {
    phase: 'success_review',
    title: '30-Day Success Review',
    description: 'Evaluate adoption, ROI, and define expansion roadmap after 30 days live.',
    owner: 'shared',
    duration_days: 3,
    dependencies: ['go_live'],
    completion_criteria: [
      'Adoption metrics reviewed (DAU, feature usage)',
      'Business impact measured against baseline',
      'Issues logged and resolved',
      'Expansion opportunities identified',
    ],
  },
}

const PHASE_ORDER: OnboardingPhase[] = [
  'kickoff',
  'data_import',
  'workflow_config',
  'team_training',
  'go_live',
  'success_review',
]

class EnterpriseOnboarding {
  private plans: Map<string, OnboardingPlan> = new Map()

  createPlan(orgId: string, tier: string, kickoffDate?: Date): OnboardingPlan {
    const planId = `onb_${orgId}_${Date.now()}`
    const kd = kickoffDate ?? new Date()

    const milestones: OnboardingMilestone[] = PHASE_ORDER.map((phase) => ({
      ...MILESTONE_TEMPLATES[phase],
      is_completed: false,
    }))

    const totalDurationDays = milestones.reduce((sum, m) => sum + m.duration_days, 0)

    const goLiveTarget = new Date(kd)
    goLiveTarget.setDate(goLiveTarget.getDate() + totalDurationDays - MILESTONE_TEMPLATES['success_review'].duration_days)

    const plan: OnboardingPlan = {
      org_id: orgId,
      plan_id: planId,
      tier,
      total_duration_days: totalDurationDays,
      milestones,
      success_criteria: [
        '100% of agents active within 7 days of go-live',
        'First deal closed on platform within 30 days',
        'Adoption score >= 70/100 at 30-day review',
        'NPS score >= 40 at success review',
      ],
      kickoff_date: kd,
      go_live_target: goLiveTarget,
      health_score: 100,
    }

    this.plans.set(orgId, plan)
    logger.info('[EnterpriseOnboarding] plan created', { orgId, planId, tier })
    return plan
  }

  completeMilestone(orgId: string, phase: OnboardingPhase): OnboardingPlan {
    const plan = this.plans.get(orgId)
    if (!plan) throw new Error(`[EnterpriseOnboarding] plan not found for org: ${orgId}`)

    const milestone = plan.milestones.find((m) => m.phase === phase)
    if (!milestone) throw new Error(`[EnterpriseOnboarding] milestone not found: ${phase}`)

    milestone.is_completed = true
    milestone.completed_at = new Date()
    plan.health_score = this.getHealthScore(plan)

    this.plans.set(orgId, plan)
    logger.info('[EnterpriseOnboarding] milestone completed', { orgId, phase })
    return plan
  }

  getProgress(orgId: string): { completed: number; total: number; pct: number } {
    const plan = this.plans.get(orgId)
    if (!plan) return { completed: 0, total: 0, pct: 0 }
    const total = plan.milestones.length
    const completed = plan.milestones.filter((m) => m.is_completed).length
    return { completed, total, pct: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }

  getHealthScore(plan: OnboardingPlan): number {
    const now = new Date()
    const { completed, total } = this.getProgress(plan.org_id)
    let score = 100

    // Deduct for incomplete milestones past their expected date
    let expectedDate = plan.kickoff_date ? new Date(plan.kickoff_date) : now
    for (const milestone of plan.milestones) {
      expectedDate = new Date(expectedDate)
      expectedDate.setDate(expectedDate.getDate() + milestone.duration_days)

      if (!milestone.is_completed && now > expectedDate) {
        const daysLate = Math.floor((now.getTime() - expectedDate.getTime()) / 86400000)
        score -= Math.min(20, daysLate * 3)
      }
    }

    // Bonus for completion rate
    score = Math.max(0, score + Math.round((completed / Math.max(total, 1)) * 10))
    return Math.min(100, Math.max(0, score))
  }

  isOnTrack(plan: OnboardingPlan): boolean {
    return plan.health_score >= 70
  }

  getNextActions(orgId: string): string[] {
    const plan = this.plans.get(orgId)
    if (!plan) return []

    const nextMilestone = plan.milestones.find((m) => !m.is_completed)
    if (!nextMilestone) return ['All milestones complete — schedule success review']

    return nextMilestone.completion_criteria.map(
      (c) => `[${nextMilestone.phase.toUpperCase()}] ${c}`
    )
  }
}

export const enterpriseOnboarding = new EnterpriseOnboarding()
export default enterpriseOnboarding
