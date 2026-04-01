import { NextRequest, NextResponse } from 'next/server'

const NOTION_TOKEN   = process.env.NOTION_TOKEN ?? ''
const NOTION_DEALS   = process.env.NOTION_DEALS_DB ?? 'b5693a14ca8c43fa8645606363594662'

async function findDealPage(propertyId: string): Promise<string | null> {
  if (!NOTION_TOKEN) return null
  try {
    const res = await fetch(`https://api.notion.com/v1/databases/${NOTION_DEALS}/query`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      body: JSON.stringify({
        filter: {
          property: 'ID',
          rich_text: { equals: propertyId },
        },
        page_size: 1,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const json = await res.json()
    const results = Array.isArray(json.results) ? json.results : []
    return results[0]?.id ?? null
  } catch {
    return null
  }
}

async function incrementViews(pageId: string): Promise<void> {
  if (!NOTION_TOKEN) return
  // First read current views
  const res = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Notion-Version': '2022-06-28',
    },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return
  const page = await res.json()
  const currentViews = (page?.properties?.['Visualizações']?.number ?? 0) as number

  await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${NOTION_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': '2022-06-28',
    },
    body: JSON.stringify({
      properties: {
        'Visualizações': { number: currentViews + 1 },
        'Última Visualização': { date: { start: new Date().toISOString() } },
      },
    }),
    signal: AbortSignal.timeout(8000),
  })
}

export async function POST(req: NextRequest) {
  try {
    const { property_id } = await req.json()
    if (!property_id) return NextResponse.json({ ok: false }, { status: 400 })

    // Fire-and-forget: don't block the response
    const pageId = await findDealPage(String(property_id))
    if (pageId) {
      incrementViews(pageId).catch(() => {})
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
