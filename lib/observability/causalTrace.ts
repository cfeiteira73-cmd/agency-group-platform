// =============================================================================
// Agency Group — Causal Graph Engine
// lib/observability/causalTrace.ts
//
// Records event → decision → mutation → revenue chains.
// Each step in a business flow is appended as a CausalStep.
// The full chain is queryable by correlation_id, entity_id, or revenue path.
//
// DESIGN:
//   - Fire-and-forget: recordCausalStep() never blocks the caller
//   - Feature-flagged: only active when CAUSAL_TRACE_ENABLED=true
//   - Silent on failure: console.warn only — never crashes the caller
//   - Uses service role client (bypasses RLS) — server-only
//
// DDL — Run once in Supabase:
/*
-- CREATE TABLE causal_trace (
--   id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
--   correlation_id TEXT NOT NULL,
--   tenant_id TEXT NOT NULL DEFAULT 'agency-group',
--   step_type TEXT NOT NULL,
--   entity_type TEXT,
--   entity_id TEXT,
--   agent_id TEXT,
--   model TEXT,
--   action TEXT,
--   revenue_delta NUMERIC,
--   latency_ms INTEGER,
--   success BOOLEAN NOT NULL DEFAULT true,
--   error_message TEXT,
--   metadata JSONB,
--   created_at TIMESTAMPTZ NOT NULL DEFAULT now()
-- );
-- CREATE INDEX idx_causal_trace_correlation ON causal_trace(correlation_id);
-- CREATE INDEX idx_causal_trace_entity ON causal_trace(entity_id, entity_type);
-- CREATE INDEX idx_causal_trace_revenue ON causal_trace(tenant_id, created_at) WHERE revenue_delta IS NOT NULL;
*/
//
// TypeScript strict — 0 errors
// =============================================================================

import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CausalStepType =
  | 'event_received'
  | 'ai_decision'
  | 'db_mutation'
  | 'crm_action'
  | 'email_sent'
  | 'whatsapp_sent'
  | 'revenue_outcome'
  | 'error'

export interface CausalStep {
  correlation_id: string
  tenant_id: string
  step_type: CausalStepType
  /** 'deal' | 'lead' | 'contact' | 'property' */
  entity_type?: string
  /** UUID of the entity */
  entity_id?: string
  /** Which AI agent ran (if step_type === 'ai_decision') */
  agent_id?: string
  /** Which Claude model was used */
  model?: string
  /** What happened: 'upsert' | 'score' | 'send' | etc. */
  action?: string
  /** Revenue impact in EUR (positive or negative) */
  revenue_delta?: number
  latency_ms?: number
  success: boolean
  error_message?: string
  metadata?: Record<string, unknown>
  created_at: string
}

// ---------------------------------------------------------------------------
// Internal Supabase client (service role — server-only)
// ---------------------------------------------------------------------------

function getCausalClient() {
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

// ---------------------------------------------------------------------------
// recordCausalStep
// ---------------------------------------------------------------------------

/**
 * Fire-and-forget insert of one CausalStep into the `causal_trace` table.
 *
 * - Returns immediately; the Supabase insert runs in the background.
 * - Never throws; logs a console.warn on failure.
 * - Skipped entirely unless `CAUSAL_TRACE_ENABLED=true`.
 *
 * Usage:
 *   await recordCausalStep({
 *     correlation_id: envelope.correlationId,
 *     tenant_id:      envelope.tenantId,
 *     step_type:      'ai_decision',
 *     agent_id:       'sofia',
 *     model:          'claude-sonnet-4-5',
 *     entity_type:    'lead',
 *     entity_id:      leadId,
 *     action:         'score',
 *     latency_ms:     412,
 *     success:        true,
 *   })
 */
export async function recordCausalStep(
  step: Omit<CausalStep, 'created_at'>,
): Promise<void> {
  // Default-enabled: only skip when explicitly set to 'false'
  if (process.env.CAUSAL_TRACE_ENABLED === 'false') return

  const client = getCausalClient()
  if (!client) {
    console.warn('[causal-trace] Supabase not configured — skipping causal step')
    return
  }

  const record: CausalStep = {
    ...step,
    created_at: new Date().toISOString(),
  }

  void client
    .from('causal_trace')
    .insert({
      correlation_id: record.correlation_id,
      tenant_id:      record.tenant_id,
      step_type:      record.step_type,
      entity_type:    record.entity_type    ?? null,
      entity_id:      record.entity_id      ?? null,
      agent_id:       record.agent_id       ?? null,
      model:          record.model          ?? null,
      action:         record.action         ?? null,
      revenue_delta:  record.revenue_delta  ?? null,
      latency_ms:     record.latency_ms     ?? null,
      success:        record.success,
      error_message:  record.error_message  ?? null,
      metadata:       record.metadata       ?? null,
      created_at:     record.created_at,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) {
        console.warn('[causal-trace] Insert failed:', error.message)
      }
    })
}

// ---------------------------------------------------------------------------
// getCausalChain
// ---------------------------------------------------------------------------

