// =============================================================================
// Agency Group — Buyer Matching 2.0 for Off-Market Leads
// POST /api/offmarket-leads/[id]/match-buyers
// FASE 13: Budget 35 + Zone 25 + Asset 15 + Tier 15 + Speed/Liquidity 10
// Stores: primary/secondary/tertiary buyer IDs, deal_priority_score,
//         attack_recommendation, matched_buyers_count, best_buyer_match_score
// GET /api/offmarket-leads/[id]/match-buyers → current stored match data
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'

const TABLE = 'offmarket_leads'
const CONTACTS_TABLE = 'contacts'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OffmarketLead {
  id: string
  nome: string
  tipo_ativo?: string | null
  cidade?: string | null
  localizacao?: string | null
  price_estimate?: number | null
  price_ask?: number | null
  area_m2?: number | null
  score?: number | null
  urgency?: string | null
  status?: string | null
}

interface Contact {
  id: string
  full_name: string
  email?: string | null
  phone?: string | null
  whatsapp?: string | null
  budget_min?: number | null
  budget_max?: number | null
  preferred_locations?: string[] | null   // actual contacts column
  typologies_wanted?: string[] | null     // actual contacts column
  status?: string | null
  lead_tier?: string | null
  lead_score?: number | null
  // Buyer Intelligence fields (migration 007)
  buyer_type?: string | null
  liquidity_profile?: string | null       // immediate | under_30_days | financed | unknown
  proof_of_funds_status?: string | null
  ticket_preference?: string | null
  deals_closed_count?: number | null
  avg_close_days?: number | null
  reliability_score?: number | null
  response_rate?: number | null
  buyer_score?: number | null
  active_status?: string | null
}

interface BuyerMatchV2 {
  contact_id: string
  name: string
  match_score: number
  match_breakdown: {
    budget: number
    zone: number
    asset: number
    tier: number
    speed_liquidity: number
  }
  match_reasons: string[]
  budget_range: string
  contact: string           // phone or email
  whatsapp?: string | null
  // Buyer intelligence summary
  lead_tier: string
  buyer_score: number
  liquidity_profile: string
  avg_close_days: number | null
  buyer_type: string
  deals_closed_count: number
  // Triage role
  triage_role?: 'fastest_close' | 'strongest_budget' | 'strategic_fit'
}

// ---------------------------------------------------------------------------
// NFD Normalization helper
// ---------------------------------------------------------------------------

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// ---------------------------------------------------------------------------
// Matching algorithm — FASE 13 Matching 2.0
// Budget 35 + Zone 25 + Asset 15 + Tier 15 + Speed/Liquidity 10 = 100
// ---------------------------------------------------------------------------

