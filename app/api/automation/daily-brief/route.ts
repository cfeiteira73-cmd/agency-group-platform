import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PriorityAction {
  priority: 1 | 2 | 3
  action: string
  contact_name: string
  reason: string
  estimated_time_minutes: number
  potential_gci: number
}

interface PipelineSummary {
  total_weighted_gci: number
  deals_at_risk: number
  deals_closing_30d: number
  new_leads_24h: number
}

interface TimeAllocation {
  calls_minutes: number
  emails_minutes: number
  visits_scheduled: number
  admin_minutes: number
}

interface DailyBrief {
  date: string
  headline: string
  priority_actions: PriorityAction[]
  pipeline_summary: PipelineSummary
  market_insight: string
  ai_recommendation: string
  time_allocation: TimeAllocation
}

// ─── Seed Data Pools ──────────────────────────────────────────────────────────

const CONTACT_NAMES = [
  'James Miller', 'Sophie Dubois', 'Carlos Mendes', 'Emma Thompson',
  'Ahmed Al-Rashid', 'Maria Santos', 'Thomas Müller', 'Isabelle Laurent',
  'Roberto Silva', 'Catherine Chen', 'Patrick O\'Brien', 'Fatima Al-Zahra',
  'David Kowalski', 'Ana Ferreira', 'Nicolas Blanc',
]

const MARKET_INSIGHTS = [
  'Lisboa mantém-se top 5 mundial em luxo — compradores norte-americanos aumentaram 18% YoY. Imóveis em Príncipe Real e Chiado têm DOM médio de 45 dias.',
  'Mercado Algarve: procura britânica resiliente pós-Brexit. Propriedades €1M-€2M em Quinta do Lago com 3+ inquiries/semana vendem em média em 38 dias.',
  'Porto consolida-se como alternativa premium a Lisboa: €3.643/m² mediana (+14% YoY). Bonfim e Cedofeita lideram procura de compradores franceses.',
  'Golden Visa: após alterações de 2023, Açores e interior Portugal ganham tracção. Budget médio €500K-€800K, compradores asiáticos 62% do segmento.',
  'Taxas BCE em descida — actividade crédito habitação +23% em Q1. Janela de oportunidade para buyers com financing pendente.',
  'Mercado Madeira: crescimento 31% em transacções premium. Funchal e Calheta com procura alemã e nórdica emergente.',
  'Compradores brasileiros: segmento mais activo em €200K-€500K. Lisboa e Porto dividem quota. Motivação principal: NHR + qualidade de vida.',
  'Investidores Médio Oriente activos em activos €3M+. Deal flow virado para Lisboa riverfront, Cascais e Comporta. Yield mínimo exigido: 4,5%.',
  'Temporada alta aproxima-se: histórico mostra +34% de inquiries Março-Junho. Pipeline de Abril/Maio tende a fechar em Julho-Agosto.',
  'Mercado comparáveis: propriedades com renovação recente vendem +22% acima mediana zona. Buyers premium pagam prémio por turnkey.',
  'Aumento procura tipologia T3-T4 com espaço exterior. Pós-pandemia, terraços/jardins valorizam +15% face a apartamentos sem exterior equivalentes.',
  'Cascais: €4.713/m² mediana mas linha Estoril regista transacções €8K-€12K/m² em primeira linha. Compradores nórdicos e alemães dominam.',
]

