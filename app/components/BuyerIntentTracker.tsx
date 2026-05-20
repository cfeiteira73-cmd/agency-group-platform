'use client'
// AGENCY GROUP — Buyer Intelligence Engine | AMI: 22506
// BuyerIntentTracker — invisible client-side behavior tracker.
// GDPR Art. 6(1)(a): tracking only starts after explicit cookie consent.
// Consent state is read from the ag_cookie_consent cookie (set by CookieConsentBanner).
// If consent is granted on mount → starts immediately.
// If consent is granted later → listens for ag:consent-granted event (no reload needed).
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

const SESSION_KEY    = 'ag_session_id'
const TRACK_URL      = '/api/buyer-intelligence/track'
const DEBOUNCE_MS    = 500
const CONSENT_COOKIE = 'ag_cookie_consent'  // set by CookieConsentBanner

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * GDPR Art. 6(1)(a) — lawful basis: consent.
 * Returns true only when the user has explicitly accepted analytics cookies.
 */
function hasAnalyticsConsent(): boolean {
  try {
    if (typeof document === 'undefined') return false
    return document.cookie
      .split(';')
      .some(c => c.trim().startsWith(`${CONSENT_COOKIE}=granted`))
  } catch {
    return false
  }
}

function getOrCreateSessionId(): string {
  try {
    const existing = localStorage.getItem(SESSION_KEY)
    if (existing && existing.length > 0) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, id)
    return id
  } catch {
    return crypto.randomUUID()
  }
}

// ---------------------------------------------------------------------------
// Tracker component
// ---------------------------------------------------------------------------

export default function BuyerIntentTracker(): null {
  const sessionIdRef      = useRef<string>('')
  const debounceTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingEventRef   = useRef<{ event_type: string; payload: Record<string, unknown> } | null>(null)
  const initializedRef    = useRef(false)

  // ── Send event to API (debounced) ─────────────────────────────────────────

  const sendEvent = (
    event_type: string,
    payload: Record<string, unknown> = {},
  ): void => {
    if (!sessionIdRef.current) return

    pendingEventRef.current = { event_type, payload }

    if (debounceTimerRef.current !== null) {
      clearTimeout(debounceTimerRef.current)
    }

    debounceTimerRef.current = setTimeout(() => {
      const evt = pendingEventRef.current
      if (!evt) return
      pendingEventRef.current  = null
      debounceTimerRef.current = null

      const body = JSON.stringify({
        session_id: sessionIdRef.current,
        event_type: evt.event_type,
        payload:    evt.payload,
      })

      try {
        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
          const blob = new Blob([body], { type: 'application/json' })
          const sent = navigator.sendBeacon(TRACK_URL, blob)
          if (sent) return
        }

        fetch(TRACK_URL, {
          method:    'POST',
          headers:   { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
          cache:     'no-store',
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
          .catch(() => { /* Non-blocking */ })
      } catch {
        /* Non-blocking */
      }
    }, DEBOUNCE_MS)
  }

  // ── Mount ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    // Resources created by startTracking — declared here so cleanup can reach them
    let scrollSentDepths : Set<number>       = new Set()
    let resizeObservers  : ResizeObserver[]  = []
    let sentinel50       : HTMLElement | null = null
    let sentinel90       : HTMLElement | null = null
    let handleListingViewed : ((e: Event) => void) | null = null
    let handleFilterApplied : ((e: Event) => void) | null = null
    let handleInquiryStart  : ((e: Event) => void) | null = null
    let handleInquirySubmit : ((e: Event) => void) | null = null

    // ── startTracking — idempotent, called on mount or on consent-granted ───

    function startTracking(): void {
      // GDPR Art. 6(1)(a) — do not track before explicit consent
      if (!hasAnalyticsConsent()) return
      if (initializedRef.current) return   // already wired up
      initializedRef.current = true

      try {
        sessionIdRef.current = getOrCreateSessionId()
      } catch {
        initializedRef.current = false
        return
      }

      const sessionId = sessionIdRef.current

      // ── 1. page_view ───────────────────────────────────────────────────────
      try {
        sendEvent('page_view', {
          path:     window.location.pathname,
          locale:   navigator.language,
          referrer: document.referrer || undefined,
        })
      } catch { /* Non-blocking */ }

      // ── 2. Scroll depth ────────────────────────────────────────────────────
      scrollSentDepths = new Set()
      resizeObservers  = []

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

          const resizeObserver = new ResizeObserver(updatePosition)
          resizeObserver.observe(document.documentElement)
          resizeObservers.push(resizeObserver)

          return sentinel
        } catch {
          return null
        }
      }

      sentinel50 = createDepthSentinel(50)
      sentinel90 = createDepthSentinel(90)

      // ── 3. Custom window events ────────────────────────────────────────────

      handleListingViewed = (e: Event): void => {
        try {
          const detail = (e as CustomEvent<Record<string, unknown>>).detail ?? {}
          sendEvent('listing_view', { ...detail, session_id: sessionId })
        } catch { /* Non-blocking */ }
      }

      handleFilterApplied = (e: Event): void => {
        try {
          const detail = (e as CustomEvent<Record<string, unknown>>).detail ?? {}
          sendEvent('filter_apply', { ...detail })
        } catch { /* Non-blocking */ }
      }

      handleInquiryStart = (e: Event): void => {
        try {
          const detail = (e as CustomEvent<Record<string, unknown>>).detail ?? {}
          sendEvent('inquiry_start', { ...detail })
        } catch { /* Non-blocking */ }
      }

      handleInquirySubmit = (e: Event): void => {
        try {
          const detail = (e as CustomEvent<Record<string, unknown>>).detail ?? {}
          sendEvent('inquiry_submit', { ...detail })
        } catch { /* Non-blocking */ }
      }

      window.addEventListener('ag:listing-viewed', handleListingViewed)
      window.addEventListener('ag:filter-applied', handleFilterApplied)
      window.addEventListener('ag:inquiry-start',  handleInquiryStart)
      window.addEventListener('ag:inquiry-submit', handleInquirySubmit)

      // ── 4. Revisit detection ───────────────────────────────────────────────
      try {
        const VISIT_KEY  = 'ag_last_visit'
        const lastVisit  = localStorage.getItem(VISIT_KEY)
        if (lastVisit) {
          const diff = Date.now() - Number(lastVisit)
          if (diff > 5 * 60 * 1000) {
            sendEvent('revisit', { gap_ms: diff })
          }
        }
        localStorage.setItem(VISIT_KEY, String(Date.now()))
      } catch { /* Non-blocking */ }
    }

    // ── Attempt immediate start (consent already given) ────────────────────
    startTracking()

    // ── Listen for runtime consent (no reload needed) ──────────────────────
    window.addEventListener('ag:consent-granted', startTracking)

    // ── Cleanup ─────────────────────────────────────────────────────────────
    return () => {
      try {
        if (debounceTimerRef.current !== null) clearTimeout(debounceTimerRef.current)
        scrollSentDepths.clear()
        sentinel50?.remove()
        sentinel90?.remove()
        resizeObservers.forEach(ro => ro.disconnect())
        if (handleListingViewed) window.removeEventListener('ag:listing-viewed', handleListingViewed)
        if (handleFilterApplied) window.removeEventListener('ag:filter-applied', handleFilterApplied)
        if (handleInquiryStart)  window.removeEventListener('ag:inquiry-start',  handleInquiryStart)
        if (handleInquirySubmit) window.removeEventListener('ag:inquiry-submit', handleInquirySubmit)
        window.removeEventListener('ag:consent-granted', startTracking)
      } catch { /* Non-blocking */ }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
