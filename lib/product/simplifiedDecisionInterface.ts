// AGENCY GROUP — SH-ROS Product: Simplified Decision Interface | AMI: 22506
// Single entry point for all agent decisions — hides routing, scoring, ML complexity
// Agent says: "what should I do for org X?" → gets back a ranked action list
// =============================================================================

import { businessPrimitiveEngine }  from './businessPrimitiveEngine'
import { outcomeAbstractionLayer }  from './outcomeAbstractionLayer'
import logger from '@/lib/logger'
import { COMMISSION_RATE } from '@/lib/constants/pipeline'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AgentDecisionRequest {
  org_id:       string
  context_type: 'daily_review' | 'lead_followup' | 'deal_closing' | 'pipeline_health' | 'revenue_forecast'
  entity_id?:   string    // specific entity to decide for (optional)
  urgency?:     'now' | 'today' | 'this_week'
}

export interface AgentAction {
  action_id:     string
  priority:      1 | 2 | 3 | 4 | 5   // 1 = most urgent
  action_type:   'call' | 'email' | 'send_proposal' | 'schedule_viewing' | 'close_deal' | 'follow_up' | 'nurture'
  target_name:   string
  target_id:     string
  instruction:   string              // plain English instruction for the agent
  expected_outcome: string           // what success looks like
  time_estimate: string              // "5 min", "30 min", etc.
  revenue_impact: number             // estimated € impact if action succeeds
  due_by:        string | null
}

export interface DecisionPackage {
  org_id:         string
  context_type:   AgentDecisionRequest['context_type']
  generated_at:   string
  actions:        AgentAction[]
  summary:        string             // 1-sentence summary for agent
  top_priority:   AgentAction | null
  estimated_daily_revenue_impact: number
  pipeline_health: 'excellent' | 'good' | 'needs_attention' | 'critical'
}

export interface QuickDecision {
  entity_id:  string
  verdict:    'proceed' | 'hold' | 'drop'
  reason:     string
  confidence: number
  next_step:  string
}

// ─── Simplified Decision Interface ────────────────────────────────────────────

export class SimplifiedDecisionInterface {

