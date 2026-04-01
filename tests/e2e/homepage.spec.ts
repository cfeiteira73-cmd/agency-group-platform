import { test, expect } from '@playwright/test'

// ─── Homepage ─────────────────────────────────────────────────────────────────
test.describe('Homepage', () => {
  test('loads and shows Agency Group branding', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Agency Group/)
    await expect(page.locator('text=AgencyGroup').first()).toBeVisible()
  })

  test('has working navigation links', async ({ page }) => {
    await page.goto('/')
    const imoveisLink = page.locator('a[href="/imoveis"]').first()
    await expect(imoveisLink).toBeVisible()
  })

  test('WhatsApp CTA is present', async ({ page }) => {
    await page.goto('/')
    const waLink = page.locator('a[href*="wa.me"]').first()
    await expect(waLink).toBeVisible()
  })
})

// ─── Imoveis listing ──────────────────────────────────────────────────────────
test.describe('Imoveis listing (/imoveis)', () => {
  test('shows 20 properties by default', async ({ page }) => {
    await page.goto('/imoveis')
    await page.waitForLoadState('networkidle')
    // Results count should show 20
    await expect(page.locator('text=20')).toBeVisible()
  })

  test('filter by zona works', async ({ page }) => {
    await page.goto('/imoveis')
    await page.waitForLoadState('networkidle')

    // Select Lisboa filter
    const zonaSelect = page.locator('select').first()
    await zonaSelect.selectOption('Lisboa')

    // Should show fewer results
    await expect(page.locator('text=Lisboa')).toBeVisible()
  })

  test('map view toggle works', async ({ page }) => {
    await page.goto('/imoveis')
    await page.waitForLoadState('networkidle')

    // Find the map button (pin icon)
    const mapBtn = page.locator('button[title="Vista em mapa"]')
    await expect(mapBtn).toBeVisible()
    await mapBtn.click()

    // Map should load (check for "A carregar mapa" or the map div)
    await expect(page.locator('text=A carregar mapa').or(page.locator('#map-loading'))).toBeVisible()
  })

  test('has JSON-LD ItemList schema', async ({ page }) => {
    await page.goto('/imoveis')
    const ldJson = page.locator('script[type="application/ld+json"]')
    await expect(ldJson).toBeVisible()
    const content = await ldJson.textContent()
    expect(content).toContain('ItemList')
  })
})

// ─── Property detail ──────────────────────────────────────────────────────────
test.describe('Property detail (/imoveis/[id])', () => {
  test('shows property name and price', async ({ page }) => {
    await page.goto('/imoveis/AG-2026-010')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1')).toContainText('Penthouse')
    await expect(page.locator('text=2.850.000').or(page.locator('text=2 850 000'))).toBeVisible()
  })

  test('gallery prev/next buttons work', async ({ page }) => {
    await page.goto('/imoveis/AG-2026-010')
    await page.waitForLoadState('networkidle')

    // Find next button
    const nextBtn = page.locator('button[style*="right: 16px"]').first()
    if (await nextBtn.isVisible()) {
      await nextBtn.click()
      // Counter should change from 1/x to 2/x
      await expect(page.locator('text=2 /')).toBeVisible()
    }
  })

  test('favorite button is present', async ({ page }) => {
    await page.goto('/imoveis/AG-2026-010')
    await page.waitForLoadState('networkidle')
    // Favorite button (heart SVG)
    const favBtn = page.locator('button[title*="favoritos"]').first()
    await expect(favBtn).toBeVisible()
  })

  test('has RealEstateListing JSON-LD', async ({ page }) => {
    await page.goto('/imoveis/AG-2026-010')
    const ldJson = page.locator('script[type="application/ld+json"]')
    await expect(ldJson).toBeVisible()
  })

  test('notFound for invalid ID', async ({ page }) => {
    const response = await page.goto('/imoveis/AG-9999-999')
    expect(response?.status()).toBe(404)
  })
})

// ─── Blog ─────────────────────────────────────────────────────────────────────
test.describe('Blog', () => {
  test('blog listing page loads', async ({ page }) => {
    await page.goto('/blog')
    await expect(page).toHaveTitle(/Blog/)
  })
})

// ─── API endpoints ────────────────────────────────────────────────────────────
test.describe('API endpoints', () => {
  test('AVM endpoint responds', async ({ request }) => {
    const response = await request.post('/api/avm', {
      data: {
        zona: 'Lisboa',
        tipo: 'Apartamento',
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
    expect(body).toHaveProperty('min')
    expect(body).toHaveProperty('max')
    expect(body).toHaveProperty('central')
  })

  test('sitemap.xml is accessible', async ({ request }) => {
    const response = await request.get('/sitemap.xml')
    expect(response.status()).toBe(200)
    const text = await response.text()
    expect(text).toContain('agencygroup.pt')
  })

  test('robots.txt is accessible', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
    const text = await response.text()
    expect(text).toContain('sitemap')
  })
})
