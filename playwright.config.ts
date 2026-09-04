import { defineConfig, devices } from '@playwright/test'
import { loadEnvConfig } from '@next/env'

// Sync .env.local into the Playwright test runner process so test workers see
// the same CRON_SECRET (and other vars) that the dev/start server sees.
// In CI, .env.local does not exist — this is a no-op and CI-injected vars prevail.
loadEnvConfig(process.cwd())

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['list'],
  ],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    colorScheme: 'light',
    locale: 'pt-PT',
    timezoneId: 'Europe/Lisbon',
  },
  projects: [
    // ── Gate A: critical security + availability contracts ─────────────────────
    // retries: 0 — flakiness in this gate means the feature is broken.
    // A failure here BLOCKS merge.
    {
      name: 'gate-a',
      testMatch: ['**/gate-a.spec.ts'],
      retries: 0,
      use: { ...devices['Desktop Chrome'] },
    },

    // ── Gate B: deterministic product contracts ────────────────────────────────
    // retries: 1 — one retry permitted for timing edge cases only.
    // A failure here BLOCKS merge.
    {
      name: 'gate-b',
      testMatch: ['**/gate-b.spec.ts'],
      retries: 1,
      use: { ...devices['Desktop Chrome'] },
    },

    // ── Gate C: full integration suite (non-blocking) ─────────────────────────
    // Excludes gate-a and gate-b spec files to avoid duplication.
    // continue-on-error: true in CI — failures flag tech debt, not blockers.
    {
      name: 'gate-c',
      testMatch: [
        '**/*.spec.ts',
        '!**/gate-a.spec.ts',
        '!**/gate-b.spec.ts',
      ],
      retries: process.env.CI ? 2 : 0,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'gate-c-mobile',
      testMatch: [
        '**/*.spec.ts',
        '!**/gate-a.spec.ts',
        '!**/gate-b.spec.ts',
      ],
      retries: process.env.CI ? 2 : 0,
      use: { ...devices['Pixel 5'] },
    },
  ],
  // Auto-start server for local runs only; CI downloads the built artifact.
  webServer: process.env.CI ? {
    command: 'pnpm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 60_000,
  } : {
    command: 'pnpm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
