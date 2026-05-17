'use client'
// AGENCY GROUP — Buyer Intelligence Engine | AMI: 22506
// BuyerIntentTracker — invisible client-side behavior tracker.
// Generates/restores a sessionId from localStorage, then emits events to
// /api/buyer-intelligence/track. Profiles are stored on window.__ag_buyer_profile.
// Zero visual output. All side effects run inside useEffect. Non-blocking.

import { useEffect, useRef } from 'react'

// ---------------------------------------------------------------------------
// Global type augmentation
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    __ag_buyer_profile?: Record<string, unknown>
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_KEY = 'ag_session_id'
const TRACK_URL = '/api/buyer-intelligence/track'
const DEBOUNCE_MS = 500

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getOrCreateSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY)
    if (existing && existing.length > 0) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, id)
    return id
  } catch {
    // localStorage unavailable (SSR guard, private mode, etc.)
    return crypto.randomUUID()
  }
}

// ---------------------------------------------------------------------------
// Tracker component
// ---------------------------------------------------------------------------

export default function BuyerIntentTracker(): null {
  const sessionIdRef = useRef<string>('')
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingEventRef = useRef<{ event_type: string; payload: Record<string, unknown> } | null>(null)

  // ── Send event to API (debounced) ─────────────────────────────────────────

  const sendEvent = (
    event_type: string,
    payload: Record<string, unknown> = {},
  ): void => {
    if (!sessionIdRef.current) return

    // Overwrite pending — debounce merges rapid-fire events of same type
    pendingEventRef.current = { event_type, payload }

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      const evt = pendingEventRef.current
      if (!evt) return
      pendingEventRef.current = null
      debounceTimerRef.current = null

      const body = JSON.stringify({
        session_id: sessionIdRef.current,
        event_type: evt.event_type,
        payload: evt.payload,
      })

      try {
        // Use sendBeacon when available for fire-and-forget (works during page unload)
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          const blob = new Blob([body], { type: 'application/json' })
          const sent = navigator.sendBeacon(TRACK_URL, blob)
          if (sent) return
        }

        // Fallback: fetch with no-store cache, keepalive
        fetch(TRACK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
          cache: 'no-store',
        })
          .then((res) => {
            if (!res.ok) return
            return res.json()
          })
          .then((data: unknown) => {
            if (
              data !== null &&
              typeof data === 'object' &&
              'profile' in (data as Record<string, unknown>)
            ) {
              const d = data as Record<string, unknown>
              if (d.profile && typeof d.profile === 'object') {
                window.__ag_buyer_profile = d.profile as Record<string, unknown>
              }
            }
          })
          .catch(() => {
            // Non-blocking — swallow silently
          })
      } catch {
        // Non-blocking — swallow silently
      }
    }, DEBOUNCE_MS)
  }

  // ── Mount ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      sessionIdRef.current = getOrCreateSessionId()
    } catch {
      return
    }

    const sessionId = sessionIdRef.current

    // ── 1. Track page_view immediately ──────────────────────────────────────
    try {
      sendEvent('page_view', {
        path:   typeof window !== 'undefined' ? window.location.pathname : '/',
        locale: typeof navigator !== 'undefined' ? navigator.language : undefined,
        referrer: typeof document !== 'undefined' ? document.referrer || undefined : undefined,
      })
    } catch {
      // Non-blocking
    }

    // ── 2. Scroll depth via IntersectionObserver ────────────────────────────
    const scrollSentDepths = new Set<number>()

    const createDepthSentinel = (depthPercent: number): HTMLElement | null => {
      try {
        const sentinel = document.createElement('div')
        sentinel.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none;visibility:hidden;'
        sentinel.setAttribute('aria-hidden', 'true')
        document.body.appendChild(sentinel)

        const updatePosition = (): void => {
          const totalHeight = document.documentElement.scrollHeight
          sentinel.style.top = `${(totalHeight * depthPercent) / 100}px`
        }
        updatePosition()

        const observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (entry.isIntersecting && !scrollSentDepths.has(depthPercent)) {
                scrollSentDepths.add(depthPercent)
                sendEvent('scroll_depth', { depth_percent: depthPercent, path: window.location.pathname })
              }
            }
          },
          { threshold: 0 },
        )

        observer.observe(sentinel)

        // Update sentinel position if content height changes
        const resizeObserver = new ResizeObserver(updatePosition)
        resizeObserver.observe(document.documentElement)

        return sentinel
      } catch {
        return null
      }
    }

    const sentinel50 = createDepthSentinel(50)
    const sentinel90 = createDepthSentinel(90)

    // ── 3. Custom window events ─────────────────────────────────────────────

    const handleListingViewed = (e: Event): void => {
      try {
        const detail = (e as CustomEvent<Record<string, unknown>>).detail ?? {}
        sendEvent('listing_view', { ...detail, session_id: sessionId })
      } catch {
        // Non-blocking
      }
    }

    const handleFilterApplied = (e: Event): void => {
      try {
        const detail = (e as CustomEvent<Record<string, unknown>>).detail ?? {}
        sendEvent('filter_apply', { ...detail })
      } catch {
        // Non-blocking
      }
    }

    const handleInquiryStart = (e: Event): void => {
      try {
        const detail = (e as CustomEvent<Record<string, unknown>>).detail ?? {}
        sendEvent('inquiry_start', { ...detail })
      } catch {
        // Non-blocking
      }
    }

    const handleInquirySubmit = (e: Event): void => {
      try {
        const detail = (e as CustomEvent<Record<string, unknown>>).detail ?? {}
        sendEvent('inquiry_submit', { ...detail })
      } catch {
        // Non-blocking
      }
    }

    window.addEventListener('ag:listing-viewed',  handleListingViewed)
    window.addEventListener('ag:filter-applied',  handleFilterApplied)
    window.addEventListener('ag:inquiry-start',   handleInquiryStart)
    window.addEventListener('ag:inquiry-submit',  handleInquirySubmit)

    // ── 4. Revisit detection ────────────────────────────────────────────────
    try {
      const VISIT_KEY = 'ag_last_visit'
      const lastVisit = localStorage.getItem(VISIT_KEY)
      if (lastVisit) {
        const diff = Date.now() - Number(lastVisit)
        // If returning after >5 minutes, classify as revisit
        if (diff > 5 * 60 * 1000) {
          sendEvent('revisit', { gap_ms: diff })
        }
      }
      localStorage.setItem(VISIT_KEY, String(Date.now()))
    } catch {
      // Non-blocking
    }

    // ── Cleanup ─────────────────────────────────────────────────────────────
    return () => {
      try {
        if (debounceTimerRef.current !== null) {
          clearTimeout(debounceTimerRef.current)
        }
        scrollSentDepths.clear()
        sentinel50?.remove()
        sentinel90?.remove()
        window.removeEventListener('ag:listing-viewed',  handleListingViewed)
        window.removeEventListener('ag:filter-applied',  handleFilterApplied)
        window.removeEventListener('ag:inquiry-start',   handleInquiryStart)
        window.removeEventListener('ag:inquiry-submit',  handleInquirySubmit)
      } catch {
        // Non-blocking
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
