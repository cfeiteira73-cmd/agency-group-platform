'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

const ERROR_MESSAGES: Record<string, string> = {
  Configuration:   'Erro de configuração do servidor. Contacte o administrador.',
  AccessDenied:    'Acesso negado. A sua conta não tem permissão para entrar neste portal.',
  Verification:    'O link de verificação expirou ou já foi utilizado.',
  OAuthSignin:     'Erro ao iniciar sessão com Google. Tente novamente.',
  OAuthCallback:   'Erro no callback do Google. Tente novamente.',
  OAuthCreateAccount: 'Não foi possível criar a conta com Google. Contacte o administrador.',
  EmailCreateAccount: 'Não foi possível criar a conta. Contacte o administrador.',
  Callback:        'Erro de autenticação. Tente novamente.',
  OAuthAccountNotLinked: 'Este email já está associado a outra forma de login.',
  Default:         'Ocorreu um erro de autenticação. Tente novamente.',
}

function ErrorContent() {
  const searchParams = useSearchParams()
  const error = searchParams.get('error') || 'Default'
  const message = ERROR_MESSAGES[error] || ERROR_MESSAGES.Default

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a1a0f 0%, #0c1f15 50%, #0f2a1a 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: "'Jost', sans-serif",
      padding: '24px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        background: 'rgba(12,31,21,0.85)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(220,38,38,0.3)',
        borderRadius: '16px',
        padding: '48px 40px',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        textAlign: 'center',
      }}>
        {/* AG Monogram */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '64px',
          height: '64px',
          background: 'rgba(220,38,38,0.15)',
          border: '1.5px solid rgba(220,38,38,0.3)',
          borderRadius: '50%',
          marginBottom: '24px',
        }}>
          <span style={{ fontSize: '28px' }}>⚠</span>
        </div>

        <h1 style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: '24px',
          fontWeight: 600,
          color: '#f5f0e8',
          margin: '0 0 12px',
        }}>
          Erro de Autenticação
        </h1>

        <p style={{
          color: 'rgba(245,240,232,0.6)',
          fontSize: '14px',
          lineHeight: 1.6,
          margin: '0 0 32px',
        }}>
          {message}
        </p>

        <div style={{
          background: 'rgba(220,38,38,0.08)',
          border: '1px solid rgba(220,38,38,0.2)',
          borderRadius: '8px',
          padding: '10px 14px',
          marginBottom: '32px',
        }}>
          <code style={{
            fontFamily: "'DM Mono', monospace",
            fontSize: '11px',
            color: 'rgba(252,165,165,0.8)',
            letterSpacing: '0.06em',
          }}>
            ERROR: {error}
          </code>
        </div>

        <Link
          href="/auth/login"
          style={{
            display: 'inline-block',
            padding: '13px 32px',
            background: 'linear-gradient(135deg, #c9a96e 0%, #b8933a 100%)',
            borderRadius: '8px',
            color: '#0c1f15',
            fontSize: '13px',
            fontFamily: "'Jost', sans-serif",
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            textDecoration: 'none',
          }}
        >
          Voltar ao Login
        </Link>

        <p style={{
          marginTop: '24px',
          fontFamily: "'DM Mono', monospace",
          fontSize: '10px',
          color: 'rgba(201,169,110,0.3)',
          letterSpacing: '0.08em',
        }}>
          AGENCY GROUP · AMI 22506
        </p>
      </div>
    </div>
  )
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0c1f15' }} />
    }>
      <ErrorContent />
    </Suspense>
  )
}
