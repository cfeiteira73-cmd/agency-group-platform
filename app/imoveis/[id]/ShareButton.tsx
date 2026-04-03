'use client'

import { useState } from 'react'

export default function ShareButton({ url, title }: { url: string; title: string }) {
  const [copied, setCopied] = useState(false)

  async function handleShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, url })
        return
      } catch {
        // User cancelled — fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2400)
    } catch {
      // clipboard not available
    }
  }

  return (
    <button
      onClick={handleShare}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        width: '100%',
        background: 'transparent',
        color: copied ? '#c9a96e' : 'rgba(244,240,230,.4)',
        border: `1px solid ${copied ? 'rgba(201,169,110,.35)' : 'rgba(244,240,230,.1)'}`,
        padding: '12px 20px',
        fontFamily: "'Jost', sans-serif",
        fontSize: '.62rem',
        fontWeight: 500,
        letterSpacing: '.16em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        transition: 'all .25s',
      }}
    >
      {copied ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Link Copiado
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Partilhar Imóvel
        </>
      )}
    </button>
  )
}
