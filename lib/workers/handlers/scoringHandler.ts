// Agency Group — Scoring Worker Handler
// lib/workers/handlers/scoringHandler.ts
//
// Dequeues scoring jobs, runs opportunityScoreV2, upserts property_scores,
// and emits a propertyScored event.
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import { computeOpportunityScoreV2 } from '@/lib/scoring/opportunityScoreV2'
import { emit } from '@/lib/events/producers'
import type { WorkerJob, WorkerResult } from '../types'

// ─── Payload ──────────────────────────────────────────────────────────────────

export interface ScoringJobPayload {
  property_id: string
  tenant_id:   string
  force?:      boolean
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function scoringHandler(
  job: WorkerJob<ScoringJobPayload>,
): Promise<WorkerResult> {
  const start = Date.now()
  const { property_id, tenant_id, force = false } = job.payload

  try {
    // 1. Fetch property
    const { data: property, error: fetchErr } = await (supabaseAdmin as any)
      .from('properties')
      .select('*')
      .eq('id', property_id)
      .eq('tenant_id', tenant_id)
      .single()

    if (fetchErr || !property) {
      return {
        jobId:      job.jobId,
        success:    false,
        durationMs: Date.now() - start,
        error:      `Property not found: ${property_id} — ${fetchErr?.message ?? 'no data'}`,
      }
    }

    // 2. Check for recent cached score (< 7 days old) unless force=true
    if (!force) {
      const { data: existing } = await (supabaseAdmin as any)
        .from('property_scores')
        .select('scored_at, opportunity_score')
        .eq('property_id', property_id)
        .eq('tenant_id', tenant_id)
        .order('scored_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existing?.scored_at) {
        const ageDays =
          (Date.now() - new Date(existing.scored_at as string).getTime()) / 86_400_000
        if (ageDays < 7) {
          return {
            jobId:      job.jobId,
            success:    true,
            durationMs: Date.now() - start,
            output:     {
              cached:            true,
              property_id,
              opportunity_score: existing.opportunity_score,
              scored_at:         existing.scored_at,
            },
          }
        }
      }
    }

    // Capture old score for the event payload
    const { data: oldScoreRow } = await (supabaseAdmin as any)
      .from('property_scores')
      .select('opportunity_score')
      .eq('property_id', property_id)
      .eq('tenant_id', tenant_id)
      .order('scored_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const previousScore: number | null =
      (oldScoreRow as { opportunity_score?: number } | null)?.opportunity_score ?? null

    // 3. Score with V2
    const result = computeOpportunityScoreV2(property)

    const {
      opportunity_score,
      score_breakdown_v2,
      opportunity_grade,
      score_confidence_adjusted,
      score_raw,
      confidence_penalty,
      estimated_rental_yield,
      estimated_cap_rate,
      investor_suitable,
      score_reason,
    } = result

    // Derived sub-scores from breakdown
    const { d2_rental_yield, d4_dom_position, b4_market_liquidity, v2_bonus_total } =
      score_breakdown_v2

    // 4. Upsert into property_scores
    const upsertRow = {
      property_id,
      tenant_id,
      opportunity_score,
      yield_score:       d2_rental_yield,
      risk_score:        Math.max(0, 100 - score_raw),          // inverse of raw score
      liquidity_score:   b4_market_liquidity * 20,              // 0-5 → 0-100
      investment_score:  Math.min(100, opportunity_score + v2_bonus_total),
      grade:             opportunity_grade,
      confidence:        confidence_penalty === 0 ? 1.0 : Math.max(0, 1 - confidence_penalty / 15),
      model_version:     'v2',
      scored_at:         new Date().toISOString(),
      // Store full breakdown as metadata
      score_breakdown:   score_breakdown_v2,
      score_reason,
      estimated_rental_yield: estimated_rental_yield ?? null,
      estimated_cap_rate:     estimated_cap_rate ?? null,
      investor_suitable,
    }

    const { error: upsertErr } = await (supabaseAdmin as any)
      .from('property_scores')
      .upsert(upsertRow, { onConflict: 'property_id,tenant_id' })

    if (upsertErr) {
      console.error(`[scoringHandler] upsert failed for ${property_id}:`, upsertErr.message)
      return {
        jobId:      job.jobId,
        success:    false,
        durationMs: Date.now() - start,
        error:      `property_scores upsert failed: ${upsertErr.message}`,
      }
    }

    // 5. Emit event (fire-and-forget)
    void emit.propertyScored({
      property_id,
      opportunity_score,
      previous_score:    previousScore,
      score_reason,
      investor_suitable,
    })

    return {
      jobId:      job.jobId,
      success:    true,
      durationMs: Date.now() - start,
      output:     {
        property_id,
        opportunity_score,
        grade:          opportunity_grade,
        investor_suitable,
        previous_score: previousScore,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[scoringHandler] unexpected error for job ${job.jobId}:`, msg)
    return {
      jobId:      job.jobId,
      success:    false,
      durationMs: Date.now() - start,
      error:      msg,
    }
  }
}
