import { describe, it, expect, vi, beforeEach } from 'vitest'

// We mock the modules that getSession.ts imports
vi.mock('@/auth', () => ({ auth: vi.fn() }))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}))

import { auth } from '@/auth'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { getAnySession, mandateAuthRole } from '@/lib/auth/getSession'
import { createHmac } from 'crypto'

const mockAuth = vi.mocked(auth)
const mockCookies = vi.mocked(cookies)
const mockCreateClient = vi.mocked(createClient)

const SECRET = 'test-secret-32-chars-xxxxxxxxxx'

function makeToken(payload: object, secret = SECRET): string {
  const raw = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(raw).digest('hex')
  return `${raw}.${sig}`
}

function makeMockSupabase(user: Record<string, unknown> | null) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: user, error: null }),
        }),
      }),
    }),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.AUTH_SECRET = SECRET
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
})

// ── mandateAuthRole ────────────────────────────────────────────────────────────

describe('mandateAuthRole', () => {
  it('returns role unchanged for nextauth sessions', () => {
    const session = { user: { id: 'u1', email: 'a@b.com', role: 'admin', name: 'A', authSource: 'nextauth' as const }, expires: '' }
    expect(mandateAuthRole(session)).toBe('admin')
  })

  it('caps magic_link admin to agent', () => {
    const session = { user: { id: 'u1', email: 'a@b.com', role: 'admin', name: 'A', authSource: 'magic_link' as const }, expires: '' }
    expect(mandateAuthRole(session)).toBe('agent')
  })

  it('passes magic_link non-admin through unchanged', () => {
    const session = { user: { id: 'u1', email: 'a@b.com', role: 'agent', name: 'A', authSource: 'magic_link' as const }, expires: '' }
    expect(mandateAuthRole(session)).toBe('agent')
  })

  it('passes nextauth user role through unchanged', () => {
    const session = { user: { id: 'u1', email: 'a@b.com', role: 'user', name: 'A', authSource: 'nextauth' as const }, expires: '' }
    expect(mandateAuthRole(session)).toBe('user')
  })
})

// ── getAnySession — NextAuth path ──────────────────────────────────────────────

describe('getAnySession — NextAuth path', () => {
  it('returns nextauth session when auth() resolves', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'u-nextauth', email: 'n@t.com', name: 'N', role: 'admin' },
      expires: '2099-01-01T00:00:00.000Z',
    } as never)

    const session = await getAnySession()
    expect(session).not.toBeNull()
    expect(session!.user.id).toBe('u-nextauth')
    expect(session!.user.authSource).toBe('nextauth')
  })

  it('returns null when auth() has no user id', async () => {
    mockAuth.mockResolvedValue({ user: null, expires: '' } as never)
    mockCookies.mockResolvedValue({ get: () => undefined } as never)

    const session = await getAnySession()
    expect(session).toBeNull()
  })
})

// ── getAnySession — magic-link path ───────────────────────────────────────────

describe('getAnySession — magic-link path', () => {
  beforeEach(() => {
    // NextAuth returns nothing → fall through to cookie
    mockAuth.mockResolvedValue({ user: null, expires: '' } as never)
  })

  it('returns session for valid token and active user', async () => {
    const exp = Date.now() + 3600_000
    const token = makeToken({ email: 'geral@agencygroup.pt', exp })
    mockCookies.mockResolvedValue({ get: (k: string) => k === 'ag-auth-token' ? { value: token } : undefined } as never)
    mockCreateClient.mockReturnValue(makeMockSupabase({ id: 'u-magic', email: 'geral@agencygroup.pt', role: 'admin', name: 'Geral', is_active: null }) as never)

    const session = await getAnySession()
    expect(session).not.toBeNull()
    expect(session!.user.id).toBe('u-magic')
    expect(session!.user.authSource).toBe('magic_link')
    expect(session!.user.role).toBe('admin')
  })

  it('denies deactivated user (is_active === false)', async () => {
    const exp = Date.now() + 3600_000
    const token = makeToken({ email: 'blocked@agencygroup.pt', exp })
    mockCookies.mockResolvedValue({ get: (k: string) => k === 'ag-auth-token' ? { value: token } : undefined } as never)
    mockCreateClient.mockReturnValue(makeMockSupabase({ id: 'u-blocked', email: 'blocked@agencygroup.pt', role: 'agent', name: 'B', is_active: false }) as never)

    const session = await getAnySession()
    expect(session).toBeNull()
  })

  it('allows user with is_active === null (canonical semantics)', async () => {
    const exp = Date.now() + 3600_000
    const token = makeToken({ email: 'null-active@agencygroup.pt', exp })
    mockCookies.mockResolvedValue({ get: (k: string) => k === 'ag-auth-token' ? { value: token } : undefined } as never)
    mockCreateClient.mockReturnValue(makeMockSupabase({ id: 'u-null', email: 'null-active@agencygroup.pt', role: 'agent', name: 'N', is_active: null }) as never)

    const session = await getAnySession()
    expect(session).not.toBeNull()
    expect(session!.user.id).toBe('u-null')
  })

  it('allows user with is_active === true', async () => {
    const exp = Date.now() + 3600_000
    const token = makeToken({ email: 'active@agencygroup.pt', exp })
    mockCookies.mockResolvedValue({ get: (k: string) => k === 'ag-auth-token' ? { value: token } : undefined } as never)
    mockCreateClient.mockReturnValue(makeMockSupabase({ id: 'u-true', email: 'active@agencygroup.pt', role: 'agent', name: 'A', is_active: true }) as never)

    const session = await getAnySession()
    expect(session).not.toBeNull()
  })

  it('denies expired token', async () => {
    const exp = Date.now() - 1000
    const token = makeToken({ email: 'geral@agencygroup.pt', exp })
    mockCookies.mockResolvedValue({ get: (k: string) => k === 'ag-auth-token' ? { value: token } : undefined } as never)

    const session = await getAnySession()
    expect(session).toBeNull()
  })

  it('denies tampered signature', async () => {
    const exp = Date.now() + 3600_000
    const token = makeToken({ email: 'geral@agencygroup.pt', exp }, 'wrong-secret-xxxxxxxxxxxxxxxxxxx')
    mockCookies.mockResolvedValue({ get: (k: string) => k === 'ag-auth-token' ? { value: token } : undefined } as never)

    const session = await getAnySession()
    expect(session).toBeNull()
  })

  it('denies unknown email (user not in DB)', async () => {
    const exp = Date.now() + 3600_000
    const token = makeToken({ email: 'unknown@evil.com', exp })
    mockCookies.mockResolvedValue({ get: (k: string) => k === 'ag-auth-token' ? { value: token } : undefined } as never)
    mockCreateClient.mockReturnValue(makeMockSupabase(null) as never)

    const session = await getAnySession()
    expect(session).toBeNull()
  })

  it('returns null when no cookie present', async () => {
    mockCookies.mockResolvedValue({ get: () => undefined } as never)

    const session = await getAnySession()
    expect(session).toBeNull()
  })
})
