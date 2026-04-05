import { describe, it, expect } from 'vitest'

// ─── Types and functions mirrored from app/api/nhr/route.ts ──────────────────

type TipoRendimento = 'salario' | 'rendas' | 'dividendos' | 'pensao' | 'mais_valias' | 'crypto'

interface CountryProfile {
  name_pt: string
  income_tax_max: number
  income_tax_avg: number
  ss_rate: number
  treaty: boolean
}

const COUNTRIES: Record<string, CountryProfile> = {
  UK:  { name_pt:'Reino Unido',    income_tax_max:0.45, income_tax_avg:0.40, ss_rate:0.12,   treaty:true  },
  USA: { name_pt:'Estados Unidos', income_tax_max:0.37, income_tax_avg:0.28, ss_rate:0.0765, treaty:true  },
  France:  { name_pt:'França',     income_tax_max:0.45, income_tax_avg:0.41, ss_rate:0.22,   treaty:true  },
  Germany: { name_pt:'Alemanha',   income_tax_max:0.42, income_tax_avg:0.37, ss_rate:0.185,  treaty:true  },
  Brazil:  { name_pt:'Brasil',     income_tax_max:0.275,income_tax_avg:0.22, ss_rate:0.14,   treaty:false },
}

function calcIRS(rendimento: number): number {
  const brackets = [
    { ate: 7703,     taxa: 0.1325 },
    { ate: 11623,    taxa: 0.18   },
    { ate: 16472,    taxa: 0.23   },
    { ate: 22218,    taxa: 0.26   },
    { ate: 28400,    taxa: 0.3275 },
    { ate: 40524,    taxa: 0.37   },
    { ate: 80000,    taxa: 0.435  },
    { ate: Infinity, taxa: 0.48   },
  ]
  let tax = 0
  let prev = 0
  for (const b of brackets) {
    if (rendimento <= prev) break
    tax += (Math.min(rendimento, b.ate) - prev) * b.taxa
    prev = b.ate
    if (b.ate === Infinity) break
  }
  return tax
}

function calcNHRTax(rendimento: number, tipo: TipoRendimento, fonteEstrangeira: boolean) {
  let imposto = 0
  let taxa = 0

  if (fonteEstrangeira) {
    switch (tipo) {
      case 'salario':    taxa = 0;    imposto = 0; break
      case 'dividendos': taxa = 0;    imposto = 0; break
      case 'rendas':     taxa = 0;    imposto = 0; break
      case 'pensao':     taxa = 0.10; imposto = rendimento * taxa; break
      case 'mais_valias':taxa = 0;    imposto = 0; break
      case 'crypto':     taxa = 0.28; imposto = rendimento * taxa; break
      default:           taxa = 0;    imposto = 0
    }
  } else {
    switch (tipo) {
      case 'salario':    taxa = 0.20; imposto = rendimento * taxa; break
      case 'dividendos': taxa = 0.28; imposto = rendimento * taxa; break
      case 'rendas':     taxa = 0.28; imposto = rendimento * taxa; break
      case 'pensao':     taxa = 0.10; imposto = rendimento * taxa; break
      case 'mais_valias':taxa = 0.28; imposto = rendimento * taxa; break
      case 'crypto':     taxa = 0.28; imposto = rendimento * taxa; break
      default:           taxa = 0.20; imposto = rendimento * taxa
    }
  }

  const ss = tipo === 'salario' ? Math.min(rendimento * 0.11, 5_400 * 12 * 0.11) : 0
  return {
    imposto: Math.round(imposto),
    taxa_efetiva_pct: parseFloat((taxa * 100).toFixed(1)),
    ss_contribuicao: Math.round(ss),
    rendimento_liquido: Math.round(rendimento - imposto - ss),
  }
}

