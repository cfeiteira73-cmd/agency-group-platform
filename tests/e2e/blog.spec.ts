import { test, expect } from '@playwright/test'

const BLOG_ARTICLES = [
  '/blog/luxury-property-lisbon',
  '/blog/buy-property-cascais',
  '/blog/nhr-portugal-2026-guide',
]

test.describe('Blog', () => {
  test('blog index should load with a title', async ({ page }) => {
    await page.goto('/blog')
    await expect(page.getByRole('main')).toBeVisible()
    const title = await page.title()
    expect(title).toMatch(/blog|artigos|Agency Group/i)
  })

  test('blog index should have article links', async ({ page }) => {
    await page.goto('/blog')
    await page.waitForTimeout(500)
    const links = await page.locator('a[href^="/blog/"]').count()
    expect(links).toBeGreaterThan(3)
  })

  for (const slug of BLOG_ARTICLES) {
    test(`${slug} should have a visible h1`, async ({ page }) => {
      await page.goto(slug)
      const h1 = page.getByRole('heading', { level: 1 })
      await expect(h1).toBeVisible()
    })

    test(`${slug} should have a meta description`, async ({ page }) => {
      await page.goto(slug)
      const metaDesc = page.locator('meta[name="description"]')
      const desc = await metaDesc.getAttribute('content')
      expect(desc).toBeTruthy()
    })

    test(`${slug} canonical should use www.agencygroup.pt`, async ({ page }) => {
      await page.goto(slug)
      const canonical = page.locator('link[rel="canonical"]')
      const href = await canonical.getAttribute('href')
      if (href) {
        expect(href).toContain('www.agencygroup.pt')
      }
    })
  }

  test('blog articles should have JSON-LD structured data', async ({ page }) => {
    await page.goto('/blog/luxury-property-lisbon')

    const jsonLd = page.locator('script[type="application/ld+json"]')
    const count = await jsonLd.count()
    expect(count).toBeGreaterThan(0)

    // Parse and validate the first schema
    const firstScript = await jsonLd.first().textContent()
    if (firstScript) {
      const data = JSON.parse(firstScript)
      expect(data['@context']).toBe('https://schema.org')
    }
  })
})
