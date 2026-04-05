import { describe, it, expect } from 'vitest'

// ─── Pure functions mirrored from app/api/deal/commission-pl/route.ts ────────

const STAGE_PCT: Record<string, number> = {
  'Angariação': 10,
  'Proposta Enviada': 20,
  'Proposta Aceite': 35,
  'Due Diligence': 50,
  'CPCV Assinado': 70,
  'Financiamento': 80,
  'Escritura Marcada': 90,
  'Escritura Concluída': 100,
}

const COMMISSION_RATE = 0.05
const IRS_WITHHOLDING = 0.25

function parseValor(valor: string): number {
  if (!valor) return 0
  const cleaned = valor.replace(/[€\s.]/g, '').replace(',', '.')
  return parseFloat(cleaned) || 0
}

interface Deal {
  valor: string
  fase: string
  imovel?: string
  comprador?: string
}

function calcPipeline(deals: Deal[]) {
  let realized = 0
  let pipeline = 0

  for (const deal of deals) {
    const valor = parseValor(deal.valor)
    const fase = deal.fase || 'Angariação'
    const probability = (STAGE_PCT[fase] ?? 10) / 100
    const grossCommission = valor * COMMISSION_RATE
    const weightedCommission = grossCommission * probability

    if (fase === 'Escritura Concluída') {
      realized += grossCommission
    } else {
      pipeline += weightedCommission
    }
  }

  const expectedGross = realized + pipeline
  const irsWithholding = expectedGross * IRS_WITHHOLDING
  const expectedNet = expectedGross * (1 - IRS_WITHHOLDING)

  return { realized, pipeline, expectedGross, irsWithholding, expectedNet }
}

// ─── parseValor ───────────────────────────────────────────────────────────────

describe('parseValor — various formats', () => {
  it('parses plain integer string', () => {
    expect(parseValor('750000')).toBe(750000)
  })

  it('parses PT format with dots as thousand separators and € sign', () => {
    // "€ 3.800.000" → removes €, spaces, dots → "3800000" → 3800000
    expect(parseValor('€ 3.800.000')).toBe(3800000)
  })

  it('parses "€ 1.450.000"', () => {
    expect(parseValor('€ 1.450.000')).toBe(1450000)
  })

  it('parses "500000" (no formatting)', () => {
    expect(parseValor('500000')).toBe(500000)
  })

  it('parses "€ 980.000"', () => {
    expect(parseValor('€ 980.000')).toBe(980000)
  })

  it('parses comma as decimal separator', () => {
    // "1500,50" → replace comma with dot → 1500.50
    expect(parseValor('1500,50')).toBeCloseTo(1500.50, 2)
  })

  it('returns 0 for empty string', () => {
    expect(parseValor('')).toBe(0)
  })

  it('returns 0 for non-numeric string', () => {
    expect(parseValor('N/D')).toBe(0)
  })
})

// ─── Commission Rate (5%) ─────────────────────────────────────────────────────

describe('Commission rate — 5% on deal value', () => {
  it('5% on €750,000 = €37,500', () => {
    const valor = 750000
    expect(valor * COMMISSION_RATE).toBeCloseTo(37500, 2)
  })

  it('5% on €1,450,000 = €72,500', () => {
    expect(1450000 * COMMISSION_RATE).toBeCloseTo(72500, 2)
  })

  it('5% on €3,800,000 = €190,000', () => {
    expect(3800000 * COMMISSION_RATE).toBeCloseTo(190000, 2)
  })

  it('5% on €250,000 = €12,500', () => {
    expect(250000 * COMMISSION_RATE).toBeCloseTo(12500, 2)
  })
})

// ─── Stage Probabilities ─────────────────────────────────────────────────────

describe('Stage probabilities', () => {
  it('Angariação = 10%', () => {
    expect(STAGE_PCT['Angariação']).toBe(10)
  })

  it('CPCV Assinado = 70%', () => {
    expect(STAGE_PCT['CPCV Assinado']).toBe(70)
  })

  it('Escritura Concluída = 100%', () => {
    expect(STAGE_PCT['Escritura Concluída']).toBe(100)
  })

  it('weighted commission for CPCV Assinado deal', () => {
    // valor = €1M, commission = €50K, probability = 70%
    // weighted = 50000 * 0.70 = 35000
    const gross = 1000000 * COMMISSION_RATE
    const weighted = gross * (STAGE_PCT['CPCV Assinado'] / 100)
    expect(weighted).toBeCloseTo(35000, 2)
  })
})

// ─── Pipeline Calculation ────────────────────────────────────────────────────

