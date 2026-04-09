'use client'

import { useEffect, useRef } from 'react'

export default function HomeLoader() {
  const loaderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loader = loaderRef.current
    if (!loader) return

    document.body.style.overflow = 'hidden'

    function finishLoader() {
      if (!loader) return
      if (loader.classList.contains('done')) return
      // Strip any GSAP inline styles so CSS takes over cleanly
      loader.style.removeProperty('opacity')
      loader.style.removeProperty('visibility')
      loader.classList.add('done')
      document.body.style.overflow = ''
      // Hard-kill after transition completes
      setTimeout(() => {
        if (loaderRef.current) {
          loaderRef.current.style.display = 'none'
        }
      }, 700)
    }

    // ── MOBILE / TOUCH: bypass GSAP entirely ─────────────────────────────────
    // CSS animation already handles visual dismiss (@keyframes ag-ldr-out)
    // JS adds .done class as belt-and-suspenders safety
    const isMobile =
      window.innerWidth <= 960 ||
      navigator.maxTouchPoints > 0 ||
      ('ontouchstart' in window) ||
      window.matchMedia('(pointer: coarse)').matches

    if (isMobile) {
      // Immediately unlock scroll — CSS animation handles visual fade
      document.body.style.overflow = ''
      // Belt-and-suspenders: also add .done class after CSS animation finishes
      const t = setTimeout(finishLoader, 850)
      return () => { clearTimeout(t) }
    }

    // ── DESKTOP: cinematic GSAP entrance ─────────────────────────────────────
    let cancelled = false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let tl: any = null
    let safetyTimer: ReturnType<typeof setTimeout> | null = null

    const run = async () => {
      const { default: gsap } = await import('gsap')
      if (cancelled) return

      safetyTimer = setTimeout(finishLoader, 2500)
      window.addEventListener('load', finishLoader, { once: true })

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
    }

    run()

    return () => {
      cancelled = true
      if (safetyTimer) clearTimeout(safetyTimer)
      window.removeEventListener('load', finishLoader)
      tl?.kill()
      document.body.style.overflow = ''
    }
  }, [])

  return (
    <div id="loader" ref={loaderRef}>
      <div className="ldr-logo">
        <span id="ldrA">Agency</span>
        <span id="ldrG">Group</span>
      </div>
      <div className="ldr-bar"><div className="ldr-fill" id="ldrFill"></div></div>
      <div className="ldr-txt" id="ldrTxt">Lisboa · Portugal · AMI 22506</div>
    </div>
  )
}
