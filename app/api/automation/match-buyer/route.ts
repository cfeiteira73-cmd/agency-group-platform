// =============================================================================
// Agency Group — Buyer-Property Matching API v2.0
// POST /api/automation/match-buyer
// Matches buyer profile against LIVE Supabase properties via pgvector
// Writes top-5 to `matches` table for CRM tracking
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { safeCompare } from '@/lib/safeCompare'
import track from '@/lib/trackLearningEvent'

export const runtime = 'nodejs'
export const maxDuration = 30

// ---------------------------------------------------------------------------
// Supabase client (service role — bypasses RLS for matching engine)
// ---------------------------------------------------------------------------

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BuyerProfile {
  budget_min: number
  budget_max: number
  locations: string[]
  typology?: string
  bedrooms_min?: number
  features_required?: string[]
  use_type?: string
  lead_id?: string            // contacts.id — if provided, matches are persisted
}

interface LiveProperty {
  id: string
  title: string
  price: number
  area_m2: number
  type: string
  bedrooms: number
  concelho: string
  zone: string
  features: string[]
  opportunity_score: number | null
  investor_suitable: boolean
  estimated_rental_yield: number | null
  similarity: number
  // Fields from search_properties_semantic fallback
  nome?: string
  zona?: string
  preco?: number
  quartos?: number
  area?: number
  tipo?: string
  descricao?: string
}

interface MatchBreakdown {
  price_in_budget: number
  location_match: number
  typology_match: number
  features_match: number
  availability: number
}

interface DecisionFields {
  next_best_action: string
  priority_level: 'high' | 'medium' | 'low'
  next_action_deadline: string   // ISO timestamp
  match_weaknesses: string[]
}

interface MatchResult {
  property: LiveProperty
  match_score: number
  match_breakdown: MatchBreakdown
  match_reasons: string[]
  explanation: string
  estimated_yield: number | null
  decision: DecisionFields
}

// ---------------------------------------------------------------------------
// OpenAI embedding
// ---------------------------------------------------------------------------

async function generateEmbedding(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
    })
    if (!res.ok) return null
    const data = await res.json() as { data: Array<{ embedding: number[] }> }
    return data.data[0].embedding
  } catch {
    return null
  }
}

// Build a natural-language query from buyer profile for embedding
function buildBuyerQuery(buyer: BuyerProfile): string {
  const parts: string[] = []

  parts.push(`Imóvel em ${buyer.locations.join(' ou ')}`)

  if (buyer.typology) parts.push(`tipo ${buyer.typology}`)
  if (buyer.bedrooms_min) parts.push(`mínimo ${buyer.bedrooms_min} quartos`)

  const budgetK = Math.round(buyer.budget_max / 1000)
  parts.push(`orçamento até €${budgetK}K`)

  if (buyer.features_required?.length) {
    parts.push(`características: ${buyer.features_required.join(', ')}`)
  }

  if (buyer.use_type === 'investment') parts.push('para investimento, rendimento e yield')
  if (buyer.use_type === 'golden_visa') parts.push('Golden Visa elegível')
  if (buyer.use_type === 'holiday') parts.push('residência de férias e turismo')

  return parts.join('. ')
}

// ---------------------------------------------------------------------------
// Scoring algorithm (identical weights to v1 — preserved intentionally)
// ---------------------------------------------------------------------------

