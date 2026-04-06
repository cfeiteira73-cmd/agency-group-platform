import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 30

const client = new Anthropic()

// Property database (aligned with Agency Group portfolio)
const PROPERTIES = [
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
] as const

type Property = (typeof PROPERTIES)[number]

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { query?: unknown; language?: unknown }
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

    // Filter properties based on extracted criteria
    let results: Property[] = [...PROPERTIES]

    const zones = criteria.zones
    if (Array.isArray(zones) && zones.length > 0) {
      results = results.filter(p =>
        zones.some(z => p.zone.toLowerCase().includes(z.toLowerCase()))
      )
    }

    const types = criteria.types
    if (Array.isArray(types) && types.length > 0) {
      results = results.filter(p =>
        types.some(t => p.type.toLowerCase().includes(t.toLowerCase()))
      )
    }

    const maxPrice = criteria.maxPrice
    if (typeof maxPrice === 'number' && maxPrice > 0) {
      results = results.filter(p => p.price <= maxPrice)
    }

    const minPrice = criteria.minPrice
    if (typeof minPrice === 'number' && minPrice > 0) {
      results = results.filter(p => p.price >= minPrice)
    }

    const minBedrooms = criteria.minBedrooms
    if (typeof minBedrooms === 'number' && minBedrooms > 0) {
      results = results.filter(p => p.bedrooms >= minBedrooms)
    }

    const features = criteria.features
    if (Array.isArray(features) && features.length > 0) {
      results = results.filter(p =>
        features.some(f =>
          p.features.some(pf => pf.toLowerCase().includes(f.toLowerCase()))
        )
      )
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