describe('Pipeline calculation', () => {
  it('single Escritura Concluída deal goes to realized', () => {
    const deals: Deal[] = [{ valor: '1000000', fase: 'Escritura Concluída' }]
    const { realized, pipeline } = calcPipeline(deals)
    // realized = 1000000 * 0.05 = 50000
    // pipeline = 0 (concluída goes to realized not pipeline)
    expect(realized).toBeCloseTo(50000, 2)
    expect(pipeline).toBe(0)
  })

  it('single CPCV Assinado deal (70%) goes to pipeline', () => {
    const deals: Deal[] = [{ valor: '1000000', fase: 'CPCV Assinado' }]
    const { realized, pipeline } = calcPipeline(deals)
    // realized = 0
    // pipeline = 1000000 * 0.05 * 0.70 = 35000
    expect(realized).toBe(0)
    expect(pipeline).toBeCloseTo(35000, 2)
  })

  it('single Angariação deal (10%) goes to pipeline', () => {
    const deals: Deal[] = [{ valor: '2000000', fase: 'Angariação' }]
    const { pipeline } = calcPipeline(deals)
    // 2000000 * 0.05 * 0.10 = 10000
    expect(pipeline).toBeCloseTo(10000, 2)
  })

  it('mixed pipeline: 1 concluded + 1 CPCV', () => {
    const deals: Deal[] = [
      { valor: '1000000', fase: 'Escritura Concluída' },
      { valor: '2000000', fase: 'CPCV Assinado' },
    ]
    const { realized, pipeline, expectedGross } = calcPipeline(deals)
    // realized = 1000000 * 0.05 = 50000
    // pipeline = 2000000 * 0.05 * 0.70 = 70000
    expect(realized).toBeCloseTo(50000, 2)
    expect(pipeline).toBeCloseTo(70000, 2)
    expect(expectedGross).toBeCloseTo(120000, 2)
  })
})

// ─── IRS Withholding (25%) ───────────────────────────────────────────────────

describe('IRS withholding — 25%', () => {
  it('IRS = 25% of expectedGross', () => {
    const deals: Deal[] = [{ valor: '1000000', fase: 'Escritura Concluída' }]
    const { irsWithholding, expectedGross } = calcPipeline(deals)
    // expectedGross = 50000, irsWithholding = 12500
    expect(irsWithholding).toBeCloseTo(expectedGross * 0.25, 2)
    expect(irsWithholding).toBeCloseTo(12500, 2)
  })

  it('Net = 75% of expectedGross', () => {
    const deals: Deal[] = [{ valor: '2000000', fase: 'Escritura Concluída' }]
    const { expectedNet, expectedGross } = calcPipeline(deals)
    // gross = 100000, net = 75000
    expect(expectedNet).toBeCloseTo(expectedGross * 0.75, 2)
    expect(expectedNet).toBeCloseTo(75000, 2)
  })

  it('IRS + Net = expectedGross', () => {
    const deals: Deal[] = [
      { valor: '€ 1.450.000', fase: 'CPCV Assinado' },
      { valor: '3800000', fase: 'Escritura Concluída' },
    ]
    const { irsWithholding, expectedNet, expectedGross } = calcPipeline(deals)
    expect(irsWithholding + expectedNet).toBeCloseTo(expectedGross, 2)
  })
})

// ─── Realized vs Pipeline separation ────────────────────────────────────────

describe('Realized vs Pipeline separation', () => {
  it('only Escritura Concluída contributes to realized', () => {
    const deals: Deal[] = [
      { valor: '1000000', fase: 'Angariação' },
      { valor: '1000000', fase: 'CPCV Assinado' },
      { valor: '1000000', fase: 'Escritura Marcada' },
    ]
    const { realized } = calcPipeline(deals)
    expect(realized).toBe(0)
  })

  it('all non-concluded stages contribute to pipeline only', () => {
    const deals: Deal[] = [
      { valor: '1000000', fase: 'Proposta Enviada' },  // 20% weighted
      { valor: '1000000', fase: 'Due Diligence' },      // 50% weighted
    ]
    const { realized, pipeline } = calcPipeline(deals)
    expect(realized).toBe(0)
    // pipeline = 1M*0.05*0.20 + 1M*0.05*0.50 = 10000 + 25000 = 35000
    expect(pipeline).toBeCloseTo(35000, 2)
  })

  it('full pipeline — all 8 stages', () => {
    const deals: Deal[] = [
      { valor: '1000000', fase: 'Angariação' },          // 50000 * 10% = 5000
      { valor: '1000000', fase: 'Proposta Enviada' },    // 50000 * 20% = 10000
      { valor: '1000000', fase: 'Proposta Aceite' },     // 50000 * 35% = 17500
      { valor: '1000000', fase: 'Due Diligence' },       // 50000 * 50% = 25000
      { valor: '1000000', fase: 'CPCV Assinado' },       // 50000 * 70% = 35000
      { valor: '1000000', fase: 'Financiamento' },       // 50000 * 80% = 40000
      { valor: '1000000', fase: 'Escritura Marcada' },   // 50000 * 90% = 45000
      { valor: '1000000', fase: 'Escritura Concluída' }, // 50000 → realized
    ]
    const { realized, pipeline } = calcPipeline(deals)
    expect(realized).toBeCloseTo(50000, 2)
    // pipeline = 5000+10000+17500+25000+35000+40000+45000 = 177500
    expect(pipeline).toBeCloseTo(177500, 2)
  })
})

// ─── CPCV 50% + Escritura 50% payment split ──────────────────────────────────

describe('CPCV 50% + Escritura 50% payment split', () => {
  it('CPCV payout = 50% of pipelineWeighted', () => {
    const deals: Deal[] = [{ valor: '1000000', fase: 'CPCV Assinado' }]
    const { pipeline } = calcPipeline(deals)
    // pipeline = 35000; CPCV = 50% = 17500
    expect(pipeline * 0.5).toBeCloseTo(17500, 2)
  })

  it('Escritura payout = 50% of pipelineWeighted', () => {
    const deals: Deal[] = [{ valor: '2000000', fase: 'Escritura Marcada' }]
    const { pipeline } = calcPipeline(deals)
    // 2000000*0.05*0.90 = 90000; Escritura = 50% = 45000
    expect(pipeline * 0.5).toBeCloseTo(45000, 2)
  })
})