function calcIFICITax(rendimento: number, tipo: TipoRendimento) {
  let imposto = 0
  let taxa = 0
  switch (tipo) {
    case 'salario':    taxa = 0.20; imposto = rendimento * taxa; break
    case 'dividendos': taxa = 0.20; imposto = rendimento * taxa; break
    case 'rendas':     taxa = 0.20; imposto = rendimento * taxa; break
    case 'pensao':     taxa = 0.20; imposto = rendimento * taxa; break
    case 'mais_valias':taxa = 0.20; imposto = rendimento * taxa; break
    case 'crypto':     taxa = 0.28; imposto = rendimento * taxa; break
    default:           taxa = 0.20; imposto = rendimento * taxa
  }
  const ss = tipo === 'salario' ? Math.min(rendimento * 0.11, 5_400 * 12 * 0.11) : 0
  return {
    imposto: Math.round(imposto),
    taxa_efetiva_pct: parseFloat((taxa * 100).toFixed(1)),
    ss_contribuicao: Math.round(ss),
    rendimento_liquido: Math.round(rendimento - imposto - ss),
  }
}

function calcOrigemTax(rendimento: number, pais: string) {
  const country = COUNTRIES[pais] ?? COUNTRIES['Other']
  const taxRate = rendimento > 150_000 ? country.income_tax_max : country.income_tax_avg
  const imposto = rendimento * taxRate
  const ss = rendimento * country.ss_rate
  return {
    imposto: Math.round(imposto),
    taxa_efetiva_pct: parseFloat((taxRate * 100).toFixed(1)),
    ss_contribuicao: Math.round(ss),
    rendimento_liquido: Math.round(rendimento - imposto - ss),
  }
}

function calcPoupanca10Anos(
  base_rendimento: number,
  imposto_origem: number,
  imposto_pt: number,
  ss_origem: number,
  ss_pt: number,
  crescimento: number = 0.03
): number {
  let total = 0
  for (let y = 1; y <= 10; y++) {
    const fator = Math.pow(1 + crescimento, y - 1)
    const rend_y = base_rendimento * fator
    const ratio_i  = base_rendimento > 0 ? imposto_origem / base_rendimento : 0
    const ratio_s  = base_rendimento > 0 ? ss_origem / base_rendimento : 0
    const ratio_ip = base_rendimento > 0 ? imposto_pt / base_rendimento : 0
    const ratio_sp = base_rendimento > 0 ? ss_pt / base_rendimento : 0
    total += rend_y * ((ratio_i + ratio_s) - (ratio_ip + ratio_sp))
  }
  return Math.round(total)
}

// ─── NHR Tax Tests ────────────────────────────────────────────────────────────

describe('NHR — Foreign source salário (exempt)', () => {
  it('foreign salary under NHR = €0 tax', () => {
    const { imposto, taxa_efetiva_pct } = calcNHRTax(100000, 'salario', true)
    expect(imposto).toBe(0)
    expect(taxa_efetiva_pct).toBe(0)
  })

  it('foreign dividends under NHR = €0 tax', () => {
    const { imposto } = calcNHRTax(100000, 'dividendos', true)
    expect(imposto).toBe(0)
  })

  it('foreign mais_valias under NHR = €0 tax', () => {
    const { imposto } = calcNHRTax(500000, 'mais_valias', true)
    expect(imposto).toBe(0)
  })
})

describe('NHR — Foreign source pensão (10%)', () => {
  it('foreign pension under NHR = 10% flat', () => {
    const rendimento = 80000
    const { imposto, taxa_efetiva_pct } = calcNHRTax(rendimento, 'pensao', true)
    expect(imposto).toBe(Math.round(rendimento * 0.10))
    expect(taxa_efetiva_pct).toBe(10)
  })
})

describe('NHR — Crypto always 28% regardless of source', () => {
  it('foreign crypto = 28%', () => {
    const rendimento = 100000
    const { imposto } = calcNHRTax(rendimento, 'crypto', true)
    expect(imposto).toBe(Math.round(rendimento * 0.28))
  })

  it('PT-source crypto = 28%', () => {
    const rendimento = 50000
    const { imposto } = calcNHRTax(rendimento, 'crypto', false)
    expect(imposto).toBe(Math.round(rendimento * 0.28))
  })
})

