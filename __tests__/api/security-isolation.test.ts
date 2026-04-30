// =============================================================================
// Agency Group — Security Isolation Test Suite
// Tests for: cross-agent isolation, tenant isolation, token security,
// input sanitization, rate-limit patterns, auth bypass prevention
// =============================================================================

import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// safeCompare — timing-safe token comparison (production pattern)
// ---------------------------------------------------------------------------

describe('safeCompare: timing-safe token validation', () => {
  function safeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false
    let result = 0
    for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i)
    return result === 0
  }

  it('valid CRON_SECRET matches itself', () => {
    const s = 'super-secret-cron-2026-agency-group'
    expect(safeCompare(s, s)).toBe(true)
  })

  it('tampered last char returns false', () => {
    expect(safeCompare('Bearer secretA', 'Bearer secretB')).toBe(false)
  })

  it('tampered first char returns false', () => {
    expect(safeCompare('Xearer secret', 'Bearer secret')).toBe(false)
  })

  it('length-extension attack rejected', () => {
    expect(safeCompare('short', 'short-EXTRA')).toBe(false)
  })

  it('empty-vs-empty returns true', () => {
    expect(safeCompare('', '')).toBe(true)
  })

  it('empty-vs-non-empty returns false', () => {
    expect(safeCompare('', 'x')).toBe(false)
  })

  it('null-byte injection does not confuse comparison', () => {
    expect(safeCompare('token\x00A', 'token\x00B')).toBe(false)
    expect(safeCompare('token\x00A', 'token\x00A')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Magic-link token structure
// ---------------------------------------------------------------------------

describe('Magic-link token structure', () => {
  function parseToken(token: string): { valid: boolean; email?: string; expired?: boolean } {
    const dotIdx = token.lastIndexOf('.')
    if (dotIdx === -1) return { valid: false }
    const sig = token.slice(dotIdx + 1)
    if (sig.length !== 64) return { valid: false }  // HMAC-SHA256 hex
    try {
      const payload = token.slice(0, dotIdx)
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString())
      if (typeof data.email !== 'string' || typeof data.exp !== 'number') return { valid: false }
      return { valid: true, email: data.email, expired: Date.now() >= data.exp }
    } catch {
      return { valid: false }
    }
  }

  it('rejects token with no separator', () => {
    expect(parseToken('nodottoken').valid).toBe(false)
  })

  it('rejects token with short sig', () => {
    const payload = Buffer.from(JSON.stringify({ email: 'a@b.com', exp: Date.now() + 1e6 })).toString('base64url')
    expect(parseToken(`${payload}.short`).valid).toBe(false)
  })

  it('valid structure parses correctly', () => {
    const data = { email: 'agent@ag.pt', exp: Date.now() + 3_600_000 }
    const payload = Buffer.from(JSON.stringify(data)).toString('base64url')
    const fakeSig = 'a'.repeat(64)
    const result = parseToken(`${payload}.${fakeSig}`)
    expect(result.valid).toBe(true)
    expect(result.email).toBe('agent@ag.pt')
    expect(result.expired).toBe(false)
  })

  it('detects expired token', () => {
    const data = { email: 'agent@ag.pt', exp: Date.now() - 1000 }
    const payload = Buffer.from(JSON.stringify(data)).toString('base64url')
    const fakeSig = 'a'.repeat(64)
    const result = parseToken(`${payload}.${fakeSig}`)
    expect(result.valid).toBe(true)
    expect(result.expired).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Cross-agent data isolation
// ---------------------------------------------------------------------------

describe('Cross-agent data isolation (RLS pattern)', () => {
  interface Record { id: string; agent_email: string; value: string }

  function agentFilter(records: Record[], email: string, isAdmin: boolean): Record[] {
    if (isAdmin) return records
    return records.filter(r => r.agent_email === email)
  }

  const DATA: Record[] = [
    { id: '1', agent_email: 'alice@ag.pt', value: 'Alice deal' },
    { id: '2', agent_email: 'bob@ag.pt',   value: 'Bob deal' },
    { id: '3', agent_email: 'alice@ag.pt', value: 'Alice contact' },
  ]

  it('alice cannot see bob\'s records', () => {
    const r = agentFilter(DATA, 'alice@ag.pt', false)
    expect(r.every(x => x.agent_email === 'alice@ag.pt')).toBe(true)
    expect(r).toHaveLength(2)
  })

  it('bob cannot see alice\'s records', () => {
    const r = agentFilter(DATA, 'bob@ag.pt', false)
    expect(r.every(x => x.agent_email === 'bob@ag.pt')).toBe(true)
    expect(r).toHaveLength(1)
  })

  it('admin sees all records', () => {
    expect(agentFilter(DATA, 'admin@ag.pt', true)).toHaveLength(3)
  })

  it('attacker email sees nothing', () => {
    expect(agentFilter(DATA, 'attacker@evil.com', false)).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Tenant isolation (SaaS foundation)
// ---------------------------------------------------------------------------

describe('Tenant isolation foundation', () => {
  const DEFAULT_TENANT = '00000000-0000-0000-0000-000000000001'
  const OTHER_TENANT   = '11111111-1111-1111-1111-111111111111'

  function canAccess(recordTenantId: string | null, requestTenantId: string, enforced: boolean): boolean {
    if (!enforced)             return true   // single-agency mode
    if (!recordTenantId)       return true   // legacy data = null = allow
    return recordTenantId === requestTenantId
  }

  it('enforcement OFF: any tenant can access', () => {
    expect(canAccess(OTHER_TENANT, DEFAULT_TENANT, false)).toBe(true)
  })

  it('enforcement ON: own tenant access allowed', () => {
    expect(canAccess(DEFAULT_TENANT, DEFAULT_TENANT, true)).toBe(true)
  })

  it('enforcement ON: cross-tenant access blocked', () => {
    expect(canAccess(DEFAULT_TENANT, OTHER_TENANT, true)).toBe(false)
  })

  it('enforcement ON: null tenant_id (legacy) still accessible', () => {
    expect(canAccess(null, DEFAULT_TENANT, true)).toBe(true)
  })

  it('default tenant UUID is stable', () => {
    expect(DEFAULT_TENANT).toBe('00000000-0000-0000-0000-000000000001')
  })
})

// ---------------------------------------------------------------------------
// Input sanitization / field allowlist
// ---------------------------------------------------------------------------

describe('Field allowlist — injection prevention', () => {
  function sanitize(input: Record<string, unknown>, allowed: string[]): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const k of allowed) { if (k in input) out[k] = input[k] }
    return out
  }

  const DEAL_FIELDS = ['ref', 'imovel', 'valor', 'fase', 'comprador', 'notas', 'agent_id']

  it('strips non-allowed fields', () => {
    const r = sanitize({ imovel: 'Apt', admin: true, injected: 'evil' }, DEAL_FIELDS)
    // Only imovel is in DEAL_FIELDS — admin and injected must be absent
    expect(Object.hasOwn(r, 'admin')).toBe(false)
    expect(Object.hasOwn(r, 'injected')).toBe(false)
    expect(Object.hasOwn(r, 'imovel')).toBe(true)
    expect(Object.keys(r)).toEqual(['imovel'])
  })

  it('passes all allowed fields', () => {
    const input = Object.fromEntries(DEAL_FIELDS.map(k => [k, 'val']))
    expect(Object.keys(sanitize(input, DEAL_FIELDS))).toHaveLength(DEAL_FIELDS.length)
  })

  it('empty input returns empty object', () => {
    expect(sanitize({}, DEAL_FIELDS)).toEqual({})
  })

  it('SQL injection string passes through to parameterized query (Supabase handles it)', () => {
    const r = sanitize({ imovel: "'; DROP TABLE deals; --" }, DEAL_FIELDS)
    // The string is allowed through — Supabase SDK parameterizes it
    expect(r.imovel).toBe("'; DROP TABLE deals; --")
    // This is intentional: sanitization is about field names, not values
    // Supabase's parameterized queries prevent SQL injection on values
  })
})

// ---------------------------------------------------------------------------
// Rate limit window logic
// ---------------------------------------------------------------------------

describe('Rate limit window logic', () => {
  interface RLState { attempts: number; resetAt: number }

  function checkRL(state: RLState | undefined, max: number, windowMs: number) {
    const now = Date.now()
    if (!state || now > state.resetAt) {
      return { ok: true, remaining: max - 1, state: { attempts: 1, resetAt: now + windowMs } }
    }
    if (state.attempts >= max) return { ok: false, remaining: 0, state }
    return { ok: true, remaining: max - state.attempts - 1, state: { ...state, attempts: state.attempts + 1 } }
  }

  it('first request always allowed', () => {
    const r = checkRL(undefined, 5, 60_000)
    expect(r.ok).toBe(true)
    expect(r.remaining).toBe(4)
  })

  it('blocks exactly at max', () => {
    const state: RLState = { attempts: 5, resetAt: Date.now() + 60_000 }
    expect(checkRL(state, 5, 60_000).ok).toBe(false)
  })

  it('resets after window expires', () => {
    const expired: RLState = { attempts: 5, resetAt: Date.now() - 1 }
    const r = checkRL(expired, 5, 60_000)
    expect(r.ok).toBe(true)
    expect(r.state.attempts).toBe(1)
  })

  it('auth route: 5 req / 15 min', () => {
    let s: RLState | undefined
    for (let i = 0; i < 5; i++) {
      const r = checkRL(s, 5, 900_000)
      expect(r.ok).toBe(true)
      s = r.state
    }
    expect(checkRL(s, 5, 900_000).ok).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Authorization header parsing
// ---------------------------------------------------------------------------

describe('Authorization header parsing', () => {
  function extractBearer(header: string | null): string | null {
    if (!header || !header.startsWith('Bearer ')) return null
    const t = header.slice(7).trim()
    return t.length > 0 ? t : null
  }

  it('extracts token', () => {
    expect(extractBearer('Bearer my-token')).toBe('my-token')
  })

  it('null header → null', () => {
    expect(extractBearer(null)).toBeNull()
  })

  it('Basic scheme → null', () => {
    expect(extractBearer('Basic dXNlcjpwYXNz')).toBeNull()
  })

  it('empty Bearer → null', () => {
    expect(extractBearer('Bearer ')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Deal payload validation
// ---------------------------------------------------------------------------

describe('Deal payload validation', () => {
  const VALID_FASES = [
    'Contacto','Qualificado','Visita','Proposta','Negociação','CPCV',
    'Escritura','Angariação','Proposta Enviada','Proposta Aceite',
    'CPCV Assinado','Escritura Marcada','Escritura Concluída','Pós-Venda',
  ]

  function validate(body: Record<string, unknown>): { ok: boolean; error?: string } {
    if (!body.imovel || typeof body.imovel !== 'string') return { ok: false, error: 'imovel required' }
    if (!body.valor  || (typeof body.valor !== 'string' && typeof body.valor !== 'number')) return { ok: false, error: 'valor required' }
    if (!body.fase   || typeof body.fase !== 'string') return { ok: false, error: 'fase required' }
    if (!VALID_FASES.includes(String(body.fase))) return { ok: false, error: `Invalid fase: ${body.fase}` }
    return { ok: true }
  }

  it('rejects missing imovel', () => expect(validate({ valor: '€1M', fase: 'Contacto' }).ok).toBe(false))
  it('rejects missing valor',  () => expect(validate({ imovel: 'A', fase: 'Contacto' }).ok).toBe(false))
  it('rejects invalid fase',   () => expect(validate({ imovel: 'A', valor: '€1M', fase: 'Hacked' }).ok).toBe(false))
  it('accepts valid payload',  () => expect(validate({ imovel: 'Apt T3', valor: '€ 1.250.000', fase: 'Contacto' }).ok).toBe(true))

  it('all valid fases are accepted', () => {
    for (const f of VALID_FASES) {
      expect(validate({ imovel: 'X', valor: '€1M', fase: f }).ok).toBe(true)
    }
  })
})

// ---------------------------------------------------------------------------
// Audit log field computation
// ---------------------------------------------------------------------------

describe('Audit log changed-column detection', () => {
  function changedColumns(before: Record<string, unknown>, after: Record<string, unknown>): string[] {
    const keys = new Set([...Object.keys(before), ...Object.keys(after)])
    const changed: string[] = []
    for (const k of keys) {
      if (JSON.stringify(before[k]) !== JSON.stringify(after[k])) changed.push(k)
    }
    return changed
  }

  it('detects single field change', () => {
    const c = changedColumns({ fase: 'Proposta' }, { fase: 'CPCV' })
    expect(c).toEqual(['fase'])
  })

  it('detects multiple field changes', () => {
    const c = changedColumns(
      { fase: 'Proposta', valor: '€1M' },
      { fase: 'CPCV',     valor: '€950K' }
    )
    expect(c).toContain('fase')
    expect(c).toContain('valor')
  })

  it('no change returns empty array', () => {
    expect(changedColumns({ fase: 'Proposta' }, { fase: 'Proposta' })).toEqual([])
  })

  it('null-to-value is a change', () => {
    const c = changedColumns({ realized_fee: null }, { realized_fee: 50000 })
    expect(c).toContain('realized_fee')
  })

  it('new field added is a change', () => {
    const c = changedColumns({}, { notas: 'new note' })
    expect(c).toContain('notas')
  })
})
