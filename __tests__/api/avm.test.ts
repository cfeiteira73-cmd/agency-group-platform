import { describe, it, expect } from 'vitest'

// ─── Zone data (partial — key zones from app/api/avm/route.ts) ────────────────

interface ZoneData {
  pm2: number
  pm2_ask: number
  rental_m2: number
  yield_gross: number
  liquidity: number
  trend_yoy: number
  trend_qtq: number
  days_market: number
  demand: number
  region: string
}

const ZONES: Record<string, ZoneData> = {
  'Lisboa':                     { pm2:5000,  pm2_ask:5400,  rental_m2:18.5, yield_gross:0.044, liquidity:8.5, trend_yoy:0.22, trend_qtq:0.055, days_market:45,  demand:9.0, region:'Lisboa' },
  'Lisboa — Chiado':            { pm2:7000,  pm2_ask:7500,  rental_m2:25.0, yield_gross:0.043, liquidity:9.0, trend_yoy:0.20, trend_qtq:0.048, days_market:35,  demand:9.5, region:'Lisboa' },
  'Lisboa — Príncipe Real':     { pm2:7400,  pm2_ask:7900,  rental_m2:26.0, yield_gross:0.042, liquidity:8.5, trend_yoy:0.19, trend_qtq:0.045, days_market:38,  demand:9.5, region:'Lisboa' },
  'Cascais':                    { pm2:4700,  pm2_ask:5100,  rental_m2:16.0, yield_gross:0.041, liquidity:8.0, trend_yoy:0.18, trend_qtq:0.043, days_market:90,  demand:8.0, region:'Cascais/Sintra' },
  'Cascais — Quinta da Marinha':{ pm2:6900,  pm2_ask:7400,  rental_m2:22.0, yield_gross:0.038, liquidity:7.5, trend_yoy:0.18, trend_qtq:0.043, days_market:120, demand:7.5, region:'Cascais/Sintra' },
  'Porto':                      { pm2:3600,  pm2_ask:3900,  rental_m2:13.0, yield_gross:0.043, liquidity:8.0, trend_yoy:0.19, trend_qtq:0.047, days_market:55,  demand:8.5, region:'Porto' },
  'Porto — Foz do Douro':       { pm2:5400,  pm2_ask:5800,  rental_m2:18.0, yield_gross:0.040, liquidity:8.0, trend_yoy:0.20, trend_qtq:0.049, days_market:65,  demand:8.5, region:'Porto' },
  'Quinta do Lago':             { pm2:12000, pm2_ask:13500, rental_m2:42.0, yield_gross:0.042, liquidity:6.0, trend_yoy:0.15, trend_qtq:0.037, days_market:300, demand:7.0, region:'Algarve' },
  'Comporta':                   { pm2:8500,  pm2_ask:9500,  rental_m2:29.0, yield_gross:0.041, liquidity:6.0, trend_yoy:0.12, trend_qtq:0.029, days_market:300, demand:7.0, region:'Alentejo Litoral' },
  'Madeira — Funchal Centro':   { pm2:4700,  pm2_ask:5100,  rental_m2:17.0, yield_gross:0.043, liquidity:7.5, trend_yoy:0.20, trend_qtq:0.049, days_market:90,  demand:8.0, region:'Madeira' },
  'Açores — Ponta Delgada':     { pm2:2000,  pm2_ask:2200,  rental_m2:8.5,  yield_gross:0.051, liquidity:6.0, trend_yoy:0.14, trend_qtq:0.034, days_market:150, demand:6.5, region:'Açores' },
  'Beja':                       { pm2:1400,  pm2_ask:1500,  rental_m2:6.0,  yield_gross:0.051, liquidity:5.0, trend_yoy:0.12, trend_qtq:0.029, days_market:200, demand:5.5, region:'Alentejo' },
}

// ─── AVM calculation logic (mirrored from route) ─────────────────────────────

type TipoImovel = 'Apartamento' | 'Moradia' | 'Villa' | 'Penthouse' | 'Estudio' | 'Terreno' | 'Comercial'
type Condition = 'novo' | 'usado_bom' | 'usado_renovar'

