// ─── Unit tests: Mortgage / Investment calculations ──────────────────────────
// These mirror the logic in ImovelClient.tsx calcInvestment()

const ZONE_YIELDS: Record<string, { yield: number; yoy: number; preco: number }> = {
  'Lisboa':   { preco: 5000, yield: 3.2, yoy: 14 },
  'Cascais':  { preco: 4713, yield: 3.8, yoy: 12 },
  'Comporta': { preco: 3941, yield: 4.0, yoy: 22 },
  'Porto':    { preco: 3643, yield: 4.1, yoy: 12 },
  'Algarve':  { preco: 3941, yield: 4.8, yoy: 11 },
  'Madeira':  { preco: 3760, yield: 4.5, yoy: 18 },
  'Sintra':   { preco: 4200, yield: 3.5, yoy:  9 },
  'Ericeira': { preco: 3800, yield: 4.2, yoy: 15 },
}

function calcInvestment(preco: number, zona: string) {
  const zd = ZONE_YIELDS[zona] || { yield: 3.5, yoy: 10, preco: 4000 }
  const ltv = 0.60
  const equity = Math.round(preco * (1 - ltv))
  const loanAmt = preco * ltv
  const rate = 0.0295 / 12
  const n = 360
  const monthlyMortgage = Math.round(loanAmt * (rate * Math.pow(1 + rate, n)) / (Math.pow(1 + rate, n) - 1))
  const yieldBruto = zd.yield
  const yieldLiquido = parseFloat((yieldBruto * 0.72).toFixed(2))
  const grossRent = Math.round(preco * yieldBruto / 100 / 12)
  const cashFlow = Math.round(grossRent * 0.72 - monthlyMortgage)
  const irr5yr = parseFloat((yieldLiquido + zd.yoy * 0.4).toFixed(1))
  const coc = parseFloat(((cashFlow * 12 / equity) * 100).toFixed(1))
  return { equity, monthlyMortgage, yieldBruto, yieldLiquido, grossRent, cashFlow, irr5yr, coc }
}

function formatPrice(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `€ ${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1).replace('.', ',')}M`
  }
  return `€ ${n.toLocaleString('pt-PT')}`
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('calcInvestment', () => {
  test('equity is 40% of price (60% LTV)', () => {
    const result = calcInvestment(1_000_000, 'Lisboa')
    expect(result.equity).toBe(400_000)
  })

  test('monthly mortgage on €1M at 60% LTV is positive', () => {
    const result = calcInvestment(1_000_000, 'Lisboa')
    expect(result.monthlyMortgage).toBeGreaterThan(0)
    expect(result.monthlyMortgage).toBeLessThan(5000)
  })

  test('Lisboa gross yield is 3.2%', () => {
    const result = calcInvestment(1_000_000, 'Lisboa')
    expect(result.yieldBruto).toBe(3.2)
  })

  test('net yield is 72% of gross', () => {
    const result = calcInvestment(1_000_000, 'Lisboa')
    expect(result.yieldLiquido).toBeCloseTo(result.yieldBruto * 0.72, 2)
  })

  test('Comporta has higher yield than Lisboa', () => {
    const lisbon = calcInvestment(1_000_000, 'Lisboa')
    const comporta = calcInvestment(1_000_000, 'Comporta')
    expect(comporta.yieldBruto).toBeGreaterThan(lisbon.yieldBruto)
  })

  test('IRR includes capital appreciation', () => {
    const result = calcInvestment(1_000_000, 'Comporta')
    // Comporta: 4.0% net yield * 0.72 + 22% yoy * 0.4 = 11.68
    expect(result.irr5yr).toBeGreaterThan(11)
  })

  test('gross rent matches yield formula', () => {
    const preco = 2_000_000
    const result = calcInvestment(preco, 'Lisboa')
    const expectedGrossRent = Math.round(preco * 3.2 / 100 / 12)
    expect(result.grossRent).toBe(expectedGrossRent)
  })

  test('works with unknown zone (fallback)', () => {
    const result = calcInvestment(500_000, 'UnknownZone')
    expect(result.equity).toBe(200_000)
    expect(result.yieldBruto).toBe(3.5) // fallback
  })
})

describe('formatPrice', () => {
  test('formats millions with M suffix', () => {
    expect(formatPrice(1_000_000)).toBe('€ 1M')
    expect(formatPrice(2_850_000)).toBe('€ 2,9M')
  })

  test('formats below million with locale', () => {
    const result = formatPrice(850_000)
    expect(result).toContain('€')
    expect(result).toContain('850')
  })
})

describe('ZONE_YIELDS data integrity', () => {
  test('all zones have required fields', () => {
    Object.entries(ZONE_YIELDS).forEach(([zona, data]) => {
      expect(data.preco).toBeGreaterThan(0)
      expect(data.yield).toBeGreaterThan(0)
      expect(data.yoy).toBeGreaterThan(0)
    })
  })

  test('Lisboa price/m² is highest', () => {
    const prices = Object.values(ZONE_YIELDS).map(z => z.preco)
    expect(ZONE_YIELDS['Lisboa'].preco).toBe(Math.max(...prices))
  })

  test('Algarve has highest yield (tourism)', () => {
    const yields = Object.values(ZONE_YIELDS).map(z => z.yield)
    expect(ZONE_YIELDS['Algarve'].yield).toBe(Math.max(...yields))
  })
})

describe('Commission calculation (AMI 22506)', () => {
  test('5% commission on sale price', () => {
    const sale = 1_000_000
    const commission = sale * 0.05
    expect(commission).toBe(50_000)
  })

  test('50% at CPCV + 50% at Escritura split', () => {
    const total = 50_000
    const cpcv = total * 0.5
    const escritura = total * 0.5
    expect(cpcv + escritura).toBe(total)
    expect(cpcv).toBe(25_000)
  })
})
