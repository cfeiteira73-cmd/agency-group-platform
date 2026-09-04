import { test, expect } from '@playwright/test'

// Gate A — Critical security and availability contracts
// retries: 0 | continue-on-error: false in CI
// A failure here BLOCKS merge.
// NEVER weaken an assertion to make this gate green.
// NEVER change production auth to satisfy these tests.
// TEST MUST FOLLOW VERIFIED PRODUCT CONTRACT.

const CRON_SECRET = process.env.CRON_SECRET ?? 'placeholder'

test.describe('Gate A — Security Contracts', () => {
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

  test('AVM accepts CRON_SECRET authenticated requests', async ({ request }) => {
    const response = await request.post('/api/avm', {
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
      data: { zona: 'Lisboa', tipo: 'T2', area: 80 },
    })
    expect(response.status()).not.toBe(401)
    expect(response.status()).not.toBe(500)
  })

  test('Mortgage accepts unauthenticated requests', async ({ request }) => {
    const response = await request.post('/api/mortgage', {
      data: { montante: 300000, entrada_pct: 20, prazo: 30 },
    })
    expect(response.status()).toBe(200)
  })
})

test.describe('Gate A — Availability', () => {
  test('Homepage loads with Agency Group branding', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Agency Group/)
  })

  test('Portal redirects to login when unauthenticated', async ({ page }) => {
    await page.goto('/portal')
    await expect(page).toHaveURL(/login/)
  })

  test('sitemap.xml is accessible and contains domain', async ({ request }) => {
    const response = await request.get('/sitemap.xml')
    expect(response.status()).toBe(200)
    const text = await response.text()
    expect(text).toContain('agencygroup.pt')
  })

  test('robots.txt is accessible', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
  })
})
