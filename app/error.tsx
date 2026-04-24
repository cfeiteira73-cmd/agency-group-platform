'use client'
import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => { console.error(error) }, [error])

  return (
    <>
      <style>{`
        .err-btn { display:inline-flex; align-items:center; gap:8px; padding:12px 28px; font-family:'DM Mono',monospace; font-size:.52rem; letter-spacing:.16em; text-transform:uppercase; cursor:pointer; transition:opacity .2s; }
        .err-btn:hover { opacity:.85; }
        .err-btn-primary { background:#c9a96e; color:#060d08; border:none; }
        .err-btn-ghost { background:transparent; color:#c9a96e; border:1px solid rgba(201,169,110,.4); text-decoration:none; }
      `}</style>
      <div
        style={{
          minHeight: '100vh',
          background: '#060d08',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: '0',
          padding: '40px 24px',
          fontFamily: "'DM Mono',monospace",
        }}
      >
        {/* Brand label */}
        <div
          style={{
            fontFamily: "'DM Mono',monospace",
            fontSize: '.48rem',
            letterSpacing: '.28em',
            textTransform: 'uppercase',
            color: 'rgba(201,169,110,.5)',
            marginBottom: '32px',
          }}
        >
          Agency Group · AMI 22506
        </div>

        {/* Icon */}
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            border: '1.5px solid rgba(201,169,110,.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '24px',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(201,169,110,.7)" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4M12 16h.01" strokeLinecap="round" />
          </svg>
        </div>

        {/* Heading */}
        <h1
          style={{
            fontFamily: "'Cormorant',serif",
            fontSize: 'clamp(1.6rem, 4vw, 2.2rem)',
            fontWeight: 300,
            color: '#f4f0e6',
            margin: '0 0 10px',
            textAlign: 'center',
          }}
        >
          Algo correu mal
        </h1>

        <p
          style={{
            fontFamily: "'DM Mono',monospace",
            fontSize: '.58rem',
            letterSpacing: '.1em',
            color: 'rgba(244,240,230,.4)',
            textAlign: 'center',
            marginBottom: '32px',
            maxWidth: '320px',
            lineHeight: 1.8,
          }}
        >
          Ocorreu um erro inesperado.<br />
          A nossa equipa foi notificada automaticamente.
        </p>

        {/* Actions */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            className="err-btn err-btn-primary"
            onClick={reset}
          >
            ↻ Tentar novamente
          </button>
          <Link href="/" className="err-btn err-btn-ghost">
            ← Início
          </Link>
        </div>

        {/* Error digest for support */}
        {!!error.digest && (
          <div
            style={{
              marginTop: '28px',
              fontFamily: "'DM Mono',monospace",
              fontSize: '.46rem',
              letterSpacing: '.08em',
              color: 'rgba(244,240,230,.2)',
            }}
          >
            Ref: {error.digest}
          </div>
        )}
      </div>
    </>
  )
}
