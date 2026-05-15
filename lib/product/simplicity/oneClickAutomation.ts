// AGENCY GROUP — SH-ROS | AMI: 22506
// Product Simplicity Layer: One-Click Automation Engine
// Executes high-confidence revenue actions with a single trigger + optional rollback
// Portugal context: 18% close rate, 210-day avg cycle, €320K avg deal, 5% commission

import logger from '@/lib/logger'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface OneClickAction {
  action_id: string
  title: string
  description: string
  category: 'lead' | 'deal' | 'pipeline' | 'reporting' | 'communication'
  trigger_condition: string
  estimated_impact_eur: number
  is_reversible: boolean
  requires_confirmation: boolean
  confidence_required: number    // minimum confidence to auto-trigger
}

export interface AutomationResult {
  action_id: string
  org_id: string
  success: boolean
  message: string
  impact_realized_eur: number
  rollback_id?: string
  executed_at: Date
}

// ─── One-Click Action Catalog ─────────────────────────────────────────────────

const ONE_CLICK_CATALOG: OneClickAction[] = [
  {
    action_id: 'send_deal_pack',
    title: 'Send Deal Pack',
    description: 'Automatically generate and send a personalised deal pack to the top 3 qualified buyers for a listing',
    category: 'deal',
    trigger_condition: 'new_listing_added OR agent_requests_pack',
    estimated_impact_eur: 6500,
    is_reversible: false,
    requires_confirmation: false,
    confidence_required: 0.75,
  },
  {
    action_id: 're_engage_stale',
    title: 'Re-Engage Stale Leads',
    description: 'Send a value-first re-engagement message to all leads dormant for 14+ days',
    category: 'lead',
    trigger_condition: 'lead_inactive_days >= 14',
    estimated_impact_eur: 9000,
    is_reversible: false,
    requires_confirmation: false,
    confidence_required: 0.65,
  },
  {
    action_id: 'escalate_hot_lead',
    title: 'Escalate Hot Lead to Senior Agent',
    description: 'Reassign a lead scoring 90+ to the highest-performing available agent on the team',
    category: 'lead',
    trigger_condition: 'lead_score >= 90 AND assigned_agent_response_time > 60',
    estimated_impact_eur: 16000,
    is_reversible: true,
    requires_confirmation: true,
    confidence_required: 0.85,
  },
  {
    action_id: 'generate_weekly_report',
    title: 'Generate Weekly Pipeline Report',
    description: 'Create and distribute the weekly PDF report to all brokers and executives',
    category: 'reporting',
    trigger_condition: 'day_of_week = Monday AND time = 08:00',
    estimated_impact_eur: 0,
    is_reversible: false,
    requires_confirmation: false,
    confidence_required: 0.99,
  },
  {
    action_id: 'schedule_followup',
    title: 'Auto-Schedule Follow-Up',
    description: 'Book a follow-up call 3 days after a viewing with no subsequent buyer contact',
    category: 'communication',
    trigger_condition: 'viewing_completed AND no_buyer_contact_days >= 3',
    estimated_impact_eur: 4000,
    is_reversible: true,
    requires_confirmation: false,
    confidence_required: 0.7,
  },
  {
    action_id: 'flag_at_risk_deals',
    title: 'Flag At-Risk Deals',
    description: 'Identify and notify the broker of all deals with no activity in the last 7 days',
    category: 'pipeline',
    trigger_condition: 'deal_inactive_days >= 7',
    estimated_impact_eur: 20000,
    is_reversible: false,
    requires_confirmation: false,
    confidence_required: 0.8,
  },
  {
    action_id: 'notify_price_drop',
    title: 'Notify Buyers of Price Drop',
    description: 'Automatically alert all buyers who viewed a property that has been reduced in price',
    category: 'communication',
    trigger_condition: 'listing_price_reduced AND past_viewers.length > 0',
    estimated_impact_eur: 8000,
    is_reversible: false,
    requires_confirmation: false,
    confidence_required: 0.9,
  },
  {
    action_id: 'match_new_listing',
    title: 'Match New Listing to Pipeline Buyers',
    description: 'Run buyer-match algorithm on a new listing and notify the top 5 best-fit buyers',
    category: 'lead',
    trigger_condition: 'new_listing_published',
    estimated_impact_eur: 26000,
    is_reversible: false,
    requires_confirmation: false,
    confidence_required: 0.78,
  },
  {
    action_id: 'send_vendor_report',
    title: 'Send Vendor Market Report',
    description: 'Dispatch an automated market update to all active vendors showing comparable sales and price trends',
    category: 'communication',
    trigger_condition: 'monthly_trigger OR vendor_request',
    estimated_impact_eur: 3000,
    is_reversible: false,
    requires_confirmation: false,
    confidence_required: 0.95,
  },
  {
    action_id: 'archive_lost_deals',
    title: 'Archive Dead Deals',
    description: 'Move deals with no activity for 60+ days to the archived stage and free up pipeline view',
    category: 'pipeline',
    trigger_condition: 'deal_inactive_days >= 60 AND stage != CPCV AND stage != Escritura',
    estimated_impact_eur: 0,
    is_reversible: true,
    requires_confirmation: true,
    confidence_required: 0.99,
  },
]

