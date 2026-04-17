'use client'

// =============================================================================
// InvestorLeadForm — inline lead capture for /investor-intelligence
// Free tier: POSTs to /api/leads (lead capture only)
// Intelligence / Elite tiers: captures name+email then redirects to Stripe Checkout
// =============================================================================

import { useState, FormEvent } from 'react'

interface Props {
  tier: 'Free' | 'Intelligence' | 'Elite'
  ctaLabel: string
  ctaStyle: 'outline' | 'gold' | 'dark'
  highlight?: boolean
}

const STRIPE_PLAN_MAP: Record<string, 'intelligence' | 'elite'> = {
  Intelligence: 'intelligence',
  Elite: 'elite',
}

export default function InvestorLeadForm({ tier, ctaLabel, ctaStyle, highlight = false }: Props) {
  const [open, setOpen]   = useState(false)
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const isPaidTier = tier === 'Intelligence' || tier === 'Elite'

  const btnColors: React.CSSProperties =
    ctaStyle === 'gold'
      ? { backgroundColor: '#c9a96e', color: '#0c1f15' }
      : ctaStyle === 'dark'
        ? { backgroundColor: '#1c4a35', color: '#f4f0e6' }
        : { backgroundColor: 'transparent', color: highlight ? '#f4f0e6' : '#0c1f15', border: '1.5px solid #c9a96e' }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setState('loading')
    setErrorMsg('')

    const form = e.currentTarget
    const name  = (form.elements.namedItem('name')    as HTMLInputElement).value.trim()
    const email = (form.elements.namedItem('email')   as HTMLInputElement).value.trim()
    const country = (form.elements.namedItem('country') as HTMLInputElement).value.trim()

    // Paid tiers → Stripe Checkout (also save lead first)
    if (isPaidTier) {
      try {
        // Fire-and-forget lead capture
        fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            nationality: country,
            source: 'investor_intelligence',
            intent: 'investor' as const,
            message: `Plano: ${tier}`,
          }),
        }).catch(() => {/* non-blocking */})

        // Redirect to Stripe
        const res = await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ plan: STRIPE_PLAN_MAP[tier], email, name }),
        })
        const data = await res.json()

        if (!res.ok || !data.url) {
          throw new Error(data.error || 'Erro ao iniciar checkout')
        }

        window.location.href = data.url
        return
      } catch (err) {
        setState('error')
        setErrorMsg(err instanceof Error ? err.message : 'Erro ao redirecionar para pagamento.')
        return
      }
    }

    // Free tier → lead capture only
    const data = {
      name,
      email,
      nationality: country,
      source:      'investor_intelligence',
      intent:      'investor' as const,
      message:     `Plano: ${tier}`,
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
      setErrorMsg('Erro ao enviar. Tente novamente.')
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '0.84rem',
    fontWeight: 300,
    color: '#0c1f15',
    backgroundColor: '#ffffff',
    border: '1px solid #d4cdc4',
    borderRadius: '3px',
    outline: 'none',
    boxSizing: 'border-box',
    marginBottom: '10px',
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'center',
          fontFamily: 'var(--font-dm-mono), monospace',
          fontSize: '0.72rem',
          fontWeight: 500,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          padding: '14px 24px',
          borderRadius: '3px',
          cursor: 'pointer',
          transition: 'opacity 0.15s',
          ...btnColors,
        }}
      >
        {ctaLabel}
      </button>
    )
  }

  if (state === 'success') {
    return (
      <div
        style={{
          backgroundColor: 'rgba(28,74,53,0.08)',
          border: '1px solid rgba(28,74,53,0.2)',
          borderRadius: '6px',
          padding: '20px',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-cormorant), serif',
            fontSize: '1.1rem',
            fontWeight: 400,
            color: '#1c4a35',
            marginBottom: '8px',
          }}
        >
          ✓ Recebemos o seu pedido
        </p>
        <p
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontSize: '0.8rem',
            fontWeight: 300,
            color: '#7a6f5e',
          }}
        >
          Respondemos com as instruções de acesso em 24h.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <input
        name="name"
        type="text"
        required
        placeholder="Nome"
        style={inputStyle}
        aria-label="Nome"
      />
      <input
        name="email"
        type="email"
        required
        placeholder="Email"
        style={inputStyle}
        aria-label="Email"
      />
      <input
        name="country"
        type="text"
        placeholder="País"
        style={{ ...inputStyle, marginBottom: '14px' }}
        aria-label="País de residência"
      />

      {state === 'error' && (
        <p
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontSize: '0.8rem',
            color: '#dc2626',
            marginBottom: '10px',
          }}
        >
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'loading'}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'center',
          fontFamily: 'var(--font-dm-mono), monospace',
          fontSize: '0.72rem',
          fontWeight: 600,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          padding: '14px 24px',
          borderRadius: '3px',
          cursor: state === 'loading' ? 'not-allowed' : 'pointer',
          border: 'none',
          backgroundColor: '#c9a96e',
          color: '#0c1f15',
          opacity: state === 'loading' ? 0.6 : 1,
        }}
      >
        {state === 'loading'
          ? (isPaidTier ? 'A redirecionar…' : 'A enviar…')
          : (isPaidTier ? `Continuar para Pagamento →` : `Activar ${tier} →`)
        }
      </button>

      <button
        type="button"
        onClick={() => setOpen(false)}
        style={{
          display: 'block',
          width: '100%',
          marginTop: '8px',
          background: 'none',
          border: 'none',
          fontFamily: 'var(--font-dm-mono), monospace',
          fontSize: '0.58rem',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: '#9a8e7e',
          cursor: 'pointer',
          padding: '4px',
        }}
      >
        Cancelar
      </button>
    </form>
  )
}
