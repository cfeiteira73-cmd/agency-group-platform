'use client'

import { signIn } from 'next-auth/react'
import { useState, Suspense, type CSSProperties, type FormEvent } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function LoginForm() {
  const [step, setStep] = useState<'credentials' | 'totp'>('credentials')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [totp, setTotp] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/portal'

  async function handleCredentials(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/check-2fa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (data.has2FA) {
        setStep('totp')
        setLoading(false)
        return
      }

      await submitLogin()
    } catch {
      setError('Erro de ligação. Tente novamente.')
      setLoading(false)
    }
  }

  async function submitLogin(e?: FormEvent) {
    if (e) e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const result = await signIn('credentials', {
        email,
        password,
        totp,
        redirect: false,
      })

      if (result?.error) {
        setError('Credenciais inválidas. Verifique o email, password e código 2FA.')
        setStep('credentials')
      } else {
        router.push(callbackUrl)
        router.refresh()
      }
    } catch {
      setError('Erro inesperado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setLoading(true)
    setError('')
    try {
      await signIn('google', { callbackUrl })
    } catch {
      setError('Erro ao iniciar sessão com Google.')
      setLoading(false)
    }
  }

  const inputStyle: CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(201,169,110,0.25)',
    borderRadius: '8px',
    color: '#f5f0e8',
    fontSize: '15px',
    fontFamily: "'Jost', sans-serif",
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  }

  const labelStyle: CSSProperties = {
    display: 'block',
    fontSize: '11px',
    fontFamily: "'DM Mono', monospace",
    letterSpacing: '0.12em',
    color: '#c9a96e',
    marginBottom: '8px',
    textTransform: 'uppercase',
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a1a0f 0%, #0c1f15 50%, #0f2a1a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Jost', sans-serif",
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background texture */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `radial-gradient(ellipse at 20% 50%, rgba(201,169,110,0.04) 0%, transparent 60%),
                          radial-gradient(ellipse at 80% 20%, rgba(28,74,53,0.2) 0%, transparent 50%)`,
        pointerEvents: 'none',
      }} />

      {/* Grid pattern */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `linear-gradient(rgba(201,169,110,0.03) 1px, transparent 1px),
                          linear-gradient(90deg, rgba(201,169,110,0.03) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
        pointerEvents: 'none',
      }} />

      {/* Login card */}
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'rgba(12,31,21,0.85)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(201,169,110,0.2)',
        borderRadius: '16px',
        padding: '48px 40px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(201,169,110,0.15)',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* AG Monogram */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '72px',
            height: '72px',
            background: 'linear-gradient(135deg, #1c4a35 0%, #0c1f15 100%)',
            border: '1.5px solid rgba(201,169,110,0.4)',
            borderRadius: '50%',
            marginBottom: '20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          }}>
            <span style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: '28px',
              fontWeight: 600,
              color: '#c9a96e',
              letterSpacing: '-0.01em',
              lineHeight: 1,
            }}>AG</span>
          </div>

          <h1 style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: '28px',
            fontWeight: 600,
            color: '#f5f0e8',
            margin: 0,
            letterSpacing: '0.01em',
            lineHeight: 1.2,
          }}>
            {step === 'totp' ? 'Verificação 2FA' : 'AgencyGroup.App'}
          </h1>
          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '11px',
            color: 'rgba(201,169,110,0.7)',
            letterSpacing: '0.14em',
            margin: '8px 0 0',
            textTransform: 'uppercase',
          }}>
            {step === 'totp' ? 'Código de autenticação' : 'Portal Exclusivo · AMI 22506'}
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div style={{
            background: 'rgba(220,38,38,0.12)',
            border: '1px solid rgba(220,38,38,0.3)',
            borderRadius: '8px',
            padding: '12px 16px',
            marginBottom: '24px',
            color: '#fca5a5',
            fontSize: '13px',
            fontFamily: "'Jost', sans-serif",
            lineHeight: 1.5,
          }}>
            {error}
          </div>
        )}

        {step === 'credentials' && (
          <>
            {/* Google OAuth */}
            <button
              onClick={handleGoogle}
              disabled={loading}
              style={{
                width: '100%',
                padding: '13px 16px',
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: '8px',
                color: '#f5f0e8',
                fontSize: '14px',
                fontFamily: "'Jost', sans-serif",
                fontWeight: 500,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                transition: 'all 0.2s',
                opacity: loading ? 0.6 : 1,
                marginBottom: '24px',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Entrar com Google
            </button>

            {/* Divider */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '24px',
            }}>
              <div style={{ flex: 1, height: '1px', background: 'rgba(201,169,110,0.15)' }} />
              <span style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '10px',
                color: 'rgba(201,169,110,0.4)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
              }}>ou</span>
              <div style={{ flex: 1, height: '1px', background: 'rgba(201,169,110,0.15)' }} />
            </div>

            {/* Credentials form */}
            <form onSubmit={handleCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="geral@agencygroup.pt"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'rgba(201,169,110,0.6)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(201,169,110,0.25)' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <label style={{ ...labelStyle, margin: 0 }}>Password</label>
                  <a href="/auth/reset-password" style={{
                    fontSize: '11px',
                    fontFamily: "'DM Mono', monospace",
                    color: 'rgba(201,169,110,0.6)',
                    textDecoration: 'none',
                    letterSpacing: '0.06em',
                  }}>
                    Esqueceu?
                  </a>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'rgba(201,169,110,0.6)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(201,169,110,0.25)' }}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: loading ? 'rgba(201,169,110,0.3)' : 'linear-gradient(135deg, #c9a96e 0%, #b8933a 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#0c1f15',
                  fontSize: '14px',
                  fontFamily: "'Jost', sans-serif",
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {loading ? (
                  <>
                    <span style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(12,31,21,0.3)',
                      borderTopColor: '#0c1f15',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'spin 0.8s linear infinite',
                    }} />
                    A verificar...
                  </>
                ) : 'Entrar'}
              </button>
            </form>
          </>
        )}

        {step === 'totp' && (
          <form onSubmit={submitLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 2FA explanation */}
            <div style={{
              background: 'rgba(201,169,110,0.08)',
              border: '1px solid rgba(201,169,110,0.2)',
              borderRadius: '8px',
              padding: '16px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔐</div>
              <p style={{
                fontFamily: "'Jost', sans-serif",
                fontSize: '13px',
                color: 'rgba(245,240,232,0.7)',
                margin: 0,
                lineHeight: 1.5,
              }}>
                Conta com verificação em dois passos ativa.<br />
                Insira o código de 6 dígitos do seu autenticador.
              </p>
            </div>

            <div>
              <label style={labelStyle}>Código 2FA</label>
              <input
                type="text"
                value={totp}
                onChange={e => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                style={{
                  ...inputStyle,
                  textAlign: 'center',
                  fontSize: '28px',
                  letterSpacing: '0.3em',
                  fontFamily: "'DM Mono', monospace",
                  padding: '16px',
                }}
                autoFocus
                onFocus={e => { e.target.style.borderColor = 'rgba(201,169,110,0.6)' }}
                onBlur={e => { e.target.style.borderColor = 'rgba(201,169,110,0.25)' }}
              />
              <p style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '10px',
                color: 'rgba(201,169,110,0.4)',
                margin: '8px 0 0',
                textAlign: 'center',
                letterSpacing: '0.08em',
              }}>
                Google Authenticator · Authy · 1Password
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || totp.length !== 6}
              style={{
                width: '100%',
                padding: '14px',
                background: (loading || totp.length !== 6) ? 'rgba(201,169,110,0.3)' : 'linear-gradient(135deg, #c9a96e 0%, #b8933a 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#0c1f15',
                fontSize: '14px',
                fontFamily: "'Jost', sans-serif",
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: (loading || totp.length !== 6) ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
              }}
            >
              {loading ? (
                <>
                  <span style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(12,31,21,0.3)',
                    borderTopColor: '#0c1f15',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.8s linear infinite',
                  }} />
                  A verificar...
                </>
              ) : 'Confirmar'}
            </button>

            <button
              type="button"
              onClick={() => { setStep('credentials'); setTotp(''); setError('') }}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(201,169,110,0.6)',
                fontSize: '12px',
                fontFamily: "'DM Mono', monospace",
                letterSpacing: '0.08em',
                cursor: 'pointer',
                textAlign: 'center',
                padding: '4px',
              }}
            >
              Voltar ao login
            </button>
          </form>
        )}

        {/* Footer */}
        <div style={{
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: '1px solid rgba(201,169,110,0.1)',
          textAlign: 'center',
        }}>
          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '10px',
            color: 'rgba(201,169,110,0.3)',
            letterSpacing: '0.08em',
            margin: 0,
            lineHeight: 1.6,
          }}>
            AGENCY GROUP · AMI 22506<br />
            ACESSO RESTRITO A CONSULTORES AUTORIZADOS
          </p>
        </div>
      </div>

      {/* Spinner keyframes */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        input::placeholder {
          color: rgba(245,240,232,0.2);
        }
        input:focus {
          outline: none;
        }
      `}</style>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: '100vh',
        background: '#0c1f15',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid rgba(201,169,110,0.2)',
          borderTopColor: '#c9a96e',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
