// =============================================================================
// Agency Group — AI Policy Auto-Tuning
// lib/ai/policyTuning.ts
//
// Automatically optimizes agent thresholds based on conversion outcomes and
// revenue attribution. Reads from ai_feedback + causal_trace. Never writes
// parameter changes — only generates TuningRecommendations and records
// applied changes in policy_tuning_log when explicitly called.
//
// DESIGN:
//   - All functions are async and return typed Promises
//   - All Supabase calls are wrapped in try/catch — fail-open
//   - No module-level side effects or instantiation
//   - createClient<any> with eslint-disable for untyped tables
//
// TypeScript strict — 0 errors
// =============================================================================

import { createClient } from '@supabase/supabase-js'

// -- CREATE TABLE policy_tuning_log (
// --   id uuid primary key default gen_random_uuid(),
// --   tenant_id text not null,
// --   parameter text not null,
// --   old_value numeric,
// --   new_value numeric not null,
// --   applied_by text,
// --   created_at timestamptz not null default now()
// -- );

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TuningRecommendation {
  parameter: string
  currentValue: number
  recommendedValue: number
  confidence: number
  based_on: string
  impact: 'high' | 'medium' | 'low'
}

export interface TuningReport {
  tenant_id: string
  generated_at: string
  recommendations: TuningRecommendation[]
  summary: string
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Compute the percentile value from a sorted ascending array. */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.floor((p / 100) * (sorted.length - 1))
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]
}

// ─── analyzeTuningOpportunities ───────────────────────────────────────────────

/**
 * Analyzes ai_feedback + causal_trace data to suggest parameter improvements.
 *
 * Checks:
 *   1. LEAD SCORE THRESHOLD — leads with score < 80 that still converted
 *   2. FOLLOWUP TIMING      — correlation between fast followup and success
 *   3. AGENT ROUTING        — compare success rates across agent channels
 *
 * IMPORTANT: This function reads from Supabase but NEVER writes.
 * Always returns a TuningReport even if data is insufficient.
 */
