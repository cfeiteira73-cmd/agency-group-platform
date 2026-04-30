// =============================================================================
// Agency Group — Autonomous Revenue Loop
// POST /api/automation/revenue-loop
//
// This is the SELF-HEALING AUTONOMY ENGINE — the system's brain cycle.
// Designed to run every 4–6 hours via cron (CRON_SECRET auth).
//
// What it does each cycle:
//   1. OBSERVE  — scan pipeline state (leads, matches, deals, deal packs)
//   2. DETECT   — find gaps, stuck stages, missing actions, revenue leaks
//   3. DECIDE   — compute optimal next actions per lead/deal
//   4. ACT      — create priority_items for anything unresolved (≤24h SLA)
//   5. LEARN    — log decisions as learning_events for feedback loop
//   6. REPORT   — return structured cycle report
//
// SAFETY RULES (absolute):
//   - NEVER modifies deals, contacts, or properties
//   - ONLY creates priority_items (additive, reversible)
//   - ONLY fires learning events (non-blocking)
//   - All thresholds are BUSINESS RULES — hardcoded, validated, never changed autonomously
//   - If any step fails: logs error + continues to next step (never crashes caller)
//
// Auth: CRON_SECRET (Bearer) or PORTAL_API_SECRET (admin portal)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { safeCompare } from '@/lib/safeCompare'
import track from '@/lib/trackLearningEvent'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 60

// ── Business rules (NEVER auto-modified) ─────────────────────────────────────
const RULES = {
  HIGH_SCORE_THRESHOLD:     80,   // score ≥ this → send deal pack TODAY
  MEDIUM_SCORE_THRESHOLD:   60,   // score ≥ this → visit this week
  STALE_MATCH_HOURS:        48,   // match_created > 48h with no pack sent = stale
  STALE_PACK_HOURS:         72,   // pack sent > 72h with no response = stale
  STUCK_DEAL_HOURS:         120,  // deal not updated > 120h = stuck
  MAX_PRIORITY_ITEMS_PER_RUN: 50, // safety limit — never flood the queue
} as const

// ── Auth ──────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const authHeader = req.headers.get('authorization') ?? ''
  const secrets = [
    process.env.CRON_SECRET,
    process.env.PORTAL_API_SECRET,
    process.env.INTERNAL_API_TOKEN,
  ].filter(Boolean) as string[]
  return secrets.some(s => safeCompare(authHeader, `Bearer ${s}`))
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CycleAction {
  type:         'priority_created' | 'already_open' | 'skipped' | 'error'
  entity_type:  string
  entity_id:    string
  reason:       string
  score:        number
  action:       string
}

