import { NextRequest, NextResponse } from 'next/server'

const TOKEN = process.env.NOTION_TOKEN
const CRM_DB = process.env.NOTION_CRM_DB || '385a010f42244ef79b0a2ead4f258698'
const PROPS_DB = process.env.NOTION_PROPERTIES_DB || '98d82b2008eb437d84e4fda1af0ddf08'

const notionHeaders = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
  'Notion-Version': '2022-06-28',
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

// ─── Seed data ────────────────────────────────────────────────────────────────

const SEED_CONTACTS = [
  {
    name: 'James Mitchell',
    email: 'james.mitchell@email.com',
    phone: '+44 7911 123456',
    nationality: '🇬🇧 Britânico',
    status: 'vip',
    budgetMin: 1500000,
    budgetMax: 3000000,
    zonas: ['Cascais', 'Lisboa'],
    tipos: ['Villa', 'Moradia'],
    origin: 'Referência',
    notes: 'Procura villa com piscina e vista mar. Família com 2 filhos. Reforma prevista 2026.',
    lastContact: '2026-03-28',
    nextFollowUp: '2026-04-02',
    dealRef: 'AG-2026-020',
  },
  {
    name: 'Marie-Claire Dupont',
    email: 'marie.dupont@gmail.com',
    phone: '+33 6 12 34 56 78',
    nationality: '🇫🇷 Francês',
    status: 'prospect',
    budgetMin: 800000,
    budgetMax: 1500000,
    zonas: ['Lisboa', 'Cascais'],
    tipos: ['Apartamento'],
    origin: 'Instagram',
    notes: 'Interesse em NHR. Procura T2-T3 em zona histórica. Visita marcada Abril.',
    lastContact: '2026-03-25',
    nextFollowUp: '2026-04-05',
    dealRef: '',
  },
  {
    name: 'Carlos Ferreira',
    email: 'carlos.f@empresa.pt',
    phone: '+351 91 234 5678',
    nationality: '🇵🇹 Português',
    status: 'cliente',
    budgetMin: 500000,
    budgetMax: 900000,
    zonas: ['Lisboa', 'Sintra'],
    tipos: ['Moradia', 'Apartamento'],
    origin: 'Direto',
    notes: 'Cliente activo. CPCV assinado AG-2026-012. Escritura prevista Junho 2026.',
    lastContact: '2026-03-29',
    nextFollowUp: '2026-04-01',
    dealRef: 'AG-2026-012',
  },
  {
    name: 'Khalid Al-Mansouri',
    email: 'k.almansouri@familyoffice.ae',
    phone: '+971 50 123 4567',
    nationality: '🇸🇦 Médio Oriente',
    status: 'vip',
    budgetMin: 3000000,
    budgetMax: 10000000,
    zonas: ['Comporta', 'Lisboa'],
    tipos: ['Herdade', 'Villa'],
    origin: 'Referência',
    notes: 'Family office UAE. Budget até €10M. Interesse em Comporta exclusivo off-market. Decisão rápida.',
    lastContact: '2026-03-30',
    nextFollowUp: '2026-04-03',
    dealRef: '',
  },
  {
    name: 'Sophie Weber',
    email: 'sophie.weber@web.de',
    phone: '+49 170 123 4567',
    nationality: '🇩🇪 Alemão',
    status: 'lead',
    budgetMin: 600000,
    budgetMax: 1200000,
    zonas: ['Madeira', 'Algarve'],
    tipos: ['Apartamento', 'Moradia'],
    origin: 'Website',
    notes: 'Interesse em Madeira por IFICI. Quer perceber regime fiscal antes de avançar.',
    lastContact: '2026-03-20',
    nextFollowUp: '2026-04-10',
    dealRef: '',
  },
]

