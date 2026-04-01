import { NextRequest, NextResponse } from 'next/server'

const DB_ID = process.env.NOTION_PIPELINE_DB || '37682f4dd3bb488c9c969bcf140c1f94'
const TOKEN = process.env.NOTION_TOKEN

const headers = () => ({
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
  'Notion-Version': '2022-06-28',
})

// GET — list deals
export async function GET(req: NextRequest) {
  if (!TOKEN) return NextResponse.json({ error: 'No Notion token' }, { status: 500 })
  const zona = req.nextUrl.searchParams.get('zona') || ''

  const body: Record<string, unknown> = {
    page_size: 100,
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
  }
  if (zona) body.filter = { property: 'Zona', select: { equals: zona } }

  const res = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: data }, { status: 500 })

  const deals = (data.results || []).map((page: Record<string, unknown>) => {
    const props = page.properties as Record<string, Record<string, unknown>>
    return {
      notionId: page.id,
      name: (props['Nome do Negócio']?.title as Array<{ plain_text: string }>)?.[0]?.plain_text || '',
      status: (props['Status']?.select as { name: string } | null)?.name || '',
      zona: (props['Zona']?.select as { name: string } | null)?.name || '',
      perfilComprador: (props['Perfil Comprador']?.select as { name: string } | null)?.name || '',
      precoEstimado: (props['Preço Estimado']?.number as number) || 0,
      comissaoEstimada: (props['Comissão Estimada']?.number as number) || 0,
      probabilidade: (props['Probabilidade Fecho %']?.number as number) || 0,
      proximaAccao: (props['Próxima Acção']?.rich_text as Array<{ plain_text: string }>)?.[0]?.plain_text || '',
      notasClaude: (props['Notas Claude']?.rich_text as Array<{ plain_text: string }>)?.[0]?.plain_text || '',
      bloqueio: (props['Bloqueio']?.rich_text as Array<{ plain_text: string }>)?.[0]?.plain_text || '',
      dataPrevistaFecho: (props['Data Prevista Fecho']?.date as { start: string } | null)?.start || '',
      tipologia: (props['Tipologia']?.select as { name: string } | null)?.name || '',
      lingua: (props['Língua']?.select as { name: string } | null)?.name || '',
      emailComprador: (props['Email Comprador']?.email as string) || '',
      telefone: (props['Telefone']?.phone_number as string) || '',
      contexto: (props['Contexto']?.select as { name: string } | null)?.name || '',
      origemLead: (props['Origem Lead']?.select as { name: string } | null)?.name || '',
      createdAt: page.created_time as string,
    }
  })

  return NextResponse.json({ deals })
}

// POST — create deal
export async function POST(req: NextRequest) {
  if (!TOKEN) return NextResponse.json({ error: 'No Notion token' }, { status: 500 })
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
}

// PATCH — update deal
export async function PATCH(req: NextRequest) {
  if (!TOKEN) return NextResponse.json({ error: 'No Notion token' }, { status: 500 })
  const body = await req.json()
  const { notionId, ...deal } = body
  if (!notionId) return NextResponse.json({ error: 'notionId required' }, { status: 400 })

  const res = await fetch(`https://api.notion.com/v1/pages/${notionId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ properties: buildProps(deal) }),
  })
  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: data }, { status: 500 })
  return NextResponse.json({ success: true })
}

function buildProps(d: Record<string, unknown>) {
  const props: Record<string, unknown> = {}
  if (d.name) props['Nome do Negócio'] = { title: [{ text: { content: d.name } }] }
  if (d.status) props['Status'] = { select: { name: d.status } }
  if (d.zona) props['Zona'] = { select: { name: d.zona } }
  if (d.perfilComprador) props['Perfil Comprador'] = { select: { name: d.perfilComprador } }
  if (d.precoEstimado !== undefined) props['Preço Estimado'] = { number: d.precoEstimado }
  if (d.comissaoEstimada !== undefined) props['Comissão Estimada'] = { number: d.comissaoEstimada }
  if (d.probabilidade !== undefined) props['Probabilidade Fecho %'] = { number: d.probabilidade }
  if (d.proximaAccao !== undefined) props['Próxima Acção'] = { rich_text: [{ text: { content: String(d.proximaAccao || '') } }] }
  if (d.notasClaude !== undefined) props['Notas Claude'] = { rich_text: [{ text: { content: String(d.notasClaude || '') } }] }
  if (d.bloqueio !== undefined) props['Bloqueio'] = { rich_text: [{ text: { content: String(d.bloqueio || '') } }] }
  if (d.dataPrevistaFecho) props['Data Prevista Fecho'] = { date: { start: d.dataPrevistaFecho } }
  if (d.tipologia) props['Tipologia'] = { select: { name: d.tipologia } }
  if (d.lingua) props['Língua'] = { select: { name: d.lingua } }
  if (d.emailComprador) props['Email Comprador'] = { email: d.emailComprador }
  if (d.telefone) props['Telefone'] = { phone_number: d.telefone }
  if (d.contexto) props['Contexto'] = { select: { name: d.contexto } }
  if (d.origemLead) props['Origem Lead'] = { select: { name: d.origemLead } }
  return props
}
