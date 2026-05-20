// =============================================================================
// Agency Group — AI Reinforcement Feedback Engine
// lib/ai/feedbackEngine.ts
//
// Tracks AI Decision → Human Action → Revenue Result → Success Score.
// Closes the learning loop for continuous AI improvement.
//
// DESIGN:
//   - All functions are async and return typed Promises
//   - All Supabase calls are wrapped in try/catch — fail-open
//   - Guarded by CAUSAL_TRACE_ENABLED=true for any DB-dependent operation
//   - createClient<any> with eslint-disable for untyped table
//
// TypeScript strict — 0 errors
// =============================================================================

import { createClient } from '@supabase/supabase-js'

// -- CREATE TABLE ai_feedback (
// --   id uuid primary key default gen_random_uuid(),
// --   correlation_id text not null,
// --   tenant_id text not null,
// --   agent_id text not null,
// --   decision_summary text,
// --   human_action text,
// --   revenue_outcome numeric,
// --   success_score numeric CHECK (success_score >= 0 AND success_score <= 1),
// --   feedback_source text not null,
// --   metadata jsonb,
// --   created_at timestamptz not null default now()
// -- );
// -- CREATE INDEX idx_ai_feedback_agent ON ai_feedback(agent_id, created_at DESC);
// -- CREATE INDEX idx_ai_feedback_tenant ON ai_feedback(tenant_id, created_at DESC);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FeedbackRecord {
  correlation_id: string
  tenant_id: string
  agent_id: string
  decision_summary: string
  human_action?: string
  revenue_outcome?: number
  success_score?: number
  feedback_source: 'automatic' | 'human' | 'revenue_event'
  metadata?: Record<string, unknown>
  created_at?: string
}

