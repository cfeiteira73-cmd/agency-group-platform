// =============================================================================
// Agency Group — DR Parser: Diário da República Signal Extractor
// GET /api/off-market/signals
// Fetches insolvency/inheritance signals from DRE API, parses property entries,
// caches for 6 hours, falls back to mock data if API unreachable
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DREApiResponse {
  results?: DREEntry[]
  count?: number
  next?: string | null
}

interface DREEntry {
  id?: number | string
  numero?: string
  tipo?: string
  tipo_documento?: string
  serie?: string
  data_publicacao?: string
  sumario?: string
  url?: string
  emitente?: string
  dre_url?: string
}

type SignalType = 'insolvency' | 'inheritance' | 'divorce' | 'relocation' | 'multi_property'

interface ParsedSignal {
  id: string
  type: SignalType
  priority: 1 | 2 | 3 | 4 | 5
  probability_score: number
  property_address: string | null
  property_zone: string | null
  estimated_value: number | null
  owner_name: string | null
  signal_date: string
  source: 'dre_api' | 'mock'
  source_url: string | null
  source_reference: string | null
  raw_summary: string
  recommended_action: string
  property_relevance_reason: string
}

// ---------------------------------------------------------------------------
// In-memory cache (6 hours)
// ---------------------------------------------------------------------------

interface CacheEntry {
  signals: ParsedSignal[]
  fetched_at: number
  source: 'dre_api' | 'mock'
}

let _cache: CacheEntry | null = null
const CACHE_TTL_MS = 6 * 60 * 60 * 1000 // 6 hours

function isCacheValid(): boolean {
  if (!_cache) return false
  return Date.now() - _cache.fetched_at < CACHE_TTL_MS
}

// ---------------------------------------------------------------------------
// DRE keyword patterns for property-relevant signals
// ---------------------------------------------------------------------------

const INSOLVENCY_KEYWORDS = [
  'insolvência', 'insolvencia', 'liquidação', 'liquidacao',
  'administrador de insolvência', 'massa insolvente', 'processo de insolvência',
  'falência', 'falencia', 'credores', 'administrador judicial'
]

const INHERITANCE_KEYWORDS = [
  'habilitação de herdeiros', 'habilitacao de herdeiros',
  'partilha', 'partilhas', 'herança', 'heranca', 'espólio', 'espolio',
  'testamento', 'sucessão', 'sucessao', 'herdeiro', 'herdeiros',
  'inventário', 'inventario', 'óbito', 'obito'
]

const PROPERTY_KEYWORDS = [
  'imóvel', 'imovel', 'prédio', 'predio', 'fracção', 'fracao',
  'apartamento', 'moradia', 'vivenda', 'lote', 'terreno', 'armazém', 'armazem',
  'habitação', 'habitacao', 'andar', 'rés-do-chão', 'res-do-chao',
  'escritura', 'conservatória', 'conservatoria', 'predial', 'urbano', 'rústico', 'rustico'
]

const LOCATION_PATTERNS: Record<string, string> = {
  'lisboa': 'Lisboa',
  'cascais': 'Cascais',
  'sintra': 'Sintra',
  'oeiras': 'Oeiras',
  'estoril': 'Cascais',
  'porto': 'Porto',
  'foz do douro': 'Porto',
  'matosinhos': 'Porto',
  'gaia': 'Porto',
  'algarve': 'Algarve',
  'faro': 'Algarve',
  'loulé': 'Algarve',
  'vilamoura': 'Algarve',
  'albufeira': 'Algarve',
  'lagos': 'Algarve',
  'comporta': 'Comporta',
  'alcácer do sal': 'Comporta',
  'ericeira': 'Ericeira',
  'mafra': 'Ericeira',
  'setúbal': 'Setúbal',
  'funchal': 'Madeira',
  'madeira': 'Madeira',
  'açores': 'Açores',
  'ponta delgada': 'Açores',
}

