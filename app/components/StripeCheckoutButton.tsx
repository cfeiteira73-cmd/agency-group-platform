'use client'

import { useState } from 'react'
import type { PlanKey } from '@/lib/stripe'

interface Props {
  plan: PlanKey
  label?: string
  style?: React.CSSProperties
  className?: string
  email?: string
  name?: string
}

export default function StripeCheckoutButton({ plan, label = 'Subscrever Agora', style, className, email: initialEmail, name: initialName }: Props) {
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [email, setEmail] = useState(initialEmail || '')
  const [name, setName] = useState(initialName || '')
  const [error, setError] = useState('')

  const handleCheckout = async () => {
    if (!email) { setShowForm(true); return }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, email, name }),
      })

      const data = await res.json()

      if (!res.ok || !data.url) {
        setError(data.error || 'Erro ao iniciar checkout')
        setLoading(false)
        return
      }

      window.location.href = data.url
    } catch {
      setError('Erro de ligação. Tenta novamente.')
      setLoading(false)
    }
  }

  const defaultStyle: React.CSSProperties = {
    background: '#d4af37',
    color: '#0c1f15',
    border: 'none',
    borderRadius: '6px',
    padding: '0.875rem 2rem',
    fontWeight: 700,
    fontSize: '0.95rem',
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.7 : 1,
    transition: 'all 0.2s',
    width: '100%',
    ...style,
  }

  if (showForm && !initialEmail) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <input
          type="text"
          placeholder="Nome"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(212,175,55,0.3)',
            borderRadius: '6px',
            padding: '0.75rem 1rem',
            color: '#e8e0d0',
            fontSize: '0.95rem',
            width: '100%',
            outline: 'none',
          }}
        />
        <input
          type="email"
          placeholder="Email *"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={{
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(212,175,55,0.3)',
            borderRadius: '6px',
            padding: '0.75rem 1rem',
            color: '#e8e0d0',
            fontSize: '0.95rem',
            width: '100%',
            outline: 'none',
          }}
        />
        {error && <p style={{ color: '#ff6b6b', fontSize: '0.85rem', margin: 0 }}>{error}</p>}
        <button
          type="button"
          onClick={handleCheckout}
          disabled={loading || !email}
          style={{ ...defaultStyle, opacity: loading || !email ? 0.6 : 1 }}
          className={className}
        >
          {loading ? 'A redirecionar...' : 'Continuar para Pagamento →'}
        </button>
        <p style={{ color: 'rgba(232,224,208,0.5)', fontSize: '0.75rem', textAlign: 'center', margin: 0 }}>
          🔒 Pagamento seguro via Stripe · Cancela quando quiseres
        </p>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleCheckout}
        disabled={loading}
        style={defaultStyle}
        className={className}
      >
        {loading ? 'A processar...' : label}
      </button>
      {error && <p style={{ color: '#ff6b6b', fontSize: '0.85rem', margin: '0.5rem 0 0' }}>{error}</p>}
    </div>
  )
}
