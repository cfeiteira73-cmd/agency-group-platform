// ─── Unit tests: Properties data integrity ───────────────────────────────────

import { PROPERTIES, PROPERTY_IDS, ZONAS, TIPOS, ZONE_YIELDS, formatPrice, formatPriceFull } from '../app/imoveis/data'

describe('PROPERTIES data', () => {
  test('has exactly 20 properties', () => {
    expect(PROPERTIES).toHaveLength(20)
  })

  test('all properties have required fields', () => {
    PROPERTIES.forEach(p => {
      expect(p.id).toBeTruthy()
      expect(p.nome).toBeTruthy()
      expect(p.zona).toBeTruthy()
      expect(p.preco).toBeGreaterThan(0)
      expect(p.area).toBeGreaterThan(0)
      expect(p.quartos).toBeGreaterThan(0)
      expect(p.lat).toBeDefined()
      expect(p.lng).toBeDefined()
    })
  })

  test('all properties have coordinates in Portugal or Madeira', () => {
    PROPERTIES.forEach(p => {
      // Portugal mainland/Madeira lat range: 30-42, lng range: -20 to -5
      if (p.zona === 'Madeira') {
        expect(p.lat).toBeGreaterThan(30)
        expect(p.lat).toBeLessThan(34)
        expect(p.lng).toBeGreaterThan(-18)
        expect(p.lng).toBeLessThan(-15)
      } else {
        expect(p.lat).toBeGreaterThan(36)
        expect(p.lat).toBeLessThan(42)
        expect(p.lng).toBeGreaterThan(-10)
        expect(p.lng).toBeLessThan(-6)
      }
    })
  })

  test('all prices are in luxury range (€500K+)', () => {
    PROPERTIES.forEach(p => {
      expect(p.preco).toBeGreaterThanOrEqual(500_000)
    })
  })

  test('all properties have valid zona', () => {
    PROPERTIES.forEach(p => {
      expect(ZONAS).toContain(p.zona)
    })
  })

  test('PROPERTY_IDS matches PROPERTIES ids', () => {
    expect(PROPERTY_IDS).toHaveLength(PROPERTIES.length)
    PROPERTIES.forEach(p => {
      expect(PROPERTY_IDS).toContain(p.id)
    })
  })

  test('all ref IDs start with AG-2026-', () => {
    PROPERTIES.forEach(p => {
      expect(p.ref).toMatch(/^AG-2026-\d{3}$/)
    })
  })

  test('Lisboa has most properties (4)', () => {
    const lisboaProps = PROPERTIES.filter(p => p.zona === 'Lisboa')
    expect(lisboaProps.length).toBeGreaterThanOrEqual(4)
  })

  test('features array is non-empty', () => {
    PROPERTIES.forEach(p => {
      expect(p.features.length).toBeGreaterThan(0)
    })
  })

  test('all energia ratings are valid EPC codes', () => {
    const validEPC = ['A+', 'A', 'B', 'B-', 'C', 'D', 'E', 'F']
    PROPERTIES.forEach(p => {
      expect(validEPC).toContain(p.energia)
    })
  })
})

describe('ZONAS', () => {
  test('has 8 zones', () => {
    expect(ZONAS).toHaveLength(8)
  })

  test('includes all key markets', () => {
    expect(ZONAS).toContain('Lisboa')
    expect(ZONAS).toContain('Cascais')
    expect(ZONAS).toContain('Comporta')
    expect(ZONAS).toContain('Algarve')
    expect(ZONAS).toContain('Madeira')
  })
})

describe('TIPOS', () => {
  test('has at least 5 property types', () => {
    expect(TIPOS.length).toBeGreaterThanOrEqual(5)
  })

  test('includes Apartamento and Moradia', () => {
    expect(TIPOS).toContain('Apartamento')
    expect(TIPOS).toContain('Moradia')
  })
})

describe('formatPrice', () => {
  test('€2.85M formats correctly', () => {
    expect(formatPrice(2_850_000)).toBe('€ 2,9M')
  })

  test('€1M formats as €1M (no decimal)', () => {
    expect(formatPrice(1_000_000)).toBe('€ 1M')
  })

  test('€6.5M formats correctly', () => {
    expect(formatPrice(6_500_000)).toBe('€ 6,5M')
  })
})

describe('formatPriceFull', () => {
  test('returns € prefix', () => {
    expect(formatPriceFull(1_000_000)).toContain('€')
  })

  test('returns full number with separators', () => {
    expect(formatPriceFull(1_000_000)).toBe('€ 1\u00a0000\u00a0000')
  })
})
