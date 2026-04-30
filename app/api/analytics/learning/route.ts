// =============================================================================
// Agency Group — Closed-Loop Learning Analytics
// GET /api/analytics/learning
//
// Reads learning_events to compute:
//   1. Match score → conversion rate calibration (score bands 0-9, 10-19, ..., 90-100)
//   2. Deal pack funnel effectiveness (generated → sent → viewed → closed)
//   3. Channel performance (agent_email × event_type)
//   4. Revenue attribution per match_score band
//   5. Scoring model drift (current avg score vs historical avg)
//
// This is the FEEDBACK LOOP that closes MATCH → LEARN → IMPROVE.
// Output is consumed by:
//   - /api/automation/revenue-loop (autonomous optimization)
//   - Control Tower dashboard
//   - Future: scoring weight adjustment
//
// Auth: requirePortalAuth
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

// Score bands for calibration (10-point buckets)
const SCORE_BANDS = [
  { label: '0–9',   min: 0,  max: 9  },
  { label: '10–19', min: 10, max: 19 },
  { label: '20–29', min: 20, max: 29 },
  { label: '30–39', min: 30, max: 39 },
  { label: '40–49', min: 40, max: 49 },
  { label: '50–59', min: 50, max: 59 },
  { label: '60–69', min: 60, max: 69 },
  { label: '70–79', min: 70, max: 79 },
  { label: '80–89', min: 80, max: 89 },
  { label: '90–100', min: 90, max: 100 },
]

// Priority thresholds (business rules — do not change without safeguard layer)
const THRESHOLD_HIGH   = 80
const THRESHOLD_MEDIUM = 60

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScoreBandCalibration {
  band:             string
  min_score:        number
  max_score:        number
  matches_created:  number
  deal_packs_sent:  number
  responses:        number
  closed:           number
  conversion_rate:  number   // % matches that closed
  pack_rate:        number   // % matches that got a deal pack
  response_rate:    number   // % packs that got a response
  avg_score:        number
  expected_conversion: number  // what the system predicted (based on threshold rules)
  model_accuracy:   number | null  // actual vs expected (1.0 = perfect); null when no data
}

interface FunnelStep {
  step:   string
  count:  number
  rate:   number  // % from previous step
}

interface ChannelPerformance {
  agent_email:       string
  matches_created:   number
  packs_sent:        number
  responses:         number
  closed:            number
  conversion_rate:   number
  avg_match_score:   number
}

interface LearningInsight {
  type:     'calibration' | 'anomaly' | 'recommendation' | 'threshold'
  severity: 'info' | 'warning' | 'critical'
  message:  string
  data?:    Record<string, unknown>
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

