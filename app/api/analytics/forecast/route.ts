// =============================================================================
// Agency Group — Revenue Forecasting Engine
// GET /api/analytics/forecast
//
// Stage-probability-weighted pipeline forecast with:
//   - 30/60/90-day projected revenue
//   - Confidence intervals per scenario (pessimistic/base/optimistic)
//   - Close probability by deal based on fase + time-in-stage
//   - Deal velocity analysis (avg days per stage)
//   - At-risk deals (stalled > SLA threshold)
//
// Auth: requirePortalAuth
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Stage probability weights (calibrated to Portuguese RE market)
// ---------------------------------------------------------------------------
const STAGE_PROB: Record<string, number> = {
  contacto:        0.05,
  qualificacao:    0.15,
  qualificado:     0.15,
  visitaagendada:  0.30,
  visitarealizada: 0.40,
  proposta:        0.55,
  propostaaceite:  0.65,
  negociacao:      0.70,
  cpcv:            0.85,
  cpcvassinado:    0.90,
  escritura:       0.97,
  posvenda:        1.00,
  fechado:         1.00,
}

// Stage SLA (max days before it's "stalled")
const STAGE_SLA_DAYS: Record<string, number> = {
  contacto: 3, qualificacao: 7, qualificado: 7,
  visitaagendada: 5, visitarealizada: 10,
  proposta: 14, propostaaceite: 7, negociacao: 21,
  cpcv: 60, cpcvassinado: 60,
}

function normFase(s: unknown): string {
  return String(s ?? '').toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s\-_]+/g, '')
}