function normalise(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function detectZone(text: string): string | null {
  const lower = normalise(text)
  for (const [keyword, zone] of Object.entries(LOCATION_PATTERNS)) {
    if (lower.includes(normalise(keyword))) return zone
  }
  return null
}

function extractOwnerName(summary: string): string | null {
  // Try to extract person/company name — common DR patterns
  const patterns = [
    /(?:requerente|devedor|insolvente|falido|herdeiro)[:\s]+([A-ZÀ-Ú][a-zA-ZÀ-ú\s,]{3,60}?)(?:\.|,|;|\n)/i,
    /(?:espólio de|espólio do|espólio da)\s+([A-ZÀ-Ú][a-zA-ZÀ-ú\s]{3,50}?)(?:\.|,|;|\n)/i,
    /([A-ZÀ-Ú][a-zA-ZÀ-ú\s]{2,30}(?:Lda\.|S\.A\.|Unip\.|Lda|SA|S\.A|Unipessoal))/,
  ]

  for (const pattern of patterns) {
    const match = summary.match(pattern)
    if (match?.[1]) {
      return match[1].trim().replace(/\s+/g, ' ').slice(0, 80)
    }
  }
  return null
}

function extractEstimatedValue(summary: string): number | null {
  // Look for monetary values in the summary
  const patterns = [
    /€\s*([\d.,]+)\s*(?:milhões?|M)/i,
    /€\s*([\d.,]+)\s*(?:mil)?/i,
    /([\d.,]+)\s*euros?/i,
    /([\d.,]+)\s*€/i,
  ]

  for (const pattern of patterns) {
    const match = summary.match(pattern)
    if (match?.[1]) {
      const raw = match[1].replace(/\./g, '').replace(',', '.')
      const value = parseFloat(raw)
      if (isNaN(value)) continue

      // If the pattern matched "milhões" multiply by 1M
      if (match[0].toLowerCase().includes('milh')) {
        return Math.round(value * 1_000_000)
      }
      // If very small number, assume thousands
      if (value < 1000) {
        return Math.round(value * 1000)
      }
      return Math.round(value)
    }
  }
  return null
}

function hasPropertyRelevance(summary: string): boolean {
  const lower = normalise(summary)
  return PROPERTY_KEYWORDS.some((kw) => lower.includes(normalise(kw)))
}

function detectSignalType(summary: string): SignalType | null {
  const lower = normalise(summary)

  const isInsolvency = INSOLVENCY_KEYWORDS.some((kw) => lower.includes(normalise(kw)))
  const isInheritance = INHERITANCE_KEYWORDS.some((kw) => lower.includes(normalise(kw)))

  if (isInsolvency) return 'insolvency'
  if (isInheritance) return 'inheritance'
  return null
}

function getRecommendedAction(type: SignalType): string {
  const actions: Record<SignalType, string> = {
    insolvency: 'Contactar administrador de insolvência. Preparar proposta com liquidez imediata. Prazo: 5 dias úteis.',
    inheritance: 'Identificar herdeiros via registo predial. Abordagem empática. Preparar avaliação e proposta de mandato.',
    divorce: 'Abordagem via advogado de família. Solução rápida e discreta. Preparar avaliação em 48h.',
    relocation: 'Contactar com proposta de mandato exclusivo e gestão completa do processo.',
    multi_property: 'Mapear portfólio completo. Preparar análise e proposta de gestão.',
  }
  return actions[type]
}

function getProbabilityScore(
  type: SignalType,
  hasProperty: boolean,
  hasZone: boolean,
  isRecent: boolean
): number {
  let score = 0
  if (type === 'insolvency') score += 40
  if (type === 'inheritance') score += 35
  if (hasProperty) score += 20
  if (hasZone) score += 15
  if (isRecent) score += 10
  return Math.min(100, score)
}

function scoreToPriority(score: number): 1 | 2 | 3 | 4 | 5 {
  if (score >= 80) return 5
  if (score >= 65) return 4
  if (score >= 50) return 3
  if (score >= 35) return 2
  return 1
}

function parseDREEntry(entry: DREEntry, index: number): ParsedSignal | null {
  const summary = entry.sumario ?? ''
  if (!summary || summary.length < 20) return null

  const type = detectSignalType(summary)
  if (!type) return null

  const hasProperty = hasPropertyRelevance(summary)
  // Require property relevance for high-quality signals
  // (still return low-probability signals without it for completeness)

  const zone = detectZone(summary)
  const isRecent = entry.data_publicacao
    ? (Date.now() - new Date(entry.data_publicacao).getTime()) < 14 * 24 * 60 * 60 * 1000
    : false

  const probability = getProbabilityScore(type, hasProperty, !!zone, isRecent)
  const priority = scoreToPriority(probability)

  return {
    id: `dre_${entry.id ?? entry.numero ?? index}_${Date.now()}`,
    type,
    priority,
    probability_score: probability,
    property_address: null,  // DRE entries rarely have exact addresses
    property_zone: zone,
    estimated_value: extractEstimatedValue(summary),
    owner_name: extractOwnerName(summary),
    signal_date: entry.data_publicacao ?? new Date().toISOString().split('T')[0],
    source: 'dre_api',
    source_url: entry.dre_url ?? entry.url ?? null,
    source_reference: entry.numero ?? null,
    raw_summary: summary.slice(0, 500),
    recommended_action: getRecommendedAction(type),
    property_relevance_reason: hasProperty
      ? 'Sumário contém referência explícita a imóvel/prédio'
      : 'Processo pode envolver activos imobiliários (insolvência/herança)',
  }
}

// ---------------------------------------------------------------------------
// Fetch from DRE API
// ---------------------------------------------------------------------------

const DRE_BASE_URL = 'https://dre.pt/dre/api/v2'

async function fetchFromDRE(): Promise<ParsedSignal[]> {
  const searchTerms = [
    'insolvência imóvel',
    'habilitação de herdeiros imóvel',
    'liquidação imóvel',
    'massa insolvente prédio',
    'partilha habitação',
  ]

  const signals: ParsedSignal[] = []
  const today = new Date()
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
  const dateFrom = thirtyDaysAgo.toISOString().split('T')[0]

  for (const term of searchTerms) {
    const url = new URL(`${DRE_BASE_URL}/search/`)
    url.searchParams.set('q', term)
    url.searchParams.set('data_publicacao_inicio', dateFrom)
    url.searchParams.set('page_size', '20')
    url.searchParams.set('ordering', '-data_publicacao')

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'AgencyGroup-SignalParser/1.0',
      },
      // 8 second timeout
      signal: AbortSignal.timeout(8000),
    })

    if (!response.ok) {
      console.warn(`[dr-parser] DRE API returned ${response.status} for term: ${term}`)
      continue
    }

    const data = (await response.json()) as DREApiResponse

    if (data.results && Array.isArray(data.results)) {
      for (const [index, entry] of data.results.entries()) {
        const signal = parseDREEntry(entry, index)
        if (signal) signals.push(signal)
      }
    }
  }

  // Deduplicate by source_reference
  const seen = new Set<string>()
  return signals.filter((s) => {
    const key = s.source_reference ?? s.id
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

// ---------------------------------------------------------------------------
// Mock fallback data — realistic DR-style signals
// ---------------------------------------------------------------------------

const MOCK_DR_SIGNALS: ParsedSignal[] = [
  {
    id: 'dre_mock_001',
    type: 'insolvency',
    priority: 5,
    probability_score: 85,
    property_address: null,
    property_zone: 'Lisboa',
    estimated_value: 1_200_000,
    owner_name: 'Construções Atlântico Lda.',
    signal_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'mock',
    source_url: 'https://dre.pt/dre/detalhe/anuncio/1234567/2026',
    source_reference: 'Anúncio 123456/2026',
    raw_summary: 'Anúncio de insolvência — Construções Atlântico Lda. Massa insolvente inclui imóvel sito em Lisboa, fracção autónoma designada pela letra A, com área de 180m². Administrador de insolvência: Dr. João Martins.',
    recommended_action: getRecommendedAction('insolvency'),
    property_relevance_reason: 'Sumário contém referência explícita a imóvel/prédio',
  },
  {
    id: 'dre_mock_002',
    type: 'inheritance',
    priority: 4,
    probability_score: 75,
    property_address: null,
    property_zone: 'Cascais',
    estimated_value: 2_500_000,
    owner_name: 'Espólio Maria Fernanda Costa',
    signal_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'mock',
    source_url: 'https://dre.pt/dre/detalhe/anuncio/1234568/2026',
    source_reference: 'Anúncio 123568/2026',
    raw_summary: 'Habilitação de herdeiros — Espólio de Maria Fernanda Costa. Inclui prédio urbano sito no município de Cascais, inscrito na matriz predial urbana sob o artigo 4521. Herdeiros habilitados: Ana Costa, Pedro Costa.',
    recommended_action: getRecommendedAction('inheritance'),
    property_relevance_reason: 'Sumário contém referência explícita a imóvel/prédio',
  },
  {
    id: 'dre_mock_003',
    type: 'insolvency',
    priority: 5,
    probability_score: 90,
    property_address: null,
    property_zone: 'Porto',
    estimated_value: 800_000,
    owner_name: 'Hotelaria Norte SA',
    signal_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'mock',
    source_url: 'https://dre.pt/dre/detalhe/anuncio/1234570/2026',
    source_reference: 'Anúncio 123570/2026',
    raw_summary: 'Processo de insolvência — Hotelaria Norte SA. Bens da massa insolvente incluem prédio misto sito na Foz do Douro, Porto. Avaliação provisória €800.000. Liquidação prevista para 3.º trimestre 2026.',
    recommended_action: getRecommendedAction('insolvency'),
    property_relevance_reason: 'Sumário contém referência explícita a imóvel/prédio',
  },
  {
    id: 'dre_mock_004',
    type: 'inheritance',
    priority: 3,
    probability_score: 62,
    property_address: null,
    property_zone: 'Algarve',
    estimated_value: 1_800_000,
    owner_name: 'Espólio António Rodrigues',
    signal_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'mock',
    source_url: 'https://dre.pt/dre/detalhe/anuncio/1234572/2026',
    source_reference: 'Anúncio 123572/2026',
    raw_summary: 'Partilha hereditária — Espólio de António Rodrigues. Inclui moradia sita em Vilamoura, Loulé. Inventário em curso no Cartório Notarial de Loulé. Herdeiros em acordo para venda amigável.',
    recommended_action: getRecommendedAction('inheritance'),
    property_relevance_reason: 'Sumário contém referência explícita a imóvel/prédio',
  },
  {
    id: 'dre_mock_005',
    type: 'insolvency',
    priority: 4,
    probability_score: 78,
    property_address: null,
    property_zone: 'Lisboa',
    estimated_value: 3_200_000,
    owner_name: 'Imobiliária Lisboa Centro Unip. Lda.',
    signal_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'mock',
    source_url: 'https://dre.pt/dre/detalhe/anuncio/1234575/2026',
    source_reference: 'Anúncio 123575/2026',
    raw_summary: 'Declaração de insolvência — Imobiliária Lisboa Centro Unip. Lda. Massa insolvente inclui 3 fracções autónomas no Chiado, Lisboa. Administrador nomeado pelo Tribunal Judicial da Comarca de Lisboa.',
    recommended_action: getRecommendedAction('insolvency'),
    property_relevance_reason: 'Sumário contém referência explícita a imóvel/prédio',
  },
  {
    id: 'dre_mock_006',
    type: 'inheritance',
    priority: 4,
    probability_score: 70,
    property_address: null,
    property_zone: 'Comporta',
    estimated_value: 6_000_000,
    owner_name: 'Espólio Família Albuquerque',
    signal_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    source: 'mock',
    source_url: 'https://dre.pt/dre/detalhe/anuncio/1234578/2026',
    source_reference: 'Anúncio 123578/2026',
    raw_summary: 'Habilitação de herdeiros — Espólio da Família Albuquerque. Propriedade rústica com 12 hectares em Comporta, Alcácer do Sal. Herdeiros a avaliar opções: subdivisão vs. venda global.',
    recommended_action: getRecommendedAction('inheritance'),
    property_relevance_reason: 'Sumário contém referência explícita a imóvel/prédio',
  },
]

// ---------------------------------------------------------------------------
// Main GET handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url)
    const forceRefresh = searchParams.get('refresh') === 'true'
    const minPriority  = parseInt(searchParams.get('min_priority') ?? '1', 10)
    const typeFilter   = searchParams.get('type') as SignalType | null
    const limit        = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 50)

    // Return cached data if valid and not forced refresh
    if (!forceRefresh && isCacheValid() && _cache) {
      let signals = [..._cache.signals]
      if (typeFilter) signals = signals.filter((s) => s.type === typeFilter)
      if (minPriority > 1) signals = signals.filter((s) => s.priority >= minPriority)

      return NextResponse.json({
        signals: signals.slice(0, limit),
        total: signals.length,
        cache_status: 'hit',
        cache_age_minutes: Math.round((Date.now() - _cache.fetched_at) / 60000),
        data_source: _cache.source,
        fetched_at: new Date(_cache.fetched_at).toISOString(),
        next_refresh_at: new Date(_cache.fetched_at + CACHE_TTL_MS).toISOString(),
      })
    }

    // Attempt live DRE API fetch
    let signals: ParsedSignal[] = []
    let dataSource: 'dre_api' | 'mock' = 'dre_api'

    try {
      const dreSignals = await fetchFromDRE()
      signals = dreSignals
      console.info(`[dr-parser] Fetched ${signals.length} signals from DRE API`)
    } catch (dreError) {
      console.warn('[dr-parser] DRE API unreachable, using mock data:', dreError)
      signals = MOCK_DR_SIGNALS
      dataSource = 'mock'
    }

    // If DRE returned nothing meaningful, supplement with mock
    if (signals.length === 0) {
      signals = MOCK_DR_SIGNALS
      dataSource = 'mock'
    }

    // Sort by priority desc, then probability desc
    signals.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority
      return b.probability_score - a.probability_score
    })

    // Update cache
    _cache = {
      signals,
      fetched_at: Date.now(),
      source: dataSource,
    }

    // Apply filters
    let filtered = [...signals]
    if (typeFilter) filtered = filtered.filter((s) => s.type === typeFilter)
    if (minPriority > 1) filtered = filtered.filter((s) => s.priority >= minPriority)

    return NextResponse.json({
      signals: filtered.slice(0, limit),
      total: filtered.length,
      cache_status: 'miss',
      cache_age_minutes: 0,
      data_source: dataSource,
      fetched_at: new Date(_cache.fetched_at).toISOString(),
      next_refresh_at: new Date(_cache.fetched_at + CACHE_TTL_MS).toISOString(),
    })
  } catch (error) {
    console.error('[dr-parser] Unexpected error:', error)

    // Last resort: return mock data
    return NextResponse.json({
      signals: MOCK_DR_SIGNALS,
      total: MOCK_DR_SIGNALS.length,
      cache_status: 'error_fallback',
      data_source: 'mock',
      error: 'DRE API unavailable, returning cached mock data',
      fetched_at: new Date().toISOString(),
      next_refresh_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
    })
  }
}
