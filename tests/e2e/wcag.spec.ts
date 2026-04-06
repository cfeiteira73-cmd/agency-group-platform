import { test, expect } from '@playwright/test'

test.describe('WCAG Accessibility', () => {
  const PAGES = ['/', '/blog', '/imoveis']

  for (const path of PAGES) {
    test(`${path} should have at least one h1`, async ({ page }) => {
      await page.goto(path)
      const h1s = await page.locator('h1').count()
      expect(h1s).toBeGreaterThanOrEqual(1)
    })

    test(`${path} should have lang attribute on html element`, async ({ page }) => {
      await page.goto(path)
      const lang = await page.locator('html').getAttribute('lang')
      expect(lang).toBeTruthy()
      expect(lang).toMatch(/^pt|^en|^fr/)
    })

    test(`${path} images should have alt text`, async ({ page }) => {
      await page.goto(path)
      const imagesWithoutAlt = await page.locator('img:not([alt])').count()
      expect(imagesWithoutAlt).toBe(0)
    })

    test(`${path} buttons should have accessible names`, async ({ page }) => {
      await page.goto(path)

      const buttons = page.locator('button')
      const count = await buttons.count()

      for (let i = 0; i < Math.min(count, 10); i++) {
        const btn = buttons.nth(i)
        const text = await btn.textContent()
        const ariaLabel = await btn.getAttribute('aria-label')
        const ariaLabelledBy = await btn.getAttribute('aria-labelledby')

        const hasName = (text && text.trim().length > 0) || ariaLabel || ariaLabelledBy
        expect(hasName).toBeTruthy()
      }
    })

    test(`${path} should have a main landmark`, async ({ page }) => {
      await page.goto(path)
      const main = page.getByRole('main')
      await expect(main).toBeVisible()
    })
  }

  test('focus should be visible on interactive elements after Tab', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => document.activeElement?.tagName)
    expect(focused).toBeTruthy()
    expect(focused).not.toBe('BODY')
  })
})
