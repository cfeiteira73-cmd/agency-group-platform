// ─── MobileHome — Pure SSR mobile homepage ────────────────────────────────────
// React Server Component — NO 'use client'. Zero GSAP. Zero loader. Zero modals.
// Served by app/page.tsx when server-side detection identifies a mobile device.
//
// VISIBILITY HARDENING PASS (see inline comments on each hero node):
// Every visible hero content node carries the explicit final-state properties:
//   opacity: 1  |  visibility: 'visible'  |  transform: 'none'
//   filter: 'none'  |  clipPath: 'none'
// These are inline styles — they win over any class rule without !important, and
// they are immune to GSAP since HomeAnimations is not mounted in this render tree.
//
// ANIMATION CLASS ISOLATION:
// NO desktop GSAP ids or classes appear anywhere in this file:
//   ✗ #hEye  #hTitle  #hSub  #hBtns  #hStats  #hScroll
//   ✗ .hero-eyebrow  .hero-h1  .hero-content  .hero-btns  .hero-stats  .hero-scroll
//   ✗ .line  .line-inner  .fade-in  .clip-reveal  .text-reveal  .text-reveal-inner
// All styles are inline; all colours are literal hex; no CSS-variable dependency.

import HomeNav from './HomeNav'
import HomeSections from './HomeSections'
import { HOME_HERO } from '../lib/homeContent'
import HomeHeroTrack from './HomeHeroTrack'

// ─── Shared final-state visibility hardening — applied to every hero content node
// Prevents any inherited CSS, future class bleed, or residual transform from hiding content.
const VISIBLE: React.CSSProperties = {
  opacity:    1,
  visibility: 'visible',
  transform:  'none',
  filter:     'none',
  clipPath:   'none',
}

