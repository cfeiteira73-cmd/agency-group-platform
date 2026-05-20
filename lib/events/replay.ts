// Agency Group — Event Replay Utility
// lib/events/replay.ts
//
// Point-in-time recovery tool — replays events from event_history in order.
// Separate from the replayHandler worker (which handles queue jobs).
// This utility is called directly for CLI, admin routes, or recovery scripts.
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import { eventBus } from '@/lib/events/bus'
import type { AnyPlatformEvent } from '@/lib/events/types'
import { computeOpportunityScoreV2 } from '@/lib/scoring/opportunityScoreV2'

// ─── Public API types ─────────────────────────────────────────────────────────

export interface ReplayOptions {
  tenantId:    string
  entityType?: string
  fromDate?:   string     // ISO date — inclusive lower bound on occurred_at / created_at
  toDate?:     string     // ISO date — inclusive upper bound
  entityId?:   string     // Filter by entity (property_id, lead_id, etc.) in payload
  dryRun?:     boolean
  batchSize?:  number     // default 50
}

export interface ReplayResult {
  eventsFound:    number
  eventsReplayed: number
  errors:         string[]
  durationMs:     number
}

// ─── replayEvents ─────────────────────────────────────────────────────────────

/**
 * Read events from event_history matching `options`, replay via eventBus in
 * chronological order, and return a summary.
 * If dryRun=true, events are counted and logged but not re-published.
 */
export async function replayEvents(options: ReplayOptions): Promise<ReplayResult> {
  const t0 = Date.now()
  const {
    tenantId,
    entityType,
    fromDate,
    toDate,
    entityId,
    dryRun   = false,
    batchSize = 50,
  } = options

  const errors: string[] = []
  let eventsFound    = 0
  let eventsReplayed = 0
  let offset         = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    // Build query
    let query = (supabaseAdmin as any)
      .from('event_history')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true })
      .range(offset, offset + batchSize - 1)

    if (entityType) {
      query = query.eq('event_type', entityType)
    }
    if (fromDate) {
      query = query.gte('created_at', fromDate)
    }
    if (toDate) {
      query = query.lte('created_at', toDate)
    }

    const { data: rows, error: fetchErr } = await query

    if (fetchErr) {
      errors.push(`event_history fetch error at offset ${offset}: ${fetchErr.message}`)
      break
    }

    const batch = (rows ?? []) as Array<Record<string, unknown>>
    if (batch.length === 0) break

    // Optional entity-level filter — applied in memory because the entity ID
    // may live inside the JSONB payload at different paths depending on event_type
    const filtered = entityId
      ? batch.filter(row => {
          const payload = row.payload as Record<string, unknown> | undefined
          if (!payload) return false
          return Object.values(payload).some(v => v === entityId)
        })
      : batch

    eventsFound += filtered.length

    for (const row of filtered) {
      if (dryRun) {
        console.log(
          `[replayEvents][dry-run] event_id=${row.event_id} ` +
          `type=${row.event_type} tenant=${tenantId}`,
        )
        eventsReplayed++
        continue
      }

      try {
        const eventPayload = (row.payload ?? row) as AnyPlatformEvent
        await eventBus.publish(eventPayload)
        eventsReplayed++
      } catch (publishErr) {
        const msg = publishErr instanceof Error ? publishErr.message : String(publishErr)
        errors.push(`publish failed for event_id=${row.event_id}: ${msg}`)
        // Continue replaying remaining events despite individual failures
      }
    }

    // Stop if we received fewer rows than requested (last page)
    if (batch.length < batchSize) break
    offset += batchSize
  }

  return {
    eventsFound,
    eventsReplayed,
    errors,
    durationMs: Date.now() - t0,
  }
}

// ─── rebuildProjection ────────────────────────────────────────────────────────

/**
 * Clears a projection table and rebuilds it from event_history.
 *
 * Supported projections:
 *   'property_scores'  — re-runs V2 scoring on all properties for this tenant
 *   'investor_matches' — re-runs investor matching for all properties
 *   'kpi_snapshots'    — not implemented
 */
export async function rebuildProjection(
  projectionName: string,
  tenantId:       string,
): Promise<{ rows: number; durationMs: number }> {
  const t0 = Date.now()

  switch (projectionName) {
    case 'property_scores':
      return rebuildPropertyScores(tenantId, t0)

    case 'investor_matches':
      return rebuildInvestorMatches(tenantId, t0)

    case 'kpi_snapshots':
      throw new Error('rebuildProjection: kpi_snapshots is not implemented')

    default:
      throw new Error(`rebuildProjection: unknown projection "${projectionName}"`)
  }
}

// ─── property_scores projection rebuild ──────────────────────────────────────

