import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh', background: '#f4f0e6',
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '24px'
    }}>
      <p style={{ color: '#c9a96e', fontFamily: 'DM Mono, monospace', fontSize: '13px', letterSpacing: '4px', opacity: 0.7 }}>404</p>
      <h1 style={{ color: '#0c1f15', fontFamily: 'Cormorant Garamond, serif', fontSize: '48px', margin: 0 }}>Página não encontrada</h1>
      <p style={{ color: '#9ca3af', fontFamily: 'DM Mono, monospace', fontSize: '14px', textAlign: 'center' }}>
        Esta página não existe ou foi movida.
      </p>
      <Link href="/" style={{
        background: 'transparent', color: '#c9a96e', border: '1px solid #c9a96e',
        padding: '12px 32px', fontFamily: 'DM Mono, monospace', fontSize: '13px',
        letterSpacing: '1px', textDecoration: 'none', display: 'inline-block'
      }}>
        VOLTAR AO INÍCIO
      </Link>
    </div>
  )
}
