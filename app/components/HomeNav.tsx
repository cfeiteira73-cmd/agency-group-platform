'use client'

import { useEffect, useState } from 'react'
import { CurrencySelector } from './CurrencyWidget'

export default function HomeNav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [isAgent, setIsAgent] = useState(false)

  // Auth check on mount — server cookie is the single source of truth for isAgent UI state.
  // localStorage is no longer consulted — it created a dual-state desync where the UI could
  // show "Portal →" while the ag-auth-token cookie had already expired, sending users to
  // /portal/login unexpectedly. /api/auth/me is always the authoritative check.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')

    if (token) {
      // Magic-link verify — httpOnly cookie set server-side by /api/auth/verify on success.
      // localStorage not written — cookie alone drives access from this point forward.
      fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`, {
        cache: 'no-store',
        credentials: 'include',
        headers: { 'Accept': 'application/json' },
      })
        .then(r => r.json())
        .then(d => {
          if (d.ok && d.email) {
            sessionStorage.removeItem('ag_pending_email')
            setIsAgent(true)
            // Navigate WITHOUT the token — one-time-use, already consumed by the fetch above.
            // portal/page.tsx would fail to re-verify the same token.
            window.location.href = '/portal'
          } else {
            window.dispatchEvent(new CustomEvent('ag:toast', { detail: { msg: 'Link inválido ou expirado. Pede um novo.', type: 'error' } }))
          }
        })
        .catch(err => console.error('[HomeNav] magic-link verify failed:', err?.message ?? err))
      return
    }

    // Clean up any stale localStorage entry from the previous auth model (silent, no UI effect)
    try { localStorage.removeItem('ag_auth') } catch { /* ignore */ }

    // Server-confirmed auth state — single source of truth.
    // Fail silently: non-agent UI ("Área Agentes") is always the safe default.
    fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d?.ok === true) setIsAgent(true) })
      .catch(() => { /* non-agent UI is correct default when server unreachable */ })

    if (params.get('acesso') === 'required') {
      window.location.href = '/portal'
    }
  }, [])

  // Escape key closes menu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false)
        document.body.style.overflow = ''
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // ─── Session gate ──────────────────────────────────────────────────────────
  // Every portal CTA click validates the session with the server before
  // navigating.  This prevents stale localStorage or a cached auth state
  // from sending users (or Edge) to /portal when no valid session exists.
  // Authenticated users (valid ag-auth-token cookie) → /portal.
  // Everyone else → /portal/login.
  function handlePortalClick(e: React.MouseEvent) {
    e.preventDefault()
    fetch('/api/auth/me', { cache: 'no-store', credentials: 'include' })
      .then(r => r.json())
      .then(data => {
        if (data?.ok === true) {
          window.location.href = '/portal'
        } else {
          window.location.href = '/portal/login'
        }
      })
      .catch(() => {
        window.location.href = '/portal/login'
      })
  }

  return (
    <>
      <nav id="mainNav">
        <a href="/" className="logo">
          <span className="la ag-logo-text">Agency</span>
          <span className="lg ag-logo-text">Group</span>
          <span className="ag-logo-line" aria-hidden="true" />
        </a>
        <ul className="nav-links">
          <li><a href="/imoveis">Imóveis</a></li>
          <li><a href="/vender">Vender</a></li>
          <li><a href="/investir">Investir</a></li>
          <li><a href="/#zonas">Zonas</a></li>
          <li><a href="/#simulador">Crédito</a></li>
          <li><a href="/reports">Reports</a></li>
          <li><a href="/off-market">Off-Market</a></li>
          <li><a href="/contacto">Contacto</a></li>
        </ul>
        <div className="nav-end" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div className="nav-currency"><CurrencySelector /></div>
          {isAgent ? (
            <>
              <a href="/portal" onClick={handlePortalClick} className="nav-cta nav-cta-full">Portal →</a>
              <a href="/portal" onClick={handlePortalClick} className="nav-cta nav-cta-short" aria-label="Portal Agentes">{'Área\nAgentes'}</a>
            </>
          ) : (
            <>
              <a href="/portal/login" onClick={handlePortalClick} className="nav-cta nav-cta-full">Área Agentes</a>
              <a href="/portal/login" onClick={handlePortalClick} className="nav-cta nav-cta-short" aria-label="Área Agentes">{'Área\nAgentes'}</a>
            </>
          )}
          <button
            type="button"
            className={`nav-burger${menuOpen?' open':''}`}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
            onClick={() => { setMenuOpen(o => !o); document.body.style.overflow = menuOpen ? '' : 'hidden' }}
          >
            <span/><span/><span/>
          </button>
        </div>
      </nav>

      {/* MOBILE DRAWER */}
      <div className={`nav-drawer${menuOpen?' open':''}`} aria-hidden={!menuOpen}>
        <div className="nav-drawer-ov" onClick={() => { setMenuOpen(false); document.body.style.overflow = '' }} />
        <nav className="nav-drawer-panel" aria-label="Menu móvel">
          <div className="nav-drawer-links">
            <a href="/imoveis" onClick={()=>{setMenuOpen(false);document.body.style.overflow=''}}>Imóveis</a>
            <a href="/vender" onClick={()=>{setMenuOpen(false);document.body.style.overflow=''}}>Vender</a>
            <a href="/investir" onClick={()=>{setMenuOpen(false);document.body.style.overflow=''}}>Investir</a>
            <a href="/#zonas" onClick={()=>{setMenuOpen(false);document.body.style.overflow=''}}>Zonas</a>
            <a href="/#simulador" onClick={()=>{setMenuOpen(false);document.body.style.overflow=''}}>Crédito</a>
            <a href="/reports" onClick={()=>{setMenuOpen(false);document.body.style.overflow=''}}>Reports</a>
            <a href="/off-market" onClick={()=>{setMenuOpen(false);document.body.style.overflow=''}}>Off-Market</a>
            <a href="/contacto" onClick={()=>{setMenuOpen(false);document.body.style.overflow=''}}>Contacto</a>
            <a href="/equipa" onClick={()=>{setMenuOpen(false);document.body.style.overflow=''}}>Equipa</a>
            <a href="/vendidos" onClick={()=>{setMenuOpen(false);document.body.style.overflow=''}}>Vendidos</a>
          </div>
          {isAgent
            ? <a href="/portal" onClick={handlePortalClick} className="nav-drawer-cta">Portal Agentes →</a>
            : <a href="/portal/login" onClick={handlePortalClick} className="nav-drawer-cta">Área Agentes</a>
          }
        </nav>
      </div>
    </>
  )
}
