// AGENCY GROUP — SH-ROS | AMI: 22506
import { logger } from '@/lib/observability/logger'

export type AdoptionTier = 'trial' | 'basic' | 'operational' | 'advanced' | 'transformational'

export interface AdoptionSignal {
  signal_id: string
  signal: string
  detected: boolean
  value?: number | string
  tier_indicator: AdoptionTier
  points: number  // contribution to adoption score
}

export interface AdoptionDepthProfile {
  org_id: string
  adoption_tier: AdoptionTier
  adoption_score: number     // 0-100
  signals: AdoptionSignal[]
  features_used: number
  features_available: number
  feature_adoption_pct: number
  monthly_active_users: number
  power_users: number
  assessed_at: Date
}

const ADOPTION_SIGNALS: Omit<AdoptionSignal, 'detected' | 'value'>[] = [
  { signal_id: 'logged_in_last_7d',        signal: 'Logged in within last 7 days',          tier_indicator: 'trial',           points: 5  },
  { signal_id: 'completed_onboarding',     signal: 'Completed onboarding flow',              tier_indicator: 'basic',           points: 8  },
  { signal_id: 'first_match_scored',       signal: 'First AI match score generated',         tier_indicator: 'basic',           points: 8  },
  { signal_id: 'first_deal_pack_sent',     signal: 'First deal pack sent to a client',       tier_indicator: 'operational',     points: 10 },
  { signal_id: 'workflow_automated',       signal: 'At least one workflow automated',        tier_indicator: 'operational',     points: 10 },
  { signal_id: 'ai_decision_followed',     signal: 'AI recommendation acted upon',          tier_indicator: 'operational',     points: 12 },
  { signal_id: 'digest_read_daily',        signal: 'Daily digest opened for 5+ consecutive days', tier_indicator: 'advanced',  points: 12 },
  { signal_id: 'custom_workflow_created',  signal: 'Custom workflow created by team',        tier_indicator: 'advanced',        points: 12 },
  { signal_id: 'deal_won_attributed',      signal: 'Deal closed attributed to platform',    tier_indicator: 'advanced',        points: 15 },
  { signal_id: 'multi_agent_team',         signal: 'Multiple agents actively collaborating', tier_indicator: 'transformational', points: 15 },
  { signal_id: 'exec_dashboard_used',      signal: 'Executive dashboard accessed regularly', tier_indicator: 'transformational', points: 15 },
  { signal_id: 'api_integration_active',   signal: 'Live API integration with external system', tier_indicator: 'transformational', points: 18 },
]

const TIER_THRESHOLDS = { trial: 20, basic: 40, operational: 60, advanced: 80 } // >80 = transformational

class AdoptionDepthMetrics {
  assess(
    orgId: string,
    usage: {
      features_used: number
      features_available: number
      mau: number
      power_users: number
      signals: Record<string, boolean | number>
    },
  ): AdoptionDepthProfile {
    const feature_adoption_pct =
      usage.features_available > 0
        ? Math.min(1, usage.features_used / usage.features_available)
        : 0

    const signals: AdoptionSignal[] = ADOPTION_SIGNALS.map((template) => {
      const raw = usage.signals[template.signal_id]
      const detected = raw === true || (typeof raw === 'number' && raw > 0)
      return {
        ...template,
        detected,
        value: raw !== undefined ? (typeof raw === 'boolean' ? (raw ? 1 : 0) : raw) : undefined,
      }
    })

    const adoption_score = this.calculateScore(signals, feature_adoption_pct)
    const adoption_tier = this.getTier(adoption_score)

    logger.info('[AdoptionDepthMetrics] org assessed', {
      orgId,
      adoption_score,
      adoption_tier,
      features_used: usage.features_used,
    })

    return {
      org_id: orgId,
      adoption_tier,
      adoption_score,
      signals,
      features_used: usage.features_used,
      features_available: usage.features_available,
      feature_adoption_pct,
      monthly_active_users: usage.mau,
      power_users: usage.power_users,
      assessed_at: new Date(),
    }
  }

  calculateScore(signals: AdoptionSignal[], featureAdoptionPct: number): number {
    const signalPoints = signals.reduce((sum, s) => sum + (s.detected ? s.points : 0), 0)
    const raw = signalPoints + featureAdoptionPct * 30
    return Math.min(100, Math.round(raw))
  }

  getTier(score: number): AdoptionTier {
    if (score <= TIER_THRESHOLDS.trial) return 'trial'
    if (score <= TIER_THRESHOLDS.basic) return 'basic'
    if (score <= TIER_THRESHOLDS.operational) return 'operational'
    if (score <= TIER_THRESHOLDS.advanced) return 'advanced'
    return 'transformational'
  }

  getGrowthRecommendations(profile: AdoptionDepthProfile): string[] {
    // Sort undetected signals by points desc and return top 3
    const undetected = profile.signals
      .filter((s) => !s.detected)
      .sort((a, b) => b.points - a.points)
      .slice(0, 3)

    if (undetected.length === 0) {
      return [
        'All key adoption signals are active — focus on deepening usage and referral expansion.',
        'Consider enabling cross-team collaboration features to sustain transformational tier.',
        'Explore API-driven automations to further embed the platform into revenue workflows.',
      ]
    }

    return undetected.map((s) => {
      const tierLabel = s.tier_indicator.charAt(0).toUpperCase() + s.tier_indicator.slice(1)
      return `Unlock "${s.signal}" (${tierLabel} signal, +${s.points} pts) to advance adoption tier and increase retention probability.`
    })
  }
}

export const adoptionDepthMetrics = new AdoptionDepthMetrics()
export default adoptionDepthMetrics
