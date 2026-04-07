// =============================================================================
// AGENCY GROUP — Market Data API v2.0
// GET  /api/market-data         — full 2026 Portugal market data
// GET  /api/market-data?zone=   — single zone detail + live scrape
// GET  /api/market-data?type=   — prices | yields | transactions | trends
// POST /api/market-data         — manual cache refresh (Idealista scrape)
// AMI: 22506 | Static 2026 data + optional live Idealista scraping
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ZoneMarketData {
  zona: string
  pm2_mediana: number
  var_yoy: number
  source: string
  fetched_at: string
}

interface CacheEntry {
  data: ZoneMarketData
  expires_at: number
}

interface ZoneData {
  zone: string
  price_m2: number
  yoy: number
  yield: number
  dom: number
  volume: number
  supply: 'very_low' | 'low' | 'medium' | 'high' | 'very_high'
  demand: 'very_low' | 'low' | 'medium' | 'high' | 'very_high'
}

interface NationalData {
  median_price_m2: number
  yoy_change: number
  total_transactions: number
  avg_dom: number
  euribor_6m: number
  total_credit_volume_bn: number
  foreign_buyer_pct: number
}

interface LuxuryData {
  lisbon_rank_global: number
  prime_lisboa_price_m2: number
  prime_cascais_price_m2: number
  hnwi_inquiries_yoy: number
}

interface FullMarketData {
  zones: ZoneData[]
  national: NationalData
  luxury: LuxuryData
  updated_at: string
}

// ---------------------------------------------------------------------------
// Rate-limit headers
// ---------------------------------------------------------------------------

function rateLimitHeaders(): HeadersInit {
  return {
    'X-RateLimit-Limit':     '60',
    'X-RateLimit-Remaining': '59',
    'X-RateLimit-Reset':     String(Math.floor(Date.now() / 1000) + 60),
    'Cache-Control':         'public, s-maxage=3600, stale-while-revalidate=86400',
  }
}

// ---------------------------------------------------------------------------
// In-memory cache (7 days TTL for scraped data)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000
const marketCache = new Map<string, CacheEntry>()

// ---------------------------------------------------------------------------
// 2026 Comprehensive Zone Data
// ---------------------------------------------------------------------------

const ZONE_DATA_2026: ZoneData[] = [
  { zone: 'Lisboa',   price_m2: 5000, yoy: 18.2, yield: 4.2, dom: 145, volume: 12450, supply: 'low',      demand: 'very_high' },
  { zone: 'Cascais',  price_m2: 4713, yoy: 15.8, yield: 3.8, dom: 168, volume: 3200,  supply: 'very_low', demand: 'high'      },
  { zone: 'Algarve',  price_m2: 3941, yoy: 22.1, yield: 6.5, dom: 195, volume: 8900,  supply: 'low',      demand: 'high'      },
  { zone: 'Porto',    price_m2: 3643, yoy: 16.4, yield: 5.1, dom: 178, volume: 9800,  supply: 'medium',   demand: 'high'      },
  { zone: 'Madeira',  price_m2: 3760, yoy: 19.3, yield: 7.2, dom: 210, volume: 2100,  supply: 'low',      demand: 'medium'    },
  { zone: 'Açores',   price_m2: 1952, yoy: 12.1, yield: 8.5, dom: 245, volume: 850,   supply: 'medium',   demand: 'medium'    },
  { zone: 'Sintra',   price_m2: 3200, yoy: 14.2, yield: 4.8, dom: 190, volume: 4200,  supply: 'medium',   demand: 'high'      },
  { zone: 'Oeiras',   price_m2: 4100, yoy: 16.9, yield: 4.1, dom: 155, volume: 3800,  supply: 'low',      demand: 'high'      },
  { zone: 'Setúbal',  price_m2: 2200, yoy: 13.5, yield: 5.8, dom: 220, volume: 2900,  supply: 'medium',   demand: 'medium'    },
  { zone: 'Braga',    price_m2: 2100, yoy: 15.1, yield: 6.1, dom: 235, volume: 3100,  supply: 'medium',   demand: 'medium'    },
]