function getFaseProb(fase: unknown): number {
  const key = normFase(fase)
  if (STAGE_PROB[key]) return STAGE_PROB[key]
  for (const [k, v] of Object.entries(STAGE_PROB)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return 0.10  // unknown stage = 10% base probability
}

function getFaseSLA(fase: unknown): number {
  const key = normFase(fase)
  if (STAGE_SLA_DAYS[key]) return STAGE_SLA_DAYS[key]
  for (const [k, v] of Object.entries(STAGE_SLA_DAYS)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return 14  // default SLA
}

function parseValor(v: unknown): number {
  if (typeof v === 'number') return v
  return parseFloat(
    String(v ?? '0')
      .replace(/[^0-9.,]/g, '')        // keep digits, dots, commas
      .replace(/\.(?=\d{3})/g, '')     // remove PT thousands-separator dots (1.000.000 → 1000000)
      .replace(',', '.')               // PT decimal comma → dot
  ) || 0
}

function isClosedFase(f: unknown): boolean {
  const n = normFase(f)
  return n.includes('escritura') || n.includes('fechado') || n.includes('posvenda')
}

// ---------------------------------------------------------------------------
// Avg days to close from each stage (velocity model)
// ---------------------------------------------------------------------------
const AVG_DAYS_TO_CLOSE: Record<string, number> = {
  contacto: 120, qualificacao: 90, qualificado: 80,
  visitaagendada: 75, visitarealizada: 65,
  proposta: 45, propostaaceite: 35, negociacao: 30,
  cpcv: 60, cpcvassinado: 55,
  escritura: 7, posvenda: 0, fechado: 0,
}

function getDaysToClose(fase: unknown): number {
  const key = normFase(fase)
  if (AVG_DAYS_TO_CLOSE[key] != null) return AVG_DAYS_TO_CLOSE[key]
  for (const [k, v] of Object.entries(AVG_DAYS_TO_CLOSE)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return 90
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

  try {
    // ── Fetch all open deals ────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawDeals, error } = await (supabaseAdmin as any)
      .from('deals')
      .select('id, imovel, comprador, fase, valor, expected_fee, realized_fee, updated_at, created_at, agent_email')
      .not('fase', 'ilike', '%cancelad%')
      .not('fase', 'ilike', '%perdido%')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const allDeals = (rawDeals ?? []) as Record<string, unknown>[]
    const openDeals   = allDeals.filter(d => !isClosedFase(d.fase))
    const closedDeals = allDeals.filter(d => isClosedFase(d.fase))

    const now = Date.now()

    // ── Per-deal probability calculation ────────────────────────────────────
    const dealForecasts = openDeals.map(deal => {
      const baseProb      = getFaseProb(deal.fase)
      const valor         = parseValor(deal.valor)
      const expectedFee   = Number(deal.expected_fee) || valor * 0.05
      const updatedAt     = deal.updated_at ? new Date(String(deal.updated_at)).getTime() : now
      const daysSinceMove = Math.floor((now - updatedAt) / 86_400_000)
      const slaDays       = getFaseSLA(deal.fase)

      // Time-decay factor: if stalled > SLA, reduce probability by up to 30%
      const staleness = daysSinceMove > slaDays
        ? Math.max(0.7, 1 - ((daysSinceMove - slaDays) / (slaDays * 3)) * 0.3)
        : 1.0

      const adjustedProb   = Math.min(baseProb * staleness, 1.0)
      const daysToClose    = getDaysToClose(deal.fase)
      const isAtRisk       = daysSinceMove > slaDays
      const expectedRevenue = expectedFee * adjustedProb

      return {
        id:              deal.id,
        imovel:          deal.imovel ?? deal.comprador ?? 'Unknown',
        fase:            deal.fase,
        agent_email:     deal.agent_email,
        valor,
        expected_fee:    expectedFee,
        base_probability: Math.round(baseProb * 100),
        adjusted_probability: Math.round(adjustedProb * 100),
        days_since_move:  daysSinceMove,
        sla_days:         slaDays,
        is_at_risk:       isAtRisk,
        days_to_close:    daysToClose,
        expected_revenue: Math.round(expectedRevenue),
      }
    })

    // ── Scenario projections ─────────────────────────────────────────────────
    // Pessimistic: 70% of adjusted_prob per deal
    // Base:        adjusted_prob as-is
    // Optimistic:  adjusted_prob × 1.25 (capped at 95%)

    const pipelineBase       = dealForecasts.reduce((s, d) => s + d.expected_revenue, 0)
    const pipelinePessimistic = dealForecasts.reduce((s, d) => s + d.expected_fee * Math.min(d.adjusted_probability / 100 * 0.70, 1.0), 0)
    const pipelineOptimistic  = dealForecasts.reduce((s, d) => s + d.expected_fee * Math.min(d.adjusted_probability / 100 * 1.25, 0.95), 0)

    // ── 30/60/90-day windows ────────────────────────────────────────────────
    const in30 = dealForecasts.filter(d => d.days_to_close <= 30)
    const in60 = dealForecasts.filter(d => d.days_to_close <= 60)
    const in90 = dealForecasts.filter(d => d.days_to_close <= 90)

    const forecastWindow = (deals: typeof dealForecasts) => ({
      count: deals.length,
      total_valor: Math.round(deals.reduce((s, d) => s + d.valor, 0)),
      expected_revenue: Math.round(deals.reduce((s, d) => s + d.expected_revenue, 0)),
    })

    // ── Closed deals performance ────────────────────────────────────────────
    const closedRevenue = closedDeals.reduce((s, d) => {
      const fee = Number(d.realized_fee) || Number(d.expected_fee) || parseValor(d.valor) * 0.05
      return s + fee
    }, 0)

    // ── At-risk deals ────────────────────────────────────────────────────────
    const atRiskDeals = dealForecasts
      .filter(d => d.is_at_risk)
      .sort((a, b) => b.expected_revenue - a.expected_revenue)
      .slice(0, 10)

    // ── Stage distribution ───────────────────────────────────────────────────
    const stageDistribution: Record<string, { count: number; valor: number; expected_revenue: number }> = {}
    for (const d of dealForecasts) {
      const fase = String(d.fase ?? 'Sem fase')
      if (!stageDistribution[fase]) stageDistribution[fase] = { count: 0, valor: 0, expected_revenue: 0 }
      stageDistribution[fase].count++
      stageDistribution[fase].valor         += d.valor
      stageDistribution[fase].expected_revenue += d.expected_revenue
    }

    return NextResponse.json({
      generated_at: new Date().toISOString(),

      // ── Summary ──
      summary: {
        open_deals:    openDeals.length,
        closed_deals:  closedDeals.length,
        at_risk_deals: atRiskDeals.length,
        closed_revenue_total: Math.round(closedRevenue),
      },

      // ── Pipeline scenarios ──
      pipeline: {
        pessimistic:  Math.round(pipelinePessimistic),
        base:         Math.round(pipelineBase),
        optimistic:   Math.round(pipelineOptimistic),
      },

      // ── Time windows ──
      forecast: {
        '30_days': forecastWindow(in30),
        '60_days': forecastWindow(in60),
        '90_days': forecastWindow(in90),
      },

      // ── Stage breakdown ──
      stage_distribution: Object.entries(stageDistribution)
        .map(([fase, stats]) => ({
          fase,
          probability_pct: Math.round(getFaseProb(fase) * 100),
          ...stats,
          expected_revenue: Math.round(stats.expected_revenue),
        }))
        .sort((a, b) => b.expected_revenue - a.expected_revenue),

      // ── At-risk deals ──
      at_risk_deals: atRiskDeals,

      // ── All deal forecasts (full details) ──
      deals: dealForecasts
        .sort((a, b) => b.expected_revenue - a.expected_revenue)
        .slice(0, 50),
    })

  } catch (e) {
    return NextResponse.json({
      error: e instanceof Error ? e.message : 'Internal error',
    }, { status: 500 })
  }
}
