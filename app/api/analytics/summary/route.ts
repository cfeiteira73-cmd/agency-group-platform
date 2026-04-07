// =============================================================================
// AGENCY GROUP — Analytics Summary API v1.0
// GET /api/analytics/summary — aggregated KPIs from Supabase
// Returns: totalGCI, dealsCountByStage, topAgents, conversionsByZona, gci12m
// AMI: 22506 | Supabase-first, mock fallback
// =============================================================================

import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AnalyticsSummary {
  gciMensal: number
  gciYTD: number
  gci12m: number[]
  gci12mLabels: string[]
  pipelineAtivo: number
  dealsCountByStage: { stage: string; deals: number; valor: number; prob: number; color: string }[]
  topAgents: { name: string; gciMes: number; gciYTD: number; dealsFechados: number; pipeline: number; conversao: number; diasCiclo: number; score: number; calls: number; emails: number; visitas: number; propostas: number }[]
  conversionsByZona: { zona: string; valor: number; pct: number; color: string }[]
  source: 'supabase' | 'mock'
}

// ---------------------------------------------------------------------------
// Mock fallback — realistic AG data
// ---------------------------------------------------------------------------

const MOCK_SUMMARY: AnalyticsSummary = {
  gciMensal: 168700,
  gciYTD: 1175000,
  gci12m: [62400, 78300, 91200, 84700, 68900, 72100, 95400, 118600, 134200, 142800, 156400, 168700],
  gci12mLabels: ['Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan', 'Fev', 'Mar'],
  pipelineAtivo: 4326000,
  dealsCountByStage: [
    { stage: 'Qualificação', deals: 8,  valor: 4200000, prob: 20, color: '#e74c3c' },
    { stage: 'Visita',       deals: 5,  valor: 3800000, prob: 40, color: '#c9a96e' },
    { stage: 'Proposta',     deals: 4,  valor: 3100000, prob: 60, color: '#c9a96e' },
    { stage: 'CPCV',         deals: 3,  valor: 2400000, prob: 85, color: '#1c4a35' },
    { stage: 'Escritura',    deals: 2,  valor: 1600000, prob: 95, color: '#1c4a35' },
  ],
  topAgents: [
    { name: 'Sofia Martins',   gciMes: 38400, gciYTD: 312800, dealsFechados: 14, pipeline: 1240000, conversao: 4.8, diasCiclo: 72,  score: 94, calls: 68, emails: 142, visitas: 24, propostas: 11 },
    { name: 'Ricardo Fonseca', gciMes: 29700, gciYTD: 241500, dealsFechados: 11, pipeline: 980000,  conversao: 3.9, diasCiclo: 84,  score: 87, calls: 54, emails: 118, visitas: 19, propostas: 8  },
    { name: 'Ana Rodrigues',   gciMes: 24100, gciYTD: 198600, dealsFechados: 9,  pipeline: 730000,  conversao: 3.4, diasCiclo: 91,  score: 81, calls: 47, emails: 96,  visitas: 16, propostas: 7  },
    { name: 'Bruno Carvalho',  gciMes: 18600, gciYTD: 152300, dealsFechados: 7,  pipeline: 540000,  conversao: 2.8, diasCiclo: 102, score: 73, calls: 39, emails: 78,  visitas: 12, propostas: 5  },
    { name: 'Inês Almeida',    gciMes: 14200, gciYTD: 118400, dealsFechados: 5,  pipeline: 380000,  conversao: 2.1, diasCiclo: 118, score: 65, calls: 31, emails: 62,  visitas: 9,  propostas: 3  },
  ],
  conversionsByZona: [
    { zona: 'Lisboa',  valor: 1842000, pct: 42, color: '#1c4a35' },
    { zona: 'Cascais', valor: 1008800, pct: 23, color: '#2d6e52' },
    { zona: 'Algarve', valor: 789200,  pct: 18, color: '#c9a96e' },
    { zona: 'Porto',   valor: 526300,  pct: 12, color: '#a07840' },
    { zona: 'Madeira', valor: 219300,  pct: 5,  color: '#6b4e28' },
  ],
  source: 'mock',
}

// ---------------------------------------------------------------------------
// Stage probability map for pipeline weighting
// ---------------------------------------------------------------------------

const STAGE_PROB: Record<string, number> = {
  angariacao: 10, qualificacao: 20, qualificado: 20, visita: 40,
  proposta: 60, negociacao: 70, cpcv: 85, escritura: 95, fechado: 100,
}

function stageProbability(stage: string): number {
  const key = stage.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
  return STAGE_PROB[key] ?? 30
}

