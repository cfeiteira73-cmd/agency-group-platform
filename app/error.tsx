'use client'
import { useEffect } from 'react'

export default function Error({ error, reset }: { error: Error & { digest?: string }, reset: () => void }) {
  useEffect(() => { console.error(error) }, [error])
  return (
    <div style={{
      minHeight: '100vh', background: '#0c1f15',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '24px'
    }}>
      <h1 style={{ color: '#c9a96e', fontFamily: 'Cormorant Garamond, serif', fontSize: '48px', margin: 0 }}>Erro</h1>
      <p style={{ color: '#9ca3af', fontFamily: 'DM Mono, monospace', fontSize: '14px' }}>
        Algo correu mal. A nossa equipa foi notificada.
      </p>
      <button onClick={reset} style={{
        background: '#c9a96e', color: '#0c1f15', border: 'none', padding: '12px 32px',
        fontFamily: 'DM Mono, monospace', fontSize: '13px', letterSpacing: '1px', cursor: 'pointer'
      }}>
        TENTAR NOVAMENTE
      </button>
    </div>
  )
}