export default function MobileHome() {
  return (
    <>
      {/* ── NAV (client — has auth state + mobile drawer) ─────────────────── */}
      <HomeNav />

      {/* ── MOBILE HERO ───────────────────────────────────────────────────────
          Pure SSR: inline styles only, literal hex, zero JS/GSAP dependency.
          No desktop animation class or ID is used anywhere in this section.
          Every content node has explicit final-state visibility properties.   */}
      <section
        role="region"
        aria-label="Imóveis em destaque"
        style={{
          background:     'linear-gradient(158deg,#060f0a,#1a4530 52%,#081510)',
          minHeight:      '100svh',
          padding:        '88px 24px 80px',
          display:        'flex',
          flexDirection:  'column',
          justifyContent: 'flex-start',
          position:       'relative',
          overflow:       'hidden',
          boxSizing:      'border-box',
          // Section-level hardening
          opacity:        1,
          visibility:     'visible',
        }}
      >

        {/* ── NODE 1: EYEBROW ────────────────────────────────────────────────
            Hardened: opacity visibility transform filter clipPath
            No class. No GSAP id. Inline-only.                              */}
        <div style={{
          // Hardening — final-state properties, immune to CSS class bleed
          ...VISIBLE,
          // Visual properties
          fontFamily:    "'DM Mono',monospace",
          fontSize:      '.5rem',
          letterSpacing: '.48em',
          textTransform: 'uppercase',
          color:         '#d4b87e',
          marginBottom:  '28px',
          display:       'flex',
          alignItems:    'center',
          gap:           '14px',
        }}>
          <span
            aria-hidden="true"
            style={{
              width:      '22px',
              height:     '1px',
              background: '#c9a96e',
              flexShrink: 0,
              display:    'block',
            }}
          />
          {HOME_HERO.eyebrow}
        </div>

        {/* ── NODE 2: HEADING (h1) ───────────────────────────────────────────
            Hardened: opacity visibility transform filter clipPath
            No .hero-h1 class. No .line / .line-inner wrappers.
            No #hTitle id. Flat single-element h1.                          */}
        <h1 style={{
          // Hardening
          ...VISIBLE,
          // Visual properties
          fontFamily:    "'Cormorant',serif",
          fontWeight:    300,
          fontSize:      'clamp(1.8rem,7vw,3rem)',
          lineHeight:    1.08,
          color:         '#ffffff',
          letterSpacing: '-.032em',
          margin:        '0 0 40px 0',
        }}>
          {HOME_HERO.title1}{' '}
          <em style={{ fontStyle: 'italic', color: '#e2c99a' }}>{HOME_HERO.titleEm}</em>{' '}
          {HOME_HERO.title3}
        </h1>

        {/* ── NODE 3: SUBTITLE ───────────────────────────────────────────────
            Hardened: opacity visibility transform filter clipPath
            No .hero-sub class. No #hSub id.                                */}
        <p style={{
          // Hardening
          ...VISIBLE,
          // Visual properties
          fontFamily: "'Jost',sans-serif",
          fontSize:   '.9rem',
          lineHeight: 1.9,
          color:      'rgba(255,255,255,.72)',
          maxWidth:   '100%',
          margin:     '0 0 44px 0',
        }}>
          {HOME_HERO.subtitle}
        </p>

        {/* ── NODE 4: CTA ROW ────────────────────────────────────────────────
            Hardened: opacity visibility transform filter clipPath
            No .hero-btns class. No #hBtns id.
            Button elements are plain <a> tags — no animation classes.      */}
        <div style={{
          // Hardening
          ...VISIBLE,
          // Visual properties
          display:       'flex',
          flexDirection: 'column',
          gap:           '12px',
          width:         '100%',
          marginBottom:  '40px',
        }}>
          <a
            id="mHeroPrimary"
            href={HOME_HERO.ctaPrimary.href}
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            '11px',
              background:     '#c9a96e',
              color:          '#1c4a35',
              fontFamily:     "'Jost',sans-serif",
              fontSize:       '.63rem',
              fontWeight:     600,
              letterSpacing:  '.18em',
              textTransform:  'uppercase',
              padding:        '16px 40px',
              textDecoration: 'none',
            }}
          >
            {HOME_HERO.ctaPrimary.text}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ width: '16px', height: '16px', flexShrink: 0 }}
              aria-hidden="true"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
          <a
            id="mHeroSecondary"
            href={HOME_HERO.ctaSecondary.href}
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'center',
              background:     'transparent',
              border:         '1px solid rgba(255,255,255,.25)',
              color:          'rgba(255,255,255,.58)',
              fontFamily:     "'Jost',sans-serif",
              fontSize:       '.62rem',
              fontWeight:     400,
              letterSpacing:  '.16em',
              textTransform:  'uppercase',
              padding:        '16px 32px',
              textDecoration: 'none',
            }}
          >
            {HOME_HERO.ctaSecondary.text}
          </a>
        </div>

        {/* ── NODE 5: STATS ROW ──────────────────────────────────────────────
            Hardened: opacity visibility transform filter clipPath
            No .hero-stats class. No #hStats id.
            Each stat item is a plain <div> — no animation classes.         */}
        <div style={{
          // Hardening
          ...VISIBLE,
          // Visual properties
          display:     'flex',
          flexWrap:    'wrap',
          gap:         '20px 32px',
        }}>
          {HOME_HERO.stats.map(s => (
            <div key={s.label}>
              <div style={{
                fontFamily:    "'Cormorant',serif",
                fontSize:      '1.8rem',
                fontWeight:    300,
                color:         '#ffffff',
                lineHeight:    1,
                letterSpacing: '-.03em',
              }}>
                {s.n}<em style={{ fontStyle: 'normal', color: '#e2c99a', fontSize: '1.2rem' }}>{s.em}</em>
              </div>
              <div style={{
                fontFamily:    "'DM Mono',monospace",
                fontSize:      '.5rem',
                letterSpacing: '.2em',
                textTransform: 'uppercase',
                color:         'rgba(255,255,255,.42)',
                marginTop:     '6px',
              }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

      </section>

      {/* ── ALL SHARED SECTIONS (marquee → footer) ────────────────────────── */}
      <HomeSections />

      {/* ── TRACKING CLIENT ISLAND — attaches click listeners to hero CTAs ── */}
      <HomeHeroTrack device="mobile" />
    </>
  )
}
