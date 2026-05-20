// =============================================================================
// Agency Group — Usage Metering Engine
// lib/billing/usageMeter.ts
// Records billable events per tenant. Stripe metered billing ready.
// Writes to Supabase usage_events table (fire-and-forget).
// TypeScript strict — 0 errors
// =============================================================================
//
// DDL (run once in Supabase):
//
// -- CREATE TABLE usage_events (
// --   id uuid primary key default gen_random_uuid(),
// --   tenant_id text not null,
// --   event_type text not null,
// --   quantity int not null default 1,
// --   correlation_id text,
// --   agent_id text,
// --   metadata jsonb,
// --   billed_at timestamptz not null default now()
// -- );
// -- CREATE INDEX idx_usage_tenant_month ON usage_events(tenant_id, billed_at DESC);
//
// =============================================================================

import { createClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MeterEvent =
  | 'ai_token_input'        | 'ai_token_output'
  | 'api_call'              | 'automation_run'   | 'replay_operation'
  | 'crm_contact_created'   | 'whatsapp_message_sent' | 'email_sent'
  | 'deal_pack_generated'   | 'followup_sent'

export interface UsageRecord {
  tenant_id:       string
  event_type:      MeterEvent
  quantity:        number
  correlation_id?: string
  agent_id?:       string
  metadata?:       Record<string, unknown>
  billed_at:       string
}

// ---------------------------------------------------------------------------
// Supabase admin client (same pattern as ai-audit.ts)
// ---------------------------------------------------------------------------

function getMeterClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
           ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// ---------------------------------------------------------------------------
// recordUsage — fire-and-forget
// ---------------------------------------------------------------------------

/**
 * Records a billable usage event for a tenant.
 *
 * - Returns immediately; the Supabase insert runs in the background.
 * - Never throws; logs a console.warn on failure.
 * - Skipped entirely unless `USAGE_METERING_ENABLED=true`.
 */
export function recordUsage(record: Omit<UsageRecord, 'billed_at'>): void {
  if (process.env.USAGE_METERING_ENABLED !== 'true') return

  const client = getMeterClient()
  if (!client) {
    console.warn('[usageMeter] Supabase not configured — skipping usage record')
    return
  }

  const row: UsageRecord = {
    ...record,
    billed_at: new Date().toISOString(),
  }

  // Fire-and-forget — no await
  void client
    .from('usage_events')
    .insert({
      tenant_id:      row.tenant_id,
      event_type:     row.event_type,
      quantity:       row.quantity,
      correlation_id: row.correlation_id ?? null,
      agent_id:       row.agent_id ?? null,
      metadata:       row.metadata ?? null,
      billed_at:      row.billed_at,
    })
    .then(({ error }: { error: { message: string } | null }) => {
      if (error) {
        console.warn('[usageMeter] Insert failed:', error.message)
      }
    })
}

// ---------------------------------------------------------------------------
// getUsageSummary
// ---------------------------------------------------------------------------

const METER_EVENTS: MeterEvent[] = [
  'ai_token_input', 'ai_token_output',
  'api_call', 'automation_run', 'replay_operation',
  'crm_contact_created', 'whatsapp_message_sent', 'email_sent',
  'deal_pack_generated', 'followup_sent',
]

// Cost constants
const TOKEN_COST_EUR    = 0.000015
const API_CALL_COST_EUR = 0.0001

/**
 * Returns an aggregated usage summary for a tenant in a given month.
 * Month defaults to the current YYYY-MM.
 */
export async function getUsageSummary(
  tenantId: string,
  month?: string,
): Promise<{
  tenant_id: string
  month: string
  by_event: Record<MeterEvent, number>
  total_ai_tokens: number
  total_api_calls: number
  estimated_cost_eur: number
}> {
  const targetMonth = month ?? (() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })()

  // Initialize with zeroes
  const by_event = Object.fromEntries(
    METER_EVENTS.map(e => [e, 0]),
  ) as Record<MeterEvent, number>

  const fallback = {
    tenant_id:          tenantId,
    month:              targetMonth,
    by_event,
    total_ai_tokens:    0,
    total_api_calls:    0,
    estimated_cost_eur: 0,
  }

  try {
    const client = getMeterClient()
    if (!client) return fallback

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (client as any)
      .from('usage_events')
      .select('event_type, quantity')
      .eq('tenant_id', tenantId)
      .like('billed_at', `${targetMonth}%`)

    if (error) {
      console.warn('[usageMeter] getUsageSummary query failed:', error.message)
      return fallback
    }

    type Row = { event_type: string; quantity: number }
    const rows = (data ?? []) as Row[]

    for (const row of rows) {
      const ev = row.event_type as MeterEvent
      if (ev in by_event) {
        by_event[ev] = (by_event[ev] ?? 0) + (row.quantity ?? 0)
      }
    }

    const total_ai_tokens =
      (by_event['ai_token_input'] ?? 0) + (by_event['ai_token_output'] ?? 0)

    const total_api_calls = by_event['api_call'] ?? 0

    const estimated_cost_eur =
      total_ai_tokens * TOKEN_COST_EUR +
      total_api_calls * API_CALL_COST_EUR

    return {
      tenant_id: tenantId,
      month:     targetMonth,
      by_event,
      total_ai_tokens,
      total_api_calls,
      estimated_cost_eur: Math.round(estimated_cost_eur * 10_000) / 10_000,
    }
  } catch (err) {
    console.warn('[usageMeter] getUsageSummary error:', err instanceof Error ? err.message : String(err))
    return fallback
  }
}