const SEED_PROPERTIES = [
  { ref: 'AG-2026-010', nome: 'Penthouse Príncipe Real', zona: 'Lisboa', bairro: 'Príncipe Real', tipo: 'Apartamento', preco: 2850000, area: 220, quartos: 3, badge: 'Destaque', status: 'Ativo', piscina: true, garagem: true, jardim: false, terraco: true },
  { ref: 'AG-2026-011', nome: 'Apartamento Chiado Premium', zona: 'Lisboa', bairro: 'Chiado', tipo: 'Apartamento', preco: 1450000, area: 145, quartos: 2, badge: 'Novo', status: 'Ativo', piscina: false, garagem: true, jardim: false, terraco: false },
  { ref: 'AG-2026-012', nome: 'Moradia Belém com Jardim', zona: 'Lisboa', bairro: 'Belém', tipo: 'Moradia', preco: 3200000, area: 380, quartos: 5, badge: 'Off-Market', status: 'Ativo', piscina: true, garagem: true, jardim: true, terraco: true },
  { ref: 'AG-2026-020', nome: 'Villa Quinta da Marinha', zona: 'Cascais', bairro: 'Quinta da Marinha', tipo: 'Moradia', preco: 3800000, area: 450, quartos: 5, badge: 'Exclusivo', status: 'Ativo', piscina: true, garagem: true, jardim: true, terraco: true },
  { ref: 'AG-2026-021', nome: 'Moradia Estoril Frente Mar', zona: 'Cascais', bairro: 'Estoril', tipo: 'Moradia', preco: 2100000, area: 280, quartos: 4, badge: 'Destaque', status: 'Ativo', piscina: true, garagem: true, jardim: true, terraco: true },
  { ref: 'AG-2026-030', nome: 'Herdade Comporta Exclusiva', zona: 'Comporta', bairro: 'Comporta', tipo: 'Herdade', preco: 6500000, area: 850, quartos: 6, badge: 'Off-Market', status: 'Ativo', piscina: true, garagem: true, jardim: true, terraco: true },
  { ref: 'AG-2026-040', nome: 'Apartamento Foz do Douro', zona: 'Porto', bairro: 'Foz do Douro', tipo: 'Apartamento', preco: 980000, area: 180, quartos: 3, badge: 'Destaque', status: 'Ativo', piscina: false, garagem: true, jardim: false, terraco: true },
  { ref: 'AG-2026-050', nome: 'Villa Vale do Lobo Golf', zona: 'Algarve', bairro: 'Vale do Lobo', tipo: 'Moradia', preco: 4200000, area: 480, quartos: 5, badge: 'Exclusivo', status: 'Ativo', piscina: true, garagem: true, jardim: true, terraco: true },
  { ref: 'AG-2026-060', nome: 'Apartamento Funchal Prime', zona: 'Madeira', bairro: 'Funchal', tipo: 'Apartamento', preco: 980000, area: 165, quartos: 3, badge: 'Destaque', status: 'Ativo', piscina: true, garagem: true, jardim: false, terraco: true },
  { ref: 'AG-2026-070', nome: 'Quinta Histórica Sintra', zona: 'Sintra', bairro: 'Sintra Vila', tipo: 'Quinta', preco: 2800000, area: 650, quartos: 6, badge: 'Off-Market', status: 'Ativo', piscina: true, garagem: true, jardim: true, terraco: true },
]

// ─── Property builder ─────────────────────────────────────────────────────────

type SeedProperty = {
  ref: string; nome: string; zona: string; bairro: string; tipo: string
  preco: number; area: number; quartos: number; badge: string; status: string
  piscina: boolean; garagem: boolean; jardim: boolean; terraco: boolean
}

function buildPropertyProps(p: SeedProperty) {
  const zonaMap: Record<string, string> = {
    'Lisboa': 'Lisboa — Prime', 'Cascais': 'Cascais', 'Porto': 'Porto — Foz',
    'Algarve': 'Algarve — Loulé', 'Comporta': 'Comporta/Melides',
    'Madeira': 'Madeira — Funchal', 'Sintra': 'Sintra/Estoril',
  }
  const tipoMap: Record<string, string> = {
    'Apartamento': 'Apartamento', 'Moradia': 'Moradia', 'Herdade': 'Herdade',
    'Quinta': 'Quinta', 'Terreno': 'Terreno', 'Hotel': 'Hotel',
  }
  const quartosMap: Record<number, string> = { 1:'T1', 2:'T2', 3:'T3', 4:'T4', 5:'T5+', 6:'T5+' }
  return {
    'Referência': { title: [{ text: { content: p.ref } }] },
    'Zona': { select: { name: zonaMap[p.zona] || 'Outro' } },
    'Tipologia': { select: { name: tipoMap[p.tipo] || 'Apartamento' } },
    'Tipologia Quartos': { select: { name: quartosMap[p.quartos] || 'T3' } },
    'Preço Pedido': { number: p.preco },
    'Área m²': { number: p.area },
    'Estado': { select: { name: '🟢 Disponível' } },
    'Piscina': { select: { name: p.piscina ? 'Sim' : 'Não' } },
    'Garagem': { select: { name: p.garagem ? 'Sim' : 'Não' } },
    'Jardim': { select: { name: p.jardim ? 'Sim' : (p.terraco ? 'Terraço' : 'Não') } },
    'Mandato': { select: { name: p.badge === 'Exclusivo' || p.badge === 'Off-Market' ? 'Exclusivo' : 'Partilhado' } },
    'Notas': { rich_text: [{ text: { content: `${p.nome} — ${p.bairro}` } }] },
  }
}

