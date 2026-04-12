// =============================================================================
// Agency Group — Buyer Matching for Off-Market Leads
// POST /api/offmarket-leads/[id]/match-buyers
// Matches a lead against active contacts/buyers in Supabase
// Scoring: zona × budget × tipo × urgency match
// Updates lead: matched_buyers_count, best_buyer_match_score, matched_to_buyers, buyer_match_notes
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
}

interface Contact {
  id: string
  full_name: string
  email?: string | null
  phone?: string | null
  budget_min?: number | null
  budget_max?: number | null
  zonas?: string[] | null
  tipos?: string[] | null
  status?: string | null
  lead_tier?: string | null
  lead_score?: number | null
}

interface BuyerMatch {
  contact_id: string
  name: string
  match_score: number
  match_reasons: string[]
  budget_range: string
  contact: string
}

// ---------------------------------------------------------------------------
// Matching algorithm
// ---------------------------------------------------------------------------

function matchBuyerToLead(contact: Contact, lead: OffmarketLead): BuyerMatch | null {
  let score = 0
  const reasons: string[] = []

  // 1. Budget match (max 40 pts)
  const assetPrice = lead.price_estimate ?? lead.price_ask
  if (assetPrice && (contact.budget_max || contact.budget_min)) {
    const bMax = contact.budget_max ?? Infinity
    const bMin = contact.budget_min ?? 0

    if (assetPrice <= bMax && assetPrice >= bMin) {
      score += 40
      reasons.push('orçamento compatível')
    } else if (assetPrice <= bMax * 1.15) {
      score += 25
      reasons.push('orçamento próximo (+15%)')
    } else if (assetPrice <= bMax * 1.30) {
      score += 10
      reasons.push('orçamento esticável (+30%)')
    }
  } else {
    // No budget data — assume possible
    score += 15
    reasons.push('orçamento não definido')
  }

  // 2. Zone match (max 30 pts)
  if (contact.zonas && contact.zonas.length > 0) {
    const leadZone = `${lead.cidade ?? ''} ${lead.localizacao ?? ''}`.toLowerCase()
    const zoneMatch = contact.zonas.some(z => {
      const zl = z.toLowerCase()
      return leadZone.includes(zl) || zl.includes(leadZone.split(' ')[0] ?? '')
    })

    if (zoneMatch) {
      score += 30
      reasons.push(`zona match (${contact.zonas.join('/')})`)
    } else {
      // Partial: check if any zona is in same region
      const broadMatch = contact.zonas.some(z =>
        z.toLowerCase().includes('qualquer') || z.toLowerCase().includes('any') || z.toLowerCase().includes('todo')
      )
      if (broadMatch) {
        score += 15
        reasons.push('zona flexível')
      }
    }
  } else {
    // No zone preference — assume open
    score += 15
    reasons.push('sem preferência de zona')
  }

  // 3. Asset type match (max 20 pts)
  if (contact.tipos && contact.tipos.length > 0 && lead.tipo_ativo) {
    const tipoNorm = lead.tipo_ativo.toLowerCase()
    const tipoMatch = contact.tipos.some(t => {
      const tl = t.toLowerCase()
      return tl.includes(tipoNorm) || tipoNorm.includes(tl)
    })
    if (tipoMatch) {
      score += 20
      reasons.push(`tipo match (${lead.tipo_ativo})`)
    } else {
      // Some buyers accept any type
      const anyType = contact.tipos.some(t => t.toLowerCase().includes('qualquer') || t.toLowerCase().includes('any'))
      if (anyType) score += 8
    }
  } else {
    score += 10  // no preference = open
  }

  // 4. Buyer quality bonus (max 10 pts)
  if (contact.lead_tier === 'A') {
    score += 10
    reasons.push('comprador Tier A')
  } else if (contact.lead_tier === 'B') {
    score += 5
    reasons.push('comprador Tier B')
  }

  const finalScore = Math.min(100, score)

  // Only return matches with meaningful score
  if (finalScore < 30) return null

  const budgetRange = contact.budget_min && contact.budget_max
    ? `€${(contact.budget_min / 1000).toFixed(0)}K–€${(contact.budget_max / 1000).toFixed(0)}K`
    : contact.budget_max
    ? `até €${(contact.budget_max / 1000).toFixed(0)}K`
    : 'Não especificado'

  const contactStr = contact.phone ?? contact.email ?? 'sem contacto'

  return {
    contact_id: contact.id,
    name: contact.full_name,
    match_score: finalScore,
    match_reasons: reasons,
    budget_range: budgetRange,
    contact: contactStr,
  }
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

    // Fetch lead
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lead, error: leadError } = await (supabaseAdmin as any).from(TABLE)
      .select('id, nome, tipo_ativo, cidade, localizacao, price_estimate, price_ask, area_m2, score')
      .eq('id', id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Fetch active/prospect buyers from contacts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: contacts, error: contactsError } = await (supabaseAdmin as any).from(CONTACTS_TABLE)
      .select('id, full_name, email, phone, budget_min, budget_max, zonas, tipos, status, lead_tier, lead_score')
      .in('status', ['active', 'prospect', 'lead'])
      .order('lead_score', { ascending: false })
      .limit(500)

    if (contactsError) throw contactsError

    // Run matching
    const matches: BuyerMatch[] = []
    for (const contact of (contacts ?? [])) {
      const match = matchBuyerToLead(contact as Contact, lead as OffmarketLead)
      if (match) matches.push(match)
    }

    // Sort by match score
    matches.sort((a, b) => b.match_score - a.match_score)
    const top5 = matches.slice(0, 5)
    const bestScore = top5[0]?.match_score ?? 0

    // Build summary note
    const buyerNotes = top5.length > 0
      ? top5.slice(0, 3).map(m => `${m.name} (${m.match_score}/100 — ${m.budget_range})`).join(' | ')
      : 'Sem compradores compatíveis encontrados'

    // Update lead with buyer match data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updatedLead, error: updateError } = await (supabaseAdmin as any).from(TABLE)
      .update({
        matched_buyers_count: matches.length,
        best_buyer_match_score: bestScore,
        buyer_match_notes: buyerNotes,
        matched_to_buyers: matches.length > 0 && bestScore >= 60,
        buyer_matched_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, nome, score, matched_buyers_count, best_buyer_match_score, matched_to_buyers, preclose_candidate, outreach_ready')
      .single()

    if (updateError) throw updateError

    console.log(`[match-buyers] Lead "${lead.nome}" — ${matches.length} matches, best=${bestScore}`)

    return NextResponse.json({
      lead_id: id,
      total_matches: matches.length,
      best_match_score: bestScore,
      preclose_candidate: updatedLead?.preclose_candidate ?? false,
      outreach_ready: updatedLead?.outreach_ready ?? false,
      top_buyers: top5,
      buyer_match_notes: buyerNotes,
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
      .select('id, nome, matched_buyers_count, best_buyer_match_score, matched_to_buyers, buyer_match_notes, buyer_matched_at, preclose_candidate, outreach_ready')
      .eq('id', id)
      .single()

    if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json(data)
  } catch (err) {
    console.error('[match-buyers GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
