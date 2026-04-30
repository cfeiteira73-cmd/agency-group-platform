import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isPortalAuth } from '@/lib/portalAuth'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { safeCompare } from '@/lib/safeCompare'

function isBearerAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') ?? ''
  const secrets = [
    process.env.PORTAL_API_SECRET,
    process.env.CRON_SECRET,
    process.env.ADMIN_SECRET,
  ].filter(Boolean) as string[]
  return secrets.some(s => safeCompare(authHeader, `Bearer ${s}`))
}

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

// ─── Market insights pool (static context, rotates daily) ────────────────────

const MARKET_INSIGHTS = [
  'Lisboa mantém-se top 5 mundial em luxo — compradores norte-americanos aumentaram 18% YoY. Imóveis em Príncipe Real e Chiado têm DOM médio de 45 dias.',
  'Mercado Algarve: procura britânica resiliente pós-Brexit. Propriedades €1M-€2M em Quinta do Lago com 3+ inquiries/semana vendem em média em 38 dias.',
  'Porto consolida-se como alternativa premium a Lisboa: €3.643/m² mediana (+14% YoY). Bonfim e Cedofeita lideram procura de compradores franceses.',
  'Taxas BCE em descida — actividade crédito habitação +23% em Q1. Janela de oportunidade para buyers com financing pendente.',
  'Mercado Madeira: crescimento 31% em transacções premium. Funchal e Calheta com procura alemã e nórdica emergente.',
  'Compradores brasileiros: segmento mais activo em €200K-€500K. Lisboa e Porto dividem quota. Motivação principal: NHR + qualidade de vida.',
  'Investidores Médio Oriente activos em activos €3M+. Deal flow virado para Lisboa riverfront, Cascais e Comporta. Yield mínimo exigido: 4,5%.',
  'Temporada alta aproxima-se: histórico mostra +34% de inquiries Março-Junho. Pipeline de Abril/Maio tende a fechar em Julho-Agosto.',
  'Mercado comparáveis: propriedades com renovação recente vendem +22% acima mediana zona. Buyers premium pagam prémio por turnkey.',
  'Cascais: €4.713/m² mediana mas linha Estoril regista transacções €8K-€12K/m² em primeira linha. Compradores nórdicos e alemães dominam.',
]

// ─── Claude AI brief generation ────────────────────────────────────────────

const BRIEF_SYSTEM = `És um assistente de produtividade para agentes imobiliários da Agency Group (AMI 22506).
Analisas dados reais do CRM e géneras briefings diários accionáveis.
Segmento: €100K–€100M | Comissão: 5% | Core €500K–€3M | Portugal + Espanha + Madeira + Açores.
Responde SEMPRE em JSON válido, sem markdown, sem texto adicional fora do JSON.`

interface LeadRow {
  id: string
  status: string
  created_at: string
  contact_name?: string
  budget?: number
  zona?: string
  score?: number
  last_contact?: string
}

interface DealRow {
  id: string
  fase?: string   // portal-compat column (PT stage name)
  imovel?: string
  comprador?: string
  valor?: string | number  // TEXT in portal-compat ("€ 1.250.000") or BIGINT
  updated_at?: string      // used to compute dias_sem_actividade
}

interface PropertyRow {
  id: string
  nome?: string
  preco?: number
  zona?: string
  status: string
  dias_mercado?: number
}

