import { NextRequest, NextResponse } from 'next/server'
import { PROPERTIES, Property } from '@/app/imoveis/data'

// ─── In-memory partner properties store ────────────────────────────────────────
// In production, replace with Supabase/DB query
const partnerProperties: PartnerProperty[] = []

export interface PartnerProperty extends Omit<Property, 'grad' | 'lat' | 'lng' | 'lifestyle' | 'videoUrl' | 'virtualTourEmbed'> {
  source: 'partner'
  agencyName: string
  agencyAMI: string
  agencyEmail: string
  agencyPhone: string
  commission: number // AG share %, typically 2.5
  submittedAt: string
  approved: boolean
  grad?: string
  lat?: number
  lng?: number
  lifestyle?: string[]
  videoUrl?: string | null
  virtualTourEmbed?: string | null
}

// ─── GET /api/properties — returns all active properties ─────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const zona = searchParams.get('zona')
  const tipo = searchParams.get('tipo')
  const precoMin = searchParams.get('precoMin') ? Number(searchParams.get('precoMin')) : null
  const precoMax = searchParams.get('precoMax') ? Number(searchParams.get('precoMax')) : null
  const quartos = searchParams.get('quartos') ? Number(searchParams.get('quartos')) : null
  const source = searchParams.get('source') // 'own' | 'partner' | 'all'
  const limit = searchParams.get('limit') ? Number(searchParams.get('limit')) : 100
  const forAI = searchParams.get('forAI') === 'true' // compact format for Sofia/HeyGen

  // Own properties (always included unless source=partner)
  let own: (Property & { source: 'own' })[] = PROPERTIES.map(p => ({ ...p, source: 'own' as const }))
  // Partner properties (approved only)
  let partners = partnerProperties.filter(p => p.approved)

  // Apply filters
  const filterZona = (z: string) => !zona || z.toLowerCase().includes(zona.toLowerCase())
  const filterTipo = (t: string) => !tipo || t.toLowerCase().includes(tipo.toLowerCase())
  const filterPreco = (p: number) => (!precoMin || p >= precoMin) && (!precoMax || p <= precoMax)
  const filterQuartos = (q: number) => !quartos || q >= quartos

  if (source !== 'partner') {
    own = own.filter(p => filterZona(p.zona) && filterTipo(p.tipo) && filterPreco(p.preco) && filterQuartos(p.quartos))
  } else {
    own = []
  }

  if (source !== 'own') {
    partners = partners.filter(p => filterZona(p.zona) && filterTipo(p.tipo) && filterPreco(p.preco) && filterQuartos(p.quartos))
  } else {
    partners = []
  }

  const all = [...own, ...partners].slice(0, limit)

  // Compact format for AI consumption (Sofia / HeyGen)
  if (forAI) {
    const compact = all.map(p => ({
      ref: p.ref,
      nome: p.nome,
      zona: p.zona,
      bairro: p.bairro,
      tipo: p.tipo,
      preco: `€${(p.preco / 1000000).toFixed(2).replace('.', '.')}M`,
      area: `${p.area}m²`,
      quartos: p.quartos,
      features: p.features?.slice(0, 3).join(', '),
      tour: p.tourUrl || null,
      badge: p.badge || null,
      source: (p as { source: string }).source,
      agency: (p as PartnerProperty).agencyName || 'Agency Group',
      commission: (p as PartnerProperty).commission ? `${(p as PartnerProperty).commission}% AG` : '5% AG',
    }))
    return NextResponse.json({ total: compact.length, properties: compact })
  }

  return NextResponse.json({
    total: all.length,
    own: own.length,
    partner: partners.length,
    properties: all,
  })
}

// ─── POST /api/properties — partner agency submits a new listing ─────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      // Agency info
      agencyName, agencyAMI, agencyEmail, agencyPhone,
      // Property info
      ref, nome, zona, bairro, tipo, preco, area, quartos, casasBanho,
      andar, energia, vista, piscina, garagem, jardim, terraco, condominio,
      badge, desc, features, tourUrl,
    } = body

    // Basic validation
    if (!agencyName || !agencyAMI || !agencyEmail || !nome || !zona || !preco || !area) {
      return NextResponse.json({ error: 'Campos obrigatórios em falta' }, { status: 400 })
    }

    // AMI format validation
    if (!/^\d{4,6}$/.test(agencyAMI)) {
      return NextResponse.json({ error: 'Número AMI inválido' }, { status: 400 })
    }

    const newProperty: PartnerProperty = {
      id: ref || `PART-${Date.now()}`,
      ref: ref || `PART-${Date.now()}`,
      nome, zona, bairro: bairro || zona,
      tipo: tipo || 'Apartamento',
      preco: Number(preco),
      area: Number(area),
      quartos: Number(quartos) || 2,
      casasBanho: Number(casasBanho) || 1,
      andar: andar || 'r/c',
      energia: energia || 'B',
      vista: vista || 'cidade',
      piscina: Boolean(piscina),
      garagem: Boolean(garagem),
      jardim: Boolean(jardim),
      terraco: Boolean(terraco),
      condominio: Boolean(condominio),
      badge: badge || null,
      status: 'Ativo',
      desc: desc || '',
      features: Array.isArray(features) ? features : [],
      tourUrl: tourUrl || null,
      source: 'partner',
      agencyName,
      agencyAMI,
      agencyEmail,
      agencyPhone: agencyPhone || '',
      commission: 2.5,
      submittedAt: new Date().toISOString(),
      approved: false, // Requires AG approval
    }

    partnerProperties.push(newProperty)

    // TODO: Send email notification to AG + agency confirmation
    // TODO: Save to Notion/Supabase for persistence

    return NextResponse.json({
      success: true,
      message: 'Imóvel submetido com sucesso. A Agency Group irá rever e confirmar em 24h.',
      ref: newProperty.ref,
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno. Tenta novamente.' }, { status: 500 })
  }
}
