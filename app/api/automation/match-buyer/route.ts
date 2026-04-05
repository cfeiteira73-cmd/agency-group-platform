// =============================================================================
// Agency Group — Buyer-Property Matching API
// POST /api/automation/match-buyer
// Matches buyer profile against property database, returns top 5 with explanations
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'

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
}

interface MockProperty {
  id: string
  title: string
  type: string
  price: number
  area_m2: number
  bedrooms: number
  bathrooms: number
  concelho: string
  zone: string
  features: string[]
  status: 'active' | 'under_offer' | 'sold'
  is_exclusive: boolean
  investor_suitable: boolean
  estimated_rental_yield: number | null
  estimated_cap_rate: number | null
  description: string
  photos_count: number
  energy_certificate: string
  year_built: number | null
  is_off_market: boolean
}

interface MatchResult {
  property: MockProperty
  match_score: number
  match_reasons: string[]
  explanation: string
  estimated_yield: number | null
}

interface MatchBreakdown {
  price_in_budget: number
  location_match: number
  typology_match: number
  features_match: number
  availability: number
}

// ---------------------------------------------------------------------------
// Mock property database — 15 properties across PT luxury market
// ---------------------------------------------------------------------------

const MOCK_PROPERTIES: MockProperty[] = [
  {
    id: 'prop_001',
    title: 'Apartamento T3 com Vista Rio — Chiado',
    type: 'apartment',
    price: 1_250_000,
    area_m2: 145,
    bedrooms: 3,
    bathrooms: 2,
    concelho: 'Lisboa',
    zone: 'Chiado',
    features: ['river_view', 'elevator', 'garage', 'terrace', 'renovated'],
    status: 'active',
    is_exclusive: true,
    investor_suitable: true,
    estimated_rental_yield: 4.2,
    estimated_cap_rate: 3.8,
    description: 'Apartamento nobre em palacete reabilitado no coração do Chiado. Vistas deslumbrantes sobre o Tejo.',
    photos_count: 18,
    energy_certificate: 'B',
    year_built: 1890,
    is_off_market: false,
  },
  {
    id: 'prop_002',
    title: 'Villa com Piscina — Quinta da Marinha',
    type: 'villa',
    price: 3_200_000,
    area_m2: 450,
    bedrooms: 5,
    bathrooms: 4,
    concelho: 'Cascais',
    zone: 'Quinta da Marinha',
    features: ['pool', 'garden', 'garage', 'golf_view', 'security', 'smart_home'],
    status: 'active',
    is_exclusive: true,
    investor_suitable: false,
    estimated_rental_yield: 3.5,
    estimated_cap_rate: null,
    description: 'Villa de luxo com piscina aquecida e vista para o campo de golfe. Condomínio privado.',
    photos_count: 32,
    energy_certificate: 'A',
    year_built: 2018,
    is_off_market: false,
  },
  {
    id: 'prop_003',
    title: 'Penthouse T4 — Príncipe Real',
    type: 'penthouse',
    price: 2_800_000,
    area_m2: 280,
    bedrooms: 4,
    bathrooms: 3,
    concelho: 'Lisboa',
    zone: 'Príncipe Real',
    features: ['rooftop_terrace', 'panoramic_view', 'elevator', 'parking', 'renovated', 'sea_view'],
    status: 'active',
    is_exclusive: true,
    investor_suitable: true,
    estimated_rental_yield: 4.0,
    estimated_cap_rate: 3.5,
    description: 'Penthouse único com terraço panorâmico sobre Lisboa. Acabamentos de alta qualidade.',
    photos_count: 24,
    energy_certificate: 'A+',
    year_built: 2020,
    is_off_market: false,
  },
  {
    id: 'prop_004',
    title: 'Apartamento T2 — Parque das Nações',
    type: 'apartment',
    price: 480_000,
    area_m2: 92,
    bedrooms: 2,
    bathrooms: 2,
    concelho: 'Lisboa',
    zone: 'Parque das Nações',
    features: ['river_view', 'elevator', 'parking', 'balcony', 'new_build'],
    status: 'active',
    is_exclusive: false,
    investor_suitable: true,
    estimated_rental_yield: 5.1,
    estimated_cap_rate: 4.6,
    description: 'Apartamento moderno em edifício novo. Condomínio com ginásio e piscina.',
    photos_count: 14,
    energy_certificate: 'A',
    year_built: 2022,
    is_off_market: false,
  },
  {
    id: 'prop_005',
    title: 'Moradia V4 — Estoril',
    type: 'townhouse',
    price: 1_850_000,
    area_m2: 320,
    bedrooms: 4,
    bathrooms: 3,
    concelho: 'Cascais',
    zone: 'Estoril',
    features: ['pool', 'garden', 'garage', 'sea_view', 'fireplace'],
    status: 'active',
    is_exclusive: false,
    investor_suitable: false,
    estimated_rental_yield: 3.8,
    estimated_cap_rate: null,
    description: 'Moradia com piscina a 300m da praia do Estoril. Jardim maduro com árvores de fruto.',
    photos_count: 22,
    energy_certificate: 'C',
    year_built: 1985,
    is_off_market: false,
  },
  {
    id: 'prop_006',
    title: 'Apartamento T3 Golden Visa — Bairro Alto',
    type: 'apartment',
    price: 620_000,
    area_m2: 105,
    bedrooms: 3,
    bathrooms: 2,
    concelho: 'Lisboa',
    zone: 'Bairro Alto',
    features: ['elevator', 'renovated', 'garage', 'golden_visa_eligible'],
    status: 'active',
    is_exclusive: true,
    investor_suitable: true,
    estimated_rental_yield: 4.8,
    estimated_cap_rate: 4.3,
    description: 'Apartamento elegíavel para Golden Visa em zona histórica. Rendimento garantido 5 anos.',
    photos_count: 16,
    energy_certificate: 'B',
    year_built: 1920,
    is_off_market: false,
  },
  {
    id: 'prop_007',
    title: 'Villa Contemporânea — Comporta',
    type: 'villa',
    price: 4_500_000,
    area_m2: 580,
    bedrooms: 6,
    bathrooms: 5,
    concelho: 'Alcácer do Sal',
    zone: 'Comporta',
    features: ['pool', 'beach_access', 'garden', 'privacy', 'architecture', 'dune_view'],
    status: 'active',
    is_exclusive: true,
    investor_suitable: false,
    estimated_rental_yield: 4.5,
    estimated_cap_rate: null,
    description: 'Villa de autor em Comporta com acesso directo à praia. Privacidade total em 3 hectares.',
    photos_count: 40,
    energy_certificate: 'A',
    year_built: 2021,
    is_off_market: false,
  },
  {
    id: 'prop_008',
    title: 'Apartamento T1 Investimento — Alfama',
    type: 'apartment',
    price: 285_000,
    area_m2: 58,
    bedrooms: 1,
    bathrooms: 1,
    concelho: 'Lisboa',
    zone: 'Alfama',
    features: ['castle_view', 'renovated', 'al_license'],
    status: 'active',
    is_exclusive: false,
    investor_suitable: true,
    estimated_rental_yield: 6.2,
    estimated_cap_rate: 5.8,
    description: 'Apartamento com licença AL ativa e vista para o Castelo. Historial de 90% de ocupação.',
    photos_count: 10,
    energy_certificate: 'C',
    year_built: 1950,
    is_off_market: false,
  },
  {
    id: 'prop_009',
    title: 'Penthouse T3 Vista Mar — Cascais',
    type: 'penthouse',
    price: 1_680_000,
    area_m2: 195,
    bedrooms: 3,
    bathrooms: 2,
    concelho: 'Cascais',
    zone: 'Cascais',
    features: ['sea_view', 'terrace', 'elevator', 'parking', 'new_build'],
    status: 'active',
    is_exclusive: false,
    investor_suitable: true,
    estimated_rental_yield: 4.0,
    estimated_cap_rate: 3.6,
    description: 'Penthouse novo com vistas de 180° sobre o Atlântico. A 100m da praia de Cascais.',
    photos_count: 28,
    energy_certificate: 'A+',
    year_built: 2023,
    is_off_market: false,
  },
  {
    id: 'prop_010',
    title: 'Moradia V5 com Piscina — Sintra',
    type: 'villa',
    price: 1_400_000,
    area_m2: 380,
    bedrooms: 5,
    bathrooms: 4,
    concelho: 'Sintra',
    zone: 'São Pedro de Penaferrim',
    features: ['pool', 'garden', 'garage', 'mountain_view', 'fireplace', 'wine_cellar'],
    status: 'active',
    is_exclusive: false,
    investor_suitable: false,
    estimated_rental_yield: 3.2,
    estimated_cap_rate: null,
    description: 'Moradia senhorial rodeada de natureza a 5 minutos do centro histórico de Sintra.',
    photos_count: 26,
    energy_certificate: 'B',
    year_built: 1992,
    is_off_market: false,
  },
  {
    id: 'prop_011',
    title: 'Apartamento T2 Vista Rio — Santos',
    type: 'apartment',
    price: 780_000,
    area_m2: 112,
    bedrooms: 2,
    bathrooms: 2,
    concelho: 'Lisboa',
    zone: 'Santos',
    features: ['river_view', 'terrace', 'elevator', 'parking', 'renovated'],
    status: 'active',
    is_exclusive: true,
    investor_suitable: true,
    estimated_rental_yield: 4.5,
    estimated_cap_rate: 4.0,
    description: 'Apartamento reabilitado com varanda sobre o Tejo. Localização privilegiada entre Cais do Sodré e Belém.',
    photos_count: 19,
    energy_certificate: 'B+',
    year_built: 1905,
    is_off_market: false,
  },
  {
    id: 'prop_012',
    title: 'Villa Off-Market — Vilamoura',
    type: 'villa',
    price: 2_200_000,
    area_m2: 390,
    bedrooms: 4,
    bathrooms: 3,
    concelho: 'Loulé',
    zone: 'Vilamoura',
    features: ['pool', 'golf_view', 'garage', 'garden', 'smart_home', 'privacy'],
    status: 'active',
    is_exclusive: true,
    investor_suitable: false,
    estimated_rental_yield: 4.8,
    estimated_cap_rate: null,
    description: 'Villa off-market com piscina privada em condomínio de golfe. Não listada nos portais.',
    photos_count: 35,
    energy_certificate: 'A',
    year_built: 2016,
    is_off_market: true,
  },
  {
    id: 'prop_013',
    title: 'Apartamento T4 — Foz do Douro',
    type: 'apartment',
    price: 950_000,
    area_m2: 165,
    bedrooms: 4,
    bathrooms: 3,
    concelho: 'Porto',
    zone: 'Foz do Douro',
    features: ['sea_view', 'elevator', 'parking', 'renovated', 'balcony'],
    status: 'active',
    is_exclusive: false,
    investor_suitable: true,
    estimated_rental_yield: 4.9,
    estimated_cap_rate: 4.4,
    description: 'Apartamento espaçoso na zona nobre do Porto com vistas para o oceano Atlântico.',
    photos_count: 21,
    energy_certificate: 'B',
    year_built: 1975,
    is_off_market: false,
  },
  {
    id: 'prop_014',
    title: 'Penthouse T3 — Funchal, Madeira',
    type: 'penthouse',
    price: 1_100_000,
    area_m2: 210,
    bedrooms: 3,
    bathrooms: 2,
    concelho: 'Funchal',
    zone: 'Madeira',
    features: ['ocean_view', 'rooftop_pool', 'elevator', 'parking', 'new_build', 'concierge'],
    status: 'active',
    is_exclusive: true,
    investor_suitable: true,
    estimated_rental_yield: 5.0,
    estimated_cap_rate: 4.5,
    description: 'Penthouse de luxo com piscina na cobertura e vistas sobre a baía do Funchal. Entrega imediata.',
    photos_count: 30,
    energy_certificate: 'A+',
    year_built: 2024,
    is_off_market: false,
  },
  {
    id: 'prop_015',
    title: 'Moradia T6 — Aroeira Golf',
    type: 'villa',
    price: 2_650_000,
    area_m2: 520,
    bedrooms: 6,
    bathrooms: 5,
    concelho: 'Almada',
    zone: 'Aroeira',
    features: ['pool', 'golf_view', 'garden', 'garage', 'fireplace', 'home_cinema', 'tennis_court'],
    status: 'active',
    is_exclusive: false,
    investor_suitable: false,
    estimated_rental_yield: 3.5,
    estimated_cap_rate: null,
    description: 'Imponente moradia em condomínio de golf da Aroeira. Espaços generosos e acabamentos premium.',
    photos_count: 38,
    energy_certificate: 'B+',
    year_built: 2008,
    is_off_market: false,
  },
]

