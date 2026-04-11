'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const HomeIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
    <polyline points="9,22 9,12 15,12 15,22"/>
  </svg>
)

const SearchIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

const ArticleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
    <polyline points="14,2 14,8 20,8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
  </svg>
)

const ContactIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
    <polyline points="22,6 12,13 2,6"/>
  </svg>
)

const NAV_ITEMS = [
  { href: '/',         label: 'Início',   Icon: HomeIcon },
  { href: '/imoveis',  label: 'Imóveis',  Icon: SearchIcon },
  { href: '/blog',     label: 'Blog',     Icon: ArticleIcon },
  { href: '/contacto', label: 'Contacto', Icon: ContactIcon },
]

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
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || (href !== '/' && pathname?.startsWith(href.split('#')[0]))
          return (
            <Link key={href} href={href} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
              color: active ? '#c9a96e' : 'rgba(244,240,230,0.5)',
              textDecoration: 'none', padding: '4px 16px',
              transition: 'color 0.2s',
              minWidth: 44, minHeight: 44, justifyContent: 'center'
            }}>
              <Icon />
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