describe('NHR — PT-source income (20% for salary)', () => {
  it('PT salary under NHR = 20% flat', () => {
    const rendimento = 100000
    const { imposto, taxa_efetiva_pct } = calcNHRTax(rendimento, 'salario', false)
    expect(imposto).toBe(Math.round(rendimento * 0.20))
    expect(taxa_efetiva_pct).toBe(20)
  })

  it('PT dividends under NHR = 28%', () => {
    const rendimento = 100000
    const { imposto } = calcNHRTax(rendimento, 'dividendos', false)
    expect(imposto).toBe(Math.round(rendimento * 0.28))
  })

  it('PT rendas under NHR = 28%', () => {
    const rendimento = 100000
    const { imposto } = calcNHRTax(rendimento, 'rendas', false)
    expect(imposto).toBe(Math.round(rendimento * 0.28))
  })
})

// ─── IFICI Tax Tests ──────────────────────────────────────────────────────────

describe('IFICI — 20% flat rate on all qualified income', () => {
  it('IFICI salary = 20%', () => {
    const rendimento = 150000
    const { imposto, taxa_efetiva_pct } = calcIFICITax(rendimento, 'salario')
    expect(imposto).toBe(Math.round(rendimento * 0.20))
    expect(taxa_efetiva_pct).toBe(20)
  })

  it('IFICI dividends = 20%', () => {
    const rendimento = 100000
    const { imposto } = calcIFICITax(rendimento, 'dividendos')
    expect(imposto).toBe(Math.round(rendimento * 0.20))
  })

  it('IFICI pensão = 20%', () => {
    const rendimento = 50000
    const { imposto } = calcIFICITax(rendimento, 'pensao')
    expect(imposto).toBe(Math.round(rendimento * 0.20))
  })

  it('IFICI mais_valias = 20%', () => {
    const rendimento = 200000
    const { imposto } = calcIFICITax(rendimento, 'mais_valias')
    expect(imposto).toBe(Math.round(rendimento * 0.20))
  })

  it('IFICI crypto remains 28% (exception)', () => {
    const rendimento = 100000
    const { imposto, taxa_efetiva_pct } = calcIFICITax(rendimento, 'crypto')
    expect(imposto).toBe(Math.round(rendimento * 0.28))
    expect(taxa_efetiva_pct).toBe(28)
  })
})

// ─── Social Security cap ──────────────────────────────────────────────────────

describe('SS contribution for salary (capped at 5400*12*0.11)', () => {
  const SS_CAP = 5_400 * 12 * 0.11 // = 7128

  it('SS for €50K salary NHR = 50000 * 0.11', () => {
    const { ss_contribuicao } = calcNHRTax(50000, 'salario', false)
    expect(ss_contribuicao).toBe(Math.round(50000 * 0.11))
  })

  it('SS is capped for €500K salary', () => {
    const { ss_contribuicao } = calcNHRTax(500000, 'salario', false)
    expect(ss_contribuicao).toBe(Math.round(SS_CAP))
  })

  it('SS = 0 for dividends (non-salary)', () => {
    const { ss_contribuicao } = calcNHRTax(100000, 'dividendos', false)
    expect(ss_contribuicao).toBe(0)
  })
})

// ─── 10-year savings projection ───────────────────────────────────────────────

describe('NHR — 10-year savings projection', () => {
  it('positive savings for UK salary €150K via NHR (foreign source)', () => {
    const rendimento = 150000
    const origem = calcOrigemTax(rendimento, 'UK')
    const nhr = calcNHRTax(rendimento, 'salario', true)
    const savings10 = calcPoupanca10Anos(
      rendimento, origem.imposto, nhr.imposto, origem.ss_contribuicao, nhr.ss_contribuicao
    )
    // UK pays 40% avg + 12% SS, NHR pays 0% + 11% SS → savings are large
    expect(savings10).toBeGreaterThan(0)
  })

  it('10-year projection compounds with 3% annual growth', () => {
    // At 3% growth, year-10 income = base * 1.03^9 ≈ base * 1.3048
    // So 10-year projection > 10 * year1_savings
    const rendimento = 100000
    const origem = calcOrigemTax(rendimento, 'USA')
    const nhr = calcNHRTax(rendimento, 'salario', true)
    const savings10 = calcPoupanca10Anos(
      rendimento, origem.imposto, nhr.imposto, origem.ss_contribuicao, nhr.ss_contribuicao
    )
    // Year 1 savings = (USA tax + SS) - (NHR tax + SS)
    const yr1 = (origem.imposto + origem.ss_contribuicao) - (nhr.imposto + nhr.ss_contribuicao)
    // 10-year total > 10 * year1 due to 3% growth
    expect(savings10).toBeGreaterThan(yr1 * 10)
  })

  it('zero savings when tax rates are identical', () => {
    // Artificial case: if origin and PT taxes are the same → savings = 0
    const savings = calcPoupanca10Anos(100000, 20000, 20000, 5000, 5000)
    expect(savings).toBe(0)
  })
})

