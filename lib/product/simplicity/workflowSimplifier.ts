// AGENCY GROUP — SH-ROS | AMI: 22506
// Product Simplicity Layer: Workflow Simplifier
// Reduces complex multi-step chains to the minimum viable action sequence
// Portugal context: 18% close rate, 210-day avg cycle, €320K avg deal, 5% commission

import logger from '@/lib/logger'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface WorkflowStep {
  action: string
  estimated_time: string
  revenue_impact: number
  is_critical: boolean
}

export interface SimplifiedWorkflow {
  workflow_id: string
  title: string
  description: string
  role: string
  steps: WorkflowStep[]
  total_time_minutes: number
  total_impact_eur: number
  confidence: number
}

// ─── Workflow Catalog ─────────────────────────────────────────────────────────

const WORKFLOW_CATALOG: Record<string, SimplifiedWorkflow> = {
  hot_lead_followup: {
    workflow_id: 'hot_lead_followup',
    title: 'Hot Lead Follow-Up',
    description: 'Immediate response sequence for leads scored 80+ to maximise conversion within the 4-hour golden window',
    role: 'agent',
    steps: [
      {
        action: 'Call lead within 15 minutes of enquiry — use first-name greeting and reference the specific property',
        estimated_time: '5 min',
        revenue_impact: 8000,
        is_critical: true,
      },
      {
        action: 'Send personalised deal pack via WhatsApp (PDF + 3 property photos + availability calendar)',
        estimated_time: '3 min',
        revenue_impact: 4000,
        is_critical: true,
      },
      {
        action: 'Book viewing for within 48 hours and confirm via SMS',
        estimated_time: '2 min',
        revenue_impact: 6000,
        is_critical: true,
      },
    ],
    total_time_minutes: 10,
    total_impact_eur: 18000,
    confidence: 0.92,
  },
  deal_pack_send: {
    workflow_id: 'deal_pack_send',
    title: 'Deal Pack Distribution',
    description: 'Dispatch a professional deal pack to qualify buyer intent and accelerate the CPCV conversation',
    role: 'agent',
    steps: [
      {
        action: 'Generate deal pack from CRM (property PDF + AVM report + area intel)',
        estimated_time: '2 min',
        revenue_impact: 3000,
        is_critical: true,
      },
      {
        action: 'Personalise cover note with buyer budget range and preferred timeline',
        estimated_time: '3 min',
        revenue_impact: 2000,
        is_critical: false,
      },
      {
        action: 'Send via email + WhatsApp and log interaction in CRM',
        estimated_time: '2 min',
        revenue_impact: 1500,
        is_critical: true,
      },
    ],
    total_time_minutes: 7,
    total_impact_eur: 6500,
    confidence: 0.87,
  },
  proposal_close: {
    workflow_id: 'proposal_close',
    title: 'Proposal & Close',
    description: 'Structured close sequence to move a qualified buyer from proposal to signed CPCV',
    role: 'agent',
    steps: [
      {
        action: 'Present written offer summary with price, terms, and 72-hour acceptance window',
        estimated_time: '10 min',
        revenue_impact: 16000,
        is_critical: true,
      },
      {
        action: 'Address objections using AVM data and comparable sales from last 90 days',
        estimated_time: '15 min',
        revenue_impact: 8000,
        is_critical: true,
      },
      {
        action: 'Confirm CPCV date with lawyer and collect 50% deposit reference',
        estimated_time: '5 min',
        revenue_impact: 16000,
        is_critical: true,
      },
    ],
    total_time_minutes: 30,
    total_impact_eur: 40000,
    confidence: 0.78,
  },
  stale_lead_recovery: {
    workflow_id: 'stale_lead_recovery',
    title: 'Stale Lead Re-Engagement',
    description: 'Re-activate leads dormant for 14+ days with a value-first outreach sequence',
    role: 'agent',
    steps: [
      {
        action: 'Send market update email — "3 new properties matching your criteria in [area]"',
        estimated_time: '3 min',
        revenue_impact: 5000,
        is_critical: true,
      },
      {
        action: 'Follow up with WhatsApp voice note 48 hours later if no response',
        estimated_time: '2 min',
        revenue_impact: 3000,
        is_critical: false,
      },
      {
        action: 'Flag as cold in CRM if no response after 7 days; schedule 30-day dormant reactivation',
        estimated_time: '1 min',
        revenue_impact: 1000,
        is_critical: false,
      },
    ],
    total_time_minutes: 6,
    total_impact_eur: 9000,
    confidence: 0.65,
  },
  new_listing_match: {
    workflow_id: 'new_listing_match',
    title: 'New Listing Buyer Match',
    description: 'When a new listing is added, instantly match and notify the top 5 qualified buyers in the pipeline',
    role: 'broker',
    steps: [
      {
        action: 'Run AI buyer-match against active pipeline (filters: budget ±20%, preferred zone, timeline)',
        estimated_time: '1 min',
        revenue_impact: 12000,
        is_critical: true,
      },
      {
        action: 'Notify top 5 matched buyers with pre-market preview message',
        estimated_time: '5 min',
        revenue_impact: 8000,
        is_critical: true,
      },
      {
        action: 'Schedule viewing slots for interested buyers within 72 hours',
        estimated_time: '5 min',
        revenue_impact: 6000,
        is_critical: false,
      },
    ],
    total_time_minutes: 11,
    total_impact_eur: 26000,
    confidence: 0.83,
  },
  weekly_pipeline_review: {
    workflow_id: 'weekly_pipeline_review',
    title: 'Weekly Pipeline Review',
    description: 'Structured 20-minute Monday review to identify deals at risk and prioritise the week\'s revenue actions',
    role: 'executive',
    steps: [
      {
        action: 'Review pipeline health dashboard — flag any deals with no activity in 7+ days',
        estimated_time: '5 min',
        revenue_impact: 20000,
        is_critical: true,
      },
      {
        action: 'Assign re-engagement tasks to agents for at-risk deals (>€500K at stake)',
        estimated_time: '10 min',
        revenue_impact: 15000,
        is_critical: true,
      },
      {
        action: 'Confirm this week\'s CPCV and escritura schedule with legal team',
        estimated_time: '5 min',
        revenue_impact: 32000,
        is_critical: true,
      },
    ],
    total_time_minutes: 20,
    total_impact_eur: 67000,
    confidence: 0.9,
  },
}

