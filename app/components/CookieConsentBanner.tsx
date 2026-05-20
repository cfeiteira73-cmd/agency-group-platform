'use client'
// =============================================================================
// Agency Group — GDPR Cookie Consent Banner
// GDPR Art. 6(1)(a) — lawful basis: consent
// Art. 7    — conditions for consent (freely given, specific, informed, unambiguous)
// Art. 13   — information to be provided
//
// Sets cookie: ag_cookie_consent=granted|denied; Max-Age=365days; SameSite=Lax
// The BuyerIntentTracker reads this cookie before any tracking.
//
// Multi-language: auto-detects browser locale from navigator.language.
// Supported: PT (default) | EN | FR | DE | ZH
// Covers the top buyer nationalities for the luxury PT real estate segment.
// =============================================================================

import { useEffect, useState, type ReactElement } from 'react'

const CONSENT_COOKIE = 'ag_cookie_consent'
const CONSENT_MAX_AGE = 365 * 24 * 60 * 60  // 1 year in seconds

// ---------------------------------------------------------------------------
// Localised strings
// ---------------------------------------------------------------------------

type Lang = 'pt' | 'en' | 'fr' | 'de' | 'zh'

interface BannerStrings {
  title:      string
  body:       string
  privacy:    string
  acceptAll:  string
  decline:    string
}

const STRINGS: Record<Lang, BannerStrings> = {
  pt: {
    title:     'Privacidade & Cookies',
    body:      'Utilizamos cookies analíticos para melhorar a sua experiência e optimizar o desempenho da plataforma. Pode aceitar, recusar ou consultar a nossa',
    privacy:   'Política de Privacidade',
    acceptAll: 'Aceitar todos',
    decline:   'Recusar',
  },
  en: {
    title:     'Privacy & Cookies',
    body:      'We use analytical cookies to improve your experience and optimise platform performance. You may accept, decline, or review our',
    privacy:   'Privacy Policy',
    acceptAll: 'Accept all',
    decline:   'Decline',
  },
  fr: {
    title:     'Confidentialité & Cookies',
    body:      'Nous utilisons des cookies analytiques pour améliorer votre expérience et optimiser les performances de la plateforme. Vous pouvez accepter, refuser ou consulter notre',
    privacy:   'Politique de confidentialité',
    acceptAll: 'Tout accepter',
    decline:   'Refuser',
  },
  de: {
    title:     'Datenschutz & Cookies',
    body:      'Wir verwenden analytische Cookies, um Ihre Erfahrung zu verbessern und die Plattformleistung zu optimieren. Sie können akzeptieren, ablehnen oder unsere',
    privacy:   'Datenschutzerklärung',
    acceptAll: 'Alle akzeptieren',
    decline:   'Ablehnen',
  },
  zh: {
    title:     '隐私与 Cookies',
    body:      '我们使用分析性 Cookies 来改善您的体验并优化平台性能。您可以接受、拒绝或查阅我们的',
    privacy:   '隐私政策',
    acceptAll: '全部接受',
    decline:   '拒绝',
  },
}

function detectLang(): Lang {
  try {
    if (typeof navigator === 'undefined') return 'pt'
    const l = navigator.language.toLowerCase()
    if (l.startsWith('zh')) return 'zh'
    if (l.startsWith('de')) return 'de'
    if (l.startsWith('fr')) return 'fr'
    if (l.startsWith('en')) return 'en'
    return 'pt'
  } catch {
    return 'pt'
  }
}

function getConsentCookie(): 'granted' | 'denied' | null {
  try {
    if (typeof document === 'undefined') return null
    const match = document.cookie
      .split(';')
      .map(c => c.trim())
      .find(c => c.startsWith(`${CONSENT_COOKIE}=`))
    if (!match) return null
    const value = match.split('=')[1]
    return value === 'granted' || value === 'denied' ? value : null
  } catch {
    return null
  }
}

function setConsentCookie(value: 'granted' | 'denied'): void {
  try {
    const secure = location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${CONSENT_COOKIE}=${value}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`
  } catch {
    // Non-blocking
  }
}

export default function CookieConsentBanner(): ReactElement | null {
  const [visible, setVisible] = useState(false)
  const [lang,    setLang]    = useState<Lang>('pt')

  useEffect(() => {
    // Detect language on client only (SSR-safe)
    setLang(detectLang())
    // Only show if consent hasn't been given yet
    if (getConsentCookie() === null) {
      // Slight delay so it doesn't flash on initial render
      const t = setTimeout(() => setVisible(true), 800)
      return () => clearTimeout(t)
    }
  }, [])

  if (!visible) return null

  const t = STRINGS[lang]

  const handleAccept = () => {
    setConsentCookie('granted')
    setVisible(false)
    // Dispatch event so BuyerIntentTracker can start tracking without a reload
    window.dispatchEvent(new CustomEvent('ag:consent-granted'))
  }

  const handleDecline = () => {
    setConsentCookie('denied')
    setVisible(false)
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t.title}
      lang={lang === 'zh' ? 'zh-Hans' : lang}
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        width: 'min(92vw, 640px)',
        background: '#1a1a1a',
        color: '#f5f0e8',
        borderRadius: '0.75rem',
        padding: '1.25rem 1.5rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        fontFamily: 'var(--font-jost, sans-serif)',
        fontSize: '0.875rem',
        lineHeight: '1.55',
        animation: 'ag-cookie-slide-up 0.3s ease',
      }}
    >
      <style>{`
        @keyframes ag-cookie-slide-up {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>

      <div>
        <strong style={{ fontSize: '0.9375rem', color: '#c9a96e' }}>
          {t.title}
        </strong>
        <p style={{ marginTop: '0.4rem', color: '#ccc' }}>
          {t.body}{' '}
          <a
            href="/privacy"
            style={{ color: '#c9a96e', textDecoration: 'underline' }}
            target="_blank"
            rel="noopener noreferrer"
          >
            {t.privacy}
          </a>
          .
        </p>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={handleAccept}
          style={{
            flex: '1 1 auto',
            background: '#c9a96e',
            color: '#1a1a1a',
            border: 'none',
            borderRadius: '0.375rem',
            padding: '0.625rem 1.25rem',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
            letterSpacing: '0.02em',
          }}
        >
          {t.acceptAll}
        </button>
        <button
          type="button"
          onClick={handleDecline}
          style={{
            flex: '1 1 auto',
            background: 'transparent',
            color: '#aaa',
            border: '1px solid #444',
            borderRadius: '0.375rem',
            padding: '0.625rem 1.25rem',
            fontWeight: 500,
            fontSize: '0.875rem',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          {t.decline}
        </button>
      </div>
    </div>
  )
}
