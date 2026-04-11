// ─── Google Tag Manager / dataLayer utility ───────────────────────────────────
// Usage: import { track } from '@/lib/gtm'
//        track('lead_form_submit', { source: 'homepage' })
//
// Requires NEXT_PUBLIC_GTM_ID to be set in environment for the GTM script
// to actually load. Events are pushed to window.dataLayer regardless —
// GTM will pick them up once the script loads.

declare global {
  interface Window {
    dataLayer: Record<string, unknown>[]
  }
}

type TrackEvent =
  | 'lead_form_submit'
  | 'whatsapp_click'
  | 'sofia_started'
  | 'property_viewed'
  | 'qualification_completed'
  | 'mortgage_simulated'
  | 'compare_initiated'

export function track(event: TrackEvent, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  try {
    window.dataLayer = window.dataLayer || []
    window.dataLayer.push({
      event,
      ...params,
    })
  } catch {
    // Silently fail — tracking must never break the UI
  }
}
