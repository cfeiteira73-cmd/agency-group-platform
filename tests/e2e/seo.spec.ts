import { test, expect } from '@playwright/test'

test.describe('SEO Requirements', () => {
  const CRITICAL_PAGES = [
    { path: '/', name: 'Homepage' },
    { path: '/imoveis', name: 'Property Listings' },
    { path: '/blog', name: 'Blog Index' },
    { path: '/blog/luxury-property-lisbon', name: 'Blog Article EN' },
    { path: '/blog/propriedades-luxo-lisboa-2026', name: 'Blog Article PT' },
  ]

  for (const { path, name } of CRITICAL_PAGES) {
    test(`${name} (${path}) — title should be present and correct length`, async ({ page }) => {
      await page.goto(path)
      const title = await page.title()
      expect(title.length).toBeGreaterThan(10)
      expect(title.length).toBeLessThan(70)
    })

    test(`${name} — meta description should be present`, async ({ page }) => {
      await page.goto(path)
      const desc = await page.locator('meta[name="description"]').getAttribute('content')
      expect(desc).toBeTruthy()
      expect(desc!.length).toBeGreaterThan(50)
      expect(desc!.length).toBeLessThan(165)
    })

    test(`${name} — canonical should use www`, async ({ page }) => {
      await page.goto(path)
      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href')
      if (canonical) {
        expect(canonical).toContain('www.agencygroup.pt')
        expect(canonical).not.toMatch(/^https:\/\/agencygroup\.pt\//) // No bare domain
      }
    })

    test(`${name} — Open Graph tags should be present`, async ({ page }) => {
      await page.goto(path)
      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content')
      expect(ogTitle).toBeTruthy()
    })
  }

  test('robots.txt should allow homepage and block portal', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
    const body = await response.text()
    expect(body.toLowerCase()).toContain('sitemap')
    expect(body).toContain('Disallow: /portal')
  })

  test('sitemap.xml should be accessible and contain URLs', async ({ request }) => {
    const response = await request.get('/sitemap.xml')
    expect(response.status()).toBe(200)
    const body = await response.text()
    expect(body).toContain('agencygroup.pt')
    expect(body).toContain('<url>')
  })
})
