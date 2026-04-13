// =============================================================================
// Agency Group — Minimal Buyer Intake (World-Class)
// POST /api/buyers/create-minimal
//
// INPUT MÍNIMO (2 campos obrigatórios):
//   nome           * required
//   budget_max     * required
//   budget_min       optional (default: budget_max * 0.5)
//   zonas            optional (array de strings ou string separada por vírgulas)
//   tipo             optional (investor / end_user / family_office / hnwi)
//   phone            optional
//   email            optional
//   liquidity        optional (immediate / under_30_days / financed / unknown)
//   notes            optional
//
// AUTO-COMPUTE:
//   buyer_score         — calculado no momento (simplificado)
//   buyer_tier          — A/B/C baseado em budget + liquidez
//   buyer_ready_for_deal — TRUE se budget + zonas + liquidez presentes
//   buyer_readiness_score — 0-100
//   active_status        — 'active'
//
// VALIDATION:
//   Se faltar budget: marcar como "incomplete", não entra no matching
//   Se faltar zonas: entra mas com match reduzido
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'

export const runtime = 'nodejs'

// ── Auth ─────────────────────────────────────────────────────────────────────
async function isAuthorized(req: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET
  const incoming = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
  if (cronSecret && incoming === cronSecret) return true
  const session = await auth()
  return !!session
}

// ── Buyer tier from budget ────────────────────────────────────────────────────
function computeBuyerTier(budgetMax: number, budgetMin: number, liquidityProfile: string): 'A' | 'B' | 'C' {
  const isImmediate = ['immediate', 'under_30_days'].includes(liquidityProfile)
  if (budgetMax >= 3_000_000 || (budgetMax >= 1_500_000 && isImmediate)) return 'A'
  if (budgetMax >= 800_000 || (budgetMax >= 500_000 && isImmediate)) return 'B'
  return 'C'
}

// ── Buyer score (simplified inline, no DB round-trip needed) ─────────────────
function computeBuyerScore(
  budgetMax: number,
  liquidityProfile: string,
  zonas: string[],
  tipoComprador: string,
): number {
  let score = 0

  // Budget (max 35)
  if (budgetMax >= 3_000_000)      score += 35
  else if (budgetMax >= 1_500_000) score += 28
  else if (budgetMax >= 800_000)   score += 20
  else if (budgetMax >= 500_000)   score += 14
  else                              score += 7

  // Liquidity (max 35)
  if (liquidityProfile === 'immediate')      score += 35
  else if (liquidityProfile === 'under_30_days') score += 25
  else if (liquidityProfile === 'financed')  score += 15
  else                                        score += 5

  // Zonas defined (max 15)
  score += zonas.length > 0 ? 15 : 5

  // Buyer type (max 15)
  if (['family_office', 'hnwi'].includes(tipoComprador))   score += 15
  else if (tipoComprador === 'investor')                    score += 12
  else                                                      score += 7

  return Math.min(100, score)
}

