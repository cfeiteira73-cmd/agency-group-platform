import { NextRequest, NextResponse } from 'next/server'

const DB_ID = process.env.NOTION_CRM_DB || '385a010f42244ef79b0a2ead4f258698'
const TOKEN = process.env.NOTION_TOKEN

const headers = () => ({
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
  'Notion-Version': '2022-06-28',
})

// GET — list contacts, optional ?agent= filter (not supported in this DB, returns all)
export async function GET(req: NextRequest) {
  if (!TOKEN) return NextResponse.json({ error: 'No Notion token' }, { status: 500 })
  const zona = req.nextUrl.searchParams.get('zona') || ''

  const body: Record<string, unknown> = {
    page_size: 100,
    sorts: [{ timestamp: 'created_time', direction: 'descending' }],
  }
  if (zona) {
    body.filter = { property: 'Zona Interesse', select: { equals: zona } }
  }

  const res = await fetch(`https://api.notion.com/v1/databases/${DB_ID}/query`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: data }, { status: 500 })

  const contacts = (data.results || []).map((page: Record<string, unknown>) => {
    const props = page.properties as Record<string, Record<string, unknown>>
    return {
      notionId: page.id,
      id: page.id,
      name: (props['Nome']?.title as Array<{ plain_text: string }>)?.[0]?.plain_text || '',
      email: (props['Email']?.email as string) || '',
      phone: (props['Telefone']?.phone_number as string) || '',
      nationality: (props['Nacionalidade']?.select as { name: string } | null)?.name || '',
      status: mapStatus((props['Status']?.select as { name: string } | null)?.name || ''),
      zona: (props['Zona Interesse']?.select as { name: string } | null)?.name || '',
      budget: (props['Faixa Orçamento']?.select as { name: string } | null)?.name || '',
      tipo: (props['Tipo']?.select as { name: string } | null)?.name || '',
      origin: (props['Origem']?.select as { name: string } | null)?.name || '',
      notes: (props['Notas']?.rich_text as Array<{ plain_text: string }>)?.[0]?.plain_text || '',
      lastContact: (props['Último Contacto']?.date as { start: string } | null)?.start || '',
      nextFollowUp: (props['Próximo Follow-up']?.date as { start: string } | null)?.start || '',
      leadScore: (props['Lead Score']?.select as { name: string } | null)?.name || '',
      lingua: (props['Língua']?.select as { name: string } | null)?.name || '',
      createdAt: page.created_time as string,
    }
  })

  return NextResponse.json({ contacts })
}

// POST — create contact
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

// PATCH — update contact by notionId
export async function PATCH(req: NextRequest) {
  if (!TOKEN) return NextResponse.json({ error: 'No Notion token' }, { status: 500 })
  const body = await req.json()
  const { notionId, ...contact } = body
  if (!notionId) return NextResponse.json({ error: 'notionId required' }, { status: 400 })

  const res = await fetch(`https://api.notion.com/v1/pages/${notionId}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ properties: buildProps(contact) }),
  })
  const data = await res.json()
  if (!res.ok) return NextResponse.json({ error: data }, { status: 500 })
  return NextResponse.json({ success: true })
}

function mapStatus(s: string): string {
  if (s.includes('VIP') || s.includes('⭐')) return 'vip'
  if (s.includes('Cliente') || s.includes('✅')) return 'cliente'
  if (s.includes('Quente') || s.includes('🔥') || s.includes('Prospect')) return 'prospect'
  if (s.includes('Morno') || s.includes('🟡')) return 'lead'
  if (s.includes('Frio') || s.includes('❄') || s.includes('Inactivo') || s.includes('😴')) return 'lead'
  return 'lead'
}

function toNotionStatus(s: string): string {
  const map: Record<string, string> = {
    vip: '⭐ VIP',
    cliente: '✅ Cliente',
    quente: '🔥 Quente',
    morno: '🟡 Morno',
    frio: '❄️ Frio',
    inactivo: '😴 Inactivo',
    lead: '🟡 Morno',
    prospect: '🟡 Morno',
  }
  return map[s] || s || '🟡 Morno'
}

function buildProps(c: Record<string, unknown>) {
  const props: Record<string, unknown> = {}
  if (c.name) props['Nome'] = { title: [{ text: { content: c.name } }] }
  if (c.email) props['Email'] = { email: c.email }
  if (c.phone) props['Telefone'] = { phone_number: c.phone }
  if (c.nationality) props['Nacionalidade'] = { select: { name: c.nationality } }
  if (c.status) props['Status'] = { select: { name: toNotionStatus(c.status as string) } }
  if (c.zona) props['Zona Interesse'] = { select: { name: c.zona } }
  if (c.budget) props['Faixa Orçamento'] = { select: { name: c.budget } }
  if (c.tipo) props['Tipo'] = { select: { name: c.tipo } }
  if (c.origin) props['Origem'] = { select: { name: c.origin } }
  if (c.notes !== undefined) props['Notas'] = { rich_text: [{ text: { content: String(c.notes || '') } }] }
  if (c.lastContact) props['Último Contacto'] = { date: { start: c.lastContact } }
  if (c.nextFollowUp) props['Próximo Follow-up'] = { date: { start: c.nextFollowUp } }
  if (c.lingua) props['Língua'] = { select: { name: c.lingua } }
  return props
}