// ─── Origem tax rates ─────────────────────────────────────────────────────────

describe('Origin country tax rates', () => {
  it('UK: income_tax_avg = 40% for income <= €150K', () => {
    const rendimento = 100000
    const { taxa_efetiva_pct } = calcOrigemTax(rendimento, 'UK')
    expect(taxa_efetiva_pct).toBe(40)
  })

  it('UK: income_tax_max = 45% for income > €150K', () => {
    const rendimento = 200000
    const { taxa_efetiva_pct } = calcOrigemTax(rendimento, 'UK')
    expect(taxa_efetiva_pct).toBe(45)
  })

  it('USA: income_tax_avg = 28% for income <= €150K', () => {
    const { taxa_efetiva_pct } = calcOrigemTax(100000, 'USA')
    expect(taxa_efetiva_pct).toBe(28)
  })

  it('France: income_tax_avg = 41%', () => {
    const { taxa_efetiva_pct } = calcOrigemTax(100000, 'France')
    expect(taxa_efetiva_pct).toBe(41)
  })

  it('Brazil: no treaty, income_tax_avg = 22%', () => {
    const country = COUNTRIES['Brazil']
    expect(country.treaty).toBe(false)
    expect(country.income_tax_avg).toBeCloseTo(0.22, 4)
  })
})

// ─── IRS progressive scale ───────────────────────────────────────────────────

describe('IRS Portugal — Progressive scale 2026', () => {
  it('income €7,703: taxed at 13.25%', () => {
    // All in bracket 1: 7703 * 0.1325 = 1020.65 (approx)
    const tax = calcIRS(7703)
    expect(tax).toBeCloseTo(7703 * 0.1325, 0)
  })

  it('income €50,000 is between €40,524 and €80,000 (43.5% marginal)', () => {
    const tax = calcIRS(50000)
    // Should be between 40524 progressive and 80000 progressive
    expect(tax).toBeGreaterThan(0)
    expect(tax).toBeLessThan(50000 * 0.435)
  })

  it('income €100,000 includes 48% top bracket portion', () => {
    const tax = calcIRS(100000)
    // Effective rate must be above 43.5% bracket (since 20K is in 48% bracket)
    expect(tax).toBeGreaterThan(80000 * 0.435)
    expect(tax).toBeLessThan(100000 * 0.48)
  })

  it('calcIRS is progressive: doubling income more than doubles tax', () => {
    const tax1 = calcIRS(40000)
    const tax2 = calcIRS(80000)
    // Progressive: tax at 80K > 2x tax at 40K
    expect(tax2).toBeGreaterThan(tax1 * 2)
  })

  it('income €0 = €0 tax', () => {
    expect(calcIRS(0)).toBe(0)
  })
})

// ─── Savings vs standard regime ──────────────────────────────────────────────

describe('Savings vs standard regime (rendimento_liquido comparison)', () => {
  it('NHR foreign salary always gives more take-home than normal IRS for high income', () => {
    // NHR: 0% tax on €200K foreign salary
    const nhr = calcNHRTax(200000, 'salario', true)
    // Normal IRS: progressive, would pay significant tax
    // Normal IRS approx for 200K: ~86K+ in tax (>43.5%)
    const nhrLiquido = nhr.rendimento_liquido
    // With 0% NHR, liquido ≈ 200000 - SS(capped)
    expect(nhrLiquido).toBeGreaterThan(150000)
  })

  it('IFICI 20% always better than standard IRS for €200K salary', () => {
    const ifici = calcIFICITax(200000, 'salario')
    // IFICI tax = 200000 * 0.20 = 40000
    // Normal IRS for 200K is approximately > 80K (48% top bracket)
    const normalTax = calcIRS(200000)
    expect(ifici.imposto).toBeLessThan(normalTax)
  })
})
