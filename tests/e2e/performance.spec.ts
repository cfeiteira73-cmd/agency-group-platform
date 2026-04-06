import { test, expect } from '@playwright/test'

test.describe('Performance — Critical Page Load Times', () => {
  test('homepage should load within 5 seconds (domcontentloaded)', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const loadTime = Date.now() - startTime
    expect(loadTime).toBeLessThan(5000)
  })

  test('/imoveis should load within 8 seconds', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/imoveis', { waitUntil: 'domcontentloaded' })
    const loadTime = Date.now() - startTime
    expect(loadTime).toBeLessThan(8000)
  })

  test('/blog should load within 5 seconds', async ({ page }) => {
    const startTime = Date.now()
    await page.goto('/blog', { waitUntil: 'domcontentloaded' })
    const loadTime = Date.now() - startTime
    expect(loadTime).toBeLessThan(5000)
  })

  test('homepage should have no console errors on load', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    // Filter out known third-party errors
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('NEXT_PUBLIC') && !e.includes('hydration')
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('property listing page should not have 4xx/5xx API errors', async ({ page }) => {
    const failedRequests: string[] = []
    page.on('response', (response) => {
      if (response.url().includes('/api/') && response.status() >= 400) {
        failedRequests.push(`${response.status()} ${response.url()}`)
      }
    })
    await page.goto('/imoveis', { waitUntil: 'networkidle' })
    expect(failedRequests).toHaveLength(0)
  })
})
