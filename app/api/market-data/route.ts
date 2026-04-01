import { NextRequest, NextResponse } from 'next/server'

// ─── Types ────────────────────────────────────────────────────────────────────
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

// ─── In-memory cache (7 days TTL) ────────────────────────────────────────────
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
const marketCache = new Map<string, CacheEntry>()

// ─── Static fallback data (Q1 2026) ──────────────────────────────────────────
const STATIC_FALLBACK: Record<string, { pm2: number; var_yoy: number }> = {
  'Lisboa':             { pm2: 5000, var_yoy: 22.0 },
  'Porto':              { pm2: 3600, var_yoy: 19.0 },
  'Cascais':            { pm2: 4700, var_yoy: 18.0 },
  'Algarve':            { pm2: 3900, var_yoy: 19.0 },
  'Madeira — Funchal':  { pm2: 4200, var_yoy: 19.0 },
  'Sintra':             { pm2: 3400, var_yoy: 15.0 },
  'Oeiras':             { pm2: 4000, var_yoy: 20.0 },
  'Braga':              { pm2: 2700, var_yoy: 20.0 },
  'Coimbra':            { pm2: 2300, var_yoy: 17.0 },
  'Aveiro':             { pm2: 2500, var_yoy: 18.0 },
  'Vilamoura':          { pm2: 5000, var_yoy: 18.0 },
  'Lagos':              { pm2: 4400, var_yoy: 19.0 },
  'Albufeira':          { pm2: 3700, var_yoy: 19.0 },
  'Comporta':           { pm2: 8500, var_yoy: 12.0 },
  'Quinta do Lago':     { pm2: 12000, var_yoy: 15.0 },
  'Matosinhos':         { pm2: 3100, var_yoy: 19.0 },
  'Vila Nova de Gaia':  { pm2: 2800, var_yoy: 18.0 },
  'Ericeira':           { pm2: 3700, var_yoy: 21.0 },
  'Açores — Ponta Delgada': { pm2: 2000, var_yoy: 14.0 },
}

// ─── HTML fetch headers ────────────────────────────────────────────────────────
const HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
  'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.7',
}

// ─── Zone slug for Idealista URL ──────────────────────────────────────────────
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

// ─── Scrape Idealista zone page for median price ──────────────────────────────
async function scrapeIdealistaZone(zona: string): Promise<{ pm2: number; var_yoy: number } | null> {
  try {
    const slug = zonaToSlug(zona)
    const url = `https://www.idealista.pt/comprar-casas/${slug}/`
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return null
    const html = await res.text()

    // Idealista shows "Preço médio de venda: €X.XXX/m²" in summary sections
    const pm2Patterns = [
      /preço\s+médio\s+de\s+venda[:\s]*€?\s*([\d.,\s]+)\s*\/m²/i,
      /preço\s+médio[:\s]*€?\s*([\d.,\s]+)\s*\/m²/i,
      /média[:\s]*€?\s*([\d.,\s]+)\s*\/m²/i,
      /avg[:\s]*€?\s*([\d.,\s]+)/i,
      /data-stats[^>]*pm2[^>]*>\s*€?\s*([\d.,\s]+)/i,
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

    // Try to find YoY variation
    const varPatterns = [
      /variação\s+anual[:\s]*([+-]?\d+[.,]\d+)\s*%/i,
      /([+-]?\d+[.,]\d+)\s*%\s*(?:ao|por)\s+ano/i,
      /yoy[:\s]*([+-]?\d+[.,]\d+)/i,
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

// ─── Scrape Browserless rendered page ────────────────────────────────────────
async function scrapeWithBrowserless(url: string, token: string): Promise<string> {
  try {
    const res = await fetch(
      `https://production-sfo.browserless.io/content?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          waitForTimeout: 4000,
          stealth: true,
        }),
        signal: AbortSignal.timeout(20000),
      }
    )
    if (!res.ok) return ''
    return await res.text()
  } catch {
    return ''
  }
}

// ─── Refresh a single zone ────────────────────────────────────────────────────
async function refreshZone(zona: string): Promise<ZoneMarketData> {
  const browserlessToken = process.env.BROWSERLESS_TOKEN
  const fallback = STATIC_FALLBACK[zona] ?? { pm2: 2500, var_yoy: 15.0 }

  // Try scraping Idealista HTML
  let scraped: { pm2: number; var_yoy: number } | null = null
  scraped = await scrapeIdealistaZone(zona)

  // If Idealista HTML scrape fails and Browserless is available, try rendered version
  if (!scraped && browserlessToken) {
    try {
      const slug = zonaToSlug(zona)
      const html = await scrapeWithBrowserless(
        `https://www.idealista.pt/comprar-casas/${slug}/`,
        browserlessToken
      )
      if (html) {
        const pm2Patterns = [
          /preço\s+médio[:\s]*€?\s*([\d.,\s]+)\s*\/m²/i,
          /média[:\s]*€?\s*([\d.,\s]+)\s*\/m²/i,
        ]
        for (const pattern of pm2Patterns) {
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
      // Browserless failed, use fallback
    }
  }

  const result: ZoneMarketData = {
    zona,
    pm2_mediana: scraped?.pm2 ?? fallback.pm2,
    var_yoy: scraped?.var_yoy || fallback.var_yoy,
    source: scraped ? 'idealista-scrape' : 'static-fallback-q1-2026',
    fetched_at: new Date().toISOString(),
  }

  // Store in cache
  marketCache.set(zona, {
    data: result,
    expires_at: Date.now() + CACHE_TTL_MS,
  })

  return result
}

// ─── Get cached or fresh zone data ───────────────────────────────────────────
async function getZoneData(zona: string): Promise<ZoneMarketData> {
  const cached = marketCache.get(zona)
  if (cached && Date.now() < cached.expires_at) {
    return cached.data
  }
  return refreshZone(zona)
}

// ─── GET /api/market-data?zona=Lisboa ────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const zona = searchParams.get('zona')

    // If no zona, return all cached data + available zones
    if (!zona) {
      const allZones = Object.keys(STATIC_FALLBACK)
      const cachedData = allZones
        .map(z => marketCache.get(z))
        .filter((e): e is CacheEntry => e !== undefined && Date.now() < e.expires_at)
        .map(e => e.data)

      return NextResponse.json({
        success: true,
        available_zones: allZones,
        cached_zones: cachedData.length,
        data: cachedData,
        note: 'Use ?zona=Lisboa for specific zone data',
      })
    }

    const data = await getZoneData(zona)
    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

// ─── POST /api/market-data — Manual trigger ───────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const zona = body.zona ? String(body.zona) : null

    if (zona) {
      const data = await refreshZone(zona)
      return NextResponse.json({ success: true, updated: 1, data })
    }

    // Refresh all zones
    const allZones = Object.keys(STATIC_FALLBACK)
    const results = await Promise.allSettled(allZones.map(z => refreshZone(z)))
    const updated = results.filter(r => r.status === 'fulfilled').length

    return NextResponse.json({
      success: true,
      zones_updated: updated,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

// Export for use in refresh route
export { refreshZone, getZoneData, STATIC_FALLBACK, marketCache }
