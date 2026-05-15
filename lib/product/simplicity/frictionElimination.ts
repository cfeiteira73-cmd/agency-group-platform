// AGENCY GROUP — SH-ROS | AMI: 22506
// Product Simplicity Layer: Friction Elimination Engine
// Identifies and quantifies friction in real estate operations — prioritises quick wins
// Portugal context: 18% close rate, 210-day avg cycle, €320K avg deal, 5% commission

import logger from '@/lib/logger'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export type FrictionSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface FrictionPoint {
  friction_id: string
  description: string
  severity: FrictionSeverity
  category: 'navigation' | 'data_entry' | 'approval' | 'communication' | 'reporting'
  step: string
  elimination_strategy: string
  estimated_time_saved_minutes_per_week: number
  effort_to_fix: 'low' | 'medium' | 'high'
}

export interface FrictionAnalysis {
  journey: string[]
  total_points: number
  critical_points: FrictionPoint[]
  total_time_saved_per_week_minutes: number
  quick_wins: FrictionPoint[]
  recommendations: string[]
  friction_score: number   // 0-100, lower is better
}

// ─── Friction Severity Weights ─────────────────────────────────────────────────

const SEVERITY_WEIGHT: Record<FrictionSeverity, number> = {
  critical: 25,
  high: 15,
  medium: 8,
  low: 3,
}

// ─── Known Friction Catalog ───────────────────────────────────────────────────

const FRICTION_CATALOG: FrictionPoint[] = [
  {
    friction_id: 'fr_manual_lead_entry',
    description: 'Agents must manually type lead details from WhatsApp into CRM — takes 5-10 min per lead',
    severity: 'high',
    category: 'data_entry',
    step: 'lead_capture',
    elimination_strategy: 'WhatsApp Business API auto-extract → CRM push via n8n webhook',
    estimated_time_saved_minutes_per_week: 90,
    effort_to_fix: 'medium',
  },
  {
    friction_id: 'fr_deal_pack_manual',
    description: 'Deal packs are assembled manually from multiple files and tools — 20+ min each',
    severity: 'critical',
    category: 'data_entry',
    step: 'deal_pack_creation',
    elimination_strategy: 'One-click deal pack generator pulling from CRM + property DB + AVM',
    estimated_time_saved_minutes_per_week: 120,
    effort_to_fix: 'medium',
  },
  {
    friction_id: 'fr_follow_up_memory',
    description: 'Agents rely on memory and spreadsheets to track follow-up timings — leads fall through cracks',
    severity: 'critical',
    category: 'communication',
    step: 'lead_followup',
    elimination_strategy: 'Automated follow-up cadence with smart reminders — no manual tracking needed',
    estimated_time_saved_minutes_per_week: 60,
    effort_to_fix: 'low',
  },
  {
    friction_id: 'fr_report_generation',
    description: 'Weekly pipeline and vendor reports take 2+ hours to compile from multiple sources',
    severity: 'high',
    category: 'reporting',
    step: 'reporting',
    elimination_strategy: 'Auto-generated PDF reports from live Supabase data — scheduled Monday 08:00',
    estimated_time_saved_minutes_per_week: 90,
    effort_to_fix: 'low',
  },
  {
    friction_id: 'fr_approval_bottleneck',
    description: 'Deal pack approvals require broker review via email — 24-48h delay per deal',
    severity: 'high',
    category: 'approval',
    step: 'deal_approval',
    elimination_strategy: 'In-app one-click approval with push notification to broker mobile',
    estimated_time_saved_minutes_per_week: 45,
    effort_to_fix: 'low',
  },
  {
    friction_id: 'fr_crm_navigation',
    description: 'Finding a specific lead in the CRM requires 4-6 clicks through nested menus',
    severity: 'medium',
    category: 'navigation',
    step: 'crm_access',
    elimination_strategy: 'Universal search bar with lead name/phone quick-access from any screen',
    estimated_time_saved_minutes_per_week: 30,
    effort_to_fix: 'low',
  },
  {
    friction_id: 'fr_document_collection',
    description: 'Collecting KYC and property documents from clients is a manual back-and-forth via email',
    severity: 'high',
    category: 'data_entry',
    step: 'document_collection',
    elimination_strategy: 'Secure document upload portal with auto-checklist and completion tracking',
    estimated_time_saved_minutes_per_week: 75,
    effort_to_fix: 'medium',
  },
  {
    friction_id: 'fr_viewing_scheduling',
    description: 'Coordinating viewing times involves multiple WhatsApp messages between agent, buyer, and vendor',
    severity: 'medium',
    category: 'communication',
    step: 'viewing_scheduling',
    elimination_strategy: 'Self-service viewing calendar where buyers book from agent\'s available slots',
    estimated_time_saved_minutes_per_week: 40,
    effort_to_fix: 'medium',
  },
  {
    friction_id: 'fr_market_data_lookup',
    description: 'Agents look up comparable sales and zone prices manually from INE and Confidencial Imobiliário',
    severity: 'medium',
    category: 'data_entry',
    step: 'market_research',
    elimination_strategy: 'Integrated AVM pulling live market data in the deal pack — no manual lookup',
    estimated_time_saved_minutes_per_week: 50,
    effort_to_fix: 'medium',
  },
  {
    friction_id: 'fr_cpcv_reminder',
    description: 'CPCV and escritura deadline tracking is done via personal calendars — easy to miss',
    severity: 'critical',
    category: 'communication',
    step: 'legal_milestones',
    elimination_strategy: 'Automated milestone alerts — 30/7/1 day reminders to agent, broker, and lawyer',
    estimated_time_saved_minutes_per_week: 20,
    effort_to_fix: 'low',
  },
  {
    friction_id: 'fr_lead_source_attribution',
    description: 'No systematic tracking of which channel (idealista, Imovirtual, referral) generated each lead',
    severity: 'low',
    category: 'reporting',
    step: 'lead_attribution',
    elimination_strategy: 'UTM tagging on all portal links with automatic source attribution in CRM',
    estimated_time_saved_minutes_per_week: 15,
    effort_to_fix: 'low',
  },
  {
    friction_id: 'fr_price_negotiation_data',
    description: 'Agents enter price negotiations without ready access to comparable sales data',
    severity: 'high',
    category: 'data_entry',
    step: 'negotiation',
    elimination_strategy: 'Real-time comparable sales sidebar in the deal view — no tab switching needed',
    estimated_time_saved_minutes_per_week: 35,
    effort_to_fix: 'medium',
  },
]

