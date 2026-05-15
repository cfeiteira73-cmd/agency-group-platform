// AGENCY GROUP — SH-ROS | AMI: 22506

import { logger } from '@/lib/observability/logger'

export type PlanTier = 'starter' | 'pro' | 'elite' | 'institutional'

export interface PlanFeature {
  name: string
  included: boolean
  limit?: string
  description: string
}

export interface CommercialPlan {
  tier: PlanTier
  name: string
  tagline: string
  price_monthly_eur: number
  price_annual_eur: number   // monthly equivalent with ~17% discount
  max_agents: number
  max_workflows: number
  ai_executions_per_month: number
  support_level: 'community' | 'email' | 'priority' | 'dedicated'
  sla_uptime: string
  features: PlanFeature[]
  ideal_for: string
  conversion_guarantee: string
}

const STARTER_FEATURES: PlanFeature[] = [
  { name: 'AI Deal Pack Generation', included: true, limit: '50/mo', description: 'Automated deal summaries and packs for active leads' },
  { name: 'Lead Recovery Workflows', included: true, limit: '100 leads/mo', description: 'Re-engage stale leads with AI-generated messages' },
  { name: 'Pipeline Dashboard', included: true, description: 'Real-time pipeline health and stage analytics' },
  { name: 'Match Scoring', included: true, limit: 'Basic', description: 'AI-driven buyer-property matching score' },
  { name: 'Email Sequences', included: true, limit: '5 active', description: 'Automated follow-up email cadences' },
  { name: 'CRM Integration', included: true, limit: '1 CRM', description: 'Native sync with major CRM platforms' },
  { name: 'Economic Validation Reports', included: true, limit: 'Monthly', description: 'ROI and revenue impact reporting' },
  { name: 'Conversion Uplift Tracking', included: true, description: 'Track close rate improvement vs Portugal baseline' },
  { name: 'Multi-agent Workflows', included: false, description: 'Orchestrate multiple AI agents in parallel' },
  { name: 'White-label Branding', included: false, description: 'Remove SH-ROS branding from client outputs' },
  { name: 'API Access', included: false, description: 'REST API for custom integrations' },
  { name: 'Dedicated CSM', included: false, description: 'Assigned customer success manager' },
  { name: 'Custom AI Training', included: false, description: 'Fine-tune AI on your deal history' },
  { name: 'Advanced Analytics', included: false, description: 'Deep-dive attribution and predictive analytics' },
  { name: 'Webhook Notifications', included: true, limit: '5 hooks', description: 'Real-time event webhooks' },
  { name: 'Data Export', included: true, limit: 'CSV', description: 'Export pipeline and deal data' },
  { name: 'Portuguese Market Data', included: true, description: 'AMI 22506 certified Portugal market benchmarks' },
  { name: 'SH-ROS Mobile App', included: true, description: 'iOS/Android access to pipeline and alerts' },
  { name: 'Team Members', included: true, limit: '3 seats', description: 'Collaborator access to the platform' },
  { name: 'Audit Log', included: false, description: 'Full action history and compliance audit trail' },
  { name: 'SOC 2 Reports', included: false, description: 'Security compliance documentation' },
  { name: 'Priority Escalation AI', included: false, description: 'Automatic deal prioritization with reasoning' },
]

const PRO_FEATURES: PlanFeature[] = [
  { name: 'AI Deal Pack Generation', included: true, limit: '500/mo', description: 'Automated deal summaries and packs for active leads' },
  { name: 'Lead Recovery Workflows', included: true, limit: 'Unlimited', description: 'Re-engage stale leads with AI-generated messages' },
  { name: 'Pipeline Dashboard', included: true, description: 'Real-time pipeline health and stage analytics' },
  { name: 'Match Scoring', included: true, limit: 'Advanced', description: 'AI-driven buyer-property matching score with explanations' },
  { name: 'Email Sequences', included: true, limit: '50 active', description: 'Automated follow-up email cadences' },
  { name: 'CRM Integration', included: true, limit: '3 CRMs', description: 'Native sync with major CRM platforms' },
  { name: 'Economic Validation Reports', included: true, limit: 'Weekly', description: 'ROI and revenue impact reporting' },
  { name: 'Conversion Uplift Tracking', included: true, description: 'Track close rate improvement vs Portugal baseline' },
  { name: 'Multi-agent Workflows', included: true, limit: '10 agents', description: 'Orchestrate multiple AI agents in parallel' },
  { name: 'White-label Branding', included: false, description: 'Remove SH-ROS branding from client outputs' },
  { name: 'API Access', included: true, limit: '10K calls/mo', description: 'REST API for custom integrations' },
  { name: 'Dedicated CSM', included: false, description: 'Assigned customer success manager' },
  { name: 'Custom AI Training', included: false, description: 'Fine-tune AI on your deal history' },
  { name: 'Advanced Analytics', included: true, description: 'Deep-dive attribution and predictive analytics' },
  { name: 'Webhook Notifications', included: true, limit: 'Unlimited', description: 'Real-time event webhooks' },
  { name: 'Data Export', included: true, limit: 'CSV + JSON', description: 'Export pipeline and deal data' },
  { name: 'Portuguese Market Data', included: true, description: 'AMI 22506 certified Portugal market benchmarks' },
  { name: 'SH-ROS Mobile App', included: true, description: 'iOS/Android access to pipeline and alerts' },
  { name: 'Team Members', included: true, limit: '15 seats', description: 'Collaborator access to the platform' },
  { name: 'Audit Log', included: true, limit: '90 days', description: 'Full action history and compliance audit trail' },
  { name: 'SOC 2 Reports', included: false, description: 'Security compliance documentation' },
  { name: 'Priority Escalation AI', included: true, description: 'Automatic deal prioritization with reasoning' },
]

