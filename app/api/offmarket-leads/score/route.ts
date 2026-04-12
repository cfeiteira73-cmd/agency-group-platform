// =============================================================================
// Agency Group — Off-Market Lead AI Scoring
// POST /api/offmarket-leads/score
// Scores a single off-market lead 0-100 with score_reason
// Uses geo tier + asset type + urgency + owner motivation + contact quality
// Updates score, score_reason, score_status, score_attempts, last_score_at
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'

const TABLE = 'offmarket_leads'

// ---------------------------------------------------------------------------
// Geographic tiers
// ---------------------------------------------------------------------------

const GEO_TIER_1 = [
  'lisboa', 'lisbon', 'cascais', 'estoril', 'sintra', 'comporta',
  'chiado', 'príncipe real', 'lapa', 'santos', 'bairro alto',
  'parque das nações', 'expo', 'belém', 'restelo', 'campo de ourique',
  'vilamoura', 'quinta do lago', 'vale do lobo', 'quinta do lago',
  'faro premium', 'albufeira', 'lagos', 'luz', 'meia praia',
  'foz do douro', 'boavista', 'porto premium', 'matosinhos', 'leça',
  'algarve', 'ericeira', 'óbidos', 'aroeira', 'azeitão',
]

const GEO_TIER_2 = [
  'braga', 'guimarães', 'aveiro', 'coimbra', 'setúbal', 'setubal',
  'santarém', 'leiria', 'évora', 'portimão', 'lagoa', 'silves',
  'mafra', 'torres vedras', 'caldas da rainha', 'peniche',
  'alcobaça', 'nazaré', 'santarém', 'tomar', 'abrantes',
  'douro', 'trás-os-montes', 'minho', 'alentejo litoral',
  'beja', 'sines', 'grândola', 'alcácer do sal',
]

const GEO_TIER_MADEIRA_AZORES = [
  'madeira', 'funchal', 'câmara de lobos', 'caniço', 'machico',
  'açores', 'azores', 'ponta delgada', 'angra do heroísmo', 'horta',
]

