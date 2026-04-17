'use client'

// =============================================================================
// ConciergeIntakeForm — intake form for /concierge-estrangeiros
// POSTs to /api/leads with source: 'concierge_intake'
// =============================================================================

import { useState, FormEvent } from 'react'

const SERVICES = [
  'AVM — Avaliação de imóvel',
  'NIF + Conta bancária',
  'Imóveis off-market',
  'Due Diligence jurídica',
  'IFICI / benefícios fiscais',
  'Financiamento bancário',
  'Gestão pós-compra',
  'Serviço completo (full concierge)',
]

const BUDGETS = [
  'Até €500.000',
  '€500.000 – €1.000.000',
  '€1.000.000 – €2.000.000',
  '€2.000.000 – €5.000.000',
  'Acima de €5.000.000',
]

const TIMELINES = [
  'Imediato (1–3 meses)',
  'Curto prazo (3–6 meses)',
  'Médio prazo (6–12 meses)',
  'Apenas a explorar por agora',
]

export default function ConciergeIntakeForm() {
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('loading')
    setErrorMsg('')

    const form = e.currentTarget
    const budget   = (form.elements.namedItem('budget')   as HTMLSelectElement).value
    const service  = (form.elements.namedItem('service')  as HTMLSelectElement).value
    const timeline = (form.elements.namedItem('timeline') as HTMLSelectElement).value

    const data = {
      name:        (form.elements.namedItem('name')    as HTMLInputElement).value.trim(),
      email:       (form.elements.namedItem('email')   as HTMLInputElement).value.trim(),
      phone:       (form.elements.namedItem('phone')   as HTMLInputElement).value.trim(),
      nationality: (form.elements.namedItem('country') as HTMLInputElement).value.trim(),
      timeline,
      message:     [budget && `Orçamento: ${budget}`, service && `Serviço: ${service}`].filter(Boolean).join(' | '),
      source:      'concierge_intake',
      intent:      'buyer' as const,
    }

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error('server_error')
      setState('success')
    } catch {
      setState('error')
      setErrorMsg('Algo correu mal. Tente novamente ou contacte-nos via WhatsApp.')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '0.88rem',
    fontWeight: 300,
    color: '#f4f0e6',
    backgroundColor: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(201,169,110,0.25)',
    borderRadius: '3px',
    outline: 'none',
    boxSizing: 'border-box',
    appearance: 'none',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: 'var(--font-dm-mono), monospace',
    fontSize: '0.58rem',
    letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
    color: 'rgba(201,169,110,0.8)',
    marginBottom: '6px',
  }

  if (state === 'success') {
    return (
      <div
        style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(201,169,110,0.3)',
          borderRadius: '8px',
          padding: '48px 32px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '2.4rem', marginBottom: '20px' }}>✓</div>
        <h3
          style={{
            fontFamily: 'var(--font-cormorant), serif',
            fontSize: '1.8rem',
            fontWeight: 300,
            color: '#f4f0e6',
            marginBottom: '16px',
          }}
        >
          Briefing recebido.
        </h3>
        <p
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontSize: '0.9rem',
            fontWeight: 300,
            color: '#c8bfad',
            lineHeight: 1.7,
            marginBottom: '28px',
          }}
        >
          Respondemos em 24 horas com um plano personalizado.
          Entretanto pode contactar-nos directamente.
        </p>
        <a
          href="https://wa.me/351919948986?text=Acabei%20de%20preencher%20o%20formulário%20Concierge%20no%20site"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#25d366',
            color: '#ffffff',
            fontFamily: 'var(--font-dm-mono), monospace',
            fontSize: '0.72rem',
            fontWeight: 500,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            textDecoration: 'none',
            padding: '14px 24px',
            borderRadius: '3px',
          }}
        >
          <span aria-hidden="true">💬</span> WhatsApp — Falar Agora
        </a>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
          gap: '16px',
          marginBottom: '16px',
        }}
      >
        {/* Nome */}
        <div>
          <label htmlFor="ci-name" style={labelStyle}>Nome *</label>
          <input
            id="ci-name"
            name="name"
            type="text"
            required
            placeholder="James Mitchell"
            style={inputStyle}
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="ci-email" style={labelStyle}>Email *</label>
          <input
            id="ci-email"
            name="email"
            type="email"
            required
            placeholder="james@email.com"
            style={inputStyle}
          />
        </div>

        {/* Telefone */}
        <div>
          <label htmlFor="ci-phone" style={labelStyle}>Telefone / WhatsApp</label>
          <input
            id="ci-phone"
            name="phone"
            type="tel"
            placeholder="+1 555 000 0000"
            style={inputStyle}
          />
        </div>

        {/* País */}
        <div>
          <label htmlFor="ci-country" style={labelStyle}>País de Residência</label>
          <input
            id="ci-country"
            name="country"
            type="text"
            placeholder="United States"
            style={inputStyle}
          />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {/* Orçamento */}
        <div>
          <label htmlFor="ci-budget" style={labelStyle}>Orçamento</label>
          <select id="ci-budget" name="budget" style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">— Seleccionar —</option>
            {BUDGETS.map((b) => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>

        {/* Prazo */}
        <div>
          <label htmlFor="ci-timeline" style={labelStyle}>Prazo</label>
          <select id="ci-timeline" name="timeline" style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">— Seleccionar —</option>
            {TIMELINES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {/* Serviço */}
        <div style={{ gridColumn: 'span 1' }}>
          <label htmlFor="ci-service" style={labelStyle}>Serviço pretendido</label>
          <select id="ci-service" name="service" style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">— Seleccionar —</option>
            {SERVICES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {state === 'error' && (
        <p
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontSize: '0.84rem',
            color: '#f87171',
            marginBottom: '16px',
          }}
        >
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'loading'}
        style={{
          width: '100%',
          padding: '16px 32px',
          backgroundColor: state === 'loading' ? 'rgba(201,169,110,0.5)' : '#c9a96e',
          color: '#0c1f15',
          fontFamily: 'var(--font-dm-mono), monospace',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          border: 'none',
          borderRadius: '3px',
          cursor: state === 'loading' ? 'not-allowed' : 'pointer',
          transition: 'opacity 0.2s',
        }}
      >
        {state === 'loading' ? 'A enviar…' : 'Solicitar Briefing Personalizado →'}
      </button>

      <p
        style={{
          fontFamily: 'var(--font-dm-mono), monospace',
          fontSize: '0.58rem',
          letterSpacing: '0.08em',
          color: 'rgba(200,191,173,0.4)',
          textAlign: 'center',
          marginTop: '14px',
        }}
      >
        Confidencial · Sem compromisso · Resposta em 24h
      </p>
    </form>
  )
}
