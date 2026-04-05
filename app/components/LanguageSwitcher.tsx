'use client'
import { useState } from 'react'

const LANGUAGES = [
  { code: 'pt', flag: '🇵🇹', name: 'Português' },
  { code: 'en', flag: '🇬🇧', name: 'English' },
  { code: 'fr', flag: '🇫🇷', name: 'Français' },
  { code: 'de', flag: '🇩🇪', name: 'Deutsch' },
  { code: 'es', flag: '🇪🇸', name: 'Español' },
  { code: 'it', flag: '🇮🇹', name: 'Italiano' },
]

export function LanguageSwitcher() {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.cookie.match(/locale=([^;]+)/)?.[1] || 'pt'
    }
    return 'pt'
  })

  function switchLanguage(code: string) {
    document.cookie = `locale=${code}; path=/; max-age=${365 * 24 * 3600}`
    setCurrent(code)
    setOpen(false)
    window.location.reload()
  }

  const currentLang = LANGUAGES.find(l => l.code === current) ?? LANGUAGES[0]

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: 'transparent',
          border: '1px solid rgba(201,169,110,0.3)',
          padding: '6px 12px',
          cursor: 'pointer',
          color: '#c9a96e',
          fontFamily: "'DM Mono', monospace",
          fontSize: '0.7rem',
          letterSpacing: '0.05em',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          transition: 'border-color 0.2s',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(201,169,110,0.7)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(201,169,110,0.3)')}
        aria-label="Select language"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span>{currentLang.flag}</span>
        <span>{currentLang.code.toUpperCase()}</span>
        <span style={{ fontSize: '0.5rem', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </button>

      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 998 }}
            onClick={() => setOpen(false)}
          />
          <div
            role="listbox"
            aria-label="Select language"
            style={{
              position: 'absolute',
              top: 'calc(100% + 4px)',
              right: 0,
              background: '#0c1f15',
              border: '1px solid rgba(201,169,110,0.2)',
              zIndex: 999,
              minWidth: '160px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}
          >
            {LANGUAGES.map(lang => (
              <button
                key={lang.code}
                role="option"
                aria-selected={lang.code === current}
                onClick={() => switchLanguage(lang.code)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '10px 14px',
                  background: lang.code === current ? 'rgba(201,169,110,0.1)' : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid rgba(201,169,110,0.06)',
                  cursor: 'pointer',
                  color: lang.code === current ? '#c9a96e' : '#f4f0e6',
                  fontFamily: "'Jost', sans-serif",
                  fontSize: '0.85rem',
                  textAlign: 'left',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => {
                  if (lang.code !== current) {
                    e.currentTarget.style.background = 'rgba(201,169,110,0.05)'
                  }
                }}
                onMouseLeave={e => {
                  if (lang.code !== current) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <span style={{ fontSize: '1.1rem' }}>{lang.flag}</span>
                <span>{lang.name}</span>
                {lang.code === current && (
                  <span style={{ marginLeft: 'auto', color: '#c9a96e', fontSize: '0.65rem' }}>✓</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
