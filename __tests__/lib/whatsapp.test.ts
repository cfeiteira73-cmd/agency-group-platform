import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ─── Mock fetch globally before importing the module ─────────────────────────
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { sendWhatsApp, templates, type WATextMessage, type WATemplateMessage } from '@/lib/whatsapp/client'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function setEnv(overrides: Record<string, string | undefined>) {
  const original: Record<string, string | undefined> = {}
  for (const [key, value] of Object.entries(overrides)) {
    original[key] = process.env[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  return () => {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('sendWhatsApp — feature flag', () => {
  afterEach(() => {
    delete process.env.WHATSAPP_ACTIVE
    delete process.env.WHATSAPP_PHONE_NUMBER_ID
    delete process.env.WHATSAPP_ACCESS_TOKEN
    mockFetch.mockReset()
  })

  it('returns error when WHATSAPP_ACTIVE is not "true"', async () => {
    const restore = setEnv({ WHATSAPP_ACTIVE: 'false' })
    try {
      const result = await sendWhatsApp({ to: '+351912345678', type: 'text', text: 'test' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('inactivo')
    } finally {
      restore()
    }
  })

  it('returns error when WHATSAPP_ACTIVE is undefined', async () => {
    const restore = setEnv({ WHATSAPP_ACTIVE: undefined })
    try {
      const result = await sendWhatsApp({ to: '+351912345678', type: 'text', text: 'test' })
      expect(result.success).toBe(false)
    } finally {
      restore()
    }
  })
})

describe('sendWhatsApp — missing credentials', () => {
  afterEach(() => {
    delete process.env.WHATSAPP_ACTIVE
    delete process.env.WHATSAPP_PHONE_NUMBER_ID
    delete process.env.WHATSAPP_ACCESS_TOKEN
    mockFetch.mockReset()
  })

  it('returns error when WHATSAPP_PHONE_NUMBER_ID is missing', async () => {
    const restore = setEnv({
      WHATSAPP_ACTIVE: 'true',
      WHATSAPP_PHONE_NUMBER_ID: undefined,
      WHATSAPP_ACCESS_TOKEN: 'some-token',
    })
    try {
      const result = await sendWhatsApp({ to: '+351912345678', type: 'text', text: 'test' })
      expect(result.success).toBe(false)
      expect(result.error).toContain('not configured')
    } finally {
      restore()
    }
  })

  it('returns error when WHATSAPP_ACCESS_TOKEN is missing', async () => {
    const restore = setEnv({
      WHATSAPP_ACTIVE: 'true',
      WHATSAPP_PHONE_NUMBER_ID: '123456789',
      WHATSAPP_ACCESS_TOKEN: undefined,
    })
    try {
      const result = await sendWhatsApp({ to: '+351912345678', type: 'text', text: 'test' })
      expect(result.success).toBe(false)
    } finally {
      restore()
    }
  })
})

describe('sendWhatsApp — phone number normalisation', () => {
  afterEach(() => {
    delete process.env.WHATSAPP_ACTIVE
    delete process.env.WHATSAPP_PHONE_NUMBER_ID
    delete process.env.WHATSAPP_ACCESS_TOKEN
    mockFetch.mockReset()
  })

  function setupActiveWhatsApp() {
    process.env.WHATSAPP_ACTIVE = 'true'
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone-id-123'
    process.env.WHATSAPP_ACCESS_TOKEN = 'access-token-abc'
  }

  it('strips internal spaces from the phone number before sending', async () => {
    setupActiveWhatsApp()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [{ id: 'msg-123' }] }),
    })

    const msg: WATextMessage = { to: '+351 91 234 5678', type: 'text', text: 'hello' }
    await sendWhatsApp(msg)

    expect(mockFetch).toHaveBeenCalledOnce()
    const [, init] = mockFetch.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.to).toBe('+351912345678')
  })

  it('preserves number when it already has no spaces', async () => {
    setupActiveWhatsApp()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [{ id: 'msg-456' }] }),
    })

    const msg: WATextMessage = { to: '351912345678', type: 'text', text: 'hello' }
    await sendWhatsApp(msg)

    const [, init] = mockFetch.mock.calls[0]
    const body = JSON.parse(init.body)
    expect(body.to).toBe('351912345678')
  })
})