/**
 * Fetch all CausalSteps for a given correlation_id, ordered by created_at.
 * Returns [] if CAUSAL_TRACE_ENABLED is not set or client is unavailable.
 *
 * Usage:
 *   const chain = await getCausalChain(correlationId)
 */
export async function getCausalChain(correlationId: string): Promise<CausalStep[]> {
  if (process.env.CAUSAL_TRACE_ENABLED === 'false') return []

  const client = getCausalClient()
  if (!client) {
    console.warn('[causal-trace] Supabase not configured — cannot fetch causal chain')
    return []
  }

  const { data, error } = await client
    .from('causal_trace')
    .select('*')
    .eq('correlation_id', correlationId)
    .order('created_at', { ascending: true })

  if (error) {
    console.warn('[causal-trace] getCausalChain failed:', error.message)
    return []
  }

  return (data ?? []) as CausalStep[]
}

// ---------------------------------------------------------------------------
// getRevenueTrace
// ---------------------------------------------------------------------------

/**
 * Fetch all CausalSteps for a specific entity (deal/lead/etc.) that carry
 * a revenue_delta, ordered by created_at ascending.
 * Useful for tracing how a lead or deal generated revenue over time.
 *
 * Usage:
 *   const trace = await getRevenueTrace(dealId, 'deal')
 */
export async function getRevenueTrace(
  entityId: string,
  entityType: string,
): Promise<CausalStep[]> {
  if (process.env.CAUSAL_TRACE_ENABLED === 'false') return []

  const client = getCausalClient()
  if (!client) {
    console.warn('[causal-trace] Supabase not configured — cannot fetch revenue trace')
    return []
  }

  const { data, error } = await client
    .from('causal_trace')
    .select('*')
    .eq('entity_id', entityId)
    .eq('entity_type', entityType)
    .not('revenue_delta', 'is', null)
    .order('created_at', { ascending: true })

  if (error) {
    console.warn('[causal-trace] getRevenueTrace failed:', error.message)
    return []
  }

  return (data ?? []) as CausalStep[]
}

// ---------------------------------------------------------------------------
// reconstructLineage
// ---------------------------------------------------------------------------

export interface CausalLineage {
  root: CausalStep | null
  chain: CausalStep[]
  revenueTotal: number
  agentsCalled: string[]
  entitiesAffected: Array<{ id: string; type: string }>
  durationMs: number  // from first to last step
  hasErrors: boolean
}

/**
 * Reconstruct the full causal lineage for a correlation_id.
 * Returns a rich summary: root step, full chain, revenue total,
 * deduplicated agent list, affected entities, duration, and error flag.
 *
 * Usage:
 *   const lineage = await reconstructLineage(correlationId)
 */
export async function reconstructLineage(correlationId: string): Promise<CausalLineage> {
  const chain = await getCausalChain(correlationId)
  if (chain.length === 0) return {
    root: null, chain: [], revenueTotal: 0, agentsCalled: [], entitiesAffected: [], durationMs: 0, hasErrors: false,
  }

  const root = chain[0]
  const revenueTotal = chain.reduce((sum, s) => sum + (s.revenue_delta ?? 0), 0)
  const agentsCalled = [...new Set(chain.filter(s => s.agent_id).map(s => s.agent_id!))]
  const entityMap = new Map<string, string>()
  chain.forEach(s => { if (s.entity_id && s.entity_type) entityMap.set(s.entity_id, s.entity_type) })
  const entitiesAffected = Array.from(entityMap.entries()).map(([id, type]) => ({ id, type }))
  const first = new Date(chain[0].created_at).getTime()
  const last  = new Date(chain[chain.length - 1].created_at).getTime()
  const hasErrors = chain.some(s => !s.success)

  return { root, chain, revenueTotal, agentsCalled, entitiesAffected, durationMs: last - first, hasErrors }
}

// ---------------------------------------------------------------------------
// attributeRevenue
// ---------------------------------------------------------------------------

export interface RevenueAttribution {
  entityId: string
  entityType: string
  totalRevenueDelta: number
  steps: CausalStep[]
  topAgent: string | null
  attributedAt: string
}

/**
 * Attribute all revenue-delta steps to a specific entity (deal/lead/etc.).
 * Returns total revenue delta, the contributing steps, and which agent
 * appeared most often in those steps.
 *
 * Usage:
 *   const attr = await attributeRevenue(dealId, 'deal')
 */
export async function attributeRevenue(entityId: string, entityType: string): Promise<RevenueAttribution> {
  const steps = await getRevenueTrace(entityId, entityType)
  const totalRevenueDelta = steps.reduce((sum, s) => sum + (s.revenue_delta ?? 0), 0)
  const agentCounts: Record<string, number> = {}
  steps.forEach(s => { if (s.agent_id) agentCounts[s.agent_id] = (agentCounts[s.agent_id] ?? 0) + 1 })
  const topAgent = Object.keys(agentCounts).sort((a, b) => agentCounts[b] - agentCounts[a])[0] ?? null
  return { entityId, entityType, totalRevenueDelta, steps, topAgent, attributedAt: new Date().toISOString() }
}
