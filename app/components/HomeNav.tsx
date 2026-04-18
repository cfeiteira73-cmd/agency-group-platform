'use client'

import { useEffect, useState } from 'react'
import { CurrencySelector } from './CurrencyWidget'

export default function HomeNav() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [isAgent, setIsAgent] = useState(false)
  const [portalHref, setPortalHref] = useState('/portal')

  // Auth check on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token = params.get('token')

    if (token) {
      fetch(`/api/auth/verify?token=${encodeURIComponent(token)}`)
        .then(r => r.json())
        .then(d => {
          if (d.ok) {
            const email = d.email || sessionStorage.getItem('ag_pending_email') || ''
            sessionStorage.removeItem('ag_pending_email')
            localStorage.setItem('ag_auth', JSON.stringify({ v: '1', exp: Date.now() + 8 * 60 * 60 * 1000, email, token }))
            setIsAgent(true)
            setPortalHref(`/portal?token=${encodeURIComponent(token)}`)
            window.location.href = `/portal?token=${encodeURIComponent(token)}`
          } else {
            window.dispatchEvent(new CustomEvent('ag:toast', { detail: { msg: 'Link inválido ou expirado. Pede um novo.', type: 'error' } }))
          }
        })
        .catch(err => console.error('[HomeNav] magic-link verify failed:', err?.message ?? err))
      return
    }

    const stored = localStorage.getItem('ag_auth')
    if (stored) {
      try {
        const d = JSON.parse(stored)
        if (d.v === '1' && Date.now() < d.exp) {
          setIsAgent(true)
          // Never re-append the original magic-link token: it is one-time-use
          // and has already been consumed.  The ag-auth-token session cookie
          // set by /api/auth/verify handles authentication for all subsequent
          // visits — just navigate to /portal.
          setPortalHref('/portal')
          return
        } else {
          localStorage.removeItem('ag_auth')
        }
      } catch { localStorage.removeItem('ag_auth') }
    }

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
              <a href={portalHref} className="nav-cta nav-cta-full">Portal →</a>
              <a href={portalHref} className="nav-cta nav-cta-short" aria-label="Portal Agentes">AG</a>
            </>
          ) : (
            <>
              <a href="/portal/login" className="nav-cta nav-cta-full">Área Agentes</a>
              <a href="/portal/login" className="nav-cta nav-cta-short" aria-label="Área Agentes">AG</a>
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
            <a href="/#zonas" onClick={()=>{setMenuOpen(false);document.body.style.overflow=''}}>Zonas</a>
            <a href="/#simulador" onClick={()=>{setMenuOpen(false);document.body.style.overflow=''}}>Crédito</a>
            <a href="/reports" onClick={()=>{setMenuOpen(false);document.body.style.overflow=''}}>Reports</a>
            <a href="/off-market" onClick={()=>{setMenuOpen(false);document.body.style.overflow=''}}>Off-Market</a>
            <a href="/contacto" onClick={()=>{setMenuOpen(false);document.body.style.overflow=''}}>Contacto</a>
            <a href="/equipa" onClick={()=>{setMenuOpen(false);document.body.style.overflow=''}}>Equipa</a>
            <a href="/vendidos" onClick={()=>{setMenuOpen(false);document.body.style.overflow=''}}>Vendidos</a>
          </div>
          {isAgent
            ? <a href="/portal" className="nav-drawer-cta">Portal Agentes →</a>
            : <a href="/portal/login" className="nav-drawer-cta">Área Agentes</a>
          }
        </nav>
      </div>
    </>
  )
}