describe('sendWhatsApp — API response handling', () => {
  afterEach(() => {
    delete process.env.WHATSAPP_ACTIVE
    delete process.env.WHATSAPP_PHONE_NUMBER_ID
    delete process.env.WHATSAPP_ACCESS_TOKEN
    mockFetch.mockReset()
  })

  function setupActiveWhatsApp() {
    process.env.WHATSAPP_ACTIVE = 'true'
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone-id-123'
    process.env.WHATSAPP_ACCESS_TOKEN = 'access-token-abc'
  }

  it('returns success and messageId on successful API call', async () => {
    setupActiveWhatsApp()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.abc123' }] }),
    })

    const result = await sendWhatsApp({ to: '+351912345678', type: 'text', text: 'test' })
    expect(result.success).toBe(true)
    expect(result.messageId).toBe('wamid.abc123')
  })

  it('returns error on API failure response', async () => {
    setupActiveWhatsApp()
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'Invalid token', code: 190 } }),
    })

    const result = await sendWhatsApp({ to: '+351912345678', type: 'text', text: 'test' })
    expect(result.success).toBe(false)
    expect(result.error).toContain('Invalid token')
  })

  it('returns error when fetch throws', async () => {
    setupActiveWhatsApp()
    mockFetch.mockRejectedValueOnce(new Error('Network failure'))

    const result = await sendWhatsApp({ to: '+351912345678', type: 'text', text: 'test' })
    expect(result.success).toBe(false)
    expect(result.error).toBeTruthy()
  })
})

describe('sendWhatsApp — template message format', () => {
  afterEach(() => {
    delete process.env.WHATSAPP_ACTIVE
    delete process.env.WHATSAPP_PHONE_NUMBER_ID
    delete process.env.WHATSAPP_ACCESS_TOKEN
    mockFetch.mockReset()
  })

  it('sends correct payload shape for template messages', async () => {
    process.env.WHATSAPP_ACTIVE = 'true'
    process.env.WHATSAPP_PHONE_NUMBER_ID = 'phone-id-123'
    process.env.WHATSAPP_ACCESS_TOKEN = 'access-token-abc'

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ messages: [{ id: 'msg-999' }] }),
    })

    const msg: WATemplateMessage = {
      to: '+351912345678',
      type: 'template',
      template: {
        name: 'novo_contacto',
        language: 'pt_PT',
        components: [
          { type: 'body', parameters: [{ type: 'text', text: 'Carlos' }] },
        ],
      },
    }

    await sendWhatsApp(msg)

    const [, init] = mockFetch.mock.calls[0]
    const body = JSON.parse(init.body)

    expect(body.type).toBe('template')
    expect(body.template.name).toBe('novo_contacto')
    expect(body.template.language).toEqual({ code: 'pt_PT' })
    expect(body.template.components).toHaveLength(1)
    expect(body.template.components[0].parameters[0].text).toBe('Carlos')
    expect(body.messaging_product).toBe('whatsapp')
  })
})

describe('templates — pre-built message helpers', () => {
  it('novoContacto includes the name and budget', () => {
    const msg = templates.novoContacto('Ana', 'Lisboa', '€500.000')
    expect(msg).toContain('Ana')
    expect(msg).toContain('€500.000')
    expect(msg).toContain('Agency Group')
  })

  it('novoContacto works without a specific zone', () => {
    const msg = templates.novoContacto('Pedro', '—', '€300.000')
    expect(msg).toContain('em Portugal')
  })

  it('followUp includes the property name', () => {
    const msg = templates.followUp('Maria', 'Apartamento T3 Cascais')
    expect(msg).toContain('Maria')
    expect(msg).toContain('Apartamento T3 Cascais')
  })

  it('visitaConfirmacao includes all placeholders', () => {
    const msg = templates.visitaConfirmacao('João', 'Villa Estoril', '15/04/2026', '14:00')
    expect(msg).toContain('João')
    expect(msg).toContain('Villa Estoril')
    expect(msg).toContain('15/04/2026')
    expect(msg).toContain('14:00')
  })

  it('proposta includes the value', () => {
    const msg = templates.proposta('Luísa', 'Moradia Sintra', '€1.200.000')
    expect(msg).toContain('€1.200.000')
    expect(msg).toContain('Moradia Sintra')
  })

  it('investorPitch includes yield and value', () => {
    const msg = templates.investorPitch('Fund XYZ', 'Prédio Baixa', '7.2%', '2500000')
    expect(msg).toContain('7.2%')
    expect(msg).toContain('2500000')
  })
})
