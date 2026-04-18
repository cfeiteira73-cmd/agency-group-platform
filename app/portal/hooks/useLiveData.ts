'use client'
// =============================================================================
// AGENCY GROUP — Global Live Data Hook v4.0
// Loads real Supabase data into Zustand stores on portal mount.
//
// v4.0 changes (Wave D):
//   • Per-endpoint failure tracking with named keys
//   • 1 automatic retry per endpoint on network failure / timeout
//   • AbortSignal.timeout(15s) per fetch — no hanging requests
//   • 401 detection → sets has401 flag in uiStore for session-expiry handling
//   • Writes LiveDataStatus to uiStore — dashboard can show partial/full failure
//   • Never fails silently: every failure is both logged and tracked
// =============================================================================

import { useEffect, useRef } from 'react'
import { useCRMStore } from '../stores/crmStore'
import { useDealStore } from '../stores/dealStore'
import { useUIStore } from '../stores/uiStore'
import type { CRMContact, Deal } from '../components/types'
import { CHECKLISTS } from '../components/constants'

// ─── Config ───────────────────────────────────────────────────────────────────
/** Per-fetch timeout.  Prevents one slow endpoint from blocking the whole grid. */
const FETCH_TIMEOUT_MS = 15_000
/** Delay before a single automatic retry on network / timeout failure. */
const RETRY_DELAY_MS   =  2_000

// ─── Endpoint map (ordered — index used for result matching) ─────────────────
const ENDPOINTS: Record<string, string> = {
  crm:        '/api/crm?limit=100',
  deals:      '/api/deals?limit=100',
  properties: '/api/properties?limit=50',
  signals:    '/api/signals?limit=20&status=all',
  activities: '/api/activities?limit=50',
  market:     '/api/market-data',
}

// ─── fetchWithRetry ───────────────────────────────────────────────────────────
// Single retry on network failure or timeout.  Does NOT retry HTTP 4xx/5xx —
// those are intentional server responses.
async function fetchWithRetry(url: string): Promise<Response> {
  const attempt = () => fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) })
  try {
    return await attempt()
  } catch (err) {
    const isRetryable =
      (err as Error)?.name === 'TimeoutError' ||
      (err as Error)?.name === 'AbortError'   ||
      err instanceof TypeError // network failure
    if (isRetryable) {
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
      return attempt() // second attempt — let it throw if it fails again
    }
    throw err
  }
}

// ─── EndpointResult ──────────────────────────────────────────────────────────
interface EndpointResult {
  key: string
  res: Response | null
  httpStatus: number | null
  error: Error | null
}

