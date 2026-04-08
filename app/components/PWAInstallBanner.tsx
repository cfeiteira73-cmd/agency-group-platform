'use client'

import { useEffect, useState } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function PWAInstallBanner() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [show, setShow] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Don't show if already installed or previously dismissed
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      localStorage.getItem('ag_pwa_dismissed')
    ) return

    // High-intent property detail pages get a shorter delay (8s vs 30s)
    const delay = window.location.pathname.startsWith('/imoveis/') ? 8_000 : 30_000

    // iOS detection
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as unknown as { MSStream: unknown }).MSStream
    setIsIOS(ios)

    if (ios) {
      // iOS: show manual install hint after delay on mobile
      if (window.innerWidth <= 768) {
        setTimeout(() => setShow(true), delay)
      }
      return
    }

    // Android/Chrome: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
      if (window.innerWidth <= 768) {
        setTimeout(() => setShow(true), delay)
      }
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function handleInstall() {
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setShow(false)
    setPrompt(null)
  }

  function handleDismiss() {
    setShow(false)
    setDismissed(true)
    localStorage.setItem('ag_pwa_dismissed', '1')
  }

  if (!show || dismissed) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: '400px',
        background: 'rgba(7,15,10,0.97)',
        border: '1px solid rgba(201,169,110,0.35)',
        borderRadius: 0,
        padding: '16px 18px',
        zIndex: 9999,
        backdropFilter: 'blur(20px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        animation: 'ag-slide-up 0.35s ease',
      }}
    >
      <style>{`
        @keyframes ag-slide-up {
          from { opacity: 0; transform: translateX(-50%) translateY(20px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* App icon */}
        <div style={{
          width: '44px', height: '44px', borderRadius: 0,
          background: 'linear-gradient(135deg,#0f2818,#1a3d28)',
          border: '1px solid rgba(201,169,110,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          fontSize: '22px',
        }}>AG</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "var(--font-cormorant, 'Cormorant', serif)",
            color: '#f4f0e6',
            fontSize: '1rem',
            fontWeight: 400,
            letterSpacing: '.02em',
          }}>
            Agency Group
          </div>
          <div style={{
            fontFamily: "'DM Mono', monospace",
            color: 'rgba(201,169,110,0.7)',
            fontSize: '11px',
            letterSpacing: '.05em',
            marginTop: '2px',
          }}>
            Adicionar ao ecrã principal
          </div>
        </div>

        <button
          onClick={handleDismiss}
          style={{
            background: 'none', border: 'none', color: 'rgba(200,210,200,0.4)',
            cursor: 'pointer', padding: '4px', flexShrink: 0, lineHeight: 1,
            fontSize: '18px',
          }}
          aria-label="Fechar"
        >×</button>
      </div>

      {isIOS ? (
        <div style={{
          fontFamily: "'Jost', sans-serif",
          fontSize: '.75rem',
          color: 'rgba(200,210,200,0.65)',
          lineHeight: '1.6',
          borderTop: '1px solid rgba(201,169,110,.1)',
          paddingTop: '10px',
        }}>
          Toque em <strong style={{color:'#c9a96e'}}>Partilhar</strong> e depois em{' '}
          <strong style={{color:'#c9a96e'}}>"Adicionar ao Ecrã Principal"</strong> para instalar a app.
        </div>
      ) : (
        <button
          onClick={handleInstall}
          style={{
            background: 'linear-gradient(135deg,#c6a868,#a8893e)',
            border: 'none',
            borderRadius: '8px',
            color: '#040d06',
            fontFamily: "'DM Mono', monospace",
            fontWeight: 600,
            fontSize: '.8rem',
            letterSpacing: '.08em',
            padding: '11px 20px',
            cursor: 'pointer',
            textTransform: 'uppercase',
          }}
        >
          Instalar App
        </button>
      )}
    </div>
  )
}