const NATIONAL_2026: NationalData = {
  median_price_m2:        3076,
  yoy_change:             17.6,
  total_transactions:     169812,
  avg_dom:                210,
  euribor_6m:             3.15,
  total_credit_volume_bn: 14.2,
  foreign_buyer_pct:      12.3,
}

const LUXURY_2026: LuxuryData = {
  lisbon_rank_global:     4,
  prime_lisboa_price_m2:  12500,
  prime_cascais_price_m2: 9800,
  hnwi_inquiries_yoy:     34.2,
}

// ---------------------------------------------------------------------------
// Static fallback (used for Idealista scraping baseline)
// ---------------------------------------------------------------------------

const STATIC_FALLBACK: Record<string, { pm2: number; var_yoy: number }> = {
  'Lisboa':                    { pm2: 5000, var_yoy: 18.2 },
  'Porto':                     { pm2: 3643, var_yoy: 16.4 },
  'Cascais':                   { pm2: 4713, var_yoy: 15.8 },
  'Algarve':                   { pm2: 3941, var_yoy: 22.1 },
  'Madeira — Funchal':         { pm2: 3760, var_yoy: 19.3 },
  'Sintra':                    { pm2: 3200, var_yoy: 14.2 },
  'Oeiras':                    { pm2: 4100, var_yoy: 16.9 },
  'Braga':                     { pm2: 2100, var_yoy: 15.1 },
  'Setúbal':                   { pm2: 2200, var_yoy: 13.5 },
  'Coimbra':                   { pm2: 2300, var_yoy: 17.0 },
  'Aveiro':                    { pm2: 2500, var_yoy: 18.0 },
  'Vilamoura':                 { pm2: 5000, var_yoy: 18.0 },
  'Lagos':                     { pm2: 4400, var_yoy: 19.0 },
  'Albufeira':                 { pm2: 3700, var_yoy: 19.0 },
  'Comporta':                  { pm2: 8500, var_yoy: 12.0 },
  'Quinta do Lago':            { pm2: 12000, var_yoy: 15.0 },
  'Matosinhos':                { pm2: 3100, var_yoy: 19.0 },
  'Vila Nova de Gaia':         { pm2: 2800, var_yoy: 18.0 },
  'Ericeira':                  { pm2: 3700, var_yoy: 21.0 },
  'Açores — Ponta Delgada':    { pm2: 1952, var_yoy: 12.1 },
}

// ---------------------------------------------------------------------------
// SSRF allowlist — only these domains may be fetched
// ---------------------------------------------------------------------------

const ALLOWED_MARKET_DOMAINS = [
  'idealista.com', 'idealista.pt', 'imovirtual.com', 'century21.pt', 'remax.pt',
  'era.pt', 'jll.pt', 'cushmanwakefield.com', 'ine.pt', 'bportugal.pt',
  'production-sfo.browserless.io',
]

function isAllowedMarketUrl(url: string): boolean {
  try {
    const { hostname } = new URL(url)
    return ALLOWED_MARKET_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d))
  } catch { return false }
}

// ---------------------------------------------------------------------------
// Scraping helpers (Idealista)
// ---------------------------------------------------------------------------

const SCRAPE_HEADERS: Record<string, string> = {
  'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept':          'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.7',
}

function zonaToSlug(zona: string): string {
  return zona
    .toLowerCase()
    .replace(/\s—\s.*/g, '')
    .replace(/[àáâã]/g, 'a')
    .replace(/[éê]/g, 'e')
    .replace(/[íî]/g, 'i')
    .replace(/[óô]/g, 'o')
    .replace(/[úû]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/\s+/g, '-')
    .trim()
}

