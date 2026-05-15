// AGENCY GROUP — SH-ROS | AMI: 22506
import { logger } from '@/lib/observability/logger'

export interface WorkflowTemplate {
  template_id: string
  name: string
  description: string
  category:
    | 'lead_nurture'
    | 'deal_progression'
    | 'reporting'
    | 'onboarding'
    | 'compliance'
    | 'communication'
  trigger: string
  steps: Array<{
    step: number
    action: string
    condition?: string
    delay_hours?: number
  }>
  variables: Record<string, string>
  estimated_impact: string
  tested: boolean
  version: string
  tags: string[]
}

export interface TemplateDeployment {
  deployment_id: string
  org_id: string
  template_id: string
  customizations: Record<string, unknown>
  deployed_at: Date
  status: 'active' | 'paused' | 'archived'
}

export const TEMPLATE_LIBRARY: WorkflowTemplate[] = [
  {
    template_id: 'tpl_hot_lead_escalation',
    name: 'Hot Lead Escalation',
    description: 'Instantly escalates high-intent leads to senior agents with SMS + email alert.',
    category: 'lead_nurture',
    trigger: 'lead_score_above_threshold',
    steps: [
      { step: 1, action: 'send_email_to_lead', condition: 'lead.email_valid == true' },
      { step: 2, action: 'send_sms_to_lead', condition: 'lead.phone_valid == true', delay_hours: 0 },
      { step: 3, action: 'notify_senior_agent', delay_hours: 0 },
      { step: 4, action: 'create_crm_task', condition: 'task_not_exists', delay_hours: 1 },
      { step: 5, action: 'schedule_followup_call', delay_hours: 24, condition: 'no_response' },
    ],
    variables: {
      LEAD_SCORE_THRESHOLD: 'Minimum score to trigger escalation (default: 75)',
      SENIOR_AGENT_EMAIL: 'Email address of senior agent to notify',
      RESPONSE_WINDOW_HOURS: 'Hours to wait before follow-up (default: 24)',
    },
    estimated_impact: 'Reduces lead response time from 4h to <15min; +22% contact rate',
    tested: true,
    version: '2.1.0',
    tags: ['lead', 'escalation', 'hot-lead', 'sms', 'email'],
  },
  {
    template_id: 'tpl_deal_pack_sequence',
    name: 'Deal Pack Sequence',
    description: 'Automates delivery of property documentation pack and follow-up after viewing.',
    category: 'deal_progression',
    trigger: 'viewing_completed',
    steps: [
      { step: 1, action: 'send_deal_pack_email', delay_hours: 1 },
      { step: 2, action: 'log_viewing_outcome_crm', delay_hours: 0 },
      { step: 3, action: 'send_feedback_request', delay_hours: 24 },
      { step: 4, action: 'analyze_feedback_ai', condition: 'feedback_received', delay_hours: 25 },
      { step: 5, action: 'send_offer_invitation', condition: 'feedback_positive', delay_hours: 48 },
      { step: 6, action: 'move_to_negotiation_stage', condition: 'offer_received', delay_hours: 0 },
    ],
    variables: {
      DEAL_PACK_TEMPLATE_ID: 'Email template ID for deal pack',
      FEEDBACK_FORM_URL: 'URL of the viewing feedback form',
      POSITIVE_FEEDBACK_THRESHOLD: 'Feedback score to trigger offer invitation (default: 7)',
    },
    estimated_impact: 'Increases offer rate post-viewing by 31%; reduces time-to-offer by 18 days',
    tested: true,
    version: '1.4.0',
    tags: ['deal', 'viewing', 'documentation', 'offer'],
  },
  {
    template_id: 'tpl_weekly_pipeline_review',
    name: 'Weekly Pipeline Review Report',
    description: 'Generates and distributes automated weekly pipeline health report to management.',
    category: 'reporting',
    trigger: 'cron_weekly_monday_08h00',
    steps: [
      { step: 1, action: 'aggregate_pipeline_data' },
      { step: 2, action: 'calculate_kpis' },
      { step: 3, action: 'generate_pdf_report' },
      { step: 4, action: 'send_report_email_management' },
      { step: 5, action: 'post_summary_slack', condition: 'slack_integration_active' },
    ],
    variables: {
      REPORT_RECIPIENTS: 'Comma-separated list of manager emails',
      KPI_TARGETS: 'JSON object of KPI targets for delta comparison',
      SLACK_CHANNEL: 'Slack channel ID for summary post',
    },
    estimated_impact: 'Saves 3h/week of manual reporting; improves manager visibility',
    tested: true,
    version: '1.2.0',
    tags: ['reporting', 'pipeline', 'management', 'weekly', 'kpi'],
  },
  {
    template_id: 'tpl_stale_lead_recovery',
    name: 'Stale Lead Recovery',
    description: 'Re-engages leads inactive for 30+ days with personalised content sequence.',
    category: 'lead_nurture',
    trigger: 'lead_inactive_30_days',
    steps: [
      { step: 1, action: 'send_market_update_email' },
      { step: 2, action: 'send_new_listings_digest', delay_hours: 72 },
      { step: 3, action: 'send_price_drop_alert', condition: 'matching_listings_with_price_drop', delay_hours: 120 },
      { step: 4, action: 'assign_reactivation_task_agent', delay_hours: 168, condition: 'no_engagement' },
      { step: 5, action: 'mark_lead_cold', condition: 'no_engagement_14_days', delay_hours: 504 },
    ],
    variables: {
      INACTIVITY_DAYS: 'Days of inactivity before trigger (default: 30)',
      REACTIVATION_AGENT_ID: 'Agent ID assigned for manual outreach',
    },
    estimated_impact: 'Recovers 12-18% of stale leads; reduces lead decay rate by 25%',
    tested: true,
    version: '1.0.0',
    tags: ['lead', 'reactivation', 'nurture', 'stale'],
  },
  {
    template_id: 'tpl_new_listing_broadcast',
    name: 'New Listing Broadcast',
    description: 'Instantly notifies matched buyer segments when a new property is listed.',
    category: 'communication',
    trigger: 'new_listing_published',
    steps: [
      { step: 1, action: 'run_buyer_match_algorithm' },
      { step: 2, action: 'segment_matched_buyers' },
      { step: 3, action: 'send_listing_alert_email', condition: 'match_score_above_60' },
      { step: 4, action: 'send_whatsapp_alert', condition: 'whatsapp_opt_in == true', delay_hours: 0 },
      { step: 5, action: 'create_showing_opportunity_task', delay_hours: 24 },
    ],
    variables: {
      MATCH_SCORE_THRESHOLD: 'Minimum buyer match score (default: 60)',
      WHATSAPP_TEMPLATE_ID: 'Approved WhatsApp template ID',
    },
    estimated_impact: 'First showing booked within 48h for 68% of new listings',
    tested: true,
    version: '2.0.0',
    tags: ['listing', 'broadcast', 'buyer-match', 'whatsapp', 'email'],
  },
  {
    template_id: 'tpl_cpcv_followup',
    name: 'CPCV & Escritura Follow-up',
    description: 'Manages post-CPCV milestones: deadlines, document collection, bank coordination.',
    category: 'compliance',
    trigger: 'cpcv_signed',
    steps: [
      { step: 1, action: 'create_escritura_deadline_task' },
      { step: 2, action: 'send_document_checklist_buyer', delay_hours: 2 },
      { step: 3, action: 'send_document_checklist_seller', delay_hours: 2 },
      { step: 4, action: 'schedule_bank_coordinator_call', delay_hours: 24, condition: 'mortgage_required' },
      { step: 5, action: 'send_30day_reminder', delay_hours: 720 },
      { step: 6, action: 'send_7day_reminder', delay_hours: 1128 },
      { step: 7, action: 'trigger_escritura_prep_checklist', delay_hours: 1152 },
    ],
    variables: {
      ESCRITURA_DEADLINE_DAYS: 'Days from CPCV to Escritura (default: 60)',
      NOTARIO_CONTACT: 'Notary contact details',
    },
    estimated_impact: 'Reduces failed escrituras by 89%; ensures 100% document compliance',
    tested: true,
    version: '1.3.0',
    tags: ['cpcv', 'escritura', 'compliance', 'legal', 'documents'],
  },
  {
    template_id: 'tpl_investor_alert',
    name: 'Investor Opportunity Alert',
    description: 'Alerts investor database with tailored opportunity summaries matching their criteria.',
    category: 'communication',
    trigger: 'investment_property_listed',
    steps: [
      { step: 1, action: 'score_investment_opportunity' },
      { step: 2, action: 'match_investors_by_criteria' },
      { step: 3, action: 'generate_investment_summary_ai' },
      { step: 4, action: 'send_investor_teaser_email', condition: 'matched_investors_count > 0' },
      { step: 5, action: 'log_investor_engagement' },
      { step: 6, action: 'schedule_investor_call', condition: 'investor_clicked', delay_hours: 4 },
    ],
    variables: {
      MIN_YIELD_THRESHOLD: 'Minimum gross yield to qualify (default: 5.5%)',
      INVESTOR_SEGMENT: 'Investor segment tag filter',
    },
    estimated_impact: 'Reduces time-to-investor-contact from 5 days to 4 hours',
    tested: true,
    version: '1.1.0',
    tags: ['investor', 'alert', 'yield', 'investment'],
  },
  {
    template_id: 'tpl_market_report',
    name: 'Monthly Market Intelligence Report',
    description: 'Generates branded market report for clients with AVM data, transaction volume, trends.',
    category: 'reporting',
    trigger: 'cron_monthly_1st_09h00',
    steps: [
      { step: 1, action: 'fetch_market_transaction_data' },
      { step: 2, action: 'run_avm_price_analysis' },
      { step: 3, action: 'generate_market_commentary_ai' },
      { step: 4, action: 'render_branded_pdf_report' },
      { step: 5, action: 'send_report_to_active_clients' },
      { step: 6, action: 'post_report_to_portal' },
    ],
    variables: {
      REPORT_ZONES: 'Comma-separated zone codes to include',
      CLIENT_SEGMENT: 'Client segment filter for distribution',
      BRAND_COLOR: 'Hex color for report branding',
    },
    estimated_impact: 'Increases client engagement score by 34%; supports premium positioning',
    tested: true,
    version: '1.0.0',
    tags: ['market-report', 'avm', 'monthly', 'clients', 'branding'],
  },
]

