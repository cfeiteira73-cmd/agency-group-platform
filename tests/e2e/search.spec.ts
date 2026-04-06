import { test, expect } from '@playwright/test'

test.describe('AI Property Search API (/api/search)', () => {
  test('GET /api/search health check should return ok', async ({ request }) => {
    const response = await request.get('/api/search')
    // Either 200 ok or 405 if GET is not supported — but never 500
    expect(response.status()).not.toBe(500)
  })

  test('POST /api/search should return results for Portuguese query', async ({ request }) => {
    const response = await request.post('/api/search', {
      data: { query: 'apartamento em Lisboa até €1M', language: 'pt' },
    })
    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('results')
    expect(Array.isArray(data.results)).toBe(true)
  })

  test('POST /api/search should return results for English query', async ({ request }) => {
    const response = await request.post('/api/search', {
      data: { query: 'villa with pool in Cascais', language: 'en' },
    })
    expect(response.status()).toBe(200)
    const data = await response.json()
    expect(data).toHaveProperty('results')
  })

  test('POST /api/search should not crash on minimal payload', async ({ request }) => {
    const response = await request.post('/api/search', {
      data: { query: 'Lisboa' },
    })
    expect([200, 400]).toContain(response.status())
    expect(response.status()).not.toBe(500)
  })
})

test.describe('AI Search — UI smoke tests', () => {
  test('homepage should have a visible search input', async ({ page }) => {
    await page.goto('/')
    const searchInput = page.getByRole('textbox').first()
    await expect(searchInput).toBeVisible()
  })

  test('typing in search input should not crash the page', async ({ page }) => {
    await page.goto('/')
    const searchInput = page.getByRole('textbox').first()
    await searchInput.fill('apartamento Lisboa')
    // No JS errors expected — page should remain functional
    const main = page.getByRole('main')
    await expect(main).toBeVisible()
  })
})
