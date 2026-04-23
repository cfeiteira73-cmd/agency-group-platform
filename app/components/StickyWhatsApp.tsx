'use client'
// ─── StickyWhatsApp — Floating desktop CTA ────────────────────────────────────
// Desktop-only (hidden on mobile via CSS — BottomNav handles mobile).
// Appears after 600px scroll. Dismissed with × button (sessionStorage).
// Positioned bottom-left to avoid conflict with Sofia widget (bottom-right).

import { useEffect, useState } from 'react'

export default function StickyWhatsApp() {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    // Don't show if already dismissed this session
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('ag_wa_dismissed')) {
      setDismissed(true)
      return
    }

    const onScroll = () => {
      if (window.scrollY > 600) setVisible(true)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function handleDismiss() {
    setDismissed(true)
    setVisible(false)
    try { sessionStorage.setItem('ag_wa_dismissed', '1') } catch { /* ignore */ }
  }

  if (dismissed || !visible) return null

  return (
    <>
      <style>{`
        /* Mobile: hidden — BottomNav handles mobile contact */
        @media (max-width: 767px) { .ag-sticky-wa { display: none !important; } }
        /* Portal: hidden */
      `}</style>
      <div
        className="ag-sticky-wa"
        style={{
          position: 'fixed',
          bottom: '28px',
          left: '24px',
          zIndex: 90,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '8px',
        }}
        role="complementary"
        aria-label="Contacto WhatsApp"
      >
        {/* Expanded tooltip — show on hover/focus */}
        {expanded && (
          <div style={{
            background: '#0c1f15',
            border: '1px solid rgba(201,169,110,.2)',
            padding: '14px 18px',
            maxWidth: '220px',
            boxShadow: '0 8px 32px rgba(0,0,0,.4)',
          }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(201,169,110,.6)', marginBottom: '6px' }}>
              Resposta em &lt; 2h
            </div>
            <div style={{ fontFamily: "'Cormorant',serif", fontSize: '.95rem', color: '#f4f0e6', lineHeight: 1.4, marginBottom: '10px' }}>
              Fale directamente<br />com um consultor.
            </div>
            <a
              href="https://wa.me/351919948986?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20im%C3%B3veis%20em%20Portugal."
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', letterSpacing: '.1em', textTransform: 'uppercase', color: '#25D366', textDecoration: 'none' }}
            >
              Iniciar conversa →
            </a>
          </div>
        )}

        {/* Main button row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0' }}>
          {/* WhatsApp pill */}
          <a
            href="https://wa.me/351919948986?text=Ol%C3%A1%2C%20gostaria%20de%20saber%20mais%20sobre%20im%C3%B3veis%20em%20Portugal."
            target="_blank"
            rel="noopener noreferrer"
            onMouseEnter={() => setExpanded(true)}
            onMouseLeave={() => setExpanded(false)}
            onFocus={() => setExpanded(true)}
            onBlur={() => setExpanded(false)}
            aria-label="Contactar via WhatsApp"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: '#25D366',
              color: '#fff',
              textDecoration: 'none',
              padding: '10px 16px',
              boxShadow: '0 4px 20px rgba(37,211,102,.35)',
              transition: 'transform .2s, box-shadow .2s',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a9.88 9.88 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            <span style={{ fontFamily: "'DM Mono',monospace", fontSize: '.48rem', letterSpacing: '.1em', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
              Falar Agora
            </span>
          </a>
          {/* Dismiss button */}
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Fechar"
            style={{
              background: 'rgba(0,0,0,.35)',
              border: 'none',
              color: 'rgba(255,255,255,.55)',
              cursor: 'pointer',
              padding: '10px 8px',
              fontSize: '.65rem',
              lineHeight: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ×
          </button>
        </div>
      </div>
    </>
  )
}