// ─── Contact builder ──────────────────────────────────────────────────────────

type SeedContact = {
  name: string; email: string; phone: string; nationality: string; status: string
  budgetMin: number; budgetMax: number; zonas: string[]; tipos: string[]
  origin: string; notes: string; lastContact: string; nextFollowUp: string; dealRef: string
}

function buildContactProps(c: SeedContact) {
  const statusMap: Record<string, string> = {
    vip: '⭐ VIP',
    cliente: '✅ Cliente',
    prospect: '🔥 Quente',
    lead: '🟡 Morno',
  }
  const budgetRange = (min: number): string => {
    if (min >= 3000000) return '€3M–€10M'
    if (min >= 1000000) return '€1M–€3M'
    if (min >= 500000) return '€500K–€1M'
    if (min >= 300000) return '€300K–€500K'
    return '€100K–€300K'
  }
  const natMap: Record<string, string> = {
    '🇺🇸 Norte-americano': 'Norte-americano', '🇫🇷 Francês': 'Francês',
    '🇧🇷 Brasileiro': 'Brasileiro', '🇸🇦 Médio Oriente': 'Médio Oriente',
    '🇩🇪 Alemão': 'Alemão',
  }
  return {
    'Nome': { title: [{ text: { content: c.name } }] },
    'Email': { email: c.email },
    'Telefone': { phone_number: c.phone },
    'Nacionalidade': { select: { name: natMap[c.nationality] || c.nationality } },
    'Status': { select: { name: statusMap[c.status] || '🟡 Morno' } },
    'Faixa Orçamento': { select: { name: budgetRange(c.budgetMin) } },
    'Zona Interesse': { select: { name: c.zonas[0] || 'Lisboa' } },
    'Tipo': { select: { name: c.tipos[0] === 'Herdade' || c.tipos[0] === 'Villa' ? 'Investidor' : 'Comprador' } },
    'Origem': { select: { name: c.origin === 'Website' ? 'Site' : c.origin === 'Referência' ? 'Referral' : 'Outro' } },
    'Notas': { rich_text: [{ text: { content: c.notes } }] },
    'Último Contacto': { date: { start: c.lastContact } },
    'Próximo Follow-up': { date: { start: c.nextFollowUp } },
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(_req: NextRequest) {
  if (!TOKEN) return NextResponse.json({ error: 'No Notion token' }, { status: 500 })
  try {

  const results = { seeded: true, contacts: 0, properties: 0, errors: [] as string[] }

  // Seed contacts
  for (const contact of SEED_CONTACTS) {
    try {
      const res = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify({
          parent: { database_id: CRM_DB },
          properties: buildContactProps(contact),
        }),
      })
      if (res.ok) {
        results.contacts++
      } else {
        const err = await res.json()
        results.errors.push(`Contact "${contact.name}": ${JSON.stringify(err.message || err)}`)
      }
    } catch (e) {
      results.errors.push(`Contact "${contact.name}": ${e instanceof Error ? e.message : String(e)}`)
    }
    await delay(100) // Rate limit: 100ms between calls
  }

  // Seed properties
  for (const property of SEED_PROPERTIES) {
    try {
      const res = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify({
          parent: { database_id: PROPS_DB },
          properties: buildPropertyProps(property),
        }),
      })
      if (res.ok) {
        results.properties++
      } else {
        const err = await res.json()
        results.errors.push(`Property "${property.ref}": ${JSON.stringify(err.message || err)}`)
      }
    } catch (e) {
      results.errors.push(`Property "${property.ref}": ${e instanceof Error ? e.message : String(e)}`)
    }
    await delay(100) // Rate limit: 100ms between calls
  }

  return NextResponse.json(results)
  } catch (error) {
    console.error('[Notion API Error]:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json(
      { error: 'Serviço temporariamente indisponível. Tente novamente.' },
      { status: 503 }
    )
  }
}
