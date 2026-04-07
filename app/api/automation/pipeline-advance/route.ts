import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'

// ─── Types ────────────────────────────────────────────────────────────────────

type DealStage =
  | 'lead'
  | 'qualificado'
  | 'visita_agendada'
  | 'visita_realizada'
  | 'proposta'
  | 'negociacao'
  | 'cpcv_assinado'
  | 'escritura'
  | 'pos_venda'

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH'

interface PipelineAdvanceRequest {
  deal_id: string
  current_stage: DealStage
  buyer_score: number
  days_in_stage: number
  last_activity_days: number
  financing_confirmed: boolean
  documents_complete: boolean
  cpcv_date?: string
  budget?: number
  previous_score?: number
}

interface PipelineAdvanceResponse {
  should_advance: boolean
  next_stage?: DealStage
  reason: string
  actions_required: string[]
  risk_score: number
  probability: number
  risk_level: RiskLevel
}

// ─── Stage Probability Map ────────────────────────────────────────────────────

const STAGE_PROBABILITIES: Record<DealStage, number> = {
  lead: 5,
  qualificado: 15,
  visita_agendada: 30,
  visita_realizada: 40,
  proposta: 60,
  negociacao: 70,
  cpcv_assinado: 90,
  escritura: 97,
  pos_venda: 100,
}

const STAGE_ORDER: DealStage[] = [
  'lead',
  'qualificado',
  'visita_agendada',
  'visita_realizada',
  'proposta',
  'negociacao',
  'cpcv_assinado',
  'escritura',
  'pos_venda',
]

// ─── Business Logic ───────────────────────────────────────────────────────────