// ─── Class ────────────────────────────────────────────────────────────────────

class FrictionEliminationEngine {
  analyze(userJourney: string[]): FrictionAnalysis {
    // Match friction points relevant to the provided journey steps
    const relevant = userJourney.length > 0
      ? FRICTION_CATALOG.filter(fp =>
          userJourney.some(step =>
            fp.step.includes(step.toLowerCase()) ||
            fp.description.toLowerCase().includes(step.toLowerCase())
          )
        )
      : [...FRICTION_CATALOG]

    const criticalPoints = relevant.filter(fp => fp.severity === 'critical')
    const quickWins = this.getQuickWins().filter(fp =>
      relevant.some(r => r.friction_id === fp.friction_id)
    )

    const totalTimeSaved = relevant.reduce(
      (sum, fp) => sum + fp.estimated_time_saved_minutes_per_week,
      0
    )

    const frictionScore = this.getScore(relevant)

    const recommendations = this._buildRecommendations(relevant, quickWins)

    const analysis: FrictionAnalysis = {
      journey: userJourney,
      total_points: relevant.length,
      critical_points: criticalPoints,
      total_time_saved_per_week_minutes: totalTimeSaved,
      quick_wins: quickWins,
      recommendations,
      friction_score: frictionScore,
    }

    logger.info('[FrictionElimination] analyze', {
      journey_steps: userJourney.length,
      friction_points: relevant.length,
      critical_count: criticalPoints.length,
      quick_wins: quickWins.length,
      friction_score: frictionScore,
      time_saved_per_week_min: totalTimeSaved,
    })

    return analysis
  }

  getQuickWins(): FrictionPoint[] {
    return FRICTION_CATALOG
      .filter(fp =>
        fp.effort_to_fix === 'low' &&
        (fp.severity === 'medium' || fp.severity === 'high' || fp.severity === 'critical')
      )
      .sort((a, b) => b.estimated_time_saved_minutes_per_week - a.estimated_time_saved_minutes_per_week)
  }

  prioritize(points: FrictionPoint[]): FrictionPoint[] {
    return [...points].sort((a, b) => {
      const scoreA = SEVERITY_WEIGHT[a.severity] * a.estimated_time_saved_minutes_per_week
      const scoreB = SEVERITY_WEIGHT[b.severity] * b.estimated_time_saved_minutes_per_week
      return scoreB - scoreA
    })
  }

  getScore(points: FrictionPoint[]): number {
    if (points.length === 0) return 0

    const rawScore = points.reduce((sum, fp) => sum + SEVERITY_WEIGHT[fp.severity], 0)
    // Normalize to 0-100 — assume max realistic friction = 300 points
    return Math.min(100, Math.round((rawScore / 300) * 100))
  }

  private _buildRecommendations(points: FrictionPoint[], quickWins: FrictionPoint[]): string[] {
    const recs: string[] = []

    const criticals = points.filter(fp => fp.severity === 'critical')
    if (criticals.length > 0) {
      recs.push(`Fix ${criticals.length} critical friction point${criticals.length > 1 ? 's' : ''} immediately: ${criticals.map(c => c.friction_id.replace('fr_', '')).join(', ')}`)
    }

    if (quickWins.length > 0) {
      const topWin = quickWins[0]
      recs.push(`Quick win: "${topWin.elimination_strategy}" saves ${topWin.estimated_time_saved_minutes_per_week} min/week with low effort`)
    }

    const totalTimeSaved = quickWins.reduce((sum, fp) => sum + fp.estimated_time_saved_minutes_per_week, 0)
    if (totalTimeSaved > 0) {
      const hours = Math.round(totalTimeSaved / 60)
      recs.push(`Implementing all quick wins saves approximately ${hours}h per agent per week`)
    }

    const dataEntryPoints = points.filter(fp => fp.category === 'data_entry')
    if (dataEntryPoints.length >= 3) {
      recs.push('Prioritise data automation — manual data entry is the #1 source of friction in your workflow')
    }

    return recs
  }
}

export const frictionEliminationEngine = new FrictionEliminationEngine()
