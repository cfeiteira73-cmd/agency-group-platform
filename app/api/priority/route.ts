// =============================================================================
// Agency Group — Pipeline Priority Engine
// GET /api/priority — returns top priority actions from live Supabase data
// Computes dynamically from: contacts, matches, deal_packs, deals + priority_items
// Auth: requirePortalAuth (NextAuth / magic-link / service token)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

// ── SLA definitions (hours before a stage is considered "stuck") ─────────────
const STAGE_SLA_HOURS: Record<string, number> = {
  qualification: 72,
  visit_scheduled: 48,
  visit_done: 48,
  proposal: 96,
  negotiation: 72,
  cpcv: 168,
}

interface PriorityItem {
  id:                string
  entity_type:       string
  entity_id:         string
  priority_score:    number
  reason:            string
  next_best_action:  string
  deadline:          string | null
  owner_id:          string | null
  revenue_impact:    number | null
  status:            string
  source:            string
  created_at:        string
}

// ── Helper: days since a date ─────────────────────────────────────────────────
function hoursSince(dateStr: string | null): number {
  if (!dateStr) return 9999
  return (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60)
}

function addHours(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString()
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const limit  = Math.min(50, parseInt(sp.get('limit') ?? '20', 10))
  const status = sp.get('status') ?? 'open'   // open | all | resolved
  const engine = sp.get('engine') !== 'false'  // compute dynamic items (default true)

  // ── 1. Fetch persisted priority_items from DB ────────────────────────────────
  const persistedItems: PriorityItem[] = []
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabaseAdmin as any)
      .from('priority_items')
      .select('*')
      .order('priority_score', { ascending: false })
      .order('deadline', { ascending: true, nullsFirst: false })
      .limit(limit)

    if (status !== 'all') q = q.eq('status', status)

    const { data, error } = await q
    if (!error && data) persistedItems.push(...data)
  } catch { /* table may not exist yet */ }

  // ── 2. Engine: compute dynamic priorities from live data ─────────────────────
  const dynamicItems: PriorityItem[] = []

  if (engine) {
    const now = Date.now()

    try {
      // A) HIGH LEAD SCORE — no recent contact (>72h)
      const { data: hotLeads } = await (supabaseAdmin as any)
        .from('contacts')
        .select('id, name, email, lead_score, updated_at, role')
        .gte('lead_score', 70)
        .order('lead_score', { ascending: false })
        .limit(10)

      if (hotLeads) {
        for (const lead of hotLeads) {
          const hrs = hoursSince(lead.updated_at)
          if (hrs > 72) {
            dynamicItems.push({
              id:               `dyn-lead-${lead.id}`,
              entity_type:      'contact',
              entity_id:        lead.id,
              priority_score:   Math.min(100, Math.round(lead.lead_score * 0.9 + (hrs > 168 ? 10 : 0))),
              reason:           `Lead score ${lead.lead_score}/100 — no contact in ${Math.round(hrs)}h`,
              next_best_action: 'Call or WhatsApp within 4h',
              deadline:         addHours(4),
              owner_id:         null,
              revenue_impact:   null,
              status:           'open',
              source:           'engine',
              created_at:       new Date(now).toISOString(),
            })
          }
        }
      }

      // B) MATCH SCORE ≥80 — no deal pack sent
      const { data: topMatches } = await (supabaseAdmin as any)
        .from('matches')
        .select('id, lead_id, property_id, property_title, match_score, created_at, status')
        .gte('match_score', 80)
        .eq('status', 'pending')
        .order('match_score', { ascending: false })
        .limit(10)

      if (topMatches) {
        for (const m of topMatches) {
          dynamicItems.push({
            id:               `dyn-match-${m.id}`,
            entity_type:      'match',
            entity_id:        m.id,
            priority_score:   Math.min(100, m.match_score),
            reason:           `Match score ${m.match_score}/100 for "${m.property_title ?? m.property_id}" — no deal pack sent`,
            next_best_action: 'Generate and send Deal Pack',
            deadline:         addHours(24),
            owner_id:         null,
            revenue_impact:   null,
            status:           'open',
            source:           'engine',
            created_at:       new Date(now).toISOString(),
          })
        }
      }

      // C) DEAL PACK SENT — no response after 48h
      const cutoff48h = new Date(now - 48 * 60 * 60 * 1000).toISOString()
      const { data: stalePacks } = await (supabaseAdmin as any)
        .from('deal_packs')
        .select('id, lead_id, property_id, status, sent_at, view_count')
        .eq('status', 'sent')
        .lt('sent_at', cutoff48h)
        .eq('view_count', 0)
        .limit(10)

      if (stalePacks) {
        for (const dp of stalePacks) {
          const hrs = hoursSince(dp.sent_at)
          dynamicItems.push({
            id:               `dyn-dp-${dp.id}`,
            entity_type:      'deal_pack',
            entity_id:        dp.id,
            priority_score:   85,
            reason:           `Deal Pack sent ${Math.round(hrs)}h ago — no views, no response`,
            next_best_action: 'Follow up by phone. Resend with personal message.',
            deadline:         addHours(4),
            owner_id:         null,
            revenue_impact:   null,
            status:           'open',
            source:           'engine',
            created_at:       new Date(now).toISOString(),
          })
        }
      }

      // D) DEALS STUCK IN STAGE > SLA
      const { data: activeDeals } = await (supabaseAdmin as any)
        .from('deals')
        .select('id, title, stage, updated_at, deal_value, commission_rate, expected_fee, assigned_consultant, zone')
        .not('stage', 'in', '("escritura","post_sale","lost","cancelled")')
        .order('updated_at', { ascending: true })
        .limit(20)

      if (activeDeals) {
        for (const deal of activeDeals) {
          const slaHours = STAGE_SLA_HOURS[deal.stage] ?? 120
          const hrs = hoursSince(deal.updated_at)
          if (hrs > slaHours) {
            const expectedFee = deal.expected_fee
              ?? (deal.deal_value && deal.commission_rate
                ? deal.deal_value * deal.commission_rate
                : null)
            dynamicItems.push({
              id:               `dyn-deal-${deal.id}`,
              entity_type:      'deal',
              entity_id:        deal.id,
              priority_score:   Math.min(100, 70 + Math.round((hrs - slaHours) / 24)),
              reason:           `Deal "${deal.title}" stuck in stage "${deal.stage}" for ${Math.round(hrs)}h (SLA: ${slaHours}h)`,
              next_best_action: `Advance stage or log blocking reason`,
              deadline:         addHours(8),
              owner_id:         deal.assigned_consultant ?? null,
              revenue_impact:   expectedFee ?? null,
              status:           'open',
              source:           'engine',
              created_at:       new Date(now).toISOString(),
            })
          }
        }
      }

      // E) HOT SELLER LEADS — no consultation booked
      const { data: sellers } = await (supabaseAdmin as any)
        .from('contacts')
        .select('id, name, email, seller_stage, seller_asking_price, seller_urgency, created_at')
        .eq('is_seller', true)
        .in('seller_stage', ['prospecting', 'appraisal'])
        .order('created_at', { ascending: false })
        .limit(10)

      if (sellers) {
        for (const s of sellers) {
          const hrs = hoursSince(s.created_at)
          if (hrs < 168) { // Within last 7 days = hot
            dynamicItems.push({
              id:               `dyn-seller-${s.id}`,
              entity_type:      'seller',
              entity_id:        s.id,
              priority_score:   s.seller_urgency === 'urgent' ? 95 : 75,
              reason:           `New seller lead "${s.name}" in ${s.seller_stage} — no consultation booked`,
              next_best_action: s.seller_urgency === 'urgent'
                ? 'URGENT: Book AVM consultation TODAY'
                : 'Schedule property appraisal within 48h',
              deadline:         s.seller_urgency === 'urgent' ? addHours(4) : addHours(48),
              owner_id:         null,
              revenue_impact:   s.seller_asking_price
                ? Math.round(s.seller_asking_price * 0.05)
                : null,
              status:           'open',
              source:           'engine',
              created_at:       new Date(now).toISOString(),
            })
          }
        }
      }
    } catch (e) {
      console.warn('[priority] engine error:', e instanceof Error ? e.message : e)
    }
  }

  // ── 3. Merge persisted + dynamic, deduplicate by entity_id, sort by score ────
  const allItems = [...persistedItems, ...dynamicItems]

  // Deduplicate: persisted takes priority over dynamic for same entity
  const seen = new Set<string>()
  const merged: PriorityItem[] = []
  for (const item of allItems.sort((a, b) => b.priority_score - a.priority_score)) {
    const key = `${item.entity_type}:${item.entity_id}`
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(item)
    }
  }

  const top = merged.slice(0, limit)

  return NextResponse.json({
    items:     top,
    total:     merged.length,
    engine:    engine ? 'active' : 'disabled',
    generated: new Date().toISOString(),
    counts: {
      persisted: persistedItems.length,
      dynamic:   dynamicItems.length,
      returned:  top.length,
    },
  })
}

// ── POST — persist a manual priority item ────────────────────────────────────
export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { entity_type, entity_id, priority_score, reason, next_best_action, deadline, owner_id, revenue_impact } = body

  if (!entity_type || !entity_id || !reason) {
    return NextResponse.json({ error: 'entity_type, entity_id, reason required' }, { status: 400 })
  }

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('priority_items')
      .insert({
        entity_type,
        entity_id: String(entity_id),
        priority_score: priority_score ?? 50,
        reason,
        next_best_action: next_best_action ?? null,
        deadline: deadline ?? null,
        owner_id: owner_id ?? auth.email,
        revenue_impact: revenue_impact ?? null,
        source: 'manual',
      })
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'insert error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── PATCH — resolve / update priority item ───────────────────────────────────
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { id, status, resolved_at } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const updates: Record<string, unknown> = {}
  if (status)      updates.status      = status
  if (resolved_at) updates.resolved_at = resolved_at
  if (status === 'resolved' && !resolved_at) updates.resolved_at = new Date().toISOString()

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('priority_items')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return NextResponse.json(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'update error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
