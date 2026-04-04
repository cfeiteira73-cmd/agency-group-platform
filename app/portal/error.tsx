'use client'
import { useEffect } from 'react'
import Link from 'next/link'

export default function PortalError({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div style={{
      minHeight: '100vh', background: '#0c1f15',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '24px'
    }}>
      <h1 style={{ color: '#c9a96e', fontFamily: 'Cormorant Garamond, serif', fontSize: '48px', margin: 0 }}>Erro no Portal</h1>
      <p style={{ color: '#9ca3af', fontFamily: 'DM Mono, monospace', fontSize: '14px' }}>
        Algo correu mal. A nossa equipa foi notificada.
      </p>
      <div style={{ display: 'flex', gap: '16px' }}>
        <button onClick={reset} style={{
          background: '#c9a96e', color: '#0c1f15', border: 'none', padding: '12px 32px',
          fontFamily: 'DM Mono, monospace', fontSize: '13px', letterSpacing: '1px', cursor: 'pointer'
        }}>
          TENTAR NOVAMENTE
        </button>
        <Link href="/portal" style={{
          background: 'transparent', color: '#c9a96e', border: '1px solid #c9a96e',
          padding: '12px 32px', fontFamily: 'DM Mono, monospace', fontSize: '13px',
          letterSpacing: '1px', textDecoration: 'none', display: 'inline-block'
        }}>
          VOLTAR AO PORTAL
        </Link>
      </div>
    </div>
  )
}
