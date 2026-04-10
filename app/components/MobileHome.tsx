// ─── MobileHome — Pure SSR mobile homepage ────────────────────────────────────
// React Server Component — NO 'use client'. Zero GSAP. Zero loader. Zero modals.
// Served by app/page.tsx when server-side detection identifies a mobile device.
// Hero is visible from the very first HTML byte: all styles are inline, all
// colours are literal hex — zero CSS-variable or class-name dependencies.
// Shares all sections below the hero with the desktop via HomeSections.tsx.

import HomeNav from './HomeNav'
import HomeSections from './HomeSections'
import { HOME_HERO } from '../lib/homeContent'

export default function MobileHome() {
  return (
    <>
      {/* ── NAV (client — has auth state + mobile drawer) ─────────────────── */}
      <HomeNav />

      {/* ── MOBILE HERO ───────────────────────────────────────────────────────
          Pure SSR: inline styles only, literal hex, zero JS/GSAP dependency.
          Visible from first HTML byte on every Android/iOS variant.            */}
      <section
        role="region"
        aria-label="Imóveis em destaque"
        style={{
          background: 'linear-gradient(158deg,#060f0a,#1a4530 52%,#081510)',
          minHeight: '100svh',
          padding: '88px 24px 80px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          position: 'relative',
          overflow: 'hidden',
          boxSizing: 'border-box',
        }}
      >
        {/* Eyebrow */}
        <div style={{
          fontFamily: "'DM Mono',monospace",
          fontSize: '.5rem',
          letterSpacing: '.48em',
          textTransform: 'uppercase',
          color: '#d4b87e',
          opacity: .9,
          marginBottom: '28px',
          display: 'flex',
          alignItems: 'center',
          gap: '14px',
        }}>
          <span
            style={{ width: '22px', height: '1px', background: '#c9a96e', flexShrink: 0, display: 'block' }}
            aria-hidden="true"
          />
          {HOME_HERO.eyebrow}
        </div>

        {/* H1 */}
        <h1 style={{
          fontFamily: "'Cormorant',serif",
          fontWeight: 300,
          fontSize: 'clamp(1.8rem,7vw,3rem)',
          lineHeight: 1.08,
          color: '#ffffff',
          letterSpacing: '-.032em',
          margin: '0 0 40px 0',
        }}>
          {HOME_HERO.title1}{' '}
          <em style={{ fontStyle: 'italic', color: '#e2c99a' }}>{HOME_HERO.titleEm}</em>{' '}
          {HOME_HERO.title3}
        </h1>

        {/* Subtitle */}
        <p style={{
          fontFamily: "'Jost',sans-serif",
          fontSize: '.9rem',
          lineHeight: 1.9,
          color: 'rgba(255,255,255,.72)',
          maxWidth: '100%',
          margin: '0 0 44px 0',
        }}>
          {HOME_HERO.subtitle}
        </p>

        {/* CTA Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', marginBottom: '40px' }}>
          <a
            href={HOME_HERO.ctaPrimary.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '11px',
              background: '#c9a96e',
              color: '#1c4a35',
              fontFamily: "'Jost',sans-serif",
              fontSize: '.63rem',
              fontWeight: 600,
              letterSpacing: '.18em',
              textTransform: 'uppercase',
              padding: '16px 40px',
              textDecoration: 'none',
            }}
          >
            {HOME_HERO.ctaPrimary.text}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: '16px', height: '16px', flexShrink: 0 }} aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
          <a
            href={HOME_HERO.ctaSecondary.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,.25)',
              color: 'rgba(255,255,255,.58)',
              fontFamily: "'Jost',sans-serif",
              fontSize: '.62rem',
              fontWeight: 400,
              letterSpacing: '.16em',
              textTransform: 'uppercase',
              padding: '16px 32px',
              textDecoration: 'none',
            }}
          >
            {HOME_HERO.ctaSecondary.text}
          </a>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '20px 32px' }}>
          {HOME_HERO.stats.map(s => (
            <div key={s.label}>
              <div style={{
                fontFamily: "'Cormorant',serif",
                fontSize: '1.8rem',
                fontWeight: 300,
                color: '#ffffff',
                lineHeight: 1,
                letterSpacing: '-.03em',
              }}>
                {s.n}<em style={{ fontStyle: 'normal', color: '#e2c99a', fontSize: '1.2rem' }}>{s.em}</em>
              </div>
              <div style={{
                fontFamily: "'DM Mono',monospace",
                fontSize: '.5rem',
                letterSpacing: '.2em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,.42)',
                marginTop: '6px',
              }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── ALL SHARED SECTIONS (marquee → footer) ────────────────────────── */}
      <HomeSections />
    </>
  )
}