function normaliseLocation(loc: string): string {
  return loc.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function locationMatch(property: LiveProperty, requestedLocations: string[]): boolean {
  const propLocations = [
    property.concelho ?? property.zona ?? '',
    property.zone ?? property.zona ?? '',
  ].filter(Boolean).map(normaliseLocation)

  return requestedLocations.some((loc) => {
    const normLoc = normaliseLocation(loc)
    return propLocations.some((pLoc) => pLoc.includes(normLoc) || normLoc.includes(pLoc))
  })
}

function scoreFeaturesMatch(propertyFeatures: string[], requiredFeatures: string[]): number {
  if (!requiredFeatures || requiredFeatures.length === 0) return 15

  const normPropFeatures = propertyFeatures.map((f) => f.toLowerCase())
  const matched = requiredFeatures.filter((req) =>
    normPropFeatures.some((pf) => pf.includes(req.toLowerCase()) || req.toLowerCase().includes(pf))
  )
  return Math.round((matched.length / requiredFeatures.length) * 15)
}

function scoreProperty(
  property: LiveProperty,
  buyer: BuyerProfile
): { score: number; breakdown: MatchBreakdown; reasons: string[] } {
  const price  = property.price ?? property.preco ?? 0
  const pType  = (property.type ?? property.tipo ?? '').toLowerCase()
  const beds   = property.bedrooms ?? property.quartos ?? 0
  const feats  = property.features ?? []
  const cArea  = property.concelho ?? property.zona ?? ''

  const breakdown: MatchBreakdown = {
    price_in_budget: 0,
    location_match:  0,
    typology_match:  0,
    features_match:  0,
    availability:    10, // pgvector only returns active properties
  }
  const reasons: string[] = []

  // 1. Price in budget (max 30)
  if (price >= buyer.budget_min && price <= buyer.budget_max) {
    breakdown.price_in_budget = 30
    reasons.push(`Preço €${Math.round(price / 1000)}K dentro do orçamento`)
  } else if (price <= buyer.budget_max * 1.1) {
    breakdown.price_in_budget = 15
    reasons.push(`Preço ligeiramente acima do orçamento (+10%)`)
  }

  // 2. Location match (max 25)
  if (locationMatch(property, buyer.locations)) {
    breakdown.location_match = 25
    reasons.push(`Localização ${cArea} conforme pretendido`)
  }

  // 3. Typology match (max 20)
  if (!buyer.typology) {
    breakdown.typology_match = 20
  } else {
    const normTypo = buyer.typology.toLowerCase()
    if (pType === normTypo || pType.includes(normTypo) || normTypo.includes(pType)) {
      breakdown.typology_match = 20
      reasons.push(`Tipologia ${pType} conforme solicitado`)
    }
  }

  // 4. Features match (max 15)
  const featScore = scoreFeaturesMatch(feats, buyer.features_required ?? [])
  breakdown.features_match = featScore
  if (featScore > 0 && (buyer.features_required?.length ?? 0) > 0) {
    const matchedCount = Math.round((featScore / 15) * (buyer.features_required?.length ?? 0))
    reasons.push(`${matchedCount}/${buyer.features_required?.length ?? 0} características presentes`)
  }

  // 5. Availability — always 10 (pgvector filters to active only)

  // Bedrooms check
  if (buyer.bedrooms_min) {
    if (beds < buyer.bedrooms_min) {
      breakdown.typology_match = Math.max(0, breakdown.typology_match - 10)
    } else {
      reasons.push(`${beds} quartos — atende ao mínimo de ${buyer.bedrooms_min}`)
    }
  }

  // Investment yield bonus (reason only)
  if (buyer.use_type === 'investment' && property.investor_suitable && property.estimated_rental_yield) {
    reasons.push(`Yield estimado ${property.estimated_rental_yield}% — adequado para investimento`)
  }

  // Semantic similarity boost (pgvector already ranked by similarity)
  const similarityBonus = property.similarity >= 0.9 ? 5 :
                          property.similarity >= 0.8 ? 3 :
                          property.similarity >= 0.7 ? 1 : 0

  const totalScore = Math.min(
    100,
    breakdown.price_in_budget +
    breakdown.location_match  +
    breakdown.typology_match  +
    breakdown.features_match  +
    breakdown.availability    +
    similarityBonus
  )

  return { score: totalScore, breakdown, reasons }
}

// ---------------------------------------------------------------------------
// Decision engine — next_best_action, priority, deadline, weaknesses
// ---------------------------------------------------------------------------

function computeDecision(
  score: number,
  breakdown: MatchBreakdown,
  buyer: BuyerProfile
): DecisionFields {
  const now = new Date()

  // Priority & deadline
  let priority_level: 'high' | 'medium' | 'low'
  let next_best_action: string
  let hoursToDeadline: number

  if (score >= 80) {
    priority_level    = 'high'
    next_best_action  = 'Enviar Deal Pack agora e contactar comprador hoje'
    hoursToDeadline   = 24
  } else if (score >= 60) {
    priority_level    = 'medium'
    next_best_action  = 'Agendar visita esta semana e enviar ficha do imóvel'
    hoursToDeadline   = 72
  } else {
    priority_level    = 'low'
    next_best_action  = 'Adicionar a sequência de nurture (D+7 follow-up)'
    hoursToDeadline   = 168
  }

  const next_action_deadline = new Date(now.getTime() + hoursToDeadline * 60 * 60 * 1000).toISOString()

  // Weaknesses — what's missing or misaligned
  const match_weaknesses: string[] = []

  if (breakdown.typology_match === 0 && buyer.typology) {
    match_weaknesses.push('Tipologia diferente do pretendido')
  }
  if (breakdown.location_match === 0) {
    match_weaknesses.push('Fora da zona pretendida pelo comprador')
  }
  if (breakdown.price_in_budget < 30) {
    match_weaknesses.push('Preço próximo ou acima do limite de orçamento')
  }
  if (breakdown.features_match < 8 && (buyer.features_required?.length ?? 0) > 1) {
    match_weaknesses.push('Algumas características pretendidas em falta')
  }
  if (match_weaknesses.length === 0) {
    match_weaknesses.push('Sem fraquezas significativas identificadas')
  }

  return { next_best_action, priority_level, next_action_deadline, match_weaknesses }
}

function generateExplanation(
  property: LiveProperty,
  score: number,
  buyer: BuyerProfile,
  reasons: string[]
): string {
  const price  = property.price ?? property.preco ?? 0
  const priceK = Math.round(price / 1000)

  const useType = buyer.use_type === 'investment'   ? 'investimento' :
                  buyer.use_type === 'golden_visa'  ? 'Golden Visa' :
                  buyer.use_type === 'holiday'      ? 'residência de férias' : 'residência principal'

  const matchQuality = score >= 80 ? 'excelente' : score >= 60 ? 'muito boa' : score >= 40 ? 'boa' : 'razoável'

  const yieldNote = property.estimated_rental_yield
    ? ` Yield bruto estimado: ${property.estimated_rental_yield}%.`
    : ''

  return `Correspondência ${matchQuality} (${score}/100) com o perfil de ${useType}. €${priceK}K · ${reasons.slice(0, 2).join(' · ')}.${yieldNote} Recomendamos visita esta semana.`
}

// ---------------------------------------------------------------------------
// Persist top-5 matches to `matches` table
// ---------------------------------------------------------------------------

async function persistMatches(
  leadId: string,
  results: MatchResult[],
  agentEmail?: string
): Promise<string[]> {
  const rows = results.map((r) => ({
    lead_id:              leadId,
    property_id:          r.property.id ?? null,
    property_ref:         null as string | null,
    property_title:       r.property.title ?? r.property.nome ?? null,
    match_score:          r.match_score,
    breakdown:            r.match_breakdown,
    match_reasons:        r.match_reasons,
    explanation:          r.explanation,
    similarity:           r.property.similarity ?? null,
    estimated_yield:      r.estimated_yield,
    status:               'pending',
    matched_by:           agentEmail ?? null,
    // Decision engine fields
    next_best_action:     r.decision.next_best_action,
    match_weaknesses:     r.decision.match_weaknesses,
    priority_level:       r.decision.priority_level,
    next_action_deadline: r.decision.next_action_deadline,
  }))

  const { data } = await supabase.from('matches').insert(rows).select('id')
  return (data ?? []).map((row: { id: string }) => row.id)
  // Errors are non-fatal — matching still returns results to caller
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.PORTAL_API_SECRET
  if (!secret) return NextResponse.json({ error: 'API not configured' }, { status: 503 })
  if (!safeCompare(authHeader ?? '', `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 })
    }

    const data = body as Record<string, unknown>

    // Validate required fields
    if (typeof data.budget_min !== 'number' || typeof data.budget_max !== 'number') {
      return NextResponse.json(
        { error: 'Fields "budget_min" and "budget_max" are required numbers' },
        { status: 400 }
      )
    }
    if (!Array.isArray(data.locations) || data.locations.length === 0) {
      return NextResponse.json(
        { error: 'Field "locations" must be a non-empty array of strings' },
        { status: 400 }
      )
    }

    const buyer: BuyerProfile = {
      budget_min:        data.budget_min as number,
      budget_max:        data.budget_max as number,
      locations:         (data.locations as unknown[]).filter((l) => typeof l === 'string') as string[],
      typology:          typeof data.typology === 'string' ? data.typology : undefined,
      bedrooms_min:      typeof data.bedrooms_min === 'number' ? data.bedrooms_min : undefined,
      features_required: Array.isArray(data.features_required)
        ? (data.features_required as unknown[]).filter((f) => typeof f === 'string') as string[]
        : undefined,
      use_type:          typeof data.use_type === 'string' ? data.use_type : undefined,
      lead_id:           typeof data.lead_id === 'string' ? data.lead_id : undefined,
    }

    // ── Step 1: Generate query embedding ──────────────────────────────────────
    const queryText  = buildBuyerQuery(buyer)
    const embedding  = await generateEmbedding(queryText)

    let properties: LiveProperty[] = []
    let source: 'pgvector' | 'fallback' = 'fallback'

    if (embedding) {
      // ── Step 2a: Query via match_properties() (richest schema) ─────────────
      const { data: matched, error } = await supabase.rpc('match_properties', {
        query_embedding:   embedding,
        match_threshold:   0.60,       // lower threshold → more candidates before scoring
        match_count:       20,
        budget_min:        buyer.budget_min,
        budget_max:        buyer.budget_max * 1.1,  // allow 10% over for partial matches
        zonas:             buyer.locations.length ? buyer.locations : null,
        property_types:    buyer.typology ? [buyer.typology] : null,
        bedrooms_min_arg:  buyer.bedrooms_min ?? null,
        status_filter:     'active',
      })

      if (!error && matched && matched.length > 0) {
        properties = matched as LiveProperty[]
        source = 'pgvector'
      } else {
        // ── Step 2b: Fallback to search_properties_semantic ─────────────────
        const primaryZone = buyer.locations[0] ?? null
        const { data: semantic } = await supabase.rpc('search_properties_semantic', {
          query_embedding:   embedding,
          similarity_threshold: 0.55,
          match_count:       20,
          filter_zona:       primaryZone,
          filter_preco_min:  buyer.budget_min,
          filter_preco_max:  Math.round(buyer.budget_max * 1.1),
          filter_quartos:    buyer.bedrooms_min ?? null,
        })
        if (semantic && semantic.length > 0) {
          properties = (semantic as LiveProperty[]).map((p) => ({
            ...p,
            // normalise field names to match_properties schema
            title:    p.nome ?? '',
            price:    p.preco ?? 0,
            bedrooms: p.quartos ?? 0,
            area_m2:  p.area ?? 0,
            type:     p.tipo ?? '',
            concelho: p.zona ?? '',
            zone:     p.zona ?? '',
            features: [],
            investor_suitable: false,
            opportunity_score: null,
          }))
          source = 'pgvector'
        }
      }
    }

    if (properties.length === 0) {
      // ── Step 2c: Last-resort Supabase filter (no embedding) ─────────────────
      const { data: raw } = await supabase
        .from('properties')
        .select('id, nome, zona, preco, quartos, area, tipo, status')
        .eq('status', 'active')
        .gte('preco', buyer.budget_min)
        .lte('preco', Math.round(buyer.budget_max * 1.1))
        .limit(20)

      if (raw && raw.length > 0) {
        properties = (raw as unknown as Array<{
          id: string; nome: string | null; zona: string | null
          preco: number | null; quartos: number | null; area: number | null
          tipo: string | null
        }>).map((p) => ({
          id:               p.id,
          title:            p.nome ?? '',
          nome:             p.nome ?? '',
          price:            p.preco ?? 0,
          preco:            p.preco ?? 0,
          bedrooms:         p.quartos ?? 0,
          quartos:          p.quartos ?? 0,
          area_m2:          p.area ?? 0,
          area:             p.area ?? 0,
          type:             p.tipo ?? '',
          tipo:             p.tipo ?? '',
          concelho:         p.zona ?? '',
          zone:             p.zona ?? '',
          zona:             p.zona ?? '',
          features:         [] as string[],
          investor_suitable: false,
          opportunity_score: null,
          estimated_rental_yield: null,
          similarity:       0.5,
        } satisfies LiveProperty))
      }
    }

    // ── Step 3: Score all candidates ──────────────────────────────────────────
    const scored: MatchResult[] = properties.map((property) => {
      const { score, breakdown, reasons } = scoreProperty(property, buyer)
      const explanation = generateExplanation(property, score, buyer, reasons)
      const decision    = computeDecision(score, breakdown, buyer)

      return {
        property,
        match_score:     score,
        match_breakdown: breakdown,
        match_reasons:   reasons,
        explanation,
        estimated_yield: buyer.use_type === 'investment'
          ? (property.estimated_rental_yield ?? null)
          : null,
        decision,
      }
    })

    // Sort by score desc, take top 5
    const top5 = scored
      .filter((r) => r.match_score > 0)
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 5)

    // ── Step 4: Persist matches to DB (non-blocking) ──────────────────────────
    const agentEmail = request.headers.get('x-agent-email') ?? undefined
    if (buyer.lead_id && top5.length > 0) {
      void persistMatches(buyer.lead_id, top5, agentEmail)

      // ── Auto deal-pack: fire-and-forget for top match when score ≥ 80 ───────
      const topMatch = top5[0]
      if (topMatch.match_score >= 80 && topMatch.property.id) {
        const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.NEXT_PUBLIC_URL ?? 'http://localhost:3000'
        const svcToken = process.env.INTERNAL_API_TOKEN
        if (svcToken) {
          void fetch(`${baseUrl}/api/deal-packs/generate`, {
            method:  'POST',
            headers: {
              'Content-Type':  'application/json',
              'Authorization': `Bearer ${svcToken}`,
            },
            body: JSON.stringify({
              property_id: topMatch.property.id,
              lead_id:     buyer.lead_id,
            }),
          }).catch((e) => console.warn('[match-buyer] auto deal-pack trigger failed:', e))
        }
      }

      // ── Learning event: match_created ──────────────────────────────────────
      track.matchCreated({
        lead_id:      buyer.lead_id,
        property_id:  top5[0]?.property?.id ?? null,
        agent_email:  agentEmail ?? null,
        match_score:  top5[0]?.match_score ?? null,
        metadata: {
          total_evaluated: properties.length,
          top5_scores:     top5.map(r => r.match_score),
          source,
          locations:       buyer.locations,
          use_type:        buyer.use_type ?? null,
          auto_deal_pack:  topMatch.match_score >= 80 ? 'triggered' : 'skipped',
        },
      })
    }

    return NextResponse.json({
      matches:                     top5,
      total_properties_evaluated:  properties.length,
      source,
      buyer_profile_summary: {
        budget_range:      `€${Math.round(buyer.budget_min / 1000)}K – €${Math.round(buyer.budget_max / 1000)}K`,
        locations:         buyer.locations,
        typology:          buyer.typology ?? 'Qualquer',
        bedrooms_min:      buyer.bedrooms_min ?? 'Qualquer',
        use_type:          buyer.use_type ?? 'Não especificado',
        features_required: buyer.features_required ?? [],
      },
      generated_at: new Date().toISOString(),
      ...(buyer.lead_id && { matches_persisted: true }),
    })

  } catch (error) {
    console.error('[match-buyer] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint:    'POST /api/automation/match-buyer',
    version:     '2.0',
    description: 'Match buyer profile against live Supabase properties via pgvector semantic search. Returns top-5 with scoring breakdown. Pass lead_id to persist results to matches table.',
    request_schema: {
      budget_min:        'number (EUR) — required',
      budget_max:        'number (EUR) — required',
      locations:         'string[] — required (e.g. ["Lisboa", "Cascais"])',
      typology:          'string? — e.g. "apartment", "villa", "penthouse"',
      bedrooms_min:      'number? — minimum bedrooms',
      features_required: 'string[]? — e.g. ["pool", "garage", "sea_view"]',
      use_type:          'string? — "primary_residence" | "investment" | "holiday" | "golden_visa"',
      lead_id:           'string? (UUID) — if provided, top-5 matches are saved to matches table',
    },
    scoring: {
      price_in_budget: 30,
      location_match:  25,
      typology_match:  20,
      features_match:  15,
      availability:    10,
    },
    data_source: 'Live Supabase properties via pgvector cosine similarity (match_properties RPC)',
  })
}
