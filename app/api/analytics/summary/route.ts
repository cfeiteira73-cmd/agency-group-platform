// =============================================================================
// AGENCY GROUP — Analytics Summary API v1.0
// GET /api/analytics/summary — aggregated KPIs from Supabase
// Returns: totalGCI, dealsCountByStage, topAgents, conversionsByZona, gci12m
// AMI: 22506 | Supabase-first, mock fallback
// =============================================================================

import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { auth } from '@/auth'
import { isPortalAuth } from '@/lib/portalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { getStageProbability, COMMISSION_RATE } from '@/lib/constants/pipeline'

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
  source: 'supabase' | 'mock' | 'unavailable'
  // ── Period-over-period deltas (undefined when previous period has no data) ──
  gciMensalDelta?: number      // % change vs previous calendar month
  gciMensalPrev?: number       // previous month absolute GCI (for context)
  dealsMonthDelta?: number     // % change in deal count vs previous month
}

// ---------------------------------------------------------------------------
// Empty summary \u2014 returned when DB is unavailable (no fake metrics)
// ---------------------------------------------------------------------------

const PT_MONTHS_CONST = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const EMPTY_SUMMARY: AnalyticsSummary = {
  gciMensal: 0, gciYTD: 0,
  gci12m:        new Array(12).fill(0) as number[],
  gci12mLabels:  PT_MONTHS_CONST,
  pipelineAtivo: 0,
  dealsCountByStage: [],
  topAgents:         [],
  conversionsByZona: [],
  source: 'unavailable',
}

// Stage probability \u2014 delegates to canonical lib/constants/pipeline

