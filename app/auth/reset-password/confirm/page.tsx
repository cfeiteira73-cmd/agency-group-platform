'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function ConfirmResetForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const inputStyle: React.CSSProperties = {
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

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '11px',
    fontFamily: "'DM Mono', monospace",
    letterSpacing: '0.12em',
    color: '#c9a96e',
    marginBottom: '8px',
    textTransform: 'uppercase',
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!token) {
      setError('Token inválido ou em falta. Solicite um novo link de recuperação.')
      return
    }

    if (password.length < 8) {
      setError('A password deve ter pelo menos 8 caracteres.')
      return
    }

    if (password !== confirm) {
      setError('As passwords não coincidem.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/auth/confirm-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        setError(data.error || 'Erro ao redefinir password. O link pode ter expirado.')
        return
      }

      setStep('success')
    } catch {
      setError('Erro de ligação. Tente novamente.')
    } finally {
      setLoading(false)
    }
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

      {/* Card */}
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
            {step === 'success' ? 'Password Alterada' : 'Nova Password'}
          </h1>
          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '11px',
            color: 'rgba(201,169,110,0.7)',
            letterSpacing: '0.14em',
            margin: '8px 0 0',
            textTransform: 'uppercase',
          }}>
            {step === 'success' ? 'Acesso reposto com sucesso' : 'Definir nova password'}
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

        {step === 'form' && (
          <>
            {!token && (
              <div style={{
                background: 'rgba(220,38,38,0.1)',
                border: '1px solid rgba(220,38,38,0.25)',
                borderRadius: '8px',
                padding: '14px 16px',
                marginBottom: '24px',
              }}>
                <p style={{
                  fontFamily: "'Jost', sans-serif",
                  fontSize: '13px',
                  color: '#fca5a5',
                  margin: 0,
                  lineHeight: 1.5,
                }}>
                  Link inválido. Solicite um novo link de recuperação.
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Nova Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  style={inputStyle}
                  onFocus={e => { e.target.style.borderColor = 'rgba(201,169,110,0.6)' }}
                  onBlur={e => { e.target.style.borderColor = 'rgba(201,169,110,0.25)' }}
                />
              </div>

              <div>
                <label style={labelStyle}>Confirmar Password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="Repetir nova password"
                  style={{
                    ...inputStyle,
                    borderColor: confirm && password !== confirm
                      ? 'rgba(220,38,38,0.5)'
                      : 'rgba(201,169,110,0.25)',
                  }}
                  onFocus={e => { e.target.style.borderColor = 'rgba(201,169,110,0.6)' }}
                  onBlur={e => {
                    e.target.style.borderColor = confirm && password !== confirm
                      ? 'rgba(220,38,38,0.5)'
                      : 'rgba(201,169,110,0.25)'
                  }}
                />
                {confirm && password !== confirm && (
                  <p style={{
                    fontFamily: "'DM Mono', monospace",
                    fontSize: '10px',
                    color: '#fca5a5',
                    margin: '6px 0 0',
                    letterSpacing: '0.05em',
                  }}>
                    As passwords não coincidem
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !token}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: (loading || !token) ? 'rgba(201,169,110,0.3)' : 'linear-gradient(135deg, #c9a96e 0%, #b8933a 100%)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#0c1f15',
                  fontSize: '14px',
                  fontFamily: "'Jost', sans-serif",
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  cursor: (loading || !token) ? 'not-allowed' : 'pointer',
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
                    A guardar...
                  </>
                ) : 'Definir Nova Password'}
              </button>

              <a href="/auth/login" style={{
                textAlign: 'center',
                fontSize: '12px',
                fontFamily: "'DM Mono', monospace",
                color: 'rgba(201,169,110,0.6)',
                textDecoration: 'none',
                letterSpacing: '0.08em',
              }}>
                Voltar ao login
              </a>
            </form>
          </>
        )}

        {step === 'success' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              background: 'rgba(201,169,110,0.08)',
              border: '1px solid rgba(201,169,110,0.25)',
              borderRadius: '8px',
              padding: '24px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
              <p style={{
                fontFamily: "'Jost', sans-serif",
                fontSize: '14px',
                color: 'rgba(245,240,232,0.85)',
                margin: '0 0 8px',
                lineHeight: 1.6,
                fontWeight: 500,
              }}>
                Password redefinida com sucesso.
              </p>
              <p style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '11px',
                color: 'rgba(201,169,110,0.5)',
                margin: 0,
                letterSpacing: '0.06em',
              }}>
                Pode agora iniciar sessão com a nova password.
              </p>
            </div>

            <a
              href="/auth/login"
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #c9a96e 0%, #b8933a 100%)',
                border: 'none',
                borderRadius: '8px',
                color: '#0c1f15',
                fontSize: '14px',
                fontFamily: "'Jost', sans-serif",
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                textDecoration: 'none',
                boxSizing: 'border-box',
              }}
            >
              Entrar no Portal
            </a>
          </div>
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

export default function ConfirmResetPage() {
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
      <ConfirmResetForm />
    </Suspense>
  )
}
