// =============================================================================
// Agency Group — Cost Model Engine
// lib/billing/costModelEngine.ts
//
// Computes accurate per-request, per-flow, per-tenant cost breakdowns.
// Tracks: AI cost, infra cost, storage cost, compute cost.
// Enables cost-to-revenue ratio and margin analysis per tenant.
//
// DDL (run once in Supabase):
// -- CREATE TABLE cost_model_snapshots (
// --   id uuid primary key default gen_random_uuid(),
// --   tenant_id text not null,
// --   period_start timestamptz not null,
// --   period_end timestamptz not null,
// --   ai_cost_eur numeric not null default 0,
// --   infra_cost_eur numeric not null default 0,
// --   storage_cost_eur numeric not null default 0,
// --   total_cost_eur numeric not null default 0,
// --   revenue_eur numeric not null default 0,
// --   margin_pct numeric,
// --   breakdown jsonb,
// --   computed_at timestamptz not null default now()
// -- );
// -- CREATE INDEX idx_cost_model_tenant ON cost_model_snapshots(tenant_id, period_start DESC);
//
// TypeScript strict — 0 errors
// =============================================================================

import { createClient } from '@supabase/supabase-js'

// ─── Cost rates (EUR per unit, 2026 pricing) ─────────────────────────────────

const AI_RATES = {
  'claude-haiku-4-5':  { input: 0.00000023,  output: 0.00000115  },  // €0.23/€1.15 per 1M
  'claude-opus-4-6':   { input: 0.0000138,   output: 0.0000690   },  // €13.8/€69 per 1M
  'gpt-4o':            { input: 0.0000046,   output: 0.0000138   },
  'text-embedding-3-small': { input: 0.000000018, output: 0.0 },
  'whisper':           { input: 0.0000054,   output: 0.0 },          // per token equiv
  default:             { input: 0.0000046,   output: 0.0000138 },
} as const

type AIModelKey = keyof typeof AI_RATES

const INFRA_RATES = {
  api_call:            0.0000010,    // €0.001/1K calls
  whatsapp_message:    0.0046,       // €0.0046/msg (Meta pricing)
  email_sent:          0.000092,     // €0.0001/email (Resend)
  automation_run:      0.00092,      // n8n cloud per execution
  deal_pack_generated: 0.018,        // compute + storage
  push_notification:   0.000046,     // VAPID
}

const STORAGE_RATES = {
  per_gb_month:        0.023,        // Supabase storage €0.023/GB/mo
  per_embedding:       0.0000001,    // pgvector row
  per_event:           0.0000002,    // event_history row
  per_audit_log_row:   0.0000001,
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RequestCost {
  model?:          string
  input_tokens?:   number
  output_tokens?:  number
  ai_cost_eur:     number
  infra_cost_eur:  number
  total_cost_eur:  number
  revenue_impact?: number
  margin_pct?:     number
}

export interface TenantCostBreakdown {
  tenant_id:          string
  period_start:       string
  period_end:         string
  // AI costs
  ai_tokens_input:    number
  ai_tokens_output:   number
  ai_cost_eur:        number
  // Infra costs
  api_calls:          number
  whatsapp_messages:  number
  emails_sent:        number
  automation_runs:    number
  infra_cost_eur:     number
  // Storage (estimated)
  estimated_events:   number
  storage_cost_eur:   number
  // Totals
  total_cost_eur:     number
  // Revenue (from causal_trace)
  revenue_eur:        number
  margin_pct:         number | null
  // Per-unit economics
  cost_per_deal:      number | null
  cost_per_contact:   number | null
}

// ─── Client ───────────────────────────────────────────────────────────────────

function getDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase env vars missing')
  return createClient(url, key)
}

// ─── Per-request cost ─────────────────────────────────────────────────────────

