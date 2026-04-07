'use client'

import { useEffect, useRef, useState } from 'react'

// ─── HomeToast ────────────────────────────────────────────────────────────────
// Listens for custom 'ag:toast' events dispatched from anywhere on the page.
// Usage: window.dispatchEvent(new CustomEvent('ag:toast', { detail: { msg: '...', type: 'success' } }))

interface ToastPayload {
  msg: string
  type: 'success' | 'error' | 'info'
}

export default function HomeToast() {
  const [pageToast, setPageToast] = useState<ToastPayload | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function showToast(msg: string, type: 'success' | 'error' | 'info' = 'info') {
    if (timerRef.current) clearTimeout(timerRef.current)
    setPageToast({ msg, type })
    timerRef.current = setTimeout(() => setPageToast(null), 4000)
  }

  useEffect(() => {
    const handler = (e: Event) => {
      const { msg, type } = (e as CustomEvent<ToastPayload>).detail
      showToast(msg, type)
    }
    window.addEventListener('ag:toast', handler)
    return () => window.removeEventListener('ag:toast', handler)
  }, [])

  if (!pageToast) return null

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        background:
          pageToast.type === 'error'
            ? 'rgba(176,58,46,.95)'
            : pageToast.type === 'success'
            ? 'rgba(28,74,53,.95)'
            : 'rgba(14,14,13,.92)',
        color: '#f4f0e6',
        padding: '12px 20px',
        fontFamily: "'DM Mono', monospace",
        fontSize: '.55rem',
        letterSpacing: '.08em',
        boxShadow: '0 4px 20px rgba(0,0,0,.35)',
        maxWidth: '320px',
        lineHeight: 1.6,
        borderLeft: `3px solid ${
          pageToast.type === 'error'
            ? '#e05454'
            : pageToast.type === 'success'
            ? '#c9a96e'
            : 'rgba(201,169,110,.5)'
        }`,
      }}
    >
      {pageToast.msg}
    </div>
  )
}