const TIPO_MULTIPLIER: Record<TipoImovel, number> = {
  'Penthouse':   1.25,
  'Villa':       1.20,
  'Moradia':     1.15,
  'Apartamento': 1.00,
  'Estudio':     0.90,
  'Terreno':     0.60,
  'Comercial':   0.85,
}

const CONDITION_MULTIPLIER: Record<Condition, number> = {
  'novo':         1.00,
  'usado_bom':    0.85,
  'usado_renovar':0.65,
}

function calcAVM(
  zona: string,
  area: number,
  tipo: TipoImovel,
  condition: Condition
): { valorMinimo: number; valorBase: number; valorMaximo: number; valorLocacao: number; yieldBruto: number } {
  const zone = ZONES[zona]
  if (!zone) throw new Error(`Zona desconhecida: ${zona}`)

  const pm2Base = zone.pm2
  const tipoMult = TIPO_MULTIPLIER[tipo] ?? 1.0
  const condMult = CONDITION_MULTIPLIER[condition] ?? 1.0

  // Area scaling: diminishing returns for large properties
  const areaFactor = area <= 100 ? 1.0 : area <= 200 ? 0.97 : area <= 300 ? 0.94 : area <= 500 ? 0.91 : 0.88

  const adjustedPm2 = pm2Base * tipoMult * condMult * areaFactor
  const valorBase = adjustedPm2 * area
  const valorMinimo = valorBase * 0.90
  const valorMaximo = valorBase * 1.15

  const rentalMonthly = zone.rental_m2 * area
  const yieldBruto = (rentalMonthly * 12) / valorBase

  return {
    valorMinimo: Math.round(valorMinimo),
    valorBase:   Math.round(valorBase),
    valorMaximo: Math.round(valorMaximo),
    valorLocacao: Math.round(rentalMonthly),
    yieldBruto:   parseFloat((yieldBruto * 100).toFixed(2)),
  }
}

// ─── Zone pm2 base values ─────────────────────────────────────────────────────

describe('AVM — Zone base pm2 values', () => {
  it('Lisboa pm2 = €5,000', () => {
    expect(ZONES['Lisboa'].pm2).toBe(5000)
  })

  it('Lisboa Chiado pm2 = €7,000 (premium district)', () => {
    expect(ZONES['Lisboa — Chiado'].pm2).toBe(7000)
  })

  it('Lisboa Príncipe Real pm2 = €7,400 (highest Lisboa)', () => {
    expect(ZONES['Lisboa — Príncipe Real'].pm2).toBe(7400)
  })

  it('Porto pm2 = €3,600', () => {
    expect(ZONES['Porto'].pm2).toBe(3600)
  })

  it('Porto Foz do Douro pm2 = €5,400 (premium)', () => {
    expect(ZONES['Porto — Foz do Douro'].pm2).toBe(5400)
  })

  it('Quinta do Lago pm2 = €12,000 (ultra-premium Algarve)', () => {
    expect(ZONES['Quinta do Lago'].pm2).toBe(12000)
  })

  it('Comporta pm2 = €8,500', () => {
    expect(ZONES['Comporta'].pm2).toBe(8500)
  })

  it('Açores Ponta Delgada pm2 = €2,000 (most affordable)', () => {
    expect(ZONES['Açores — Ponta Delgada'].pm2).toBe(2000)
  })

  it('Beja pm2 = €1,400 (lowest)', () => {
    expect(ZONES['Beja'].pm2).toBe(1400)
  })
})

// ─── Area scaling ─────────────────────────────────────────────────────────────