export function computeRequestCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  revenueImpact?: number,
): RequestCost {
  const rates = AI_RATES[model as AIModelKey] ?? AI_RATES.default
  const aiCost  = inputTokens  * rates.input + outputTokens * rates.output
  const infrCost = INFRA_RATES.api_call
  const total    = aiCost + infrCost

  return {
    model,
    input_tokens:  inputTokens,
    output_tokens: outputTokens,
    ai_cost_eur:   Math.round(aiCost   * 1_000_000) / 1_000_000,
    infra_cost_eur: Math.round(infrCost * 1_000_000) / 1_000_000,
    total_cost_eur: Math.round(total   * 1_000_000) / 1_000_000,
    revenue_impact: revenueImpact,
    margin_pct:     revenueImpact ? Math.round(((revenueImpact - total) / revenueImpact) * 100 * 100) / 100 : undefined,
  }
}

// ─── Full tenant breakdown ────────────────────────────────────────────────────

export async function computeTenantCostBreakdown(
  tenantId: string,
  periodStart?: string,
  periodEnd?: string,
): Promise<TenantCostBreakdown> {
  const now   = new Date()
  const start = periodStart ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const end   = periodEnd   ?? now.toISOString()

  const db = getDb()

  // Fetch usage events in parallel with revenue data
  const [usageRes, revenueRes] = await Promise.allSettled([
    db.from('usage_events')
      .select('event_type, quantity')
      .eq('tenant_id', tenantId)
      .gte('billed_at', start)
      .lte('billed_at', end),
    db.from('causal_trace')
      .select('revenue_delta')
      .eq('tenant_id', tenantId)
      .not('revenue_delta', 'is', null)
      .gte('created_at', start)
      .lte('created_at', end),
  ])

  const usage = usageRes.status === 'fulfilled' ? (usageRes.value.data ?? []) : []
  const revenue = revenueRes.status === 'fulfilled' ? (revenueRes.value.data ?? []) : []

  // Aggregate usage
  let aiTokensIn = 0, aiTokensOut = 0, apiCalls = 0
  let whatsapp = 0, emails = 0, automations = 0, dealPacks = 0
  let estimatedEvents = 0

  for (const row of usage as { event_type: string; quantity: number }[]) {
    const q = row.quantity ?? 1
    switch (row.event_type) {
      case 'ai_token_input':  aiTokensIn  += q; break
      case 'ai_token_output': aiTokensOut += q; break
      case 'api_call':        apiCalls    += q; break
      case 'whatsapp_message_sent': whatsapp += q; break
      case 'email_sent':      emails      += q; break
      case 'automation_run':  automations += q; break
      case 'deal_pack_generated': dealPacks += q; break
    }
    estimatedEvents += q
  }

  const defaultRates = AI_RATES.default
  const aiCostEur    = aiTokensIn  * defaultRates.input +
                       aiTokensOut * defaultRates.output

  const infraCostEur = apiCalls    * INFRA_RATES.api_call +
                       whatsapp    * INFRA_RATES.whatsapp_message +
                       emails      * INFRA_RATES.email_sent +
                       automations * INFRA_RATES.automation_run +
                       dealPacks   * INFRA_RATES.deal_pack_generated

  const storageCostEur = estimatedEvents * STORAGE_RATES.per_event

  const totalCostEur = aiCostEur + infraCostEur + storageCostEur

  const revenueEur = (revenue as { revenue_delta: number }[])
    .reduce((s, r) => s + (r.revenue_delta > 0 ? r.revenue_delta : 0), 0)

  const marginPct = revenueEur > 0
    ? Math.round(((revenueEur - totalCostEur) / revenueEur) * 10000) / 100
    : null

  const breakdown: TenantCostBreakdown = {
    tenant_id:         tenantId,
    period_start:      start,
    period_end:        end,
    ai_tokens_input:   aiTokensIn,
    ai_tokens_output:  aiTokensOut,
    ai_cost_eur:       Math.round(aiCostEur    * 100) / 100,
    api_calls:         apiCalls,
    whatsapp_messages: whatsapp,
    emails_sent:       emails,
    automation_runs:   automations,
    infra_cost_eur:    Math.round(infraCostEur  * 100) / 100,
    estimated_events:  estimatedEvents,
    storage_cost_eur:  Math.round(storageCostEur * 100) / 100,
    total_cost_eur:    Math.round(totalCostEur   * 100) / 100,
    revenue_eur:       Math.round(revenueEur     * 100) / 100,
    margin_pct:        marginPct,
    cost_per_deal:     dealPacks > 0 ? Math.round((totalCostEur / dealPacks) * 100) / 100 : null,
    cost_per_contact:  null, // populated separately if needed
  }

  // Persist snapshot (fire-and-forget)
  void db.from('cost_model_snapshots').insert({
    tenant_id:      tenantId,
    period_start:   start,
    period_end:     end,
    ai_cost_eur:    breakdown.ai_cost_eur,
    infra_cost_eur: breakdown.infra_cost_eur,
    storage_cost_eur: breakdown.storage_cost_eur,
    total_cost_eur: breakdown.total_cost_eur,
    revenue_eur:    breakdown.revenue_eur,
    margin_pct:     breakdown.margin_pct,
    breakdown:      breakdown as unknown as Record<string, unknown>,
  }).then(({ error }) => {
    if (error) console.warn('[CostModel] snapshot error:', error.message)
  })

  return breakdown
}

