'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'

export default function SuccessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const sessionId = searchParams.get('session_id')
  const [countdown, setCountdown] = useState(10)

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer)
          router.push('/investor-intelligence')
          return 0
        }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [router])

  return (
    <main style={{
      background: '#0c1f15',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'var(--font-body, Georgia, serif)',
      padding: '2rem',
    }}>
      <div style={{
        maxWidth: '560px',
        width: '100%',
        textAlign: 'center',
      }}>
        {/* Icon */}
        <div style={{
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'rgba(212,175,55,0.15)',
          border: '2px solid #d4af37',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 2rem',
          fontSize: '2rem',
        }}>
          ✓
        </div>

        <h1 style={{
          color: '#d4af37',
          fontSize: 'clamp(1.5rem, 4vw, 2.25rem)',
          fontWeight: 700,
          marginBottom: '1rem',
          letterSpacing: '-0.02em',
        }}>
          Subscrição Activa
        </h1>

        <p style={{
          color: '#e8e0d0',
          fontSize: '1.1rem',
          lineHeight: 1.7,
          marginBottom: '0.75rem',
        }}>
          Bem-vindo ao Investor Intelligence.<br />
          O teu acesso está activo e inclui <strong style={{ color: '#d4af37' }}>14 dias gratuitos</strong>.
        </p>

        <p style={{
          color: 'rgba(232,224,208,0.6)',
          fontSize: '0.9rem',
          marginBottom: '2.5rem',
        }}>
          Recebes email de confirmação em breve.<br />
          Redireccionamento em {countdown}s...
        </p>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/investor-intelligence" style={{
            display: 'inline-block',
            background: '#d4af37',
            color: '#0c1f15',
            padding: '0.875rem 2rem',
            borderRadius: '6px',
            fontWeight: 700,
            textDecoration: 'none',
            fontSize: '0.95rem',
          }}>
            Ir para o Dashboard →
          </Link>
          <Link href="/" style={{
            display: 'inline-block',
            border: '1px solid rgba(212,175,55,0.4)',
            color: '#d4af37',
            padding: '0.875rem 2rem',
            borderRadius: '6px',
            fontWeight: 600,
            textDecoration: 'none',
            fontSize: '0.95rem',
          }}>
            Homepage
          </Link>
        </div>

        {sessionId && (
          <p style={{
            color: 'rgba(232,224,208,0.3)',
            fontSize: '0.75rem',
            marginTop: '2rem',
          }}>
            Ref: {sessionId.slice(-12)}
          </p>
        )}
      </div>
    </main>
  )
}
