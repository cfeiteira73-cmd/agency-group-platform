// =============================================================================
// Agency Group — AI Memory Vault (JSONL append-only logger)
// lib/vault/aiMemoryVault.ts
//
// Logs every significant AI decision to Supabase ai_feedback table AND
// optionally to a local JSONL file for offline forensics.
//
// Every AI call should call: recordAIMemory({ ... })
// This is fire-and-forget — never blocks the main flow.
//
// TypeScript strict — 0 errors
// =============================================================================

import { createClient } from '@supabase/supabase-js'

export interface AIMemoryRecord {
  correlation_id: string
  tenant_id: string
  agent_id: string
  model: string
  input_hash?: string           // SHA-256 of input (PII-safe)
  output_summary: string        // human-readable (≤500 chars, no PII)
  decision_reason?: string
  latency_ms: number
  input_tokens?: number
  output_tokens?: number
  estimated_cost_eur?: number   // rough estimate
  fallback_used: boolean
  revenue_impact?: number       // EUR delta
  metadata?: Record<string, unknown>
}

// Rough cost estimator (EUR, Anthropic pricing as of 2026)
function estimateCostEur(model: string, inputTokens = 0, outputTokens = 0): number {
  // claude-haiku-4-5: ~$0.25/$1.25 per 1M tokens (MTok)
  // claude-opus-4-6:  ~$15/$75 per 1M tokens
  const USD_TO_EUR = 0.92
  const rates: Record<string, { input: number; output: number }> = {
    'claude-haiku-4-5':    { input: 0.25,  output: 1.25  },
    'claude-haiku':        { input: 0.25,  output: 1.25  },
    'claude-opus-4-6':     { input: 15.0,  output: 75.0  },
    'claude-opus':         { input: 15.0,  output: 75.0  },
    'anthropic-haiku':     { input: 0.25,  output: 1.25  },
    'anthropic-opus':      { input: 15.0,  output: 75.0  },
  }
  const rate = rates[model] ?? { input: 3.0, output: 15.0 }
  const usd = (inputTokens / 1_000_000) * rate.input + (outputTokens / 1_000_000) * rate.output
  return Math.round(usd * USD_TO_EUR * 10000) / 10000 // round to 4 decimal places
}

// Fire-and-forget: record to Supabase ai_feedback (learning loop table)
export function recordAIMemory(record: AIMemoryRecord): void {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return

  const db = createClient(url, key)
  const estimatedCost = record.estimated_cost_eur
    ?? estimateCostEur(record.model, record.input_tokens ?? 0, record.output_tokens ?? 0)

  void db.from('ai_feedback').insert({
    correlation_id:   record.correlation_id,
    tenant_id:        record.tenant_id,
    agent_id:         record.agent_id,
    decision_summary: record.output_summary.slice(0, 500),
    feedback_source:  'system',
    metadata: {
      model:            record.model,
      input_hash:       record.input_hash,
      decision_reason:  record.decision_reason,
      latency_ms:       record.latency_ms,
      input_tokens:     record.input_tokens,
      output_tokens:    record.output_tokens,
      estimated_cost_eur: estimatedCost,
      fallback_used:    record.fallback_used,
      revenue_impact:   record.revenue_impact,
      ...record.metadata,
    },
  }).then(({ error }) => {
    if (error) console.warn('[AIMemoryVault] insert error:', error.message)
  })
}

// Retrieve recent AI memory for a given agent (for context injection)
export async function recallAIMemory(
  agentId: string,
  tenantId: string,
  limit = 10,
): Promise<AIMemoryRecord[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return []

  try {
    const db = createClient(url, key)
    const { data, error } = await db
      .from('ai_feedback')
      .select('*')
      .eq('agent_id', agentId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []

    return (data as Record<string, unknown>[]).map(row => ({
      correlation_id:   String(row['correlation_id'] ?? ''),
      tenant_id:        String(row['tenant_id'] ?? tenantId),
      agent_id:         String(row['agent_id'] ?? agentId),
      model:            String((row['metadata'] as Record<string, unknown> | null)?.['model'] ?? ''),
      output_summary:   String(row['decision_summary'] ?? ''),
      latency_ms:       Number((row['metadata'] as Record<string, unknown> | null)?.['latency_ms'] ?? 0),
      fallback_used:    Boolean((row['metadata'] as Record<string, unknown> | null)?.['fallback_used'] ?? false),
      revenue_impact:   typeof row['revenue_outcome'] === 'number' ? row['revenue_outcome'] : undefined,
    }))
  } catch { return [] }
}

// Monthly cost summary per agent
export async function getAgentCostSummary(
  tenantId: string,
  monthISO?: string,  // YYYY-MM — defaults to current month
): Promise<{ agent_id: string; total_cost_eur: number; call_count: number }[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return []

  const month = monthISO ?? new Date().toISOString().slice(0, 7)
  const from = `${month}-01T00:00:00.000Z`
  const to   = `${month}-31T23:59:59.999Z`

  try {
    const db = createClient(url, key)
    const { data } = await db
      .from('ai_feedback')
      .select('agent_id, metadata')
      .eq('tenant_id', tenantId)
      .gte('created_at', from)
      .lte('created_at', to)

    if (!data) return []

    const summary = new Map<string, { total: number; count: number }>()
    for (const row of data as { agent_id: string; metadata: Record<string, unknown> | null }[]) {
      const cost = Number(row.metadata?.['estimated_cost_eur'] ?? 0)
      const existing = summary.get(row.agent_id) ?? { total: 0, count: 0 }
      summary.set(row.agent_id, { total: existing.total + cost, count: existing.count + 1 })
    }

    return Array.from(summary.entries()).map(([agent_id, { total, count }]) => ({
      agent_id,
      total_cost_eur: Math.round(total * 10000) / 10000,
      call_count: count,
    })).sort((a, b) => b.total_cost_eur - a.total_cost_eur)
  } catch { return [] }
}