// Upgrade trigger detection — call when quota check runs
export function detectUpgradeTrigger(breakdown: TenantCostBreakdown, currentPlan: string): {
  should_upgrade: boolean
  reason: string | null
  recommended_plan: string | null
} {
  if (currentPlan === 'unlimited' || currentPlan === 'enterprise') {
    return { should_upgrade: false, reason: null, recommended_plan: null }
  }

  const aiM = breakdown.ai_tokens_input + breakdown.ai_tokens_output
  if (currentPlan === 'starter' && aiM > 400_000) {
    return { should_upgrade: true, reason: `AI usage ${(aiM/1000).toFixed(0)}K tokens (limit 500K)`, recommended_plan: 'growth' }
  }
  if (currentPlan === 'growth' && aiM > 1_600_000) {
    return { should_upgrade: true, reason: `AI usage ${(aiM/1_000_000).toFixed(1)}M tokens (limit 2M)`, recommended_plan: 'enterprise' }
  }

  return { should_upgrade: false, reason: null, recommended_plan: null }
}

// ─── Tenant Economics Governor ─────────────────────────────────────────────────

/**
 * Required output format per the Principle of Truth spec.
 * "Every tenant must have: cost_per_day, cost_per_request, revenue_per_request,
 *  margin, efficiency_score"
 *
 * efficiency_score: 0–100. Composite of margin health + cost trajectory.
 *   100 = revenue >> cost (ultra-efficient)
 *     0 = cost >> revenue (critical inefficiency)
 */
export interface TenantEconomics {
  tenant_id:           string
  period_days:         number
  cost_per_day:        number      // EUR — total cost / period_days
  cost_per_request:    number      // EUR — total cost / api_calls (or 1 if no requests)
  revenue_per_request: number      // EUR — revenue / api_calls (or 0 if no requests)
  margin:              number      // pct 0–100 (or negative for loss)
  efficiency_score:    number      // 0–100 composite score
  /** Fraction of total cost attributable to AI (0–1). High = model-routing pressure. */
  ai_load:             number
  /** Fraction of total cost attributable to infra/storage (0–1). High = scaling pressure. */
  infra_load:          number
  /**
   * Composite risk score (0–100). High = financially or operationally at risk.
   * Driven by: negative margin, low efficiency, 100% AI concentration, high cost/request.
   */
  risk_score:          number
  // Raw inputs
  total_cost_eur:      number
  revenue_eur:         number
  api_calls:           number
  ai_cost_eur:         number
  infra_cost_eur:      number
  storage_cost_eur:    number
  computed_at:         string
}

