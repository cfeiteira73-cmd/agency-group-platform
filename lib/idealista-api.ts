// =============================================================================
// Idealista API Oficial — OAuth2 REST API
// Documentação: https://developers.idealista.com
// AMI 22506 (Agency Group)
//
// ─── HOW TO GET API ACCESS ───────────────────────────────────────────────────
//
// The Idealista API requires a commercial contract — it is NOT publicly free.
//
// Step-by-step:
// 1. Go to https://developers.idealista.com  (or email apicommercial@idealista.com)
// 2. Fill in the contact form: company (Agency Group), NIF (PT...), use-case
// 3. Wait ~1-2 weeks for commercial proposal
// 4. After contract: you receive IDEALISTA_API_KEY + IDEALISTA_API_SECRET
// 5. Add them to .env.local and Vercel:
//      IDEALISTA_API_KEY=<key>
//      IDEALISTA_API_SECRET=<secret>        ← NOTE: env var is IDEALISTA_API_SECRET
//                                              (the existing code uses IDEALISTA_SECRET —
//                                               both are checked in isConfigured())
// 6. The OAuth flow uses:
//    POST https://api.idealista.com/oauth/token
//    Authorization: Basic base64(key:secret)
//    Body: grant_type=client_credentials&scope=read
//    → access_token valid for 7 days
//
// While waiting for the contract, `searchProperties()` returns mock data
// automatically when env vars are not set (safe, no crashes).
//
// CREDENCIAIS NECESSÁRIAS: IDEALISTA_API_KEY + IDEALISTA_API_SECRET
// =============================================================================

const IDEALISTA_BASE_URL = 'https://api.idealista.com/3.5/pt'
const IDEALISTA_OAUTH_URL = 'https://api.idealista.com/oauth/token'

export interface IdealistaSearchParams {
  operation: 'sale' | 'rent'
  propertyType: 'homes' | 'offices' | 'premises' | 'garages' | 'bedrooms' | 'newDevelopments' | 'land' | 'buildings'
  center?: string          // 'lat,lon' e.g. '38.716,-9.143'
  distance?: number        // meters from center
  locationId?: string      // idealista location ID e.g. '0-EU-PT-11-07-001-135'
  minPrice?: number
  maxPrice?: number
  minSize?: number
  maxSize?: number
  numPage?: number
  maxItems?: number        // max 50 per page
  order?: 'priceDown' | 'priceUp' | 'updatedAt' | 'publicationDate' | 'size' | 'distance'
  sort?: 'asc' | 'desc'
}

export interface IdealistaProperty {
  propertyCode: string
  thumbnail: string
  floor: string
  price: number
  priceByArea: number
  size: number
  rooms: number
  bathrooms: number
  address: string
  province: string
  municipality: string
  district: string
  neighborhood: string
  latitude: number
  longitude: number
  description: string
  url: string
  hasVideo: boolean
  status: string
  newDevelopment: boolean
  hasLift: boolean
  isGround: boolean
  numPhotos: number
  hasPlan: boolean
  has3DTour: boolean
  has360: boolean
  hasStaging: boolean
  topHighlight: boolean
  topNewDevelopment: boolean
  country: string
  operation: string
  propertyType: string
  exterior: boolean
  rooms2: number
  showAddress: boolean
  parkingSpace?: { hasParkingSpace: boolean; isParkingSpaceIncludedInPrice: boolean }
  labels?: string[]
  suggestedTexts?: { title: string; subtitle: string }
  detailedType?: { typology: string; subTypology: string }
  parkingSpacePrice?: number
  priceInfo?: { price: number; pricePerSquareMeter: number }
  contactInfo?: { contactName: string; phone1?: string; phone2?: string; userType: string; isDeveloper: boolean; isAgency: boolean; isProfessional: boolean }
}

export interface IdealistaSearchResult {
  total: number
  totalPages: number
  actualPage: number
  itemsPerPage: number
  country: string
  elementList: IdealistaProperty[]
  summary?: string[]
  upperRangePaginator?: boolean
  paginable?: boolean
  alertName?: string
  hiddenResults?: boolean
}

// ─── Configuration check ─────────────────────────────────────────────────────

