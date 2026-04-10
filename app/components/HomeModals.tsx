'use client'

import { useEffect, useState } from 'react'

// ─── Shared modal open/close event bus (window custom events) ────────────────
// RSC page cannot pass callbacks, so modals subscribe to custom DOM events:
//   window.dispatchEvent(new CustomEvent('ag:open-offmarket'))
//   window.dispatchEvent(new CustomEvent('ag:open-agmodal'))
// Toast notifications use:
//   window.dispatchEvent(new CustomEvent('ag:toast', { detail: { msg, type } }))

function showToast(msg: string, type: 'success' | 'error' | 'info' = 'info') {
  window.dispatchEvent(new CustomEvent('ag:toast', { detail: { msg, type } }))
}

// ── OFF-MARKET MODAL DISABLED ─────────────────────────────────────────────────
// Removed by request — modal was appearing automatically on page open (exit intent).
// Returns null everywhere: desktop + mobile. Zero DOM, zero overlay risk.
// To re-enable: remove the `return null` line below.
export default function HomeModals() {
  return null  // DISABLED — remove this line to restore
  // ── MOBILE GUARD — computed once at render time, client-side only ─────────
  // Touch/coarse-pointer/narrow-viewport → all modals permanently disabled.
  // This is NOT a hook — it's a plain expression evaluated before hooks.
  // Hooks are still called below (React rules compliance) but each guard bails
  // immediately, so zero side-effects run on mobile.
  const isMobile = typeof window !== 'undefined' && (
    window.innerWidth <= 1099 ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia('(pointer: coarse)').matches ||
    window.matchMedia('(any-pointer: coarse)').matches ||
    ('ontouchstart' in window)
  )

  const [modalOpen, setModalOpen] = useState(false)
  const [agModal, setAgModal] = useState(false)
  const [agEmailVal, setAgEmailVal] = useState('')
  const [agSent, setAgSent] = useState(false)
  const [agSending, setAgSending] = useState(false)

  // ── EFFECT 1: Exit intent — desktop ONLY ─────────────────────────────────
  // Android Chrome fires synthetic 'mouseleave' events during touch scrolling
  // near the top of the viewport — this was triggering the full-screen
  // dark-green modal-ov overlay (the "green screen" bug).
  useEffect(() => {
    if (isMobile) return  // MOBILE: never register listener, never open modal

    let triggered = false
    const handleMouseLeave = (e: MouseEvent) => {
      if (triggered) return
      if (e.clientY <= 10) {
        triggered = true
        setTimeout(() => {
          if (!isMobile) setModalOpen(true)  // double-guard on the setter
        }, 300)
      }
    }
    document.addEventListener('mouseleave', handleMouseLeave)
    return () => document.removeEventListener('mouseleave', handleMouseLeave)
  }, [isMobile])

  // ── EFFECT 2: Custom event bus — desktop ONLY ────────────────────────────
  useEffect(() => {
    if (isMobile) return  // MOBILE: no listeners, no overlay triggers

    const openOffMarket = () => { if (!isMobile) openModal() }
    const openAgModal   = () => { if (!isMobile) setAgModal(true) }
    const closeAll      = () => { closeModal(); setAgModal(false) }

    window.addEventListener('ag:open-offmarket', openOffMarket)
    window.addEventListener('ag:open-agmodal',   openAgModal)
    window.addEventListener('ag:close-modals',   closeAll)
    return () => {
      window.removeEventListener('ag:open-offmarket', openOffMarket)
      window.removeEventListener('ag:open-agmodal',   openAgModal)
      window.removeEventListener('ag:close-modals',   closeAll)
    }
  }, [isMobile])

  // ── EFFECT 3: Off-market modal focus trap + Escape ───────────────────────
  useEffect(() => {
    if (isMobile) return   // MOBILE: never runs (modal never opens)
    if (!modalOpen) return
    const timer = setTimeout(() => {
      const modal = document.querySelector('#offModal [role="dialog"], #offModal')
      const focusable = (modal ?? document.getElementById('offModal'))?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      focusable?.focus()
    }, 50)
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    document.addEventListener('keydown', handleKeyDown)
    return () => { clearTimeout(timer); document.removeEventListener('keydown', handleKeyDown) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalOpen, isMobile])

  // ── EFFECT 4: AG portal modal focus trap + Escape ────────────────────────
  useEffect(() => {
    if (isMobile) return   // MOBILE: never runs (modal never opens)
    if (!agModal) return
    const timer = setTimeout(() => {
      const modal = document.querySelector('[data-agmodal]')
      const focusable = modal?.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
      focusable?.focus()
    }, 50)
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') closeAgModal() }
    document.addEventListener('keydown', handleKeyDown)
    return () => { clearTimeout(timer); document.removeEventListener('keydown', handleKeyDown) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agModal, isMobile])

  // ── HELPERS ───────────────────────────────────────────────────────────────
  function openModal() {
    if (isMobile) return  // MOBILE: blocked at function level
    setModalOpen(true)
    document.body.style.overflow = 'hidden'
    setTimeout(() => document.getElementById('offPwd')?.focus(), 300)
  }
  function closeModal() { setModalOpen(false); document.body.style.overflow = '' }

  async function checkOff() {
    const input = document.getElementById('offPwd') as HTMLInputElement
    const code = input?.value ?? ''
    try {
      const res = await fetch('/api/auth/offmarket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const { valid } = await res.json()
      if (valid) {
        closeModal()
        localStorage.setItem('ag_offmarket', '1')
        showToast('Acesso concedido. Portfolio off-market a carregar...', 'success')
      } else {
        const err = document.getElementById('offErr')
        if (err) err.style.display = 'block'
        if (input) input.value = ''
      }
    } catch {
      const err = document.getElementById('offErr')
      if (err) err.style.display = 'block'
      if (input) input.value = ''
    }
  }

  async function agLoginModal() {
    const e = agEmailVal.trim()
    if (!e || !e.includes('@')) { showToast('Introduz o teu email.', 'error'); return }
    sessionStorage.setItem('ag_pending_email', e)
    setAgSending(true)
    try {
      const res = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e }),
      })
      const data = await res.json()
      if (data.ok) {
        setAgSent(true)
      } else {
        showToast(data.error || 'Erro no envio. Tenta novamente.', 'error')
        setAgSending(false)
      }
    } catch {
      showToast('Erro de rede. Tenta novamente.', 'error')
      setAgSending(false)
    }
  }

  function closeAgModal() {
    setAgModal(false)
    setAgSent(false)
    setAgSending(false)
    setAgEmailVal('')
  }

  // ── RENDER GUARD — mobile returns null: zero DOM, zero overlay risk ───────
  // All hooks above were called (React compliance), but no side-effects ran.
  // modal-ov is NOT in the DOM on mobile → impossible to become visible.
  if (isMobile) return null

  return (
    <>
      {/* MODAL OFF-MARKET */}
      <div className={`modal-ov${modalOpen?' open':''}`} id="offModal" role="dialog" aria-modal="true" aria-label="Acesso ao Portfolio Off-Market" onClick={e=>{if(e.target===e.currentTarget)closeModal()}}>
        <div className="modal-box">
          <button type="button" className="modal-x" onClick={closeModal} aria-label="Fechar modal">✕</button>
          <div className="modal-eye">Acesso Restrito</div>
          <h2 className="modal-h2">Portfolio<br/><em style={{fontStyle:'italic',color:'var(--g)'}}>Off-Market</em></h2>
          <p className="modal-desc">As propriedades mais raras nunca chegam aos portais. Este portfolio existe apenas para quem foi convidado.</p>
          <input className="modal-inp" type="password" id="offPwd" placeholder="código de acesso" onKeyDown={e=>{if(e.key==='Enter')checkOff()}}/>
          <button type="button" className="modal-btn" onClick={checkOff}>Aceder ao Portfolio</button>
          <div className="modal-err" id="offErr">Código inválido · Solicitar acesso: geral@agencygroup.pt</div>
        </div>
      </div>

      {/* MODAL ÁREA AGENTES */}
      {agModal && (
        <div data-agmodal role="dialog" aria-modal="true" aria-label="Acesso Portal Consultor" style={{position:'fixed',inset:0,zIndex:2000,background:'rgba(12,31,21,.92)',backdropFilter:'blur(24px)',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}} onClick={closeAgModal}>
          <div style={{background:'#0c1f15',border:'1px solid rgba(201,169,110,.18)',padding:'52px 44px',maxWidth:'420px',width:'100%',position:'relative',boxShadow:'0 40px 100px rgba(0,0,0,.5)'}} onClick={e=>e.stopPropagation()}>
            <button type="button" onClick={closeAgModal} style={{position:'absolute',top:'18px',right:'18px',background:'none',border:'none',color:'rgba(244,240,230,.3)',cursor:'pointer',fontSize:'1rem',lineHeight:1,padding:'4px 8px'}}>✕</button>
            <div style={{fontFamily:"'DM Mono',monospace",fontSize:'.52rem',letterSpacing:'.22em',textTransform:'uppercase',color:'rgba(201,169,110,.65)',marginBottom:'8px'}}>Acesso Restrito · AMI 22506</div>
            <h2 style={{fontFamily:"'Cormorant',serif",fontWeight:300,fontSize:'1.9rem',color:'#f4f0e6',lineHeight:1.1,marginBottom:'6px'}}>Portal do<br/><em style={{fontStyle:'italic',color:'#c9a96e'}}>Consultor</em></h2>
            {!agSent ? (
              <>
                <p style={{fontSize:'.8rem',color:'rgba(244,240,230,.4)',lineHeight:1.75,margin:'20px 0 24px'}}>Introduz o teu email profissional. Será enviado um pedido de acesso ao administrador.</p>
                <input
                  type="email"
                  value={agEmailVal}
                  onChange={ev=>setAgEmailVal(ev.target.value)}
                  onKeyDown={ev=>ev.key==='Enter'&&!agSending&&agLoginModal()}
                  placeholder="email@agencygroup.pt"
                  autoFocus
                  style={{width:'100%',background:'rgba(244,240,230,.05)',border:'1px solid rgba(244,240,230,.12)',borderBottom:'1px solid rgba(201,169,110,.3)',color:'#f4f0e6',padding:'13px 14px',fontSize:'.88rem',fontFamily:"'Jost',sans-serif",outline:'none',marginBottom:'12px',boxSizing:'border-box',letterSpacing:'.02em'}}
                />
                <button
                  type="button"
                  onClick={agLoginModal}
                  disabled={agSending}
                  style={{width:'100%',background:agSending?'rgba(201,169,110,.5)':'#c9a96e',color:'#0c1f15',border:'none',padding:'14px',fontFamily:"'Jost',sans-serif",fontSize:'.6rem',fontWeight:600,letterSpacing:'.2em',textTransform:'uppercase',cursor:agSending?'not-allowed':'pointer',transition:'background .25s'}}
                >
                  {agSending ? 'A enviar...' : 'Solicitar Acesso →'}
                </button>
              </>
            ) : (
              <div style={{textAlign:'center',padding:'24px 0'}}>
                <div style={{width:'52px',height:'52px',borderRadius:'50%',background:'rgba(28,74,53,.4)',border:'1px solid rgba(28,74,53,.8)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 20px',fontSize:'1.2rem'}}>✓</div>
                <p style={{fontSize:'.88rem',color:'rgba(244,240,230,.7)',lineHeight:1.75,marginBottom:'8px'}}>Pedido enviado para<br/><strong style={{color:'#c9a96e'}}>{agEmailVal}</strong></p>
                <p style={{fontSize:'.75rem',color:'rgba(244,240,230,.35)',lineHeight:1.65}}>Receberás um link de acesso por email assim que o teu pedido for aprovado.</p>
              </div>
            )}
            <div style={{marginTop:'28px',paddingTop:'16px',borderTop:'1px solid rgba(244,240,230,.05)',fontFamily:"'DM Mono',monospace",fontSize:'.52rem',color:'rgba(244,240,230,.25)',letterSpacing:'.1em',textTransform:'uppercase'}}>
              Agency Group · Mediação Imobiliária Lda · AMI 22506
            </div>
          </div>
        </div>
      )}
    </>
  )
}
