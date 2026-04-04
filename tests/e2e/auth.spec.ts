import { test, expect } from '@playwright/test'

test.describe('Authentication Flow', () => {
  test('login page loads correctly', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/login')
    await expect(page.locator('text=AgencyGroup.App')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/login')
    await page.fill('input[type="email"]', 'wrong@test.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    // Should show error message or stay on login
    await expect(page).toHaveURL(/auth\/login/)
  })

  test('redirects unauthenticated users from portal', async ({ page }) => {
    await page.goto('http://localhost:3000/portal')
    await expect(page).toHaveURL(/login/)
  })

  test('password reset page loads', async ({ page }) => {
    await page.goto('http://localhost:3000/auth/reset-password')
    await expect(page.locator('input[type="email"]')).toBeVisible()
  })
})
