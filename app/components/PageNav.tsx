'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface PageNavProps {
  activeHref?: string
}

export default function PageNav({ activeHref }: PageNavProps) {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setMenuOpen(false); document.body.style.overflow = '' } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  const links = [
    { href: '/', label: 'Início' },
    { href: '/imoveis', label: 'Imóveis' },
    { href: '/vender', label: 'Vender' },
    { href: '/investir', label: 'Investir' },
    { href: '/reports', label: 'Reports' },
    { href: '/off-market', label: 'Off-Market' },
    { href: '/contacto', label: 'Contacto' },
  ]

  return (
    <>
      <style>{`
        .pn-burger{display:none;flex-direction:column;justify-content:center;gap:5px;width:44px;height:44px;background:none;border:none;cursor:pointer;padding:10px;flex-shrink:0}
        .pn-burger span{display:block;width:22px;height:1.5px;background:#c9a96e;transition:transform .3s,opacity .3s}
        .pn-burger.open span:nth-child(1){transform:translateY(6.5px) rotate(45deg)}
        .pn-burger.open span:nth-child(2){opacity:0}
        .pn-burger.open span:nth-child(3){transform:translateY(-6.5px) rotate(-45deg)}
        .pn-drawer{position:fixed;inset:0;z-index:999;pointer-events:none;opacity:0;transition:opacity .3s}
        .pn-drawer.open{pointer-events:all;opacity:1}
        .pn-drawer-ov{position:absolute;inset:0;background:rgba(4,10,6,.7);backdrop-filter:blur(4px)}
        .pn-drawer-panel{position:absolute;top:0;right:0;bottom:0;width:min(320px,85vw);background:#0c1f15;transform:translateX(100%);transition:transform .4s cubic-bezier(.4,0,.2,1);display:flex;flex-direction:column;padding:80px 36px 48px;border-left:1px solid rgba(201,169,110,.12)}
        .pn-drawer.open .pn-drawer-panel{transform:translateX(0)}
        .pn-drawer-links{display:flex;flex-direction:column;gap:2px}
        .pn-drawer-links a{font-family:'Cormorant',serif;font-size:1.8rem;font-weight:300;color:#f4f0e6;letter-spacing:-.01em;padding:10px 0;border-bottom:1px solid rgba(255,255,255,.06);text-decoration:none;transition:color .2s,padding-left .2s}
        .pn-drawer-links a:hover,.pn-drawer-links a.active{color:#c9a96e}
        .pn-drawer-links a:last-child{border-bottom:none}
        .pn-drawer-cta{margin-top:auto;background:#c9a96e;color:#0c1f15;font-family:'DM Mono',monospace;font-size:.6rem;font-weight:600;letter-spacing:.14em;text-transform:uppercase;padding:16px 24px;text-align:center;text-decoration:none;display:block}
        .pn-desktop-links{display:flex;gap:32px;align-items:center}
        @media(max-width:960px){
          .pn-burger{display:flex!important}
          .pn-desktop-links{display:none!important}
        }
      `}</style>

      <nav style={{ position:'fixed',top:0,left:0,right:0,zIndex:900,background:'rgba(12,31,21,.96)',backdropFilter:'blur(20px)',borderBottom:'1px solid rgba(201,169,110,.12)',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 40px',height:'68px' }}>
        <Link href="/" style={{ fontFamily:"'Cormorant', serif",fontSize:'1.25rem',fontWeight:300,color:'#f4f0e6',textDecoration:'none',letterSpacing:'.08em' }}>
          Agency<span style={{ color:'#c9a96e' }}>Group</span>
        </Link>
        <div className="pn-desktop-links">
          {links.map(l => (
            <Link key={l.href} href={l.href} style={{ fontFamily:"'Jost', sans-serif",fontSize:'.65rem',letterSpacing:'.16em',color: l.href === activeHref ? '#c9a96e' : 'rgba(244,240,230,.55)',textDecoration:'none',textTransform:'uppercase' }}>{l.label}</Link>
          ))}
          <Link href="/portal/login" style={{ fontFamily:"'DM Mono', monospace",fontSize:'.58rem',letterSpacing:'.14em',color:'#0c1f15',background:'#c9a96e',padding:'10px 18px',textDecoration:'none',textTransform:'uppercase' }}>Área Agentes</Link>
        </div>
        <button
          className={`pn-burger${menuOpen?' open':''}`}
          aria-label={menuOpen?'Fechar menu':'Abrir menu'}
          aria-expanded={menuOpen}
          type="button"
          onClick={() => { setMenuOpen(o=>!o); document.body.style.overflow = menuOpen?'':'hidden' }}
        >
          <span/><span/><span/>
        </button>
      </nav>

      <div className={`pn-drawer${menuOpen?' open':''}`} aria-hidden={!menuOpen}>
        <div className="pn-drawer-ov" onClick={() => { setMenuOpen(false); document.body.style.overflow='' }} />
        <div className="pn-drawer-panel">
          <nav className="pn-drawer-links" aria-label="Menu mobile">
            {links.map(l => (
              <Link key={l.href} href={l.href} className={l.href===activeHref?'active':''} onClick={() => { setMenuOpen(false); document.body.style.overflow='' }}>{l.label}</Link>
            ))}
          </nav>
          <Link href="/portal/login" className="pn-drawer-cta" onClick={() => { setMenuOpen(false); document.body.style.overflow='' }}>Área Agentes →</Link>
        </div>
      </div>
    </>
  )
}