// ---------------------------------------------------------------------------
// Matching algorithm
// ---------------------------------------------------------------------------

function normaliseLocation(loc: string): string {
  return loc.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function locationMatch(property: MockProperty, requestedLocations: string[]): boolean {
  const propLocations = [
    property.concelho,
    property.zone,
  ].map(normaliseLocation)

  return requestedLocations.some((loc) => {
    const normLoc = normaliseLocation(loc)
    return propLocations.some((pLoc) => pLoc.includes(normLoc) || normLoc.includes(pLoc))
  })
}

function scoreFeaturesMatch(
  propertyFeatures: string[],
  requiredFeatures: string[]
): number {
  if (!requiredFeatures || requiredFeatures.length === 0) return 15 // No requirements = full score

  const normPropFeatures = propertyFeatures.map((f) => f.toLowerCase())
  const matched = requiredFeatures.filter((req) =>
    normPropFeatures.some((pf) => pf.includes(req.toLowerCase()) || req.toLowerCase().includes(pf))
  )

  return Math.round((matched.length / requiredFeatures.length) * 15)
}

function scoreProperty(
  property: MockProperty,
  buyer: BuyerProfile
): { score: number; breakdown: MatchBreakdown; reasons: string[] } {
  const breakdown: MatchBreakdown = {
    price_in_budget: 0,
    location_match: 0,
    typology_match: 0,
    features_match: 0,
    availability: 0,
  }
  const reasons: string[] = []

  // 1. Price in budget (max 30)
  if (property.price >= buyer.budget_min && property.price <= buyer.budget_max) {
    breakdown.price_in_budget = 30
    const priceK = Math.round(property.price / 1000)
    reasons.push(`Preço €${priceK}K dentro do orçamento definido`)
  } else if (property.price <= buyer.budget_max * 1.1) {
    // Within 10% over budget — partial score
    breakdown.price_in_budget = 15
    reasons.push(`Preço ligeiramente acima do orçamento máximo (+10%)`)
  }

  // 2. Location match (max 25)
  if (locationMatch(property, buyer.locations)) {
    breakdown.location_match = 25
    reasons.push(`Localização ${property.zone} coincide com preferências`)
  }

  // 3. Typology match (max 20)
  if (!buyer.typology) {
    breakdown.typology_match = 20 // No preference = full score
  } else {
    const normTypo = buyer.typology.toLowerCase()
    const normPropType = property.type.toLowerCase()
    if (normPropType === normTypo || normPropType.includes(normTypo) || normTypo.includes(normPropType)) {
      breakdown.typology_match = 20
      reasons.push(`Tipologia ${property.type} conforme solicitado`)
    }
  }

  // 4. Features match (max 15)
  const featScore = scoreFeaturesMatch(property.features, buyer.features_required ?? [])
  breakdown.features_match = featScore
  if (featScore > 0 && (buyer.features_required?.length ?? 0) > 0) {
    const matchedCount = Math.round((featScore / 15) * (buyer.features_required?.length ?? 0))
    reasons.push(`${matchedCount}/${buyer.features_required?.length ?? 0} características solicitadas presentes`)
  }

  // 5. Availability (max 10)
  if (property.status === 'active') {
    breakdown.availability = 10
    if (property.is_exclusive) {
      reasons.push('Imóvel em exclusivo Agency Group — acesso prioritário')
    } else if (property.is_off_market) {
      reasons.push('Oportunidade off-market — não listada nos portais')
    }
  }

  // Bedrooms check
  if (buyer.bedrooms_min && property.bedrooms < buyer.bedrooms_min) {
    // Penalise but don't zero out
    breakdown.typology_match = Math.max(0, breakdown.typology_match - 10)
  } else if (buyer.bedrooms_min && property.bedrooms >= buyer.bedrooms_min) {
    reasons.push(`${property.bedrooms} quartos — atende ao mínimo de ${buyer.bedrooms_min}`)
  }

  // Use type bonus for investor
  if (buyer.use_type === 'investment' && property.investor_suitable && property.estimated_rental_yield) {
    reasons.push(`Yield estimado de ${property.estimated_rental_yield}% — adequado para investimento`)
  }

  const totalScore = Math.min(
    100,
    breakdown.price_in_budget +
    breakdown.location_match +
    breakdown.typology_match +
    breakdown.features_match +
    breakdown.availability
  )

  return { score: totalScore, breakdown, reasons }
}

function generateExplanation(
  property: MockProperty,
  score: number,
  buyer: BuyerProfile,
  reasons: string[]
): string {
  const priceK = Math.round(property.price / 1000)
  const useType = buyer.use_type === 'investment' ? 'investimento' :
                  buyer.use_type === 'golden_visa' ? 'Golden Visa' :
                  buyer.use_type === 'holiday' ? 'residência de férias' : 'residência principal'

  const matchQuality = score >= 80 ? 'excelente' : score >= 60 ? 'muito boa' : score >= 40 ? 'boa' : 'razoável'

  const yieldNote = property.estimated_rental_yield
    ? ` O yield bruto estimado é de ${property.estimated_rental_yield}%, acima da média da zona.`
    : ''

  const exclusiveNote = property.is_exclusive
    ? ' Temos mandato exclusivo, o que confere vantagem negocial.'
    : property.is_off_market
    ? ' Este imóvel não está listado publicamente, dando-lhe acesso privilegiado.'
    : ''

  return `Esta propriedade apresenta uma correspondência ${matchQuality} (${score}/100) com o seu perfil de ${useType}. ${reasons.slice(0, 2).join('. ')}.${yieldNote}${exclusiveNote} Recomendamos uma visita para avaliar o potencial ao vivo — podemos agendar para esta semana.`
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
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
      budget_min: data.budget_min as number,
      budget_max: data.budget_max as number,
      locations: (data.locations as unknown[]).filter((l) => typeof l === 'string') as string[],
      typology: typeof data.typology === 'string' ? data.typology : undefined,
      bedrooms_min: typeof data.bedrooms_min === 'number' ? data.bedrooms_min : undefined,
      features_required: Array.isArray(data.features_required)
        ? (data.features_required as unknown[]).filter((f) => typeof f === 'string') as string[]
        : undefined,
      use_type: typeof data.use_type === 'string' ? data.use_type : undefined,
    }

    // Only match against active properties
    const activeProperties = MOCK_PROPERTIES.filter((p) => p.status === 'active')

    // Score all properties
    const scoredProperties: MatchResult[] = activeProperties.map((property) => {
      const { score, reasons } = scoreProperty(property, buyer)
      const explanation = generateExplanation(property, score, buyer, reasons)

      return {
        property,
        match_score: score,
        match_reasons: reasons,
        explanation,
        estimated_yield: buyer.use_type === 'investment' ? property.estimated_rental_yield : null,
      }
    })

    // Sort by score descending, take top 5
    const top5 = scoredProperties
      .filter((r) => r.match_score > 0)
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 5)

    return NextResponse.json({
      matches: top5,
      total_properties_evaluated: activeProperties.length,
      buyer_profile_summary: {
        budget_range: `€${Math.round(buyer.budget_min / 1000)}K – €${Math.round(buyer.budget_max / 1000)}K`,
        locations: buyer.locations,
        typology: buyer.typology ?? 'Qualquer',
        bedrooms_min: buyer.bedrooms_min ?? 'Qualquer',
        use_type: buyer.use_type ?? 'Não especificado',
        features_required: buyer.features_required ?? [],
      },
      generated_at: new Date().toISOString(),
      note: 'Production will use pgvector match_properties() with Voyage AI embeddings for semantic matching',
    })
  } catch (error) {
    console.error('[match-buyer] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: 'POST /api/automation/match-buyer',
    description: 'Match buyer profile against property database. Returns top 5 matches with Portuguese explanations.',
    request_schema: {
      budget_min: 'number (EUR) — required',
      budget_max: 'number (EUR) — required',
      locations: 'string[] — required (e.g. ["Lisboa", "Cascais"])',
      typology: 'string? — e.g. "apartment", "villa", "penthouse"',
      bedrooms_min: 'number? — minimum number of bedrooms',
      features_required: 'string[]? — e.g. ["pool", "garage", "sea_view"]',
      use_type: 'string? — "primary_residence" | "investment" | "holiday" | "golden_visa"',
    },
    scoring: {
      price_in_budget: 30,
      location_match: 25,
      typology_match: 20,
      features_match: 15,
      availability: 10,
    },
  })
}