// ---------------------------------------------------------------------------
// GET /api/analytics/summary
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  // Accept NextAuth session (admin) OR portal magic-link cookie (agents)
  const session = await auth()
  if (!session?.user && !(await isPortalAuth(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  void request // parameter required by Next.js route handler signature

  try {
    // Tenant scope — summary must never aggregate cross-tenant deals
    const tenantId = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'

    // ── 1. Try Supabase ─────────────────────────────────────────────────────
    // Confirmed production columns (migration 003 + 20260426_002):
    //   fase (TEXT), valor (TEXT "€ 1.250.000"), expected_fee (NUMERIC), realized_fee (NUMERIC)
    // comissao does NOT exist in this schema — use fee chain instead
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dealsQuery = (supabaseAdmin.from('deals') as any)
      .select('fase, valor, expected_fee, realized_fee, agent_id, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })

    const { data: dealsData, error: dealsError } = await dealsQuery

    if (dealsError || !dealsData) {
      // Supabase unavailable — return honest empty response (no fake metrics)
      console.warn('[analytics/summary] deals query failed:', dealsError?.message ?? 'no data')
      return NextResponse.json(
        { ...EMPTY_SUMMARY, source: 'unavailable' as const },
        { headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // Helper: extract commission fee from a deal (mirrors revenue route logic)
    // Priority: realized_fee → expected_fee → valor × 5%
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dealCommission = (d: any): number => {
      if (typeof d.realized_fee === 'number' && d.realized_fee > 0) return d.realized_fee
      if (typeof d.expected_fee === 'number' && d.expected_fee > 0) return d.expected_fee
      const raw = typeof d.valor === 'number'
        ? d.valor
        : parseFloat(String(d.valor ?? '0').replace(/[^0-9.]/g, '')) || 0
      return raw * COMMISSION_RATE
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
      totalPipeline += v * getStageProbability(stage)
    }

    const STAGE_COLORS: Record<string, string> = {
      Qualificação: '#e74c3c', Qualificado: '#e74c3c', Visita: '#c9a96e',
      Proposta: '#c9a96e', Negociação: '#a07840', CPCV: '#1c4a35', Escritura: '#1c4a35',
    }

    const dealsCountByStage = Object.entries(stageMap).map(([stage, stats]) => ({
      stage,
      deals: stats.deals,
      valor: stats.valor,
      prob: Math.round(getStageProbability(stage) * 100),
      color: STAGE_COLORS[stage] ?? '#2d6e52',
    }))

    // ── 3. GCI from commissions ──────────────────────────────────────────────
    const now = new Date()
    const thisMonth = now.getMonth()
    const thisYear = now.getFullYear()

    let gciMensal = 0
    let gciMensalPrev = 0  // previous calendar month
    let gciYTD = 0
    let dealsThisMonth = 0
    let dealsPrevMonth = 0
    const gci12m: number[] = new Array(12).fill(0)
    const gci12mLabels: string[] = []

    // Previous month (handles January → December wrap)
    const prevMonth     = thisMonth === 0 ? 11 : thisMonth - 1
    const prevMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear

    // Build last 12 months labels
    const PT_MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
    for (let i = 11; i >= 0; i--) {
      const d = new Date(thisYear, thisMonth - i, 1)
      gci12mLabels.push(PT_MONTHS[d.getMonth()])
    }

    for (const d of deals) {
      const comissao = dealCommission(d)

      const created   = new Date(d.created_at)
      const dealMonth = created.getMonth()
      const dealYear  = created.getFullYear()

      // Current month
      if (dealMonth === thisMonth && dealYear === thisYear) {
        if (comissao > 0) gciMensal += comissao
        dealsThisMonth += 1
      }
      // Previous month
      if (dealMonth === prevMonth && dealYear === prevMonthYear) {
        if (comissao > 0) gciMensalPrev += comissao
        dealsPrevMonth += 1
      }

      if (comissao === 0) continue  // skip YTD / 12m for zero-fee deals
      if (dealYear === thisYear) gciYTD += comissao

      // Slot into 12m array
      for (let i = 0; i < 12; i++) {
        const slotDate = new Date(thisYear, thisMonth - (11 - i), 1)
        if (created.getMonth() === slotDate.getMonth() && created.getFullYear() === slotDate.getFullYear()) {
          gci12m[i] += comissao
        }
      }
    }

    // ── Period-over-period deltas ────────────────────────────────────────────
    // Safe guard: undefined when previous period has no data (avoids division by zero)
    const gciMensalDelta: number | undefined =
      gciMensalPrev > 0
        ? Math.round(((gciMensal - gciMensalPrev) / gciMensalPrev) * 1000) / 10  // 1 dp
        : undefined
    const dealsMonthDelta: number | undefined =
      dealsPrevMonth > 0
        ? Math.round(((dealsThisMonth - dealsPrevMonth) / dealsPrevMonth) * 1000) / 10
        : undefined

    // ── 4. Build response ────────────────────────────────────────────────────
    // topAgents: try `agents` table first; fall back to deriving from deal packs
    // (agent_email on deal_packs is the most reliable agent activity signal)
    let topAgents: AnalyticsSummary['topAgents'] = []
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- agents table columns not in typed schema
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
      } else {
        throw new Error('agents table empty — derive from deal_packs')
      }
    } catch {
      // agents table doesn't exist — derive from deal_packs agent activity
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: packData } = await supabaseAdmin
          .from('deal_packs')
          .select('created_by, status, created_at')
          .not('created_by', 'is', null)
          .limit(500)

        if (packData && packData.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const agentMap: Record<string, { packs: number; sent: number; viewed: number }> = {}
          for (const p of packData as any[]) {
            const email = String(p.created_by ?? 'unknown')
            if (!agentMap[email]) agentMap[email] = { packs: 0, sent: 0, viewed: 0 }
            agentMap[email].packs++
            if (p.status === 'sent')   agentMap[email].sent++
            if (p.status === 'viewed') agentMap[email].viewed++
          }
          topAgents = Object.entries(agentMap)
            .sort((a, b) => b[1].sent - a[1].sent)
            .slice(0, 5)
            .map(([email, stats]) => ({
              name:          email.split('@')[0] ?? email,
              gciMes:        0,  // requires closed deals with agent attribution
              gciYTD:        0,
              dealsFechados: 0,
              pipeline:      0,
              conversao:     stats.packs > 0 ? Math.round((stats.viewed / stats.packs) * 100) / 10 : 0,
              diasCiclo:     0,
              score:         Math.min(100, stats.packs * 10 + stats.viewed * 15),
              calls:         0,
              emails:        stats.sent,
              visitas:       0,
              propostas:     stats.packs,
            }))
        }
      } catch {
        // topAgents stays as [] — no mock fallback (zero fake metrics mandate)
      }
    }

    // conversionsByZona: group closed deals by zona/imovel prefix
    // Note: zona column may not exist (migration 003 doesn't add it to deals)
    // Fallback: aggregate by fase='escritura/fechado' across all deals
    let conversionsByZona: AnalyticsSummary['conversionsByZona'] = []
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: zonaData } = await (supabaseAdmin.from('deals') as any)
        .select('zona, zone, valor, realized_fee, expected_fee')
        .not('zona', 'is', null)

      if (zonaData && zonaData.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const zonaMap: Record<string, number> = {}
        for (const row of zonaData as any[]) {
          const z = row.zona ?? row.zone ?? 'Outros'
          const v = dealCommission(row)
          zonaMap[z] = (zonaMap[z] ?? 0) + v
        }
        const total = Object.values(zonaMap).reduce((a, b) => a + b, 0)
        if (total > 0) {
          const ZONA_COLORS = ['#1c4a35','#2d6e52','#c9a96e','#a07840','#6b4e28','#8b6914']
          conversionsByZona = Object.entries(zonaMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 6)
            .map(([zona, valor], i) => ({
              zona, valor, pct: Math.round((valor / total) * 100),
              color: ZONA_COLORS[i] ?? '#d4cfc4',
            }))
        }
      }
    } catch {
      // no zona column — use mock
    }

    // Wave 19: use real data only — no mock fallbacks (zero fake metrics mandate)
    const summary: AnalyticsSummary = {
      gciMensal,
      gciYTD,
      gci12m,
      gci12mLabels:       gci12mLabels.length === 12 ? gci12mLabels : EMPTY_SUMMARY.gci12mLabels,
      pipelineAtivo:      totalPipeline,
      dealsCountByStage,
      topAgents,
      conversionsByZona,
      source:             'supabase',
      // Deltas are only set when real previous-period data exists.
      // undefined means "no prior data available" — frontend must NOT show a delta.
      gciMensalDelta,
      gciMensalPrev:      gciMensalPrev  > 0 ? gciMensalPrev  : undefined,
      dealsMonthDelta,
    }

    return NextResponse.json(summary, { headers: { 'Cache-Control': 'no-store' } })

  } catch {
    // Full fallback — return honest empty response (no fake metrics)
    return NextResponse.json(
      { ...EMPTY_SUMMARY, source: 'unavailable' as const },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