const ACTION_TEMPLATES = [
  {
    action: 'Ligar — confirmar disponibilidade visita esta semana',
    reason: 'Score máximo, sem contacto há 2 dias — risco de resfriamento',
    estimated_time_minutes: 15,
    base_gci: 15000,
  },
  {
    action: 'WhatsApp — enviar 3 novas propriedades matching perfil',
    reason: 'Budget confirmado €800K, aguarda opções em Cascais',
    estimated_time_minutes: 20,
    base_gci: 40000,
  },
  {
    action: 'Email — seguimento proposta enviada há 48h',
    reason: 'Proposta em aberto sem resposta — janela crítica de negociação',
    estimated_time_minutes: 10,
    base_gci: 22500,
  },
  {
    action: 'Reunião presencial — apresentar análise de investimento',
    reason: 'Investor profile validado, capital disponível, aguarda deal memo',
    estimated_time_minutes: 60,
    base_gci: 75000,
  },
  {
    action: 'Ligar — reactivar após 12 dias sem contacto',
    reason: 'Lead quente dormiente — timeline de compra era imediato',
    estimated_time_minutes: 20,
    base_gci: 18000,
  },
  {
    action: 'Preparar e enviar relatório de proprietário',
    reason: 'Imóvel há 45 dias no mercado sem oferta — recomendação de revisão de preço',
    estimated_time_minutes: 25,
    base_gci: 12500,
  },
  {
    action: 'WhatsApp — follow-up pós-visita de ontem',
    reason: 'Feedback da visita foi positivo (4/5), janela de 24-48h para proposta',
    estimated_time_minutes: 10,
    base_gci: 28000,
  },
  {
    action: 'Email — enviar comparáveis e análise de mercado',
    reason: 'Cliente em fase de decisão, pediu contexto de mercado para justificar oferta',
    estimated_time_minutes: 30,
    base_gci: 35000,
  },
  {
    action: 'Ligar banco — confirmar aprovação de crédito',
    reason: 'CPCV agendado em 8 dias, financiamento ainda não confirmado',
    estimated_time_minutes: 15,
    base_gci: 20000,
  },
  {
    action: 'Visita de avaliação — imóvel novo para mandato',
    reason: 'Proprietário contactou via referido — oportunidade de mandato exclusivo',
    estimated_time_minutes: 90,
    base_gci: 30000,
  },
]

// ─── Seeded Random Utilities ──────────────────────────────────────────────────

function seededRandom(seed: number): () => number {
  let s = seed
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

function pickFromArray<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)]
}

function pickNFromArray<T>(arr: T[], n: number, rng: () => number): T[] {
  const shuffled = [...arr].sort(() => rng() - 0.5)
  return shuffled.slice(0, n)
}

function randomBetween(min: number, max: number, rng: () => number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}

// ─── Daily Brief Generator ────────────────────────────────────────────────────

