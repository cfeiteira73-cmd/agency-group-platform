'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'

export default function HomeLoader() {
  const loaderRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loader = loaderRef.current
    if (!loader) return

    document.body.style.overflow = 'hidden'

    function finishLoader() {
      if (!loader) return
      if (loader.classList.contains('done')) return
      loader.classList.add('done')
      document.body.style.overflow = ''
      setTimeout(() => {
        if (loaderRef.current) loaderRef.current.style.display = 'none'
      }, 1200)
    }

    // Safety: force loader out after 1200ms for faster LCP
    const ldrSafetyTimer = setTimeout(finishLoader, 1200)
    window.addEventListener('load', finishLoader, { once: true })

    gsap.set('#ldrA', { y: 40, opacity: 0, filter: 'blur(8px)' })
    gsap.set('#ldrG', { y: 40, opacity: 0, filter: 'blur(8px)' })
    gsap.set('#ldrFill', { scaleX: 0, transformOrigin: 'left center' })
    gsap.set('#ldrTxt', { opacity: 0, y: 12 })

    const ldrTL = gsap.timeline({
      onComplete: () => { clearTimeout(ldrSafetyTimer); finishLoader() }
    })
    ldrTL
      .to('#ldrA', { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.7, ease: 'expo.out' })
      .to('#ldrG', { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.7, ease: 'expo.out' }, '-=0.45')
      .to('#ldrFill', { scaleX: 1, duration: 1.2, ease: 'power3.out' }, '-=0.4')
      .to('#ldrTxt', { opacity: 1, y: 0, duration: 0.55, ease: 'power3.out' }, '-=0.9')
      .to(loader, { opacity: 0, duration: 0.6, ease: 'power2.inOut', delay: 0.3 })

    return () => {
      clearTimeout(ldrSafetyTimer)
      window.removeEventListener('load', finishLoader)
      ldrTL.kill()
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
