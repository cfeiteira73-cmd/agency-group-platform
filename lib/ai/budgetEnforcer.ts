// =============================================================================
// Agency Group — AI Budget Enforcer
// lib/ai/budgetEnforcer.ts
//
// Per-tenant AI spend limits backed by Supabase.
// Tables: ai_budgets (limits), ai_usage_log (audit trail).
//
// checkBudget  — pre-flight gate: blocks call if tenant over daily/monthly limit
// recordSpend  — post-call audit insert (fire-and-forget safe)
// getBudgetStatus — summary for dashboards / control tower
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TenantBudget {
  tenant_id: string
  daily_limit_usd: number
  monthly_limit_usd: number
  current_daily_spend_usd: number
  current_monthly_spend_usd: number
  is_over_daily_limit: boolean
  is_over_monthly_limit: boolean
  /** If true, ALL AI calls are blocked regardless of spend */
  hard_block: boolean
}

// Shape of a row in ai_budgets (only what we need)
interface BudgetRow {
  tenant_id: string
  daily_limit_usd: number
  monthly_limit_usd: number
  hard_block: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** ISO date string for today: YYYY-MM-DD */
function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

/** ISO month-start string for this month: YYYY-MM-01T00:00:00.000Z */
function monthStartStr(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01T00:00:00.000Z`
}

/** Fetch or default budget row for a tenant */
async function fetchBudgetRow(tenantId: string): Promise<BudgetRow> {
  const { data, error } = await (supabaseAdmin as any)
    .from('ai_budgets')
    .select('tenant_id, daily_limit_usd, monthly_limit_usd, hard_block')
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) {
    log.warn('[budgetEnforcer] Failed to fetch ai_budgets row — using defaults', {
      correlation_id: null,
      route: 'budgetEnforcer.fetchBudgetRow',
      tenant_id: tenantId,
      error: error.message,
    })
  }

  if (data) return data as BudgetRow

  // Default limits when no row exists
  return {
    tenant_id:         tenantId,
    daily_limit_usd:   50.00,
    monthly_limit_usd: 500.00,
    hard_block:        false,
  }
}

/** Sum total_cost_usd from ai_usage_log for a given tenant + time window */
async function sumSpend(tenantId: string, fromIso: string): Promise<number> {
  const { data, error } = await (supabaseAdmin as any)
    .from('ai_usage_log')
    .select('total_cost_usd')
    .eq('tenant_id', tenantId)
    .eq('success', true)
    .gte('called_at', fromIso)

  if (error) {
    log.warn('[budgetEnforcer] Failed to sum ai_usage_log spend', {
      correlation_id: null,
      route: 'budgetEnforcer.sumSpend',
      tenant_id: tenantId,
      error: error.message,
    })
    return 0
  }

  if (!Array.isArray(data)) return 0

  return (data as Array<{ total_cost_usd: number | string }>).reduce(
    (acc, row) => acc + Number(row.total_cost_usd ?? 0),
    0,
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Pre-flight budget check.
 * Returns { allowed: false } if tenant is over budget or hard-blocked.
 * Fail-open: if Supabase is unavailable the call is allowed (prefer availability
 * over blocking legitimate traffic on infra failure).
 */
export async function checkBudget(
  tenantId: string,
  estimatedCostUsd: number,
): Promise<{ allowed: boolean; reason?: string; budget?: TenantBudget }> {
  if (!tenantId) {
    return { allowed: false, reason: 'tenant_id_required' }
  }

  let budgetRow: BudgetRow
  let dailySpend = 0
  let monthlySpend = 0

  try {
    ;[budgetRow, dailySpend, monthlySpend] = await Promise.all([
      fetchBudgetRow(tenantId),
      sumSpend(tenantId, `${todayStr()}T00:00:00.000Z`),
      sumSpend(tenantId, monthStartStr()),
    ])
  } catch (err) {
    // Fail-open: infra error should not block AI calls
    log.error('[budgetEnforcer] checkBudget infra error — failing open', err, {
      correlation_id: null,
      route: 'budgetEnforcer.checkBudget',
      tenant_id: tenantId,
    })
    return { allowed: true, reason: 'budget_check_unavailable' }
  }

  const budget: TenantBudget = {
    tenant_id:                budgetRow.tenant_id,
    daily_limit_usd:          budgetRow.daily_limit_usd,
    monthly_limit_usd:        budgetRow.monthly_limit_usd,
    current_daily_spend_usd:  dailySpend,
    current_monthly_spend_usd: monthlySpend,
    is_over_daily_limit:      dailySpend >= budgetRow.daily_limit_usd,
    is_over_monthly_limit:    monthlySpend >= budgetRow.monthly_limit_usd,
    hard_block:               budgetRow.hard_block,
  }

  if (budget.hard_block) {
    return { allowed: false, reason: 'hard_block', budget }
  }

  if (dailySpend + estimatedCostUsd > budgetRow.daily_limit_usd) {
    return { allowed: false, reason: 'daily_budget_exceeded', budget }
  }

  if (monthlySpend + estimatedCostUsd > budgetRow.monthly_limit_usd) {
    return { allowed: false, reason: 'monthly_budget_exceeded', budget }
  }

  return { allowed: true, budget }
}

/**
 * Record actual spend after a call completes.
 * Inserts a row into ai_usage_log.
 * Fire-and-forget safe — never throws; errors are logged only.
 */
export async function recordSpend(
  tenantId: string,
  actualCostUsd: number,
  model: string,
  feature: string,
  extras?: {
    input_tokens?: number
    output_tokens?: number
    latency_ms?: number
    success?: boolean
    error_message?: string
    correlation_id?: string
  },
): Promise<void> {
  try {
    const { error } = await (supabaseAdmin as any)
      .from('ai_usage_log')
      .insert({
        tenant_id:      tenantId,
        feature,
        model,
        input_tokens:   extras?.input_tokens   ?? 0,
        output_tokens:  extras?.output_tokens  ?? 0,
        total_cost_usd: actualCostUsd,
        latency_ms:     extras?.latency_ms     ?? null,
        success:        extras?.success        ?? true,
        error_message:  extras?.error_message  ?? null,
        correlation_id: extras?.correlation_id ?? null,
      })

    if (error) {
      log.warn('[budgetEnforcer] Failed to insert ai_usage_log row', {
        correlation_id: extras?.correlation_id ?? null,
        route: 'budgetEnforcer.recordSpend',
        tenant_id: tenantId,
        error: error.message,
      })
    }
  } catch (err) {
    log.error('[budgetEnforcer] recordSpend threw unexpectedly', err, {
      correlation_id: extras?.correlation_id ?? null,
      route: 'budgetEnforcer.recordSpend',
      tenant_id: tenantId,
    })
  }
}

/**
 * Get current budget status for a tenant.
 * Used by the /api/ai/usage dashboard and control tower.
 */
export async function getBudgetStatus(tenantId: string): Promise<TenantBudget> {
  const [budgetRow, dailySpend, monthlySpend] = await Promise.all([
    fetchBudgetRow(tenantId),
    sumSpend(tenantId, `${todayStr()}T00:00:00.000Z`),
    sumSpend(tenantId, monthStartStr()),
  ])

  return {
    tenant_id:                 budgetRow.tenant_id,
    daily_limit_usd:           budgetRow.daily_limit_usd,
    monthly_limit_usd:         budgetRow.monthly_limit_usd,
    current_daily_spend_usd:   dailySpend,
    current_monthly_spend_usd: monthlySpend,
    is_over_daily_limit:       dailySpend >= budgetRow.daily_limit_usd,
    is_over_monthly_limit:     monthlySpend >= budgetRow.monthly_limit_usd,
    hard_block:                budgetRow.hard_block,
  }
}