/**
 * Returns true when IDEALISTA_API_KEY and IDEALISTA_API_SECRET (or legacy
 * IDEALISTA_SECRET) are both present and non-empty.
 * Safe to call any time — no network calls, no side effects.
 */
export function isConfigured(): boolean {
  const key    = process.env.IDEALISTA_API_KEY
  const secret = process.env.IDEALISTA_API_SECRET ?? process.env.IDEALISTA_SECRET
  return (
    !!key    && key.trim().length > 0 &&
    !!secret && secret.trim().length > 0
  )
}

// ─── Mock data (returned when not configured) ─────────────────────────────────

const MOCK_PROPERTIES: IdealistaProperty[] = [
  {
    propertyCode: 'MOCK-001',
    thumbnail: '',
    floor: '3',
    price: 750_000,
    priceByArea: 5_000,
    size: 150,
    rooms: 3,
    bathrooms: 2,
    address: 'Rua do Alecrim, Lisboa',
    province: 'Lisboa',
    municipality: 'Lisboa',
    district: 'Santa Maria Maior',
    neighborhood: 'Chiado',
    latitude: 38.7098,
    longitude: -9.1408,
    description: '[MOCK] Apartamento T3 em Chiado — dados de exemplo',
    url: 'https://www.idealista.pt/imovel/MOCK-001/',
    hasVideo: false,
    status: 'good',
    newDevelopment: false,
    hasLift: true,
    isGround: false,
    numPhotos: 0,
    hasPlan: false,
    has3DTour: false,
    has360: false,
    hasStaging: false,
    topHighlight: false,
    topNewDevelopment: false,
    country: 'pt',
    operation: 'sale',
    propertyType: 'flat',
    exterior: true,
    rooms2: 3,
    showAddress: false,
  },
]

// ─── Token cache ──────────────────────────────────────────────────────────────

let _cachedToken: { token: string; expiresAt: number } | null = null

export async function getIdealistaToken(): Promise<string> {
  if (_cachedToken && Date.now() < _cachedToken.expiresAt - 60000) {
    return _cachedToken.token
  }

  const key = process.env.IDEALISTA_API_KEY
  const secret = process.env.IDEALISTA_API_SECRET ?? process.env.IDEALISTA_SECRET
  if (!key || !secret) {
    throw new Error('IDEALISTA_API_KEY e IDEALISTA_API_SECRET não configurados. Ver lib/idealista-api.ts para instruções.')
  }

  const credentials = Buffer.from(`${key}:${secret}`).toString('base64')
  const res = await fetch(IDEALISTA_OAUTH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=read',
    next: { revalidate: 0 },
  })

  if (!res.ok) {
    throw new Error(`Idealista OAuth falhou: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()
  _cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  }
  return _cachedToken.token
}

export async function searchProperties(params: IdealistaSearchParams): Promise<IdealistaSearchResult | null> {
  // Graceful mock fallback when credentials are not configured
  if (!isConfigured()) {
    console.info('[Idealista] API not configured — returning mock data. Set IDEALISTA_API_KEY + IDEALISTA_API_SECRET to enable.')
    return {
      total: MOCK_PROPERTIES.length,
      totalPages: 1,
      actualPage: 1,
      itemsPerPage: MOCK_PROPERTIES.length,
      country: 'pt',
      elementList: MOCK_PROPERTIES,
      summary: ['[MOCK] Idealista API not configured — example data only'],
    }
  }

  try {
    const token = await getIdealistaToken()
    const { operation, propertyType, ...rest } = params

    const body = new URLSearchParams()
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined && v !== null) body.set(k, String(v))
    }
    if (!body.has('maxItems')) body.set('maxItems', '50')
    if (!body.has('numPage')) body.set('numPage', '1')

    const url = `${IDEALISTA_BASE_URL}/search?operation=${operation}&propertyType=${propertyType}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

// Convenience: search premium sales for off-market sourcing (Lisboa/Porto/Algarve ≥500K)
export async function searchPremiumSales(cityCenter: string, minPrice = 500000): Promise<IdealistaProperty[]> {
  const result = await searchProperties({
    operation: 'sale',
    propertyType: 'homes',
    center: cityCenter,
    distance: 50000,
    minPrice,
    maxItems: 50,
    order: 'updatedAt',
    sort: 'desc',
  })
  return result?.elementList ?? []
}