// ─── Class ────────────────────────────────────────────────────────────────────

class WorkflowSimplifier {
  simplify(complexChain: string[]): SimplifiedWorkflow {
    const chainStr = complexChain.join(' ').toLowerCase()

    // Score each catalog workflow by keyword overlap
    let bestMatch: SimplifiedWorkflow = WORKFLOW_CATALOG['hot_lead_followup']
    let bestScore = 0

    for (const [key, workflow] of Object.entries(WORKFLOW_CATALOG)) {
      const keywords = [
        key,
        workflow.title.toLowerCase(),
        workflow.role,
        ...workflow.steps.map(s => s.action.toLowerCase()),
      ].join(' ')

      const overlap = complexChain.filter(term =>
        keywords.includes(term.toLowerCase())
      ).length

      if (overlap > bestScore) {
        bestScore = overlap
        bestMatch = workflow
      }
    }

    logger.info('[WorkflowSimplifier] simplify', {
      chain_length: complexChain.length,
      matched_workflow: bestMatch.workflow_id,
      confidence: bestMatch.confidence,
    })

    return bestMatch
  }

  getQuickActionsForRole(role: string): WorkflowStep[] {
    const relevant = Object.values(WORKFLOW_CATALOG)
      .filter(w => w.role === role || role === 'executive')
      .flatMap(w => w.steps)
      .filter(s => s.is_critical)
      .sort((a, b) => b.revenue_impact - a.revenue_impact)
      .slice(0, 3)

    return relevant
  }

  estimateImpact(workflow: SimplifiedWorkflow): number {
    return Math.round(workflow.total_impact_eur * workflow.confidence)
  }

  listAll(): SimplifiedWorkflow[] {
    return Object.values(WORKFLOW_CATALOG)
  }
}

export const workflowSimplifier = new WorkflowSimplifier()