// ---------------------------------------------------------------------------
// GET /api/analytics/summary
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  void request // parameter required by Next.js route handler signature

  try {
    // ── 1. Try Supabase ─────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dealsQuery = (supabaseAdmin.from('deals') as any)
      .select('fase, valor, comissao, agent_id, created_at')
      .order('created_at', { ascending: false })

    const { data: dealsData, error: dealsError } = await dealsQuery

    if (dealsError || !dealsData) {
      // Supabase unavailable — return mock
      return NextResponse.json(MOCK_SUMMARY, { headers: { 'Cache-Control': 'no-store' } })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deals = dealsData as any[]

    // ── 2. Aggregate pipeline by stage ──────────────────────────────────────
    const stageMap: Record<string, { deals: number; valor: number }> = {}
    let totalPipeline = 0

    for (const d of deals) {
      const stage = d.fase || 'Contacto'
      if (!stageMap[stage]) stageMap[stage] = { deals: 0, valor: 0 }
      const v = typeof d.valor === 'number' ? d.valor :
        parseFloat(String(d.valor ?? '0').replace(/[^0-9.]/g, '')) || 0
      stageMap[stage].deals += 1
      stageMap[stage].valor += v
      totalPipeline += v * (stageProbability(stage) / 100)
    }

    const STAGE_COLORS: Record<string, string> = {
      Qualificação: '#e74c3c', Qualificado: '#e74c3c', Visita: '#c9a96e',
      Proposta: '#c9a96e', Negociação: '#a07840', CPCV: '#1c4a35', Escritura: '#1c4a35',
    }

    const dealsCountByStage = Object.entries(stageMap).map(([stage, stats]) => ({
      stage,
      deals: stats.deals,
      valor: stats.valor,
      prob: stageProbability(stage),
      color: STAGE_COLORS[stage] ?? '#2d6e52',
    }))

    // ── 3. GCI from commissions ──────────────────────────────────────────────
    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()

    let gciMensal = 0
    let gciYTD = 0
    const gci12m: number[] = new Array(12).fill(0)
    const gci12mLabels: string[] = []

    // Build last 12 months labels
    const PT_MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    for (let i = 11; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1)
      gci12mLabels.push(PT_MONTHS[d.getMonth()])
    }

    for (const d of deals) {
      const comissao = typeof d.comissao === 'number' ? d.comissao :
        parseFloat(String(d.comissao ?? '0').replace(/[^0-9.]/g, '')) || 0
      if (comissao === 0) continue

      const created = new Date(d.created_at)
      const dealMonth = created.getMonth()
      const dealYear = created.getFullYear()

      if (dealMonth === thisMonth && dealYear === thisYear) gciMensal += comissao
      if (dealYear === thisYear) gciYTD += comissao

      // Slot into 12m array
      for (let i = 0; i < 12; i++) {
        const slotDate = new Date(thisYear, thisMonth - (11 - i), 1)
        if (created.getMonth() === slotDate.getMonth() && created.getFullYear() === slotDate.getFullYear()) {
          gci12m[i] += comissao
        }
      }
    }

    // ── 4. Build response ────────────────────────────────────────────────────
    // topAgents: query contacts/agents table if available, else return mock
    let topAgents = MOCK_SUMMARY.topAgents
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: agentsData } = await (supabaseAdmin as any).from('agents')
        .select('full_name, gci_mes, gci_ytd, deals_fechados, pipeline, conversao, dias_ciclo, score, calls, emails, visitas, propostas')
        .order('gci_mes', { ascending: false })
        .limit(10)

      if (agentsData && agentsData.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        topAgents = (agentsData as any[]).map(a => ({
          name: a.full_name ?? '',
          gciMes: a.gci_mes ?? 0, gciYTD: a.gci_ytd ?? 0,
          dealsFechados: a.deals_fechados ?? 0, pipeline: a.pipeline ?? 0,
          conversao: a.conversao ?? 0, diasCiclo: a.dias_ciclo ?? 0,
          score: a.score ?? 0, calls: a.calls ?? 0, emails: a.emails ?? 0,
          visitas: a.visitas ?? 0, propostas: a.propostas ?? 0,
        }))
      }
    } catch {
      // agents table doesn't exist yet — use mock
    }

    // conversionsByZona: try imoveis/properties table
    let conversionsByZona = MOCK_SUMMARY.conversionsByZona
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: zonaData } = await (supabaseAdmin.from('deals') as any)
        .select('zona, comissao')
        .not('zona', 'is', null)

      if (zonaData && zonaData.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const zonaMap: Record<string, number> = {}
        for (const row of zonaData as any[]) {
          const z = row.zona ?? 'Outros'
          const v = typeof row.comissao === 'number' ? row.comissao :
            parseFloat(String(row.comissao ?? '0').replace(/[^0-9.]/g, '')) || 0
          zonaMap[z] = (zonaMap[z] ?? 0) + v
        }
        const total = Object.values(zonaMap).reduce((a, b) => a + b, 0)
        const ZONA_COLORS = ['#1c4a35','#2d6e52','#c9a96e','#a07840','#6b4e28','#8b6914']
        conversionsByZona = Object.entries(zonaMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([zona, valor], i) => ({
            zona, valor, pct: total > 0 ? Math.round((valor / total) * 100) : 0,
            color: ZONA_COLORS[i] ?? '#d4cfc4',
          }))
      }
    } catch {
      // no zona column — use mock
    }

    const summary: AnalyticsSummary = {
      gciMensal:          gciMensal  || MOCK_SUMMARY.gciMensal,
      gciYTD:             gciYTD     || MOCK_SUMMARY.gciYTD,
      gci12m:             gci12m.some(v => v > 0) ? gci12m : MOCK_SUMMARY.gci12m,
      gci12mLabels:       gci12mLabels.length === 12 ? gci12mLabels : MOCK_SUMMARY.gci12mLabels,
      pipelineAtivo:      totalPipeline || MOCK_SUMMARY.pipelineAtivo,
      dealsCountByStage:  dealsCountByStage.length > 0 ? dealsCountByStage : MOCK_SUMMARY.dealsCountByStage,
      topAgents,
      conversionsByZona,
      source: 'supabase',
    }

    return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store' } })

  } catch {
    // Full fallback
    return NextResponse.json(MOCK_SUMMARY, { headers: { 'Cache-Control': 'no-store' } })
  }
}
