import { NextRequest, NextResponse } from 'next/server'

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

// ─── In-memory fallback store ─────────────────────────────────────────────────
const memoryStore = new Map<string, PricePoint[]>()

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
        console.error('Notion read failed, using memory store:', notionErr)
        history = memoryStore.get(url) ?? []
      }
    } else {
      history = memoryStore.get(url) ?? []
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
        console.error('Notion write failed, storing in memory:', notionErr)
        // Fall through to memory store
        const existing = memoryStore.get(url) ?? []
        existing.push(point)
        memoryStore.set(url, existing.slice(-50)) // keep last 50 entries
      }
    } else {
      // Use memory store
      const existing = memoryStore.get(url) ?? []
      // Avoid duplicate same-day entries
      const today = new Date().toISOString().split('T')[0]
      const filteredExisting = existing.filter(e => !e.data.startsWith(today))
      filteredExisting.push(point)
      memoryStore.set(url, filteredExisting.slice(-50))
    }

    // Return current history
    let history: PricePoint[] = []
    if (dbId && token) {
      try {
        history = await getHistoryFromNotion(url)
      } catch {
        history = memoryStore.get(url) ?? [point]
      }
    } else {
      history = memoryStore.get(url) ?? [point]
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
