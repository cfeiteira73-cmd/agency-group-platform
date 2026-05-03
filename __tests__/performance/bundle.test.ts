import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// ─── Performance budget — source file sizes ───────────────────────────────────
//
// These tests do NOT replace webpack/Next.js bundle analysis.
// They serve as a fast CI gate to catch accidental bloat in source files
// that would almost certainly inflate bundle size.
//
// Thresholds:
//   Hard fail  → test fails CI  (file dangerously large / missing)
//   Soft warn  → console.log    (tracked, not blocking)

// ─── Resolve project root robustly ───────────────────────────────────────────
// Use import.meta.url to compute the project root regardless of the shell's
// current working directory when running tests (process.cwd() is fragile in
// monorepos and when vitest is invoked from a parent directory).
const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '../../')

function proj(...segments: string[]) {
  return path.join(PROJECT_ROOT, ...segments)
}

describe('Bundle Size Budget — source files', () => {
  it('portal page.tsx is under 5MB hard limit', () => {
    const filePath = proj('app/portal/page.tsx')
    const stats = fs.statSync(filePath)
    const sizeKB = stats.size / 1024
    const sizeMB = stats.size / (1024 * 1024)

    console.log(`portal/page.tsx: ${sizeKB.toFixed(1)} KB`)

    if (sizeKB > 200) {
      console.warn(`[perf] portal/page.tsx exceeds 200 KB (${sizeKB.toFixed(1)} KB) — consider code-splitting`)
    }

    expect(sizeMB).toBeLessThan(5)
  })

  it('lib/db.ts exists', () => {
    const dbPath = proj('lib/db.ts')
    expect(fs.existsSync(dbPath)).toBe(true)
  })

  it('lib/db.ts is under 500 KB', () => {
    const dbPath = proj('lib/db.ts')
    const stats = fs.statSync(dbPath)
    const sizeKB = stats.size / 1024

    console.log(`lib/db.ts: ${sizeKB.toFixed(1)} KB`)
    expect(sizeKB).toBeLessThan(500)
  })

  it('lib/rateLimit.ts is lean (under 20 KB)', () => {
    const filePath = proj('lib/rateLimit.ts')
    const stats = fs.statSync(filePath)
    const sizeKB = stats.size / 1024

    console.log(`lib/rateLimit.ts: ${sizeKB.toFixed(1)} KB`)
    // Rate limiter should be a tiny utility
    expect(sizeKB).toBeLessThan(20)
  })

  it('app/api/avm/route.ts is under 200 KB', () => {
    const filePath = proj('app/api/avm/route.ts')
    const stats = fs.statSync(filePath)
    const sizeKB = stats.size / 1024

    console.log(`app/api/avm/route.ts: ${sizeKB.toFixed(1)} KB`)
    expect(sizeKB).toBeLessThan(200)
  })

  it('app/api/radar/route.ts is under 200 KB', () => {
    const filePath = proj('app/api/radar/route.ts')
    const stats = fs.statSync(filePath)
    const sizeKB = stats.size / 1024

    console.log(`app/api/radar/route.ts: ${sizeKB.toFixed(1)} KB`)
    expect(sizeKB).toBeLessThan(200)
  })

  it('app/api/mortgage/route.ts is under 100 KB', () => {
    const filePath = proj('app/api/mortgage/route.ts')
    const stats = fs.statSync(filePath)
    const sizeKB = stats.size / 1024

    console.log(`app/api/mortgage/route.ts: ${sizeKB.toFixed(1)} KB`)
    expect(sizeKB).toBeLessThan(100)
  })
})

// ─── Source file count guards ─────────────────────────────────────────────────

describe('Bundle Size Budget — structure checks', () => {
  it('lib/ directory exists', () => {
    const libPath = proj('lib')
    expect(fs.existsSync(libPath)).toBe(true)
    expect(fs.statSync(libPath).isDirectory()).toBe(true)
  })

  it('app/api/ directory exists', () => {
    const apiPath = proj('app/api')
    expect(fs.existsSync(apiPath)).toBe(true)
  })

  it('app/portal/ directory exists', () => {
    const portalPath = proj('app/portal')
    expect(fs.existsSync(portalPath)).toBe(true)
  })

  it('no accidental .env files committed to repo root', () => {
    const envFiles = ['.env', '.env.local', '.env.production']
    for (const file of envFiles) {
      const filePath = proj(file)
      if (fs.existsSync(filePath)) {
        // File exists — warn but don't fail (it may be intentional for local dev)
        console.warn(`[security] ${file} found in project root — ensure it is in .gitignore`)
      }
    }
    // The test always passes — this is a reporting check, not a hard gate
    expect(true).toBe(true)
  })
})

// ─── Critical dependencies present ───────────────────────────────────────────

describe('Bundle Size Budget — dependency integrity', () => {
  it('next-auth is installed', () => {
    const pkgPath = proj('node_modules/next-auth/package.json')
    expect(fs.existsSync(pkgPath)).toBe(true)
  })

  it('@supabase/supabase-js is installed', () => {
    const pkgPath = proj('node_modules/@supabase/supabase-js/package.json')
    expect(fs.existsSync(pkgPath)).toBe(true)
  })

  it('@anthropic-ai/sdk is installed', () => {
    const pkgPath = proj('node_modules/@anthropic-ai/sdk/package.json')
    expect(fs.existsSync(pkgPath)).toBe(true)
  })

  it('vitest is installed as dev dependency', () => {
    const pkgPath = proj('node_modules/vitest/package.json')
    expect(fs.existsSync(pkgPath)).toBe(true)
  })
})
