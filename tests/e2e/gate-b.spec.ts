import { test, expect } from '@playwright/test'

// Gate B — Product contracts
// retries: 1 | continue-on-error: false in CI
// Tests deterministic product behaviour under valid auth conditions.
// Auth: CRON_SECRET header (isPortalAuth path 1 — no Supabase required).
// No photos in payload → no Anthropic call → fully deterministic.
// fetchLiveRates() falls back to hardcoded rates on network failure.

const CRON_SECRET = process.env.CRON_SECRET ?? 'placeholder'
const AUTH = { Authorization: `Bearer ${CRON_SECRET}` }

test.describe('Gate B — AVM Valuation Contract', () => {
  test('Lisboa T2 100m² returns success with valuation fields', async ({ request }) => {
    const response = await request.post('/api/avm', {
      headers: AUTH,
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
    expect(typeof body.estimativa).toBe('number')
    expect(body.estimativa).toBeGreaterThan(0)
    expect(body).toHaveProperty('rangeMin')
    expect(body).toHaveProperty('rangeMax')
  })

  test('Cascais Moradia 200m² returns positive valuation', async ({ request }) => {
    const response = await request.post('/api/avm', {
      headers: AUTH,
      data: { zona: 'Cascais', tipo: 'Moradia', area: 200, quartos: 4 },
    })
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.success).toBe(true)
    expect(body.estimativa).toBeGreaterThan(0)
  })

  test('rangeMin is strictly less than rangeMax', async ({ request }) => {
    const response = await request.post('/api/avm', {
      headers: AUTH,
      data: { zona: 'Algarve', tipo: 'T2', area: 80 },
    })
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body.rangeMin).toBeGreaterThan(0)
    expect(body.rangeMax).toBeGreaterThan(0)
    expect(body.rangeMin).toBeLessThan(body.rangeMax)
  })
})

test.describe('Gate B — Mortgage Validation Contract', () => {
  test('Mortgage rejects montante below €10.000 with 400', async ({ request }) => {
    const response = await request.post('/api/mortgage', {
      data: { montante: 5000, entrada_pct: 20, prazo: 30 },
    })
    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/mínimo/i)
  })

  test('Mortgage rejects investment LTV above 75% with 400', async ({ request }) => {
    const response = await request.post('/api/mortgage', {
      data: { montante: 300000, entrada_pct: 5, prazo: 30, uso: 'investimento' },
    })
    expect(response.status()).toBe(400)
  })
})