interface CycleReport {
  correlation_id:    string
  cycle_at:          string
  duration_ms:       number
  actions_evaluated: number
  priority_items_created: number
  already_open:      number
  skipped:           number
  errors:            number
  actions:           CycleAction[]
  revenue_at_risk:   number
  insights:          string[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function addHours(h: number): string {
  return new Date(Date.now() + h * 3600_000).toISOString()
}

function hoursSince(dateStr: string | null): number {
  if (!dateStr) return 9999
  return (Date.now() - new Date(dateStr).getTime()) / 3600_000
}

function parseRev(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') return parseFloat(v.replace(/[^0-9.]/g, '')) || 0
  return 0
}

function normFase(s: unknown): string {
  return String(s ?? '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s\-_]+/g, '')
}

function isClosedFase(fase: unknown): boolean {
  const n = normFase(fase)
  return n.includes('escritura') || n.includes('fechado')
    || n.includes('posvenda') || n.includes('postsale')
}

// ── Check if a priority item already exists (dedup) ───────────────────────────

async function hasOpenItem(entityType: string, entityId: string): Promise<boolean> {
  const { count } = await (supabaseAdmin as any)
    .from('priority_items')
    .select('id', { count: 'exact', head: true })
    .eq('entity_type', entityType)
    .eq('entity_id', String(entityId))
    .eq('status', 'open')
  return (count ?? 0) > 0
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cycleStart     = Date.now()
  const correlationId  = randomUUID()
  const report: CycleReport = {
    correlation_id:         correlationId,
    cycle_at:               new Date().toISOString(),
    duration_ms:            0,
    actions_evaluated:      0,
    priority_items_created: 0,
    already_open:           0,
    skipped:                0,
    errors:                 0,
    actions:                [],
    revenue_at_risk:        0,
    insights:               [],
  }

  const newItems: Record<string, unknown>[] = []

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 1: OBSERVE — Stale HIGH matches (score ≥80, no pack sent in 48h)
  // ───────────────────────────────────────────────────────────────────────────
  try {
    const cutoff = new Date(Date.now() - RULES.STALE_MATCH_HOURS * 3600_000).toISOString()
    const { data: staleMatches } = await (supabaseAdmin as any)
      .from('matches')
      .select('id, lead_id, property_title, match_score, created_at, next_best_action')
      .gte('match_score', RULES.HIGH_SCORE_THRESHOLD)
      .eq('status', 'pending')
      .lt('created_at', cutoff)
      .limit(20)

    for (const m of (staleMatches ?? [])) {
      report.actions_evaluated++
      const alreadyOpen = await hasOpenItem('match', String(m.id))
      if (alreadyOpen) { report.already_open++; continue }

      const hrs = hoursSince(m.created_at)
      newItems.push({
        entity_type:     'match',
        entity_id:       String(m.id),
        priority_score:  Math.min(100, 90 + Math.round((hrs - RULES.STALE_MATCH_HOURS) / 12)),
        reason:          `HIGH match score ${m.match_score}/100 — ${Math.round(hrs)}h without deal pack. Revenue window closing.`,
        next_best_action: m.next_best_action ?? 'Generate and send Deal Pack immediately',
        deadline:        addHours(4),
        owner_id:        null,
        revenue_impact:  null,
        status:          'open',
        source:          'engine',
      })
      report.actions.push({
        type: 'priority_created', entity_type: 'match', entity_id: String(m.id),
        reason: `HIGH match ${m.match_score}/100 stale ${Math.round(hrs)}h`,
        score: Math.min(100, 90 + Math.round((hrs - RULES.STALE_MATCH_HOURS) / 12)),
        action: 'Send deal pack today',
      })
    }
  } catch (e) {
    report.errors++
    report.insights.push(`[STEP 1 error] ${e instanceof Error ? e.message : String(e)}`)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 2: OBSERVE — Stale deal packs (sent >72h, no view, no response)
  // ───────────────────────────────────────────────────────────────────────────
  try {
    const cutoff = new Date(Date.now() - RULES.STALE_PACK_HOURS * 3600_000).toISOString()
    const { data: stalePacks } = await (supabaseAdmin as any)
      .from('deal_packs')
      .select('id, lead_id, title, sent_at, view_count')
      .eq('status', 'sent')
      .lt('sent_at', cutoff)
      .limit(20)

    for (const dp of (stalePacks ?? [])) {
      report.actions_evaluated++
      const viewCount = Number(dp.view_count ?? 0)
      if (viewCount > 0) { report.skipped++; continue }  // was viewed — OK

      const alreadyOpen = await hasOpenItem('deal_pack', String(dp.id))
      if (alreadyOpen) { report.already_open++; continue }

      const hrs = hoursSince(dp.sent_at)
      newItems.push({
        entity_type:     'deal_pack',
        entity_id:       String(dp.id),
        priority_score:  88,
        reason:          `Deal Pack "${dp.title ?? dp.id}" sent ${Math.round(hrs)}h ago — 0 views, no response. Follow up required.`,
        next_best_action: 'Call buyer directly. Resend with personalised message.',
        deadline:        addHours(4),
        owner_id:        null,
        revenue_impact:  null,
        status:          'open',
        source:          'engine',
      })
      report.actions.push({
        type: 'priority_created', entity_type: 'deal_pack', entity_id: String(dp.id),
        reason: `Pack sent ${Math.round(hrs)}h ago, 0 views`,
        score: 88, action: 'Follow up by phone',
      })
    }
  } catch (e) {
    report.errors++
    report.insights.push(`[STEP 2 error] ${e instanceof Error ? e.message : String(e)}`)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 3: OBSERVE — Active deals stuck > SLA (using fase — portal schema)
  // ───────────────────────────────────────────────────────────────────────────
  try {
    const { data: deals } = await (supabaseAdmin as any)
      .from('deals')
      .select('id, imovel, title, fase, updated_at, valor, expected_fee, created_at')
      .not('fase', 'ilike', '%escritura%')
      .not('fase', 'ilike', '%fechado%')
      .not('fase', 'eq', 'lost')
      .not('fase', 'eq', 'cancelled')
      .order('updated_at', { ascending: true })
      .limit(30)

    for (const deal of (deals ?? [])) {
      if (isClosedFase(deal.fase)) { report.skipped++; continue }
      const hrs = hoursSince(deal.updated_at ?? deal.created_at)
      if (hrs < RULES.STUCK_DEAL_HOURS) { report.skipped++; continue }

      report.actions_evaluated++
      const alreadyOpen = await hasOpenItem('deal', String(deal.id))
      if (alreadyOpen) { report.already_open++; continue }

      const fee = parseRev(deal.expected_fee) || parseRev(deal.valor) * 0.05
      report.revenue_at_risk += fee

      const score = Math.min(100, 65 + Math.round((hrs - RULES.STUCK_DEAL_HOURS) / 24))
      newItems.push({
        entity_type:     'deal',
        entity_id:       String(deal.id),
        priority_score:  score,
        reason:          `Deal "${deal.imovel ?? deal.title ?? deal.id}" (${deal.fase ?? 'sem fase'}) sem actividade há ${Math.round(hrs)}h.`,
        next_best_action: 'Avançar fase ou registar motivo de bloqueio',
        deadline:        addHours(8),
        owner_id:        null,
        revenue_impact:  fee > 0 ? Math.round(fee) : null,
        status:          'open',
        source:          'engine',
      })
      report.actions.push({
        type: 'priority_created', entity_type: 'deal', entity_id: String(deal.id),
        reason: `Stuck ${Math.round(hrs)}h in ${deal.fase}`,
        score, action: 'Advance deal stage',
      })
    }
  } catch (e) {
    report.errors++
    report.insights.push(`[STEP 3 error] ${e instanceof Error ? e.message : String(e)}`)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 4: OBSERVE — Hot leads with no recent match (score ≥70, no match in 7d)
  // ───────────────────────────────────────────────────────────────────────────
  try {
    const { data: hotLeads } = await (supabaseAdmin as any)
      .from('contacts')
      .select('id, name, lead_score, updated_at')
      .gte('lead_score', 70)
      .order('lead_score', { ascending: false })
      .limit(20)

    if (hotLeads && hotLeads.length > 0) {
      // Get lead IDs that have a recent match
      const leadIds = hotLeads.map((l: Record<string,unknown>) => String(l.id))
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString()

      const { data: recentMatches } = await (supabaseAdmin as any)
        .from('matches')
        .select('lead_id')
        .in('lead_id', leadIds)
        .gte('created_at', sevenDaysAgo)

      const leadsWithMatches = new Set(
        (recentMatches ?? []).map((m: Record<string,unknown>) => String(m.lead_id))
      )

      for (const lead of hotLeads) {
        if (leadsWithMatches.has(String(lead.id))) { report.skipped++; continue }

        const hrs = hoursSince(lead.updated_at)
        if (hrs < 168) { report.skipped++; continue }  // only if stale >7d

        report.actions_evaluated++
        const alreadyOpen = await hasOpenItem('contact', String(lead.id))
        if (alreadyOpen) { report.already_open++; continue }

        newItems.push({
          entity_type:     'contact',
          entity_id:       String(lead.id),
          priority_score:  Math.min(100, Math.round(lead.lead_score * 0.9)),
          reason:          `Lead score ${lead.lead_score}/100 — sem match há mais de 7 dias. Enviar para motor de matching.`,
          next_best_action: 'Run /api/automation/match-buyer for this lead profile',
          deadline:        addHours(24),
          owner_id:        null,
          revenue_impact:  null,
          status:          'open',
          source:          'engine',
        })
        report.actions.push({
          type: 'priority_created', entity_type: 'contact', entity_id: String(lead.id),
          reason: `Score ${lead.lead_score}/100, no match in 7d`,
          score: Math.min(100, Math.round(lead.lead_score * 0.9)),
          action: 'Run match engine',
        })
      }
    }
  } catch (e) {
    report.errors++
    report.insights.push(`[STEP 4 error] ${e instanceof Error ? e.message : String(e)}`)
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 5: ACT — Batch insert new priority_items (safety limit enforced)
  // ───────────────────────────────────────────────────────────────────────────
  const toInsert = newItems.slice(0, RULES.MAX_PRIORITY_ITEMS_PER_RUN)

  if (toInsert.length > 0) {
    try {
      const { error: insertErr } = await (supabaseAdmin as any)
        .from('priority_items')
        .insert(toInsert)

      if (insertErr) {
        console.error('[revenue-loop] priority_items insert error:', insertErr.message)
        report.errors++
        report.insights.push(`Priority items insert failed: ${insertErr.message}`)
        report.priority_items_created = 0
      } else {
        report.priority_items_created = toInsert.length
      }
    } catch (e) {
      report.errors++
      report.insights.push(`[STEP 5 error] ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  // STEP 6: LEARN — Fire cycle event (non-blocking)
  // ───────────────────────────────────────────────────────────────────────────
  track.matchCreated({  // reuse match_created as "cycle_ran" signal via metadata
    agent_email:    'system@revenue-loop',
    correlation_id: correlationId,
    source_system:  'cron',
    metadata: {
      _event_subtype:         'revenue_loop_cycle',
      actions_evaluated:      report.actions_evaluated,
      priority_items_created: report.priority_items_created,
      revenue_at_risk:        Math.round(report.revenue_at_risk),
      errors:                 report.errors,
    },
  })

  // ── Final report ──────────────────────────────────────────────────────────
  report.duration_ms = Date.now() - cycleStart
  report.revenue_at_risk = Math.round(report.revenue_at_risk)

  if (report.errors === 0) {
    report.insights.unshift(
      `Cycle complete in ${report.duration_ms}ms — ${report.priority_items_created} new items created, €${report.revenue_at_risk.toLocaleString('pt-PT')} pipeline at risk.`
    )
  } else {
    report.insights.unshift(
      `Cycle completed with ${report.errors} error(s) — ${report.priority_items_created} items created. Check logs.`
    )
  }

  return NextResponse.json(report, { status: report.errors > 0 ? 207 : 200 })
}
