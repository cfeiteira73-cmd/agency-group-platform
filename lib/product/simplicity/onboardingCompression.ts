// AGENCY GROUP — SH-ROS | AMI: 22506
// Product Simplicity Layer: Onboarding Compression Engine
// Gets any user to first value in ≤3 steps, regardless of role or org size
// Portugal context: 18% close rate, 210-day avg cycle, €320K avg deal, 5% commission

import logger from '@/lib/logger'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface OnboardingStep {
  step: number
  title: string
  description: string
  action_label: string
  action_type: 'setup' | 'import' | 'configure' | 'test' | 'activate'
  estimated_minutes: number
  skip_conditions: string[]
  completion_signal: string
}

export interface OnboardingFlow {
  flow_id: string
  role: string
  org_size: 'small' | 'medium' | 'large'
  steps: OnboardingStep[]   // MAX 3 steps
  time_to_value_minutes: number
  value_prop: string
}

// ─── Onboarding Flows ─────────────────────────────────────────────────────────

const ONBOARDING_FLOWS: Record<string, OnboardingFlow> = {
  agent_small: {
    flow_id: 'agent_small',
    role: 'agent',
    org_size: 'small',
    steps: [
      {
        step: 1,
        title: 'Import your active leads',
        description: 'Upload a CSV or connect your WhatsApp — your leads will be scored and prioritised automatically',
        action_label: 'Import Leads',
        action_type: 'import',
        estimated_minutes: 3,
        skip_conditions: ['leads_imported', 'crm_connected'],
        completion_signal: 'leads_count > 0',
      },
      {
        step: 2,
        title: 'Set your target this month',
        description: 'Enter your revenue goal in EUR — SH-ROS will reverse-engineer the daily actions needed to hit it',
        action_label: 'Set Target',
        action_type: 'configure',
        estimated_minutes: 1,
        skip_conditions: ['monthly_target_set'],
        completion_signal: 'monthly_target_eur > 0',
      },
      {
        step: 3,
        title: 'Activate your first automation',
        description: 'Turn on hot-lead instant alerts — get a WhatsApp ping the moment a lead scores 80+',
        action_label: 'Activate Alerts',
        action_type: 'activate',
        estimated_minutes: 1,
        skip_conditions: ['hot_lead_alerts_active'],
        completion_signal: 'automation_hot_lead_alert = true',
      },
    ],
    time_to_value_minutes: 5,
    value_prop: 'Never miss a hot lead again — get to first revenue action in 5 minutes',
  },
  agent_large: {
    flow_id: 'agent_large',
    role: 'agent',
    org_size: 'large',
    steps: [
      {
        step: 1,
        title: 'Sync your CRM pipeline',
        description: 'Connect Salesforce, HubSpot, or your existing CRM — your deals import in under 60 seconds',
        action_label: 'Connect CRM',
        action_type: 'setup',
        estimated_minutes: 5,
        skip_conditions: ['crm_connected'],
        completion_signal: 'crm_sync_status = active',
      },
      {
        step: 2,
        title: 'Claim your territory',
        description: 'Select your primary zones (e.g. Cascais, Sintra) so AI matching shows you relevant deals',
        action_label: 'Set Territory',
        action_type: 'configure',
        estimated_minutes: 2,
        skip_conditions: ['territory_configured'],
        completion_signal: 'territory_zones.length > 0',
      },
      {
        step: 3,
        title: 'Run your first AI pipeline review',
        description: 'See which of your existing deals are at risk and which are closest to closing',
        action_label: 'Run Review',
        action_type: 'test',
        estimated_minutes: 2,
        skip_conditions: [],
        completion_signal: 'first_pipeline_review_completed = true',
      },
    ],
    time_to_value_minutes: 9,
    value_prop: 'Get AI-powered pipeline intelligence on your existing deals in under 10 minutes',
  },
  broker_small: {
    flow_id: 'broker_small',
    role: 'broker',
    org_size: 'small',
    steps: [
      {
        step: 1,
        title: 'Add your agents',
        description: 'Invite your team — each agent gets a personalised dashboard and lead assignment queue',
        action_label: 'Invite Team',
        action_type: 'setup',
        estimated_minutes: 3,
        skip_conditions: ['agents_invited'],
        completion_signal: 'team_size > 1',
      },
      {
        step: 2,
        title: 'Import your active listings',
        description: 'Upload your property portfolio — SH-ROS will auto-match listings to buyers in your pipeline',
        action_label: 'Import Listings',
        action_type: 'import',
        estimated_minutes: 5,
        skip_conditions: ['listings_imported'],
        completion_signal: 'listings_count > 0',
      },
      {
        step: 3,
        title: 'Set team revenue targets',
        description: 'Define monthly targets per agent — the system tracks progress and flags at-risk targets weekly',
        action_label: 'Set Targets',
        action_type: 'configure',
        estimated_minutes: 3,
        skip_conditions: ['team_targets_set'],
        completion_signal: 'team_targets_configured = true',
      },
    ],
    time_to_value_minutes: 11,
    value_prop: 'Full team pipeline visibility and AI-driven lead assignment in under 15 minutes',
  },
  broker_large: {
    flow_id: 'broker_large',
    role: 'broker',
    org_size: 'large',
    steps: [
      {
        step: 1,
        title: 'Connect your data sources',
        description: 'Integrate your CRM, property portals (idealista, Imovirtual), and WhatsApp Business',
        action_label: 'Connect Sources',
        action_type: 'setup',
        estimated_minutes: 10,
        skip_conditions: ['data_sources_connected'],
        completion_signal: 'integration_count >= 2',
      },
      {
        step: 2,
        title: 'Configure lead routing rules',
        description: 'Set how leads are auto-assigned — by zone, budget range, language, or agent specialty',
        action_label: 'Configure Routing',
        action_type: 'configure',
        estimated_minutes: 5,
        skip_conditions: ['routing_rules_configured'],
        completion_signal: 'routing_rules.length > 0',
      },
      {
        step: 3,
        title: 'Launch your first automated campaign',
        description: 'Select a lead segment and activate the AI re-engagement sequence',
        action_label: 'Launch Campaign',
        action_type: 'activate',
        estimated_minutes: 5,
        skip_conditions: [],
        completion_signal: 'first_campaign_launched = true',
      },
    ],
    time_to_value_minutes: 20,
    value_prop: 'Enterprise-grade lead automation and pipeline intelligence, live in 20 minutes',
  },
  executive_small: {
    flow_id: 'executive_small',
    role: 'executive',
    org_size: 'small',
    steps: [
      {
        step: 1,
        title: 'Connect your pipeline data',
        description: 'Link your CRM or import a pipeline snapshot — your command centre populates instantly',
        action_label: 'Connect Pipeline',
        action_type: 'setup',
        estimated_minutes: 5,
        skip_conditions: ['pipeline_connected'],
        completion_signal: 'pipeline_value_eur > 0',
      },
      {
        step: 2,
        title: 'Set your annual revenue target',
        description: 'Enter your target — SH-ROS builds a monthly breakdown and tracks you against it daily',
        action_label: 'Set Target',
        action_type: 'configure',
        estimated_minutes: 2,
        skip_conditions: ['annual_target_set'],
        completion_signal: 'annual_target_eur > 0',
      },
      {
        step: 3,
        title: 'Schedule your daily digest',
        description: 'Choose what time you receive your AI-generated revenue briefing each morning',
        action_label: 'Schedule Digest',
        action_type: 'configure',
        estimated_minutes: 1,
        skip_conditions: ['digest_scheduled'],
        completion_signal: 'digest_time_set = true',
      },
    ],
    time_to_value_minutes: 8,
    value_prop: 'Full revenue command centre with daily AI briefings — operational in 8 minutes',
  },
  executive_large: {
    flow_id: 'executive_large',
    role: 'executive',
    org_size: 'large',
    steps: [
      {
        step: 1,
        title: 'Integrate all data systems',
        description: 'Connect CRM, accounting, marketing, and property portals via the one-click integration hub',
        action_label: 'Open Integration Hub',
        action_type: 'setup',
        estimated_minutes: 15,
        skip_conditions: ['enterprise_integrations_connected'],
        completion_signal: 'integration_count >= 4',
      },
      {
        step: 2,
        title: 'Configure KPI thresholds and alerts',
        description: 'Define your red/amber/green thresholds for pipeline health, conversion rate, and revenue',
        action_label: 'Set KPI Thresholds',
        action_type: 'configure',
        estimated_minutes: 10,
        skip_conditions: ['kpi_thresholds_set'],
        completion_signal: 'kpi_config_complete = true',
      },
      {
        step: 3,
        title: 'Activate investor-grade reporting',
        description: 'Turn on automated monthly reports — PDF + data export sent to your investor list',
        action_label: 'Activate Reporting',
        action_type: 'activate',
        estimated_minutes: 5,
        skip_conditions: ['investor_reporting_active'],
        completion_signal: 'investor_report_template_set = true',
      },
    ],
    time_to_value_minutes: 30,
    value_prop: 'Board-ready revenue intelligence with automated investor reporting — live in 30 minutes',
  },
}

