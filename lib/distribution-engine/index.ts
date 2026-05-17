// AGENCY GROUP — SH-ROS | AMI: 22506
// Distribution Engine — agent onboarding state machine + viral referral loop
// Target: full activation in <15 minutes. Viral bonus: up to 5% commission extra.
// Pure TypeScript — no DB writes. Caller handles persistence.
// =============================================================================

import { createHmac } from 'crypto'

// ---------------------------------------------------------------------------
// Onboarding step type
// ---------------------------------------------------------------------------

export type OnboardingStep =
  | 'account'
  | 'import_listings'
  | 'import_contacts'
  | 'first_analysis'
  | 'review_recommendations'
  | 'first_action'

const STEP_ORDER: OnboardingStep[] = [
  'account',
  'import_listings',
  'import_contacts',
  'first_analysis',
  'review_recommendations',
  'first_action',
]

// ---------------------------------------------------------------------------
// Step definitions (Portuguese)
// ---------------------------------------------------------------------------

export interface OnboardingStepDefinition {
  step: OnboardingStep
  number: number
  title: string
  description: string
  cta: string
  estimated_minutes: number
  revenue_unlock: string
}

export const ONBOARDING_STEPS: OnboardingStepDefinition[] = [
  {
    step: 'account',
    number: 1,
    title: 'Criar Conta',
    description: 'Configure o seu perfil de agente e credenciais de acesso ao sistema.',
    cta: 'Criar Conta',
    estimated_minutes: 2,
    revenue_unlock: 'Desbloqueia acesso ao dashboard completo',
  },
  {
    step: 'import_listings',
    number: 2,
    title: 'Importar Imóveis',
    description: 'Adicione os seus imóveis via CSV, URL de portal (Idealista, Imovirtual) ou manualmente.',
    cta: 'Importar Imóveis',
    estimated_minutes: 3,
    revenue_unlock: 'Desbloqueia análise IA automática de todos os imóveis',
  },
  {
    step: 'import_contacts',
    number: 3,
    title: 'Importar Contactos',
    description: 'Importe a sua base de contactos e leads existentes para activar o motor de scoring.',
    cta: 'Importar Contactos',
    estimated_minutes: 3,
    revenue_unlock: 'Desbloqueia scoring e priorização automática de leads',
  },
  {
    step: 'first_analysis',
    number: 4,
    title: 'Primeira Análise IA',
    description: 'O sistema analisa os seus imóveis e gera estimativas de preço, score de procura e potencial de receita.',
    cta: 'Executar Análise',
    estimated_minutes: 5,
    revenue_unlock: 'Desbloqueia recomendações de preço e acções de receita automáticas',
  },
  {
    step: 'review_recommendations',
    number: 5,
    title: 'Rever Recomendações',
    description: 'Analise as primeiras recomendações do sistema: preços, acções prioritárias e previsão de comissão.',
    cta: 'Ver Recomendações',
    estimated_minutes: 1,
    revenue_unlock: 'Desbloqueia execução autónoma de acções com aprovação humana',
  },
  {
    step: 'first_action',
    number: 6,
    title: 'Executar Primeira Acção',
    description: 'Aprove e execute a primeira recomendação de receita do sistema. Activação completa.',
    cta: 'Executar Acção',
    estimated_minutes: 1,
    revenue_unlock: 'Sistema SH-ROS totalmente activo — receita autónoma activada',
  },
]

// Total estimated: 15 minutes

// ---------------------------------------------------------------------------
// Progress type
// ---------------------------------------------------------------------------

export interface OnboardingProgress {
  agent_id: string
  email: string
  steps_completed: OnboardingStep[]
  current_step: OnboardingStep
  completion_pct: number
  is_activated: boolean
  time_to_activate_minutes?: number
  invite_code: string
  invited_by?: string
  started_at: Date
  activated_at?: Date
}

// ---------------------------------------------------------------------------
// Viral loop
// ---------------------------------------------------------------------------

export interface ViralLoopStats {
  invite_code: string
  agents_invited: number
  agents_activated: number
  /** 1% per activated referral, max 5% */
  commission_bonus_pct: number
  total_bonus_earned_eur: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function generateInviteCode(agent_id: string): string {
  return createHmac('sha256', agent_id)
    .update('invite-salt-ag-2026')
    .digest('hex')
    .slice(0, 8)
    .toUpperCase()
}

function nextUncompletedStep(completed: OnboardingStep[]): OnboardingStep {
  for (const step of STEP_ORDER) {
    if (!completed.includes(step)) return step
  }
  return 'first_action' // all done
}

// ---------------------------------------------------------------------------
// Core functions
// ---------------------------------------------------------------------------

export function createOnboardingProgress(
  agent_id: string,
  email: string,
  invited_by?: string,
): OnboardingProgress {
  return {
    agent_id,
    email,
    steps_completed: [],
    current_step: 'account',
    completion_pct: 0,
    is_activated: false,
    invite_code: generateInviteCode(agent_id),
    invited_by,
    started_at: new Date(),
  }
}

export function advanceStep(
  progress: OnboardingProgress,
  completed_step: OnboardingStep,
): OnboardingProgress {
  const alreadyDone = progress.steps_completed.includes(completed_step)
  const steps_completed = alreadyDone
    ? progress.steps_completed
    : [...progress.steps_completed, completed_step]

  const completion_pct = Math.round((steps_completed.length / STEP_ORDER.length) * 100)
  const is_activated = steps_completed.length >= STEP_ORDER.length
  const current_step = is_activated ? 'first_action' : nextUncompletedStep(steps_completed)

  const now = new Date()
  const time_to_activate_minutes = is_activated
    ? Math.round((now.getTime() - progress.started_at.getTime()) / 60_000)
    : undefined

  return {
    ...progress,
    steps_completed,
    current_step,
    completion_pct,
    is_activated,
    time_to_activate_minutes,
    activated_at: is_activated ? now : progress.activated_at,
  }
}

export function computeViralStats(
  invite_code: string,
  agents_activated: number,
  commission_bonus_eur: number,
): ViralLoopStats {
  const commission_bonus_pct = Math.min(5, agents_activated) // 1% per activation, cap 5%
  return {
    invite_code,
    agents_invited: agents_activated,    // caller supplies this
    agents_activated,
    commission_bonus_pct,
    total_bonus_earned_eur: commission_bonus_eur,
  }
}

export function totalEstimatedMinutes(): number {
  return ONBOARDING_STEPS.reduce((sum, s) => sum + s.estimated_minutes, 0)
}
