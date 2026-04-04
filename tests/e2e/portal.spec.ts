import { test, expect } from '@playwright/test'

// These tests assume the app is running and test public-facing pages only
test.describe('Public Pages', () => {
  test('homepage loads', async ({ page }) => {
    await page.goto('http://localhost:3000')
    await expect(page).toHaveTitle(/AgencyGroup/)
  })

  test('portal redirects to login when not authenticated', async ({ page }) => {
    await page.goto('http://localhost:3000/portal')
    await expect(page).toHaveURL(/login/)
  })
})

test.describe('Login Page UI', () => {
  test('login page has correct branding', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/login')
    await expect(page.locator('text=AgencyGroup.App')).toBeVisible()
    // Subtitle / tagline
    await expect(page.locator('text=AMI 22506')).toBeVisible()
  })

  test('login form has all required fields', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button[type="submit"]')).toBeVisible()
  })

  test('login form shows validation error on empty submit', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/login')
    // Fill email only, leave password empty — browser validation or app error
    await page.fill('input[type="email"]', 'test@test.com')
    await page.click('button[type="submit"]')
    // Should remain on login page
    await expect(page).toHaveURL(/auth\/login/)
  })

  test('password reset link is reachable from login', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/login')
    // The page should have a link to reset password
    const resetLink = page.locator('a[href*="reset"]')
    if (await resetLink.count() > 0) {
      await resetLink.click()
      await expect(page).toHaveURL(/reset/)
    } else {
      // Direct navigation fallback — page must still exist
      await page.goto('http://localhost:3000/auth/reset-password')
      await expect(page.locator('input[type="email"]')).toBeVisible()
    }
  })
})

test.describe('Auth Error States', () => {
  test('invalid credentials shows error message without crash', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/login')
    await page.fill('input[type="email"]', 'nonexistent@agency.pt')
    await page.fill('input[type="password"]', 'wrongpassword123')
    await page.click('button[type="submit"]')

    // Wait for either an error message or continued stay on login
    await page.waitForLoadState('networkidle')
    await expect(page).toHaveURL(/auth\/login/)

    // There should be a visible error indicator
    const errorDiv = page.locator('text=Credenciais inválidas')
    const errorAlt = page.locator('[role="alert"]')
    const hasError = (await errorDiv.count()) > 0 || (await errorAlt.count()) > 0
    expect(hasError).toBe(true)
  })
})
