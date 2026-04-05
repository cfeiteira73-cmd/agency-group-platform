'use client'
// =============================================================================
// AGENCY GROUP — Global Live Data Hook v2.0
// Loads real Supabase data into Zustand stores on portal mount
// Covers: contacts, deals, properties, signals, activities, market_snapshots
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uiStore = useUIStore() as any
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true

    async function bootstrap() {
      try {
        // Load all data in parallel
        const [crmRes, dealsRes, propsRes, signalsRes, activitiesRes, marketRes] = await Promise.allSettled([
          fetch('/api/crm?limit=100'),
          fetch('/api/deals?limit=100'),
          fetch('/api/properties?limit=50'),
          fetch('/api/radar/search?limit=20&status=new'),
          fetch('/api/visitas/db?limit=50'),
          fetch('/api/market-data?limit=20'),
        ])

        // Process contacts
        if (crmRes.status === 'fulfilled' && crmRes.value.ok) {
          const json = await crmRes.value.json() as { data: CRMContact[] }
          const data = json.data
          if (data && data.length > 0) {
            setCrmContacts(data)
            console.log(`[LiveData] ✓ ${data.length} contacts loaded`)
          }
        }

        // Process deals
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
        }

        // Properties — store in uiStore if available
        if (propsRes.status === 'fulfilled' && propsRes.value.ok) {
          const json = await propsRes.value.json() as { data: unknown[] }
          const data = json.data
          if (data && data.length > 0 && uiStore.setProperties) {
            uiStore.setProperties(data)
            console.log(`[LiveData] ✓ ${data.length} properties loaded`)
          }
        }

        // Signals — store in uiStore if available
        if (signalsRes.status === 'fulfilled' && signalsRes.value.ok) {
          const json = await signalsRes.value.json() as { data?: unknown[]; signals?: unknown[] }
          const data = json.data || json.signals
          if (data && data.length > 0 && uiStore.setSignals) {
            uiStore.setSignals(data)
            console.log(`[LiveData] ✓ ${data.length} signals loaded`)
          }
        }

        // Activities — store in uiStore if available
        if (activitiesRes.status === 'fulfilled' && activitiesRes.value.ok) {
          const json = await activitiesRes.value.json() as { data?: unknown[]; activities?: unknown[] }
          const data = json.data || json.activities
          if (data && data.length > 0 && uiStore.setActivities) {
            uiStore.setActivities(data)
            console.log(`[LiveData] ✓ ${data.length} activities loaded`)
          }
        }

        // Market snapshots — store in uiStore if available
        if (marketRes.status === 'fulfilled' && marketRes.value.ok) {
          const json = await marketRes.value.json() as { data?: unknown[]; snapshots?: unknown[] }
          const data = json.data || json.snapshots
          if (data && data.length > 0 && uiStore.setMarketSnapshots) {
            uiStore.setMarketSnapshots(data)
            console.log(`[LiveData] ✓ ${data.length} market snapshots loaded`)
          }
        }

      } catch (err) {
        console.log('[LiveData] Bootstrap error, using demo data', err)
      }
    }

    bootstrap()
  }, [setCrmContacts, setDeals, uiStore])
}