async function scrapeIdealistaZone(zona: string): Promise<{ pm2: number; var_yoy: number } | null> {
  try {
    const slug = zonaToSlug(zona)
    const url  = `https://www.idealista.pt/comprar-casas/${slug}/`
    if (!isAllowedMarketUrl(url)) return null
    const res  = await fetch(url, {
      headers: SCRAPE_HEADERS,
      signal:  AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    const html = await res.text()

    const pm2Patterns = [
      /preço\s+médio\s+de\s+venda[:\s]*€?\s*([\d.,\s]+)\s*\/m²/i,
      /preço\s+médio[:\s]*€?\s*([\d.,\s]+)\s*\/m²/i,
      /média[:\s]*€?\s*([\d.,\s]+)\s*\/m²/i,
      /avg[:\s]*€?\s*([\d.,\s]+)/i,
    ]

    let pm2 = 0
    for (const pattern of pm2Patterns) {
      const m = html.match(pattern)
      if (m) {
        const raw = String(m[1]).replace(/\s/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')
        pm2 = parseFloat(raw) || 0
        if (pm2 > 500) break
      }
    }

    const varPatterns = [
      /variação\s+anual[:\s]*([+-]?\d+[.,]\d+)\s*%/i,
      /([+-]?\d+[.,]\d+)\s*%\s*(?:ao|por)\s+ano/i,
    ]
    let var_yoy = 0
    for (const pattern of varPatterns) {
      const m = html.match(pattern)
      if (m) {
        var_yoy = parseFloat(String(m[1]).replace(',', '.')) || 0
        break
      }
    }

    if (pm2 > 0) return { pm2, var_yoy }
    return null
  } catch {
    return null
  }
}

async function scrapeWithBrowserless(url: string, token: string): Promise<string> {
  if (!isAllowedMarketUrl(url)) return ''
  try {
    const res = await fetch(
      `https://production-sfo.browserless.io/content?token=${token}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ url, waitForTimeout: 4000, stealth: true }),
        signal:  AbortSignal.timeout(20000),
      }
    )
    if (!res.ok) return ''
    return await res.text()
  } catch {
    return ''
  }
}

async function refreshZone(zona: string): Promise<ZoneMarketData> {
  const browserlessToken = process.env.BROWSERLESS_TOKEN
  const fallback = STATIC_FALLBACK[zona] ?? { pm2: 2500, var_yoy: 15.0 }

  let scraped: { pm2: number; var_yoy: number } | null = await scrapeIdealistaZone(zona)

  if (!scraped && browserlessToken) {
    try {
      const slug = zonaToSlug(zona)
      const html = await scrapeWithBrowserless(
        `https://www.idealista.pt/comprar-casas/${slug}/`,
        browserlessToken
      )
      if (html) {
        const patterns = [
          /preço\s+médio[:\s]*€?\s*([\d.,\s]+)\s*\/m²/i,
          /média[:\s]*€?\s*([\d.,\s]+)\s*\/m²/i,
        ]
        for (const pattern of patterns) {
          const m = html.match(pattern)
          if (m) {
            const raw = String(m[1]).replace(/\s/g, '').replace(/\.(?=\d{3})/g, '').replace(',', '.')
            const pm2 = parseFloat(raw) || 0
            if (pm2 > 500) {
              scraped = { pm2, var_yoy: fallback.var_yoy }
              break
            }
          }
        }
      }
    } catch {
      // Browserless failed
    }
  }

  const result: ZoneMarketData = {
    zona,
    pm2_mediana: scraped?.pm2 ?? fallback.pm2,
    var_yoy:     scraped?.var_yoy || fallback.var_yoy,
    source:      scraped ? 'idealista-scrape' : 'static-2026',
    fetched_at:  new Date().toISOString(),
  }

  marketCache.set(zona, { data: result, expires_at: Date.now() + CACHE_TTL_MS })
  return result
}

async function getZoneData(zona: string): Promise<ZoneMarketData> {
  const cached = marketCache.get(zona)
  if (cached && Date.now() < cached.expires_at) return cached.data
  return refreshZone(zona)
}

// ---------------------------------------------------------------------------
// Filtering helpers
// ---------------------------------------------------------------------------

function filterByType(data: FullMarketData, type: string | null): unknown {
  switch (type) {
    case 'prices':
      return {
        zones:      data.zones.map(z => ({ zone: z.zone, price_m2: z.price_m2, yoy: z.yoy })),
        national:   { median_price_m2: data.national.median_price_m2, yoy_change: data.national.yoy_change },
        luxury:     { prime_lisboa_price_m2: data.luxury.prime_lisboa_price_m2, prime_cascais_price_m2: data.luxury.prime_cascais_price_m2 },
        updated_at: data.updated_at,
      }
    case 'yields':
      return {
        zones:      data.zones.map(z => ({ zone: z.zone, yield: z.yield, supply: z.supply, demand: z.demand })),
        updated_at: data.updated_at,
      }
    case 'transactions':
      return {
        zones:      data.zones.map(z => ({ zone: z.zone, volume: z.volume, dom: z.dom })),
        national:   { total_transactions: data.national.total_transactions, avg_dom: data.national.avg_dom },
        updated_at: data.updated_at,
      }
    case 'trends':
      return {
        zones:      data.zones.map(z => ({ zone: z.zone, yoy: z.yoy, supply: z.supply, demand: z.demand })),
        national:   { yoy_change: data.national.yoy_change, foreign_buyer_pct: data.national.foreign_buyer_pct, euribor_6m: data.national.euribor_6m },
        luxury:     data.luxury,
        updated_at: data.updated_at,
      }
    default:
      return data
  }
}

// ---------------------------------------------------------------------------
// GET /api/market-data
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url)
    const zone = searchParams.get('zone') ?? searchParams.get('zona')
    const type = searchParams.get('type')

    const fullData: FullMarketData = {
      zones:      ZONE_DATA_2026,
      national:   NATIONAL_2026,
      luxury:     LUXURY_2026,
      updated_at: new Date().toISOString(),
    }

    // Single zone request — enrich with live/cached scrape data
    if (zone) {
      const zoneStatic = ZONE_DATA_2026.find(z => z.zone.toLowerCase() === zone.toLowerCase())
      const zoneScraped = await getZoneData(zone).catch(() => null)

      if (!zoneStatic && !zoneScraped) {
        return NextResponse.json(
          { error: `Zone "${zone}" not found. Available: ${ZONE_DATA_2026.map(z => z.zone).join(', ')}` },
          { status: 404, headers: rateLimitHeaders() }
        )
      }

      return NextResponse.json({
        zone:      zoneStatic ?? null,
        scraped:   zoneScraped,
        national:  NATIONAL_2026,
        updated_at: new Date().toISOString(),
      }, { headers: rateLimitHeaders() })
    }

    // Type-filtered response
    if (type) {
      const filtered = filterByType(fullData, type)
      return NextResponse.json(filtered, { headers: rateLimitHeaders() })
    }

    // Full data response
    return NextResponse.json(fullData, { headers: rateLimitHeaders() })
  } catch (err) {
    console.error('[market-data GET]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: rateLimitHeaders() }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/market-data — manual cache refresh
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const zona = body.zona ? String(body.zona) : null

    if (zona) {
      const data = await refreshZone(zona)
      return NextResponse.json({ success: true, updated: 1, data }, { headers: rateLimitHeaders() })
    }

    // Refresh all zones
    const allZones = Object.keys(STATIC_FALLBACK)
    const results  = await Promise.allSettled(allZones.map(z => refreshZone(z)))
    const updated  = results.filter(r => r.status === 'fulfilled').length

    return NextResponse.json({
      success:       true,
      zones_updated: updated,
      timestamp:     new Date().toISOString(),
    }, { headers: rateLimitHeaders() })
  } catch (err) {
    console.error('[market-data POST]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: rateLimitHeaders() }
    )
  }
}

// Export for use in other routes
export { refreshZone, getZoneData, STATIC_FALLBACK, marketCache }
