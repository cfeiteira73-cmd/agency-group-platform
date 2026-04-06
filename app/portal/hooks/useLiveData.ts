'use client'
// =============================================================================
// AGENCY GROUP — Global Live Data Hook v3.0
// Loads real Supabase data into Zustand stores on portal mount
// Covers: contacts, deals, properties, signals, activities, market_data
// =============================================================================

import { useEffect, useRef } from 'react'
import { useCRMStore } from '../stores/crmStore'
import { useDealStore } from '../stores/dealStore'
import { useUIStore } from '../stores/uiStore'
import type { CRMContact } from '../components/types'
import type { Deal } from '../components/types'
import { CHECKLISTS } from '../components/constants'

export function useLiveData(): void {
  const { setCrmContacts } = useCRMStore()
  const { setDeals } = useDealStore()
  const { setProperties, setSignals, setActivities, setMarketSnapshots } = useUIStore()
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true

    async function bootstrap() {
      // Helper: log fulfilled-but-not-ok HTTP responses without alarming the user
      function warnEndpoint(label: string, res: PromiseSettledResult<Response>) {
        if (res.status === 'rejected') {
          console.warn(`[LiveData] ${label} network error (using demo data):`, res.reason)
        } else if (!res.value.ok) {
          console.warn(`[LiveData] ${label} HTTP ${res.value.status} (using demo data)`)
        }
      }

      try {
        // Load all data in parallel
        const [crmRes, dealsRes, propsRes, signalsRes, activitiesRes, marketRes] = await Promise.allSettled([
          fetch('/api/crm?limit=100'),
          fetch('/api/deals?limit=100'),
          fetch('/api/properties?limit=50'),
          fetch('/api/signals?limit=20&status=all'),
          fetch('/api/activities?limit=50'),
          fetch('/api/market-data'),
        ])

        // --- Contacts ---
        if (crmRes.status === 'fulfilled' && crmRes.value.ok) {
          const json = await crmRes.value.json() as { data: CRMContact[] }
          const data = json.data
          if (data && data.length > 0) {
            setCrmContacts(data)
            console.log(`[LiveData] ✓ ${data.length} contacts loaded`)
          }
        } else {
          warnEndpoint('/api/crm', crmRes)
        }

        // --- Deals ---
        if (dealsRes.status === 'fulfilled' && dealsRes.value.ok) {
          const json = await dealsRes.value.json() as { data: Deal[] }
          const data = json.data
          if (data && data.length > 0) {
            const dealsWithChecklist = data.map((d: Deal) => ({
              ...d,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              checklist: (CHECKLISTS as any)[d.fase] || (CHECKLISTS as any)['Contacto'] || {},
            }))
            setDeals(dealsWithChecklist)
            console.log(`[LiveData] ✓ ${data.length} deals loaded`)
          }
        } else {
          warnEndpoint('/api/deals', dealsRes)
        }

        // --- Properties ---
        if (propsRes.status === 'fulfilled' && propsRes.value.ok) {
          const json = await propsRes.value.json() as { data?: unknown[]; properties?: unknown[] }
          const data = json.data || json.properties
          if (data && data.length > 0) {
            setProperties(data)
            console.log(`[LiveData] ✓ ${data.length} properties loaded`)
          }
        } else {
          warnEndpoint('/api/properties', propsRes)
        }

        // --- Signals ---
        if (signalsRes.status === 'fulfilled' && signalsRes.value.ok) {
          const json = await signalsRes.value.json() as { data?: unknown[]; signals?: unknown[] }
          const data = json.data || json.signals
          if (data && data.length > 0) {
            setSignals(data)
            console.log(`[LiveData] ✓ ${data.length} signals loaded`)
          }
        } else {
          warnEndpoint('/api/signals', signalsRes)
        }

        // --- Activities ---
        if (activitiesRes.status === 'fulfilled' && activitiesRes.value.ok) {
          const json = await activitiesRes.value.json() as { data?: unknown[]; activities?: unknown[] }
          const data = json.data || json.activities
          if (data && data.length > 0) {
            setActivities(data)
            console.log(`[LiveData] ✓ ${data.length} activities loaded`)
          }
        } else {
          warnEndpoint('/api/activities', activitiesRes)
        }

        // --- Market data ---
        // /api/market-data returns { zones, national, luxury, updated_at }
        if (marketRes.status === 'fulfilled' && marketRes.value.ok) {
          const json = await marketRes.value.json() as {
            zones?: unknown[]
            data?: unknown[]
            snapshots?: unknown[]
          }
          const data = json.data || json.snapshots || json.zones
          if (data && (data as unknown[]).length > 0) {
            setMarketSnapshots(data as unknown[])
            console.log(`[LiveData] ✓ ${(data as unknown[]).length} market zones loaded`)
          }
        } else {
          warnEndpoint('/api/market-data', marketRes)
        }

      } catch (err) {
        console.warn('[LiveData] Bootstrap error, using demo data', err)
      }
    }

    bootstrap()
  }, [setCrmContacts, setDeals, setProperties, setSignals, setActivities, setMarketSnapshots])
}
