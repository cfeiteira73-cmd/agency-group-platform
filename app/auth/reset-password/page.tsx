'use client'

import { useState } from 'react'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'form' | 'sent'>('form')
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
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/send-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Erro ao enviar email. Tente novamente.')
        return
      }

      setStep('sent')
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
            {step === 'sent' ? 'Email Enviado' : 'Recuperar Acesso'}
          </h1>
          <p style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '11px',
            color: 'rgba(201,169,110,0.7)',
            letterSpacing: '0.14em',
            margin: '8px 0 0',
            textTransform: 'uppercase',
          }}>
            {step === 'sent' ? 'Verifique o seu email' : 'Redefinição de Password'}
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
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              background: 'rgba(201,169,110,0.06)',
              border: '1px solid rgba(201,169,110,0.15)',
              borderRadius: '8px',
              padding: '14px 16px',
            }}>
              <p style={{
                fontFamily: "'Jost', sans-serif",
                fontSize: '13px',
                color: 'rgba(245,240,232,0.65)',
                margin: 0,
                lineHeight: 1.6,
              }}>
                Insira o seu email de acesso e enviaremos um link para redefinir a password.
              </p>
            </div>

            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="carlos@agencygroup.pt"
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
                  A enviar...
                </>
              ) : 'Enviar Link de Recuperação'}
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
        )}

        {step === 'sent' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{
              background: 'rgba(201,169,110,0.08)',
              border: '1px solid rgba(201,169,110,0.25)',
              borderRadius: '8px',
              padding: '24px',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>✉️</div>
              <p style={{
                fontFamily: "'Jost', sans-serif",
                fontSize: '14px',
                color: 'rgba(245,240,232,0.85)',
                margin: '0 0 8px',
                lineHeight: 1.6,
                fontWeight: 500,
              }}>
                Se o email existir na nossa base de dados, receberá um link de recuperação em breve.
              </p>
              <p style={{
                fontFamily: "'DM Mono', monospace",
                fontSize: '11px',
                color: 'rgba(201,169,110,0.5)',
                margin: 0,
                letterSpacing: '0.06em',
              }}>
                O link é válido durante 1 hora.
              </p>
            </div>

            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(201,169,110,0.1)',
              borderRadius: '8px',
              padding: '14px 16px',
            }}>
              <p style={{
                fontFamily: "'Jost', sans-serif",
                fontSize: '12px',
                color: 'rgba(245,240,232,0.45)',
                margin: 0,
                lineHeight: 1.6,
              }}>
                Não recebeu o email? Verifique a pasta de spam ou tente novamente.
              </p>
            </div>

            <button
              onClick={() => { setStep('form'); setError('') }}
              style={{
                width: '100%',
                padding: '13px',
                background: 'rgba(201,169,110,0.1)',
                border: '1px solid rgba(201,169,110,0.25)',
                borderRadius: '8px',
                color: '#c9a96e',
                fontSize: '13px',
                fontFamily: "'Jost', sans-serif",
                fontWeight: 500,
                letterSpacing: '0.06em',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              Reenviar email
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