class WorkflowTemplateManager {
  private deployments: Map<string, TemplateDeployment[]> = new Map()

  getTemplates(category?: WorkflowTemplate['category']): WorkflowTemplate[] {
    if (!category) return TEMPLATE_LIBRARY
    return TEMPLATE_LIBRARY.filter((t) => t.category === category)
  }

  getTemplate(templateId: string): WorkflowTemplate | null {
    return TEMPLATE_LIBRARY.find((t) => t.template_id === templateId) ?? null
  }

  deploy(
    orgId: string,
    templateId: string,
    customizations: Record<string, unknown> = {}
  ): TemplateDeployment {
    const template = this.getTemplate(templateId)
    if (!template) {
      throw new Error(`[WorkflowTemplateManager] template not found: ${templateId}`)
    }

    const deploymentId = `dep_${orgId}_${templateId}_${Date.now()}`
    const deployment: TemplateDeployment = {
      deployment_id: deploymentId,
      org_id: orgId,
      template_id: templateId,
      customizations,
      deployed_at: new Date(),
      status: 'active',
    }

    const existing = this.deployments.get(orgId) ?? []
    existing.push(deployment)
    this.deployments.set(orgId, existing)

    logger.info('[WorkflowTemplateManager] template deployed', {
      orgId,
      templateId,
      deploymentId,
    })

    return deployment
  }

