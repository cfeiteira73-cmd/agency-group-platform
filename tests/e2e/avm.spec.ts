import { test, expect } from '@playwright/test'

test.describe('AVM API — valuation endpoint', () => {
  test('POST /api/avm should return valuation fields for Lisboa', async ({ request }) => {
    const response = await request.post('/api/avm', {
      data: {
        zona: 'Lisboa',
        tipo: 'T2',
        area: 100,
        quartos: 2,
        casasBanho: 1,
        andar: 3,
        garagem: false,
        piscina: false,
        condominio: true,
        vista: 'cidade',
        energia: 'A',
      },
    })
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body).toHaveProperty('estimativa')
    expect(body).toHaveProperty('rangeMin')
    expect(body).toHaveProperty('rangeMax')
    expect(typeof body.estimativa).toBe('number')
    expect(body.estimativa).toBeGreaterThan(0)
  })

  test('POST /api/avm should return valuation for Cascais', async ({ request }) => {
    const response = await request.post('/api/avm', {
      data: { zona: 'Cascais', tipo: 'Moradia', area: 200, quartos: 4 },
    })
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.estimativa).toBeGreaterThan(0)
  })

  test('POST /api/avm should return valuation for Porto', async ({ request }) => {
    const response = await request.post('/api/avm', {
      data: { zona: 'Porto', tipo: 'T3', area: 120, quartos: 3 },
    })
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body).toHaveProperty('rangeMin')
    expect(body).toHaveProperty('rangeMax')
  })

  test('POST /api/avm rangeMin should be less than rangeMax', async ({ request }) => {
    const response = await request.post('/api/avm', {
      data: { zona: 'Algarve', tipo: 'T2', area: 80 },
    })
    expect(response.status()).toBe(200)
    const body = await response.json()
    if (body.rangeMin && body.rangeMax) {
      expect(body.rangeMin).toBeLessThan(body.rangeMax)
    }
  })

  test('POST /api/avm with empty body should return 200 or 400 gracefully', async ({ request }) => {
    const response = await request.post('/api/avm', { data: {} })
    expect([200, 400]).toContain(response.status())
    // Should never 500
    expect(response.status()).not.toBe(500)
  })
})
