import { NextRequest, NextResponse } from 'next/server'

const DB_ID = process.env.NOTION_PROPERTIES_DB || '98d82b2008eb437d84e4fda1af0ddf08'
const TOKEN = process.env.NOTION_TOKEN

const headers = () => ({
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
  'Notion-Version': '2022-06-28',
})

// GET — list properties, optional ?zona= ?estado= filters
export async function GET(req: NextRequest) {
  if (!TOKEN) return NextResponse.json({ error: 'No Notion token' }, { status: 500 })
  try {
    const zona = req.nextUrl.searchParams.get('zona') || ''
    const estado = req.nextUrl.searchParams.get('estado') || ''

    const filters: unknown[] = []
    if (zona) filters.push({ property: 'Zona', select: { equals: zona } })
    if (estado) filters.push({ property: 'Estado', select: { equals: estado } })

    const body: Record<string, unknown> = {
      page_size: 100,
      sorts: [{ timestamp: 'created_time', direction: 'descending' }],
    }
    if (filters.length === 1) body.filter = filters[0]
    else if (filters.length > 1) body.filter = { and: filters }

    const res = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data }, { status: 500 })

    const properties = (data.results || []).map((page: Record<string, unknown>) => {
      const props = page.properties as Record<string, Record<string, unknown>>
      return {
        notionId: page.id,
        ref: (props['Referência']?.title as Array<{ plain_text: string }>)?.[0]?.plain_text || '',
        zona: (props['Zona']?.select as { name: string } | null)?.name || '',
        tipologia: (props['Tipologia']?.select as { name: string } | null)?.name || '',
        quartos: (props['Tipologia Quartos']?.select as { name: string } | null)?.name || '',
        preco: (props['Preço Pedido']?.number as number) || 0,
        area: (props['Área m²']?.number as number) || 0,
        estado: (props['Estado']?.select as { name: string } | null)?.name || '',
        piscina: (props['Piscina']?.select as { name: string } | null)?.name || 'Não',
        garagem: (props['Garagem']?.select as { name: string } | null)?.name || 'Não',
        jardim: (props['Jardim']?.select as { name: string } | null)?.name || 'Não',
        vistaMar: (props['Vista Mar']?.select as { name: string } | null)?.name || 'Não',
        energia: (props['Eficiência Energética']?.select as { name: string } | null)?.name || '',
        mandato: (props['Mandato']?.select as { name: string } | null)?.name || '',
        notas: (props['Notas']?.rich_text as Array<{ plain_text: string }>)?.[0]?.plain_text || '',
        tourUrl: (props['Vídeo Tour Virtual']?.url as string) || '',
        rendaMensal: (props['Renda Mensal Estimada']?.number as number) || 0,
        yieldPct: (props['Yield Arrendamento %']?.number as number) || 0,
        compradorIdeal: (props['Comprador Ideal']?.select as { name: string } | null)?.name || '',
        score: (props['Score Potencial']?.select as { name: string } | null)?.name || '',
        createdAt: page.created_time as string,
      }
    })

    return NextResponse.json({ properties })
  } catch (error) {
    console.error('[Notion API Error]:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { error: 'Serviço temporariamente indisponível. Tente novamente.' },
      { status: 503 }
    )
  }
}

// POST — create property
export async function POST(req: NextRequest) {
  if (!TOKEN) return NextResponse.json({ error: 'No Notion token' }, { status: 500 })
  try {
    const body = await req.json()

    const res = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        parent: { database_id: DB_ID },
        properties: buildProps(body),
      }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data }, { status: 500 })
    return NextResponse.json({ success: true, notionId: data.id })
  } catch (error) {
    console.error('[Notion API Error]:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { error: 'Serviço temporariamente indisponível. Tente novamente.' },
      { status: 503 }
    )
  }
}

// PATCH — update property
export async function PATCH(req: NextRequest) {
  if (!TOKEN) return NextResponse.json({ error: 'No Notion token' }, { status: 500 })
  try {
    const body = await req.json()
    const { notionId, ...prop } = body
    if (!notionId) return NextResponse.json({ error: 'notionId required' }, { status: 400 })

    const res = await fetch(`https://api.notion.com/v1/pages/${notionId}`, {
      method: 'PATCH',
      headers: headers(),
      body: JSON.stringify({ properties: buildProps(prop) }),
    })
    const data = await res.json()
    if (!res.ok) return NextResponse.json({ error: data }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Notion API Error]:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { error: 'Serviço temporariamente indisponível. Tente novamente.' },
      { status: 503 }
    )
  }
}

function buildProps(p: Record<string, unknown>) {
  const props: Record<string, unknown> = {}
  if (p.ref) props['Referência'] = { title: [{ text: { content: p.ref } }] }
  if (p.zona) props['Zona'] = { select: { name: p.zona } }
  if (p.tipologia) props['Tipologia'] = { select: { name: p.tipologia } }
  if (p.quartos) props['Tipologia Quartos'] = { select: { name: p.quartos } }
  if (p.preco !== undefined) props['Preço Pedido'] = { number: p.preco }
  if (p.area !== undefined) props['Área m²'] = { number: p.area }
  if (p.estado) props['Estado'] = { select: { name: p.estado } }
  if (p.piscina) props['Piscina'] = { select: { name: p.piscina } }
  if (p.garagem) props['Garagem'] = { select: { name: p.garagem } }
  if (p.jardim) props['Jardim'] = { select: { name: p.jardim } }
  if (p.vistaMar) props['Vista Mar'] = { select: { name: p.vistaMar } }
  if (p.energia) props['Eficiência Energética'] = { select: { name: p.energia } }
  if (p.mandato) props['Mandato'] = { select: { name: p.mandato } }
  if (p.notas !== undefined) props['Notas'] = { rich_text: [{ text: { content: String(p.notas || '') } }] }
  if (p.tourUrl) props['Vídeo Tour Virtual'] = { url: p.tourUrl }
  if (p.rendaMensal !== undefined) props['Renda Mensal Estimada'] = { number: p.rendaMensal }
  if (p.yieldPct !== undefined) props['Yield Arrendamento %'] = { number: p.yieldPct }
  if (p.compradorIdeal) props['Comprador Ideal'] = { select: { name: p.compradorIdeal } }
  if (p.score) props['Score Potencial'] = { select: { name: p.score } }
  return props
}
