'use client'

import { useEffect, useRef } from 'react'

export default function HomeAnimations() {
  const gsapInitRef = useRef(false)

  useEffect(() => {
    if (gsapInitRef.current) return  // StrictMode guard
    gsapInitRef.current = true

    let cancelled = false
    let rafId: number | null = null
    let gsapCtx: { revert: () => void } | null = null

    const initAnimations = async () => {
      const { default: gsap } = await import('gsap')
      const { ScrollTrigger } = await import('gsap/ScrollTrigger')
      gsap.registerPlugin(ScrollTrigger)

      if (cancelled) return

      // Detect touch device — touch capability, NOT viewport width.
      // any-pointer:coarse catches Samsung S-Pen (primary pointer:fine but has touch screen).
      // maxTouchPoints covers all Android/iOS phones/tablets reliably.
      // User-Agent catches Android Chrome Custom Tab (Google Search) where touch APIs may not fire.
      const mobileUA = typeof navigator !== 'undefined' &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(navigator.userAgent)
      const isTouch = typeof window !== 'undefined' && (
        window.matchMedia('(pointer: coarse)').matches ||
        window.matchMedia('(any-pointer: coarse)').matches ||
        ('ontouchstart' in window) ||
        navigator.maxTouchPoints > 0 ||
        mobileUA
      )
      // Narrow viewport guard: skip ALL hero animations if viewport ≤ 1099px.
      // Belt+suspenders on top of isTouch — catches headless Chrome (Lighthouse/PageSpeed)
      // which emulates a 360px viewport but reports pointer:fine and maxTouchPoints=0.
      const isNarrow = typeof window !== 'undefined' &&
        window.matchMedia('(max-width: 1099px)').matches
      const skipHeroAnim = isTouch || isNarrow

      // Safety timer: desktop-only — clears any stale GSAP inline styles after animation.
      // MOBILE: timer is cancelled immediately (SSR inline styles must NOT be removed —
      // they are the unconditional hero visibility guarantee with zero JS dependency).
      const heroSafetyTimer = setTimeout(() => {
        // MOBILE/TOUCH/NARROW: SSR inline styles are the primary guarantee — never remove them.
        // Only run on desktop where GSAP may have left stale inline styles.
        if (skipHeroAnim) return
        const sels = ['.hero-h1 .line-inner','#hEye','#hSub','#hBtns','#hStats','#hScroll','#searchBox','.hero-content','.hero-eyebrow','.hero-sub','.hero-btns']
        sels.forEach(sel => {
          document.querySelectorAll<HTMLElement>(sel).forEach(el => {
            el.style.removeProperty('opacity')
            el.style.removeProperty('transform')
            el.style.removeProperty('filter')
            el.style.removeProperty('clip-path')
            el.style.removeProperty('visibility')
          })
        })
      }, 2000)

      // HERO ENTRANCE — fires after loader completes
      // SUPREME RENDERING RULE: on mobile, hero visibility must depend ONLY on SSR HTML + CSS.
      // SSR inline styles (opacity:1;visibility:visible) in page.tsx are the unconditional guarantee.
      // JS must NEVER remove those styles on mobile — any JS removal creates a timing dependency.
      function heroEntrance() {
        // MOBILE/TOUCH/NARROW: SSR inline styles guarantee visibility — return immediately.
        // Do NOT remove inline styles. Do NOT run GSAP. CSS nuclear rules are belt+suspenders.
        if (skipHeroAnim) {
          clearTimeout(heroSafetyTimer)
          return
        }
        // DESKTOP ONLY: Remove stale inline styles — GSAP and CSS govern visibility after this.
        const forceSelectors = ['.hero-content','.hero-h1 .line-inner','.hero-h1 .line','#hEye','#hSub','#hBtns','#hStats','#hScroll','#searchBox','.hero-eyebrow','.hero-sub','.hero-btns']
        forceSelectors.forEach(sel => {
          document.querySelectorAll<HTMLElement>(sel).forEach(el => {
            el.style.removeProperty('opacity')
            el.style.removeProperty('transform')
            el.style.removeProperty('filter')
            el.style.removeProperty('clip-path')
            el.style.removeProperty('visibility')
          })
        })
        clearTimeout(heroSafetyTimer)

        // Stat counter animation ONLY — additive, never hides content
        ;[
          { sel: '#hStats > div:nth-child(1) .hs-n', to: 169, pre: '', suf: 'K', dur: 2.6 },
          { sel: '#hStats > div:nth-child(2) .hs-n', to: 17, pre: '+', suf: '%', dur: 2.0 },
          { sel: '#hStats > div:nth-child(3) .hs-n', to: 44, pre: '', suf: '%', dur: 2.2 },
        ].forEach(({ sel, to, pre, suf, dur }, i) => {
          const el = document.querySelector<HTMLElement>(sel)
          if (!el) return
          const obj = { n: 0 }
          gsap.to(obj, {
            n: to, duration: dur, ease: 'expo.out', delay: 1.0 + i * 0.18,
            onUpdate() { el.innerHTML = `${pre}${Math.round(obj.n)}<em>${suf}</em>` }
          })
        })
      }

      // MARKET BARS DOM — build before GSAP context
      const ZONES_MKT = [
        {n:'Comporta',pm2:'€11.000',yoy:'+28%',w:1},
        {n:'Quinta do Lago',pm2:'€12.000',yoy:'+22%',w:1},
        {n:'Cascais',pm2:'€6.638',yoy:'+14%',w:.96},
        {n:'Lisboa',pm2:'€6.538',yoy:'+19%',w:.95},
        {n:'Porto Foz',pm2:'€5.800',yoy:'+13%',w:.84},
        {n:'Algarve',pm2:'€5.200',yoy:'+10%',w:.75},
        {n:'Oeiras',pm2:'€5.189',yoy:'+16%',w:.75},
      ]
      const mktEl = document.getElementById('mktZones')
      if (mktEl && !mktEl.hasChildNodes()) {
        ZONES_MKT.forEach(z => {
          const d = document.createElement('div')
          d.className = 'mkt-row'
          d.innerHTML = `<span class="mkt-nm">${z.n}</span><div class="mkt-bar"><div class="mkt-fill" style="width:${z.w*100}%"></div></div><span class="mkt-pm2">${z.pm2}</span><span class="mkt-yoy">${z.yoy}</span>`
          mktEl.appendChild(d)
        })
      }

      // Wait for loader to finish before running hero entrance
      // On mobile (isTouch=true): loader is not in DOM (HomeLoader returns null).
      // On desktop: loader starts hidden (SSR display:none), JS shows it, then 'done' class added.
      let heroEntranceFired = false
      function fireHeroEntrance() {
        if (heroEntranceFired) return
        heroEntranceFired = true
        setTimeout(heroEntrance, 150)
      }
      const loaderEl = document.getElementById('loader')
      if (loaderEl) {
        // Observe loader 'done' class — fires when loader animation completes
        const observer = new MutationObserver(() => {
          if (loaderEl.classList.contains('done')) {
            observer.disconnect()
            fireHeroEntrance()
          }
        })
        observer.observe(loaderEl, { attributes: true, attributeFilter: ['class'] })
        // Fallback: if loader already 'done' when this runs (fast hydration)
        if (loaderEl.classList.contains('done')) {
          fireHeroEntrance()
        }
        // Desktop: pre-run hero entrance WHILE loader is animating (hero ready when loader fades out).
        // heroEntranceFired flag ensures it only runs once regardless of which trigger fires first.
        if (!isTouch) {
          setTimeout(fireHeroEntrance, 300)
        }
        // Safety: if loader never gets 'done' (race/error), fire after 5s
        setTimeout(fireHeroEntrance, 5000)
      } else {
        // No loader present (mobile — HomeLoader returned null) — run hero entrance directly
        fireHeroEntrance()
      }

      // ALL SCROLLTRIGGER ANIMATIONS — deferred one frame
      // On mobile/touch: skip ALL GSAP sets and ScrollTrigger — CSS handles visibility
      rafId = requestAnimationFrame(() => {
        if (cancelled) return
        try {
          gsapCtx = gsap.context(() => {
            // SCROLL PROGRESS
            gsap.to('#pgb', { scaleX:1, ease:'none', scrollTrigger:{ trigger: document.body, start:'top top', end:'bottom bottom', scrub:0.5 }})
            // NAV SOLID
            ScrollTrigger.create({
              start: 90,
              onEnter: () => document.getElementById('mainNav')?.classList.add('solid'),
              onLeaveBack: () => document.getElementById('mainNav')?.classList.remove('solid'),
            })

            // ── MOBILE/TOUCH/NARROW: no initial GSAP sets, no ScrollTrigger animations
            // CSS @media(pointer:coarse) + @media(max-width:1099px) ensure all elements visible
            if (skipHeroAnim) return

            // Set initial states (desktop only)
            gsap.set('.text-reveal-inner', { y: '102%' })
            gsap.set('.clip-reveal', { clipPath: 'inset(0 100% 0 0)' })
            gsap.set('.fade-in', { opacity: 0, y: 48 })
            // TEXT REVEALS
            document.querySelectorAll('.sec-h2,.mkt-h2,.ag-h2').forEach(heading => {
              const lines = heading.querySelectorAll('.text-reveal-inner')
              if (!lines.length) return
              gsap.fromTo(lines, { y: '115%' }, { y:0, duration:1.1, stagger:0.11, ease:'power4.out', scrollTrigger:{ trigger:heading, start:'top 80%', once:true }})
            })
            document.querySelectorAll('.text-reveal').forEach(el => {
              const inner = el.querySelector('.text-reveal-inner')
              if (!inner) return
              if ((el.closest('.sec-h2,.mkt-h2,.ag-h2'))) return
              gsap.fromTo(inner, { y: '102%' }, { y:0, duration:1.1, ease:'power4.out', scrollTrigger:{ trigger:el, start:'top 82%', once:true }})
            })
            // CLIP REVEALS
            document.querySelectorAll('.clip-reveal').forEach(el => {
              gsap.fromTo(el, { clipPath: 'inset(0 100% 0 0)' }, { clipPath:'inset(0 0% 0 0)', duration:1.2, ease:'power4.inOut', scrollTrigger:{ trigger:el, start:'top 85%', once:true }})
            })
            // FADE IN
            document.querySelectorAll('.fade-in').forEach((el, i) => {
              const delay = Math.min(i * 0.05, 0.25)
              gsap.fromTo(el, { opacity:0, y:48 }, { opacity:1, y:0, duration:1.0, ease:'power3.out', delay, scrollTrigger:{ trigger:el, start:'top 84%', once:true }})
            })
            // IMÓVEIS CLIP-PATH REVEAL
            document.querySelectorAll<HTMLElement>('.imc').forEach((card, i) => {
              const revEl = card.querySelector('.imc-img-reveal')
              if (!revEl) return
              gsap.timeline({ scrollTrigger:{ trigger:card, start:'top 80%', once:true, onEnter:()=>card.classList.add('revealed') }})
                .fromTo(revEl,
                  { clipPath:'inset(0 0 0% 0)' },
                  { clipPath:'inset(0 0 100% 0)', duration:1.2, delay: Math.min(i * 0.1, 0.3), ease:'power4.inOut' })
            })
            // ZONAS STAGGER — skip on touch/mobile/narrow (CSS forces visibility)
            if (!skipHeroAnim && document.querySelector('.zc') && document.querySelector('.zonas-grid')) {
              gsap.fromTo('.zc',
                { clipPath:'inset(0 0 100% 0)', opacity:0 },
                { clipPath:'inset(0 0 0% 0)', opacity:1, duration:1.1, stagger:{ amount:0.7, from:'start' }, ease:'power4.inOut',
                  scrollTrigger:{ trigger:'.zonas-grid', start:'top 78%', once:true } })
            }
            // MARKET BARS ANIMATION
            if (document.querySelector('.mkt-zones')) {
              gsap.set('.mkt-fill', { scaleX: 0, transformOrigin: 'left' })
              gsap.to('.mkt-fill', { scaleX:1, duration:1.4, stagger:0.08, ease:'power3.out', scrollTrigger:{ trigger:'.mkt-zones', start:'top 80%', once:true }})
            }
            // CREDENCIAIS — skip on touch/mobile/narrow
            if (!skipHeroAnim && document.querySelector('.cred-grid')) {
              gsap.fromTo('.cred-c', { opacity:0, y:56 }, { opacity:1, y:0, duration:1.1, stagger:0.1, ease:'power3.out', scrollTrigger:{ trigger:'.cred-grid', start:'top 82%', once:true }})
            }
            // NUMBER COUNTERS — credenciais
            ;[
              { sel: '.cred-c:nth-child(1) .cred-n', to: 169, pre: '', suf: 'K' },
              { sel: '.cred-c:nth-child(2) .cred-n', to: 17, pre: '+', suf: '%' },
              { sel: '.cred-c:nth-child(3) .cred-n', to: 44, pre: '', suf: '%' },
            ].forEach(({ sel, to, pre, suf }) => {
              const el = document.querySelector<HTMLElement>(sel)
              if (!el) return
              const obj = { n: 0 }
              gsap.to(obj, {
                n: to, duration: 2.8, ease: 'power4.out',
                scrollTrigger: { trigger: el, start: 'top 85%', once: true },
                onUpdate() { el.innerHTML = `${pre}${Math.round(obj.n)}<sup>${suf}</sup>` }
              })
            })
            // MAGNETIC BUTTONS
            document.querySelectorAll<HTMLElement>('.btn-gold, .btn-outline').forEach(btn => {
              btn.addEventListener('mousemove', (e: MouseEvent) => {
                const r = btn.getBoundingClientRect()
                gsap.to(btn, { x: (e.clientX-r.left-r.width/2)*0.22, y: (e.clientY-r.top-r.height/2)*0.22, duration: 0.35, ease: 'power3.out', overwrite: 'auto' })
              })
              btn.addEventListener('mouseleave', () => {
                gsap.to(btn, { x: 0, y: 0, duration: 0.85, ease: 'elastic.out(0.75,0.4)', overwrite: 'auto' })
              })
            })
            // ZONE CARDS — mousemove image parallax
            document.querySelectorAll<HTMLElement>('.zc').forEach(card => {
              const bg = card.querySelector<HTMLElement>('.zc-bg')
              if (!bg) return
              card.addEventListener('mousemove', (e: MouseEvent) => {
                const r = card.getBoundingClientRect()
                gsap.to(bg, { x: ((e.clientX-r.left)/r.width-0.5)*22, y: ((e.clientY-r.top)/r.height-0.5)*22, scale: 1.06, duration: 0.6, ease: 'power2.out', overwrite: 'auto' })
              })
              card.addEventListener('mouseleave', () => {
                gsap.to(bg, { x: 0, y: 0, scale: 1, duration: 1.1, ease: 'power3.out', overwrite: 'auto' })
              })
            })
            // FONTS READY — final refresh
            document.fonts.ready.then(() => {
              if (!cancelled) requestAnimationFrame(() => { if (!cancelled) ScrollTrigger.refresh() })
            })
          })
        } catch (e) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('[GSAP] ScrollTrigger init error (StrictMode):', e)
          }
        }
      })
    }

    initAnimations()

    return () => {
      cancelled = true
      gsapInitRef.current = false
      if (rafId != null) cancelAnimationFrame(rafId)
      gsapCtx?.revert()
    }
  }, [])

  // This component renders nothing — it's a pure side-effect island
  return null
}
