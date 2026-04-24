'use client'

import { type ReactNode } from 'react'
import Link from 'next/link'
import { NAV } from './constants'
import Tooltip from './Tooltip'

interface PortalSidebarProps {
  agentName: string
  section: string
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  setSection: (s: string) => void
  logout: () => void
}

export default function PortalSidebar({
  agentName,
  section,
  sidebarOpen,
  setSidebarOpen,
  setSection,
  logout,
}: PortalSidebarProps) {
  const initials = agentName.substring(0, 2).toUpperCase()

  return (
    <aside
      className={`portal-sidebar${sidebarOpen ? ' open' : ''}`}
      style={{
        width: '248px', minWidth: '248px', maxWidth: '248px', flexShrink: 0,
        background: '#060e09', display: 'flex', flexDirection: 'column',
        overflowX: 'hidden', overflowY: 'auto', maxHeight: '100vh',
        borderRight: '1px solid rgba(201,169,110,.08)', zIndex: 10,
      }}
    >
      {/* Logo */}
      <div style={{ padding: '28px 24px 24px', borderBottom: '1px solid rgba(244,240,230,.06)', flexShrink: 0 }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'block' }}>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '1.4rem', letterSpacing: '.4em', textTransform: 'uppercase', color: '#c9a96e', lineHeight: 1 }}>Agency</div>
          <div style={{ fontFamily: "'Cormorant',serif", fontWeight: 300, fontSize: '.7rem', letterSpacing: '.65em', textTransform: 'uppercase', color: 'rgba(201,169,110,.5)', marginTop: '3px' }}>Group</div>
        </Link>
      </div>

      {/* User */}
      <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(244,240,230,.06)', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(201,169,110,.15)', border: '1px solid rgba(201,169,110,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: '#c9a96e', flexShrink: 0, letterSpacing: '.06em' }}>{initials}</div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '.82rem', color: '#f4f0e6', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{agentName}</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.1em', color: 'rgba(244,240,230,.3)', textTransform: 'uppercase', marginTop: '2px' }}>AMI 22506</div>
          <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(44,122,86,.8)', letterSpacing: '.08em', background: 'rgba(44,122,86,.1)', border: '1px solid rgba(44,122,86,.25)', padding: '2px 8px', marginTop: '4px', display: 'inline-block' }}>● Notion Sync</span>
        </div>
      </div>

      {/* Nav — grouped */}
      <nav role="navigation" aria-label="Portal navigation" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '10px 0', minHeight: 0, position: 'relative', top: 'auto', left: 'auto', right: 'auto', zIndex: 'auto' as unknown as number, width: 'auto', background: 'transparent', display: 'flex', flexDirection: 'column' }}>
        {(() => {
          const rendered: ReactNode[] = []
          let lastGroup = '__start__'
          NAV.forEach(item => {
            if (item.group !== lastGroup) {
              if (item.group) rendered.push(
                <div key={`g-${item.group}`} style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.16em', color: 'rgba(244,240,230,.30)', textTransform: 'uppercase', padding: '14px 24px 5px', marginTop: lastGroup === '' || lastGroup === '__start__' ? '4px' : '0' }}>
                  {item.group}
                </div>
              )
              lastGroup = item.group
            }
            rendered.push(
              <Tooltip key={item.id} content={item.label} position="right" darkMode>
                <div
                  role="menuitem"
                  tabIndex={0}
                  aria-current={section === item.id ? 'page' : undefined}
                  className={`nav-item${section === item.id ? ' active' : ''}`}
                  onClick={() => { setSection(item.id); setSidebarOpen(false) }}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSection(item.id); setSidebarOpen(false) } }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" strokeWidth="1.5" style={{ flexShrink: 0 }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.label}</span>
                </div>
              </Tooltip>
            )
          })
          return rendered
        })()}
      </nav>

      {/* Mercado + Logout */}
      <div style={{ padding: '14px 20px', borderTop: '1px solid rgba(244,240,230,.06)', flexShrink: 0 }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.14em', color: 'rgba(244,240,230,.2)', textTransform: 'uppercase', marginBottom: '8px' }}>Mercado Portugal</div>
        {([['Mediana', '€3.076/m²'], ['YoY', '+17,6%'], ['Transacções', '169.812']] as [string, string][]).map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.52rem', color: 'rgba(244,240,230,.28)', letterSpacing: '.06em' }}>{k}</span>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.54rem', color: 'rgba(201,169,110,.65)', letterSpacing: '.06em' }}>{v}</span>
          </div>
        ))}
        <button type="button"
          onClick={logout}
          style={{ marginTop: '10px', width: '100%', background: 'none', border: '1px solid rgba(244,240,230,.08)', color: 'rgba(244,240,230,.25)', padding: '7px', fontFamily: "'DM Mono',monospace", fontSize: '.52rem', letterSpacing: '.14em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all .2s' }}
          onMouseOver={e => { (e.target as HTMLButtonElement).style.borderColor = 'rgba(244,240,230,.25)'; (e.target as HTMLButtonElement).style.color = 'rgba(244,240,230,.55)' }}
          onMouseOut={e => { (e.target as HTMLButtonElement).style.borderColor = 'rgba(244,240,230,.08)'; (e.target as HTMLButtonElement).style.color = 'rgba(244,240,230,.25)' }}
        >
          Terminar sessão
        </button>
      </div>
    </aside>
  )
}
