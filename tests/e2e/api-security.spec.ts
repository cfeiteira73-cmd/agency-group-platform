import { test, expect } from '@playwright/test'

// Security contract tests — reflect ACTUAL production security posture.
// Verified contracts (2026-09-04):
//   AVM  (/api/avm):   isPortalAuth() required → 401 unauthenticated
//   Radar (/api/radar): isPortalAuth() required → 401 unauthenticated
//   Mortgage: public endpoint → 200 unauthenticated
//   WhatsApp webhook: public endpoint → not 401
//
// NEVER change production auth to satisfy old tests.
// NEVER weaken a test to make CI green.
// TEST MUST FOLLOW VERIFIED PRODUCT CONTRACT.

const CRON_SECRET = process.env.CRON_SECRET ?? 'placeholder'

test.describe('API Security — Auth Contracts', () => {
  // ── Protected endpoints — must reject unauthenticated requests ───────────────

  test('AVM rejects unauthenticated requests with 401', async ({ request }) => {
    const response = await request.post('/api/avm', {
      data: { zona: 'Lisboa', tipo: 'T2', area: 80 },
    })
    expect(response.status()).toBe(401)
  })

  test('Radar rejects unauthenticated requests with 401', async ({ request }) => {
    const response = await request.post('/api/radar', {
      data: { url: 'Lisboa T2 100m² 350000€' },
    })
    expect(response.status()).toBe(401)
  })

  // ── Protected endpoints — must accept CRON_SECRET authenticated requests ─────

  test('AVM accepts requests authenticated with CRON_SECRET', async ({ request }) => {
    const response = await request.post('/api/avm', {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
      data: { zona: 'Lisboa', tipo: 'T2', area: 80 },
    })
    expect(response.status()).not.toBe(401)
    expect(response.status()).not.toBe(500)
  })

  // ── Public endpoints — must accept unauthenticated requests ──────────────────

  test('Mortgage accepts unauthenticated requests', async ({ request }) => {
    const response = await request.post('/api/mortgage', {
      data: { montante: 300000, entrada_pct: 20, prazo: 30 },
    })
    expect(response.status()).toBe(200)
  })

  // ── Validation — bad input must return 400, not 500 ──────────────────────────

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

  // ── WhatsApp webhook — public endpoint (no auth) ─────────────────────────────

  test('WhatsApp webhook is public (not 401)', async ({ request }) => {
    const response = await request.get(
      '/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=test&hub.challenge=abc',
    )
    expect(response.status()).not.toBe(401)
    // Wrong verify token → 403 is the correct response
    expect(response.status()).toBe(403)
  })
})
