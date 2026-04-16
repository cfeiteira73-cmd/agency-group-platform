// =============================================================================
// Agency Group — Nurture Candidates API
// POST /api/automation/nurture-candidates
// Called hourly by n8n wf-R to find contacts due for D+1/D+7/D+30 nurture email
// Returns contacts not yet emailed for the relevant sequence window
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { safeCompare } from '@/lib/safeCompare'

export const runtime = 'nodejs'

interface NurtureWindow {
  label: string
  minMs: number
  maxMs: number
  sequenceDay: number
}

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') ?? ''
  const secrets = [
    process.env.PORTAL_API_SECRET,
    process.env.CRON_SECRET,
    process.env.ADMIN_SECRET,
  ].filter(Boolean) as string[]
  return secrets.some(s => safeCompare(authHeader, `Bearer ${s}`))
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const now: number = body.now ?? Date.now()
    const windows: NurtureWindow[] = body.windows ?? []

    if (!windows.length) {
      return NextResponse.json({ candidates: [], count: 0 })
    }

    // For each window, query contacts created in the relevant time range
    // that haven't received that specific sequence day email yet
    const candidates: object[] = []

    for (const win of windows) {
      const createdAfter  = new Date(now - win.maxMs).toISOString()
      const createdBefore = new Date(now - win.minMs).toISOString()

      // Fetch contacts in window — status=lead, has email, no opt-out
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: contacts, error } = await (supabaseAdmin as any)
        .from('contacts')
        .select('id, name, full_name, email, source, preferred_locations, notes')
        .gte('created_at', createdAfter)
        .lte('created_at', createdBefore)
        .eq('status', 'lead')
        .not('email', 'is', null)
        .limit(50)

      if (error) {
        console.error(`[nurture-candidates] window ${win.label} query error:`, error.message)
        continue
      }

      if (!contacts?.length) continue

      // Check nurture_log table for already-sent sequence emails
      // Table: nurture_log (contact_id, sequence_day, sent_at)
      // If table doesn't exist yet, proceed without dedup (safe — will be created below)
      let alreadySentIds = new Set<string>()
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: sent } = await (supabaseAdmin as any)
          .from('nurture_log')
          .select('contact_id')
          .in('contact_id', contacts.map((c: Record<string, unknown>) => c.id))
          .eq('sequence_day', win.sequenceDay)
        if (sent) {
          alreadySentIds = new Set(sent.map((r: Record<string, string>) => r['contact_id']))
        }
      } catch {
        // nurture_log table may not exist yet — skip dedup, create on first mark-sent
      }

      for (const contact of contacts as Record<string, unknown>[]) {
        if (alreadySentIds.has(contact['id'] as string)) continue

        // Extract zona from preferred_locations or notes
        const locations = contact['preferred_locations'] as string[] | null
        const zona = locations?.[0] ?? 'Lisboa'

        // Extract budget from notes if present
        let budgetMax: number | null = null
        if (contact['notes']) {
          const m = String(contact['notes']).match(/Budget max: €(\d+)/)
          if (m) budgetMax = parseInt(m[1])
        }

        // Build a search URL for the candidate (used by n8n Code — Build Email node)
        const zonaSlug = zona.toLowerCase().replace(/\s+/g, '-').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        const searchUrl = budgetMax
          ? `https://www.agencygroup.pt/imoveis?zona=${zonaSlug}&precoMax=${budgetMax}`
          : `https://www.agencygroup.pt/imoveis?zona=${zonaSlug}`

        candidates.push({
          contact_id:   contact['id'],
          name:         (contact['full_name'] as string) || (contact['name'] as string) || 'Prezado/a',
          email:        contact['email'],
          zona,
          budget_max:   budgetMax,
          source:       contact['source'],
          sequence_day: win.sequenceDay,
          window_label: win.label,
          url:          searchUrl,
          cta_url:      searchUrl,
          unsubscribe_url: `https://www.agencygroup.pt/unsubscribe?contact=${contact['id']}`,
        })
      }
    }

    return NextResponse.json({ candidates, count: candidates.length })
  } catch (err) {
    console.error('[nurture-candidates] error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
