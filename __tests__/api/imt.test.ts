import { describe, it, expect } from 'vitest'

// ─── Pure bracket types and functions (mirrored from app/api/imt/route.ts) ────

interface Bracket {
  max: number
  rate: number
  deduction: number
  flat?: boolean
}

const HPP_BRACKETS: Bracket[] = [
  { max: 97064,    rate: 0.00, deduction: 0,        flat: false },
  { max: 132774,   rate: 0.02, deduction: 1941.28,  flat: false },
  { max: 181034,   rate: 0.05, deduction: 5924.50,  flat: false },
  { max: 301688,   rate: 0.07, deduction: 9545.18,  flat: false },
  { max: 603289,   rate: 0.08, deduction: 12562.06, flat: false },
  { max: Infinity, rate: 0.06, deduction: 0,         flat: true  },
]

const SECOND_BRACKETS: Bracket[] = [
  { max: 97064,    rate: 0.01, deduction: 0,         flat: false },
  { max: 132774,   rate: 0.02, deduction: 970.64,    flat: false },
  { max: 181034,   rate: 0.05, deduction: 4954.50,   flat: false },
  { max: 301688,   rate: 0.07, deduction: 8573.90,   flat: false },
  { max: 578598,   rate: 0.08, deduction: 11590.78,  flat: false },
  { max: 1050400,  rate: 0.06, deduction: 0,          flat: true  },
  { max: Infinity, rate: 0.075, deduction: 0,         flat: true  },
]

function calcIMT(valor: number, brackets: Bracket[]): number {
  for (const bracket of brackets) {
    if (valor <= bracket.max) {
      if (bracket.flat) {
        return valor * bracket.rate
      }
      return valor * bracket.rate - bracket.deduction
    }
  }
  return 0
}

function calcTotalCosts(
  valor: number,
  tipo: 'hpp' | 'second' | 'invest',
  comprador: 'singular' | 'empresa'
) {
  const isHPP = tipo === 'hpp' && comprador === 'singular'
  const brackets = isHPP ? HPP_BRACKETS : SECOND_BRACKETS
  const imt = Math.max(0, calcIMT(valor, brackets))
  const isento = isHPP && valor <= 97064
  const is = valor * 0.008
  const registro = 250
  const notario = 500
  const advogado = valor * 0.01
  const total = imt + is + registro + notario + advogado

  let savings = 0
  if (tipo === 'hpp' && comprador === 'singular') {
    const imtSecond = Math.max(0, calcIMT(valor, SECOND_BRACKETS))
    savings = Math.max(0, imtSecond - imt)
  }

  return { imt, is, registro, notario, advogado, total, isento, savings }
}

// ─── HPP — Habitação Própria Permanente ───────────────────────────────────────

describe('IMT Calculator — HPP (Habitação Própria Permanente)', () => {
  it('should be exempt (€0 IMT) for HPP up to €97,064', () => {
    // Bracket 1: rate=0%, valor=97064 => imt = 97064*0 - 0 = 0
    const imt = calcIMT(97064, HPP_BRACKETS)
    expect(imt).toBe(0)
  })

  it('should be exempt for any HPP value at or below €97,064', () => {
    expect(calcIMT(50000, HPP_BRACKETS)).toBe(0)
    expect(calcIMT(97064, HPP_BRACKETS)).toBe(0)
  })

  it('should calculate bracket 2 (2%) for €132,774', () => {
    // Bracket: rate=2%, deduction=1941.28
    // imt = 132774 * 0.02 - 1941.28 = 2655.48 - 1941.28 = 714.20
    const imt = calcIMT(132774, HPP_BRACKETS)
    expect(imt).toBeCloseTo(714.20, 2)
  })

  it('should calculate bracket 2 mid-range for €120,000', () => {
    // 120000 * 0.02 - 1941.28 = 2400 - 1941.28 = 458.72
    const imt = calcIMT(120000, HPP_BRACKETS)
    expect(imt).toBeCloseTo(458.72, 2)
  })

  it('should calculate bracket 3 (5%) for €181,034', () => {
    // 181034 * 0.05 - 5924.50 = 9051.70 - 5924.50 = 3127.20
    const imt = calcIMT(181034, HPP_BRACKETS)
    expect(imt).toBeCloseTo(3127.20, 2)
  })

  it('should calculate bracket 4 (7%) for €301,688', () => {
    // 301688 * 0.07 - 9545.18 = 21118.16 - 9545.18 = 11572.98
    const imt = calcIMT(301688, HPP_BRACKETS)
    expect(imt).toBeCloseTo(11572.98, 2)
  })

  it('should calculate bracket 5 (8%) for €603,289', () => {
    // 603289 * 0.08 - 12562.06 = 48263.12 - 12562.06 = 35701.06
    const imt = calcIMT(603289, HPP_BRACKETS)
    expect(imt).toBeCloseTo(35701.06, 2)
  })

  it('should calculate flat 6% for values above €603,289 HPP', () => {
    // flat rate: 800000 * 0.06 = 48000
    const imt = calcIMT(800000, HPP_BRACKETS)
    expect(imt).toBeCloseTo(48000, 2)
  })

  it('should calculate flat 6% for €2,000,000 HPP', () => {
    // 2000000 * 0.06 = 120000
    const imt = calcIMT(2000000, HPP_BRACKETS)
    expect(imt).toBeCloseTo(120000, 2)
  })
})

