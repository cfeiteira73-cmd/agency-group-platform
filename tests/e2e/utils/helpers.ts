import { Page } from '@playwright/test'

export async function waitForHydration(page: Page) {
  await page.waitForFunction(() => {
    return document.readyState === 'complete' &&
           !document.querySelector('[data-loading]')
  }, { timeout: 5000 }).catch(() => {
    // Ignore timeout — not critical
  })
}

export async function getMetaContent(page: Page, name: string): Promise<string | null> {
  return page.locator(`meta[name="${name}"]`).getAttribute('content').catch(() => null)
}

export async function getOgContent(page: Page, property: string): Promise<string | null> {
  return page.locator(`meta[property="og:${property}"]`).getAttribute('content').catch(() => null)
}

export async function checkJsonLd(page: Page): Promise<object[]> {
  const scripts = await page.locator('script[type="application/ld+json"]').all()
  const data = []
  for (const script of scripts) {
    try {
      const text = await script.textContent()
      if (text) data.push(JSON.parse(text))
    } catch { /* ignore parse errors */ }
  }
  return data
}
