// =============================================================================
// Agency Group — Buyer Scoring Engine
// FASE 12: Compute & persist buyer_score for contacts
// POST /api/buyers/score        → score a single buyer (body: { contact_id })
// GET  /api/buyers/score        → batch score all unscored/outdated buyers
//   ?limit=50&force=false
// Formula: liquidity(25) + closed_deals(25) + speed(20) + reliability(20) + activity(10)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'

const TABLE = 'contacts'

// ---------------------------------------------------------------------------
// Core scoring function (mirrors SQL in migration 007)
// ---------------------------------------------------------------------------

function computeBuyerScore(params: {
  liquidity_profile?: string | null
  deals_closed_count?: number | null
  avg_close_days?: number | null
  reliability_score?: number | null
  last_contact_at?: string | null
}): { score: number; reason: string } {
  const { liquidity_profile, deals_closed_count, avg_close_days, reliability_score, last_contact_at } = params

  // ── Liquidity (25 pts) ────────────────────────────────────────────────────
  const liqPts =
    liquidity_profile === 'immediate'      ? 25 :
    liquidity_profile === 'under_30_days'  ? 18 :
    liquidity_profile === 'financed'       ? 10 : 4

  // ── Deal history (25 pts) ─────────────────────────────────────────────────
  const closed = deals_closed_count ?? null
  const histPts =
    closed === null       ? 5  :
    closed > 5            ? 25 :
    closed >= 2           ? 18 :
    closed >= 1           ? 10 : 5

  // ── Close speed (20 pts) ─────────────────────────────────────────────────
  const acd = avg_close_days ?? null
  const speedPts =
    acd === null  ? 5  :
    acd < 14      ? 20 :
    acd < 30      ? 15 :
    acd < 60      ? 10 : 5

  // ── Reliability (20 pts) ─────────────────────────────────────────────────
  const rel = reliability_score ?? null
  const relPts = rel !== null ? Math.min(20, Math.round((rel / 5) * 20)) : 8

  // ── Recent activity (10 pts) ─────────────────────────────────────────────
  let actPts = 1
  if (last_contact_at) {
    const daysSince = (Date.now() - new Date(last_contact_at).getTime()) / 86400000
    actPts = daysSince < 30 ? 10 : daysSince < 90 ? 6 : daysSince < 180 ? 3 : 1
  }

  const total = Math.min(100, liqPts + histPts + speedPts + relPts + actPts)

  // Build reason string
  const parts: string[] = []
  if (liqPts >= 18) parts.push(`liquidez ${liquidity_profile}`)
  if (histPts >= 18) parts.push(`${closed} deals fechados`)
  if (speedPts >= 15) parts.push(`fecho em ${acd}d`)
  if (relPts >= 16) parts.push(`fiabilidade ${reliability_score}/5`)
  if (actPts >= 6) parts.push('contacto recente')
  const reason = parts.length > 0 ? parts.join(' · ') : 'score base'

  return { score: total, reason }
}

// ---------------------------------------------------------------------------
// POST — score a single buyer
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const cronSecret = process.env.CRON_SECRET
    const incomingSecret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
    const isCron = cronSecret && incomingSecret === cronSecret
    if (!isCron) {
      const session = await auth()
      if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json().catch(() => ({}))
    const { contact_id } = body as { contact_id?: string }

    if (!contact_id) return NextResponse.json({ error: 'contact_id required' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = supabaseAdmin as any

    const { data: contact, error: fetchErr } = await s.from(TABLE)
      .select('id, full_name, liquidity_profile, deals_closed_count, avg_close_days, reliability_score, last_contact_at')
      .eq('id', contact_id)
      .single()

    if (fetchErr || !contact) return NextResponse.json({ error: 'Contact not found' }, { status: 404 })

    const { score, reason } = computeBuyerScore(contact)

    const { error: updateErr } = await s.from(TABLE)
      .update({
        buyer_score: score,
        buyer_score_reason: reason,
        buyer_scored_at: new Date().toISOString(),
      })
      .eq('id', contact_id)

    if (updateErr) {
      console.warn('[buyers/score] migration 007 not applied — buyer_score column missing')
      return NextResponse.json({ contact_id, score, reason, saved: false, note: 'migration 007 pending' })
    }

    return NextResponse.json({ contact_id, name: contact.full_name, score, reason, saved: true })
  } catch (err) {
    console.error('[buyers/score POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// GET — batch score all buyers (unscored or forced refresh)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const cronSecret = process.env.CRON_SECRET
    const incomingSecret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '')
    const isCron = cronSecret && incomingSecret === cronSecret
    if (!isCron) {
      const session = await auth()
      if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const limit = Math.min(200, parseInt(searchParams.get('limit') ?? '50'))
    const force = searchParams.get('force') === 'true'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const s = supabaseAdmin as any

    // Build query — score unscored buyers, or all if force=true
    // We try the buyer_score column; if missing (pre-migration) fall back gracefully
    let query = s.from(TABLE)
      .select('id, full_name, liquidity_profile, deals_closed_count, avg_close_days, reliability_score, last_contact_at, buyer_score')
      .in('status', ['active', 'prospect', 'lead', 'qualified', 'negotiating', 'client', 'vip'])
      .order('last_contact_at', { ascending: false, nullsFirst: false })
      .limit(limit)

    if (!force) {
      query = query.is('buyer_score', null)
    }

    const { data: contacts, error: fetchErr } = await query

    if (fetchErr) {
      // Pre-migration: buyer_score column doesn't exist — return computed scores without saving
      const { data: fallback } = await s.from(TABLE)
        .select('id, full_name, liquidity_profile, deals_closed_count, avg_close_days, reliability_score, last_contact_at')
        .in('status', ['active', 'prospect', 'qualified'])
        .limit(limit)

      const results = (fallback ?? []).map((c: Record<string, unknown>) => ({
        contact_id: c.id,
        name: c.full_name,
        ...computeBuyerScore(c as Parameters<typeof computeBuyerScore>[0]),
        saved: false,
      }))

      return NextResponse.json({ scored: results.length, results, migration_pending: true })
    }

    const results: Array<{ contact_id: string; name: string; score: number; reason: string; saved: boolean }> = []
    const updates: Array<{ id: string; buyer_score: number; buyer_score_reason: string; buyer_scored_at: string }> = []
    const now = new Date().toISOString()

    for (const contact of (contacts ?? [])) {
      const { score, reason } = computeBuyerScore(contact as Parameters<typeof computeBuyerScore>[0])
      results.push({ contact_id: contact.id, name: contact.full_name, score, reason, saved: false })
      updates.push({ id: contact.id, buyer_score: score, buyer_score_reason: reason, buyer_scored_at: now })
    }

    // Batch upsert scores
    let savedCount = 0
    for (const upd of updates) {
      const { error } = await s.from(TABLE)
        .update({ buyer_score: upd.buyer_score, buyer_score_reason: upd.buyer_score_reason, buyer_scored_at: upd.buyer_scored_at })
        .eq('id', upd.id)
      if (!error) savedCount++
    }

    // Mark all as saved
    results.forEach(r => { r.saved = true })

    console.log(`[buyers/score GET] Scored ${results.length} buyers, saved ${savedCount}`)

    return NextResponse.json({
      scored: results.length,
      saved: savedCount,
      results,
      generated_at: now,
    })
  } catch (err) {
    console.error('[buyers/score GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