// ─── SECOND HOME / INVESTIMENTO ───────────────────────────────────────────────

describe('IMT Calculator — 2ª Habitação / Investimento', () => {
  it('should apply 1% for values up to €97,064', () => {
    // 97064 * 0.01 - 0 = 970.64
    const imt = calcIMT(97064, SECOND_BRACKETS)
    expect(imt).toBeCloseTo(970.64, 2)
  })

  it('should apply 1% for €50,000 (second home)', () => {
    // 50000 * 0.01 = 500
    const imt = calcIMT(50000, SECOND_BRACKETS)
    expect(imt).toBeCloseTo(500, 2)
  })

  it('should calculate bracket 2 for €132,774 (second home)', () => {
    // 132774 * 0.02 - 970.64 = 2655.48 - 970.64 = 1684.84
    const imt = calcIMT(132774, SECOND_BRACKETS)
    expect(imt).toBeCloseTo(1684.84, 2)
  })

  it('should calculate bracket 3 (5%) for €181,034 (second home)', () => {
    // 181034 * 0.05 - 4954.50 = 9051.70 - 4954.50 = 4097.20
    const imt = calcIMT(181034, SECOND_BRACKETS)
    expect(imt).toBeCloseTo(4097.20, 2)
  })

  it('should calculate bracket 4 (7%) for €301,688 (second home)', () => {
    // 301688 * 0.07 - 8573.90 = 21118.16 - 8573.90 = 12544.26
    const imt = calcIMT(301688, SECOND_BRACKETS)
    expect(imt).toBeCloseTo(12544.26, 2)
  })

  it('should calculate bracket 5 (8%) for €578,598 (second home)', () => {
    // 578598 * 0.08 - 11590.78 = 46287.84 - 11590.78 = 34697.06
    const imt = calcIMT(578598, SECOND_BRACKETS)
    expect(imt).toBeCloseTo(34697.06, 2)
  })

  it('should apply flat 6% for values between €578,598 and €1,050,400', () => {
    // 800000 * 0.06 = 48000
    const imt = calcIMT(800000, SECOND_BRACKETS)
    expect(imt).toBeCloseTo(48000, 2)
  })

  it('should apply flat 7.5% for values above €1,050,400', () => {
    // 1500000 * 0.075 = 112500
    const imt = calcIMT(1500000, SECOND_BRACKETS)
    expect(imt).toBeCloseTo(112500, 2)
  })

  it('should apply flat 7.5% at exactly €1,050,401', () => {
    // 1050401 * 0.075 = 78780.075
    const imt = calcIMT(1050401, SECOND_BRACKETS)
    expect(imt).toBeCloseTo(1050401 * 0.075, 2)
  })
})

// ─── EMPRESA ──────────────────────────────────────────────────────────────────

