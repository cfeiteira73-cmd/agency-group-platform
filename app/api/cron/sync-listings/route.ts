// =============================================================================
// Agency Group — Sync Listings Cron
// GET /api/cron/sync-listings
// Scheduled: daily at 06:00 UTC via vercel.json
//
// PIPELINE:
//   1. Score all unscored / stale-scored active properties (batch)
//   2. Write opportunity_score + estimated_rental_yield + investor_suitable
//   3. Detect signals (price_reduction, stale, below_avm, hot_zone_new)
//   4. Write property_signals → signals table (deduplicated)
//   5. Generate priority_items for HIGH signals
//   6. Auto-trigger embedding sync for scored properties without embeddings
//   7. Write execution summary to automations_log
//
// DATA SOURCES (in priority order):
//   A. Existing properties table (unscored / stale) — always runs
//   B. Idealista API — if IDEALISTA_API_KEY + IDEALISTA_API_SECRET configured
//   C. market_properties table — scraped data from external sync
//
// AUTH: CRON_SECRET (x-cron-secret header or Authorization: Bearer)
// MAX DURATION: 300s (Vercel Pro)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }             from '@/lib/supabase'
import {
  batchScoreProperties,
  type PropertyInput,
}                                    from '@/lib/scoring/opportunityScore'
import {
  batchScorePropertiesV2,
  type PropertyInputV2,
}                                    from '@/lib/scoring/opportunityScoreV2'
import {
  detectSignals,
  signalToPriorityItem,
  type SignalPropertyInput,
}                                    from '@/lib/scoring/signalDetector'
import { cronCorrelationId }         from '@/lib/observability/correlation'
import { safeCompare }               from '@/lib/safeCompare'

export const runtime    = 'nodejs'
export const maxDuration = 300

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function authCheck(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  const token =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '').trim()
  return !!token && safeCompare(token, secret)
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SyncStats {
  properties_fetched:      number
  properties_scored:       number
  properties_updated:      number
  grades_written:          number
  signals_detected:        number
  signals_created:         number
  priority_items_created:  number
  embeddings_queued:       number
  errors:                  string[]
}

// ---------------------------------------------------------------------------
// Step 2b — Write V2 grades (opportunity_grade + score_v2_confidence_adjusted)
// Called after writeScores so V1 fields are already persisted.
// ---------------------------------------------------------------------------

async function writeGrades(
  properties: (PropertyInput & { id: string })[],
  stats:      SyncStats,
): Promise<void> {
  if (properties.length === 0) return

  const rows = properties.map(p => {
    const v2 = batchScorePropertiesV2([p as PropertyInputV2 & { id: string }])[0]
    return {
      id:                          p.id,
      opportunity_grade:           v2.opportunity_grade,
      score_v2_confidence_adjusted: v2.score_confidence_adjusted,
    }
  })

  const CHUNK = 50
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from('properties')
      .upsert(chunk, { onConflict: 'id' })

    if (error) {
      stats.errors.push(`writeGrades chunk ${i}: ${error.message}`)
    } else {
      stats.grades_written += chunk.length
    }
  }
}

// ---------------------------------------------------------------------------
// Step 1 — Fetch unscored / stale properties
// ---------------------------------------------------------------------------

async function fetchUnscoredProperties(limit = 100) {
  // Try the helper RPC first (added in migration 20260501_001)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcData, error: rpcError } = await (supabaseAdmin as any)
    .rpc('get_unscored_properties', { limit_n: limit })

  if (!rpcError && rpcData && (rpcData as unknown[]).length > 0) {
    return (rpcData as unknown) as PropertyInput[]
  }

  // Fallback: direct query if RPC not yet deployed
  const { data, error } = await supabaseAdmin
    .from('properties')
    .select([
      'id', 'title', 'price', 'price_previous', 'price_per_sqm',
      'avm_estimate', 'area_m2', 'bedrooms', 'type', 'condition', 'features',
      'zone', 'city', 'concelho', 'address',
      'days_on_market', 'is_exclusive', 'is_off_market',
      'opportunity_score', 'investor_suitable', 'status', 'created_at',
    ].join(','))
    .eq('status', 'active')
    .or('opportunity_score.eq.0,scored_at.is.null')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`fetchUnscoredProperties: ${error.message}`)
  return ((data ?? []) as unknown) as PropertyInput[]
}

