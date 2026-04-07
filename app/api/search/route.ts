import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 30

const client = new Anthropic()

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ─── Semantic search via pgvector ────────────────────────────────────────────

interface SemanticFilters {
  zona?: string
  precoMin?: number
  precoMax?: number
  quartos?: number
}

interface SemanticProperty {
  id: string
  nome: string
  zona: string
  preco: number
  quartos: number
  area: number
  tipo: string
  descricao: string
  fotos: string[]
  similarity: number
}

async function semanticSearch(query: string, filters: SemanticFilters): Promise<SemanticProperty[]> {
  const key = process.env.OPENAI_API_KEY
  if (!key || !query.trim()) return []

  try {
    // Generate query embedding
    const embRes = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: query }),
      signal: AbortSignal.timeout(3000),
    })
    if (!embRes.ok) return []
    const embData = await embRes.json() as { data: Array<{ embedding: number[] }> }
    const embedding = embData.data[0].embedding

    const serviceClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data, error } = await serviceClient.rpc('search_properties_semantic', {
      query_embedding: embedding,
      similarity_threshold: 0.65,
      match_count: 15,
      filter_zona: filters.zona ?? null,
      filter_preco_min: filters.precoMin ?? null,
      filter_preco_max: filters.precoMax ?? null,
      filter_quartos: filters.quartos ?? null,
    })

    if (error || !data || (data as SemanticProperty[]).length === 0) return []

    return (data as Array<Record<string, unknown>>).map((p) => ({
      id: String(p.id),
      nome: String(p.nome ?? ''),
      zona: String(p.zona ?? ''),
      preco: Number(p.preco) || 0,
      quartos: Number(p.quartos) || 0,
      area: Number(p.area) || 0,
      tipo: String(p.tipo ?? ''),
      descricao: String(p.descricao ?? ''),
      fotos: Array.isArray(p.fotos) ? (p.fotos as string[]) : [],
      similarity: Number(p.similarity) || 0,
    }))
  } catch {
    return []
  }
}

// Fallback properties used when Supabase is unavailable or returns 0 results
const FALLBACK_PROPERTIES = [
  {
    id: 'prop-001',
    title: 'Penthouse Chiado',
    type: 'Apartamento',
    zone: 'Lisboa',
    area: 180,
    bedrooms: 3,
    bathrooms: 2,
    price: 1850000,
    pricePerSqm: 10278,
    features: ['terraço', 'vista rio', 'garagem', 'porteiro'],
    description: 'Penthouse premium no coração do Chiado com vistas deslumbrantes sobre o Tejo',
    rentalYield: 4.2,
    available: true,
  },
  {
    id: 'prop-002',
    title: 'Villa Cascais Golf',
    type: 'Moradia',
    zone: 'Cascais',
    area: 350,
    bedrooms: 5,
    bathrooms: 4,
    price: 3200000,
    pricePerSqm: 9143,
    features: ['piscina', 'jardim', 'garagem dupla', 'vista mar', 'golf resort'],
    description: 'Villa de luxo num golf resort premium em Cascais com piscina e vista para o mar',
    rentalYield: 3.8,
    available: true,
  },
  {
    id: 'prop-003',
    title: 'Apartamento Príncipe Real',
    type: 'Apartamento',
    zone: 'Lisboa',
    area: 120,
    bedrooms: 2,
    bathrooms: 2,
    price: 890000,
    pricePerSqm: 7417,
    features: ['varanda', 'ar condicionado', 'cozinha equipada'],
    description: 'Apartamento moderno no bairro mais trendy de Lisboa com acabamentos premium',
    rentalYield: 4.8,
    available: true,
  },
  {
    id: 'prop-004',
    title: 'Quinta Comporta',
    type: 'Moradia',
    zone: 'Comporta',
    area: 280,
    bedrooms: 4,
    bathrooms: 3,
    price: 2800000,
    pricePerSqm: 10000,
    features: ['piscina infinita', 'arroz paddies view', 'natureza', 'privacidade total'],
    description: 'Quinta exclusiva na Comporta com piscina infinita e vista única para os arrozais',
    rentalYield: 3.5,
    available: true,
  },
  {
    id: 'prop-005',
    title: 'Apartamento Foz do Douro',
    type: 'Apartamento',
    zone: 'Porto',
    area: 95,
    bedrooms: 2,
    bathrooms: 1,
    price: 480000,
    pricePerSqm: 5053,
    features: ['vista rio', 'renovado', 'arrecadação'],
    description: 'Apartamento renovado na zona mais premium do Porto com vista para o Rio Douro',
    rentalYield: 5.3,
    available: true,
  },
  {
    id: 'prop-006',
    title: 'Villa Algarve Vilamoura',
    type: 'Moradia',
    zone: 'Algarve',
    area: 320,
    bedrooms: 5,
    bathrooms: 4,
    price: 2100000,
    pricePerSqm: 6563,
    features: ['piscina', 'jardim', 'garagem', 'golf', 'praia 5min'],
    description: 'Villa premium em Vilamoura próxima ao campo de golfe e praias douradas',
    rentalYield: 5.8,
    available: true,
  },
  {
    id: 'prop-007',
    title: 'Penthouse Funchal',
    type: 'Apartamento',
    zone: 'Madeira',
    area: 210,
    bedrooms: 3,
    bathrooms: 3,
    price: 1200000,
    pricePerSqm: 5714,
    features: ['terraço 80m²', 'vista oceano', 'piscina privada', 'IFICI elegível'],
    description: 'Penthouse de luxo no Funchal com terraço privativo, piscina e vista oceano 270°',
    rentalYield: 5.0,
    available: true,
  },
  {
    id: 'prop-008',
    title: 'Apartamento T3 Belém',
    type: 'Apartamento',
    zone: 'Lisboa',
    area: 145,
    bedrooms: 3,
    bathrooms: 2,
    price: 1150000,
    pricePerSqm: 7931,
    features: ['varanda rio', 'lugar garagem', 'arrecadação', 'condomínio fechado'],
    description: 'Espaçoso T3 em Belém com varanda e vistas para o Tejo, a minutos do metro',
    rentalYield: 4.1,
    available: true,
  },
]