const ELITE_FEATURES: PlanFeature[] = [
  { name: 'AI Deal Pack Generation', included: true, limit: 'Unlimited', description: 'Automated deal summaries and packs for active leads' },
  { name: 'Lead Recovery Workflows', included: true, limit: 'Unlimited', description: 'Re-engage stale leads with AI-generated messages' },
  { name: 'Pipeline Dashboard', included: true, description: 'Real-time pipeline health and stage analytics' },
  { name: 'Match Scoring', included: true, limit: 'Full AI suite', description: 'AI-driven buyer-property matching with vector search' },
  { name: 'Email Sequences', included: true, limit: 'Unlimited', description: 'Automated follow-up email cadences' },
  { name: 'CRM Integration', included: true, limit: 'Unlimited', description: 'Native sync with all major CRM platforms' },
  { name: 'Economic Validation Reports', included: true, limit: 'Real-time', description: 'Live ROI and revenue impact dashboard' },
  { name: 'Conversion Uplift Tracking', included: true, description: 'Track close rate improvement vs Portugal baseline' },
  { name: 'Multi-agent Workflows', included: true, limit: '25 agents', description: 'Orchestrate multiple AI agents in parallel' },
  { name: 'White-label Branding', included: true, description: 'Remove SH-ROS branding from client outputs' },
  { name: 'API Access', included: true, limit: 'Unlimited', description: 'REST API for custom integrations' },
  { name: 'Dedicated CSM', included: true, description: 'Assigned customer success manager' },
  { name: 'Custom AI Training', included: true, limit: 'Annual refresh', description: 'Fine-tune AI on your deal history' },
  { name: 'Advanced Analytics', included: true, description: 'Deep-dive attribution and predictive analytics' },
  { name: 'Webhook Notifications', included: true, limit: 'Unlimited', description: 'Real-time event webhooks' },
  { name: 'Data Export', included: true, limit: 'All formats', description: 'Export pipeline and deal data in any format' },
  { name: 'Portuguese Market Data', included: true, description: 'AMI 22506 certified Portugal market benchmarks' },
  { name: 'SH-ROS Mobile App', included: true, description: 'iOS/Android access to pipeline and alerts' },
  { name: 'Team Members', included: true, limit: 'Unlimited', description: 'Full team access with role-based permissions' },
  { name: 'Audit Log', included: true, limit: '1 year', description: 'Full action history and compliance audit trail' },
  { name: 'SOC 2 Reports', included: true, description: 'Security compliance documentation on request' },
  { name: 'Priority Escalation AI', included: true, description: 'Automatic deal prioritization with reasoning' },
]

const INSTITUTIONAL_FEATURES: PlanFeature[] = [
  { name: 'AI Deal Pack Generation', included: true, limit: 'Unlimited', description: 'Automated deal summaries and packs for active leads' },
  { name: 'Lead Recovery Workflows', included: true, limit: 'Unlimited', description: 'Re-engage stale leads with AI-generated messages' },
  { name: 'Pipeline Dashboard', included: true, description: 'Real-time pipeline health and stage analytics' },
  { name: 'Match Scoring', included: true, limit: 'Custom models', description: 'Bespoke AI models trained on your portfolio data' },
  { name: 'Email Sequences', included: true, limit: 'Unlimited', description: 'Automated follow-up email cadences' },
  { name: 'CRM Integration', included: true, limit: 'Custom', description: 'Custom CRM integration and data pipeline' },
  { name: 'Economic Validation Reports', included: true, limit: 'Board-ready', description: 'Institutional-grade ROI reporting for investors' },
  { name: 'Conversion Uplift Tracking', included: true, description: 'Track close rate improvement vs Portugal baseline' },
  { name: 'Multi-agent Workflows', included: true, limit: 'Unlimited', description: 'Unlimited AI agent orchestration' },
  { name: 'White-label Branding', included: true, description: 'Full white-label with custom domain' },
  { name: 'API Access', included: true, limit: 'Unlimited + SLA', description: 'Enterprise REST API with guaranteed SLA' },
  { name: 'Dedicated CSM', included: true, limit: 'Dedicated engineer', description: 'Dedicated solutions engineer + CSM' },
  { name: 'Custom AI Training', included: true, limit: 'Continuous', description: 'Ongoing model fine-tuning on your data' },
  { name: 'Advanced Analytics', included: true, description: 'Deep-dive attribution and predictive analytics' },
  { name: 'Webhook Notifications', included: true, limit: 'Unlimited', description: 'Real-time event webhooks' },
  { name: 'Data Export', included: true, limit: 'All formats + streaming', description: 'Export and stream data in any format' },
  { name: 'Portuguese Market Data', included: true, description: 'AMI 22506 certified Portugal market benchmarks' },
  { name: 'SH-ROS Mobile App', included: true, description: 'iOS/Android access to pipeline and alerts' },
  { name: 'Team Members', included: true, limit: 'Unlimited', description: 'Full team access with custom roles' },
  { name: 'Audit Log', included: true, limit: 'Unlimited', description: 'Full immutable audit trail for compliance' },
  { name: 'SOC 2 Reports', included: true, description: 'Full SOC 2 Type II compliance and reporting' },
  { name: 'Priority Escalation AI', included: true, description: 'Custom escalation rules and AI reasoning' },
]