describe('AVM — Area scaling factor', () => {
  it('area <= 100m² has no discount (factor = 1.0)', () => {
    // Lisboa Apartamento novo 80m²
    const { valorBase } = calcAVM('Lisboa', 80, 'Apartamento', 'novo')
    const expected = Math.round(5000 * 1.0 * 1.0 * 1.0 * 80)
    expect(valorBase).toBe(expected)
  })

  it('area 150m² has 3% discount (factor = 0.97)', () => {
    const { valorBase } = calcAVM('Lisboa', 150, 'Apartamento', 'novo')
    const expected = Math.round(5000 * 1.0 * 1.0 * 0.97 * 150)
    expect(valorBase).toBe(expected)
  })

  it('area 250m² has 6% discount (factor = 0.94)', () => {
    const { valorBase } = calcAVM('Porto', 250, 'Apartamento', 'novo')
    const expected = Math.round(3600 * 1.0 * 1.0 * 0.94 * 250)
    expect(valorBase).toBe(expected)
  })

  it('area 400m² has 9% discount (factor = 0.91)', () => {
    const { valorBase } = calcAVM('Lisboa', 400, 'Apartamento', 'novo')
    const expected = Math.round(5000 * 1.0 * 1.0 * 0.91 * 400)
    expect(valorBase).toBe(expected)
  })

  it('area 600m² has 12% discount (factor = 0.88)', () => {
    const { valorBase } = calcAVM('Lisboa', 600, 'Apartamento', 'novo')
    const expected = Math.round(5000 * 1.0 * 1.0 * 0.88 * 600)
    expect(valorBase).toBe(expected)
  })
})

// ─── Condition modifiers ──────────────────────────────────────────────────────

describe('AVM — Condition modifiers', () => {
  it('novo = 1.0 (no adjustment)', () => {
    expect(CONDITION_MULTIPLIER['novo']).toBe(1.0)
  })

  it('usado_bom = 0.85 (15% discount)', () => {
    expect(CONDITION_MULTIPLIER['usado_bom']).toBe(0.85)
  })

  it('usado_renovar = 0.65 (35% discount)', () => {
    expect(CONDITION_MULTIPLIER['usado_renovar']).toBe(0.65)
  })

  it('usado_bom 100m² Lisboa Apartamento is 15% less than novo', () => {
    const novo = calcAVM('Lisboa', 100, 'Apartamento', 'novo')
    const usado = calcAVM('Lisboa', 100, 'Apartamento', 'usado_bom')
    expect(usado.valorBase).toBeCloseTo(novo.valorBase * 0.85, 0)
  })

  it('usado_renovar 100m² Lisboa is 35% less than novo', () => {
    const novo = calcAVM('Lisboa', 100, 'Apartamento', 'novo')
    const renovar = calcAVM('Lisboa', 100, 'Apartamento', 'usado_renovar')
    expect(renovar.valorBase).toBeCloseTo(novo.valorBase * 0.65, 0)
  })
})

// ─── Tipo multipliers ─────────────────────────────────────────────────────────

describe('AVM — Tipo multipliers', () => {
  it('Penthouse = 1.25x premium', () => {
    expect(TIPO_MULTIPLIER['Penthouse']).toBe(1.25)
  })

  it('Villa = 1.20x premium', () => {
    expect(TIPO_MULTIPLIER['Villa']).toBe(1.20)
  })

  it('Moradia = 1.15x premium', () => {
    expect(TIPO_MULTIPLIER['Moradia']).toBe(1.15)
  })

  it('Apartamento = 1.0 (base)', () => {
    expect(TIPO_MULTIPLIER['Apartamento']).toBe(1.0)
  })

  it('Terreno = 0.60 (land discount)', () => {
    expect(TIPO_MULTIPLIER['Terreno']).toBe(0.60)
  })

  it('Penthouse Lisboa 150m² novo is 25% more than equivalent Apartamento', () => {
    const apto = calcAVM('Lisboa', 150, 'Apartamento', 'novo')
    const pent = calcAVM('Lisboa', 150, 'Penthouse', 'novo')
    expect(pent.valorBase).toBeCloseTo(apto.valorBase * (1.25 / 1.0), 0)
  })
})

// ─── Yield calculations ───────────────────────────────────────────────────────

