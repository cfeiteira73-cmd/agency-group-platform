// =============================================================================
// Agency Group — Deal Pack Generator
// POST /api/deal-packs/generate
// Creates an AI-powered deal presentation pack for a property/deal
// Claude generates: investment thesis, market summary, financial projections
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { portalAuthGate } from '@/lib/requirePortalAuth'
import track from '@/lib/trackLearningEvent'

export const runtime = 'nodejs'
export const maxDuration = 60

// ---------------------------------------------------------------------------
// Supabase (service role)
// ---------------------------------------------------------------------------

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GenerateRequest {
  deal_id?: string       // existing deal UUID
  property_id?: string   // property UUID
  lead_id?: string       // target buyer UUID
  // Inline data (if IDs not available)
  property_data?: {
    title?: string
    type?: string
    price?: number
    area_m2?: number
    bedrooms?: number
    zone?: string
    concelho?: string
    features?: string[]
    estimated_rental_yield?: number
    energy_certificate?: string
    year_built?: number
    description?: string
  }
  buyer_profile?: {
    name?: string
    nationality?: string
    budget_max?: number
    use_type?: string
    locations?: string[]
  }
}

// ---------------------------------------------------------------------------
// Claude prompt builder
// ---------------------------------------------------------------------------

function buildDealPackPrompt(data: {
  propertyTitle: string
  propertyType: string
  price: number
  area: number | null
  bedrooms: number | null
  zone: string
  features: string[]
  yield: number | null
  description: string
  energyCert: string | null
  yearBuilt: number | null
  buyerName: string | null
  buyerNationality: string | null
  useType: string | null
}): string {
  const priceK = Math.round(data.price / 1000)
  const priceM2 = data.area ? Math.round(data.price / data.area) : null

  return `Você é um especialista em imobiliário de luxo da Agency Group (AMI 22506).
Gere um Deal Pack profissional e convincente para o seguinte imóvel.

DADOS DO IMÓVEL:
- Nome: ${data.propertyTitle}
- Tipo: ${data.propertyType}
- Preço: €${priceK}K${priceM2 ? ` (€${priceM2}/m²)` : ''}
- Zona: ${data.zone}
${data.area ? `- Área: ${data.area}m²` : ''}
${data.bedrooms ? `- Quartos: ${data.bedrooms}` : ''}
${data.features.length ? `- Características: ${data.features.join(', ')}` : ''}
${data.yield ? `- Yield estimado: ${data.yield}%` : ''}
${data.energyCert ? `- Certificado energético: ${data.energyCert}` : ''}
${data.yearBuilt ? `- Ano construção: ${data.yearBuilt}` : ''}
${data.description ? `- Descrição: ${data.description}` : ''}

${data.buyerName ? `COMPRADOR ALVO: ${data.buyerName}${data.buyerNationality ? ` (${data.buyerNationality})` : ''}` : ''}
${data.useType ? `OBJECTIVO: ${data.useType}` : ''}

Gere exactamente em formato JSON (sem markdown, apenas JSON válido):
{
  "title": "Título do Deal Pack (máx. 80 chars)",
  "investment_thesis": "Tese de investimento clara e convincente em 3-4 parágrafos (PT). Por que este imóvel é uma oportunidade única agora.",
  "market_summary": "Análise do mercado local em 2 parágrafos: dados de preços, tendências, yield médio da zona, valorização esperada.",
  "highlights": ["5-7 pontos-chave do imóvel em bullets curtos"],
  "financial_projections": {
    "acquisition_cost": ${data.price},
    "imt_estimate": ${Math.round(data.price * 0.06)},
    "notary_legal_estimate": ${Math.round(data.price * 0.015)},
    "total_acquisition": ${Math.round(data.price * 1.075)},
    "annual_rental_income_estimate": ${data.yield ? Math.round(data.price * (data.yield / 100)) : null},
    "gross_yield_estimate": ${data.yield ?? null},
    "5year_appreciation_estimate_pct": "Estimativa % valorização 5 anos com base na zona",
    "notes": "Breve nota sobre pressupostos"
  },
  "opportunity_score": <número 0-100 representando a qualidade da oportunidade>,
  "call_to_action": "Frase de encerramento persuasiva convidando para visita/reunião"
}`
}

