// =============================================================================
// Agency Group — Control Tower: Real-Time System State
// GET /api/system/state
//
// Single endpoint that returns the FULL live state of all 5 system layers:
//
//   Layer 1: DATA        — table counts, schema health, last writes
//   Layer 2: INTELLIGENCE— pipeline value, match scores, decision distribution
//   Layer 3: REVENUE     — funnel live state, deals by stage, GCI
//   Layer 4: AUTOMATION  — priority queue depth, open items by type
//   Layer 5: EVENTS      — event counts last 24h/7d, coverage %, anomalies
//
// Also computes:
//   - Overall system health score (0–100)
//   - Revenue health score (0–100)
//   - Active anomalies (deviations from 7-day baseline)
//   - Autonomy score (what % of actions are happening without human trigger)
//
// Designed to be polled by the Control Tower dashboard every 30–60s.
// Auth: requirePortalAuth
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// ── Safe count helper ─────────────────────────────────────────────────────────
async function safeCount(
  table: string,
  filters?: (q: any) => any
): Promise<{ count: number; error: string | null; latency_ms: number }> {
  const t0 = Date.now()
  try {
    let q = (supabaseAdmin as any)
      .from(table)
      .select('id', { count: 'exact', head: true })
    if (filters) q = filters(q)
    const { count, error } = await q
    return {
      count: count ?? 0,
      error: error?.message ?? null,
      latency_ms: Date.now() - t0,
    }
  } catch (e) {
    return { count: 0, error: e instanceof Error ? e.message : 'error', latency_ms: Date.now() - t0 }
  }
}

