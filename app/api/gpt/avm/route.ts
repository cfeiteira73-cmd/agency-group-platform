import { NextRequest, NextResponse } from 'next/server'

const ZONES: Record<string, { pm2: number; yield: number; dom: number; trend: number }> = {
  'Lisboa': { pm2: 5000, yield: 0.044, dom: 45, trend: 0.22 },
  'Chiado': { pm2: 7000, yield: 0.043, dom: 35, trend: 0.20 },
  'Príncipe Real': { pm2: 7400, yield: 0.042, dom: 38, trend: 0.19 },
  'Cascais': { pm2: 4713, yield: 0.042, dom: 55, trend: 0.19 },
  'Comporta': { pm2: 5200, yield: 0.038, dom: 90, trend: 0.25 },
  'Porto': { pm2: 3643, yield: 0.051, dom: 65, trend: 0.18 },
  'Algarve': { pm2: 3941, yield: 0.058, dom: 80, trend: 0.15 },
  'Madeira': { pm2: 3760, yield: 0.052, dom: 75, trend: 0.28 },
  'Sintra': { pm2: 3200, yield: 0.045, dom: 85, trend: 0.17 },
}

export async function POST(req: NextRequest) {
  try {
    const { zona = 'Lisboa', tipo = 'T2', area = 100, estado = 'Bom' } = await req.json()

    const zoneKey =
      Object.keys(ZONES).find(k => zona.toLowerCase().includes(k.toLowerCase())) || 'Lisboa'
    const z = ZONES[zoneKey]

    let mult = 1.0
    if (estado === 'Novo' || estado === 'New') mult = 1.12
    else if (estado === 'Remodelado' || estado === 'Renovated') mult = 1.08
    else if (estado === 'Para Remodelar' || estado === 'To Renovate') mult = 0.82

    const t = tipo.replace('T', '').trim()
    const nBeds = parseInt(t) || 2
    if (nBeds >= 4) mult *= 1.05
    if (nBeds === 0) mult *= 0.85

    const pm2 = z.pm2 * mult
    const estimated = Math.round(pm2 * area)
    const rangeMin = Math.round(estimated * 0.92)
    const rangeMax = Math.round(estimated * 1.08)
    const annualRent = pm2 * area * z.yield
    const confidence = Math.min(95, 75 + (area > 50 ? 10 : 0) + (zoneKey !== 'Lisboa' ? -5 : 5))

    return NextResponse.json(
      {
        zone: zoneKey,
        estimatedValue: estimated,
        rangeMin,
        rangeMax,
        pricePerSqm: Math.round(pm2),
        confidence: confidence / 100,
        rentalYield: z.yield,
        annualRentalIncome: Math.round(annualRent),
        daysToSell: z.dom,
        yoyAppreciation: z.trend,
        forecast6m: Math.round(estimated * (1 + z.trend / 2)),
        source: 'Agency Group AVM — INE + AT + Confidencial Imobiliário Q1 2026',
        agency: 'Agency Group · AMI 22506 · Free full valuation: www.agencygroup.pt',
      },
      {
        headers: { 'Access-Control-Allow-Origin': process.env.NEXT_PUBLIC_SITE_URL ?? 'https://agencygroup.pt' },
      }
    )
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