function generateDailyBrief(date: Date): DailyBrief {
  // Seed based on date (YYYYMMDD) so same day = same data
  const dateSeed =
    date.getFullYear() * 10000 +
    (date.getMonth() + 1) * 100 +
    date.getDate()
  const rng = seededRandom(dateSeed)

  const dateStr = date.toISOString().split('T')[0]

  // Pick contacts for today's actions (avoid repeats)
  const todayContacts = pickNFromArray(CONTACT_NAMES, 5, rng)
  const todayActions = pickNFromArray(ACTION_TEMPLATES, 5, rng)

  // Build 3 priority actions
  const priorityActions: PriorityAction[] = [
    {
      priority: 1,
      action: todayActions[0].action,
      contact_name: todayContacts[0],
      reason: todayActions[0].reason,
      estimated_time_minutes: todayActions[0].estimated_time_minutes,
      potential_gci: Math.round(todayActions[0].base_gci * (0.9 + rng() * 0.4)),
    },
    {
      priority: 1,
      action: todayActions[1].action,
      contact_name: todayContacts[1],
      reason: todayActions[1].reason,
      estimated_time_minutes: todayActions[1].estimated_time_minutes,
      potential_gci: Math.round(todayActions[1].base_gci * (0.9 + rng() * 0.4)),
    },
    {
      priority: 2,
      action: todayActions[2].action,
      contact_name: todayContacts[2],
      reason: todayActions[2].reason,
      estimated_time_minutes: todayActions[2].estimated_time_minutes,
      potential_gci: Math.round(todayActions[2].base_gci * (0.9 + rng() * 0.4)),
    },
    {
      priority: 2,
      action: todayActions[3].action,
      contact_name: todayContacts[3],
      reason: todayActions[3].reason,
      estimated_time_minutes: todayActions[3].estimated_time_minutes,
      potential_gci: Math.round(todayActions[3].base_gci * (0.9 + rng() * 0.4)),
    },
    {
      priority: 3,
      action: todayActions[4].action,
      contact_name: todayContacts[4],
      reason: todayActions[4].reason,
      estimated_time_minutes: todayActions[4].estimated_time_minutes,
      potential_gci: Math.round(todayActions[4].base_gci * (0.9 + rng() * 0.4)),
    },
  ]

  // Pipeline metrics (seeded daily variation)
  const total_weighted_gci =
    randomBetween(280, 650, rng) * 1000
  const deals_at_risk = randomBetween(1, 4, rng)
  const deals_closing_30d = randomBetween(1, 3, rng)
  const new_leads_24h = randomBetween(1, 6, rng)

  const pipelineSummary: PipelineSummary = {
    total_weighted_gci,
    deals_at_risk,
    deals_closing_30d,
    new_leads_24h,
  }

  // Headline
  const hotLeadCount = priorityActions.filter(a => a.priority === 1).length
  const headlineTemplates = [
    `${hotLeadCount} hot leads + ${deals_at_risk} deal${deals_at_risk > 1 ? 's' : ''} no limiar — foca aqui hoje`,
    `${new_leads_24h} leads novos + €${(total_weighted_gci / 1000).toFixed(0)}K GCI ponderado — pipeline saudável`,
    `${deals_closing_30d} deal${deals_closing_30d > 1 ? 's' : ''} a fechar em 30 dias — ${deals_at_risk} em risco`,
    `Pipeline €${(total_weighted_gci / 1000).toFixed(0)}K — ${hotLeadCount} acções críticas para hoje`,
  ]
  const headline = pickFromArray(headlineTemplates, rng)

  // Market insight (rotates daily)
  const insightIndex = dateSeed % MARKET_INSIGHTS.length
  const market_insight = MARKET_INSIGHTS[insightIndex]

  // AI recommendation
  const topContact = priorityActions[0].contact_name
  const topScore = randomBetween(85, 98, rng)
  const topDays = randomBetween(1, 3, rng)
  const ai_recommendation = `Hoje foca no ${topContact} — ${topScore} score, não contactado há ${topDays} dia${topDays > 1 ? 's' : ''}. GCI potencial €${(priorityActions[0].potential_gci / 1000).toFixed(0)}K. Janela de acção crítica nas próximas 4h.`

  // Time allocation
  const totalActionMinutes = priorityActions.reduce(
    (sum, a) => sum + a.estimated_time_minutes,
    0
  )
  const time_allocation: TimeAllocation = {
    calls_minutes: Math.round(totalActionMinutes * 0.35),
    emails_minutes: Math.round(totalActionMinutes * 0.25),
    visits_scheduled: randomBetween(0, 2, rng),
    admin_minutes: randomBetween(20, 45, rng),
  }

  return {
    date: dateStr,
    headline,
    priority_actions: priorityActions,
    pipeline_summary: pipelineSummary,
    market_insight,
    ai_recommendation,
    time_allocation,
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse<DailyBrief | { error: string }>> {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // Allow overriding date via query param for testing: ?date=2026-04-10
    const { searchParams } = new URL(request.url)
    const dateParam = searchParams.get('date')

    let targetDate: Date
    if (dateParam) {
      targetDate = new Date(dateParam)
      if (isNaN(targetDate.getTime())) {
        return NextResponse.json({ error: 'Parâmetro date inválido. Formato esperado: YYYY-MM-DD' }, { status: 400 })
      }
    } else {
      targetDate = new Date()
    }

    const brief = generateDailyBrief(targetDate)

    return NextResponse.json(brief, {
      status: 200,
      headers: {
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    console.error('[daily-brief] Error:', error)
    return NextResponse.json(
      { error: 'Erro interno ao gerar daily brief' },
      { status: 500 }
    )
  }
}