export async function analyzeTuningOpportunities(tenantId: string): Promise<TuningReport> {
  const emptyReport: TuningReport = {
    tenant_id: tenantId,
    generated_at: new Date().toISOString(),
    recommendations: [],
    summary: 'Insufficient data to generate tuning recommendations. Collect more feedback events.',
  }

  const client = getClient()
  if (!client) {
    console.warn('[policy-tuning] Supabase not configured — skipping analyzeTuningOpportunities')
    return emptyReport
  }

  const recommendations: TuningRecommendation[] = []

  try {
    // ── 1. LEAD SCORE THRESHOLD ──────────────────────────────────────────────
    // Find feedback where the deal succeeded (success_score > 0.8) but
    // the metadata lead_score was below the current hot threshold (80).
    const { data: lowScoreConverters, error: lscError } = await client
      .from('ai_feedback')
      .select('metadata, success_score')
      .eq('tenant_id', tenantId)
      .gt('success_score', 0.8)
      .not('metadata', 'is', null)

    if (lscError) {
      console.warn('[policy-tuning] lead_score query error:', lscError.message)
    }

    if (lowScoreConverters && lowScoreConverters.length >= 5) {
      const convertingScores: number[] = []

      for (const row of lowScoreConverters) {
        const meta = row.metadata as Record<string, unknown> | null
        if (!meta) continue
        const rawScore = meta['lead_score']
        const numScore =
          typeof rawScore === 'number'
            ? rawScore
            : typeof rawScore === 'string'
            ? parseFloat(rawScore)
            : NaN

        if (!isNaN(numScore) && numScore < 80) {
          convertingScores.push(numScore)
        }
      }

      if (convertingScores.length >= 5) {
        convertingScores.sort((a, b) => a - b)
        const p60 = percentile(convertingScores, 60)
        const recommended = Math.max(50, Math.round(p60))

        recommendations.push({
          parameter: 'lead_score_hot_threshold',
          currentValue: 80,
          recommendedValue: recommended,
          confidence: Math.min(0.9, convertingScores.length / 50),
          based_on: `${convertingScores.length} leads with score < 80 converted with success_score > 0.8. P60 of converting scores = ${p60.toFixed(1)}.`,
          impact: 'high',
        })
      }
    }

    // ── 2. FOLLOWUP TIMING ───────────────────────────────────────────────────
    // Compare success_score for records where a causal_trace step of type
    // email_sent or whatsapp_sent occurred quickly (proxy: feedback created
    // close to event). We approximate by grouping feedback by the hour-delta
    // encoded in metadata.followup_delay_minutes if present.
    const { data: feedbackAll, error: faError } = await client
      .from('ai_feedback')
      .select('success_score, metadata')
      .eq('tenant_id', tenantId)
      .not('success_score', 'is', null)
      .limit(1000)

    if (faError) {
      console.warn('[policy-tuning] followup_timing query error:', faError.message)
    }

    if (feedbackAll && feedbackAll.length >= 10) {
      const fastFollowup: number[] = []
      const slowFollowup: number[] = []

      for (const row of feedbackAll) {
        const meta = row.metadata as Record<string, unknown> | null
        if (!meta) continue
        const delay = meta['followup_delay_minutes']
        const delayNum =
          typeof delay === 'number'
            ? delay
            : typeof delay === 'string'
            ? parseFloat(delay)
            : NaN

        if (isNaN(delayNum)) continue
        const score = row.success_score as number

        if (delayNum <= 120) {
          fastFollowup.push(score)
        } else {
          slowFollowup.push(score)
        }
      }

      if (fastFollowup.length >= 5 && slowFollowup.length >= 5) {
        const fastAvg = fastFollowup.reduce((s, v) => s + v, 0) / fastFollowup.length
        const slowAvg = slowFollowup.reduce((s, v) => s + v, 0) / slowFollowup.length

        if (fastAvg - slowAvg > 0.1) {
          recommendations.push({
            parameter: 'followup_window_minutes',
            currentValue: 240,
            recommendedValue: 120,
            confidence: Math.min(0.85, (fastFollowup.length + slowFollowup.length) / 100),
            based_on: `Leads with followup ≤ 120 min averaged success_score ${fastAvg.toFixed(2)} vs ${slowAvg.toFixed(2)} for slower followups (Δ ${(fastAvg - slowAvg).toFixed(2)}).`,
            impact: 'medium',
          })
        }
      }
    }

    // ── 3. AGENT ROUTING ─────────────────────────────────────────────────────
    // Compare average success_score per agent_id for the tenant.
    const { data: agentFeedback, error: afError } = await client
      .from('ai_feedback')
      .select('agent_id, success_score')
      .eq('tenant_id', tenantId)
      .not('success_score', 'is', null)
      .limit(2000)

    if (afError) {
      console.warn('[policy-tuning] agent_routing query error:', afError.message)
    }

    if (agentFeedback && agentFeedback.length >= 10) {
      const agentScores = new Map<string, number[]>()

      for (const row of agentFeedback) {
        const agentId = row.agent_id as string
        const score = row.success_score as number
        if (!agentScores.has(agentId)) agentScores.set(agentId, [])
        agentScores.get(agentId)!.push(score)
      }

      // Only compare agents with >= 5 samples
      const agentAvgs: Array<{ agentId: string; avg: number; count: number }> = []
      for (const [agentId, scores] of agentScores.entries()) {
        if (scores.length < 5) continue
        agentAvgs.push({
          agentId,
          avg: scores.reduce((s, v) => s + v, 0) / scores.length,
          count: scores.length,
        })
      }

      agentAvgs.sort((a, b) => b.avg - a.avg)

      if (agentAvgs.length >= 2) {
        const best = agentAvgs[0]
        const worst = agentAvgs[agentAvgs.length - 1]
        const delta = best.avg - worst.avg

        if (delta > 0.15) {
          recommendations.push({
            parameter: 'default_agent_routing',
            currentValue: 0,
            recommendedValue: 1,
            confidence: Math.min(0.8, (best.count + worst.count) / 200),
            based_on: `Agent '${best.agentId}' avg success ${best.avg.toFixed(2)} vs '${worst.agentId}' avg ${worst.avg.toFixed(2)} (Δ ${delta.toFixed(2)}). Route more leads to higher-performing agent.`,
            impact: 'high',
          })
        }
      }
    }

    const summary =
      recommendations.length > 0
        ? `Found ${recommendations.length} tuning opportunity${recommendations.length > 1 ? 'ies' : 'y'} for tenant ${tenantId}. High-impact changes should be reviewed and applied manually.`
        : 'No significant tuning opportunities detected with current data. Continue collecting feedback events.'

    return {
      tenant_id: tenantId,
      generated_at: new Date().toISOString(),
      recommendations,
      summary,
    }
  } catch (err) {
    console.warn('[policy-tuning] analyzeTuningOpportunities unexpected error:', err)
    return emptyReport
  }
}

// ─── applyRecommendation ──────────────────────────────────────────────────────

/**
 * Records an applied recommendation in Supabase 'policy_tuning_log' table.
 * Reads the current value from a prior log entry if available.
 * Fails open — never throws.
 */
export async function applyRecommendation(
  tenantId: string,
  parameter: string,
  newValue: number,
): Promise<void> {
  const client = getClient()
  if (!client) {
    console.warn('[policy-tuning] Supabase not configured — skipping applyRecommendation')
    return
  }

  try {
    // Fetch last recorded value for this parameter (best-effort)
    const { data: lastLog } = await client
      .from('policy_tuning_log')
      .select('new_value')
      .eq('tenant_id', tenantId)
      .eq('parameter', parameter)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const oldValue: number | null =
      lastLog !== null ? (lastLog.new_value as number) : null

    const { error } = await client.from('policy_tuning_log').insert({
      tenant_id: tenantId,
      parameter,
      old_value: oldValue,
      new_value: newValue,
    })

    if (error) {
      console.warn('[policy-tuning] applyRecommendation insert error:', error.message)
    }
  } catch (err) {
    console.warn('[policy-tuning] applyRecommendation unexpected error:', err)
  }
}
