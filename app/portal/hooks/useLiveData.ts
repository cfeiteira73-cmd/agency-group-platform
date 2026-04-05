'use client'
// =============================================================================
// AGENCY GROUP — Global Live Data Hook v1.0
// Loads real Supabase data into Zustand stores on portal mount
// =============================================================================

import { useEffect, useRef } from 'react'
import { useCRMStore } from '../stores/crmStore'
import { useDealStore } from '../stores/dealStore'
import type { CRMContact } from '../components/types'
import type { Deal } from '../components/types'
import { CHECKLISTS } from '../components/constants'

interface LiveDataResult {
  contacts: number
  deals: number
  source: 'live' | 'demo'
}

export function useLiveData(): void {
  const { setCrmContacts } = useCRMStore()
  const { setDeals } = useDealStore()
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true

    async function bootstrap() {
      try {
        // Load contacts and deals in parallel
        const [crmRes, dealsRes] = await Promise.allSettled([
          fetch('/api/crm?limit=100'),
          fetch('/api/deals?limit=100'),
        ])

        // Process contacts
        if (crmRes.status === 'fulfilled' && crmRes.value.ok) {
          const { data } = await crmRes.value.json() as { data: CRMContact[] }
          if (data && data.length > 0) {
            setCrmContacts(data)
            console.log(`[LiveData] ✓ ${data.length} contacts loaded from Supabase`)
          }
        }

        // Process deals
        if (dealsRes.status === 'fulfilled' && dealsRes.value.ok) {
          const { data } = await dealsRes.value.json() as { data: Deal[] }
          if (data && data.length > 0) {
            // Attach checklist structure to each deal
            const dealsWithChecklist = data.map((d: Deal) => ({
              ...d,
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              checklist: (CHECKLISTS as any)[d.fase] || (CHECKLISTS as any)['Contacto'] || {},
            }))
            setDeals(dealsWithChecklist)
            console.log(`[LiveData] ✓ ${data.length} deals loaded from Supabase`)
          }
        }
      } catch (err) {
        console.log('[LiveData] Supabase unavailable, using demo data', err)
      }
    }

    bootstrap()
  }, [setCrmContacts, setDeals])
}