  pause(deploymentId: string): boolean {
    for (const [orgId, deps] of this.deployments.entries()) {
      const dep = deps.find((d) => d.deployment_id === deploymentId)
      if (dep) {
        dep.status = 'paused'
        this.deployments.set(orgId, deps)
        logger.info('[WorkflowTemplateManager] deployment paused', { deploymentId })
        return true
      }
    }
    logger.warn('[WorkflowTemplateManager] pause: deployment not found', { deploymentId })
    return false
  }

  archive(deploymentId: string): boolean {
    for (const [orgId, deps] of this.deployments.entries()) {
      const dep = deps.find((d) => d.deployment_id === deploymentId)
      if (dep) {
        dep.status = 'archived'
        this.deployments.set(orgId, deps)
        logger.info('[WorkflowTemplateManager] deployment archived', { deploymentId })
        return true
      }
    }
    logger.warn('[WorkflowTemplateManager] archive: deployment not found', { deploymentId })
    return false
  }

  getOrgDeployments(orgId: string): TemplateDeployment[] {
    return this.deployments.get(orgId) ?? []
  }

  search(query: string): WorkflowTemplate[] {
    const q = query.toLowerCase()
    return TEMPLATE_LIBRARY.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q)) ||
        t.category.toLowerCase().includes(q)
    )
  }
}

export const workflowTemplateManager = new WorkflowTemplateManager()
export default workflowTemplateManager
