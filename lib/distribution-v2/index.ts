// AGENCY GROUP — SH-ROS | AMI: 22506

// ── Agent Onboarding (<15 min target) ────────────────────────────────────────

export interface OnboardingChecklist {
  agent_id: string
  org_id: string
  started_at: Date
  completed_steps: OnboardingStep[]
  pending_steps: OnboardingStep[]
  completion_pct: number
  estimated_minutes_remaining: number
  is_revenue_ready: boolean
  first_listing_prompt: string
}

export type OnboardingStep =
  | 'profile_complete'
  | 'first_listing_uploaded'
  | 'ai_analysis_reviewed'
  | 'pricing_intelligence_seen'
  | 'action_queue_checked'
  | 'first_deal_pack_generated'

const STEP_MINUTES: Record<OnboardingStep, number> = {
  profile_complete: 2,
  first_listing_uploaded: 5,
  ai_analysis_reviewed: 2,
  pricing_intelligence_seen: 1,
  action_queue_checked: 1,
  first_deal_pack_generated: 3,
}

const ALL_STEPS: OnboardingStep[] = [
  'profile_complete',
  'first_listing_uploaded',
  'ai_analysis_reviewed',
  'pricing_intelligence_seen',
  'action_queue_checked',
  'first_deal_pack_generated',
]

// ── Viral Referral Loop ───────────────────────────────────────────────────────

export interface ReferralEvent {
  referrer_agent_id: string
  referred_agent_id: string
  org_id: string
  event_type: 'referral_sent' | 'referral_accepted' | 'first_listing' | 'first_deal'
  timestamp: Date
  reward_eur: number
}

export interface ReferralState {
  agent_id: string
  referrals_sent: number
  referrals_converted: number
  total_rewards_eur: number
  referral_code: string
  network_size: number
  network_commission_bonus_pct: number
}

// ── Geographic Expansion ──────────────────────────────────────────────────────

export type Market = 'PT' | 'ES' | 'FR' | 'DE' | 'UK' | 'US' | 'AE' | 'BR'

export interface ExpansionReadiness {
  current_market: Market
  next_market: Market
  readiness_score: number
  agent_count_threshold: number
  current_agent_count: number
  days_to_readiness: number
  expansion_triggers: string[]
  market_rationale: string
}

// ── Expansion Map ─────────────────────────────────────────────────────────────

interface ExpansionConfig {
  next: Market
  threshold: number
  rationale: string
  triggers: string[]
}

const EXPANSION_MAP: Partial<Record<Market, ExpansionConfig>> = {
  PT: {
    next: 'ES',
    threshold: 15,
    rationale:
      'Espanha: mercado imobiliário com 1.2M transacções/ano, proximidade cultural e linguística.',
    triggers: [
      'Atingir 15 consultores activos',
      'Fechar 3 negócios cross-border PT-ES',
      'Integrar portais Idealista e Fotocasa',
    ],
  },
  ES: {
    next: 'FR',
    threshold: 25,
    rationale:
      'França: mercado premium com forte procura de imóveis de luxo, especialmente Paris e Côte d\'Azur.',
    triggers: [
      'Atingir 25 consultores activos',
      'Parceria com agência francesa licenciada',
      'Adaptar plataforma para regulação francesa',
    ],
  },
  FR: {
    next: 'DE',
    threshold: 35,
    rationale:
      'Alemanha: maior economia da Europa, mercado imobiliário estável com alta liquidez institucional.',
    triggers: [
      'Atingir 35 consultores activos',
      'Conformidade com regulação alemã (MaBV)',
      'Integração com portais ImmobilienScout24',
    ],
  },
  DE: {
    next: 'UK',
    threshold: 50,
    rationale:
      'Reino Unido: mercado de luxo global, Londres no top 3 mundial, forte diaspora lusófona.',
    triggers: [
      'Atingir 50 consultores activos',
      'Licença RICS ou parceria local',
      'Integração com Rightmove e Zoopla',
    ],
  },
  UK: {
    next: 'US',
    threshold: 75,
    rationale:
      'Estados Unidos: mercado mais valioso do mundo, forte interesse de americanos em imóveis europeus.',
    triggers: [
      'Atingir 75 consultores activos',
      'Licença NAR ou parceria com broker americano',
      'Conformidade FIRPTA e regulação estadual',
    ],
  },
  US: {
    next: 'AE',
    threshold: 100,
    rationale:
      'Emirados Árabes: capital do Médio Oriente, compradores HNWI com forte apetite por imóveis europeus de luxo.',
    triggers: [
      'Atingir 100 consultores activos',
      'Escritório DIFC ou parceria Dubai',
      'Conformidade RERA e ADREI',
    ],
  },
  AE: {
    next: 'BR',
    threshold: 120,
    rationale:
      'Brasil: maior mercado da América Latina, Brasileiros são o 2º maior grupo comprador em Portugal.',
    triggers: [
      'Atingir 120 consultores activos',
      'CRECI federal ou parceria com imobiliária brasileira',
      'Integração com VivaReal e ZAP Imóveis',
    ],
  },
  BR: {
    next: 'PT',
    threshold: 150,
    rationale:
      'Consolidação do mercado português com presença global completa — fecho do ciclo de expansão.',
    triggers: [
      'Atingir 150 consultores activos',
      'Presença em todos os 8 mercados-alvo',
      'IPO ou ronda Series B',
    ],
  },
}

