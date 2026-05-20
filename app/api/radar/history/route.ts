import { NextRequest, NextResponse } from 'next/server'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

// ─── Types ────────────────────────────────────────────────────────────────────
interface PricePoint {
  preco: number
  data: string
  score: number
  zona?: string
  platform?: string
}

interface PriceHistory {
  url: string
  history: PricePoint[]
  trend: 'down' | 'stable' | 'up'
  delta_pct: number
}

// ─── Upstash Redis helpers ────────────────────────────────────────────────────
// Raw fetch to UPSTASH_REDIS_REST_URL — same pattern as lib/rateLimit.ts.
// Fail-open: if env vars are absent or the call throws, returns null so callers
// fall through to Notion or degrade gracefully.

const REDIS_KEY = (id: string) => `radar:history:${id}`
const REDIS_TTL = 604800 // 7 days

function upstashConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
}

async function redisGet(key: string): Promise<string | null> {
  try {
    const url   = process.env.UPSTASH_REDIS_REST_URL!
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!
    const res = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const json = await res.json() as { result: string | null }
    return json.result ?? null
  } catch {
    return null
  }
}

async function redisSet(key: string, value: string, exSeconds: number): Promise<void> {
  try {
    const url   = process.env.UPSTASH_REDIS_REST_URL!
    const token = process.env.UPSTASH_REDIS_REST_TOKEN!
    await fetch(`${url}/set/${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([value, 'EX', exSeconds]),
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    // fire-and-forget — failure is non-fatal
  }
}

// Read price-point array from Redis for a given URL.
async function getHistoryFromRedis(url: string): Promise<PricePoint[] | null> {
  if (!upstashConfigured()) return null
  const raw = await redisGet(REDIS_KEY(url))
  if (!raw) return null
  try {
    return JSON.parse(raw) as PricePoint[]
  } catch {
    return null
  }
}

// Persist price-point array to Redis (overwrites previous value, keeps 7-day TTL).
async function setHistoryInRedis(url: string, points: PricePoint[]): Promise<void> {
  if (!upstashConfigured()) return
  await redisSet(REDIS_KEY(url), JSON.stringify(points), REDIS_TTL)
}

// ─── Notion helpers ────────────────────────────────────────────────────────────
const NOTION_TOKEN = () => process.env.NOTION_TOKEN
const NOTION_DB = () => process.env.NOTION_PRICE_HISTORY_DB

async function notionRequest(path: string, method = 'GET', body?: Record<string, unknown>): Promise<Record<string, unknown>> {
  const token = NOTION_TOKEN()
  if (!token) throw new Error('NOTION_TOKEN not set')
  const res = await fetch(`https://api.notion.com/v1${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10000),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Notion ${method} ${path} → ${res.status}: ${text}`)
  }
  return (await res.json()) as Record<string, unknown>
}

// ─── Query Notion for price history by URL ────────────────────────────────────
async function getHistoryFromNotion(url: string): Promise<PricePoint[]> {
  const dbId = NOTION_DB()
  if (!dbId) throw new Error('NOTION_PRICE_HISTORY_DB not set')

  const result = await notionRequest(`/databases/${dbId}/query`, 'POST', {
    filter: {
      property: 'URL',
      title: { equals: url },
    },
    sorts: [{ property: 'Data', direction: 'ascending' }],
  })

  const results = Array.isArray(result.results) ? result.results : []
  return results.map((page: unknown) => {
    const p = page as Record<string, unknown>
    const props = (p.properties as Record<string, unknown>) ?? {}

    const precoProps = (props['Preço'] as Record<string, unknown>) ?? {}
    const dataProps = (props['Data'] as Record<string, unknown>) ?? {}
    const scoreProps = (props['Score'] as Record<string, unknown>) ?? {}
    const zonaProps = (props['Zona'] as Record<string, unknown>) ?? {}
    const platProps = (props['Plataforma'] as Record<string, unknown>) ?? {}

    const precoNum = (precoProps['number'] as number) ?? 0
    const dataStr = ((dataProps['date'] as Record<string, unknown>)?.['start'] as string) ?? new Date().toISOString()
    const scoreNum = (scoreProps['number'] as number) ?? 0
    const zonaSelect = ((zonaProps['select'] as Record<string, unknown>)?.['name'] as string) ?? ''
    const platSelect = ((platProps['select'] as Record<string, unknown>)?.['name'] as string) ?? ''

    return {
      preco: Number(precoNum),
      data: String(dataStr),
      score: Number(scoreNum),
      zona: String(zonaSelect),
      platform: String(platSelect),
    } satisfies PricePoint
  })
}

// ─── Add entry to Notion ──────────────────────────────────────────────────────
async function addToNotion(params: {
  url: string; preco: number; zona: string; platform: string; score: number
}): Promise<void> {
  const dbId = NOTION_DB()
  if (!dbId) throw new Error('NOTION_PRICE_HISTORY_DB not set')

  await notionRequest('/pages', 'POST', {
    parent: { database_id: dbId },
    properties: {
      URL: { title: [{ text: { content: params.url.substring(0, 2000) } }] },
      'Preço': { number: params.preco },
      Data: { date: { start: new Date().toISOString().split('T')[0] } },
      Zona: { select: { name: params.zona || 'Desconhecida' } },
      Plataforma: { select: { name: params.platform || 'Desconhecida' } },
      Score: { number: params.score },
    },
  })
}

// ─── Compute trend ────────────────────────────────────────────────────────────
function computeTrend(history: PricePoint[]): { trend: 'down' | 'stable' | 'up'; delta_pct: number } {
  if (history.length < 2) return { trend: 'stable', delta_pct: 0 }
  const first = history[0].preco
  const last = history[history.length - 1].preco
  if (first <= 0) return { trend: 'stable', delta_pct: 0 }
  const delta_pct = parseFloat(((last - first) / first * 100).toFixed(1))
  let trend: 'down' | 'stable' | 'up' = 'stable'
  if (delta_pct <= -3) trend = 'down'
  else if (delta_pct >= 3) trend = 'up'
  return { trend, delta_pct }
}

// ─── GET /api/radar/history?url=... ──────────────────────────────────────────
export async function GET(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)
  try {
    const { searchParams } = new URL(req.url)
    const url = searchParams.get('url')

    if (!url) {
      return NextResponse.json({ error: 'url parameter required' }, { status: 400 })
    }

    let history: PricePoint[] = []

    // Try Notion first
    const dbId = NOTION_DB()
    const token = NOTION_TOKEN()
    if (dbId && token) {
      try {
        history = await getHistoryFromNotion(url)
      } catch (notionErr) {
        console.error('Notion read failed, trying Redis fallback:', notionErr, { corrId })
        // Fall back to Redis
        history = (await getHistoryFromRedis(url)) ?? []
      }
    } else {
      // No Notion configured — use Redis as primary store
      history = (await getHistoryFromRedis(url)) ?? []
    }

    const { trend, delta_pct } = computeTrend(history)

    const response: PriceHistory = { url, history, trend, delta_pct }
    return NextResponse.json({ success: true, ...response })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}

// ─── POST /api/radar/history — Add price data point ──────────────────────────
export async function POST(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)
  try {
    const body = (await req.json()) as Record<string, unknown>
    const url = String(body.url ?? '')
    const preco = Number(body.preco ?? 0)
    const zona = String(body.zona ?? 'Desconhecida')
    const platform = String(body.platform ?? 'Desconhecida')
    const score = Number(body.score ?? 0)

    if (!url) {
      return NextResponse.json({ error: 'url required' }, { status: 400 })
    }

    const point: PricePoint = {
      preco,
      data: new Date().toISOString(),
      score,
      zona,
      platform,
    }

    // Try Notion
    const dbId = NOTION_DB()
    const token = NOTION_TOKEN()
    if (dbId && token) {
      try {
        await addToNotion({ url, preco, zona, platform, score })
      } catch (notionErr) {
        console.error('Notion write failed, storing in Redis:', notionErr, { corrId })
        // Fall back to Redis
        const existing = (await getHistoryFromRedis(url)) ?? []
        existing.push(point)
        await setHistoryInRedis(url, existing.slice(-50))
      }
    } else {
      // No Notion configured — use Redis as primary store
      const existing = (await getHistoryFromRedis(url)) ?? []
      // Avoid duplicate same-day entries
      const today = new Date().toISOString().split('T')[0]
      const filteredExisting = existing.filter(e => !e.data.startsWith(today))
      filteredExisting.push(point)
      await setHistoryInRedis(url, filteredExisting.slice(-50))
    }

    // Return current history
    let history: PricePoint[] = []
    if (dbId && token) {
      try {
        history = await getHistoryFromNotion(url)
      } catch {
        history = (await getHistoryFromRedis(url)) ?? [point]
      }
    } else {
      history = (await getHistoryFromRedis(url)) ?? [point]
    }

    const { trend, delta_pct } = computeTrend(history)

    return NextResponse.json({
      success: true,
      url,
      stored: 'notion',
      history_length: history.length,
      trend,
      delta_pct,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
