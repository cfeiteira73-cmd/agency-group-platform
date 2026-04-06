'use client'

import { useState, useEffect } from 'react'
import { SECTION_NAMES } from './constants'
import type { CRMContact } from './types'
import Tooltip from './Tooltip'

interface Deal {
  id: number
  ref: string
  imovel: string
  valor: string
  fase: string
  comprador: string
  cpcvDate: string
  escrituraDate: string
  checklist: Record<string, boolean[]>
}

interface PortalHeaderProps {
  section: string
  darkMode: boolean
  setDarkMode: (v: boolean) => void
  setSection: (s: string) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  deals: Deal[]
  crmContacts: CRMContact[]
  imoveisList: Record<string, unknown>[]
  showNotifPanel: boolean
  setShowNotifPanel: (v: boolean) => void
  setActiveCrmId: (id: number) => void
  setCrmProfileTab: (tab: 'overview' | 'timeline' | 'tasks' | 'notes' | 'matching' | 'postclosing') => void
}

export default function PortalHeader({
  section,
  darkMode,
  setDarkMode,
  setSection,
  sidebarOpen,
  setSidebarOpen,
  deals,
  crmContacts,
  imoveisList,
  showNotifPanel,
  setShowNotifPanel,
  setActiveCrmId,
  setCrmProfileTab,
}: PortalHeaderProps) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])
  const pipelineTotal = deals.reduce((s, d) => s + parseFloat(d.valor.replace(/[^0-9.]/g, '')), 0)

  const today = new Date().toISOString().split('T')[0]
  const todayTs = Date.now()
  const overdueFU = crmContacts.filter(c => c.nextFollowUp && c.nextFollowUp <= today)
  const stalePropsN = imoveisList.filter(p => {
    const ld = p.listingDate as string | undefined
    return ld ? Math.floor((todayTs - new Date(ld).getTime()) / 86400000) > 60 : false
  })
  const totalAlerts = overdueFU.length + stalePropsN.length

  return (
    <header role="banner" style={{ height: '56px', background: darkMode ? '#0c1f15' : '#f4f0e6', borderBottom: `1px solid ${darkMode ? 'rgba(201,169,110,.12)' : 'rgba(14,14,13,.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px 0 20px', flexShrink: 0, backdropFilter: 'blur(12px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button type="button" className="hamburger" aria-label={sidebarOpen ? 'Fechar menu' : 'Abrir menu'} onClick={() => setSidebarOpen(!sidebarOpen)}>
          <span /><span /><span />
        </button>
        {section !== 'dashboard' && (
          <button type="button"
            onClick={() => setSection('dashboard')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(14,14,13,.35)', padding: '4px 8px 4px 0', transition: 'color .2s', display: 'flex', alignItems: 'center', gap: '5px' }}
            onMouseOver={e => { (e.currentTarget as HTMLButtonElement).style.color = '#1c4a35' }}
            onMouseOut={e => { (e.currentTarget as HTMLButtonElement).style.color = 'rgba(14,14,13,.35)' }}
          >
            ← voltar
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ fontFamily: 'var(--font-cormorant),serif', fontWeight: 300, fontSize: '1.05rem', color: darkMode ? '#f4f0e6' : '#0e0e0d', letterSpacing: '.01em' }}>{SECTION_NAMES[section]}</div>
          <span style={{
            fontFamily: 'var(--font-dm-mono),monospace',
            fontSize: '.52rem',
            letterSpacing: '.08em',
            color: darkMode ? 'rgba(240,237,228,.28)' : 'rgba(14,14,13,.28)',
            background: darkMode ? 'rgba(240,237,228,.06)' : 'rgba(14,14,13,.05)',
            border: `1px solid ${darkMode ? 'rgba(240,237,228,.10)' : 'rgba(14,14,13,.08)'}`,
            borderRadius: 4,
            padding: '2px 7px',
            marginLeft: 8,
            cursor: 'pointer',
          }}>⌘K</span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <div style={{ display: 'flex', gap: '18px' }}>
          {([['Pipeline', `€${(pipelineTotal / 1e6).toFixed(1)}M`], ['Deals', String(deals.length)], ['Mercado', '+17,6%']] as [string, string][]).map(([l, v]) => (
            <div key={l} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.53rem', color: darkMode ? '#c9a96e' : '#1c4a35', fontWeight: 500 }}>{v}</div>
              <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', letterSpacing: '.1em', color: darkMode ? 'rgba(244,240,230,.35)' : 'rgba(14,14,13,.32)', textTransform: 'uppercase' }}>{l}</div>
            </div>
          ))}
        </div>

        <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', letterSpacing: '.08em', color: darkMode ? 'rgba(244,240,230,.4)' : 'rgba(14,14,13,.35)' }}>
          {now.toLocaleDateString('pt-PT', { weekday: 'short', day: 'numeric', month: 'short' })} · {now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
        </div>

        {/* Notification Bell */}
        <div style={{ position: 'relative' }}>
          <Tooltip content="Notificações" darkMode={darkMode}>
          <button type="button"
            aria-label={`Alertas${totalAlerts > 0 ? ` — ${totalAlerts} activo${totalAlerts !== 1 ? 's' : ''}` : ''}`}
            aria-expanded={showNotifPanel}
            aria-haspopup="true"
            tabIndex={0}
            onClick={() => setShowNotifPanel(!showNotifPanel)}
            style={{ position: 'relative', background: showNotifPanel ? 'rgba(201,169,110,.12)' : 'none', border: `1px solid ${showNotifPanel ? 'rgba(201,169,110,.3)' : darkMode ? 'rgba(244,240,230,.1)' : 'rgba(14,14,13,.1)'}`, borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', color: darkMode ? 'rgba(244,240,230,.6)' : 'rgba(14,14,13,.5)', transition: 'all .2s', display: 'flex', alignItems: 'center' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18">
              <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
            {totalAlerts > 0 && (
              <span style={{ position: 'absolute', top: '2px', right: '2px', minWidth: '16px', height: '16px', borderRadius: '8px', background: '#e05454', border: `2px solid ${darkMode ? '#0c1f15' : '#fff'}`, fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 2px' }}>{totalAlerts}</span>
            )}
          </button>
          </Tooltip>

          {showNotifPanel && (
            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: '320px', background: darkMode ? '#0f2117' : '#fff', border: `1px solid ${darkMode ? 'rgba(201,169,110,.15)' : 'rgba(14,14,13,.12)'}`, boxShadow: '0 16px 48px rgba(0,0,0,.25)', zIndex: 300, overflow: 'hidden', borderRadius: '16px' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${darkMode ? 'rgba(244,240,230,.06)' : 'rgba(14,14,13,.08)'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', letterSpacing: '.12em', textTransform: 'uppercase', color: darkMode ? 'rgba(244,240,230,.4)' : 'rgba(14,14,13,.4)' }}>Central de Alertas</div>
                <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: totalAlerts > 0 ? '#e05454' : '#10b981' }}>{totalAlerts} alerta{totalAlerts !== 1 ? 's' : ''}</div>
              </div>

              <div style={{ maxHeight: '380px', overflowY: 'auto' }}>
                {overdueFU.length > 0 && (
                  <div style={{ padding: '10px 16px', borderBottom: `1px solid ${darkMode ? 'rgba(244,240,230,.04)' : 'rgba(14,14,13,.06)'}` }}>
                    <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: '#e05454', letterSpacing: '.1em', marginBottom: '6px', textTransform: 'uppercase' }}>📅 Follow-up Atrasado ({overdueFU.length})</div>
                    {overdueFU.map(c => (
                      <div
                        key={c.id}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', cursor: 'pointer', borderBottom: `1px solid ${darkMode ? 'rgba(244,240,230,.03)' : 'rgba(14,14,13,.04)'}` }}
                        onClick={() => { setActiveCrmId(c.id); setCrmProfileTab('overview'); setSection('crm'); setShowNotifPanel(false) }}
                      >
                        <div>
                          <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', color: darkMode ? 'rgba(244,240,230,.8)' : 'rgba(14,14,13,.8)', fontWeight: 500 }}>{c.name}</div>
                          <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: darkMode ? 'rgba(244,240,230,.3)' : 'rgba(14,14,13,.4)' }}>{c.nextFollowUp}</div>
                        </div>
                        <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: '#e05454', background: 'rgba(224,84,84,.08)', padding: '2px 7px', flexShrink: 0, borderRadius: '4px' }}>ATRASADO</div>
                      </div>
                    ))}
                  </div>
                )}

                {stalePropsN.length > 0 && (
                  <div style={{ padding: '10px 16px' }}>
                    <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: '#f97316', letterSpacing: '.1em', marginBottom: '6px', textTransform: 'uppercase' }}>🏠 Imóvel Sem Movimento &gt;60d ({stalePropsN.length})</div>
                    {stalePropsN.map(p => {
                      const ld = p.listingDate as string
                      const days = Math.floor((todayTs - new Date(ld).getTime()) / 86400000)
                      return (
                        <div
                          key={p.id as string}
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0', cursor: 'pointer', borderBottom: `1px solid ${darkMode ? 'rgba(244,240,230,.03)' : 'rgba(14,14,13,.04)'}` }}
                          onClick={() => { setSection('imoveis'); setShowNotifPanel(false) }}
                        >
                          <div>
                            <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.82rem', color: darkMode ? 'rgba(244,240,230,.8)' : 'rgba(14,14,13,.8)', fontWeight: 500 }}>{p.nome as string}</div>
                            <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: darkMode ? 'rgba(244,240,230,.3)' : 'rgba(14,14,13,.4)' }}>{p.zona as string} · €{((p.preco as number) / 1e6).toFixed(1)}M</div>
                          </div>
                          <div style={{ fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', color: '#f97316', background: 'rgba(249,115,22,.08)', padding: '2px 7px', flexShrink: 0, borderRadius: '4px' }}>{days}d</div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {totalAlerts === 0 && (
                  <div style={{ padding: '32px', textAlign: 'center' as const }}>
                    <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>✅</div>
                    <div style={{ fontFamily: "'Jost',sans-serif", fontSize: '.85rem', color: darkMode ? 'rgba(244,240,230,.4)' : 'rgba(14,14,13,.4)' }}>Tudo em dia — sem alertas activos</div>
                  </div>
                )}
              </div>

              <div style={{ padding: '10px 16px', borderTop: `1px solid ${darkMode ? 'rgba(244,240,230,.06)' : 'rgba(14,14,13,.08)'}`, display: 'flex', gap: '8px' }}>
                <button type="button"
                  style={{ flex: 1, padding: '7px', background: darkMode ? 'rgba(28,74,53,.2)' : 'rgba(28,74,53,.06)', border: '1px solid rgba(28,74,53,.2)', color: '#1c4a35', fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', cursor: 'pointer', letterSpacing: '.08em', borderRadius: '6px', transition: 'all .2s' }}
                  onClick={() => { setSection('crm'); setShowNotifPanel(false) }}
                >
                  Ver CRM →
                </button>
                <button type="button"
                  style={{ flex: 1, padding: '7px', background: 'rgba(14,14,13,.04)', border: `1px solid ${darkMode ? 'rgba(244,240,230,.08)' : 'rgba(14,14,13,.1)'}`, color: darkMode ? 'rgba(244,240,230,.4)' : 'rgba(14,14,13,.4)', fontFamily: 'var(--font-dm-mono),monospace', fontSize: '.52rem', cursor: 'pointer', borderRadius: '6px', transition: 'all .2s' }}
                  onClick={() => setShowNotifPanel(false)}
                >
                  Fechar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Dark mode toggle */}
        <Tooltip content="Modo escuro" shortcut="⌘D" darkMode={darkMode}>
          <button type="button"
            aria-label={darkMode ? 'Activar modo claro' : 'Activar modo escuro'}
            tabIndex={0}
            onClick={() => setDarkMode(!darkMode)}
            style={{ padding: '6px 10px', borderRadius: '8px', border: `1px solid ${darkMode ? 'rgba(244,240,230,.1)' : 'rgba(14,14,13,.1)'}`, cursor: 'pointer', fontSize: '.78rem', background: 'transparent', color: darkMode ? 'rgba(244,240,230,.5)' : 'rgba(14,14,13,.4)', transition: 'all .2s', flexShrink: 0 }}
            title={darkMode ? 'Modo claro' : 'Modo escuro'}
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
        </Tooltip>
      </div>
    </header>
  )
}
