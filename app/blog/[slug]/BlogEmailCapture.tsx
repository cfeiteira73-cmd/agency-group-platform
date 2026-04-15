'use client'

import { useState, useEffect } from 'react'
import { track } from '@/lib/gtm'

interface Props {
  articleSlug: string
  articleZona?: string
  variant?: 'inline' | 'end-of-article'
}

export default function BlogEmailCapture({
  articleSlug,
  articleZona,
  variant = 'inline',
}: Props) {
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Track impression — fires once when capture form enters the page
  useEffect(() => {
    track('blog_capture_impression', {
      variant,
      article_slug: articleSlug,
      zona: articleZona ?? '',
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // intentionally empty — fire once on mount

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      setErrorMsg('Email inválido')
      return
    }
    setStep('loading')
    setErrorMsg('')

    track('inline_capture_submitted', {
      article: articleSlug,
      zona: articleZona ?? '',
      variant,
    })

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          source: `blog_${variant}`,
          source_detail: articleSlug,
          zona: articleZona ?? '',
          intent: 'buyer',
          lang: 'pt',
          message: `Lead via blog article: ${articleSlug}`,
        }),
      })
      if (!res.ok) throw new Error()
      setStep('success')

      // Also create a saved search alert for this zone
      if (articleZona) {
        await fetch('/api/alerts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            zona: articleZona,
            tipo: 'Todos',
            source: `blog_${variant}_${articleSlug}`,
          }),
        }).catch(() => {})

        track('alert_optin', {
          email_domain: email.split('@')[1],
          source: `blog_${articleSlug}`,
          zona: articleZona,
        })
      }
    } catch {
      setStep('error')
      setErrorMsg('Erro ao registar. Tente novamente.')
    }
  }

  if (variant === 'end-of-article') {
    return (
      <div style={{
        background: 'linear-gradient(135deg, #0c1f15 0%, #1c4a35 100%)',
        padding: '40px',
        margin: '3rem 0 0',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* ambient glow */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'radial-gradient(ellipse 80% 60% at 80% 100%, rgba(201,169,110,.08), transparent)',
        }} />

        <div style={{ position: 'relative' }}>
          <div style={{
            fontFamily: "'DM Mono', monospace", fontSize: '.5rem',
            letterSpacing: '.22em', textTransform: 'uppercase',
            color: 'rgba(201,169,110,.55)', marginBottom: '10px',
          }}>
            {articleZona ? `Imóveis em ${articleZona}` : 'Portfolio Exclusivo'}
          </div>
          <h3 style={{
            fontFamily: "'Cormorant', serif", fontWeight: 300,
            fontSize: 'clamp(1.4rem, 3vw, 2rem)', color: '#f4f0e6',
            margin: '0 0 8px', lineHeight: 1.2,
          }}>
            Receba os melhores imóveis<br />
            <em style={{ color: '#c9a96e', fontStyle: 'italic' }}>antes de chegarem ao mercado.</em>
          </h3>
          <p style={{
            fontFamily: "'Jost', sans-serif", fontSize: '.78rem',
            color: 'rgba(244,240,230,.45)', margin: '0 0 24px', lineHeight: 1.7,
          }}>
            Sem spam. Apenas propriedades que correspondem ao seu perfil.
            Cancelar a qualquer momento.
          </p>

          {step === 'success' ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              background: 'rgba(201,169,110,.1)',
              border: '1px solid rgba(201,169,110,.25)',
              padding: '14px 20px',
              maxWidth: '480px',
            }}>
              <span style={{ color: '#c9a96e', fontSize: '1.1rem' }}>✓</span>
              <span style={{
                fontFamily: "'Jost', sans-serif", fontSize: '.72rem',
                color: 'rgba(244,240,230,.7)',
              }}>
                Registado! Enviámos um email de confirmação.
              </span>
            </div>
          ) : (
            <form onSubmit={submit} style={{
              display: 'flex', gap: '0', maxWidth: '480px',
              flexWrap: 'wrap',
            }}>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="o-seu@email.com"
                required
                autoComplete="email"
                style={{
                  flex: 1, minWidth: '200px',
                  background: 'rgba(255,255,255,.06)',
                  border: '1px solid rgba(201,169,110,.25)',
                  borderRight: 'none',
                  color: '#f4f0e6',
                  padding: '12px 16px',
                  fontFamily: "'Jost', sans-serif", fontSize: '.75rem',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={step === 'loading'}
                style={{
                  background: step === 'loading' ? 'rgba(201,169,110,.4)' : '#c9a96e',
                  color: '#0c1f15', border: 'none',
                  padding: '12px 24px',
                  fontFamily: "'Jost', sans-serif", fontSize: '.6rem',
                  fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase',
                  cursor: step === 'loading' ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {step === 'loading' ? '...' : 'Subscrever →'}
              </button>
              {errorMsg && (
                <div style={{
                  width: '100%', marginTop: '8px',
                  fontFamily: "'Jost', sans-serif", fontSize: '.65rem',
                  color: '#e74c3c',
                }}>{errorMsg}</div>
              )}
            </form>
          )}
        </div>
      </div>
    )
  }

  // ─── Inline variant — compact strip ──────────────────────────────────────────
  return (
    <div style={{
      background: 'rgba(28,74,53,.06)',
      border: '1px solid rgba(28,74,53,.12)',
      borderLeft: '3px solid #c9a96e',
      padding: '20px 24px',
      margin: '2rem 0',
    }}>
      <div style={{
        fontFamily: "'DM Mono', monospace", fontSize: '.5rem',
        letterSpacing: '.18em', textTransform: 'uppercase',
        color: '#c9a96e', marginBottom: '6px',
      }}>
        Alerta Gratuito
      </div>
      <p style={{
        fontFamily: "'Jost', sans-serif", fontSize: '.8rem',
        color: 'rgba(14,14,13,.65)', margin: '0 0 14px', lineHeight: 1.6,
      }}>
        {articleZona
          ? `Receba novos imóveis em ${articleZona} directamente no seu email.`
          : 'Receba novos imóveis exclusivos directamente no seu email.'}
      </p>

      {step === 'success' ? (
        <div style={{
          fontFamily: "'Jost', sans-serif", fontSize: '.72rem',
          color: '#1c4a35', fontWeight: 600,
        }}>
          ✓ Registado com sucesso!
        </div>
      ) : (
        <form
          onSubmit={submit}
          style={{ display: 'flex', gap: '0', maxWidth: '420px', flexWrap: 'wrap' }}
        >
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="o-seu@email.com"
            required
            autoComplete="email"
            style={{
              flex: 1, minWidth: '180px',
              background: '#fff',
              border: '1px solid rgba(14,14,13,.15)',
              borderRight: 'none',
              color: '#0c1f15',
              padding: '10px 14px',
              fontFamily: "'Jost', sans-serif", fontSize: '.72rem',
              outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={step === 'loading'}
            style={{
              background: step === 'loading' ? 'rgba(28,74,53,.4)' : '#1c4a35',
              color: '#c9a96e', border: 'none',
              padding: '10px 18px',
              fontFamily: "'Jost', sans-serif", fontSize: '.58rem',
              fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase',
              cursor: step === 'loading' ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {step === 'loading' ? '...' : 'Subscrever →'}
          </button>
          {errorMsg && (
            <div style={{
              width: '100%', marginTop: '6px',
              fontFamily: "'Jost', sans-serif", fontSize: '.62rem',
              color: '#e74c3c',
            }}>{errorMsg}</div>
          )}
        </form>
      )}
    </div>
  )
}
