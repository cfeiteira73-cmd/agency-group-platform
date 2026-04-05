// =============================================================================
// Agency Group — Off-Market Signals API
// GET  /api/automation/signals  — List signals with scoring
// POST /api/automation/signals  — Create new signal with auto-scoring
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SignalType =
  | 'inheritance'
  | 'insolvency'
  | 'divorce'
  | 'relocation'
  | 'multi_property'
  | 'price_reduction'
  | 'stagnated_listing'
  | 'new_below_avm'
  | 'listing_removed'
  | 'hot_zone_new'

type SignalStatus = 'new' | 'in_progress' | 'contacted' | 'converted' | 'dismissed'

interface Signal {
  id: string
  type: SignalType
  priority: 1 | 2 | 3 | 4 | 5
  probability_score: number
  property_address: string
  property_zone: string
  estimated_value: number | null
  owner_name: string | null
  signal_date: string
  source: string
  recommended_action: string
  status: SignalStatus
  score_breakdown: ScoreBreakdown
  days_since_signal: number
}

interface ScoreBreakdown {
  type_score: number
  recency_score: number
  zone_score: number
  value_score: number
}

interface CreateSignalRequest {
  type: SignalType
  property_address: string
  property_zone?: string
  owner_name?: string
  estimated_value?: number
  signal_date?: string
  source?: string
  notes?: string
}

// ---------------------------------------------------------------------------
// Scoring algorithm
// ---------------------------------------------------------------------------

const TYPE_SCORES: Record<SignalType, number> = {
  insolvency:       40,
  inheritance:      35,
  divorce:          30,
  relocation:       25,
  multi_property:   20,
  price_reduction:  15,
  stagnated_listing:12,
  new_below_avm:    18,
  listing_removed:  10,
  hot_zone_new:      8,
}

const HIGH_VALUE_ZONES = ['Lisboa', 'Cascais', 'Algarve', 'Comporta', 'Sintra', 'Estoril']
const MID_VALUE_ZONES  = ['Porto', 'Foz', 'Ericeira', 'Setúbal', 'Madeira']

function getZoneScore(zone: string): number {
  const normalised = zone.toLowerCase()
  if (HIGH_VALUE_ZONES.some((z) => normalised.includes(z.toLowerCase()))) return 15
  if (MID_VALUE_ZONES.some((z) => normalised.includes(z.toLowerCase()))) return 10
  return 5
}

function getRecencyScore(signalDate: string): number {
  const signalMs = new Date(signalDate).getTime()
  const nowMs    = Date.now()
  const daysDiff = Math.floor((nowMs - signalMs) / (1000 * 60 * 60 * 24))

  if (daysDiff < 7)  return 20
  if (daysDiff < 30) return 10
  if (daysDiff < 90) return 5
  return 0
}

function getValueScore(estimatedValue: number | null | undefined): number {
  if (!estimatedValue || estimatedValue <= 0) return 0
  if (estimatedValue >= 2_000_000) return 10
  if (estimatedValue >= 1_000_000) return 10
  if (estimatedValue >= 500_000)   return 7
  if (estimatedValue >= 200_000)   return 4
  return 2
}

function calculateSignalScore(
  type: SignalType,
  zone: string,
  signalDate: string,
  estimatedValue?: number | null
): { score: number; breakdown: ScoreBreakdown } {
  const breakdown: ScoreBreakdown = {
    type_score:    TYPE_SCORES[type] ?? 0,
    recency_score: getRecencyScore(signalDate),
    zone_score:    getZoneScore(zone),
    value_score:   getValueScore(estimatedValue),
  }

  const score = Math.min(
    100,
    breakdown.type_score +
    breakdown.recency_score +
    breakdown.zone_score +
    breakdown.value_score
  )

  return { score, breakdown }
}

function scoreToPriority(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score >= 80) return 5
  if (score >= 65) return 4
  if (score >= 50) return 3
  if (score >= 35) return 2
  return 1
}