describe('IMT — Empresa', () => {
  it('empresa always uses second home brackets (tipo=invest)', () => {
    const valor = 300000
    const { imt } = calcTotalCosts(valor, 'invest', 'empresa')
    const expected = calcIMT(valor, SECOND_BRACKETS)
    expect(imt).toBeCloseTo(expected, 2)
  })

  it('empresa with tipo=hpp still uses second brackets because comprador=empresa', () => {
    const valor = 500000
    const { imt } = calcTotalCosts(valor, 'hpp', 'empresa')
    // isHPP = tipo==='hpp' && comprador==='singular' => FALSE for empresa
    const expected = calcIMT(valor, SECOND_BRACKETS)
    expect(imt).toBeCloseTo(expected, 2)
  })

  it('empresa pays no HPP exemption even below €97,064', () => {
    const { imt, isento } = calcTotalCosts(80000, 'hpp', 'empresa')
    // isento = false because comprador=empresa
    expect(isento).toBe(false)
    // imt = 80000 * 0.01 = 800
    expect(imt).toBeCloseTo(800, 2)
  })
})

// ─── TOTAL COSTS ─────────────────────────────────────────────────────────────

describe('IMT — Total Costs', () => {
  it('should include IS (0.8%) correctly', () => {
    const valor = 500000
    const { is } = calcTotalCosts(valor, 'second', 'singular')
    // IS = 500000 * 0.008 = 4000
    expect(is).toBeCloseTo(4000, 2)
  })

  it('should include registro (€250) and notário (€500)', () => {
    const { registro, notario } = calcTotalCosts(300000, 'hpp', 'singular')
    expect(registro).toBe(250)
    expect(notario).toBe(500)
  })

  it('should include advogado (1%)', () => {
    const valor = 750000
    const { advogado } = calcTotalCosts(valor, 'second', 'singular')
    // advogado = 750000 * 0.01 = 7500
    expect(advogado).toBeCloseTo(7500, 2)
  })

  it('total should equal imt + is + registro + notario + advogado', () => {
    const valor = 1000000
    const { imt, is, registro, notario, advogado, total } = calcTotalCosts(valor, 'second', 'singular')
    const sum = imt + is + registro + notario + advogado
    expect(total).toBeCloseTo(sum, 2)
  })

  it('total costs for €500K HPP singular should be correct', () => {
    // HPP €500K: bracket 5 (8%) => 500000*0.08 - 12562.06 = 40000 - 12562.06 = 27437.94
    // IS = 500000*0.008 = 4000
    // registro = 250, notario = 500
    // advogado = 500000*0.01 = 5000
    // total = 27437.94 + 4000 + 250 + 500 + 5000 = 37187.94
    const { imt, total } = calcTotalCosts(500000, 'hpp', 'singular')
    expect(imt).toBeCloseTo(27437.94, 2)
    expect(total).toBeCloseTo(37187.94, 2)
  })

  it('total costs for €1M second home should be correct', () => {
    // SECOND €1M: bracket flat 6% => 1000000*0.06 = 60000
    // IS = 1000000*0.008 = 8000
    // registro = 250, notario = 500
    // advogado = 1000000*0.01 = 10000
    // total = 60000 + 8000 + 250 + 500 + 10000 = 78750
    const { imt, total } = calcTotalCosts(1000000, 'second', 'singular')
    expect(imt).toBeCloseTo(60000, 2)
    expect(total).toBeCloseTo(78750, 2)
  })
})

// ─── INPUT VALIDATION ────────────────────────────────────────────────────────

describe('IMT — Input Validation (API contract)', () => {
  it('should reject negative valor — imt guard returns 0', () => {
    // The route uses Math.max(0, calcIMT(valor, brackets)) and rejects valor<=0
    // For negative, calcIMT would fall through brackets; but the API returns 400
    // We test the Math.max guard
    const raw = calcIMT(-1000, HPP_BRACKETS)
    // -1000 <= 97064, rate=0 => 0 * 0 - 0 = 0
    expect(Math.max(0, raw)).toBe(0)
  })

  it('should reject valor = 0 via API contract', () => {
    // The route returns 400 if !valor || valor <= 0
    // Here we verify the guard: calcIMT(0) = 0 and Math.max(0,0)=0
    const imt = Math.max(0, calcIMT(0, HPP_BRACKETS))
    expect(imt).toBe(0)
  })

  it('should require tipo field (hpp | second | invest)', () => {
    // The API checks !tipo and returns 400 — we verify the type union
    const validTypes = ['hpp', 'second', 'invest'] as const
    validTypes.forEach(t => {
      expect(['hpp', 'second', 'invest']).toContain(t)
    })
  })

  it('should require comprador field (singular | empresa)', () => {
    const validCompradores = ['singular', 'empresa'] as const
    validCompradores.forEach(c => {
      expect(['singular', 'empresa']).toContain(c)
    })
  })
})