  const sp   = req.nextUrl.searchParams
  const days = Math.min(365, parseInt(sp.get('days') ?? '90', 10))
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  try {
    // ── 1. Fetch all learning events in window ─────────────────────────────────
    const { data: events, error: evErr } = await (supabaseAdmin as any)
      .from('learning_events')
      .select('event_type, lead_id, deal_id, match_id, deal_pack_id, agent_email, match_score, metadata, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: true })

    if (evErr) {
      console.error('[analytics/learning] events query failed:', evErr.message)
      return NextResponse.json({ error: evErr.message }, { status: 500 })
    }

    const allEvents: Record<string, unknown>[] = events ?? []

    // ── 2. Group events by type ────────────────────────────────────────────────
    const byType: Record<string, Record<string, unknown>[]> = {}
    for (const ev of allEvents) {
      const t = String(ev.event_type ?? 'unknown')
      if (!byType[t]) byType[t] = []
      byType[t].push(ev)
    }

    const matchCreated    = byType['match_created']      ?? []
    const packGenerated   = byType['deal_pack_generated'] ?? []
    const packSent        = byType['deal_pack_sent']      ?? []
    const responses       = byType['response_received']   ?? []
    const callsBooked     = byType['call_booked']         ?? []
    const proposalsSent   = byType['proposal_sent']       ?? []
    const cpcvSigned      = byType['cpcv_signed']         ?? []
    const closed          = byType['closed']              ?? []
    const rejected        = byType['rejected']            ?? []

    // ── 3. Funnel ─────────────────────────────────────────────────────────────
    const funnelSteps: FunnelStep[] = [
      { step: 'match_created',    count: matchCreated.length,  rate: 100 },
      { step: 'pack_generated',   count: packGenerated.length, rate: 0 },
      { step: 'pack_sent',        count: packSent.length,      rate: 0 },
      { step: 'response_received',count: responses.length,     rate: 0 },
      { step: 'call_booked',      count: callsBooked.length,   rate: 0 },
      { step: 'proposal_sent',    count: proposalsSent.length, rate: 0 },
      { step: 'cpcv_signed',      count: cpcvSigned.length,    rate: 0 },
      { step: 'closed',           count: closed.length,        rate: 0 },
    ]
    // Compute conversion rate from previous step
    for (let i = 1; i < funnelSteps.length; i++) {
      const prev = funnelSteps[i - 1].count
      funnelSteps[i].rate = prev > 0
        ? Math.round((funnelSteps[i].count / prev) * 1000) / 10
        : 0
    }

    // ── 4. Score band calibration ─────────────────────────────────────────────
    // For each match_created event, find downstream events with same lead_id
    // to compute actual conversion rates per score band

    // Build lookup: lead_id → downstream event types
    const leadEvents: Record<string, Set<string>> = {}
    for (const ev of allEvents) {
      const lid = String(
        ev.lead_id
        ?? (ev.metadata as Record<string, unknown> | null)?._lead_id
        ?? ''
      )
      if (!lid) continue
      if (!leadEvents[lid]) leadEvents[lid] = new Set()
      leadEvents[lid].add(String(ev.event_type))
    }

    const bandCalibration: ScoreBandCalibration[] = SCORE_BANDS.map(band => {
      const bandMatches = matchCreated.filter(ev => {
        const s = Number(ev.match_score ?? 0)
        return s >= band.min && s <= band.max
      })

      let packsCount = 0, responsesCount = 0, closedCount = 0
      let totalScore = 0

      for (const ev of bandMatches) {
        totalScore += Number(ev.match_score ?? 0)
        const lid = String(
          ev.lead_id
          ?? (ev.metadata as Record<string, unknown> | null)?._lead_id
          ?? ''
        )
        if (!lid) continue
        const downstream = leadEvents[lid] ?? new Set()
        if (downstream.has('deal_pack_sent'))      packsCount++
        if (downstream.has('response_received'))   responsesCount++
        if (downstream.has('closed'))              closedCount++
      }

      const n = bandMatches.length
      const convRate = n > 0 ? Math.round((closedCount / n) * 1000) / 10 : 0
      const packRate = n > 0 ? Math.round((packsCount / n) * 1000) / 10  : 0
      const respRate = packsCount > 0
        ? Math.round((responsesCount / packsCount) * 1000) / 10 : 0
      const avgScore = n > 0 ? Math.round(totalScore / n) : 0

      // What the model predicted for this band
      const expectedConv = band.min >= THRESHOLD_HIGH   ? 0.40 :
                           band.min >= THRESHOLD_MEDIUM  ? 0.15 : 0.03

      const modelAccuracy = expectedConv > 0
        ? Math.round((convRate / 100 / expectedConv) * 100) / 100
        : null

      return {
        band:                band.label,
        min_score:           band.min,
        max_score:           band.max,
        matches_created:     n,
        deal_packs_sent:     packsCount,
        responses:           responsesCount,
        closed:              closedCount,
        conversion_rate:     convRate,
        pack_rate:           packRate,
        response_rate:       respRate,
        avg_score:           avgScore,
        expected_conversion: Math.round(expectedConv * 100),  // %
        model_accuracy:      modelAccuracy,
      }
    }).filter(b => b.matches_created > 0)  // only bands with data

    // ── 5. Channel performance ─────────────────────────────────────────────────
    const agentMap: Record<string, {
      matches: number; packs: number; responses: number
      closed: number; totalScore: number
    }> = {}

    for (const ev of allEvents) {
      const agent = String(ev.agent_email ?? 'unknown')
      if (!agentMap[agent]) agentMap[agent] = { matches: 0, packs: 0, responses: 0, closed: 0, totalScore: 0 }
      const t = String(ev.event_type)
      if (t === 'match_created')      { agentMap[agent].matches++;  agentMap[agent].totalScore += Number(ev.match_score ?? 0) }
      if (t === 'deal_pack_sent')     agentMap[agent].packs++
      if (t === 'response_received')  agentMap[agent].responses++
      if (t === 'closed')             agentMap[agent].closed++
    }

    const channelPerformance: ChannelPerformance[] = Object.entries(agentMap)
      .map(([agent, stats]) => ({
        agent_email:     agent,
        matches_created: stats.matches,
        packs_sent:      stats.packs,
        responses:       stats.responses,
        closed:          stats.closed,
        conversion_rate: stats.matches > 0
          ? Math.round((stats.closed / stats.matches) * 1000) / 10 : 0,
        avg_match_score: stats.matches > 0
          ? Math.round(stats.totalScore / stats.matches) : 0,
      }))
      .sort((a, b) => b.closed - a.closed)

    // ── 6. Generate insights (anomaly detection + recommendations) ────────────
    const insights: LearningInsight[] = []

    // Insight: high-score matches not converting to packs
    const highBands = bandCalibration.filter(b => b.min_score >= THRESHOLD_HIGH)
    const highPackRate = highBands.reduce((s, b) => s + b.pack_rate * b.matches_created, 0)
      / Math.max(1, highBands.reduce((s, b) => s + b.matches_created, 0))
    if (highPackRate < 70 && highBands.some(b => b.matches_created > 0)) {
      insights.push({
        type: 'anomaly', severity: 'critical',
        message: `HIGH matches (≥${THRESHOLD_HIGH}) only converting to deal packs at ${Math.round(highPackRate)}% — expected >70%. Auto-trigger may not be firing or deals lack property_id.`,
        data: { actual_pack_rate: Math.round(highPackRate), expected: 70, threshold: THRESHOLD_HIGH },
      })
    }

    // Insight: model accuracy per band
    for (const b of bandCalibration) {
      if (b.model_accuracy !== null && b.model_accuracy < 0.3 && b.matches_created >= 5) {
        insights.push({
          type: 'calibration', severity: 'warning',
          message: `Score band ${b.band}: model predicted ${b.expected_conversion}% conversion, actual is ${b.conversion_rate}% (accuracy ${b.model_accuracy}×). Consider adjusting thresholds.`,
          data: { band: b.band, expected: b.expected_conversion, actual: b.conversion_rate, accuracy: b.model_accuracy },
        })
      }
    }

    // Insight: funnel bottleneck
    for (let i = 1; i < funnelSteps.length; i++) {
      if (funnelSteps[i].rate < 10 && funnelSteps[i - 1].count > 10) {
        insights.push({
          type: 'recommendation', severity: 'warning',
          message: `Funnel drop at ${funnelSteps[i].step}: only ${funnelSteps[i].rate}% from ${funnelSteps[i-1].step}. Action needed.`,
          data: { step: funnelSteps[i].step, rate: funnelSteps[i].rate, prev_step: funnelSteps[i-1].step },
        })
        break  // report only the biggest bottleneck
      }
    }

    // Insight: event coverage
    const eventCoverage = {
      total_events: allEvents.length,
      unique_types:  Object.keys(byType).length,
      covered_types: Object.keys(byType),
      missing_types: ['match_created','deal_pack_generated','deal_pack_sent',
        'response_received','call_booked','proposal_sent','cpcv_signed','closed','rejected']
        .filter(t => !byType[t] || byType[t].length === 0),
    }

    if (eventCoverage.missing_types.length > 0) {
      insights.push({
        type: 'recommendation', severity: 'info',
        message: `${eventCoverage.missing_types.length} event types have 0 records in the last ${days} days: ${eventCoverage.missing_types.join(', ')}. Add tracking to close the learning loop.`,
        data: { missing: eventCoverage.missing_types },
      })
    }

    // ── 7. Overall model health score ─────────────────────────────────────────
    const totalMatches = matchCreated.length
    const totalClosed  = closed.length
    const overallConvRate = totalMatches > 0
      ? Math.round((totalClosed / totalMatches) * 1000) / 10 : 0

    const criticalInsights  = insights.filter(i => i.severity === 'critical').length
    const warningInsights   = insights.filter(i => i.severity === 'warning').length
    const modelHealthScore  = Math.max(0, 100
      - (criticalInsights * 25)
      - (warningInsights  * 10)
      - (eventCoverage.missing_types.length * 5)
    )

    return NextResponse.json({
      // ── Meta ──
      period_days:       days,
      since,
      generated:         new Date().toISOString(),
      // ── Event summary ──
      event_coverage:    eventCoverage,
      total_events:      allEvents.length,
      events_by_type:    Object.fromEntries(
        Object.entries(byType).map(([k, v]) => [k, v.length])
      ),
      // ── Revenue funnel ──
      funnel:            funnelSteps,
      overall_conversion_rate: overallConvRate,
      // ── Score calibration ──
      score_calibration: bandCalibration,
      threshold_config: {
        high:   THRESHOLD_HIGH,
        medium: THRESHOLD_MEDIUM,
        low:    0,
      },
      // ── Channel performance ──
      channel_performance: channelPerformance,
      // ── Insights ──
      insights,
      model_health_score: modelHealthScore,
      // ── Summary ──
      summary: {
        matches_created: totalMatches,
        packs_sent:      packSent.length,
        responses:       responses.length,
        closed:          totalClosed,
        conversion_rate: overallConvRate,
        critical_issues: criticalInsights,
        warnings:        warningInsights,
      },
    })

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e ?? 'unknown')
    console.error('[analytics/learning]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