function getRecommendedAction(type: SignalType, priority: number): string {
  const urgency = priority >= 4 ? 'URGENTE — ' : priority >= 3 ? '' : ''

  const actions: Record<SignalType, string> = {
    insolvency:
      `${urgency}Contactar administrador de insolvência e identificar gestor do processo. Preparar proposta de compra com liquidez imediata. Prazo recomendado: 5 dias úteis.`,
    inheritance:
      `${urgency}Identificar herdeiros via registo predial. Abordagem empática, solução rápida. Preparar avaliação de mercado e proposta de mandato exclusivo.`,
    divorce:
      `${urgency}Abordagem via advogado de família se possível. Apresentar vantagens de venda rápida e justa. Discreção total. Preparar avaliação em 48h.`,
    relocation:
      `Contactar proprietário com proposta de angariação exclusiva e timeline adaptado à mudança. Oferecer gestão do processo de venda completo.`,
    multi_property:
      `Mapear todos os imóveis do proprietário. Preparar análise de portfólio e proposta de gestão. Potencial mandato múltiplo.`,
    price_reduction:
      `Contactar agência concorrente ou proprietário com análise de mercado. Verificar se há oportunidade de co-exclusivo.`,
    stagnated_listing:
      `Imóvel > 180 dias no mercado. Contactar com análise de posicionamento e proposta de reactivação. Proprietário pode estar frustrado.`,
    new_below_avm:
      `Analisar imóvel abaixo do AVM. Verificar condição real. Se oportunidade confirmada, activar lista de investidores matching.`,
    listing_removed:
      `Imóvel removido pode indicar venda directa ou frustração. Contactar proprietário com proposta de mandato.`,
    hot_zone_new:
      `Nova listagem em zona de alta procura. Verificar se há clientes compradores com matching. Contactar agência para co-mediação.`,
  }

  return actions[type] ?? 'Investigar sinal e definir estratégia de abordagem.'
}

// ---------------------------------------------------------------------------
// Mock data — 20 realistic signals for Portugal luxury market
// ---------------------------------------------------------------------------

