// =============================================================================
// Agency Group — Stripe Usage Reporter
// lib/billing/stripeReporter.ts
//
// Aggregates usage_events per tenant and formats for Stripe metered billing.
// Stripe Metered Billing: POST /v1/subscription_items/{item_id}/usage_records
//
// TypeScript strict — 0 errors
// =============================================================================

import { createClient } from '@supabase/supabase-js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TenantUsageSummary {
  tenant_id:          string
  period_start:       string   // ISO-8601
  period_end:         string
  ai_tokens_total:    number   // input + output combined
  api_calls_total:    number
  automation_runs:    number
  emails_sent:        number
  whatsapp_messages:  number
  deal_packs_gen:     number
  followups_sent:     number
  estimated_cost_eur: number   // rough estimate
}

export interface StripeUsageRecord {
  quantity:   number
  timestamp:  number   // Unix timestamp (Stripe format)
  action:     'increment' | 'set'
}

// ─── Cost rates (EUR, rough estimates) ───────────────────────────────────────

const COST_RATES: Record<string, number> = {
  ai_token_input:        0.00000025,   // €0.25/1M tokens
  ai_token_output:       0.00000125,   // €1.25/1M tokens
  api_call:              0.000001,     // €0.001/1K calls
  automation_run:        0.001,        // €0.001/run
  email_sent:            0.0001,       // €0.0001/email
  whatsapp_message_sent: 0.005,        // €0.005/message
  deal_pack_generated:   0.02,         // €0.02/pack
  followup_sent:         0.001,        // €0.001/followup
}

// ─── Client ───────────────────────────────────────────────────────────────────

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

// ─── Aggregation ─────────────────────────────────────────────────────────────

export async function aggregateTenantUsage(
  tenantId: string,
  periodStart?: string,  // ISO-8601, defaults to start of current month
  periodEnd?:   string,  // ISO-8601, defaults to now
): Promise<TenantUsageSummary> {
  const now   = new Date()
  const start = periodStart ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const end   = periodEnd   ?? now.toISOString()

  const summary: TenantUsageSummary = {
    tenant_id:         tenantId,
    period_start:      start,
    period_end:        end,
    ai_tokens_total:   0,
    api_calls_total:   0,
    automation_runs:   0,
    emails_sent:       0,
    whatsapp_messages: 0,
    deal_packs_gen:    0,
    followups_sent:    0,
    estimated_cost_eur: 0,
  }

  try {
    const db = getDb()
    const { data } = await db
      .from('usage_events')
      .select('event_type, quantity')
      .eq('tenant_id', tenantId)
      .gte('billed_at', start)
      .lte('billed_at', end)

    let cost = 0
    for (const row of (data ?? []) as { event_type: string; quantity: number }[]) {
      const qty  = row.quantity ?? 1
      const rate = COST_RATES[row.event_type] ?? 0

      switch (row.event_type) {
        case 'ai_token_input':
        case 'ai_token_output':
          summary.ai_tokens_total += qty
          break
        case 'api_call':
          summary.api_calls_total += qty
          break
        case 'automation_run':
          summary.automation_runs += qty
          break
        case 'email_sent':
          summary.emails_sent += qty
          break
        case 'whatsapp_message_sent':
          summary.whatsapp_messages += qty
          break
        case 'deal_pack_generated':
          summary.deal_packs_gen += qty
          break
        case 'followup_sent':
          summary.followups_sent += qty
          break
      }

      cost += qty * rate
    }

    summary.estimated_cost_eur = Math.round(cost * 10000) / 10000
  } catch (err) {
    console.warn('[StripeReporter] aggregation error:', err)
  }

  return summary
}

// Format for Stripe metered billing API
export function toStripeUsageRecord(quantity: number, timestamp?: number): StripeUsageRecord {
  return {
    quantity,
    timestamp: timestamp ?? Math.floor(Date.now() / 1000),
    action:    'increment',
  }
}

// Get all active tenants' usage (for billing batch run)
export async function getAllTenantsUsage(periodStart?: string, periodEnd?: string): Promise<TenantUsageSummary[]> {
  try {
    const db = getDb()
    const { data } = await db
      .from('tenants')
      .select('slug')
      .eq('status', 'active')
      .neq('plan', 'unlimited')  // unlimited tenants don't need metering

    if (!data) return []

    const summaries = await Promise.allSettled(
      (data as { slug: string }[]).map(t => aggregateTenantUsage(t.slug, periodStart, periodEnd))
    )

    return summaries
      .filter((r): r is PromiseFulfilledResult<TenantUsageSummary> => r.status === 'fulfilled')
      .map(r => r.value)
  } catch { return [] }
}