async function rebuildPropertyScores(
  tenantId: string,
  t0:       number,
): Promise<{ rows: number; durationMs: number }> {
  // 1. Clear existing scores for this tenant
  const { error: deleteErr } = await (supabaseAdmin as any)
    .from('property_scores')
    .delete()
    .eq('tenant_id', tenantId)

  if (deleteErr) {
    throw new Error(`rebuildPropertyScores: delete failed — ${deleteErr.message}`)
  }

  // 2. Fetch all active properties for this tenant in batches
  const PAGE = 100
  let offset = 0
  let totalRows = 0

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data: properties, error: fetchErr } = await (supabaseAdmin as any)
      .from('properties')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .range(offset, offset + PAGE - 1)

    if (fetchErr) {
      throw new Error(`rebuildPropertyScores: fetch failed at offset ${offset} — ${fetchErr.message}`)
    }

    const batch = (properties ?? []) as Array<Record<string, unknown>>
    if (batch.length === 0) break

    // 3. Score each property and upsert
    const upsertRows = batch.map(p => {
      const result = computeOpportunityScoreV2(p as any)
      const { score_breakdown_v2, opportunity_grade, confidence_penalty, estimated_rental_yield, estimated_cap_rate, investor_suitable, opportunity_score, score_reason } = result
      const { d2_rental_yield, b4_market_liquidity, v2_bonus_total } = score_breakdown_v2
      return {
        property_id:            p.id,
        tenant_id:              tenantId,
        opportunity_score,
        yield_score:            d2_rental_yield,
        risk_score:             Math.max(0, 100 - result.score_raw),
        liquidity_score:        b4_market_liquidity * 20,
        investment_score:       Math.min(100, opportunity_score + v2_bonus_total),
        grade:                  opportunity_grade,
        confidence:             confidence_penalty === 0 ? 1.0 : Math.max(0, 1 - confidence_penalty / 15),
        model_version:          'v2',
        scored_at:              new Date().toISOString(),
        score_breakdown:        score_breakdown_v2,
        score_reason,
        estimated_rental_yield: estimated_rental_yield ?? null,
        estimated_cap_rate:     estimated_cap_rate ?? null,
        investor_suitable,
      }
    })

    const { error: upsertErr } = await (supabaseAdmin as any)
      .from('property_scores')
      .upsert(upsertRows, { onConflict: 'property_id,tenant_id' })

    if (upsertErr) {
      throw new Error(`rebuildPropertyScores: upsert failed at offset ${offset} — ${upsertErr.message}`)
    }

    totalRows += batch.length

    if (batch.length < PAGE) break
    offset += PAGE
  }

  return { rows: totalRows, durationMs: Date.now() - t0 }
}

// ─── investor_matches projection rebuild ─────────────────────────────────────

async function rebuildInvestorMatches(
  tenantId: string,
  t0:       number,
): Promise<{ rows: number; durationMs: number }> {
  // 1. Clear existing matches for this tenant
  const { error: deleteErr } = await (supabaseAdmin as any)
    .from('investor_matches')
    .delete()
    .eq('tenant_id', tenantId)

  if (deleteErr) {
    throw new Error(`rebuildInvestorMatches: delete failed — ${deleteErr.message}`)
  }

  // 2. Fetch all investors + their scored properties, then insert matches
  const { data: investors, error: invErr } = await (supabaseAdmin as any)
    .from('investors')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('active', true)

  if (invErr) {
    throw new Error(`rebuildInvestorMatches: investors fetch failed — ${invErr.message}`)
  }

  const investorList = (investors ?? []) as Array<Record<string, unknown>>
  if (investorList.length === 0) {
    return { rows: 0, durationMs: Date.now() - t0 }
  }

  // Fetch investor-suitable scored properties
  const { data: scores, error: scoresErr } = await (supabaseAdmin as any)
    .from('property_scores')
    .select('property_id, opportunity_score, grade, investment_score')
    .eq('tenant_id', tenantId)
    .eq('investor_suitable', true)
    .gte('opportunity_score', 50)
    .order('opportunity_score', { ascending: false })

  if (scoresErr) {
    throw new Error(`rebuildInvestorMatches: property_scores fetch failed — ${scoresErr.message}`)
  }

  const scoredProperties = (scores ?? []) as Array<{
    property_id: string
    opportunity_score: number
    grade: string
    investment_score: number
  }>

  if (scoredProperties.length === 0) {
    return { rows: 0, durationMs: Date.now() - t0 }
  }

  // 3. Create matches: pair each investor with suitable properties
  const matchRows: Array<Record<string, unknown>> = []
  const now = new Date().toISOString()

  for (const investor of investorList) {
    for (const score of scoredProperties) {
      matchRows.push({
        investor_id:       investor.id,
        property_id:       score.property_id,
        tenant_id:         tenantId,
        match_score:       score.opportunity_score,
        match_grade:       score.grade,
        investment_score:  score.investment_score,
        matched_at:        now,
        status:            'pending',
        created_at:        now,
      })
    }
  }

  // Batch insert in chunks of 500 to avoid payload limits
  const CHUNK = 500
  let totalInserted = 0
  for (let i = 0; i < matchRows.length; i += CHUNK) {
    const chunk = matchRows.slice(i, i + CHUNK)
    const { error: insertErr } = await (supabaseAdmin as any)
      .from('investor_matches')
      .insert(chunk)

    if (insertErr) {
      throw new Error(`rebuildInvestorMatches: insert failed at chunk ${i} — ${insertErr.message}`)
    }
    totalInserted += chunk.length
  }

  return { rows: totalInserted, durationMs: Date.now() - t0 }
}
