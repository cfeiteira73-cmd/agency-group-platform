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
  | 'sofia_message_sent'
  | 'sofia_lead_captured'
  | 'property_viewed'
  | 'property_visit_request'
  | 'qualification_completed'
  | 'mortgage_simulated'
  | 'avm_submitted'
  | 'avm_result_shown'
  | 'calculator_use'
  | 'compare_initiated'
  | 'seller_cta_click'
  | 'seller_cta_impression'
  // Saved searches & alerts
  | 'saved_search_opened'
  | 'saved_search_submitted'
  | 'saved_search_success'
  | 'alert_optin'
  // Blog conversion
  | 'blog_cta_clicked'
  | 'related_listing_clicked'
  | 'inline_capture_submitted'
  | 'blog_saved_search_clicked'
  // Trust & press
  | 'press_article_clicked'
  // Buyer pipeline
  | 'buyer_lead_submitted'
  | 'consultation_booked'
  // Hero & homepage CTA tracking (desktop + mobile)
  | 'hero_cta_click'
  // Properties section CTA
  | 'properties_cta_click'
  // Blog capture impression (fires on mount, before submit)
  | 'blog_capture_impression'
  // Portal
  | 'portal_login_attempt'
  | 'portal_login_success'
  // Filters & search
  | 'property_filter_applied'
  | 'property_search_nl'
  // Map interaction
  | 'map_property_clicked'
  // UTM source recorded (fired after lead capture)
  | 'lead_attributed'

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
