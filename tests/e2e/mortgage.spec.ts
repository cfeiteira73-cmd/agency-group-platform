import { test, expect } from '@playwright/test'

test.describe('Mortgage Calculator API (/api/mortgage)', () => {
  test('POST /api/mortgage should return monthly payment for valid payload', async ({ request }) => {
    const response = await request.post('/api/mortgage', {
      data: { montante: 300000, entrada_pct: 20, prazo: 30 },
    })
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body).toBeTruthy()
  })

  test('POST /api/mortgage should reject montante below €10.000 with 400', async ({ request }) => {
    const response = await request.post('/api/mortgage', {
      data: { montante: 5000, entrada_pct: 20, prazo: 30 },
    })
    expect(response.status()).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/mínimo/i)
  })

  test('POST /api/mortgage should reject investment LTV > 75% with 400', async ({ request }) => {
    const response = await request.post('/api/mortgage', {
      data: { montante: 300000, entrada_pct: 5, prazo: 30, uso: 'investimento' },
    })
    expect(response.status()).toBe(400)
  })

  test('POST /api/mortgage should never return 500', async ({ request }) => {
    const response = await request.post('/api/mortgage', {
      data: { montante: 250000, entrada_pct: 25, prazo: 25 },
    })
    expect(response.status()).not.toBe(500)
  })
})