const MOCK_SIGNALS: Signal[] = [
  {
    id: 'sig_001',
    type: 'insolvency',
    priority: 5,
    probability_score: 85,
    property_address: 'Rua de São Bento 145, 1200-815 Lisboa',
    property_zone: 'Lisboa',
    estimated_value: 1_200_000,
    owner_name: 'Manuel Costa Lda.',
    signal_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'dre_parser',
    recommended_action: getRecommendedAction('insolvency', 5),
    status: 'new',
    score_breakdown: { type_score: 40, recency_score: 20, zone_score: 15, value_score: 10 },
    days_since_signal: 3,
  },
  {
    id: 'sig_002',
    type: 'inheritance',
    priority: 5,
    probability_score: 82,
    property_address: 'Avenida Marginal 3220, 2765-272 Estoril',
    property_zone: 'Cascais',
    estimated_value: 2_800_000,
    owner_name: 'Espólio Maria Fernanda Alves',
    signal_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'dre_parser',
    recommended_action: getRecommendedAction('inheritance', 5),
    status: 'new',
    score_breakdown: { type_score: 35, recency_score: 20, zone_score: 15, value_score: 10 },
    days_since_signal: 5,
  },
  {
    id: 'sig_003',
    type: 'divorce',
    priority: 4,
    probability_score: 72,
    property_address: 'Rua Castilho 22, 4°, 1250-070 Lisboa',
    property_zone: 'Lisboa',
    estimated_value: 875_000,
    owner_name: 'Privado',
    signal_date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'network',
    recommended_action: getRecommendedAction('divorce', 4),
    status: 'in_progress',
    score_breakdown: { type_score: 30, recency_score: 10, zone_score: 15, value_score: 7 },
    days_since_signal: 8,
  },
  {
    id: 'sig_004',
    type: 'relocation',
    priority: 4,
    probability_score: 68,
    property_address: 'Rua Quinta da Marinha 18, Cascais',
    property_zone: 'Cascais',
    estimated_value: 3_500_000,
    owner_name: 'Jonathan Whitfield',
    signal_date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'network',
    recommended_action: getRecommendedAction('relocation', 4),
    status: 'new',
    score_breakdown: { type_score: 25, recency_score: 10, zone_score: 15, value_score: 10 },
    days_since_signal: 12,
  },
  {
    id: 'sig_005',
    type: 'insolvency',
    priority: 5,
    probability_score: 88,
    property_address: 'Praça da Figueira 8, 1100-241 Lisboa',
    property_zone: 'Lisboa',
    estimated_value: 650_000,
    owner_name: 'Taberna Velha Restauração Lda.',
    signal_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'dre_parser',
    recommended_action: getRecommendedAction('insolvency', 5),
    status: 'new',
    score_breakdown: { type_score: 40, recency_score: 20, zone_score: 15, value_score: 7 },
    days_since_signal: 2,
  },
  {
    id: 'sig_006',
    type: 'multi_property',
    priority: 3,
    probability_score: 58,
    property_address: 'Múltiplos imóveis — Zona de Alvalade, Lisboa',
    property_zone: 'Lisboa',
    estimated_value: 1_800_000,
    owner_name: 'Carlos Alberto Mendes',
    signal_date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'market_monitor',
    recommended_action: getRecommendedAction('multi_property', 3),
    status: 'in_progress',
    score_breakdown: { type_score: 20, recency_score: 10, zone_score: 15, value_score: 10 },
    days_since_signal: 20,
  },
  {
    id: 'sig_007',
    type: 'inheritance',
    priority: 4,
    probability_score: 75,
    property_address: 'Rua da Bica de Duarte Belo 42, Lisboa',
    property_zone: 'Lisboa',
    estimated_value: 550_000,
    owner_name: 'Espólio João Pereira Silva',
    signal_date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'dre_parser',
    recommended_action: getRecommendedAction('inheritance', 4),
    status: 'new',
    score_breakdown: { type_score: 35, recency_score: 20, zone_score: 15, value_score: 7 },
    days_since_signal: 6,
  },
  {
    id: 'sig_008',
    type: 'stagnated_listing',
    priority: 3,
    probability_score: 45,
    property_address: 'Av. Dom João II, Lote 2.14, Lisboa',
    property_zone: 'Lisboa',
    estimated_value: 420_000,
    owner_name: 'Desconhecido',
    signal_date: new Date(Date.now() - 185 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'market_monitor',
    recommended_action: getRecommendedAction('stagnated_listing', 3),
    status: 'new',
    score_breakdown: { type_score: 12, recency_score: 0, zone_score: 15, value_score: 4 },
    days_since_signal: 185,
  },
  {
    id: 'sig_009',
    type: 'divorce',
    priority: 4,
    probability_score: 71,
    property_address: 'Vale do Lobo, Quinta do Lago, Algarve',
    property_zone: 'Algarve',
    estimated_value: 4_200_000,
    owner_name: 'Privado',
    signal_date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'network',
    recommended_action: getRecommendedAction('divorce', 4),
    status: 'new',
    score_breakdown: { type_score: 30, recency_score: 10, zone_score: 15, value_score: 10 },
    days_since_signal: 14,
  },
  {
    id: 'sig_010',
    type: 'new_below_avm',
    priority: 3,
    probability_score: 55,
    property_address: 'Rua do Patrocínio 18, Campo de Ourique, Lisboa',
    property_zone: 'Lisboa',
    estimated_value: 380_000,
    owner_name: null,
    signal_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'market_monitor',
    recommended_action: getRecommendedAction('new_below_avm', 3),
    status: 'new',
    score_breakdown: { type_score: 18, recency_score: 20, zone_score: 15, value_score: 4 },
    days_since_signal: 1,
  },
  {
    id: 'sig_011',
    type: 'insolvency',
    priority: 5,
    probability_score: 91,
    property_address: 'Rua Nova do Almada 72, Lisboa',
    property_zone: 'Lisboa',
    estimated_value: 1_500_000,
    owner_name: 'Investimentos Atlântico Lda.',
    signal_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'dre_parser',
    recommended_action: getRecommendedAction('insolvency', 5),
    status: 'new',
    score_breakdown: { type_score: 40, recency_score: 20, zone_score: 15, value_score: 10 },
    days_since_signal: 1,
  },
  {
    id: 'sig_012',
    type: 'relocation',
    priority: 3,
    probability_score: 55,
    property_address: 'Travessa de Santa Catarina 8, Porto',
    property_zone: 'Porto',
    estimated_value: 650_000,
    owner_name: 'Beatrice Fontaine',
    signal_date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'network',
    recommended_action: getRecommendedAction('relocation', 3),
    status: 'contacted',
    score_breakdown: { type_score: 25, recency_score: 10, zone_score: 10, value_score: 7 },
    days_since_signal: 25,
  },
  {
    id: 'sig_013',
    type: 'inheritance',
    priority: 4,
    probability_score: 78,
    property_address: 'Comporta, Alcácer do Sal',
    property_zone: 'Comporta',
    estimated_value: 5_800_000,
    owner_name: 'Espólio Família Rodrigues',
    signal_date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'dre_parser',
    recommended_action: getRecommendedAction('inheritance', 4),
    status: 'new',
    score_breakdown: { type_score: 35, recency_score: 20, zone_score: 15, value_score: 10 },
    days_since_signal: 4,
  },
  {
    id: 'sig_014',
    type: 'price_reduction',
    priority: 2,
    probability_score: 38,
    property_address: 'Rua da Misericórdia 44, Lisboa',
    property_zone: 'Lisboa',
    estimated_value: 290_000,
    owner_name: null,
    signal_date: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'market_monitor',
    recommended_action: getRecommendedAction('price_reduction', 2),
    status: 'dismissed',
    score_breakdown: { type_score: 15, recency_score: 5, zone_score: 15, value_score: 4 },
    days_since_signal: 40,
  },
  {
    id: 'sig_015',
    type: 'divorce',
    priority: 4,
    probability_score: 70,
    property_address: 'Quinta de Bucelas, Loures',
    property_zone: 'Lisboa',
    estimated_value: 1_100_000,
    owner_name: 'Privado',
    signal_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'network',
    recommended_action: getRecommendedAction('divorce', 4),
    status: 'in_progress',
    score_breakdown: { type_score: 30, recency_score: 10, zone_score: 15, value_score: 10 },
    days_since_signal: 10,
  },
  {
    id: 'sig_016',
    type: 'multi_property',
    priority: 3,
    probability_score: 50,
    property_address: '3 apartamentos — Matosinhos, Porto',
    property_zone: 'Porto',
    estimated_value: 900_000,
    owner_name: 'António Ferreira',
    signal_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'market_monitor',
    recommended_action: getRecommendedAction('multi_property', 3),
    status: 'new',
    score_breakdown: { type_score: 20, recency_score: 5, zone_score: 10, value_score: 7 },
    days_since_signal: 30,
  },
  {
    id: 'sig_017',
    type: 'insolvency',
    priority: 5,
    probability_score: 83,
    property_address: 'Rua Garrett 43, Chiado, Lisboa',
    property_zone: 'Lisboa',
    estimated_value: 2_100_000,
    owner_name: 'Galeria Arte Lisboa Lda.',
    signal_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'dre_parser',
    recommended_action: getRecommendedAction('insolvency', 5),
    status: 'new',
    score_breakdown: { type_score: 40, recency_score: 20, zone_score: 15, value_score: 10 },
    days_since_signal: 7,
  },
  {
    id: 'sig_018',
    type: 'listing_removed',
    priority: 2,
    probability_score: 32,
    property_address: 'Avenida Fontes Pereira de Melo, Lisboa',
    property_zone: 'Lisboa',
    estimated_value: 480_000,
    owner_name: null,
    signal_date: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'market_monitor',
    recommended_action: getRecommendedAction('listing_removed', 2),
    status: 'new',
    score_breakdown: { type_score: 10, recency_score: 5, zone_score: 15, value_score: 4 },
    days_since_signal: 50,
  },
  {
    id: 'sig_019',
    type: 'inheritance',
    priority: 3,
    probability_score: 62,
    property_address: 'Ericeira, Mafra',
    property_zone: 'Ericeira',
    estimated_value: 750_000,
    owner_name: 'Espólio António Gomes',
    signal_date: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'dre_parser',
    recommended_action: getRecommendedAction('inheritance', 3),
    status: 'in_progress',
    score_breakdown: { type_score: 35, recency_score: 10, zone_score: 5, value_score: 7 },
    days_since_signal: 22,
  },
  {
    id: 'sig_020',
    type: 'relocation',
    priority: 4,
    probability_score: 67,
    property_address: 'Funchal, Madeira',
    property_zone: 'Madeira',
    estimated_value: 850_000,
    owner_name: 'Thomas Mueller',
    signal_date: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'network',
    recommended_action: getRecommendedAction('relocation', 4),
    status: 'new',
    score_breakdown: { type_score: 25, recency_score: 10, zone_score: 10, value_score: 7 },
    days_since_signal: 9,
  },
]

// ---------------------------------------------------------------------------
// GET handler — list signals
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const statusFilter   = searchParams.get('status') as SignalStatus | null
    const typeFilter     = searchParams.get('type') as SignalType | null
    const minPriority    = parseInt(searchParams.get('min_priority') ?? '1', 10)
    const limit          = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)

    let signals = [...MOCK_SIGNALS]

    if (statusFilter) {
      signals = signals.filter((s) => s.status === statusFilter)
    }
    if (typeFilter) {
      signals = signals.filter((s) => s.type === typeFilter)
    }
    if (minPriority > 1) {
      signals = signals.filter((s) => s.priority >= minPriority)
    }

    // Sort: by priority desc, then probability_score desc
    signals.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority
      return b.probability_score - a.probability_score
    })

    return NextResponse.json({
      signals: signals.slice(0, limit),
      total: signals.length,
      generated_at: new Date().toISOString(),
      note: 'Mock data — production will use DR API + market scraper via FastAPI on Railway',
    })
  } catch (error) {
    console.error('[signals GET] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// POST handler — create new signal with auto-scoring
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await request.json()

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 })
    }

    const data = body as Record<string, unknown>

    // Validate required fields
    if (!data.type || typeof data.type !== 'string') {
      return NextResponse.json({ error: 'Field "type" is required' }, { status: 400 })
    }
    if (!data.property_address || typeof data.property_address !== 'string') {
      return NextResponse.json({ error: 'Field "property_address" is required' }, { status: 400 })
    }

    const validTypes: SignalType[] = [
      'inheritance', 'insolvency', 'divorce', 'relocation', 'multi_property',
      'price_reduction', 'stagnated_listing', 'new_below_avm', 'listing_removed', 'hot_zone_new'
    ]

    const signalType = data.type as string
    if (!validTypes.includes(signalType as SignalType)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const input: CreateSignalRequest = {
      type: signalType as SignalType,
      property_address: String(data.property_address).trim(),
      property_zone: typeof data.property_zone === 'string' ? data.property_zone.trim() : 'Desconhecido',
      owner_name: typeof data.owner_name === 'string' ? data.owner_name.trim() : undefined,
      estimated_value: typeof data.estimated_value === 'number' ? data.estimated_value :
                       typeof data.estimated_value === 'string' ? parseFloat(data.estimated_value) || undefined : undefined,
      signal_date: typeof data.signal_date === 'string' ? data.signal_date :
                   new Date().toISOString().split('T')[0],
      source: typeof data.source === 'string' ? data.source : 'manual',
      notes: typeof data.notes === 'string' ? data.notes : undefined,
    }

    const zone = input.property_zone ?? 'Desconhecido'
    const signalDate = input.signal_date ?? new Date().toISOString().split('T')[0]

    const { score, breakdown } = calculateSignalScore(
      input.type,
      zone,
      signalDate,
      input.estimated_value
    )

    const priority = scoreToPriority(score)
    const recommendedAction = getRecommendedAction(input.type, priority)

    const nowMs = Date.now()
    const signalMs = new Date(signalDate).getTime()
    const daysSince = Math.floor((nowMs - signalMs) / (1000 * 60 * 60 * 24))

    const newSignal: Signal = {
      id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: input.type,
      priority,
      probability_score: score,
      property_address: input.property_address,
      property_zone: zone,
      estimated_value: input.estimated_value ?? null,
      owner_name: input.owner_name ?? null,
      signal_date: signalDate,
      source: input.source ?? 'manual',
      recommended_action: recommendedAction,
      status: 'new',
      score_breakdown: breakdown,
      days_since_signal: daysSince,
    }

    // In production: INSERT INTO signals (supabase client call)
    return NextResponse.json(
      {
        signal: newSignal,
        message: 'Signal created and scored successfully',
        note: 'In production, this is persisted to Supabase signals table',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('[signals POST] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
