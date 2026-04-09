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

      // Detect mobile — multiple signals for maximum reliability across all devices
      const isTouch = typeof window !== 'undefined' && (
        window.matchMedia('(pointer: coarse)').matches ||
        window.innerWidth <= 960 ||
        ('ontouchstart' in window) ||
        navigator.maxTouchPoints > 0
      )

      // Hard safety: force all hero elements visible after 1.5s regardless of GSAP
      // On mobile this ALWAYS fires (heroEntrance no longer cancels it for touch devices)
      const heroSafetyTimer = setTimeout(() => {
        const sels = ['.hero-h1 .line-inner','#hEye','#hSub','#hBtns','#hStats','#hScroll','#searchBox','.zc','.fade-in','.line-inner','.text-reveal-inner','.clip-reveal','.hero-content','.hero-eyebrow','.hero-sub','.hero-btns']
        sels.forEach(sel => {
          document.querySelectorAll<HTMLElement>(sel).forEach(el => {
            el.style.removeProperty('opacity')
            el.style.removeProperty('transform')
            el.style.removeProperty('filter')
            el.style.removeProperty('clip-path')
            el.style.removeProperty('visibility')
          })
        })
      }, 1500)

      // HERO ENTRANCE — fires after loader completes
      function heroEntrance() {
        // On mobile/touch: skip animations — CSS + HomeLoader already force visibility
        // Do NOT cancel heroSafetyTimer on mobile — let it fire to remove any stale inline styles
        if (isTouch) return
        clearTimeout(heroSafetyTimer)

        gsap.set('.hero-h1 .line-inner', { y: '115%' })
        gsap.set('#hSub', { opacity: 0, y: 36, filter: 'blur(4px)' })
        gsap.set('#hBtns', { opacity: 0, y: 32 })
        gsap.set('#hStats', { opacity: 0, y: 24 })
        gsap.set('#hScroll', { opacity: 0, y: 12 })
        gsap.set('#searchBox', { opacity: 0, y: 28 })

        const tl = gsap.timeline()
        tl.fromTo('#hEye',
            { clipPath: 'inset(0 100% 0 0)' },
            { clipPath: 'inset(0 0% 0 0)', duration: 1.0, ease: 'power4.out' })
          .to('.hero-h1 .line-inner', { y: 0, duration: 1.1, stagger: 0.14, ease: 'power4.out' }, '-=0.55')
          .to('#hSub', { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'power3.out' }, '-=0.4')
          .to('#hBtns', { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out' }, '-=0.35')
          .to('#hStats', { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out' }, '-=0.5')
          .to('#searchBox', { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out' }, '-=0.5')
          .to('#hScroll', { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }, '-=0.3')

        // Hero stat counters
        ;[
          { sel: '#hStats > div:nth-child(1) .hs-n', to: 169, pre: '', suf: 'K', dur: 2.6 },
          { sel: '#hStats > div:nth-child(2) .hs-n', to: 17, pre: '+', suf: '%', dur: 2.0 },
          { sel: '#hStats > div:nth-child(3) .hs-n', to: 44, pre: '', suf: '%', dur: 2.2 },
        ].forEach(({ sel, to, pre, suf, dur }, i) => {
          const el = document.querySelector<HTMLElement>(sel)
          if (!el) return
          const obj = { n: 0 }
          gsap.to(obj, {
            n: to, duration: dur, ease: 'expo.out', delay: 1.4 + i * 0.18,
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
      const loaderEl = document.getElementById('loader')
      if (loaderEl) {
        // Observe loader 'done' class
        const observer = new MutationObserver(() => {
          if (loaderEl.classList.contains('done')) {
            observer.disconnect()
            setTimeout(heroEntrance, 150)
          }
        })
        observer.observe(loaderEl, { attributes: true, attributeFilter: ['class'] })
        // Fallback: if loader already done or hidden
        if (loaderEl.classList.contains('done') || loaderEl.style.display === 'none') {
          setTimeout(heroEntrance, 150)
        }
      } else {
        // No loader present — run hero entrance directly
        setTimeout(heroEntrance, 100)
      }

      // ALL SCROLLTRIGGER ANIMATIONS — deferred one frame
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
            // Set initial states
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
            // ZONAS STAGGER — skip on touch/mobile (CSS forces visibility)
            if (!isTouch && document.querySelector('.zc') && document.querySelector('.zonas-grid')) {
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
            // CREDENCIAIS — skip on touch/mobile
            if (!isTouch && document.querySelector('.cred-grid')) {
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