// ── Anomaly detection ─────────────────────────────────────────────────────────
function detectAnomaly(
  label: string,
  current: number,
  baseline: number,
  thresholdPct: number = 50
): string | null {
  if (baseline === 0) return null
  const pct = Math.round(((current - baseline) / baseline) * 100)
  if (Math.abs(pct) >= thresholdPct) {
    const dir = pct > 0 ? '↑' : '↓'
    return `${label}: ${current} (${dir}${Math.abs(pct)}% vs 7-day avg ${Math.round(baseline)})`
  }
  return null
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

function isClosedFase(f: unknown): boolean {
  const n = normFase(f)
  return n.includes('escritura') || n.includes('fechado') || n.includes('posvenda')
}

const STAGE_PROB: Record<string, number> = {
  contacto: 0.05, qualificacao: 0.20, visitaagendada: 0.35, visitarealizada: 0.45,
  proposta: 0.60, negociacao: 0.70, cpcv: 0.85, escritura: 1.0, fechado: 1.0,
}
function stagePct(f: unknown): number {
  const k = normFase(f)
  if (STAGE_PROB[k]) return STAGE_PROB[k]
  for (const [key, v] of Object.entries(STAGE_PROB)) {
    if (k.includes(key) || key.includes(k)) return v
  }
  return 0.10
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

  const globalStart = Date.now()
  const now = new Date()
  const h24ago  = new Date(now.getTime() - 24 * 3600_000).toISOString()
  const d7ago   = new Date(now.getTime() - 7 * 24 * 3600_000).toISOString()
  const d30ago  = new Date(now.getTime() - 30 * 24 * 3600_000).toISOString()
  const anomalies: string[] = []

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 1: DATA HEALTH
  // ═══════════════════════════════════════════════════════════════════════════
  const [contacts, properties, deals, matches, dealPacks, priorityItems, learningEvents] =
    await Promise.all([
      safeCount('contacts'),
      safeCount('properties'),
      safeCount('deals'),
      safeCount('matches'),
      safeCount('deal_packs'),
      safeCount('priority_items', q => q.eq('status', 'open')),
      safeCount('learning_events'),
    ])

  const [newLeads24h, newDeals24h, newMatches24h, newEvents24h] = await Promise.all([
    safeCount('contacts',        q => q.gte('created_at', h24ago)),
    safeCount('deals',           q => q.gte('created_at', h24ago)),
    safeCount('matches',         q => q.gte('created_at', h24ago)),
    safeCount('learning_events', q => q.gte('created_at', h24ago)),
  ])

  // 7-day baselines (per-day avg)
  const [leads7d, deals7d, matches7d, events7d] = await Promise.all([
    safeCount('contacts',        q => q.gte('created_at', d7ago)),
    safeCount('deals',           q => q.gte('created_at', d7ago)),
    safeCount('matches',         q => q.gte('created_at', d7ago)),
    safeCount('learning_events', q => q.gte('created_at', d7ago)),
  ])

  const dataErrors = [contacts, properties, deals, matches, dealPacks, priorityItems]
    .filter(r => r.error).map(r => r.error!)

  const dataLayer = {
    tables: {
      contacts:       { total: contacts.count,     new_24h: newLeads24h.count },
      properties:     { total: properties.count    },
      deals:          { total: deals.count,         new_24h: newDeals24h.count },
      matches:        { total: matches.count,       new_24h: newMatches24h.count },
      deal_packs:     { total: dealPacks.count      },
      priority_items: { open:  priorityItems.count  },
      learning_events:{ total: learningEvents.count, new_24h: newEvents24h.count },
    },
    schema_errors: dataErrors,
    health:        dataErrors.length === 0 ? 'ok' : 'degraded',
  }

  // Baseline anomalies
  const a1 = detectAnomaly('New leads',   newLeads24h.count,   leads7d.count / 7)
  const a2 = detectAnomaly('New matches', newMatches24h.count, matches7d.count / 7)
  if (a1) anomalies.push(a1)
  if (a2) anomalies.push(a2)

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 2: INTELLIGENCE — Match distribution + pipeline
  // ═══════════════════════════════════════════════════════════════════════════
  let intelligenceLayer: Record<string, unknown> = { health: 'unavailable' }

  try {
    const { data: recentMatches } = await (supabaseAdmin as any)
      .from('matches')
      .select('match_score, priority_level, status, created_at')
      .gte('created_at', d30ago)
      .limit(500)

    const mData: Record<string, unknown>[] = recentMatches ?? []
    const scoreDistribution = { high: 0, medium: 0, low: 0 }
    let totalScore = 0

    for (const m of mData) {
      const s = Number(m.match_score ?? 0)
      totalScore += s
      if (s >= 80) scoreDistribution.high++
      else if (s >= 60) scoreDistribution.medium++
      else scoreDistribution.low++
    }

    const [highMatches7d, medMatches7d] = await Promise.all([
      safeCount('matches', q => q.gte('match_score', 80).gte('created_at', d7ago)),
      safeCount('matches', q => q.gte('match_score', 60).lt('match_score', 80).gte('created_at', d7ago)),
    ])

    intelligenceLayer = {
      health:         'ok',
      matches_30d:    mData.length,
      avg_score_30d:  mData.length > 0 ? Math.round(totalScore / mData.length) : 0,
      score_distribution_30d: scoreDistribution,
      high_priority_7d:   highMatches7d.count,
      medium_priority_7d: medMatches7d.count,
      auto_trigger_eligible: highMatches7d.count,  // these should auto-generate packs
    }
  } catch (e) {
    intelligenceLayer = { health: 'error', error: e instanceof Error ? e.message : String(e) }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 3: REVENUE — Live pipeline + deals by stage
  // ═══════════════════════════════════════════════════════════════════════════
  let revenueLayer: Record<string, unknown> = { health: 'unavailable' }

  try {
    const { data: activeDeals } = await (supabaseAdmin as any)
      .from('deals')
      .select('id, fase, valor, expected_fee, realized_fee, created_at')
      .not('fase', 'ilike', '%cancelad%')

    const dealData: Record<string, unknown>[] = activeDeals ?? []
    const closedDeals  = dealData.filter(d => isClosedFase(d.fase))
    const openDeals    = dealData.filter(d => !isClosedFase(d.fase))

    const feeFor = (d: Record<string, unknown>) =>
      parseRev(d.realized_fee) || parseRev(d.expected_fee) || parseRev(d.valor) * 0.05

    const pipelineValue = openDeals.reduce((s, d) => s + parseRev(d.valor) * stagePct(d.fase), 0)
    const revenueClosed = closedDeals.reduce((s, d) => s + feeFor(d), 0)

    // Stage distribution
    const stageMap: Record<string, number> = {}
    for (const d of dealData) {
      const f = String(d.fase ?? 'Sem fase')
      stageMap[f] = (stageMap[f] ?? 0) + 1
    }

    // Deal pack funnel
    const [packsSent, packsViewed, packsReady] = await Promise.all([
      safeCount('deal_packs', q => q.eq('status', 'sent')),
      safeCount('deal_packs', q => q.eq('status', 'viewed')),
      safeCount('deal_packs', q => q.eq('status', 'ready')),
    ])

    revenueLayer = {
      health:          'ok',
      pipeline_value:  Math.round(pipelineValue),
      revenue_closed:  Math.round(revenueClosed),
      total_deals:     dealData.length,
      open_deals:      openDeals.length,
      closed_deals:    closedDeals.length,
      deals_by_stage:  stageMap,
      deal_pack_funnel: {
        ready:  packsReady.count,
        sent:   packsSent.count,
        viewed: packsViewed.count,
        view_rate: packsSent.count > 0
          ? Math.round((packsViewed.count / packsSent.count) * 1000) / 10 : 0,
      },
    }

    // Revenue anomaly: pipeline dropped >50% vs 30-day baseline (approximate)
    if (pipelineValue === 0 && dealData.length > 0) {
      anomalies.push('Pipeline value = €0 despite active deals — likely missing valor data')
    }
  } catch (e) {
    revenueLayer = { health: 'error', error: e instanceof Error ? e.message : String(e) }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 4: AUTOMATION — Priority queue + action depth
  // ═══════════════════════════════════════════════════════════════════════════
  let automationLayer: Record<string, unknown> = { health: 'unavailable' }

  try {
    const { data: openItems } = await (supabaseAdmin as any)
      .from('priority_items')
      .select('entity_type, priority_score, deadline, source, created_at')
      .eq('status', 'open')
      .order('priority_score', { ascending: false })
      .limit(200)

    const items: Record<string, unknown>[] = openItems ?? []
    const overdueCount = items.filter(i => {
      const dl = String(i.deadline ?? '')
      return dl && new Date(dl).getTime() < Date.now()
    }).length

    const bySource = { engine: 0, manual: 0, n8n: 0 }
    const byType: Record<string, number> = {}
    for (const i of items) {
      const src = String(i.source ?? 'engine') as keyof typeof bySource
      if (src in bySource) bySource[src]++
      const et = String(i.entity_type ?? 'unknown')
      byType[et] = (byType[et] ?? 0) + 1
    }

    const [resolvedToday, createdToday] = await Promise.all([
      safeCount('priority_items', q => q.eq('status', 'resolved').gte('resolved_at', h24ago)),
      safeCount('priority_items', q => q.eq('status', 'open').gte('created_at', h24ago)),
    ])

    const topItems = items.slice(0, 5).map(i => ({
      entity_type:     i.entity_type,
      score:           i.priority_score,
      deadline:        i.deadline,
      source:          i.source,
    }))

    // Autonomy score: % of open items created by engine (not manual)
    const autonomyScore = items.length > 0
      ? Math.round((bySource.engine / items.length) * 100) : 0

    automationLayer = {
      health:            overdueCount > 10 ? 'degraded' : 'ok',
      open_items:        items.length,
      overdue_items:     overdueCount,
      created_today:     createdToday.count,
      resolved_today:    resolvedToday.count,
      by_source:         bySource,
      by_entity_type:    byType,
      autonomy_score:    autonomyScore,  // % of items engine-generated
      top_5_items:       topItems,
    }

    if (overdueCount > 5) {
      anomalies.push(`${overdueCount} priority items are past their deadline — action backlog building`)
    }
  } catch (e) {
    automationLayer = { health: 'error', error: e instanceof Error ? e.message : String(e) }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LAYER 5: EVENT SYSTEM — Coverage + health
  // ═══════════════════════════════════════════════════════════════════════════
  let eventLayer: Record<string, unknown> = { health: 'unavailable' }

  try {
    const { data: recentEvents } = await (supabaseAdmin as any)
      .from('learning_events')
      .select('event_type, created_at, correlation_id, source_system')
      .gte('created_at', d7ago)
      .order('created_at', { ascending: false })
      .limit(500)

    const evData: Record<string, unknown>[] = recentEvents ?? []
    const byType7d: Record<string, number> = {}
    let correlated7d = 0

    for (const ev of evData) {
      const t = String(ev.event_type ?? 'unknown')
      byType7d[t] = (byType7d[t] ?? 0) + 1
      if (ev.correlation_id) correlated7d++
    }

    const MANDATORY_EVENTS = [
      'match_created', 'deal_pack_generated', 'deal_pack_sent',
      'response_received', 'call_booked', 'proposal_sent',
      'cpcv_signed', 'closed', 'rejected'
    ]

    const missingEvents   = MANDATORY_EVENTS.filter(t => !byType7d[t])
    const coveredEvents   = MANDATORY_EVENTS.filter(t => byType7d[t])
    const coveragePct     = Math.round((coveredEvents.length / MANDATORY_EVENTS.length) * 100)
    const correlationPct  = evData.length > 0
      ? Math.round((correlated7d / evData.length) * 100) : 0

    // 24h event rate
    const events24h = evData.filter(ev => {
      const dt = String(ev.created_at ?? '')
      return dt >= h24ago
    }).length

    eventLayer = {
      health:         missingEvents.length > 5 ? 'degraded' : 'ok',
      total_7d:       evData.length,
      events_24h:     events24h,
      by_type_7d:     byType7d,
      coverage_pct:   coveragePct,
      covered_events: coveredEvents,
      missing_events: missingEvents,
      correlation_pct: correlationPct,  // % events with correlation_id (0% until migration runs)
    }

    if (coveragePct < 50) {
      anomalies.push(`Event coverage only ${coveragePct}% — ${missingEvents.length} mandatory event types have 0 records`)
    }
  } catch (e) {
    eventLayer = { health: 'error', error: e instanceof Error ? e.message : String(e) }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPUTE SYSTEM SCORES
  // ═══════════════════════════════════════════════════════════════════════════

  const layerHealthScores = [
    dataLayer.health === 'ok' ? 100 : dataLayer.health === 'degraded' ? 60 : 0,
    (intelligenceLayer.health as string) === 'ok' ? 100 : 50,
    (revenueLayer.health as string) === 'ok' ? 100 : 50,
    (automationLayer.health as string) === 'ok' ? 100 : (automationLayer.health as string) === 'degraded' ? 60 : 0,
    (eventLayer.health as string) === 'ok' ? 100 : (eventLayer.health as string) === 'degraded' ? 60 : 0,
  ]
  const systemHealthScore = Math.round(
    layerHealthScores.reduce((a, b) => a + b, 0) / layerHealthScores.length
    - (anomalies.length * 5)
  )

  const revenueReadinessScore = Math.round(
    (deals.count > 0                                       ? 20 : 0) +
    (Number((intelligenceLayer as any).matches_30d ?? 0) > 0 ? 20 : 0) +
    (Number((revenueLayer as any).pipeline_value ?? 0) > 0   ? 20 : 0) +
    (Number((automationLayer as any).open_items ?? 0) > 0     ? 15 : 0) +
    (Number((eventLayer as any).coverage_pct ?? 0) >= 50      ? 15 : 0) +
    (Number((eventLayer as any).events_24h ?? 0) > 0          ? 10 : 0)
  )

  return NextResponse.json({
    // ── System identity ──
    system:          'Agency Group Revenue OS',
    version:         '2.0',
    generated:       new Date().toISOString(),
    response_ms:     Date.now() - globalStart,

    // ── Scores ──
    system_health_score:      Math.max(0, Math.min(100, systemHealthScore)),
    revenue_readiness_score:  Math.min(100, revenueReadinessScore),
    autonomy_score:           (automationLayer as any).autonomy_score ?? 0,

    // ── Anomalies ──
    anomalies,
    anomaly_count: anomalies.length,

    // ── 5 Layers ──
    layers: {
      data:         dataLayer,
      intelligence: intelligenceLayer,
      revenue:      revenueLayer,
      automation:   automationLayer,
      events:       eventLayer,
    },

    // ── Quick summary ──
    summary: {
      total_leads:    contacts.count,
      total_deals:    deals.count,
      pipeline_value: (revenueLayer as any).pipeline_value ?? 0,
      open_priorities: priorityItems.count,
      event_coverage: (eventLayer as any).coverage_pct ?? 0,
      new_24h: {
        leads:   newLeads24h.count,
        deals:   newDeals24h.count,
        matches: newMatches24h.count,
        events:  newEvents24h.count,
      },
    },
  })
}
