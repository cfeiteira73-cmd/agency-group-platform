'use client'

import { useState, useEffect, useRef } from 'react'

export default function HomeLoader() {
  // On mobile: remove loader from DOM entirely — no element = zero chance of green screen
  const [isMobileDevice, setIsMobileDevice] = useState(false)
  const loaderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Touch-capability detection — NOT viewport width.
    // any-pointer:coarse catches Samsung S-Pen (pointer:fine primary but touch screen present).
    // maxTouchPoints covers all Android/iOS devices reliably.
    // Never use innerWidth — Chrome on Android can report 1024+ in landscape/desktop mode.
    const mobile =
      navigator.maxTouchPoints > 0 ||
      ('ontouchstart' in window) ||
      window.matchMedia('(pointer: coarse)').matches ||
      window.matchMedia('(any-pointer: coarse)').matches

    if (mobile) {
      // Remove from DOM — no hiding, no classes, no CSS — element does not exist
      setIsMobileDevice(true)
      document.body.style.overflow = ''

      // Force ALL hero elements visible immediately
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
      return
    }

    const loader = loaderRef.current
    if (!loader) return

    // ── DESKTOP ONLY: show loader, lock scroll, run cinematic GSAP entrance ──
    loader.style.display = 'flex'
    document.body.style.overflow = 'hidden'

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

    // ── DESKTOP: cinematic GSAP entrance ─────────────────────────────────────
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tl: any = null
    let safetyTimer: ReturnType<typeof setTimeout> | null = null

    // Safety timer set IMMEDIATELY — before any async work
    // Guarantees finishLoader runs even if GSAP import fails or hangs
    safetyTimer = setTimeout(finishLoader, 4500)

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
      tl?.kill()
      document.body.style.overflow = ''
    }
  }, [])

  // MOBILE: loader does not exist in DOM — zero chance of green screen
  if (isMobileDevice) return null

  return (
    // display:none inline — loader hidden by default (SSR)
    // Desktop JS sets display:flex before running GSAP animation
    <div id="loader" ref={loaderRef} style={{ display: 'none' }}>
      <div className="ldr-logo">
        <span id="ldrA">Agency</span>
        <span id="ldrG">Group</span>
      </div>
      <div className="ldr-bar"><div className="ldr-fill" id="ldrFill"></div></div>
      <div className="ldr-txt" id="ldrTxt">Lisboa · Portugal · AMI 22506</div>
    </div>
  )
}
