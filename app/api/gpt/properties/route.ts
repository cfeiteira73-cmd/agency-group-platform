import { NextRequest, NextResponse } from 'next/server'

const PROPERTIES = [
  { id: 'AG-2026-010', name: 'Penthouse Príncipe Real', zone: 'Lisboa', type: 'Penthouse', price: 2850000, area: 220, bedrooms: 3, features: ['Rooftop privativo', 'Vistas 360° cidade', 'Última Cave Penthouse'], badge: 'Exclusivo' },
  { id: 'AG-2026-011', name: 'Apartment Chiado', zone: 'Lisboa', type: 'Apartment', price: 1450000, area: 145, bedrooms: 2, features: ['Vista Rio Tejo', 'Historic building restored 2024'] },
  { id: 'AG-2026-012', name: 'Villa Belém', zone: 'Lisboa', type: 'Villa', price: 3200000, area: 380, bedrooms: 5, features: ['Private garden 800m²', 'Heated pool', 'Belém riverside'] },
  { id: 'AG-2026-013', name: 'T3 Campo de Ourique', zone: 'Lisboa', type: 'Apartment', price: 890000, area: 165, bedrooms: 3, features: ['Premium residential area', 'Renovated 2025'] },
  { id: 'AG-2026-020', name: 'Villa Quinta da Marinha', zone: 'Cascais', type: 'Villa', price: 3800000, area: 450, bedrooms: 5, features: ['Private condominium', 'Golf view', 'Near beach'], badge: 'Exclusivo' },
  { id: 'AG-2026-021', name: 'Seafront Villa Estoril', zone: 'Cascais', type: 'Villa', price: 2100000, area: 280, bedrooms: 4, features: ['50m from beach', 'Heated pool', 'Sea view'] },
  { id: 'AG-2026-030', name: 'Exclusive Estate Comporta', zone: 'Comporta', type: 'Estate', price: 6500000, area: 850, bedrooms: 6, features: ['5 hectares', 'Complete privacy', 'Untouched nature'], badge: 'Off-Market' },
  { id: 'AG-2026-031', name: 'Villa Carvalhal Comporta', zone: 'Comporta', type: 'Villa', price: 2800000, area: 320, bedrooms: 4, features: ['Rice paddy views', 'Contemporary design'] },
  { id: 'AG-2026-040', name: 'Foz do Douro Apartment', zone: 'Porto', type: 'Apartment', price: 980000, area: 180, bedrooms: 3, features: ['Douro river view', 'Porto premium zone'] },
  { id: 'AG-2026-050', name: 'Villa Vale do Lobo Golf', zone: 'Algarve', type: 'Villa', price: 4200000, area: 480, bedrooms: 5, features: ['Premium resort', 'Golf course', 'Heated pool'] },
  { id: 'AG-2026-060', name: 'Funchal Prime Apartment', zone: 'Madeira', type: 'Apartment', price: 980000, area: 165, bedrooms: 3, features: ['180° ocean view', 'IFICI eligible', 'Madeira prime'], badge: 'Featured' },
  { id: 'AG-2026-070', name: 'Historic Quinta Sintra', zone: 'Sintra', type: 'Quinta', price: 2800000, area: 650, bedrooms: 6, features: ['UNESCO zone', '19th century estate', 'Garden 2000m²'] },
]

const MARKET_NOTE: Record<string, string> = {
  'Lisboa': 'Lisbon prime zones: €5,000–7,400/m². +22% YoY. 35–55 days to sell.',
  'Cascais': 'Cascais: €4,713/m² median. Strong demand from international buyers.',
  'Comporta': "Comporta: Europe's most exclusive coastal destination. Limited supply.",
  'Porto': 'Porto: €3,643/m². Rising demand, best value luxury in Portugal.',
  'Algarve': 'Algarve: €3,941/m². Year-round demand, strong rental yields 5–6%.',
  'Madeira': 'Madeira: €3,760/m². IFICI eligible, growing international interest.',
  'default': 'Portugal: +17.6% YoY. 169,812 transactions in 2025. Top 5 luxury market globally.',
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const zona = searchParams.get('zona') || ''
    const tipo = searchParams.get('tipo') || ''
    const precoMin = parseInt(searchParams.get('precoMin') || '0')
    const precoMax = parseInt(searchParams.get('precoMax') || '99999999')
    const quartos = parseInt(searchParams.get('quartos') || '0')

    const filtered = PROPERTIES.filter(p => {
      if (zona && !p.zone.toLowerCase().includes(zona.toLowerCase())) return false
      if (tipo && !p.type.toLowerCase().includes(tipo.toLowerCase())) return false
      if (p.price < precoMin || p.price > precoMax) return false
      if (quartos && p.bedrooms < quartos) return false
      return true
    })

    const zoneKey = zona
      ? Object.keys(MARKET_NOTE).find(k => zona.toLowerCase().includes(k.toLowerCase())) || 'default'
      : 'default'

    return NextResponse.json(
      {
        properties: filtered.map(p => ({
          ...p,
          pricePerSqm: Math.round(p.price / p.area),
          url: `https://www.agencygroup.pt/imoveis/${p.id}`,
        })),
        total: filtered.length,
        marketNote: MARKET_NOTE[zoneKey],
        agency: 'Agency Group · AMI 22506 · www.agencygroup.pt',
      },
      {
        headers: { 'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_SITE_URL ?? 'https://agencygroup.pt' },
      }
    )
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
