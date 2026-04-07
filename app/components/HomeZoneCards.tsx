'use client'

// ─── HomeZoneCards ────────────────────────────────────────────────────────────
// Attaches zone card click handlers to scroll+filter the properties section.
// The zone cards themselves are rendered as static HTML in the RSC page.tsx,
// so this component just attaches event listeners after hydration.

import { useEffect } from 'react'

export default function HomeZoneCards() {
  useEffect(() => {
    // Attach click handlers to all .zc zone cards
    const cards = document.querySelectorAll<HTMLAnchorElement>('.zc')
    const handlers: Array<[HTMLAnchorElement, (e: MouseEvent) => void]> = []

    cards.forEach(card => {
      const zoneNameEl = card.querySelector('.zc-nm')
      const zoneName = zoneNameEl?.textContent || ''

      const handler = (e: MouseEvent) => {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('ag:filter-zona', { detail: { zona: zoneName } }))
      }

      card.addEventListener('click', handler)
      handlers.push([card, handler])
    })

    return () => {
      handlers.forEach(([card, handler]) => card.removeEventListener('click', handler))
    }
  }, [])

  // Also attach off-market footer link handlers
  useEffect(() => {
    const offLinks = document.querySelectorAll<HTMLAnchorElement>('[data-open-offmarket]')
    const handlers: Array<[HTMLAnchorElement, (e: MouseEvent) => void]> = []

    offLinks.forEach(link => {
      const handler = (e: MouseEvent) => {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('ag:open-offmarket'))
      }
      link.addEventListener('click', handler)
      handlers.push([link, handler])
    })

    return () => {
      handlers.forEach(([link, handler]) => link.removeEventListener('click', handler))
    }
  }, [])

  return null
}