function matchBuyerToLead(contact: Contact, lead: OffmarketLead): BuyerMatchV2 | null {
  let budgetPts = 0
  let zonePts = 0
  let assetPts = 0
  let tierPts = 0
  let speedPts = 0
  const reasons: string[] = []

  // ── 1. Budget Fit (max 35 pts) ────────────────────────────────────────────
  const assetPrice = lead.price_estimate ?? lead.price_ask
  if (assetPrice && (contact.budget_max || contact.budget_min)) {
    const bMax = contact.budget_max ?? Infinity
    const bMin = contact.budget_min ?? 0

    if (assetPrice <= bMax && assetPrice >= bMin) {
      budgetPts = 35
      reasons.push('orçamento compatível 100%')
    } else if (assetPrice <= bMax * 1.15 && assetPrice >= bMin) {
      budgetPts = 22
      reasons.push('orçamento próximo (+15%)')
    } else if (assetPrice <= bMax * 1.30 && assetPrice >= bMin * 0.5) {
      budgetPts = 10
      reasons.push('orçamento esticável (+30%)')
    } else {
      budgetPts = 0
    }
  } else if (!contact.budget_max && !contact.budget_min) {
    // No budget data — soft assumption: possible match
    budgetPts = 12
    reasons.push('orçamento não definido — potencial')
  }

  // ── 2. Zone Fit (max 25 pts) ─────────────────────────────────────────────
  const buyerZones = contact.preferred_locations
  if (buyerZones && buyerZones.length > 0) {
    const leadZone = norm(`${lead.cidade ?? ''} ${lead.localizacao ?? ''}`)

    const hasExact = buyerZones.some(z => {
      const zn = norm(z)
      const leadParts = leadZone.split(/[\s,]+/).filter(p => p.length > 2)
      return leadZone.includes(zn) || zn.includes(leadZone) || leadParts.some(p => zn.includes(p))
    })

    const hasPartial = !hasExact && buyerZones.some(z => {
      const zn = norm(z)
      const zoneParts = zn.split(/[\s,]+/).filter(p => p.length > 2)
      return zoneParts.some(p => leadZone.includes(p))
    })

    const isFlexible = buyerZones.some(z => {
      const zl = z.toLowerCase()
      return zl.includes('qualquer') || zl.includes('any') || zl.includes('todo') || zl.includes('portugal')
    })

    if (hasExact) {
      zonePts = 25
      reasons.push(`zona match (${buyerZones.slice(0, 2).join('/')})`)
    } else if (hasPartial) {
      zonePts = 15
      reasons.push('zona parcial')
    } else if (isFlexible) {
      zonePts = 10
      reasons.push('zona flexível — todo Portugal')
    } else {
      zonePts = 0
    }
  } else {
    // No zone preference = open buyer
    zonePts = 8
    reasons.push('sem preferência de zona')
  }

  // ── 3. Asset Type Fit (max 15 pts) ───────────────────────────────────────
  const buyerTypes = contact.typologies_wanted
  if (buyerTypes && buyerTypes.length > 0 && lead.tipo_ativo) {
    const tipoNorm = norm(lead.tipo_ativo)
    const hasExact = buyerTypes.some(t => {
      const tl = norm(t)
      return tl.includes(tipoNorm) || tipoNorm.includes(tl)
    })
    const hasOpen = buyerTypes.some(t => {
      const tl = t.toLowerCase()
      return tl.includes('qualquer') || tl.includes('any') || tl.includes('all')
    })

    if (hasExact) {
      assetPts = 15
      reasons.push(`tipo match (${lead.tipo_ativo})`)
    } else if (hasOpen) {
      assetPts = 8
      reasons.push('tipo flexível')
    } else {
      assetPts = 0
    }
  } else if (!buyerTypes || buyerTypes.length === 0) {
    assetPts = 5  // no preference = neutral
  } else {
    assetPts = 0
  }

  // ── 4. Buyer Tier (max 15 pts) ───────────────────────────────────────────
  if (contact.lead_tier === 'A') {
    tierPts = 15
    reasons.push('comprador Tier A')
  } else if (contact.lead_tier === 'B') {
    tierPts = 8
    reasons.push('comprador Tier B')
  } else if (contact.lead_tier === 'C') {
    tierPts = 3
    reasons.push('comprador Tier C')
  }

  // ── 5. Speed / Liquidity (max 10 pts) ────────────────────────────────────
  const liquidity = contact.liquidity_profile ?? 'unknown'
  const bScore = contact.buyer_score ?? 0

  if (liquidity === 'immediate' && bScore >= 70) {
    speedPts = 10
    reasons.push('liquidez imediata + score forte')
  } else if (liquidity === 'immediate') {
    speedPts = 8
    reasons.push('liquidez imediata')
  } else if (liquidity === 'under_30_days') {
    speedPts = 6
    reasons.push('liquidez <30 dias')
  } else if (liquidity === 'financed' && bScore >= 50) {
    speedPts = 4
    reasons.push('financiamento pré-aprovado')
  } else if (liquidity === 'financed') {
    speedPts = 2
    reasons.push('financiamento pendente')
  } else {
    speedPts = 1
  }

  const finalScore = Math.min(100, budgetPts + zonePts + assetPts + tierPts + speedPts)

  // Minimum threshold: must have budget or zone + minimum score
  if (finalScore < 25) return null
  // If budget is 0 (hard miss) and score is below 40 — skip
  if (budgetPts === 0 && finalScore < 40) return null

  // Build budget range label
  const budgetRange = contact.budget_min && contact.budget_max
    ? `€${(contact.budget_min / 1000).toFixed(0)}K–€${(contact.budget_max / 1000).toFixed(0)}K`
    : contact.budget_max
    ? `até €${(contact.budget_max / 1000).toFixed(0)}K`
    : contact.budget_min
    ? `a partir de €${(contact.budget_min / 1000).toFixed(0)}K`
    : 'Orçamento não definido'

  const contactStr = contact.phone ?? contact.email ?? 'sem contacto'

  return {
    contact_id: contact.id,
    name: contact.full_name,
    match_score: finalScore,
    match_breakdown: { budget: budgetPts, zone: zonePts, asset: assetPts, tier: tierPts, speed_liquidity: speedPts },
    match_reasons: reasons,
    budget_range: budgetRange,
    contact: contactStr,
    whatsapp: contact.whatsapp ?? contact.phone ?? null,
    // Buyer intelligence
    lead_tier: contact.lead_tier ?? 'C',
    buyer_score: contact.buyer_score ?? 0,
    liquidity_profile: contact.liquidity_profile ?? 'unknown',
    avg_close_days: contact.avg_close_days ?? null,
    buyer_type: contact.buyer_type ?? 'buyer',
    deals_closed_count: contact.deals_closed_count ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Triage: assign strategic roles to top 3 buyers
// ---------------------------------------------------------------------------

function assignTriageRoles(top3: BuyerMatchV2[]): BuyerMatchV2[] {
  if (top3.length === 0) return top3

  // fastest_close: lowest avg_close_days among those with data
  const withDays = top3.filter(b => b.avg_close_days !== null)
  const fastestIdx = withDays.length > 0
    ? top3.indexOf(withDays.reduce((a, b) => (a.avg_close_days! < b.avg_close_days! ? a : b)))
    : 0

  // strongest_budget: highest budget_max (parse from range or use buyer_score as proxy)
  const strongestIdx = top3.reduce((bestIdx, b, idx) => {
    const curr = top3[bestIdx]
    // Tier A with highest match_breakdown.budget
    if (b.match_breakdown.budget > curr.match_breakdown.budget) return idx
    if (b.match_breakdown.budget === curr.match_breakdown.budget && b.lead_tier < curr.lead_tier) return idx
    return bestIdx
  }, 0)

  // strategic_fit: highest overall match_score not already assigned
  const assignedSet = new Set([fastestIdx, strongestIdx])
  let strategicIdx = top3.findIndex((_, idx) => !assignedSet.has(idx))
  if (strategicIdx === -1) strategicIdx = 0  // fallback to best

  const result = top3.map((b, idx) => ({ ...b }))
  result[fastestIdx] = { ...result[fastestIdx], triage_role: 'fastest_close' }
  if (strongestIdx !== fastestIdx) {
    result[strongestIdx] = { ...result[strongestIdx], triage_role: 'strongest_budget' }
  }
  if (strategicIdx !== fastestIdx && strategicIdx !== strongestIdx && result[strategicIdx]) {
    result[strategicIdx] = { ...result[strategicIdx], triage_role: 'strategic_fit' }
  }

  return result
}

// ---------------------------------------------------------------------------
// Attack recommendation generator
// ---------------------------------------------------------------------------

function generateAttackRecommendation(
  lead: OffmarketLead,
  topBuyer: BuyerMatchV2 | undefined
): string {
  if (!topBuyer) {
    return 'Sem compradores compatíveis. Enriquecer base de compradores ou ajustar preço/zona.'
  }

  const score = lead.score ?? 0
  const buyerTier = topBuyer.lead_tier
  const liquidity = topBuyer.liquidity_profile
  const closeDays = topBuyer.avg_close_days

  const urgencyLabel = liquidity === 'immediate' ? 'liquidez imediata' :
                       liquidity === 'under_30_days' ? 'liquidez <30 dias' : 'financiamento'

  if (score >= 80 && buyerTier === 'A' && liquidity === 'immediate') {
    return `ATAQUE IMEDIATO — ${topBuyer.name} (Tier A, ${urgencyLabel}, ${topBuyer.match_score}/100). Contactar em 15min via ${topBuyer.whatsapp ? 'WhatsApp' : 'email'}. Preço ask: confirmar hoje.`
  }

  if (score >= 70 && buyerTier === 'A') {
    return `ALTA PRIORIDADE — ${topBuyer.name} (Tier A, ${urgencyLabel}, ${topBuyer.match_score}/100). Contactar dentro de 1h. Qualificar interesse e agendar visita esta semana.`
  }

  if (score >= 60 && (buyerTier === 'A' || buyerTier === 'B')) {
    const closeEstimate = closeDays ? ` — fecho estimado em ${closeDays} dias` : ''
    return `EXECUTAR HOJE — ${topBuyer.name} (Tier ${buyerTier}, ${topBuyer.match_score}/100${closeEstimate}). Enviar info do ativo. Follow-up em 24h.`
  }

  if (score >= 50) {
    return `PIPELINE ATIVO — ${topBuyer.name} (Tier ${buyerTier}, ${topBuyer.match_score}/100). Qualificar compradores e apresentar oportunidade. Follow-up em 2–3 dias.`
  }

  return `NURTURE — ${topBuyer.name} (score ${topBuyer.match_score}/100). Manter contacto. Rever lead ao enriquecer com mais dados.`
}

// ---------------------------------------------------------------------------
// Deal Priority Score calculation (mirrors SQL function in migration 007)
// ---------------------------------------------------------------------------

function calcDealPriorityScore(
  leadScore: number | null,
  bestBuyerMatchScore: number,
  topBuyerTier: string | null,
  urgency: string | null
): number {
  const ls = Math.min(100, Math.max(0, leadScore ?? 0))
  const bms = Math.min(100, Math.max(0, bestBuyerMatchScore))

  const tierScore = topBuyerTier === 'A' ? 100 :
                    topBuyerTier === 'B' ? 65 :
                    topBuyerTier === 'C' ? 35 : 0

  const urgencyScore = urgency === 'immediate' ? 100 :
                       urgency === 'high' ? 75 :
                       urgency === 'medium' ? 50 :
                       urgency === 'low' ? 25 : 30

  return Math.round((ls * 0.40) + (bms * 0.30) + (tierScore * 0.20) + (urgencyScore * 0.10))
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    // ── Fetch lead ──────────────────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lead, error: leadError } = await (supabaseAdmin as any).from(TABLE)
      .select('id, nome, tipo_ativo, cidade, localizacao, price_estimate, price_ask, area_m2, score, urgency, status')
      .eq('id', id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // ── Fetch buyer contacts with intelligence fields ────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: contacts, error: contactsError } = await (supabaseAdmin as any)
      .from(CONTACTS_TABLE)
      .select([
        'id', 'full_name', 'email', 'phone', 'whatsapp',
        'budget_min', 'budget_max',
        'preferred_locations', 'typologies_wanted',
        'status', 'lead_tier', 'lead_score',
        // Buyer intelligence (migration 007 — gracefully absent if not yet migrated)
        'buyer_type', 'liquidity_profile', 'proof_of_funds_status',
        'deals_closed_count', 'avg_close_days',
        'reliability_score', 'response_rate', 'buyer_score', 'active_status',
      ].join(', '))
      .in('status', ['active', 'prospect', 'lead', 'qualified', 'negotiating', 'client', 'vip'])
      .or('role.is.null,role.eq.buyer')
      .order('lead_score', { ascending: false })
      .limit(500)

    if (contactsError) throw contactsError

    // ── Run Matching 2.0 ────────────────────────────────────────────────────
    const matches: BuyerMatchV2[] = []
    for (const contact of (contacts ?? [])) {
      const match = matchBuyerToLead(contact as Contact, lead as OffmarketLead)
      if (match) matches.push(match)
    }

    // Sort by match score (desc), then by buyer_score (desc) as tiebreaker
    matches.sort((a, b) =>
      b.match_score !== a.match_score
        ? b.match_score - a.match_score
        : b.buyer_score - a.buyer_score
    )

    const top5 = matches.slice(0, 5)
    const top3 = assignTriageRoles(top5.slice(0, 3))

    const bestScore = top5[0]?.match_score ?? 0
    const primary   = top3[0] ?? null
    const secondary = top3[1] ?? null
    const tertiary  = top3[2] ?? null

    // ── Build notes ─────────────────────────────────────────────────────────
    const buyerNotes = top5.length > 0
      ? top5.slice(0, 3)
          .map(m => `${m.name} (${m.match_score}/100 — ${m.budget_range} — Tier ${m.lead_tier})`)
          .join(' | ')
      : 'Sem compradores compatíveis encontrados'

    const attackRec = generateAttackRecommendation(lead as OffmarketLead, primary ?? undefined)

    // ── Deal Priority Score ─────────────────────────────────────────────────
    const dealPriorityScore = calcDealPriorityScore(
      lead.score,
      bestScore,
      primary?.lead_tier ?? null,
      lead.urgency
    )

    // ── Buyer triad notes (for PortalDealDesk) ──────────────────────────────
    const buyerTriadNotes = top3.length > 0
      ? top3.map((b, i) =>
          `${['A', 'B', 'C'][i]}: ${b.name} | ${b.match_score}/100 | Tier ${b.lead_tier} | ${b.liquidity_profile} | ${b.avg_close_days ? b.avg_close_days + 'd close' : '—'}`
        ).join('\n')
      : null

    // ── Update lead with full buyer match data ──────────────────────────────
    const updatePayload: Record<string, unknown> = {
      matched_buyers_count:  matches.length,
      best_buyer_match_score: bestScore,
      buyer_match_notes:     buyerNotes,
      matched_to_buyers:     matches.length > 0 && bestScore >= 60,
      buyer_matched_at:      new Date().toISOString(),
      attack_recommendation: attackRec,
      deal_priority_score:   dealPriorityScore,
      buyer_triad_notes:     buyerTriadNotes,
    }

    // Only write buyer IDs if we have them (migration 007 columns)
    if (primary)   updatePayload.primary_buyer_id   = primary.contact_id
    if (secondary) updatePayload.secondary_buyer_id = secondary.contact_id
    if (tertiary)  updatePayload.tertiary_buyer_id  = tertiary.contact_id

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updatedLead, error: updateError } = await (supabaseAdmin as any).from(TABLE)
      .update(updatePayload)
      .eq('id', id)
      .select('id, nome, score, matched_buyers_count, best_buyer_match_score, matched_to_buyers, preclose_candidate, outreach_ready, deal_priority_score')
      .single()

    if (updateError) {
      // Non-fatal: migration 007 columns may not exist yet — retry with base fields
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any).from(TABLE)
        .update({
          matched_buyers_count:   matches.length,
          best_buyer_match_score: bestScore,
          buyer_match_notes:      buyerNotes,
          matched_to_buyers:      matches.length > 0 && bestScore >= 60,
          buyer_matched_at:       new Date().toISOString(),
        })
        .eq('id', id)
      console.warn('[match-buyers] migration 007 columns not present — saved base fields only')
    }

    console.log(`[match-buyers v2.0] "${lead.nome}" — ${matches.length} matches, best=${bestScore}, DPS=${dealPriorityScore}`)

    return NextResponse.json({
      lead_id:             id,
      total_matches:       matches.length,
      best_match_score:    bestScore,
      deal_priority_score: dealPriorityScore,
      attack_recommendation: attackRec,
      preclose_candidate:  updatedLead?.preclose_candidate ?? false,
      outreach_ready:      updatedLead?.outreach_ready ?? false,
      // Top 5 full list
      top_buyers:          top5,
      // Top 3 with triage roles
      buyer_triad: {
        primary:   primary,
        secondary: secondary,
        tertiary:  tertiary,
      },
      buyer_match_notes:   buyerNotes,
      buyer_triad_notes:   buyerTriadNotes,
      matching_version:    '2.0',
      formula: 'Budget(35) + Zone(25) + Asset(15) + Tier(15) + Speed/Liquidity(10)',
    })
  } catch (err) {
    console.error('[match-buyers POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET: retrieve current match data without re-running matching
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { id } = await params

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any).from(TABLE)
      .select([
        'id', 'nome',
        'matched_buyers_count', 'best_buyer_match_score', 'matched_to_buyers',
        'buyer_match_notes', 'buyer_matched_at',
        'preclose_candidate', 'outreach_ready',
        // migration 007 fields — graceful if absent
        'primary_buyer_id', 'secondary_buyer_id', 'tertiary_buyer_id',
        'deal_priority_score', 'attack_recommendation', 'buyer_triad_notes',
      ].join(', '))
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[match-buyers GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