// Normalize string: lowercase + remove diacritics
function normGeo(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Pre-normalize all tier arrays for O(1) lookup cost (computed once at module load)
const GEO_TIER_1_NORM = GEO_TIER_1.map(normGeo)
const GEO_TIER_2_NORM = GEO_TIER_2.map(normGeo)
const GEO_TIER_MADEIRA_AZORES_NORM = GEO_TIER_MADEIRA_AZORES.map(normGeo)

function getGeoTier(cidade?: string | null, localizacao?: string | null): 1 | 2 | 3 | 0 {
  // Normalize haystack: lowercase + remove diacritics + remove country suffix (", Portugal")
  const raw = `${cidade ?? ''} ${localizacao ?? ''}`
  const haystack = normGeo(raw).replace(/,\s*(portugal|espanha|spain|madeira|azores|acores)\s*$/gi, '').trim()
  if (!haystack) return 0

  if (GEO_TIER_1_NORM.some(k => haystack.includes(k) || k.includes(haystack.split(/[\s,]+/)[0] ?? ''))) return 1
  if (GEO_TIER_MADEIRA_AZORES_NORM.some(k => haystack.includes(k))) return 2
  if (GEO_TIER_2_NORM.some(k => haystack.includes(k))) return 2
  return 3
}

// ---------------------------------------------------------------------------
// Asset type multipliers
// ---------------------------------------------------------------------------

const ASSET_TYPE_SCORE: Record<string, number> = {
  moradia:      25,
  quinta:       25,
  herdade:      25,
  hotel:        22,
  prédio:       22,
  predios:      22,
  edificio:     22,
  comercial:    18,
  terreno:      15,
  apartamento:  12,
  loja:         10,
  armazém:      8,
  armazem:      8,
}

function getAssetTypeScore(tipoAtivo?: string | null): number {
  if (!tipoAtivo) return 5
  // Normalize: lowercase, trim, remove diacritics for reliable lookup
  const norm = tipoAtivo.toLowerCase().trim()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  // Also try normalized key lookup in ASSET_TYPE_SCORE
  const normKey = Object.keys(ASSET_TYPE_SCORE).find(k =>
    k.normalize('NFD').replace(/[\u0300-\u036f]/g, '') === norm
  )
  return normKey ? ASSET_TYPE_SCORE[normKey] : (ASSET_TYPE_SCORE[norm] ?? 8)
}

// ---------------------------------------------------------------------------
// Owner motivation signals
// ---------------------------------------------------------------------------

function getOwnerMotivationScore(ownerType?: string | null, urgency?: string | null): number {
  let score = 0

  // Owner type
  if (ownerType) {
    const ot = ownerType.toLowerCase()
    if (ot === 'herança' || ot === 'heranca') score += 20
    else if (ot === 'banco' || ot === 'fundo') score += 18
    else if (ot === 'empresa') score += 12
    else if (ot === 'individual') score += 8
  }

  // Urgency
  if (urgency) {
    if (urgency === 'high') score += 15
    else if (urgency === 'medium') score += 8
    else if (urgency === 'low') score += 3
  }

  return Math.min(35, score)
}

// ---------------------------------------------------------------------------
// Price opportunity scoring
// ---------------------------------------------------------------------------

function getPriceOpportunityScore(priceAsk?: number | null, priceEstimate?: number | null): number {
  if (!priceAsk || !priceEstimate || priceEstimate <= 0) return 0

  const discount = (priceEstimate - priceAsk) / priceEstimate
  if (discount >= 0.20) return 15  // ≥20% below market — motivated seller
  if (discount >= 0.10) return 10  // 10-20% below market
  if (discount >= 0.05) return 5   // 5-10% below market
  if (discount >= 0) return 3       // at market
  return 0                           // above market
}

// ---------------------------------------------------------------------------
// Contact quality
// ---------------------------------------------------------------------------

function getContactScore(contacto?: string | null): number {
  if (!contacto) return 0
  const c = contacto.trim()
  // Phone number pattern
  if (/^(\+?[0-9\s\-().]{7,20})$/.test(c)) return 10
  // Email
  if (c.includes('@')) return 7
  // Something present but unclear
  return 3
}

// ---------------------------------------------------------------------------
// Source quality
// ---------------------------------------------------------------------------

function getSourceScore(source?: string | null): number {
  if (!source) return 3
  const s = source.toLowerCase()
  if (s.includes('referral') || s.includes('referencia')) return 10
  if (s.includes('apify_idealista') || s.includes('idealista')) return 7
  if (s.includes('apify_olx') || s.includes('olx')) return 5
  if (s.includes('google_maps')) return 6
  if (s.includes('linkedin')) return 8
  if (s.includes('manual')) return 4
  if (s.includes('portal')) return 5
  return 3
}

// ---------------------------------------------------------------------------
// Main scoring function
// ---------------------------------------------------------------------------

interface OffmarketLead {
  id: string
  nome: string
  tipo_ativo?: string | null
  localizacao?: string | null
  cidade?: string | null
  area_m2?: number | null
  price_ask?: number | null
  price_estimate?: number | null
  owner_type?: string | null
  urgency?: string | null
  contacto?: string | null
  source?: string | null
  score_attempts?: number
}

function scoreOffmarketLead(lead: OffmarketLead): {
  score: number
  score_reason: string
  score_breakdown: Record<string, number>
} {
  const geoTier = getGeoTier(lead.cidade, lead.localizacao)
  const geoScore = geoTier === 1 ? 20 : geoTier === 2 ? 12 : geoTier === 3 ? 5 : 0

  const assetScore = getAssetTypeScore(lead.tipo_ativo)
  const motivationScore = getOwnerMotivationScore(lead.owner_type, lead.urgency)
  const priceScore = getPriceOpportunityScore(lead.price_ask, lead.price_estimate)
  const contactScore = getContactScore(lead.contacto)
  const sourceScore = getSourceScore(lead.source)

  // Area bonus (large assets score higher)
  let areaBonus = 0
  if (lead.area_m2) {
    if (lead.area_m2 >= 500) areaBonus = 5
    else if (lead.area_m2 >= 200) areaBonus = 3
    else if (lead.area_m2 >= 100) areaBonus = 1
  }

  const rawScore = geoScore + assetScore + motivationScore + priceScore + contactScore + sourceScore + areaBonus
  const score = Math.min(100, Math.max(0, rawScore))

  // Build breakdown
  const score_breakdown = {
    geo_tier: geoScore,
    asset_type: assetScore,
    owner_motivation: motivationScore,
    price_opportunity: priceScore,
    contact_quality: contactScore,
    source_quality: sourceScore,
    area_bonus: areaBonus,
  }

  // Generate score_reason narrative
  const reasons: string[] = []

  if (geoTier === 1) reasons.push(`zona Tier 1 (${lead.cidade ?? lead.localizacao ?? 'premium'})`)
  else if (geoTier === 2) reasons.push(`zona Tier 2 (${lead.cidade ?? 'mercado secundário'})`)
  else if (geoTier === 3) reasons.push(`zona Tier 3 (${lead.cidade ?? 'interior'})`)
  else reasons.push('localização não especificada')

  if (lead.tipo_ativo) {
    const typeLabel = lead.tipo_ativo.charAt(0).toUpperCase() + lead.tipo_ativo.slice(1)
    reasons.push(typeLabel + (lead.area_m2 ? ` ${lead.area_m2}m²` : ''))
  }

  if (lead.owner_type === 'herança' || lead.owner_type === 'heranca') reasons.push('proprietário: herança (alta motivação)')
  else if (lead.owner_type === 'banco' || lead.owner_type === 'fundo') reasons.push('proprietário: banco/fundo (liquidação)')
  else if (lead.owner_type === 'empresa') reasons.push('proprietário: empresa')

  if (lead.urgency === 'high') reasons.push('urgência alta')
  else if (lead.urgency === 'medium') reasons.push('urgência média')

  if (priceScore >= 10) reasons.push('preço abaixo de mercado (≥10%)')
  else if (priceScore >= 5) reasons.push('preço competitivo')

  if (contactScore === 10) reasons.push('contacto directo (telefone)')
  else if (contactScore === 0) reasons.push('⚠️ sem contacto')

  const tierLabel = score >= 70 ? 'PRIORITÁRIO' : score >= 50 ? 'ALTO POTENCIAL' : score >= 30 ? 'MÉDIO' : 'BAIXO'
  const score_reason = `[${tierLabel} — ${score}/100] ${reasons.join(' · ')}`

  return { score, score_reason, score_breakdown }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: unknown = await req.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const { id } = body as Record<string, unknown>

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: '"id" is required' }, { status: 400 })
    }

    // Fetch lead
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lead, error: fetchError } = await (supabaseAdmin as any).from(TABLE)
      .select('id, nome, tipo_ativo, localizacao, cidade, area_m2, price_ask, price_estimate, owner_type, urgency, contacto, source, score_attempts')
      .eq('id', id)
      .single()

    if (fetchError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    // Score the lead
    const { score, score_reason, score_breakdown } = scoreOffmarketLead(lead as OffmarketLead)

    // Update in Supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated, error: updateError } = await (supabaseAdmin as any).from(TABLE)
      .update({
        score,
        score_reason,
        score_breakdown,
        score_status: 'scored',
        score_updated_at: new Date().toISOString(),
        last_score_at: new Date().toISOString(),
        score_attempts: (lead.score_attempts ?? 0) + 1,
      })
      .eq('id', id)
      .select()
      .single()

    if (updateError) throw updateError

    console.log(`[offmarket-score] Scored lead "${lead.nome}" → ${score}/100 | ${score_reason}`)

    return NextResponse.json({
      id,
      score,
      score_reason,
      score_breakdown,
      score_status: 'scored',
    })
  } catch (err) {
    console.error('[offmarket-score POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Batch scoring: GET ?limit=50&only_pending=true
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const sp = req.nextUrl.searchParams
    const limit = Math.min(100, parseInt(sp.get('limit') ?? '50', 10))
    const onlyPending = sp.get('only_pending') !== 'false'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabaseAdmin as any).from(TABLE)
      .select('id, nome, tipo_ativo, localizacao, cidade, area_m2, price_ask, price_estimate, owner_type, urgency, contacto, source, score_attempts')
      .lt('score_attempts', 3)  // max 3 attempts
      .order('created_at', { ascending: false })
      .limit(limit)

    if (onlyPending) {
      query = query.in('score_status', ['pending_score', 'failed_score'])
    }

    const { data: leads, error } = await query
    if (error) throw error

    const results = []
    for (const lead of (leads ?? [])) {
      const { score, score_reason, score_breakdown } = scoreOffmarketLead(lead as OffmarketLead)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabaseAdmin as any).from(TABLE)
        .update({
          score,
          score_reason,
          score_breakdown,
          score_status: 'scored',
          score_updated_at: new Date().toISOString(),
          last_score_at: new Date().toISOString(),
          score_attempts: (lead.score_attempts ?? 0) + 1,
        })
        .eq('id', lead.id)

      results.push({
        id: lead.id,
        nome: lead.nome,
        score,
        score_reason,
        ok: !updateError,
      })
    }

    console.log(`[offmarket-score GET] Batch scored ${results.length} leads`)
    return NextResponse.json({ scored: results.length, results })
  } catch (err) {
    console.error('[offmarket-score GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
