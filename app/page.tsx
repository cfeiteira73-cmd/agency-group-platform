// ─── RSC Homepage — Agency Group ─────────────────────────────────────────────
// Async RSC. Server-side mobile detection via request headers.
// Mobile  → MobileHome (pure SSR, zero GSAP, zero loader).
// Desktop → full experience (GSAP hero, loader, cursor, animations).
// No CSS class toggling. No flash. No dual-hero in the HTML.
//
// Edge runtime: eliminates Vercel Node.js cold starts (~500-800ms → <50ms).
// headers() is fully supported on Edge. No Node.js-only APIs used here.
export const runtime = 'edge'

import { headers } from 'next/headers'
import HomeSections from './components/HomeSections'
import HomeLoader from './components/HomeLoader'
import HomeCursor from './components/HomeCursor'
import HomeAnimations from './components/HomeAnimations'
import HomeToast from './components/HomeToast'
import HomeNav from './components/HomeNav'
import MobileHome from './components/MobileHome'
import HomeHeroTrack from './components/HomeHeroTrack'
import { HOME_HERO } from './lib/homeContent'

// ─── Server-side mobile detection ────────────────────────────────────────────
// Primary:  Sec-CH-UA-Mobile: ?1  (Chrome low-entropy hint, always sent on Android)
// Fallback: User-Agent regex      (covers Safari/iOS and edge cases)
function detectMobile(headersList: Awaited<ReturnType<typeof headers>>): boolean {
  const uaMobile = headersList.get('Sec-CH-UA-Mobile')
  if (uaMobile === '?1') return true
  const ua = headersList.get('user-agent') ?? ''
  return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function Home() {
  const headersList = await headers()
  const mobile = detectMobile(headersList)

  // ── MOBILE PATH — pure SSR, zero GSAP, zero loader ───────────────────────
  if (mobile) return <MobileHome />

  // ── DESKTOP PATH — full experience ───────────────────────────────────────
  return (
    <>
      {/* ── CLIENT ISLANDS (non-visual / overlay) ─────────────────────────── */}
      <HomeLoader />
      <HomeCursor />
      <HomeAnimations />
      <HomeToast />

      {/* ── NAV (client — has auth state + mobile drawer) ─────────────────── */}
      <HomeNav />

      {/* ── HERO (DESKTOP) ────────────────────────────────────────────────── */}
      {/* All GSAP, animations, and entrance logic target this section only.
          IDs #hEye #hTitle #hSub #hBtns #hStats #hScroll must not change —
          HomeAnimations.tsx targets them by ID.                              */}
      <section className="hero" role="region" aria-label="Imóveis em destaque" aria-live="polite">
        <div className="hl">
          <div className="hl-bg"></div>
          <div className="hl-grain"></div>
          {/* SSR inline styles guarantee visibility from first HTML byte.
              GSAP overrides on desktop (same specificity, last write wins). */}
          <div className="hero-content" style={{ opacity: 1, visibility: 'visible' }}>
            <div className="hero-eyebrow" id="hEye" style={{ opacity: 1, visibility: 'visible' }}>
              {HOME_HERO.eyebrow}
            </div>
            <h1 className="hero-h1" id="hTitle">
              <span className="line" style={{ overflow: 'visible' }}>
                <span className="line-inner" style={{ display: 'block', transform: 'none', opacity: 1 }}>{HOME_HERO.title1}</span>
              </span>
              <span className="line" style={{ overflow: 'visible' }}>
                <span className="line-inner" style={{ display: 'block', transform: 'none', opacity: 1 }}><em>{HOME_HERO.titleEm}</em></span>
              </span>
              <span className="line" style={{ overflow: 'visible' }}>
                <span className="line-inner" style={{ display: 'block', transform: 'none', opacity: 1 }}>{HOME_HERO.title3}</span>
              </span>
            </h1>
            <p className="hero-sub" id="hSub" style={{ opacity: 1, visibility: 'visible' }}>
              {HOME_HERO.subtitle}
            </p>
            <div className="hero-btns" id="hBtns" style={{ opacity: 1, visibility: 'visible' }}>
              <a href={HOME_HERO.ctaPrimary.href} className="btn-gold">
                {HOME_HERO.ctaPrimary.text}
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7" /></svg>
              </a>
              <a href={HOME_HERO.ctaSecondary.href} className="btn-outline">{HOME_HERO.ctaSecondary.text}</a>
            </div>
          </div>
          <div className="hero-stats" id="hStats" style={{ opacity: 1, visibility: 'visible', transform: 'none' }}>
            {HOME_HERO.stats.map(s => (
              <div key={s.label}>
                <div className="hs-n">{s.n}<em>{s.em}</em></div>
                <div className="hs-l">{s.label}</div>
              </div>
            ))}
          </div>
          <div className="hero-scroll" id="hScroll" style={{ opacity: 1, visibility: 'visible' }} aria-label="Scroll para explorar">
            <div className="hs-line"></div>
            <div className="hs-txt">↓</div>
          </div>
        </div>
        <aside className="hr">
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="none"
            poster="/hero-poster.jpg"
            aria-hidden="true"
            src="/hero-video.mp4"
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </aside>
      </section>

      {/* ── ALL SHARED SECTIONS (marquee → footer) ────────────────────────── */}
      <HomeSections />

      {/* ── TRACKING CLIENT ISLAND — attaches click listeners to #hBtns CTAs ── */}
      <HomeHeroTrack device="desktop" />
    </>
  )
}
