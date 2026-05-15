// AGENCY GROUP — SH-ROS | AMI: 22506

import { logger } from '@/lib/observability/logger'

export type ChurnRiskLevel = 'low' | 'medium' | 'high' | 'critical'

export interface ChurnSignal {
  signal_type: string
  weight: number  // 0-1
  detected: boolean
  value?: number | string
}

export interface ChurnRiskProfile {
  org_id: string
  risk_level: ChurnRiskLevel
  risk_score: number     // 0-100, higher = more likely to churn
  signals: ChurnSignal[]
  days_until_renewal?: number
  monthly_value_eur: number
  recommended_actions: string[]
  assessed_at: Date
}

// Baseline signal definitions (weights must sum to ~1.0)
const BASE_CHURN_SIGNALS: Omit<ChurnSignal, 'detected' | 'value'>[] = [
  { signal_type: 'login_frequency_drop',  weight: 0.18 },
  { signal_type: 'feature_adoption_low',  weight: 0.15 },
  { signal_type: 'support_tickets_high',  weight: 0.12 },
  { signal_type: 'nps_low',               weight: 0.14 },
  { signal_type: 'usage_decline',         weight: 0.16 },
  { signal_type: 'team_reduction',        weight: 0.10 },
  { signal_type: 'billing_issues',        weight: 0.08 },
  { signal_type: 'champion_left',         weight: 0.07 },
]

const RETENTION_ACTIONS: Record<string, string> = {
  login_frequency_drop: 'Schedule re-activation call; send personalised SH-ROS ROI recap email',
  feature_adoption_low: 'Trigger onboarding re-engagement sequence; assign CSM for feature walkthrough',
  support_tickets_high: 'Escalate to engineering triage; proactive outreach within 24h',
  nps_low: 'Executive sponsor call; offer complimentary strategy session',
  usage_decline: 'Audit active workflows; identify and remove friction in top 3 use cases',
  team_reduction: 'Right-size plan proposal; offer flexible seat pause option',
  billing_issues: 'Finance contact outreach; flexible payment plan offer',
  champion_left: 'Identify new champion; deliver tailored value narrative to new contact',
}

export class ChurnPrediction {
  assessRisk(orgId: string, usageData: Record<string, unknown>): ChurnRiskProfile {
    const signals: ChurnSignal[] = BASE_CHURN_SIGNALS.map(base => ({
      ...base,
      detected: this._detectSignal(base.signal_type, usageData),
      value: usageData[base.signal_type] as number | string | undefined,
    }))

    const score = this.calculateScore(signals)
    const riskLevel = this.getRiskLevel(score)
    const monthlyValue = (usageData['monthly_value_eur'] as number | undefined) ?? 0
    const daysUntilRenewal = usageData['days_until_renewal'] as number | undefined
    const recommendedActions = this.getRetentionActions({ org_id: orgId, risk_level: riskLevel, risk_score: score, signals, monthly_value_eur: monthlyValue, days_until_renewal: daysUntilRenewal, recommended_actions: [], assessed_at: new Date() })

    const profile: ChurnRiskProfile = {
      org_id: orgId,
      risk_level: riskLevel,
      risk_score: score,
      signals,
      days_until_renewal: daysUntilRenewal,
      monthly_value_eur: monthlyValue,
      recommended_actions: recommendedActions,
      assessed_at: new Date(),
    }

    logger.info('ChurnPrediction: risk assessed', {
      org_id: orgId,
      risk_level: riskLevel,
      risk_score: score,
      signals_detected: signals.filter(s => s.detected).length,
    })

    return profile
  }

  getRiskLevel(score: number): ChurnRiskLevel {
    if (score >= 75) return 'critical'
    if (score >= 50) return 'high'
    if (score >= 25) return 'medium'
    return 'low'
  }

  calculateScore(signals: ChurnSignal[]): number {
    // Weighted sum of detected signals, scaled to 0-100
    const totalWeight = signals.reduce((s, sig) => s + sig.weight, 0)
    const detectedWeight = signals
      .filter(s => s.detected)
      .reduce((s, sig) => s + sig.weight, 0)

    if (totalWeight <= 0) return 0
    return Math.round((detectedWeight / totalWeight) * 100)
  }

  getRetentionActions(profile: ChurnRiskProfile): string[] {
    const detectedSignals = profile.signals.filter(s => s.detected)

    // Sort by weight (most impactful first)
    const sorted = [...detectedSignals].sort((a, b) => b.weight - a.weight)

    const actions = sorted
      .map(s => RETENTION_ACTIONS[s.signal_type])
      .filter((a): a is string => !!a)

    // Add urgency-based actions
    if (profile.risk_level === 'critical') {
      actions.unshift('URGENT: Escalate to executive sponsor within 24 hours')
    }

    if (profile.days_until_renewal !== undefined && profile.days_until_renewal <= 30) {
      actions.push(`Renewal in ${profile.days_until_renewal} days — schedule value review call immediately`)
    }

    return actions.slice(0, 5) // Top 5 actions
  }

  getHighRiskOrgs(profiles: ChurnRiskProfile[]): ChurnRiskProfile[] {
    return profiles
      .filter(p => p.risk_level === 'high' || p.risk_level === 'critical')
      .sort((a, b) => {
        // Sort by MRR at risk first, then by risk score
        const mrrDiff = b.monthly_value_eur - a.monthly_value_eur
        if (mrrDiff !== 0) return mrrDiff
        return b.risk_score - a.risk_score
      })
  }

  private _detectSignal(signalType: string, usageData: Record<string, unknown>): boolean {
    const value = usageData[signalType]

    switch (signalType) {
      case 'login_frequency_drop':
        return typeof value === 'number' && value > 40 // >40% drop in logins
      case 'feature_adoption_low':
        return typeof value === 'number' && value < 0.3 // <30% feature adoption
      case 'support_tickets_high':
        return typeof value === 'number' && value >= 5 // 5+ open tickets
      case 'nps_low':
        return typeof value === 'number' && value < 6 // NPS < 6 (detractor)
      case 'usage_decline':
        return typeof value === 'number' && value > 30 // >30% usage decline MoM
      case 'team_reduction':
        return typeof value === 'number' && value > 0 // any seat reduction
      case 'billing_issues':
        return value === true || value === 'failed' || value === 'overdue'
      case 'champion_left':
        return value === true || value === 'churned'
      default:
        return !!value
    }
  }
}

export const churnPrediction = new ChurnPrediction()
