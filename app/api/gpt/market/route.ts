import { NextRequest, NextResponse } from 'next/server'

const ZONES: Record<string, Record<string, unknown>> = {
  'Lisboa': {
    pricePerSqm: 5000,
    askingPricePerSqm: 5400,
    rentalYield: 4.4,
    daysOnMarket: 45,
    yoyChange: 22,
    topBuyers: ['American 16%', 'French 13%', 'British 9%', 'Chinese 8%', 'Brazilian 6%'],
    insight: 'Lisbon is in the top 5 global luxury markets. Prime zones (Chiado, Príncipe Real) reach €7,000–7,400/m². Demand far exceeds supply.',
  },
  'Cascais': {
    pricePerSqm: 4713,
    askingPricePerSqm: 5100,
    rentalYield: 4.2,
    daysOnMarket: 55,
    yoyChange: 19,
    topBuyers: ['British 22%', 'American 18%', 'French 15%'],
    insight: "Cascais is the Côte d'Azur of Portugal. Golf resorts, beaches, 20min from Lisbon. High demand from Northern European and American buyers.",
  },
  'Comporta': {
    pricePerSqm: 5200,
    askingPricePerSqm: 5800,
    rentalYield: 3.8,
    daysOnMarket: 90,
    yoyChange: 25,
    topBuyers: ['French 35%', 'British 20%', 'Portuguese 15%'],
    insight: "Comporta is Europe's most exclusive coastal hideaway. Limited inventory, ultra-high-net-worth buyers, near-zero new construction permits.",
  },
  'Porto': {
    pricePerSqm: 3643,
    askingPricePerSqm: 3900,
    rentalYield: 5.1,
    daysOnMarket: 65,
    yoyChange: 18,
    topBuyers: ['French 20%', 'Brazilian 15%', 'American 12%'],
    insight: 'Porto offers best value luxury in Portugal. Strong tech scene, growing international appeal. Foz do Douro = premium zone.',
  },
  'Algarve': {
    pricePerSqm: 3941,
    askingPricePerSqm: 4300,
    rentalYield: 5.8,
    daysOnMarket: 80,
    yoyChange: 15,
    topBuyers: ['British 35%', 'Irish 12%', 'German 10%'],
    insight: "Algarve has Europe's highest sunshine hours. Strong Aljezur/Vilamoura market. Rental yields 5–6% due to year-round tourism.",
  },
  'Madeira': {
    pricePerSqm: 3760,
    askingPricePerSqm: 4100,
    rentalYield: 5.2,
    daysOnMarket: 75,
    yoyChange: 28,
    topBuyers: ['German 25%', 'British 20%', 'French 15%'],
    insight: 'Madeira fastest-growing luxury market in Portugal 2026. IFICI eligible. Year-round mild climate. Funchal prime = €4,000–5,500/m².',
  },
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const zona = searchParams.get('zona') || 'Lisboa'

  const zoneKey =
    Object.keys(ZONES).find(k => zona.toLowerCase().includes(k.toLowerCase())) || 'Lisboa'
  const data = ZONES[zoneKey]

  return NextResponse.json(
    {
      zone: zoneKey,
      ...data,
      source: 'INE + AT + Confidencial Imobiliário Q1 2026',
      updatedAt: '2026-04-01',
      agency: 'Agency Group · AMI 22506 · www.agencygroup.pt · +351 919 948 986',
    },
    {
      headers: { 'Access-Control-Allow-Origin': '*' },
    }
  )
}
