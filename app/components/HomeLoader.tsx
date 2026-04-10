'use client'

import { useState, useEffect, useRef } from 'react'

export default function HomeLoader() {
  // ── NUCLEAR DEFAULT: isMobileDevice starts TRUE ──────────────────────────
  // SSR renders null → loader div NEVER in SSR HTML → zero risk of green screen.
  // Client useEffect detects desktop → setIsMobileDevice(false) → loader renders.
  // Mobile path: isMobileDevice stays true → component remains null forever.
  // This is the only guaranteed safe default: assume mobile until desktop is proven.
  const [isMobileDevice, setIsMobileDevice] = useState(true)
  const loaderRef = useRef<HTMLDivElement>(null)

  // ── EFFECT 1: Device detection (synchronous, no async, fires on mount) ───
  // Runs BEFORE any GSAP, BEFORE any DOM mutation, BEFORE loader is visible.
  // If mobile detected: stays null. If desktop: renders loader then Effect 2 fires.
  useEffect(() => {
    const mobileUA = typeof navigator !== 'undefined' &&
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(navigator.userAgent)
    const isMobile = typeof window !== 'undefined' && (
      window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(any-pointer: coarse)').matches ||
      ('ontouchstart' in window) ||
      navigator.maxTouchPoints > 0 ||
      mobileUA
    )

    if (isMobile) {
      // Mobile confirmed — component stays null, loader never mounts.
      // Unlock scroll (desktop path would have locked it; guard against stale state).
      document.body.style.overflow = ''

      // Belt-and-suspenders: force ALL hero elements visible via inline !important.
      // These additive overrides never hide content — only guarantee visibility.
      const forceVisible = [
        '.hero-h1', '.hero-h1 .line-inner', '.line-inner',
        '#hEye', '#hSub', '#hBtns', '#hStats', '#hScroll', '#searchBox',
        '.hero-content', '.hero-eyebrow', '.hero-sub', '.hero-btns',
      ]
      forceVisible.forEach(sel => {
        document.querySelectorAll<HTMLElement>(sel).forEach(el => {
          el.style.setProperty('opacity', '1', 'important')
          el.style.setProperty('transform', 'none', 'important')
          el.style.setProperty('filter', 'none', 'important')
          el.style.setProperty('clip-path', 'none', 'important')
          el.style.setProperty('visibility', 'visible', 'important')
        })
      })
      // isMobileDevice stays true → null render — done.
      return
    }

    // Desktop confirmed: render loader, lock scroll.
    setIsMobileDevice(false)
    document.body.style.overflow = 'hidden'
  }, [])

  // ── EFFECT 2: GSAP loader animation — only fires when loader is in DOM ───
  // Dependency on [isMobileDevice]: fires on mount (true → returns early) and
  // again when desktop detection flips it to false (loader now in DOM → animate).
  // No portal, no parent wrapper — loader is a direct DOM child of <main>.
  useEffect(() => {
    if (isMobileDevice) return  // mobile path or initial SSR state — skip entirely

    const loader = loaderRef.current
    if (!loader) return

    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tl: any = null
    let safetyTimer: ReturnType<typeof setTimeout> | null = null

    function finishLoader() {
      if (!loader) return
      if (loader.classList.contains('done')) return
      loader.style.removeProperty('opacity')
      loader.style.removeProperty('visibility')
      loader.classList.add('done')
      document.body.style.overflow = ''
      setTimeout(() => {
        if (loaderRef.current) loaderRef.current.style.display = 'none'
      }, 700)
    }

    // Safety timer: guarantees loader exits even if GSAP hangs (2s max)
    safetyTimer = setTimeout(finishLoader, 2000)

    // visibilitychange: if page was pre-rendered (hidden) and becomes visible,
    // close loader immediately. Catches Chrome Speculation Rules on Android.
    const onVisible = () => {
      if (!document.hidden) {
        finishLoader()
        document.removeEventListener('visibilitychange', onVisible)
      }
    }
    document.addEventListener('visibilitychange', onVisible)

    const run = async () => {
      try {
        const { default: gsap } = await import('gsap')
        if (cancelled) return

        gsap.set('#ldrA', { y: 40, opacity: 0, filter: 'blur(8px)' })
        gsap.set('#ldrG', { y: 40, opacity: 0, filter: 'blur(8px)' })
        gsap.set('#ldrFill', { scaleX: 0, transformOrigin: 'left center' })
        gsap.set('#ldrTxt', { opacity: 0, y: 12 })

        tl = gsap.timeline({
          onComplete: () => { if (safetyTimer) clearTimeout(safetyTimer); finishLoader() }
        })
        tl
          .to('#ldrA', { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.7, ease: 'expo.out' })
          .to('#ldrG', { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.7, ease: 'expo.out' }, '-=0.45')
          .to('#ldrFill', { scaleX: 1, duration: 1.2, ease: 'power3.out' }, '-=0.4')
          .to('#ldrTxt', { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }, '-=0.9')
          .to(loader, { opacity: 0, duration: 0.55, ease: 'power2.inOut', delay: 0.25 })
      } catch {
        // GSAP failed to load — close loader immediately
        finishLoader()
      }
    }

    run()

    return () => {
      cancelled = true
      if (safetyTimer) clearTimeout(safetyTimer)
      document.removeEventListener('visibilitychange', onVisible)
      tl?.kill()
      document.body.style.overflow = ''
    }
  }, [isMobileDevice])

  // ── MOBILE: loader does not exist in DOM — zero green screen risk ─────────
  // SSR default (true) and all mobile paths return null here.
  // No portal. No parent container. No wrapper. The element simply does not mount.
  if (isMobileDevice) return null

  return (
    // display:flex — loader is already confirmed desktop when this renders.
    // No display:none needed here: SSR never reaches this branch (returns null above).
    <div id="loader" ref={loaderRef} style={{ display: 'flex' }}>
      <div className="ldr-logo">
        <span id="ldrA">Agency</span>
        <span id="ldrG">Group</span>
      </div>
      <div className="ldr-bar"><div className="ldr-fill" id="ldrFill"></div></div>
      <div className="ldr-txt" id="ldrTxt">Lisboa · Portugal · AMI 22506</div>
    </div>
  )
}