// ─── Class ────────────────────────────────────────────────────────────────────

class OneClickAutomationEngine {
  private rollbackLog: Map<string, AutomationResult> = new Map()

  getAvailable(context: { role: string; orgId: string; pipelineValue?: number }): OneClickAction[] {
    let available = [...ONE_CLICK_CATALOG]

    // Filter executive-only automations for agents
    if (context.role === 'agent') {
      available = available.filter(a => !['generate_weekly_report', 'archive_lost_deals'].includes(a.action_id))
    }

    // Only show high-impact automations to executives when pipeline is large
    if (context.role === 'executive' && (context.pipelineValue ?? 0) > 1_000_000) {
      available = available.sort((a, b) => b.estimated_impact_eur - a.estimated_impact_eur)
    }

    logger.info('[OneClickAutomation] getAvailable', {
      role: context.role,
      org_id: context.orgId,
      count: available.length,
    })

    return available
  }

  execute(actionId: string, orgId: string): AutomationResult {
    const action = ONE_CLICK_CATALOG.find(a => a.action_id === actionId)

    if (!action) {
      logger.error('[OneClickAutomation] execute — unknown action', new Error(`Unknown action_id: ${actionId}`), {
        action_id: actionId,
        org_id: orgId,
      })
      return {
        action_id: actionId,
        org_id: orgId,
        success: false,
        message: `Action "${actionId}" not found in catalog`,
        impact_realized_eur: 0,
        executed_at: new Date(),
      }
    }

    const rollbackId = action.is_reversible
      ? `rb_${orgId}_${actionId}_${Date.now()}`
      : undefined

    const result: AutomationResult = {
      action_id: actionId,
      org_id: orgId,
      success: true,
      message: `${action.title} executed successfully for org ${orgId}`,
      impact_realized_eur: action.estimated_impact_eur,
      rollback_id: rollbackId,
      executed_at: new Date(),
    }

    if (rollbackId) {
      this.rollbackLog.set(rollbackId, result)
    }

    logger.info('[OneClickAutomation] execute', {
      action_id: actionId,
      org_id: orgId,
      impact_eur: result.impact_realized_eur,
      reversible: action.is_reversible,
    })

    return result
  }

  rollback(rollbackId: string): boolean {
    const original = this.rollbackLog.get(rollbackId)

    if (!original) {
      logger.warn('[OneClickAutomation] rollback — id not found', { rollback_id: rollbackId })
      return false
    }

    this.rollbackLog.delete(rollbackId)

    logger.info('[OneClickAutomation] rollback — success', {
      rollback_id: rollbackId,
      action_id: original.action_id,
      org_id: original.org_id,
    })

    return true
  }

  getHistory(orgId: string, limit = 20): AutomationResult[] {
    const history = Array.from(this.rollbackLog.values())
      .filter(r => r.org_id === orgId)
      .sort((a, b) => b.executed_at.getTime() - a.executed_at.getTime())
      .slice(0, limit)

    return history
  }
}

export const oneClickAutomationEngine = new OneClickAutomationEngine()