// ── Buyer readiness score ─────────────────────────────────────────────────────
function computeReadinessScore(
  hasBudget: boolean,
  hasZonas: boolean,
  hasLiquidity: boolean,
  hasContact: boolean,
): number {
  let r = 0
  if (hasBudget)   r += 40
  if (hasZonas)    r += 25
  if (hasLiquidity) r += 20
  if (hasContact)  r += 15
  return r
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!(await isAuthorized(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const s = supabaseAdmin as any

  try {
    const body = await req.json() as Record<string, unknown>

    // ── Validation ───────────────────────────────────────────────────
    const nome = typeof body.nome === 'string' ? body.nome.trim() : null
    if (!nome || nome.length < 2) {
      return NextResponse.json({ error: 'nome é obrigatório' }, { status: 400 })
    }

    const budget_max = typeof body.budget_max === 'number' && body.budget_max > 0
      ? Math.round(body.budget_max)
      : null

    const budget_min = typeof body.budget_min === 'number' && body.budget_min > 0
      ? Math.round(body.budget_min)
      : budget_max ? Math.round(budget_max * 0.5) : null

    if (!budget_max) {
      return NextResponse.json({ error: 'budget_max é obrigatório' }, { status: 400 })
    }

    // ── Zonas parsing (accept array or comma-separated string) ────────
    let zonas: string[] = []
    if (Array.isArray(body.zonas)) {
      zonas = (body.zonas as unknown[]).map(z => String(z).trim()).filter(Boolean)
    } else if (typeof body.zonas === 'string' && body.zonas.trim()) {
      zonas = body.zonas.split(',').map(z => z.trim()).filter(Boolean)
    }

    // ── Liquidity inference ──────────────────────────────────────────
    let liquidity_profile = 'unknown'
    if (typeof body.liquidity === 'string') {
      liquidity_profile = body.liquidity
    } else if (budget_max >= 1_000_000) {
      // Large budgets typically have immediate liquidity
      liquidity_profile = 'unknown' // don't assume, but flag for enrichment
    }

    const tipo_comprador = typeof body.tipo === 'string' ? body.tipo : 'investor'
    const phone   = typeof body.phone === 'string' ? body.phone.trim() : null
    const email   = typeof body.email === 'string' ? body.email.trim() : null
    const notes   = typeof body.notes === 'string' ? body.notes.trim() : null

    // ── Auto-compute ─────────────────────────────────────────────────
    const buyer_score = computeBuyerScore(budget_max, liquidity_profile, zonas, tipo_comprador)
    const buyer_tier  = computeBuyerTier(budget_max, budget_min ?? 0, liquidity_profile)
    const readiness   = computeReadinessScore(
      !!budget_max,
      zonas.length > 0,
      liquidity_profile !== 'unknown',
      !!(phone || email),
    )
    const buyer_ready_for_deal = readiness >= 60

    // ── Determine status ─────────────────────────────────────────────
    const hasMinimumData = !!(budget_max && nome)
    const active_status  = hasMinimumData ? 'active' : 'inactive'
    const lead_status    = buyer_ready_for_deal ? 'active' : 'nurturing'

    // ── Insert contact ────────────────────────────────────────────────
    const insertPayload: Record<string, unknown> = {
      full_name:          nome,
      name:               nome,
      phone:              phone ?? null,
      email:              email ?? null,
      budget_min,
      budget_max,
      zonas:              zonas.length > 0 ? zonas : null,
      preferred_locations: zonas.length > 0 ? zonas : null,
      buyer_type:         tipo_comprador,
      liquidity_profile,
      active_status,
      status:             lead_status,
      lead_tier:          buyer_tier,
      buyer_score,
      buyer_readiness_score:  readiness,
      buyer_ready_for_deal,
      buyer_scored_at:    new Date().toISOString(),
      notes:              notes ?? null,
      origin:             'manual',
      last_contact_at:    new Date().toISOString(),
    }

    const { data: contact, error: insertErr } = await s
      .from('contacts')
      .insert(insertPayload)
      .select('id, full_name, email, phone, budget_min, budget_max')
      .single()

    if (insertErr || !contact) {
      console.error('[buyers/create-minimal] Insert error:', insertErr)
      return NextResponse.json({ error: insertErr?.message ?? 'Erro ao criar buyer' }, { status: 500 })
    }

    console.log(`[buyers/create-minimal] Buyer criado: ${contact.id} — "${contact.full_name}" tier=${buyer_tier} score=${buyer_score}`)

    // ── Status label ─────────────────────────────────────────────────
    const readinessLabel = readiness >= 80 ? 'READY'
      : readiness >= 60 ? 'MEDIUM'
      : 'LOW'

    return NextResponse.json({
      success:     true,
      buyer_id:    contact.id,
      nome:        contact.full_name,
      computed: {
        buyer_score,
        buyer_tier,
        buyer_readiness_score:  readiness,
        buyer_ready_for_deal,
        readiness_label:        readinessLabel,
        liquidity_profile,
        active_status,
      },
      gaps: {
        no_zonas:    zonas.length === 0,
        no_phone:    !phone,
        no_email:    !email,
        no_liquidity: liquidity_profile === 'unknown',
      },
      recommendation: buyer_ready_for_deal
        ? `✅ BUYER PRONTO — entra no matching imediato`
        : `⚠ BUYER INCOMPLETO — ${zonas.length === 0 ? 'adicionar zonas · ' : ''}${liquidity_profile === 'unknown' ? 'definir liquidez · ' : ''}${!phone && !email ? 'adicionar contacto' : ''}`,
      created_at: new Date().toISOString(),
    }, { status: 201 })

  } catch (err) {
    console.error('[buyers/create-minimal] Error:', err)
    return NextResponse.json({ error: 'Internal error', details: String(err) }, { status: 500 })
  }
}
