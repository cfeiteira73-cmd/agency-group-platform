import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'

// Static pre-market properties (fallback when DB not available)
const PREMARKET_STATIC = [
  {
    id: 'pm-001',
    title: 'Penthouse Exclusivo — Av. Liberdade',
    zone: 'Lisboa',
    type: 'Apartamento',
    price_min: 3200000,
    price_max: 3800000,
    area: 280,
    bedrooms: 4,
    description: 'Penthouse duplex em construção na Avenida da Liberdade. Cobertura total com piscina privada e terraço 360°. Entrega Q4 2026. Acesso exclusivo a compradores registados.',
    features: ['piscina privada', 'terraço 360°', 'vista Castelo', 'elevador privativo', 'garagem dupla'],
    available_from: '2026-10-01',
    exclusive_until: '2026-06-30',
    access_level: 'registered',
    agent_name: 'Carlos Feiteira',
    agent_phone: '+351 919 948 986',
    is_active: true,
    alerts_count: 47,
  },
  {
    id: 'pm-002',
    title: 'Quinta Histórica — Sintra',
    zone: 'Sintra',
    type: 'Quinta',
    price_min: 5500000,
    price_max: 6500000,
    area: 850,
    bedrooms: 7,
    description: 'Quinta do século XIX totalmente restaurada em Sintra. 4 hectares de jardins, piscina coberta, casa de caseiro. UNESCO World Heritage zone. Off-market até Julho 2026.',
    features: ['4ha jardins', 'piscina coberta', 'adegas históricas', 'casa de caseiro', 'helipad'],
    available_from: '2026-07-01',
    exclusive_until: '2026-09-30',
    access_level: 'vip',
    agent_name: 'Carlos Feiteira',
    agent_phone: '+351 919 948 986',
    is_active: true,
    alerts_count: 23,
  },
  {
    id: 'pm-003',
    title: 'Villa Contemporânea — Comporta',
    zone: 'Comporta',
    type: 'Moradia',
    price_min: 4200000,
    price_max: 4800000,
    area: 420,
    bedrooms: 5,
    description: 'Villa de arquitectura contemporânea a 200m da praia de areia branca na Comporta. Materiais naturais, piscina com aquecimento solar, privacy total. Antes de ir a mercado.',
    features: ['200m praia', 'piscina solar', 'madeira natural', 'privacidade total', 'architects design'],
    available_from: '2026-05-15',
    exclusive_until: '2026-05-31',
    access_level: 'registered',
    agent_name: 'Carlos Feiteira',
    agent_phone: '+351 919 948 986',
    is_active: true,
    alerts_count: 89,
  },
  {
    id: 'pm-004',
    title: 'Palacete Renovado — Cascais',
    zone: 'Cascais',
    type: 'Moradia',
    price_min: 2800000,
    price_max: 3200000,
    area: 380,
    bedrooms: 5,
    description: 'Palacete dos anos 1920 totalmente renovado no centro de Cascais. Fachada classificada, interior minimalista de luxo, jardim privado de 400m², garagem 3 carros.',
    features: ['fachada classificada', 'jardim 400m²', 'garagem 3 carros', 'piscina', 'lareira'],
    available_from: '2026-06-01',
    exclusive_until: '2026-07-15',
    access_level: 'registered',
    agent_name: 'Carlos Feiteira',
    agent_phone: '+351 919 948 986',
    is_active: true,
    alerts_count: 62,
  },
]

export async function GET(req: NextRequest) {
  const session = await auth()
  const { searchParams } = new URL(req.url)
  const zone = searchParams.get('zone')

  let properties = PREMARKET_STATIC.filter(p => p.is_active)

  if (zone) {
    properties = properties.filter(p =>
      p.zone.toLowerCase().includes(zone.toLowerCase())
    )
  }

  // VIP properties only visible to authenticated users
  if (!session?.user) {
    properties = properties.filter(p => p.access_level !== 'vip')
  }

  return NextResponse.json({
    properties,
    total: properties.length,
    isAuthenticated: !!session?.user,
    message: !session?.user
      ? 'Registe-se para aceder a propriedades VIP exclusivas'
      : null,
  })
}

export async function POST(req: NextRequest) {
  // Register interest in a pre-market property
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const body = (await req.json()) as { propertyId?: string; message?: string }
  const { propertyId, message } = body
  if (!propertyId) {
    return NextResponse.json({ error: 'Property ID required' }, { status: 400 })
  }

  // In production, save to Supabase premarket_interest table
  // For now, return success
  void message // acknowledged, used in DB insert in production
  return NextResponse.json({
    success: true,
    message: 'Interesse registado. O nosso agente contactará em 24 horas.',
    propertyId,
    agentContact: '+351 919 948 986',
  })
}
