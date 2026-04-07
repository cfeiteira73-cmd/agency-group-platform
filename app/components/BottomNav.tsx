'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function BottomNav() {
  const pathname = usePathname()
  // Don't show in portal
  if (pathname?.startsWith('/portal')) return null

  return (
    <>
      <style>{`
        @media (min-width: 768px) { .ag-bottom-nav { display: none !important; } }
      `}</style>
      <nav className="ag-bottom-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
        background: 'rgba(12,31,21,0.96)', backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(201,169,110,0.2)',
        display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        padding: '8px 0 calc(8px + env(safe-area-inset-bottom))',
        height: 'auto'
      }}>
        {[
          { href: '/', label: 'Início', icon: '⌂' },
          { href: '/imoveis', label: 'Imóveis', icon: '🔍' },
          { href: '/blog', label: 'Blog', icon: '📰' },
          { href: '/#contacto', label: 'Contacto', icon: '✉' },
        ].map(({ href, label, icon }) => {
          const active = pathname === href || (href !== '/' && pathname?.startsWith(href.split('#')[0]))
          return (
            <Link key={href} href={href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              color: active ? '#c9a96e' : 'rgba(244,240,230,0.5)',
              textDecoration: 'none', padding: '4px 16px',
              transition: 'color 0.2s',
              fontSize: '1.2rem',
              minWidth: 44, minHeight: 44, justifyContent: 'center'
            }}>
              <span style={{ fontSize: '1.1rem' }}>{icon}</span>
              <span style={{ fontSize: '0.55rem', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{label}</span>
            </Link>
          )
        })}
      </nav>
      {/* Spacer so content doesn't hide behind bottom nav on mobile */}
      <div style={{ height: 60 }} className="ag-bottom-nav-spacer" />
      <style>{`
        @media (min-width: 768px) { .ag-bottom-nav-spacer { display: none !important; } }
      `}</style>
    </>
  )
}
