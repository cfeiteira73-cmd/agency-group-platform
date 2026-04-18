'use client'
import { useState, useEffect, type FormEvent } from 'react'

export default function PortalLogin() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  // Handle magic link token — /api/auth/verify sets the ag-auth-token cookie on success
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')
    if (!token) return

    fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`, {
      headers: { 'Accept': 'application/json' },
    })
      .then(r => r.json())
      .then(data => {
        if (data.ok && data.email) {
          // Also persist to localStorage for the portal page's client-side auth check
          localStorage.setItem('ag_auth', JSON.stringify({
            v: '1',
            exp: Date.now() + 8 * 60 * 60 * 1000,
            email: data.email,
            token,
          }))
          // Redirect to /portal without the token — the cookie set by /api/auth/verify
          // will allow proxy.ts to pass the request through
          window.location.href = '/portal'
        } else {
          setError('Link inválido ou expirado.')
        }
      })
      .catch(() => setError('Erro de rede. Tenta novamente.'))
  }, [])

  async function handleLogin(e: FormEvent) {
    e.preventDefault()
    if (!email || !email.includes('@')) { setError('Introduz um email válido.'); return }
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()
      if (data.ok) {
        setSent(true)
      } else {
        setError(data.error || 'Erro no envio. Tenta novamente.')
      }
    } catch {
      setError('Erro de rede. Tenta novamente.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0c1f15',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
      fontFamily: "'Jost', sans-serif",
    }}>
      <div style={{
        background: '#0e2518',
        border: '1px solid rgba(201,169,110,.18)',
        padding: '52px 44px',
        maxWidth: '420px',
        width: '100%',
        boxShadow: '0 40px 100px rgba(0,0,0,.5)',
      }}>
        {/* Logo */}
        <div style={{
          fontFamily: "'DM Mono', monospace",
          fontSize: '.52rem',
          letterSpacing: '.28em',
          textTransform: 'uppercase',
          color: 'rgba(201,169,110,.55)',
          marginBottom: '8px',
        }}>
          Acesso Restrito · AMI 22506
        </div>
        <h1 style={{
          fontFamily: "'Cormorant', serif",
          fontWeight: 300,
          fontSize: '1.9rem',
          color: '#f4f0e6',
          lineHeight: 1.1,
          marginBottom: '28px',
        }}>
          Portal do<br/>
          <em style={{ fontStyle: 'italic', color: '#c9a96e' }}>Consultor</em>
        </h1>

        {!sent ? (
          <form onSubmit={handleLogin}>
            <p style={{ fontSize: '.8rem', color: 'rgba(244,240,230,.4)', lineHeight: 1.75, marginBottom: '24px' }}>
              Introduz o teu email profissional. Receberás um link de acesso imediato.
            </p>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@agencygroup.pt"
              autoFocus
              style={{
                width: '100%',
                background: 'rgba(244,240,230,.05)',
                border: '1px solid rgba(244,240,230,.12)',
                borderBottom: '1px solid rgba(201,169,110,.3)',
                color: '#f4f0e6',
                padding: '13px 14px',
                fontSize: '.88rem',
                fontFamily: "'Jost', sans-serif",
                outline: 'none',
                marginBottom: '12px',
                boxSizing: 'border-box',
                letterSpacing: '.02em',
              }}
            />
            {error && (
              <p style={{ color: '#e57373', fontSize: '.75rem', marginBottom: '12px' }}>{error}</p>
            )}
            <button
              type="submit"
              disabled={sending}
              style={{
                width: '100%',
                background: sending ? 'rgba(201,169,110,.5)' : '#c9a96e',
                color: '#0c1f15',
                border: 'none',
                padding: '14px',
                fontFamily: "'Jost', sans-serif",
                fontSize: '.6rem',
                fontWeight: 600,
                letterSpacing: '.2em',
                textTransform: 'uppercase',
                cursor: sending ? 'not-allowed' : 'pointer',
                transition: 'background .25s',
              }}
            >
              {sending ? 'A enviar...' : 'Entrar →'}
            </button>
          </form>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{
              width: '52px', height: '52px', borderRadius: '50%',
              background: 'rgba(28,74,53,.4)', border: '1px solid rgba(28,74,53,.8)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: '1.2rem',
            }}>✓</div>
            <p style={{ fontSize: '.88rem', color: 'rgba(244,240,230,.7)', lineHeight: 1.75, marginBottom: '8px' }}>
              Link enviado para<br/>
              <strong style={{ color: '#c9a96e' }}>{email}</strong>
            </p>
            <p style={{ fontSize: '.75rem', color: 'rgba(244,240,230,.35)', lineHeight: 1.65 }}>
              Verifica o teu email e clica no link para aceder ao portal.
            </p>
          </div>
        )}

        <div style={{
          marginTop: '28px',
          paddingTop: '16px',
          borderTop: '1px solid rgba(244,240,230,.05)',
          fontFamily: "'DM Mono', monospace",
          fontSize: '.52rem',
          color: 'rgba(244,240,230,.18)',
          letterSpacing: '.1em',
          textTransform: 'uppercase',
        }}>
          Agency Group · Mediação Imobiliária Lda · AMI 22506
        </div>
      </div>
    </div>
  )
}