// ─── Class ────────────────────────────────────────────────────────────────────

class OnboardingCompressionEngine {
  getFlow(role: string, orgSize: 'small' | 'medium' | 'large'): OnboardingFlow {
    // Treat 'medium' as 'large' for flow selection
    const size = orgSize === 'medium' ? 'large' : orgSize
    const key = `${role}_${size}`
    const flow = ONBOARDING_FLOWS[key]

    if (!flow) {
      logger.warn('[OnboardingCompression] getFlow — unknown key, falling back to agent_small', {
        role,
        org_size: orgSize,
        key,
      })
      return ONBOARDING_FLOWS['agent_small']
    }

    logger.info('[OnboardingCompression] getFlow', { flow_id: flow.flow_id, time_to_value: flow.time_to_value_minutes })
    return flow
  }

  getApplicableSkipConditions(orgId: string): string[] {
    // In production, query Supabase for org configuration state
    // Returns known-complete setup signals so steps can be skipped
    logger.info('[OnboardingCompression] getApplicableSkipConditions', { org_id: orgId })
    return []
  }

  getTimeToValue(role: string): number {
    const small = ONBOARDING_FLOWS[`${role}_small`]
    return small?.time_to_value_minutes ?? 10
  }

  getCompletionRate(orgId: string): number {
    // In production, derive from completed_steps / total_steps in Supabase
    logger.info('[OnboardingCompression] getCompletionRate', { org_id: orgId })
    return 0
  }
}

export const onboardingCompressionEngine = new OnboardingCompressionEngine()