export const PLANS: Record<PlanTier, CommercialPlan> = {
  starter: {
    tier: 'starter',
    name: 'Starter',
    tagline: 'Launch AI-powered deal operations',
    price_monthly_eur: 400,
    price_annual_eur: 332,  // ~17% discount
    max_agents: 1,
    max_workflows: 5,
    ai_executions_per_month: 500,
    support_level: 'email',
    sla_uptime: '99.5%',
    features: STARTER_FEATURES,
    ideal_for: 'Independent agents and small teams (1-2 agents) beginning AI-assisted deal flow',
    conversion_guarantee: '30-day ROI guarantee or full refund',
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    tagline: 'Scale your pipeline with full AI orchestration',
    price_monthly_eur: 1_800,
    price_annual_eur: 1_494,
    max_agents: 10,
    max_workflows: 25,
    ai_executions_per_month: 5_000,
    support_level: 'priority',
    sla_uptime: '99.9%',
    features: PRO_FEATURES,
    ideal_for: 'Growing boutique agencies (3-10 agents) scaling deal flow and automation',
    conversion_guarantee: '30-day ROI guarantee — close more or we extend free',
  },
  elite: {
    tier: 'elite',
    name: 'Elite',
    tagline: 'Enterprise-grade AI for high-volume operations',
    price_monthly_eur: 4_500,
    price_annual_eur: 3_735,
    max_agents: 25,
    max_workflows: Infinity,
    ai_executions_per_month: 25_000,
    support_level: 'dedicated',
    sla_uptime: '99.95%',
    features: ELITE_FEATURES,
    ideal_for: 'Large agencies and multi-office operations (10-25 agents) requiring white-label and custom AI',
    conversion_guarantee: 'Guaranteed 15% conversion uplift in 90 days or 2 months free',
  },
  institutional: {
    tier: 'institutional',
    name: 'Institutional',
    tagline: 'Bespoke AI operating system for enterprise portfolios',
    price_monthly_eur: 9_000,
    price_annual_eur: 7_200,  // negotiated custom annual
    max_agents: Infinity,
    max_workflows: Infinity,
    ai_executions_per_month: Infinity,
    support_level: 'dedicated',
    sla_uptime: '99.99%',
    features: INSTITUTIONAL_FEATURES,
    ideal_for: 'Real estate groups, family offices, and institutional investors managing €50M+ portfolios',
    conversion_guarantee: 'Custom SLA with financial penalties for missed KPIs',
  },
}

export class PackagingArchitecture {
  getPlans(): CommercialPlan[] {
    return Object.values(PLANS)
  }

  getPlan(tier: PlanTier): CommercialPlan {
    const plan = PLANS[tier]
    logger.info('PackagingArchitecture: plan retrieved', { tier })
    return plan
  }

  getPlanForOrgSize(agentCount: number): CommercialPlan {
    let recommended: PlanTier

    if (agentCount <= 1) {
      recommended = 'starter'
    } else if (agentCount <= 10) {
      recommended = 'pro'
    } else if (agentCount <= 25) {
      recommended = 'elite'
    } else {
      recommended = 'institutional'
    }

    logger.info('PackagingArchitecture: plan recommended for org size', { agentCount, recommended })
    return PLANS[recommended]
  }

  compareFeature(featureName: string): Record<PlanTier, boolean | string> {
    const result: Record<PlanTier, boolean | string> = {
      starter: false,
      pro: false,
      elite: false,
      institutional: false,
    }

    for (const tier of Object.keys(PLANS) as PlanTier[]) {
      const feature = PLANS[tier].features.find(
        f => f.name.toLowerCase() === featureName.toLowerCase(),
      )
      if (feature) {
        result[tier] = feature.included ? (feature.limit ?? true) : false
      }
    }

    return result
  }

  getAnnualSavings(tier: PlanTier): number {
    const plan = PLANS[tier]
    const annualAtMonthly = plan.price_monthly_eur * 12
    const annualAtAnnual = plan.price_annual_eur * 12
    return annualAtMonthly - annualAtAnnual
  }
}

export const packagingArchitecture = new PackagingArchitecture()
