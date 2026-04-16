// =============================================================================
// UTM Attribution Utility — Agency Group
// Captures first-touch and last-touch UTM params, stores in sessionStorage,
// and exposes getUTMs() to spread into any /api/leads payload.
// Client-side only — never runs on server.
// =============================================================================

const FIRST_KEY = 'ag_utm_first'
const LAST_KEY  = 'ag_utm_last'

export interface UTMData {
  utm_source?:   string
  utm_medium?:   string
  utm_campaign?: string
  utm_term?:     string
  utm_content?:  string
  utm_landing?:  string
}

/** Call once on page load — captures UTMs from URL and stores them */
export function captureUTMs(): void {
  if (typeof window === 'undefined') return
  try {
    const params   = new URLSearchParams(window.location.search)
    const source   = params.get('utm_source')   ?? undefined
    const medium   = params.get('utm_medium')   ?? undefined
    const campaign = params.get('utm_campaign') ?? undefined
    const term     = params.get('utm_term')     ?? undefined
    const content  = params.get('utm_content')  ?? undefined
    const landing  = window.location.href

    // First touch — only written once per session
    const existingFirst = sessionStorage.getItem(FIRST_KEY)
    if (!existingFirst) {
      const firstTouch: UTMData = { utm_landing: landing }
      if (source)   firstTouch.utm_source   = source
      if (medium)   firstTouch.utm_medium   = medium
      if (campaign) firstTouch.utm_campaign = campaign
      if (term)     firstTouch.utm_term     = term
      if (content)  firstTouch.utm_content  = content
      sessionStorage.setItem(FIRST_KEY, JSON.stringify(firstTouch))
    }

    // Last touch — updated whenever new UTMs arrive
    if (source || medium || campaign) {
      const lastTouch: UTMData = { utm_landing: landing }
      if (source)   lastTouch.utm_source   = source
      if (medium)   lastTouch.utm_medium   = medium
      if (campaign) lastTouch.utm_campaign = campaign
      if (term)     lastTouch.utm_term     = term
      if (content)  lastTouch.utm_content  = content
      sessionStorage.setItem(LAST_KEY, JSON.stringify(lastTouch))
    }
  } catch {
    // Silent — tracking must never break UI
  }
}

/** Returns UTM data (first touch wins for source/medium, last touch for campaign) */
export function getUTMs(): UTMData {
  if (typeof window === 'undefined') return {}
  try {
    const first: UTMData = JSON.parse(sessionStorage.getItem(FIRST_KEY) ?? '{}')
    const last:  UTMData = JSON.parse(sessionStorage.getItem(LAST_KEY)  ?? '{}')
    return {
      utm_source:   first.utm_source   ?? last.utm_source,
      utm_medium:   first.utm_medium   ?? last.utm_medium,
      utm_campaign: last.utm_campaign  ?? first.utm_campaign,
      utm_term:     last.utm_term      ?? first.utm_term,
      utm_content:  last.utm_content   ?? first.utm_content,
      utm_landing:  first.utm_landing  ?? last.utm_landing,
    }
  } catch {
    return {}
  }
}