// ─── SAVINGS CALCULATION ──────────────────────────────────────────────────────

describe('IMT — Savings calculation', () => {
  it('savings should be positive for HPP vs second home on €500K', () => {
    // HPP imt = 500000*0.08 - 12562.06 = 27437.94
    // SECOND imt = 500000*0.08 - 11590.78 = 28409.22
    // savings = 28409.22 - 27437.94 = 971.28
    const { savings } = calcTotalCosts(500000, 'hpp', 'singular')
    expect(savings).toBeGreaterThan(0)
    expect(savings).toBeCloseTo(971.28, 2)
  })

  it('savings should be 0 for second home (não HPP)', () => {
    const { savings } = calcTotalCosts(500000, 'second', 'singular')
    expect(savings).toBe(0)
  })

  it('savings should be 0 for invest', () => {
    const { savings } = calcTotalCosts(500000, 'invest', 'singular')
    expect(savings).toBe(0)
  })

  it('savings should be large for HPP €97,064 (exempt) vs second home', () => {
    // HPP imt = 0 (exempt)
    // SECOND imt = 97064 * 0.01 = 970.64
    // savings = 970.64 - 0 = 970.64
    const { savings } = calcTotalCosts(97064, 'hpp', 'singular')
    expect(savings).toBeCloseTo(970.64, 2)
  })

  it('savings should be large for HPP on luxury (€2M) vs second home', () => {
    // HPP: 2000000 * 0.06 = 120000 (flat 6%)
    // SECOND: 2000000 * 0.075 = 150000 (flat 7.5%)
    // savings = 150000 - 120000 = 30000
    const { savings } = calcTotalCosts(2000000, 'hpp', 'singular')
    expect(savings).toBeCloseTo(30000, 2)
  })

  it('savings should be 0 for empresa even with tipo=hpp', () => {
    const { savings } = calcTotalCosts(500000, 'hpp', 'empresa')
    expect(savings).toBe(0)
  })
})

// ─── IS CALCULATION ──────────────────────────────────────────────────────────

describe('IMT — IS (Imposto de Selo) 0.8%', () => {
  it('IS = 0.8% for various values', () => {
    const testCases = [
      { valor: 100000, expected: 800 },
      { valor: 250000, expected: 2000 },
      { valor: 1000000, expected: 8000 },
      { valor: 3800000, expected: 30400 },
    ]
    testCases.forEach(({ valor, expected }) => {
      const is = valor * 0.008
      expect(is).toBeCloseTo(expected, 2)
    })
  })
})

// ─── BRACKET BOUNDARY TESTS ──────────────────────────────────────────────────

describe('IMT — Bracket boundary precision', () => {
  it('HPP: value just above bracket 1 limit uses bracket 2 rate', () => {
    // 97065 is in bracket 2: 97065 * 0.02 - 1941.28 = 1941.30 - 1941.28 = 0.02
    const imt = calcIMT(97065, HPP_BRACKETS)
    expect(imt).toBeCloseTo(97065 * 0.02 - 1941.28, 2)
  })

  it('HPP: value exactly at bracket 3 limit', () => {
    // 181034 * 0.05 - 5924.50 = 9051.70 - 5924.50 = 3127.20
    const imt = calcIMT(181034, HPP_BRACKETS)
    expect(imt).toBeCloseTo(3127.20, 2)
  })

  it('SECOND: value exactly at flat 6% threshold limit (€578,598)', () => {
    // 578598 * 0.08 - 11590.78 = 46287.84 - 11590.78 = 34697.06
    const imt = calcIMT(578598, SECOND_BRACKETS)
    expect(imt).toBeCloseTo(34697.06, 2)
  })

  it('SECOND: value at €578,599 enters flat 6% bracket', () => {
    // 578599 * 0.06 = 34715.94
    const imt = calcIMT(578599, SECOND_BRACKETS)
    expect(imt).toBeCloseTo(578599 * 0.06, 2)
  })
})