export async function computeTenantEconomics(
  tenantId:     string,
  periodStart?: string,
  periodEnd?:   string,
): Promise<TenantEconomics> {
  const breakdown = await computeTenantCostBreakdown(tenantId, periodStart, periodEnd)

  const now       = new Date()
  const start     = periodStart ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const periodMs  = new Date(periodEnd ?? now.toISOString()).getTime() - new Date(start).getTime()
  const periodDays = Math.max(periodMs / 86_400_000, 1)

  const requests = Math.max(breakdown.api_calls, 1)   // avoid division by zero
  const costPerDay        = Math.round((breakdown.total_cost_eur / periodDays) * 10_000) / 10_000
  const costPerRequest    = Math.round((breakdown.total_cost_eur / requests)   * 1_000_000) / 1_000_000
  const revenuePerRequest = Math.round((breakdown.revenue_eur    / requests)   * 1_000_000) / 1_000_000
  const marginPct         = breakdown.revenue_eur > 0
    ? Math.round(((breakdown.revenue_eur - breakdown.total_cost_eur) / breakdown.revenue_eur) * 10_000) / 100
    : breakdown.total_cost_eur > 0 ? -100 : 0

  // Efficiency score: weighted composite
  //   40%  margin health (100 if margin >= 80%, scales linearly to 0 at margin <= -20%)
  //   30%  revenue existence (100 if revenue > 0, 0 if not)
  //   30%  cost-per-request health (100 if < €0.01, scales down to 0 at > €1.00)
  const marginScore       = Math.max(0, Math.min(100, ((marginPct + 20) / 100) * 100))
  const revenueScore      = breakdown.revenue_eur > 0 ? 100 : 0
  const costRequestScore  = Math.max(0, Math.min(100, (1 - Math.min(costPerRequest / 1.0, 1)) * 100))
  const efficiencyScore   = Math.round(marginScore * 0.4 + revenueScore * 0.3 + costRequestScore * 0.3)

  // ai_load / infra_load — fraction of total cost per category
  const totalForLoad    = Math.max(breakdown.total_cost_eur, 0.000001) // prevent /0
  const aiLoad          = Math.round((breakdown.ai_cost_eur / totalForLoad) * 1000) / 1000
  const infraLoad       = Math.round(((breakdown.infra_cost_eur + breakdown.storage_cost_eur) / totalForLoad) * 1000) / 1000

  // risk_score — composite 0–100 (higher = more at risk)
  // Components:
  //   30%  negative margin penalty (0 if margin >= 0, 100 if margin <= -50%)
  //   25%  low efficiency (inverted: 0 if score=100, 100 if score=0)
  //   25%  AI concentration risk (100 if ai_load >= 0.95, 0 if ai_load <= 0.50)
  //   20%  cost-per-request spike (100 if >= €0.10, 0 if <= €0.001)
  const marginRisk     = Math.max(0, Math.min(100, (-marginPct / 50) * 100))
  const efficiencyRisk = 100 - efficiencyScore
  const aiConcentrationRisk = Math.max(0, Math.min(100, ((aiLoad - 0.5) / 0.45) * 100))
  const costSpikeRisk  = Math.max(0, Math.min(100, (Math.min(costPerRequest, 0.10) / 0.10) * 100))
  const riskScore      = Math.round(
    marginRisk * 0.30 + efficiencyRisk * 0.25 + aiConcentrationRisk * 0.25 + costSpikeRisk * 0.20
  )

  return {
    tenant_id:           tenantId,
    period_days:         Math.round(periodDays * 10) / 10,
    cost_per_day:        costPerDay,
    cost_per_request:    costPerRequest,
    revenue_per_request: revenuePerRequest,
    margin:              marginPct,
    efficiency_score:    efficiencyScore,
    ai_load:             aiLoad,
    infra_load:          infraLoad,
    risk_score:          riskScore,
    total_cost_eur:      breakdown.total_cost_eur,
    revenue_eur:         breakdown.revenue_eur,
    api_calls:           breakdown.api_calls,
    ai_cost_eur:         breakdown.ai_cost_eur,
    infra_cost_eur:      breakdown.infra_cost_eur,
    storage_cost_eur:    breakdown.storage_cost_eur,
    computed_at:         now.toISOString(),
  }
}