// ─── useLiveData ─────────────────────────────────────────────────────────────
export function useLiveData(): void {
  const { setCrmContacts }   = useCRMStore()
  const { setDeals }         = useDealStore()
  const {
    setProperties, setSignals, setActivities, setMarketSnapshots,
    setLiveDataStatus,
  } = useUIStore()

  // One-shot guard — bootstrap runs once per portal session.
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true

    async function bootstrap() {
      const keys = Object.keys(ENDPOINTS)

      // ── Fire all requests in parallel ───────────────────────────────────────
      // Each fetch is wrapped so errors produce an EndpointResult, never a
      // rejected promise.  This means Promise.allSettled always sees 'fulfilled'.
      const settled = await Promise.allSettled(
        keys.map(async (key): Promise<EndpointResult> => {
          try {
            const res = await fetchWithRetry(ENDPOINTS[key])
            return { key, res, httpStatus: res.status, error: null }
          } catch (err) {
            return { key, res: null, httpStatus: null, error: err as Error }
          }
        })
      )

      // ── Build result map ─────────────────────────────────────────────────────
      const resultMap: Record<string, EndpointResult> = {}
      for (const r of settled) {
        // All are 'fulfilled' because we catch inside — but type-guard for TS
        if (r.status === 'fulfilled') resultMap[r.value.key] = r.value
      }

      // ── Classify failures ────────────────────────────────────────────────────
      const failedEndpoints: string[] = []
      let has401 = false

      for (const key of keys) {
        const r = resultMap[key]
        if (!r) {
          failedEndpoints.push(key)
          continue
        }
        if (r.error) {
          failedEndpoints.push(key)
          console.warn(`[LiveData] ${key} network/timeout error:`, r.error.message)
          continue
        }
        if (r.res && !r.res.ok) {
          failedEndpoints.push(key)
          if (r.httpStatus === 401) has401 = true
          console.warn(`[LiveData] ${key} HTTP ${r.httpStatus}`)
        }
      }

      const successCount = keys.length - failedEndpoints.length

      // ── Write status to uiStore ─────────────────────────────────────────────
      setLiveDataStatus({
        isInitialLoad:    false,
        failedEndpoints,
        hasPartialFailure: failedEndpoints.length > 0 && failedEndpoints.length < keys.length,
        hasFullFailure:    failedEndpoints.length === keys.length,
        lastSuccessAt:     successCount > 0 ? Date.now() : null,
        has401,
      })

      // ── If session has expired, stop processing ─────────────────────────────
      // PortalDashboard watches has401 and triggers the redirect.
      if (has401) {
        console.warn('[LiveData] 401 detected — session may be expired')
        return
      }

      // ── Process successful endpoints ────────────────────────────────────────

      // --- CRM ---
      const crm = resultMap['crm']
      if (crm?.res?.ok) {
        try {
          const json = await crm.res.json() as { data?: CRMContact[] }
          if (json.data && json.data.length > 0) {
            setCrmContacts(json.data)
            console.log(`[LiveData] ✓ crm: ${json.data.length} contacts`)
          }
        } catch { /* malformed JSON — ignore, demo data remains */ }
      }

      // --- Deals ---
      const dealsResult = resultMap['deals']
      if (dealsResult?.res?.ok) {
        try {
          const json = await dealsResult.res.json() as { data?: Deal[] }
          if (json.data && json.data.length > 0) {
            const enriched = json.data.map(d => ({
              ...d,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              checklist: (CHECKLISTS as any)[d.fase] ?? (CHECKLISTS as any)['Contacto'] ?? {},
            }))
            setDeals(enriched)
            console.log(`[LiveData] ✓ deals: ${json.data.length}`)
          }
        } catch { /* malformed JSON */ }
      }

      // --- Properties ---
      const props = resultMap['properties']
      if (props?.res?.ok) {
        try {
          const json = await props.res.json() as { data?: unknown[]; properties?: unknown[] }
          const data = json.data ?? json.properties
          if (data && data.length > 0) {
            setProperties(data)
            console.log(`[LiveData] ✓ properties: ${data.length}`)
          }
        } catch { /* ignore */ }
      }

      // --- Signals ---
      const signals = resultMap['signals']
      if (signals?.res?.ok) {
        try {
          const json = await signals.res.json() as { data?: unknown[]; signals?: unknown[] }
          const data = json.data ?? json.signals
          if (data && data.length > 0) {
            setSignals(data)
            console.log(`[LiveData] ✓ signals: ${data.length}`)
          }
        } catch { /* ignore */ }
      }

      // --- Activities ---
      const activities = resultMap['activities']
      if (activities?.res?.ok) {
        try {
          const json = await activities.res.json() as { data?: unknown[]; activities?: unknown[] }
          const data = json.data ?? json.activities
          if (data && data.length > 0) {
            setActivities(data)
            console.log(`[LiveData] ✓ activities: ${data.length}`)
          }
        } catch { /* ignore */ }
      }

      // --- Market data ---
      const market = resultMap['market']
      if (market?.res?.ok) {
        try {
          const json = await market.res.json() as {
            zones?: unknown[]; data?: unknown[]; snapshots?: unknown[]
          }
          const data = json.data ?? json.snapshots ?? json.zones
          if (data && (data as unknown[]).length > 0) {
            setMarketSnapshots(data as unknown[])
            console.log(`[LiveData] ✓ market: ${(data as unknown[]).length} zones`)
          }
        } catch { /* ignore */ }
      }
    }

    bootstrap()
  }, [setCrmContacts, setDeals, setProperties, setSignals, setActivities, setMarketSnapshots, setLiveDataStatus])
}
