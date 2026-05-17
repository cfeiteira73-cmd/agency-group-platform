// AGENCY GROUP — SH-ROS | AMI: 22506

export type UserRole = 'agent' | 'team_lead' | 'executive' | 'new_agent'

export interface SimplifiedScreen {
  screen_id: string
  title: string
  subtitle: string
  primary_action: SimpleAction
  secondary_action?: SimpleAction
  tertiary_action?: SimpleAction
  suppressed_complexity: string[]
  revenue_context: string
}

export interface SimpleAction {
  id: string
  label: string
  description: string
  estimated_revenue_impact_eur: number
  time_to_complete: string
  urgency: 'agora' | 'hoje' | 'esta_semana'
}

export interface DailyFocus {
  role: UserRole
  date: string
  greeting: string
  top_message: string
  screens: SimplifiedScreen[]
  revenue_today_potential_eur: number
  focus_label: string
}

// ── Context for buildDailyFocus ───────────────────────────────────────────────

export interface DailyFocusContext {
  listings_needing_action: number
  hot_leads: number
  pending_offers: number
  monthly_revenue_eur: number
}

// ── Suppressed complexity — always hidden from end users ──────────────────────

const SUPPRESSED: string[] = [
  'AVM algorithm',
  'signal detection scores',
  'ML confidence intervals',
  'zone microstructure data',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function revenueContext(amount: number): string {
  const formatted =
    amount >= 1_000_000
      ? `€${(amount / 1_000_000).toFixed(1)}M`
      : `€${Math.round(amount / 1000)}K`
  return `Esta acção pode gerar ~${formatted}`
}

// ── Role builders ─────────────────────────────────────────────────────────────

function buildAgentScreens(ctx: DailyFocusContext): SimplifiedScreen[] {
  const leadRevenue = ctx.hot_leads * 500_000 * 0.05 * 0.08
  const offerRevenue = ctx.pending_offers * 500_000 * 0.05

  // Primary: pending offers beat leads
  const hasPendingOffers = ctx.pending_offers > 0
  const hasHotLeads = ctx.hot_leads > 0
  const hasListingsToAction = ctx.listings_needing_action > 0

  const primaryAction: SimpleAction = hasPendingOffers
    ? {
        id: 'respond_offer',
        label: 'Responder Proposta',
        description: `Tem ${ctx.pending_offers} proposta(s) à espera de resposta — responda agora para não perder o negócio.`,
        estimated_revenue_impact_eur: offerRevenue,
        time_to_complete: '5 min',
        urgency: 'agora',
      }
    : {
        id: 'contact_leads',
        label: 'Contactar Leads',
        description: `Tem ${ctx.hot_leads} lead(s) quente(s) prontos para contacto — cada hora conta.`,
        estimated_revenue_impact_eur: leadRevenue,
        time_to_complete: '10 min',
        urgency: 'agora',
      }

  const secondaryAction: SimpleAction | undefined = hasListingsToAction
    ? {
        id: 'improve_listings',
        label: 'Melhorar Imóveis',
        description: `${ctx.listings_needing_action} imóvel(is) precisam de actualização para aumentar visibilidade.`,
        estimated_revenue_impact_eur: ctx.listings_needing_action * 2_500,
        time_to_complete: '3 min',
        urgency: 'hoje',
      }
    : hasHotLeads && hasPendingOffers
      ? {
          id: 'contact_leads',
          label: 'Contactar Leads',
          description: `Tem ${ctx.hot_leads} lead(s) quente(s) prontos para contacto.`,
          estimated_revenue_impact_eur: leadRevenue,
          time_to_complete: '10 min',
          urgency: 'hoje',
        }
      : undefined

  const totalRevenue =
    primaryAction.estimated_revenue_impact_eur +
    (secondaryAction?.estimated_revenue_impact_eur ?? 0)

  const screen: SimplifiedScreen = {
    screen_id: 'agent_daily',
    title: 'As Suas Prioridades',
    subtitle: 'As acções com maior impacto na sua receita de hoje.',
    primary_action: primaryAction,
    secondary_action: secondaryAction,
    suppressed_complexity: SUPPRESSED,
    revenue_context: revenueContext(totalRevenue),
  }

  return [screen]
}

function buildTeamLeadScreens(ctx: DailyFocusContext): SimplifiedScreen[] {
  const teamRevenue = ctx.monthly_revenue_eur / 20

  const primary: SimpleAction = {
    id: 'team_performance',
    label: 'Ver Performance da Equipa',
    description: 'Veja quem está a fechar negócios e quem precisa de apoio hoje.',
    estimated_revenue_impact_eur: teamRevenue * 0.1,
    time_to_complete: '5 min',
    urgency: 'hoje',
  }

  const secondary: SimpleAction = {
    id: 'at_risk_listings',
    label: 'Imóveis com Risco',
    description: `${ctx.listings_needing_action} imóvel(is) com sinais de estagnação — intervenha antes de perder tração.`,
    estimated_revenue_impact_eur: ctx.listings_needing_action * 5_000,
    time_to_complete: '3 min',
    urgency: 'hoje',
  }

  const tertiary: SimpleAction = {
    id: 'team_opportunities',
    label: 'Oportunidades',
    description: `${ctx.hot_leads} lead(s) quente(s) disponíveis para distribuição à equipa.`,
    estimated_revenue_impact_eur: ctx.hot_leads * 500_000 * 0.05 * 0.08,
    time_to_complete: '2 min',
    urgency: 'esta_semana',
  }

  const totalRevenue =
    primary.estimated_revenue_impact_eur +
    secondary.estimated_revenue_impact_eur +
    tertiary.estimated_revenue_impact_eur

  const screen: SimplifiedScreen = {
    screen_id: 'team_lead_daily',
    title: 'Gestão da Equipa',
    subtitle: 'Maximize o desempenho colectivo da sua equipa hoje.',
    primary_action: primary,
    secondary_action: secondary,
    tertiary_action: tertiary,
    suppressed_complexity: SUPPRESSED,
    revenue_context: revenueContext(totalRevenue),
  }

  return [screen]
}

function buildExecutiveScreens(ctx: DailyFocusContext): SimplifiedScreen[] {
  const dailyRevenue = ctx.monthly_revenue_eur / 22

  const primary: SimpleAction = {
    id: 'revenue_today',
    label: 'Revenue de Hoje',
    description: 'Pipeline de receita em tempo real — negócios em fecho e previsão do mês.',
    estimated_revenue_impact_eur: dailyRevenue,
    time_to_complete: '2 min',
    urgency: 'hoje',
  }

  const secondary: SimpleAction = {
    id: 'top_opportunities',
    label: 'Top Oportunidades',
    description: `${ctx.pending_offers} proposta(s) activa(s) e ${ctx.hot_leads} lead(s) de alto valor prontos para decisão.`,
    estimated_revenue_impact_eur: ctx.pending_offers * 500_000 * 0.05,
    time_to_complete: '5 min',
    urgency: 'hoje',
  }

  const totalRevenue =
    primary.estimated_revenue_impact_eur + secondary.estimated_revenue_impact_eur

  const screen: SimplifiedScreen = {
    screen_id: 'executive_daily',
    title: 'Visão Executiva',
    subtitle: 'O que importa para o negócio hoje, sem ruído.',
    primary_action: primary,
    secondary_action: secondary,
    suppressed_complexity: SUPPRESSED,
    revenue_context: revenueContext(totalRevenue),
  }

  return [screen]
}

function buildNewAgentScreens(): SimplifiedScreen[] {
  const primary: SimpleAction = {
    id: 'add_first_listing',
    label: 'Adicionar Primeiro Imóvel',
    description: 'Carregue o seu primeiro imóvel e veja a análise de preço automática em segundos.',
    estimated_revenue_impact_eur: 25_000,
    time_to_complete: '5 min',
    urgency: 'agora',
  }

  const secondary: SimpleAction = {
    id: 'watch_how_it_works',
    label: 'Ver Como Funciona',
    description: 'Visita guiada de 3 minutos — descubra como a plataforma trabalha por si.',
    estimated_revenue_impact_eur: 0,
    time_to_complete: '3 min',
    urgency: 'hoje',
  }

  const screen: SimplifiedScreen = {
    screen_id: 'new_agent_onboarding',
    title: 'Começar Agora',
    subtitle: 'Em 15 minutos estará pronto para fechar o seu primeiro negócio.',
    primary_action: primary,
    secondary_action: secondary,
    suppressed_complexity: SUPPRESSED,
    revenue_context: revenueContext(25_000),
  }

  return [screen]
}

// ── Exported functions ────────────────────────────────────────────────────────

export function buildDailyFocus(
  role: UserRole,
  context: DailyFocusContext,
): DailyFocus {
  const today = new Date().toISOString().slice(0, 10)

  let greeting: string
  let topMessage: string
  let screens: SimplifiedScreen[]
  let focusLabel: string
  let revenuePotential: number

  switch (role) {
    case 'agent': {
      const totalActions =
        (context.pending_offers > 0 ? 1 : 0) +
        (context.hot_leads > 0 ? 1 : 0) +
        (context.listings_needing_action > 0 ? 1 : 0)
      greeting = `Bom dia! Tem ${totalActions} acção(ões) que podem gerar receita hoje.`
      topMessage =
        context.pending_offers > 0
          ? `Tem ${context.pending_offers} proposta(s) à espera — responda agora para não perder o negócio.`
          : `Tem ${context.hot_leads} lead(s) quente(s) — cada hora de atraso reduz a taxa de conversão.`
      screens = buildAgentScreens(context)
      focusLabel =
        context.pending_offers > 0 ? 'Fecho de Negócios' : 'Captação e Leads'
      revenuePotential =
        screens[0].primary_action.estimated_revenue_impact_eur +
        (screens[0].secondary_action?.estimated_revenue_impact_eur ?? 0)
      break
    }

    case 'team_lead': {
      greeting = `Bom dia! A sua equipa tem ${context.hot_leads + context.pending_offers} oportunidades activas.`
      topMessage = `Foque-se em desbloquear os negócios da sua equipa — o pipeline de hoje vale ${revenueContext(context.monthly_revenue_eur / 20).replace('Esta acção pode gerar ~', '')}.`
      screens = buildTeamLeadScreens(context)
      focusLabel = 'Gestão de Equipa'
      revenuePotential = screens[0].primary_action.estimated_revenue_impact_eur +
        (screens[0].secondary_action?.estimated_revenue_impact_eur ?? 0) +
        (screens[0].tertiary_action?.estimated_revenue_impact_eur ?? 0)
      break
    }

    case 'executive': {
      greeting = `Bom dia! O pipeline executivo de hoje está activo.`
      topMessage = `Revenue mensal em curso: €${Math.round(context.monthly_revenue_eur / 1000)}K — ${context.pending_offers} proposta(s) em fase de fecho.`
      screens = buildExecutiveScreens(context)
      focusLabel = 'Visão Estratégica'
      revenuePotential = screens[0].primary_action.estimated_revenue_impact_eur +
        (screens[0].secondary_action?.estimated_revenue_impact_eur ?? 0)
      break
    }

    case 'new_agent': {
      greeting = `Bem-vindo à Agency Group! Está a 15 minutos de estar pronto para o seu primeiro negócio.`
      topMessage = `Adicione o seu primeiro imóvel agora — a plataforma faz a análise de preço por si automaticamente.`
      screens = buildNewAgentScreens()
      focusLabel = 'Primeiros Passos'
      revenuePotential = 25_000
      break
    }
  }

  return {
    role,
    date: today,
    greeting,
    top_message: topMessage,
    screens,
    revenue_today_potential_eur: revenuePotential,
    focus_label: focusLabel,
  }
}

export function simplifyActionLabel(technicalLabel: string): string {
  const MAP: Record<string, string> = {
    homepage_placement_score: 'Destaque no Site',
    avm_confidence: 'Precisão do Preço',
    demand_score: 'Procura',
    luxury_premium_potential: 'Margem Premium',
    overpricing_probability: 'Risco de Preço Alto',
  }
  return MAP[technicalLabel] ?? technicalLabel
}

export function enforceThreeActionRule(actions: SimpleAction[]): SimpleAction[] {
  return [...actions]
    .sort((a, b) => b.estimated_revenue_impact_eur - a.estimated_revenue_impact_eur)
    .slice(0, 3)
}

export const productSimplificationV2 = {
  buildDailyFocus,
  simplifyActionLabel,
  enforceThreeActionRule,
}