  /**
   * Primary entry point — get ranked action list for an org.
   * Returns everything an agent needs to know, nothing it doesn't.
   */
  async getDecisions(request: AgentDecisionRequest): Promise<DecisionPackage> {
    const start = Date.now()

    const [pipeline, leads] = await Promise.all([
      businessPrimitiveEngine.getPipeline(request.org_id),
      businessPrimitiveEngine.getTopLeads(request.org_id, 10),
    ])

    const actions: AgentAction[] = []
    let action_counter = 1

    // ── Context-specific actions ──

    if (request.context_type === 'daily_review' || request.context_type === 'lead_followup') {
      // Hot leads first
      for (const lead of leads.slice(0, 5)) {
        if (lead.score >= 80) {
          actions.push({
            action_id:        `act:${action_counter++}`,
            priority:         1,
            action_type:      lead.stage === 'negotiation' ? 'close_deal' : 'call',
            target_name:      lead.name,
            target_id:        lead.contact_id,
            instruction:      `${lead.next_action} — ${lead.name} has score ${lead.score}/100`,
            expected_outcome: 'Progress to next pipeline stage',
            time_estimate:    '15 min',
            revenue_impact:   lead.expected_value * COMMISSION_RATE,
            due_by:           lead.next_action_due,
          })
        } else if (lead.score >= 60 && lead.days_in_stage > 7) {
          actions.push({
            action_id:        `act:${action_counter++}`,
            priority:         2,
            action_type:      'email',
            target_name:      lead.name,
            target_id:        lead.contact_id,
            instruction:      `Follow up with ${lead.name} — ${lead.days_in_stage} days in ${lead.stage}`,
            expected_outcome: 'Re-engage and schedule viewing',
            time_estimate:    '5 min',
            revenue_impact:   lead.expected_value * 0.02,
            due_by:           null,
          })
        }
      }

      // Stale high-value leads
      const stale = leads.filter(l => l.days_in_stage > 30 && l.expected_value > 1_000_000)
      for (const lead of stale.slice(0, 2)) {
        actions.push({
          action_id:        `act:${action_counter++}`,
          priority:         3,
          action_type:      'send_proposal',
          target_name:      lead.name,
          target_id:        lead.contact_id,
          instruction:      `Send fresh deal pack to ${lead.name} — stagnant ${lead.days_in_stage} days`,
          expected_outcome: 'Revive interest with new properties',
          time_estimate:    '20 min',
          revenue_impact:   lead.expected_value * 0.01,
          due_by:           null,
        })
      }
    }

    if (request.context_type === 'pipeline_health' || request.context_type === 'deal_closing') {
      // Deals close to conversion
      if (pipeline.proposals_pending > 0) {
        actions.push({
          action_id:        `act:${action_counter++}`,
          priority:         1,
          action_type:      'follow_up',
          target_name:      'Pending proposals',
          target_id:        'batch',
          instruction:      `Follow up on ${pipeline.proposals_pending} pending proposals — call, don't email`,
          expected_outcome: `Convert at least 1 proposal → deal (${pipeline.proposals_pending} open)`,
          time_estimate:    `${pipeline.proposals_pending * 10} min`,
          revenue_impact:   pipeline.expected_revenue * 0.1,
          due_by:           new Date(Date.now() + 86_400_000).toISOString(),
        })
      }
    }

    if (request.context_type === 'revenue_forecast') {
      const on_pace = pipeline.commission_mtd >= (pipeline.pipeline_value * COMMISSION_RATE * 0.3)
      if (!on_pace) {
        actions.push({
          action_id:        `act:${action_counter++}`,
          priority:         1,
          action_type:      'call',
          target_name:      'Top 3 hot leads',
          target_id:        'batch',
          instruction:      'Revenue behind pace — call top 3 hot leads today',
          expected_outcome: 'Accelerate at least 1 deal closure this month',
          time_estimate:    '45 min',
          revenue_impact:   320_000 * COMMISSION_RATE,  // avg deal commission
          due_by:           new Date(Date.now() + 4 * 3_600_000).toISOString(),  // 4h
        })
      }
    }

    // Sort by priority, then revenue impact
    actions.sort((a, b) => a.priority - b.priority || b.revenue_impact - a.revenue_impact)

    const top_priority = actions[0] ?? null
    const total_impact = actions.reduce((s, a) => s + a.revenue_impact, 0)

    const pipeline_health: DecisionPackage['pipeline_health'] =
      pipeline.hot_leads >= 5 && pipeline.deals_in_progress >= 3 ? 'excellent' :
      pipeline.hot_leads >= 2 && pipeline.deals_in_progress >= 1 ? 'good' :
      pipeline.hot_leads >= 1 ? 'needs_attention' : 'critical'

    const summary = this._buildSummary(pipeline, actions.length, pipeline_health)

    logger.info('[DecisionInterface] Package generated', {
      org_id:    request.org_id,
      context:   request.context_type,
      actions:   actions.length,
      top:       top_priority?.instruction,
      latency_ms: Date.now() - start,
    })

    return {
      org_id:                         request.org_id,
      context_type:                   request.context_type,
      generated_at:                   new Date().toISOString(),
      actions:                        actions.slice(0, 10),  // max 10 actions
      summary,
      top_priority,
      estimated_daily_revenue_impact: total_impact,
      pipeline_health,
    }
  }

  /**
   * Quick binary decision for a single entity.
   * "Should I pursue this lead / deal?"
   */
  quickDecide(params: {
    entity_id:   string
    score:       number
    days_active: number
    value:       number
    org_id:      string
  }): QuickDecision {
    const prediction = outcomeAbstractionLayer.predict({
      entity_id:    params.entity_id,
      entity_type:  'lead',
      org_id:       params.org_id,
      match_score:  params.score,
      deal_value:   params.value,
      days_in_stage: params.days_active,
    })

    let verdict: QuickDecision['verdict']
    if (prediction.close_probability >= 0.4) verdict = 'proceed'
    else if (prediction.close_probability >= 0.2) verdict = 'hold'
    else verdict = 'drop'

    return {
      entity_id:  params.entity_id,
      verdict,
      reason:     prediction.positive_factors[0] ?? prediction.risk_factors[0] ?? 'Based on match score',
      confidence: prediction.close_probability,
      next_step:  prediction.recommended_action,
    }
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  private _buildSummary(
    pipeline: Awaited<ReturnType<typeof businessPrimitiveEngine.getPipeline>>,
    action_count: number,
    health: DecisionPackage['pipeline_health']
  ): string {
    if (health === 'critical') {
      return `Pipeline critical — ${pipeline.hot_leads} hot leads, ${action_count} urgent actions needed`
    }
    if (health === 'excellent') {
      return `Strong pipeline — ${pipeline.hot_leads} hot leads, €${(pipeline.pipeline_value / 1000).toFixed(0)}K active`
    }
    return `${action_count} actions to take — focus on ${pipeline.proposals_pending} pending proposals`
  }
}

export const simplifiedDecisionInterface = new SimplifiedDecisionInterface()