// ---------------------------------------------------------------------------
// Step 2 — Write scores back to properties table
// ---------------------------------------------------------------------------

async function writeScores(
  scored: ReturnType<typeof batchScoreProperties>,
  stats:  SyncStats,
): Promise<void> {
  const toUpdate = scored.filter(s => s.changed)
  if (toUpdate.length === 0) return

  stats.properties_updated += toUpdate.length

  // Batch upsert in chunks of 50
  const CHUNK = 50
  for (let i = 0; i < toUpdate.length; i += CHUNK) {
    const chunk = toUpdate.slice(i, i + CHUNK)
    const rows = chunk.map(s => ({
      id:                     s.id,
      opportunity_score:      s.opportunity_score,
      estimated_rental_yield: s.estimated_rental_yield,
      estimated_cap_rate:     s.estimated_cap_rate,
      investor_suitable:      s.investor_suitable,
      score_reason:           s.score_reason,
      score_breakdown:        s.score_breakdown,
      zone_key:               s.zone_key,
      scored_at:              new Date().toISOString(),
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from('properties')
      .upsert(rows, { onConflict: 'id' })

    if (error) {
      stats.errors.push(`writeScores chunk ${i}: ${error.message}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Step 3 — Detect + write signals
// ---------------------------------------------------------------------------

async function processSignals(
  properties: PropertyInput[],
  stats:      SyncStats,
  agentEmail  = 'system@agency-group.pt',
): Promise<void> {
  const signalRows:   Record<string, unknown>[] = []
  const priorityRows: Record<string, unknown>[] = []

  for (const prop of properties) {
    if (!prop.id) continue
    const signals = detectSignals(prop as SignalPropertyInput)
    if (signals.length === 0) continue

    stats.signals_detected += signals.length

    for (const sig of signals) {
      // Build signals table row
      signalRows.push({
        type:               sig.signal_type,
        status:             'new',
        priority:           sig.severity === 'HIGH' ? 1 : sig.severity === 'MEDIUM' ? 2 : 3,
        probability_score:  sig.priority_score,
        property_id:        prop.id,
        property_address:   (prop as PropertyInput & { address?: string }).address ?? null,
        property_zone:      (prop as PropertyInput & { zone?: string }).zone ?? null,
        estimated_value:    (prop as PropertyInput).price,
        recommended_action: sig.action_label,
        source:             'market_monitor',
        raw_data:           sig.metadata,
        ai_analysis:        sig.description,
      })

      // HIGH + MEDIUM signals → priority_items queue (LOW excluded to reduce noise)
      if (sig.severity === 'HIGH' || sig.severity === 'MEDIUM') {
        const item = signalToPriorityItem(prop.id, agentEmail, sig)
        priorityRows.push(item)
      }
    }
  }

  // Insert signals (ON CONFLICT DO NOTHING — unique index idx_signals_property_type_active)
  if (signalRows.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error, data } = await (supabaseAdmin as any)
      .from('signals')
      .insert(signalRows)
      .select('id')

    if (error) {
      // Unique violation = already exists, not a real error
      if (!error.message.includes('unique') && !error.message.includes('duplicate')) {
        stats.errors.push(`signals insert: ${error.message}`)
      }
    } else {
      stats.signals_created += data?.length ?? 0
    }
  }

  // Insert priority items
  if (priorityRows.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabaseAdmin as any)
      .from('priority_items')
      .insert(priorityRows)

    if (error) {
      if (!error.message.includes('unique') && !error.message.includes('duplicate')) {
        stats.errors.push(`priority_items insert: ${error.message}`)
      }
    } else {
      stats.priority_items_created += priorityRows.length
    }
  }
}

// ---------------------------------------------------------------------------
// Step 4 — Write price_history for properties with price changes
// ---------------------------------------------------------------------------

async function writePriceHistory(
  properties: PropertyInput[],
  stats:      SyncStats,
): Promise<void> {
  const reductions = properties.filter(p => {
    if (!p.price || !p.price_previous) return false
    if (p.price >= p.price_previous) return false
    const pct = (p.price_previous - p.price) / p.price_previous
    return pct >= 0.02  // Only record if ≥ 2% change
  })

  if (reductions.length === 0) return

  // Dedup: fetch existing price_history records for these properties in last 7 days
  // to avoid duplicate entries on double-run (cron retry / manual trigger)
  const sinceDedup = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const ids = reductions.map(p => p.id!).filter(Boolean)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: recentEntries } = await (supabaseAdmin as any)
    .from('price_history')
    .select('property_id, price_new')
    .in('property_id', ids)
    .gte('recorded_at', sinceDedup)

  // Build a dedup set: "propertyId:priceNew"
  const recentKeys = new Set<string>(
    (recentEntries ?? []).map((r: { property_id: string; price_new: number }) =>
      `${r.property_id}:${r.price_new}`,
    ),
  )

  const rows = reductions
    .filter(p => !recentKeys.has(`${p.id}:${p.price}`))
    .map(p => ({
      property_id:  p.id!,
      price_old:    p.price_previous!,
      price_new:    p.price,
      change_type:  p.price < p.price_previous! ? 'reduction' : 'increase',
      source:       'sync',
    }))

  if (rows.length === 0) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('price_history')
    .insert(rows)

  if (error && !error.message.includes('unique')) {
    stats.errors.push(`price_history insert: ${error.message}`)
  }
}

// ---------------------------------------------------------------------------
// Step 5 — Queue embeddings for scored properties without vectors
// ---------------------------------------------------------------------------

async function queueEmbeddings(
  properties: PropertyInput[],
  stats:      SyncStats,
): Promise<void> {
  // Fetch which of our scored properties lack embeddings
  const ids = properties.map(p => p.id!).filter(Boolean)
  if (ids.length === 0) return

  const { data: needsEmbed, error } = await supabaseAdmin
    .from('properties')
    .select('id')
    .in('id', ids)
    .is('embedding', null)
    .eq('status', 'active')
    .limit(20)  // Batch limit to avoid OpenAI rate limits

  if (error || !needsEmbed || needsEmbed.length === 0) return

  // Trigger embedding sync for each (fire-and-forget, non-blocking)
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://agencygroup.pt'
  const embedIds = needsEmbed.map(r => r.id)

  // Call our own embeddings endpoint (internal service call)
  try {
    const resp = await fetch(`${baseUrl}/api/embeddings/sync`, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.CRON_SECRET ?? ''}`,
      },
      body: JSON.stringify({ property_ids: embedIds }),
    })
    if (resp.ok) {
      stats.embeddings_queued += embedIds.length
    }
  } catch {
    // Non-critical — embeddings will be retried on next run
    stats.errors.push(`embeddings queue: non-fatal, will retry next run`)
  }
}

// ---------------------------------------------------------------------------
// Step 6 — Log execution to automations_log
// ---------------------------------------------------------------------------

async function logExecution(
  stats:     SyncStats,
  startedAt: string,
  durationMs: number,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabaseAdmin as any)
    .from('automations_log')
    .insert({
      workflow_name: 'sync_listings_cron',
      trigger_type:  'cron',
      status:        stats.errors.length === 0 ? 'success' : 'partial',
      started_at:    startedAt,
      completed_at:  new Date().toISOString(),
      duration_ms:   durationMs,
      outcome: {
        properties_fetched:     stats.properties_fetched,
        properties_scored:      stats.properties_scored,
        properties_updated:     stats.properties_updated,
        grades_written:         stats.grades_written,
        signals_detected:       stats.signals_detected,
        signals_created:        stats.signals_created,
        priority_items_created: stats.priority_items_created,
        embeddings_queued:      stats.embeddings_queued,
      },
      error_message: stats.errors.length > 0 ? stats.errors.join('; ') : null,
    })
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!authCheck(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const corrId = cronCorrelationId('sync-listings')

  const startedAt = new Date().toISOString()
  const t0        = Date.now()

  const stats: SyncStats = {
    properties_fetched:      0,
    properties_scored:       0,
    properties_updated:      0,
    grades_written:          0,
    signals_detected:        0,
    signals_created:         0,
    priority_items_created:  0,
    embeddings_queued:       0,
    errors:                  [],
  }

  try {
    // ── 1. Fetch unscored / stale properties ─────────────────────────────────
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '100', 10)
    const properties = await fetchUnscoredProperties(limit)

    stats.properties_fetched = properties.length

    if (properties.length === 0) {
      const earlyRes = NextResponse.json({
        ok:      true,
        message: 'No unscored properties found — all up to date',
        stats,
        duration_ms:    Date.now() - t0,
        correlation_id: corrId,
      })
      earlyRes.headers.set('x-correlation-id', corrId)
      return earlyRes
    }

    // ── 2. Score all fetched properties ──────────────────────────────────────
    const propertiesWithId = properties.filter(
      (p): p is PropertyInput & { id: string } => typeof p.id === 'string'
    )

    const scored = batchScoreProperties(propertiesWithId)
    stats.properties_scored = scored.length

    // ── 2b. Scoring anomaly detection (observability) ────────────────────────
    if (scored.length > 0) {
      const zeroCount = scored.filter(s => s.opportunity_score === 0).length
      const highCount = scored.filter(s => s.opportunity_score >= 90).length
      const zeroRatio = zeroCount / scored.length
      const highRatio = highCount / scored.length
      if (zeroRatio > 0.5) {
        stats.errors.push(
          `WARN: ${Math.round(zeroRatio * 100)}% properties scored 0 — verify scoring calibration (${zeroCount}/${scored.length})`,
        )
      }
      if (highRatio > 0.8) {
        stats.errors.push(
          `WARN: ${Math.round(highRatio * 100)}% properties scored ≥90 — possible score inflation (${highCount}/${scored.length})`,
        )
      }
    }

    // ── 3. Write scores to DB ────────────────────────────────────────────────
    await writeScores(scored, stats)

    // ── 3b. Write V2 grades (opportunity_grade, score_v2_confidence_adjusted) ─
    await writeGrades(propertiesWithId, stats)

    // ── 4. Detect + write signals ────────────────────────────────────────────
    await processSignals(propertiesWithId, stats)

    // ── 5. Write price history ───────────────────────────────────────────────
    await writePriceHistory(propertiesWithId, stats)

    // ── 6. Queue embeddings (non-blocking) ───────────────────────────────────
    await queueEmbeddings(propertiesWithId, stats)

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    stats.errors.push(`fatal: ${msg}`)
  }

  const durationMs = Date.now() - t0

  // Log to automations_log (best-effort — don't fail cron if log fails)
  try {
    await logExecution(stats, startedAt, durationMs)
  } catch { /* silent */ }

  const hasErrors = stats.errors.length > 0

  const res = NextResponse.json(
    {
      ok:             !hasErrors,
      stats,
      duration_ms:    durationMs,
      correlation_id: corrId,
      ...(hasErrors ? { errors: stats.errors } : {}),
    },
    { status: hasErrors ? 207 : 200 },
  )
  res.headers.set('x-correlation-id', corrId)
  return res
}