async function generateAIBrief(
  dateStr: string,
  leads: LeadRow[],
  deals: DealRow[],
  properties: PropertyRow[],
  marketInsight: string
): Promise<Partial<DailyBrief>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return {}

  const client = new Anthropic({ apiKey })

  const BRIEF_SYSTEM_CACHED = `És um assistente de produtividade para agentes imobiliários da Agency Group (AMI 22506).
Analisas dados reais do CRM e géneras briefings diários accionáveis.
Segmento: €100K–€100M | Comissão: 5% | Core €500K–€3M | Portugal + Espanha + Madeira + Açores.
Responde SEMPRE em JSON válido, sem markdown, sem texto adicional fora do JSON.`

  const prompt = `Data: ${dateStr}

DADOS REAIS DO CRM:

Novos leads hoje: ${leads.length}
${leads.length > 0 ? leads.slice(0, 10).map(l =>
    `- ${l.contact_name ?? 'Lead'} | Status: ${l.status} | Budget: €${(l.budget ?? 0).toLocaleString('pt-PT')} | Zona: ${l.zona ?? '?'} | Score: ${l.score ?? 0}`
  ).join('\n') : '(sem leads hoje)'}

Deals activos no pipeline: ${deals.length}
${deals.length > 0 ? deals.slice(0, 10).map(d => {
    const valorNum = typeof d.valor === 'number' ? d.valor
      : parseFloat(String(d.valor ?? '0').replace(/[^0-9.]/g, '')) || 0
    const diasSemActividade = d.updated_at
      ? Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 86_400_000)
      : 0
    return `- ${d.comprador ?? d.imovel ?? 'Deal'} | Fase: ${d.fase ?? '?'} | Valor: €${valorNum.toLocaleString('pt-PT')} | Dias sem actividade: ${diasSemActividade}`
  }).join('\n') : '(sem deals activos)'}

Propriedades activas: ${properties.length}
${properties.slice(0, 5).map(p =>
    `- ${p.nome ?? p.id} | €${(p.preco ?? 0).toLocaleString('pt-PT')} | ${p.zona ?? '?'} | ${p.dias_mercado ?? 0} dias no mercado`
  ).join('\n')}

Insight de mercado hoje: ${marketInsight}

Gera o daily brief em JSON com esta estrutura EXACTA:
{
  "headline": "frase curta de 1 linha sobre o estado do pipeline",
  "priority_actions": [
    {
      "priority": 1,
      "action": "o que fazer",
      "contact_name": "nome do contacto",
      "reason": "porquê esta acção agora",
      "estimated_time_minutes": 15,
      "potential_gci": 25000
    }
  ],
  "pipeline_summary": {
    "total_weighted_gci": 450000,
    "deals_at_risk": 2,
    "deals_closing_30d": 1,
    "new_leads_24h": ${leads.length}
  },
  "market_insight": "${marketInsight.replace(/"/g, "'")}",
  "ai_recommendation": "recomendação específica baseada nos dados reais de hoje",
  "time_allocation": {
    "calls_minutes": 45,
    "emails_minutes": 30,
    "visits_scheduled": 1,
    "admin_minutes": 30
  }
}

Regras:
- Máximo 5 priority_actions, ordenadas por urgência
- potential_gci = 5% do valor do deal (comissão AG)
- deals_at_risk = deals com >7 dias sem actividade ou probability <30%
- deals_closing_30d = deals com expected_close nos próximos 30 dias
- total_weighted_gci = soma(valor × probability/100) de todos os deals
- Se não há dados suficientes, usa valores razoáveis baseados no mercado PT`

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1500,
      system: [
        {
          type: 'text' as const,
          text: BRIEF_SYSTEM_CACHED,
          cache_control: { type: 'ephemeral' as const },
        },
      ],
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()

    // Strip markdown fences if present
    const clean = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim()
    const parsed = JSON.parse(clean) as Partial<DailyBrief>
    return parsed
  } catch (err) {
    console.error('[daily-brief] Claude error:', err)
    return {}
  }
}

// ─── Seeded fallback (used when Supabase/Claude not available) ─────────────

function seededRandom(seed: number): () => number {
  let s = seed
  return function () {
    s = (s * 1103515245 + 12345) & 0x7fffffff
    return s / 0x7fffffff
  }
}