function evaluateAdvancement(req: PipelineAdvanceRequest): {
  should_advance: boolean
  next_stage?: DealStage
  reason: string
  actions_required: string[]
} {
  const {
    current_stage,
    buyer_score,
    days_in_stage,
    last_activity_days,
    financing_confirmed,
    documents_complete,
    cpcv_date,
    budget = 0,
  } = req

  const actions: string[] = []

  switch (current_stage) {
    case 'lead': {
      // lead → qualificado: score > 40 AND last activity < 3 days
      if (buyer_score > 40 && last_activity_days < 3) {
        return {
          should_advance: true,
          next_stage: 'qualificado',
          reason: `Score ${buyer_score} acima de 40 e contacto recente (${last_activity_days}d). Lead qualificado para avançar.`,
          actions_required: ['Agendar qualificação detalhada', 'Confirmar budget e timeline', 'Criar perfil de comprador'],
        }
      }
      if (buyer_score <= 40) actions.push(`Aumentar score acima de 40 (actual: ${buyer_score}) — qualificar motivação e budget`)
      if (last_activity_days >= 3) actions.push(`Contactar lead — sem actividade há ${last_activity_days} dias`)
      return {
        should_advance: false,
        reason: `Condições não cumpridas para avançar de lead para qualificado.`,
        actions_required: actions,
      }
    }

    case 'qualificado': {
      // qualificado → visita_agendada: financing confirmed OR budget > 500K
      const highBudget = budget > 500_000
      if (financing_confirmed || highBudget) {
        return {
          should_advance: true,
          next_stage: 'visita_agendada',
          reason: financing_confirmed
            ? 'Financiamento confirmado. Pronto para agendar visita.'
            : `Budget €${(budget / 1000).toFixed(0)}K acima de €500K — perfil premium validado.`,
          actions_required: ['Seleccionar 2-3 imóveis matching', 'Agendar visita nos próximos 5 dias', 'Enviar briefing dos imóveis seleccionados'],
        }
      }
      if (!financing_confirmed) actions.push('Confirmar capacidade financeira — pré-aprovação bancária ou capital próprio')
      if (!highBudget) actions.push(`Validar budget real — actual registado: €${(budget / 1000).toFixed(0)}K`)
      return {
        should_advance: false,
        reason: 'Aguarda confirmação de financiamento ou validação de budget premium.',
        actions_required: actions,
      }
    }

    case 'visita_agendada': {
      // This stage advances to visita_realizada when the visit happens (external trigger)
      // Check if visit is overdue
      if (days_in_stage > 7) {
        actions.push('Confirmar se visita foi realizada — actualizar estado manualmente')
        actions.push('Reagendar visita se necessário')
      }
      return {
        should_advance: false,
        reason: 'Aguarda realização da visita. Avanço para "visita_realizada" após confirmação.',
        actions_required: actions.length > 0 ? actions : ['Confirmar visita agendada com cliente e proprietário'],
      }
    }

    case 'visita_realizada': {
      // visita_realizada → proposta: days in stage < 5 AND score > 60
      if (days_in_stage < 5 && buyer_score > 60) {
        return {
          should_advance: true,
          next_stage: 'proposta',
          reason: `Visita recente (${days_in_stage}d) e score elevado (${buyer_score}). Momentum ideal para submeter proposta.`,
          actions_required: ['Preparar proposta formal', 'Confirmar condições financeiras', 'Definir estratégia de negociação com cliente'],
        }
      }
      if (days_in_stage >= 5) actions.push(`Urgente: ${days_in_stage} dias desde visita sem proposta — risco de perda de interesse`)
      if (buyer_score <= 60) actions.push(`Score ${buyer_score} abaixo de 60 — requalificar motivação e objecções da visita`)
      return {
        should_advance: false,
        reason: 'Condições para avançar para proposta ainda não cumpridas.',
        actions_required: actions,
      }
    }

    case 'proposta': {
      // proposta → negociacao: auto after 2 days if no counter-proposal registered
      if (days_in_stage >= 2) {
        return {
          should_advance: true,
          next_stage: 'negociacao',
          reason: `Proposta em aberto há ${days_in_stage} dias. Avançar automaticamente para fase de negociação.`,
          actions_required: ['Contactar vendedor para resposta à proposta', 'Definir BATNA com comprador', 'Preparar contra-proposta se necessário'],
        }
      }
      return {
        should_advance: false,
        reason: `Proposta submetida há ${days_in_stage} dia(s). Aguardar resposta (mínimo 2 dias).`,
        actions_required: ['Acompanhar resposta do vendedor', 'Manter contacto com comprador'],
      }
    }

    case 'negociacao': {
      // negociacao → cpcv_assinado: requires documents_complete = true
      if (documents_complete) {
        return {
          should_advance: true,
          next_stage: 'cpcv_assinado',
          reason: 'Documentação completa. Condições reunidas para assinatura do CPCV.',
          actions_required: ['Agendar assinatura do CPCV', 'Confirmar advogado/notário', 'Verificar cheque de sinal'],
        }
      }
      actions.push('Recolher documentação em falta (CC, NIF, certidão predial, caderneta urbana)')
      actions.push('Confirmar condições finais acordadas por escrito')
      return {
        should_advance: false,
        reason: 'Documentação incompleta. CPCV não pode avançar sem documentos completos.',
        actions_required: actions,
      }
    }

    case 'cpcv_assinado': {
      // cpcv_assinado → escritura: requires cpcv_date set
      if (cpcv_date) {
        const cpcvDateObj = new Date(cpcv_date)
        const today = new Date()
        const daysUntilDeadline = Math.ceil((cpcvDateObj.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

        if (daysUntilDeadline <= 30) {
          return {
            should_advance: true,
            next_stage: 'escritura',
            reason: `Data de escritura em ${daysUntilDeadline} dias (${cpcv_date}). Iniciar preparativos finais.`,
            actions_required: [
              'Confirmar notário e data exacta da escritura',
              'Verificar licença de utilização e certidão de teor',
              'Confirmar financiamento bancário finalizado',
              'Enviar checklist pré-escritura ao comprador',
            ],
          }
        }
        return {
          should_advance: false,
          reason: `Escritura agendada para ${cpcv_date} (${daysUntilDeadline} dias). Manter acompanhamento.`,
          actions_required: ['Verificar progresso do financiamento', 'Confirmar documentação do imóvel'],
        }
      }
      actions.push('Definir data de escritura no CPCV')
      actions.push('Coordenar com notário e banco financiador')
      return {
        should_advance: false,
        reason: 'Data de escritura não definida. Necessário agendar com todas as partes.',
        actions_required: actions,
      }
    }

    case 'escritura':
    case 'pos_venda': {
      return {
        should_advance: false,
        reason: 'Deal em fase final. Sem avanço automático disponível.',
        actions_required: ['Solicitar NPS ao cliente', 'Pedir Google Review', 'Activar programa de referidos'],
      }
    }

    default: {
      return {
        should_advance: false,
        reason: 'Stage desconhecido.',
        actions_required: ['Verificar estado do deal manualmente'],
      }
    }
  }
}

// ─── Risk Calculation ─────────────────────────────────────────────────────────

function calculateRisk(req: PipelineAdvanceRequest): { risk_score: number; risk_level: RiskLevel } {
  let risk_score = 0

  // HIGH risk signals
  if (req.last_activity_days > 7) {
    risk_score += 40
  } else if (req.last_activity_days > 4) {
    risk_score += 20
  } else if (req.last_activity_days > 2) {
    risk_score += 10
  }

  // Score drop detection
  if (req.previous_score !== undefined) {
    const scoreDrop = req.previous_score - req.buyer_score
    if (scoreDrop > 20) {
      risk_score += 30
    } else if (scoreDrop > 10) {
      risk_score += 15
    }
  }

  // Stage velocity risk
  const stageMaxDays: Partial<Record<DealStage, number>> = {
    lead: 7,
    qualificado: 14,
    visita_agendada: 7,
    visita_realizada: 5,
    proposta: 5,
    negociacao: 21,
    cpcv_assinado: 60,
  }
  const maxDays = stageMaxDays[req.current_stage]
  if (maxDays && req.days_in_stage > maxDays) {
    risk_score += Math.min(30, Math.floor((req.days_in_stage - maxDays) * 2))
  }

  // Low score risk
  if (req.buyer_score < 30) {
    risk_score += 20
  } else if (req.buyer_score < 50) {
    risk_score += 10
  }

  risk_score = Math.min(100, risk_score)

  const risk_level: RiskLevel =
    risk_score >= 50 ? 'HIGH' : risk_score >= 25 ? 'MEDIUM' : 'LOW'

  return { risk_score, risk_level }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse<PipelineAdvanceResponse | { error: string }>> {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.PORTAL_API_SECRET
  if (!secret) return NextResponse.json({ error: 'API not configured' }, { status: 503 })
  if (!safeCompare(authHeader ?? '', `Bearer ${secret}`)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const body = (await request.json()) as PipelineAdvanceRequest

    // Validate required fields
    const required: (keyof PipelineAdvanceRequest)[] = [
      'deal_id',
      'current_stage',
      'buyer_score',
      'days_in_stage',
      'last_activity_days',
      'financing_confirmed',
      'documents_complete',
    ]

    for (const field of required) {
      if (body[field] === undefined || body[field] === null) {
        return NextResponse.json({ error: `Campo obrigatório em falta: ${field}` }, { status: 400 })
      }
    }

    // Validate stage
    if (!STAGE_ORDER.includes(body.current_stage)) {
      return NextResponse.json({ error: `Stage inválido: ${body.current_stage}` }, { status: 400 })
    }

    // Validate score range
    if (body.buyer_score < 0 || body.buyer_score > 100) {
      return NextResponse.json({ error: 'buyer_score deve estar entre 0 e 100' }, { status: 400 })
    }

    const advancement = evaluateAdvancement(body)
    const { risk_score, risk_level } = calculateRisk(body)

    // Get probability: if advancing, use next stage probability; else current
    const targetStage = advancement.next_stage ?? body.current_stage
    const probability = STAGE_PROBABILITIES[targetStage]

    const response: PipelineAdvanceResponse = {
      should_advance: advancement.should_advance,
      ...(advancement.next_stage ? { next_stage: advancement.next_stage } : {}),
      reason: advancement.reason,
      actions_required: advancement.actions_required,
      risk_score,
      risk_level,
      probability,
    }

    return NextResponse.json(response, { status: 200 })
  } catch (error) {
    console.error('[pipeline-advance] Error:', error)
    return NextResponse.json(
      { error: 'Erro interno ao processar avanço de pipeline' },
      { status: 500 }
    )
  }
}