interface SearchProperty {
  id: string
  title: string
  type: string
  zone: string
  area: number
  bedrooms: number
  bathrooms: number
  price: number
  pricePerSqm: number
  features: string[]
  description: string
  rentalYield: number
  available: boolean
}

interface ExtractedCriteria {
  zones?: string[] | null
  types?: string[] | null
  maxPrice?: number | null
  minPrice?: number | null
  minBedrooms?: number | null
  features?: string[] | null
  useCase?: 'rental_yield' | 'capital_appreciation' | 'lifestyle' | null
  searchSummary?: string
}

async function fetchPropertiesFromDB(criteria: ExtractedCriteria): Promise<SearchProperty[]> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .from('properties')
      .select('id, nome, tipo, zona, preco, area, quartos, casas_banho, descricao, features, yield_bruto, status')
      .not('nome', 'is', null)
      .order('created_at', { ascending: false })
      .limit(20)

    // Filter by status — accept both 'active' (enum) and fallback
    query = query.eq('status', 'active')

    const zones = criteria.zones
    if (Array.isArray(zones) && zones.length > 0 && zones[0] !== null) {
      query = query.in('zona', zones)
    }

    const maxPrice = criteria.maxPrice
    if (typeof maxPrice === 'number' && maxPrice > 0) {
      query = query.lte('preco', maxPrice)
    }

    const minPrice = criteria.minPrice
    if (typeof minPrice === 'number' && minPrice > 0) {
      query = query.gte('preco', minPrice)
    }

    const minBedrooms = criteria.minBedrooms
    if (typeof minBedrooms === 'number' && minBedrooms > 0) {
      query = query.gte('quartos', minBedrooms)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await query as { data: any[] | null; error: unknown }

    if (error || !data || data.length === 0) {
      return FALLBACK_PROPERTIES
    }

    // Map DB schema to unified search result format
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data.map((p: any): SearchProperty => {
      const preco = Number(p.preco) || 0
      const areaVal = Number(p.area) || 1
      return {
        id: String(p.id),
        title: String(p.nome || ''),
        type: String(p.tipo || ''),
        zone: String(p.zona || ''),
        area: areaVal,
        bedrooms: Number(p.quartos) || 0,
        bathrooms: Number(p.casas_banho) || 0,
        price: preco,
        pricePerSqm: p.pm2 ? Number(p.pm2) : Math.round(preco / areaVal),
        features: Array.isArray(p.features) ? p.features : [],
        description: String(p.descricao || ''),
        rentalYield: Number(p.yield_bruto) || 4.5,
        available: true,
      }
    })
  } catch {
    return FALLBACK_PROPERTIES
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { query?: unknown; language?: unknown; sessionId?: unknown }
    const { query, language = 'pt' } = body

    if (!query || typeof query !== 'string' || query.trim().length < 3) {
      return NextResponse.json({ error: 'Query required (min 3 chars)' }, { status: 400 })
    }

    const lang = typeof language === 'string' ? language : 'pt'

    // Use Claude Haiku to extract structured search criteria from natural language
    const extractionResponse = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Extract property search criteria from this query. Return ONLY valid JSON, no markdown.

Query: "${query}"

Return this exact JSON structure (use null for unspecified fields):
{
  "zones": ["Lisboa"|"Cascais"|"Porto"|"Algarve"|"Comporta"|"Madeira"],
  "types": ["Apartamento"|"Moradia"],
  "maxPrice": number|null,
  "minPrice": number|null,
  "minBedrooms": number|null,
  "features": ["piscina"|"vista mar"|"golf"|"terraço"|"jardim"|"garagem"|"vista rio"|"vista oceano"],
  "useCase": "rental_yield"|"capital_appreciation"|"lifestyle"|null,
  "searchSummary": "Brief Portuguese summary of what they want"
}

Rules:
- zones: only include zones explicitly mentioned or strongly implied (e.g. "Comporta vibes" → Comporta, "like Comporta but cheaper" → Porto or Algarve)
- If no zones mentioned, return empty array []
- If no types mentioned, return empty array []
- If no features mentioned, return empty array []
- For "rental yield" / "investment" queries → useCase: "rental_yield"
- For "capital appreciation" / "valorização" queries → useCase: "capital_appreciation"
- For "family" / "lifestyle" queries → useCase: "lifestyle"`,
      }],
    })

    let criteria: ExtractedCriteria = {}
    try {
      const content = extractionResponse.content[0]
      if (content.type === 'text') {
        const jsonMatch = content.text.match(/\{[\s\S]*\}/)
        if (jsonMatch) criteria = JSON.parse(jsonMatch[0]) as ExtractedCriteria
      }
    } catch {
      // Extraction failed — proceed with empty criteria (return all, sorted by relevance)
      criteria = {}
    }

    // 1. Try semantic search (requires OPENAI_API_KEY + pgvector embeddings)
    const semanticFilters: SemanticFilters = {
      zona: Array.isArray(criteria.zones) && criteria.zones.length === 1 && criteria.zones[0] !== null
        ? criteria.zones[0] ?? undefined
        : undefined,
      precoMin: typeof criteria.minPrice === 'number' ? criteria.minPrice : undefined,
      precoMax: typeof criteria.maxPrice === 'number' ? criteria.maxPrice : undefined,
      quartos: typeof criteria.minBedrooms === 'number' ? criteria.minBedrooms : undefined,
    }
    const semanticResults = await semanticSearch(query, semanticFilters)
    const usedSemanticSearch = semanticResults.length > 0

    // 2. If semantic returned results, map to SearchProperty; otherwise fall back to keyword/filter DB search
    let results: SearchProperty[]
    if (usedSemanticSearch) {
      results = semanticResults.map((p) => {
        const preco = p.preco
        const areaVal = p.area || 1
        return {
          id: p.id,
          title: p.nome,
          type: p.tipo,
          zone: p.zona,
          area: areaVal,
          bedrooms: p.quartos,
          bathrooms: 0,
          price: preco,
          pricePerSqm: Math.round(preco / areaVal),
          features: [],
          description: p.descricao,
          rentalYield: 4.5,
          available: true,
        }
      })
    } else {
      // Fetch from Supabase with extracted criteria, fallback to static data if needed
      results = await fetchPropertiesFromDB(criteria)
    }

    // Apply in-memory filters for fields not handled by DB query (types, features)
    const types = criteria.types
    if (Array.isArray(types) && types.length > 0) {
      const filtered = results.filter(p =>
        types.some(t => p.type.toLowerCase().includes(t.toLowerCase()))
      )
      // Only apply filter if it still yields results
      if (filtered.length > 0) results = filtered
    }

    const features = criteria.features
    if (Array.isArray(features) && features.length > 0) {
      const filtered = results.filter(p =>
        features.some(f =>
          p.features.some(pf => pf.toLowerCase().includes(f.toLowerCase()))
        )
      )
      if (filtered.length > 0) results = filtered
    }

    // Sort by relevance based on use case
    const useCase = criteria.useCase
    if (useCase === 'rental_yield') {
      results = [...results].sort((a, b) => b.rentalYield - a.rentalYield)
    } else if (useCase === 'capital_appreciation') {
      results = [...results].sort((a, b) => b.pricePerSqm - a.pricePerSqm)
    }

    // Generate AI summary of results in the user's language
    const topResult = results[0]
    const aiSummaryResponse = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 300,
      system: `You are Sofia, Agency Group's AI property advisor. AMI 22506. Be concise, expert and warm. Respond in ${lang === 'en' ? 'English' : 'Portuguese (European)'}.`,
      messages: [{
        role: 'user',
        content: `Client asked: "${query}"
We found ${results.length} matching properties.
Top result: ${topResult ? `${topResult.title} — €${topResult.price.toLocaleString('pt-PT')} — ${topResult.zone} — ${topResult.rentalYield}% yield` : 'none'}
Write a 2-sentence expert response summarising what we found and why it matches their needs. Do not list all properties — just confirm the match and highlight what makes the top result relevant.`,
      }],
    })

    const aiMessage =
      aiSummaryResponse.content[0].type === 'text'
        ? aiSummaryResponse.content[0].text
        : ''

    return NextResponse.json({
      query,
      criteria,
      results: results.slice(0, 6),
      totalFound: results.length,
      aiMessage,
      semanticSearch: usedSemanticSearch,
      topSimilarity: usedSemanticSearch && semanticResults.length > 0
        ? semanticResults[0].similarity
        : undefined,
      searchedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Search API error:', error)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    description: 'Agency Group Conversational AI Property Search',
    usage: 'POST with { query: string, language?: "pt"|"en" }',
  })
}
