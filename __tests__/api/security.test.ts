import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Security posture: public vs. protected API routes ───────────────────────
//
// The Agency Group portal has two classes of API routes:
//
//   PUBLIC (no auth required):
//     /api/avm         — valuation engine, rate-limited in-memory
//     /api/mortgage    — mortgage calculator
//     /api/radar       — deal intelligence + web scraping
//     /api/rates       — live Euribor / market rates
//     /api/whatsapp/webhook — Meta webhook (verified by WHATSAPP_VERIFY_TOKEN)
//
//   PROTECTED (NextAuth session or API key required):
//     /api/auth/**     — NextAuth endpoints
//     /api/sofia/**    — AI assistant (requires session)
//     /api/notify/**   — push notifications
//     /api/contacts/** — CRM operations
//
// These unit tests verify the BEHAVIOUR of public route handlers by calling
// them directly with mock NextRequest objects — no HTTP server needed.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Helper: build a mock NextRequest ────────────────────────────────────────
function makeRequest(
  method: 'GET' | 'POST',
  url: string,
  body?: unknown,
  headers?: Record<string, string>
): NextRequest {
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
      ...headers,
    },
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  return new NextRequest(url, init)
}

// ─── AVM route — unauthenticated calls succeed ───────────────────────────────

describe('Security — /api/avm (public route)', () => {
  it('rejects oversized area with 400, not 500', async () => {
    // Dynamic import isolates from other tests
    const { POST } = await import('@/app/api/avm/route')

    const req = makeRequest('POST', 'http://localhost:3000/api/avm', {
      zona: 'Lisboa',
      tipo: 'T2',
      area: 99999, // exceeds 50000m² guard
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body).toHaveProperty('error')
  })

  it('returns 200 and valid valuation for a standard Lisboa T2', async () => {
    const { POST } = await import('@/app/api/avm/route')

    const req = makeRequest('POST', 'http://localhost:3000/api/avm', {
      zona:   'Lisboa',
      tipo:   'T2',
      area:   80,
      estado: 'Bom',
      vista:  'Interior',
      epc:    'B-',
    })

    const res = await POST(req)
    expect(res.status).toBe(200)

    const body = await res.json()
    // Response shape: { success, estimativa, rangeMin, rangeMax, pm2, ... }
    expect(body.success).toBe(true)
    expect(typeof body.estimativa).toBe('number')
    expect(body.estimativa).toBeGreaterThan(0)
    expect(typeof body.rangeMin).toBe('number')
    expect(typeof body.rangeMax).toBe('number')
    expect(body.rangeMax).toBeGreaterThan(body.rangeMin)
  })

  it('unknown zona falls back gracefully — no 500', async () => {
    const { POST } = await import('@/app/api/avm/route')

    const req = makeRequest('POST', 'http://localhost:3000/api/avm', {
      zona: 'Lugar Desconhecido XYZ',
      tipo: 'T2',
      area: 60,
    })

    const res = await POST(req)
    // Unknown zones use fallback data — should be 200, not 500
    expect([200]).toContain(res.status)
  })
})

// ─── Mortgage route — unauthenticated calls succeed ──────────────────────────

describe('Security — /api/mortgage (public route)', () => {
  it('returns 400 for montante below minimum', async () => {
    const { POST } = await import('@/app/api/mortgage/route')

    const req = makeRequest('POST', 'http://localhost:3000/api/mortgage', {
      montante:   5000, // below €10,000 minimum
      entrada_pct: 20,
      prazo:      30,
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/mínimo/i)
  })

  it('returns 400 when LTV exceeds 75% for investimento', async () => {
    const { POST } = await import('@/app/api/mortgage/route')

    // 5% down payment on investment: LTV = 95% > 75% max
    const req = makeRequest('POST', 'http://localhost:3000/api/mortgage', {
      montante:    500000,
      entrada_pct: 5,
      prazo:       30,
      uso:         'investimento',
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/LTV/i)
  })

  it('returns 400 for invalid spread value', async () => {
    const { POST } = await import('@/app/api/mortgage/route')

    const req = makeRequest('POST', 'http://localhost:3000/api/mortgage', {
      montante:    300000,
      entrada_pct: 20,
      prazo:       30,
      spread:      15, // above 10% maximum
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/spread/i)
  })

  it('returns 200 with PMT and TAEG for valid habitação própria request', async () => {
    const { POST } = await import('@/app/api/mortgage/route')

    const req = makeRequest('POST', 'http://localhost:3000/api/mortgage', {
      montante:    300000,
      entrada_pct: 20,
      prazo:       30,
      uso:         'habitacao_propria',
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    // Response shape: { success, inputs, resultado: { prestacao_mensal, taeg_pct, ... } }
    expect(body.success).toBe(true)
    expect(body).toHaveProperty('resultado')
    expect(typeof body.resultado.prestacao_mensal).toBe('number')
    expect(body.resultado.prestacao_mensal).toBeGreaterThan(0)
    expect(typeof body.resultado.taeg_pct).toBe('number')
  })
})

// ─── WhatsApp webhook — public but token-protected GET ───────────────────────

describe('Security — /api/whatsapp/webhook (public + token guard)', () => {
  it('GET without correct verify token returns 403', async () => {
    const { GET } = await import('@/app/api/whatsapp/webhook/route')

    const req = makeRequest(
      'GET',
      'http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=WRONG&hub.challenge=abc123'
    )

    const res = await GET(req)
    // Wrong token → Forbidden, not Unauthorized
    expect(res.status).toBe(403)
  })

  it('GET without hub.mode returns 403', async () => {
    const { GET } = await import('@/app/api/whatsapp/webhook/route')

    const req = makeRequest(
      'GET',
      'http://localhost:3000/api/whatsapp/webhook?hub.verify_token=test&hub.challenge=abc'
    )

    const res = await GET(req)
    expect(res.status).toBe(403)
  })

  it('GET never returns 401 — endpoint is public (just token-gated)', async () => {
    const { GET } = await import('@/app/api/whatsapp/webhook/route')

    const req = makeRequest(
      'GET',
      'http://localhost:3000/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=xyz'
    )

    const res = await GET(req)
    expect(res.status).not.toBe(401)
  })
})