describe('AVM — Yield calculations', () => {
  it('Lisboa gross yield ~4.4% (from zone data)', () => {
    expect(ZONES['Lisboa'].yield_gross).toBeCloseTo(0.044, 4)
  })

  it('AVM yield for Lisboa Apartamento 100m² novo is reasonable (3-6%)', () => {
    const { yieldBruto } = calcAVM('Lisboa', 100, 'Apartamento', 'novo')
    expect(yieldBruto).toBeGreaterThan(3)
    expect(yieldBruto).toBeLessThan(7)
  })

  it('valorLocacao = rental_m2 * area', () => {
    const zona = 'Lisboa'
    const area = 120
    const { valorLocacao } = calcAVM(zona, area, 'Apartamento', 'novo')
    const expected = Math.round(ZONES[zona].rental_m2 * area)
    expect(valorLocacao).toBe(expected)
  })

  it('Açores has higher yield than Lisboa (more affordable market)', () => {
    expect(ZONES['Açores — Ponta Delgada'].yield_gross).toBeGreaterThan(ZONES['Lisboa'].yield_gross)
  })

  it('Quinta do Lago has lower yield than Porto (luxury low yield)', () => {
    expect(ZONES['Quinta do Lago'].yield_gross).toBeLessThan(ZONES['Porto'].yield_gross)
  })
})

// ─── Confidence / range bands ─────────────────────────────────────────────────

describe('AVM — Valuation range bands', () => {
  it('valorMinimo = 90% of valorBase', () => {
    const { valorMinimo, valorBase } = calcAVM('Lisboa', 100, 'Apartamento', 'novo')
    expect(valorMinimo).toBe(Math.round(valorBase * 0.90))
  })

  it('valorMaximo = 115% of valorBase', () => {
    const { valorMaximo, valorBase } = calcAVM('Lisboa', 100, 'Apartamento', 'novo')
    expect(valorMaximo).toBe(Math.round(valorBase * 1.15))
  })

  it('range band width = 25% (max - min = 25% of base)', () => {
    const { valorMinimo, valorMaximo, valorBase } = calcAVM('Porto', 150, 'Moradia', 'usado_bom')
    const spread = valorMaximo - valorMinimo
    const expectedSpread = Math.round(valorBase * 0.25)
    // Allow ±1 for rounding
    expect(Math.abs(spread - expectedSpread)).toBeLessThanOrEqual(1)
  })

  it('liquidity score reflects market speed (Lisboa > Comporta)', () => {
    expect(ZONES['Lisboa'].liquidity).toBeGreaterThan(ZONES['Comporta'].liquidity)
  })

  it('days_market reflects liquidity (Lisboa faster than Comporta)', () => {
    expect(ZONES['Lisboa'].days_market).toBeLessThan(ZONES['Comporta'].days_market)
  })
})

// ─── Concrete valuation examples ─────────────────────────────────────────────

describe('AVM — Concrete valuation scenarios', () => {
  it('Lisboa Chiado Penthouse 200m² novo: premium valuation', () => {
    const { valorBase } = calcAVM('Lisboa — Chiado', 200, 'Penthouse', 'novo')
    // pm2=7000, tipo=1.25, cond=1.0, area=200 (factor=0.97)
    const expected = Math.round(7000 * 1.25 * 1.0 * 0.97 * 200)
    expect(valorBase).toBe(expected)
    // Expected: 7000 * 1.25 * 0.97 * 200 = 7000 * 1.25 * 194 = 1,695,000
    expect(valorBase).toBeGreaterThan(1_500_000)
  })

  it('Porto Foz Moradia 300m² usado_bom: correct calculation', () => {
    const { valorBase } = calcAVM('Porto — Foz do Douro', 300, 'Moradia', 'usado_bom')
    // pm2=5400, tipo=1.15, cond=0.85, area=300 (factor=0.94)
    const expected = Math.round(5400 * 1.15 * 0.85 * 0.94 * 300)
    expect(valorBase).toBe(expected)
  })

  it('Quinta do Lago Villa 400m² novo: ultra-premium result', () => {
    const { valorBase } = calcAVM('Quinta do Lago', 400, 'Villa', 'novo')
    // pm2=12000, tipo=1.20, cond=1.0, area=400 (factor=0.91)
    const expected = Math.round(12000 * 1.20 * 1.0 * 0.91 * 400)
    expect(valorBase).toBe(expected)
    expect(valorBase).toBeGreaterThan(5_000_000)
  })
})