function generateFallbackBrief(date: Date, marketInsight: string): DailyBrief {
  const dateSeed =
    date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
  const rng = seededRandom(dateSeed)
  const dateStr = date.toISOString().split('T')[0]

  const total_weighted_gci = Math.floor(rng() * 370000) + 280000
  const deals_at_risk = Math.floor(rng() * 4) + 1
  const deals_closing_30d = Math.floor(rng() * 3) + 1
  const new_leads_24h = Math.floor(rng() * 6) + 1

  return {
    date: dateStr,
    headline: `${new_leads_24h} leads novos · €${(total_weighted_gci / 1000).toFixed(0)}K GCI ponderado · ${deals_at_risk} deals em risco`,
    priority_actions: [
      {
        priority: 1,
        action: 'Ligar — confirmar disponibilidade visita esta semana',
        contact_name: 'Lead prioritário',
        reason: 'Score máximo, sem contacto há 2 dias — risco de resfriamento',
        estimated_time_minutes: 15,
        potential_gci: 25000,
      },
      {
        priority: 2,
        action: 'Email — seguimento proposta enviada há 48h',
        contact_name: 'Prospect em negociação',
        reason: 'Proposta em aberto sem resposta — janela crítica',
        estimated_time_minutes: 10,
        potential_gci: 18000,
      },
    ],
    pipeline_summary: { total_weighted_gci, deals_at_risk, deals_closing_30d, new_leads_24h },
    market_insight: marketInsight,
    ai_recommendation: 'Foca nos leads com score >80 que não foram contactados nas últimas 48h.',
    time_allocation: {
      calls_minutes: 45,
      emails_minutes: 25,
      visits_scheduled: Math.floor(rng() * 2),
      admin_minutes: Math.floor(rng() * 25) + 20,
    },
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse<DailyBrief | { error: string }>> {
  // Accept: CRON/internal bearer token, NextAuth admin session, or portal magic-link cookie
  const bearerOk = isBearerAuthorized(request)
  if (!bearerOk) {
    const session = await auth()
    if (!session?.user && !(await isPortalAuth(request))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
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

    const dateStr = targetDate.toISOString().split('T')[0]
    const dateSeed =
      targetDate.getFullYear() * 10000 +
      (targetDate.getMonth() + 1) * 100 +
      targetDate.getDate()
    const marketInsight = MARKET_INSIGHTS[dateSeed % MARKET_INSIGHTS.length]

    // ── Real Supabase queries ─────────────────────────────────────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      // No Supabase configured — return seeded fallback
      const brief = generateFallbackBrief(targetDate, marketInsight)
      return NextResponse.json(brief, {
        headers: { 'Cache-Control': 'private, max-age=300' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Today's window
    const todayStart = new Date(targetDate)
    todayStart.setHours(0, 0, 0, 0)
    const todayStartISO = todayStart.toISOString()

    // Fetch real data in parallel — graceful on individual failures
    const [leadsRes, dealsRes, propertiesRes] = await Promise.allSettled([
      supabase
        .from('leads')
        .select('id, status, created_at, contact_name, budget, zona, score, last_contact')
        .gte('created_at', todayStartISO),
      supabase
        .from('deals')
        .select('id, fase, imovel, comprador, valor, updated_at')
        .not('fase', 'ilike', '%fechado%')
        .not('fase', 'ilike', '%perdido%')
        .not('fase', 'ilike', '%escritura%'),
      supabase
        .from('properties')
        .select('id, nome, preco, zona, status, dias_mercado')
        .eq('status', 'active')
        .limit(20),
    ])

    const todayLeads: LeadRow[] =
      leadsRes.status === 'fulfilled' ? (leadsRes.value.data as LeadRow[] ?? []) : []
    const activeDeals: DealRow[] =
      dealsRes.status === 'fulfilled' ? (dealsRes.value.data as DealRow[] ?? []) : []
    const activeProperties: PropertyRow[] =
      propertiesRes.status === 'fulfilled' ? (propertiesRes.value.data as PropertyRow[] ?? []) : []

    // Log any Supabase errors without failing the whole request
    if (leadsRes.status === 'fulfilled' && leadsRes.value.error) {
      console.warn('[daily-brief] leads query error:', leadsRes.value.error.message)
    }
    if (dealsRes.status === 'fulfilled' && dealsRes.value.error) {
      console.warn('[daily-brief] deals query error:', dealsRes.value.error.message)
    }
    if (propertiesRes.status === 'fulfilled' && propertiesRes.value.error) {
      console.warn('[daily-brief] properties query error:', propertiesRes.value.error.message)
    }

    // ── Generate AI brief with real data ─────────────────────────────────────
    const aiBrief = await generateAIBrief(
      dateStr,
      todayLeads,
      activeDeals,
      activeProperties,
      marketInsight
    )

    // ── Merge AI output with computed metrics (portal-compat schema) ─────────
    // Compute days-stale from updated_at; no probability column in portal schema
    const FASE_PROBA: Record<string, number> = {
      contacto: 10, qualificacao: 20, qualificado: 20,
      visita: 35, propostaaceite: 55, proposta: 50,
      negociacao: 65, cpcv: 85, cpcvassinado: 85, escritura: 95, posvenda: 100,
    }
    const fasePct = (fase?: string): number => {
      const key = (fase ?? '').toLowerCase().replace(/[^a-z]/g, '')
      return FASE_PROBA[key] ?? 50
    }
    const dealsAtRisk = activeDeals.filter(d => {
      const diasSemActividade = d.updated_at
        ? Math.floor((Date.now() - new Date(d.updated_at).getTime()) / 86_400_000)
        : 0
      return diasSemActividade > 7 || fasePct(d.fase) < 30
    }).length

    // No expected_close in portal schema — approximate via CPCV deals closing in 30d
    const dealsClosing30d = activeDeals.filter(d =>
      (d.fase ?? '').toLowerCase().includes('cpcv') ||
      (d.fase ?? '').toLowerCase().includes('escritura')
    ).length

    const parseValorNum = (v: string | number | undefined): number => {
      if (typeof v === 'number') return v
      return parseFloat(String(v ?? '0').replace(/[^0-9.]/g, '')) || 0
    }
    const totalWeightedGCI = activeDeals.reduce(
      (sum, d) => sum + parseValorNum(d.valor) * 0.05 * (fasePct(d.fase) / 100),
      0
    )

    const brief: DailyBrief = {
      date: dateStr,
      headline:
        aiBrief.headline ??
        `${todayLeads.length} leads hoje · ${activeDeals.length} deals activos · €${(totalWeightedGCI / 1000).toFixed(0)}K GCI ponderado`,
      priority_actions:
        aiBrief.priority_actions && aiBrief.priority_actions.length > 0
          ? aiBrief.priority_actions.slice(0, 5)
          : generateFallbackBrief(targetDate, marketInsight).priority_actions,
      pipeline_summary: {
        total_weighted_gci: Math.round(totalWeightedGCI) || (aiBrief.pipeline_summary?.total_weighted_gci ?? 0),
        deals_at_risk: dealsAtRisk || (aiBrief.pipeline_summary?.deals_at_risk ?? 0),
        deals_closing_30d: dealsClosing30d || (aiBrief.pipeline_summary?.deals_closing_30d ?? 0),
        new_leads_24h: todayLeads.length || (aiBrief.pipeline_summary?.new_leads_24h ?? 0),
      },
      market_insight: aiBrief.market_insight ?? marketInsight,
      ai_recommendation:
        aiBrief.ai_recommendation ??
        'Foca nos deals com maior probabilidade de fecho nos próximos 30 dias.',
      time_allocation: aiBrief.time_allocation ?? {
        calls_minutes: 45,
        emails_minutes: 30,
        visits_scheduled: 1,
        admin_minutes: 30,
      },
    }

    return NextResponse.json(brief, {
      status: 200,
      headers: {
        // Cache for 10 minutes — real data, no point serving stale for too long
        'Cache-Control': 'private, max-age=600, stale-while-revalidate=300',
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
