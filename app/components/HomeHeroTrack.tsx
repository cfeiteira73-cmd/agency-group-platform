'use client'
// ─── HomeHeroTrack — GTM tracking client island ──────────────────────────────
// Lightweight client island. Attaches click listeners to hero CTAs via DOM IDs.
// Works on both desktop (#hBtns a) and mobile (#mHeroPrimary, #mHeroSecondary).
// Zero JSX changes needed in RSC parent components.
// Events fire only after GTM script loads (NEXT_PUBLIC_GTM_ID required in Vercel).

import { useEffect } from 'react'
import { track } from '@/lib/gtm'

interface Props {
  device: 'desktop' | 'mobile'
}

export default function HomeHeroTrack({ device }: Props) {
  useEffect(() => {
    if (device === 'desktop') {
      // Desktop: CTAs are inside #hBtns
      const container = document.getElementById('hBtns')
      if (!container) return

      const links = container.querySelectorAll('a')
      const handlers: Array<{ el: Element; fn: EventListener }> = []

      links.forEach((link, i) => {
        const cta = i === 0 ? 'portfolio' : 'talk_advisor'
        const fn: EventListener = () =>
          track('hero_cta_click', { cta, device: 'desktop', position: 'above_fold' })
        link.addEventListener('click', fn)
        handlers.push({ el: link, fn })
      })

      return () => {
        handlers.forEach(({ el, fn }) => el.removeEventListener('click', fn))
      }
    }

    if (device === 'mobile') {
      const primaryEl  = document.getElementById('mHeroPrimary')
      const secondaryEl = document.getElementById('mHeroSecondary')

      const fnPrimary: EventListener = () =>
        track('hero_cta_click', { cta: 'portfolio', device: 'mobile', position: 'above_fold' })
      const fnSecondary: EventListener = () =>
        track('hero_cta_click', { cta: 'talk_advisor', device: 'mobile', position: 'above_fold' })

      primaryEl?.addEventListener('click', fnPrimary)
      secondaryEl?.addEventListener('click', fnSecondary)

      return () => {
        primaryEl?.removeEventListener('click', fnPrimary)
        secondaryEl?.removeEventListener('click', fnSecondary)
      }
    }
  }, [device])

  // Renders nothing — pure side-effect island
  return null
}