// ── Functions ─────────────────────────────────────────────────────────────────

export function createOnboardingChecklist(
  agentId: string,
  orgId: string,
  completedSteps: OnboardingStep[],
): OnboardingChecklist {
  const completedSet = new Set(completedSteps)
  const pending = ALL_STEPS.filter((s) => !completedSet.has(s))
  const completionPct = (completedSteps.length / ALL_STEPS.length) * 100

  const estimatedMinutesRemaining = pending.reduce(
    (sum, step) => sum + STEP_MINUTES[step],
    0,
  )

  const isRevenueReady =
    completedSet.has('first_listing_uploaded') &&
    completedSet.has('pricing_intelligence_seen')

  const firstListingPrompt = isRevenueReady
    ? 'Pronto para gerar receita! Verifique as suas acções prioritárias.'
    : pending.includes('first_listing_uploaded')
      ? 'Adicione o seu primeiro imóvel agora — em 5 minutos está a gerar análise de preço automática.'
      : 'Complete os passos restantes para desbloquear todo o potencial da plataforma e começar a fechar negócios.'

  return {
    agent_id: agentId,
    org_id: orgId,
    started_at: new Date(),
    completed_steps: completedSteps,
    pending_steps: pending,
    completion_pct: Math.round(completionPct * 10) / 10,
    estimated_minutes_remaining: estimatedMinutesRemaining,
    is_revenue_ready: isRevenueReady,
    first_listing_prompt: firstListingPrompt,
  }
}

export function generateReferralCode(agentId: string): string {
  const prefix = agentId.slice(0, 8).toUpperCase()
  return `${prefix}AG`
}

export function computeReferralState(
  agentId: string,
  events: ReferralEvent[],
): ReferralState {
  const agentEvents = events.filter((e) => e.referrer_agent_id === agentId)

  const referralsSent = agentEvents.filter(
    (e) => e.event_type === 'referral_sent',
  ).length

  const referralsConverted = agentEvents.filter(
    (e) => e.event_type === 'first_deal',
  ).length

  const totalRewardsEur = agentEvents.reduce((sum, e) => sum + e.reward_eur, 0)

  const networkSize = referralsConverted
  const networkCommissionBonusPct = Math.min(5, networkSize * 0.5)

  return {
    agent_id: agentId,
    referrals_sent: referralsSent,
    referrals_converted: referralsConverted,
    total_rewards_eur: totalRewardsEur,
    referral_code: generateReferralCode(agentId),
    network_size: networkSize,
    network_commission_bonus_pct: networkCommissionBonusPct,
  }
}

export function assessExpansionReadiness(
  currentMarket: Market,
  agentCount: number,
): ExpansionReadiness {
  const config = EXPANSION_MAP[currentMarket]

  // Fallback for markets with no defined next step
  const nextMarket: Market = config?.next ?? 'PT'
  const threshold = config?.threshold ?? 50
  const rationale =
    config?.rationale ?? 'Mercado com alto potencial de crescimento.'
  const triggers = config?.triggers ?? [
    'Atingir o número mínimo de consultores',
    'Estabelecer parceria local',
    'Conformidade regulatória',
  ]

  const readinessScore = Math.min(100, (agentCount / threshold) * 100)

  let daysToReadiness = 0
  if (readinessScore < 100) {
    const agentsNeeded = threshold - agentCount
    // Assume 2 new agents per month growth
    const monthsNeeded = agentsNeeded / 2
    daysToReadiness = Math.ceil(monthsNeeded * 30)
  }

  return {
    current_market: currentMarket,
    next_market: nextMarket,
    readiness_score: Math.round(readinessScore * 10) / 10,
    agent_count_threshold: threshold,
    current_agent_count: agentCount,
    days_to_readiness: daysToReadiness,
    expansion_triggers: triggers,
    market_rationale: rationale,
  }
}

export const distributionV2 = {
  createOnboardingChecklist,
  generateReferralCode,
  computeReferralState,
  assessExpansionReadiness,
}