// ---------------------------------------------------------------------------
// POST /api/deal-packs/generate
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const gate = await portalAuthGate(req)
  if (!gate.authed) return gate.response

  const agentEmail = gate.email

  let body: GenerateRequest
  try {
    body = await req.json() as GenerateRequest
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // ── Load property data ─────────────────────────────────────────────────────
  let propTitle = 'Imóvel Agency Group'
  let propType  = 'apartment'
  let propPrice = 0
  let propArea: number | null = null
  let propBeds: number | null = null
  let propZone  = 'Portugal'
  let propFeatures: string[] = []
  let propYield: number | null = null
  let propDesc  = ''
  let propEnergy: string | null = null
  let propYear: number | null = null
  let propDbId: string | null = null

  if (body.property_id) {
    const { data: prop } = await supabase
      .from('properties')
      .select('id, nome, tipo, preco, area, quartos, zona, features, energia, descricao, bairro')
      .eq('id', body.property_id)
      .single()

    if (prop) {
      propDbId    = prop.id
      propTitle   = prop.nome ?? propTitle
      propType    = prop.tipo ?? propType
      propPrice   = Number(prop.preco) || propPrice
      propArea    = prop.area ?? null
      propBeds    = prop.quartos ?? null
      propZone    = (prop.bairro ?? prop.zona) ?? propZone
      propFeatures = Array.isArray(prop.features) ? prop.features : []
      propYield   = null  // not in schema — may be added later
      propEnergy  = prop.energia ?? null
      propDesc    = (prop as Record<string, unknown>).descricao as string ?? ''
    }
  } else if (body.property_data) {
    const pd = body.property_data
    propTitle    = pd.title   ?? propTitle
    propType     = pd.type    ?? propType
    propPrice    = pd.price   ?? propPrice
    propArea     = pd.area_m2 ?? null
    propBeds     = pd.bedrooms ?? null
    propZone     = pd.zone ?? pd.concelho ?? propZone
    propFeatures = pd.features ?? []
    propYield    = pd.estimated_rental_yield ?? null
    propEnergy   = pd.energy_certificate ?? null
    propYear     = pd.year_built ?? null
    propDesc     = pd.description ?? ''
  }

  if (!propPrice) {
    return NextResponse.json({ error: 'property price is required (via property_id or property_data.price)' }, { status: 400 })
  }

  // ── Load buyer data ────────────────────────────────────────────────────────
  let buyerName: string | null = null
  let buyerNationality: string | null = null
  let useType: string | null = null

  if (body.lead_id) {
    const { data: lead } = await supabase
      .from('contacts')
      .select('name, nationality, buyer_purpose, buyer_nationality')
      .eq('id', body.lead_id)
      .single()

    if (lead) {
      buyerName        = (lead as Record<string, unknown>).name as string ?? null
      buyerNationality = (lead as Record<string, unknown>).buyer_nationality as string
        ?? (lead as Record<string, unknown>).nationality as string ?? null
      useType          = (lead as Record<string, unknown>).buyer_purpose as string ?? null
    }
  } else if (body.buyer_profile) {
    buyerName        = body.buyer_profile.name ?? null
    buyerNationality = body.buyer_profile.nationality ?? null
    useType          = body.buyer_profile.use_type ?? null
  }

  // ── Generate with Claude ───────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 503 })
  }

  const client = new Anthropic({ apiKey })
  const prompt = buildDealPackPrompt({
    propertyTitle:    propTitle,
    propertyType:     propType,
    price:            propPrice,
    area:             propArea,
    bedrooms:         propBeds,
    zone:             propZone,
    features:         propFeatures,
    yield:            propYield,
    description:      propDesc,
    energyCert:       propEnergy,
    yearBuilt:        propYear,
    buyerName,
    buyerNationality,
    useType,
  })

  let claudeJson: Record<string, unknown>
  try {
    const message = await client.messages.create({
      model:      'claude-haiku-4-5',
      max_tokens: 2048,
      messages:   [{ role: 'user', content: prompt }],
    })

    const rawText = message.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as { type: 'text'; text: string }).text)
      .join('')
      .trim()

    // Strip potential markdown code fences
    const jsonStr = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    claudeJson = JSON.parse(jsonStr) as Record<string, unknown>
  } catch (err) {
    console.error('[deal-packs/generate] Claude error:', err)
    return NextResponse.json({ error: 'AI generation failed. Try again.' }, { status: 502 })
  }

  // ── Persist to deal_packs ──────────────────────────────────────────────────
  // Base columns always present in DB (minimal schema)
  const opportunityScore = typeof claudeJson.opportunity_score === 'number'
    ? Math.min(100, Math.max(0, claudeJson.opportunity_score))
    : null

  const baseInsert: Record<string, unknown> = {
    deal_id:    body.deal_id ?? null,
    property_id: propDbId,
    lead_id:    body.lead_id ? Number(body.lead_id) || null : null,
    title:      (claudeJson.title as string) ?? propTitle,
    status:     'ready',
    created_by: agentEmail,
    // ai_summary stores condensed version (always in schema)
    ai_summary: JSON.stringify({
      title:               claudeJson.title,
      investment_thesis:   claudeJson.investment_thesis,
      market_summary:      claudeJson.market_summary,
      highlights:          claudeJson.highlights,
      opportunity_score:   opportunityScore,
      call_to_action:      claudeJson.call_to_action,
    }),
    // metadata stores full structured output
    metadata: {
      investment_thesis:    claudeJson.investment_thesis ?? null,
      market_summary:       claudeJson.market_summary ?? null,
      highlights:           Array.isArray(claudeJson.highlights) ? claudeJson.highlights : [],
      financial_projections: claudeJson.financial_projections ?? {},
      opportunity_score:    opportunityScore,
      call_to_action:       claudeJson.call_to_action ?? null,
      property_title:       propTitle,
      property_zone:        propZone,
      generated_at:         new Date().toISOString(),
    },
  }

  // Extended columns — added by migration 20260425_002 (write if available)
  const extendedInsert: Record<string, unknown> = {
    ...baseInsert,
    investment_thesis:    (claudeJson.investment_thesis as string) ?? null,
    market_summary:       (claudeJson.market_summary as string) ?? null,
    opportunity_score:    opportunityScore,
    financial_projections: claudeJson.financial_projections ?? {},
    highlights:           Array.isArray(claudeJson.highlights) ? claudeJson.highlights : [],
    generated_at:         new Date().toISOString(),
  }

  // Try extended schema first; fall back to base schema if columns not yet migrated
  let inserted: { id: string; title: string; status: string; opportunity_score: number | null; generated_at: string | null } | null = null
  let insertError: { code?: string; message: string } | null = null

  const extResult = await supabase
    .from('deal_packs')
    .insert(extendedInsert)
    .select('id, title, status, opportunity_score, generated_at')
    .single()

  if (extResult.error?.code === 'PGRST204' || extResult.error?.message?.includes('column')) {
    // Columns not yet migrated — use base schema only
    const baseResult = await supabase
      .from('deal_packs')
      .insert(baseInsert)
      .select('id, title, status')
      .single()
    inserted    = baseResult.data ? { ...baseResult.data, opportunity_score: opportunityScore, generated_at: new Date().toISOString() } : null
    insertError = baseResult.error
  } else {
    inserted    = extResult.data
    insertError = extResult.error
  }

  if (insertError) {
    console.error('[deal-packs/generate] Supabase insert error:', insertError)
    return NextResponse.json({ error: 'Failed to save deal pack' }, { status: 500 })
  }

  // ── Learning event: deal_pack_generated ───────────────────────────────────
  track.dealPackGenerated({
    deal_pack_id: inserted?.id ?? null,
    lead_id:      body.lead_id ?? null,
    property_id:  propDbId,
    agent_email:  agentEmail,
    metadata: {
      deal_id:           body.deal_id ?? null,
      opportunity_score: claudeJson.opportunity_score ?? null,
      property_title:    propTitle,
      property_zone:     propZone,
    },
  })

  return NextResponse.json({
    success:      true,
    deal_pack_id: inserted?.id,
    deal_pack:    inserted,
    content: {
      title:               claudeJson.title,
      investment_thesis:   claudeJson.investment_thesis,
      market_summary:      claudeJson.market_summary,
      highlights:          claudeJson.highlights,
      financial_projections: claudeJson.financial_projections,
      opportunity_score:   claudeJson.opportunity_score,
      call_to_action:      claudeJson.call_to_action,
    },
  })
}