export interface LearningSignal {
  agent_id: string
  tenant_id: string
  signal_type: 'positive' | 'negative' | 'neutral'
  strength: number
  context: string
  based_on: 'revenue_outcome' | 'human_correction' | 'conversion_success' | 'deal_lost'
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

function isEnabled(): boolean {
  return process.env.CAUSAL_TRACE_ENABLED === 'true'
}

// ─── recordFeedback ───────────────────────────────────────────────────────────

/**
 * Fire-and-forget insert to Supabase 'ai_feedback' table.
 * Guarded by CAUSAL_TRACE_ENABLED=true.
 * Fails open — never throws.
 */
export async function recordFeedback(
  record: Omit<FeedbackRecord, 'created_at'>,
): Promise<void> {
  if (!isEnabled()) return

  const client = getClient()
  if (!client) {
    console.warn('[feedback-engine] Supabase not configured — skipping recordFeedback')
    return
  }

  try {
    const { error } = await client.from('ai_feedback').insert({
      correlation_id: record.correlation_id,
      tenant_id: record.tenant_id,
      agent_id: record.agent_id,
      decision_summary: record.decision_summary,
      human_action: record.human_action ?? null,
      revenue_outcome: record.revenue_outcome ?? null,
      success_score: record.success_score ?? null,
      feedback_source: record.feedback_source,
      metadata: record.metadata ?? null,
    })

    if (error) {
      console.warn('[feedback-engine] recordFeedback insert error:', error.message)
    }
  } catch (err) {
    console.warn('[feedback-engine] recordFeedback unexpected error:', err)
  }
}

// ─── computeSuccessScore ──────────────────────────────────────────────────────

/**
 * Computes a normalized success score in [0.0, 1.0].
 * score = min(1.0, revenueOutcome / expectedRevenue)
 * If expectedRevenue <= 0, returns revenueOutcome > 0 ? 1.0 : 0.0
 */
export function computeSuccessScore(
  revenueOutcome: number,
  expectedRevenue: number,
): number {
  if (expectedRevenue <= 0) {
    return revenueOutcome > 0 ? 1.0 : 0.0
  }
  return Math.min(1.0, revenueOutcome / expectedRevenue)
}

// ─── getLearningSignals ───────────────────────────────────────────────────────

/**
 * Queries the last N days of ai_feedback for the given agent+tenant.
 * Converts each record to a LearningSignal based on success_score:
 *   score >= 0.8 → positive, strength = score
 *   score <= 0.3 → negative, strength = 1 - score
 *   otherwise   → neutral,   strength = score
 */
export async function getLearningSignals(
  agentId: string,
  tenantId: string,
  days = 30,
): Promise<LearningSignal[]> {
  if (!isEnabled()) return []

  const client = getClient()
  if (!client) {
    console.warn('[feedback-engine] Supabase not configured — skipping getLearningSignals')
    return []
  }

  try {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

    const { data, error } = await client
      .from('ai_feedback')
      .select(
        'agent_id, tenant_id, success_score, feedback_source, decision_summary, human_action, metadata',
      )
      .eq('agent_id', agentId)
      .eq('tenant_id', tenantId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500)

    if (error) {
      console.warn('[feedback-engine] getLearningSignals query error:', error.message)
      return []
    }

    const signals: LearningSignal[] = []

    for (const row of data ?? []) {
      const score: number | null = row.success_score ?? null

      if (score === null) continue

      let signal_type: LearningSignal['signal_type']
      let strength: number

      if (score >= 0.8) {
        signal_type = 'positive'
        strength = score
      } else if (score <= 0.3) {
        signal_type = 'negative'
        strength = 1 - score
      } else {
        signal_type = 'neutral'
        strength = score
      }

      // Infer based_on from feedback_source
      let based_on: LearningSignal['based_on']
      if (row.feedback_source === 'revenue_event') {
        based_on = score >= 0.5 ? 'revenue_outcome' : 'deal_lost'
      } else if (row.feedback_source === 'human') {
        based_on = score >= 0.5 ? 'conversion_success' : 'human_correction'
      } else {
        based_on = score >= 0.5 ? 'conversion_success' : 'deal_lost'
      }

      signals.push({
        agent_id: row.agent_id as string,
        tenant_id: row.tenant_id as string,
        signal_type,
        strength,
        context: (row.decision_summary as string | null) ?? '',
        based_on,
      })
    }

    return signals
  } catch (err) {
    console.warn('[feedback-engine] getLearningSignals unexpected error:', err)
    return []
  }
}

// ─── getAgentPerformanceSummary ───────────────────────────────────────────────

/**
 * Queries ai_feedback and computes performance metrics for a single agent.
 * Trend compares last 7 days avg success_score vs prior 7 days avg.
 */
export async function getAgentPerformanceSummary(
  agentId: string,
  tenantId: string,
): Promise<{
  agentId: string
  avgSuccessScore: number
  totalDecisions: number
  positiveRate: number
  negativeRate: number
  totalRevenueAttributed: number
  trend: 'improving' | 'stable' | 'declining'
}> {
  const empty = {
    agentId,
    avgSuccessScore: 0,
    totalDecisions: 0,
    positiveRate: 0,
    negativeRate: 0,
    totalRevenueAttributed: 0,
    trend: 'stable' as const,
  }

  if (!isEnabled()) return empty

  const client = getClient()
  if (!client) {
    console.warn('[feedback-engine] Supabase not configured — skipping getAgentPerformanceSummary')
    return empty
  }

  try {
    const now = Date.now()
    const last7Start = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()
    const prior14Start = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString()

    // Fetch all rows in the last 14 days
    const { data, error } = await client
      .from('ai_feedback')
      .select('success_score, revenue_outcome, created_at')
      .eq('agent_id', agentId)
      .eq('tenant_id', tenantId)
      .gte('created_at', prior14Start)
      .order('created_at', { ascending: false })
      .limit(1000)

    if (error) {
      console.warn('[feedback-engine] getAgentPerformanceSummary query error:', error.message)
      return empty
    }

    const rows = (data ?? []) as Array<{
      success_score: number | null
      revenue_outcome: number | null
      created_at: string
    }>

    if (rows.length === 0) return empty

    const scoredRows = rows.filter((r) => r.success_score !== null)

    const totalDecisions = rows.length
    const totalRevenueAttributed = rows.reduce(
      (sum, r) => sum + (r.revenue_outcome ?? 0),
      0,
    )

    const scores = scoredRows.map((r) => r.success_score as number)
    const avgSuccessScore =
      scores.length > 0
        ? scores.reduce((s, v) => s + v, 0) / scores.length
        : 0

    const positiveCount = scores.filter((s) => s >= 0.8).length
    const negativeCount = scores.filter((s) => s <= 0.3).length

    const positiveRate = scores.length > 0 ? positiveCount / scores.length : 0
    const negativeRate = scores.length > 0 ? negativeCount / scores.length : 0

    // Trend: compare last 7 days avg vs prior 7 days avg
    const last7Scores = scoredRows
      .filter((r) => r.created_at >= last7Start)
      .map((r) => r.success_score as number)

    const prior7Scores = scoredRows
      .filter((r) => r.created_at >= prior14Start && r.created_at < last7Start)
      .map((r) => r.success_score as number)

    const last7Avg =
      last7Scores.length > 0
        ? last7Scores.reduce((s, v) => s + v, 0) / last7Scores.length
        : 0

    const prior7Avg =
      prior7Scores.length > 0
        ? prior7Scores.reduce((s, v) => s + v, 0) / prior7Scores.length
        : 0

    let trend: 'improving' | 'stable' | 'declining' = 'stable'
    if (prior7Scores.length > 0 && last7Scores.length > 0) {
      const delta = last7Avg - prior7Avg
      if (delta > 0.05) trend = 'improving'
      else if (delta < -0.05) trend = 'declining'
    }

    return {
      agentId,
      avgSuccessScore,
      totalDecisions,
      positiveRate,
      negativeRate,
      totalRevenueAttributed,
      trend,
    }
  } catch (err) {
    console.warn('[feedback-engine] getAgentPerformanceSummary unexpected error:', err)
    return empty
  }
}
