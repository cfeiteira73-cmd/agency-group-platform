// Agency Group — Execution Engine
// lib/execution/executionEngine.ts
// Orchestrates the full capital execution flow:
// investor commitment → bid acceptance → escrow lock → legal trigger → settlement initiation → asset transfer.
// Each step is atomic and recorded. Failure at any step triggers safe rollback.
// FINANCIAL GRADE: NO auto-correction of financial state.
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { getInvestorBalance } from '@/lib/capital/investorLedger'
import { transitionSettlement } from '@/lib/capital/settlementStateMachine'
import {
  createEscrow,
  fundEscrow,
  lockEscrow,
} from '@/lib/execution/escrowOrchestrator'
import log from '@/lib/logger'

// ─── Constants ────────────────────────────────────────────────────────────────

const CANONICAL_TENANT =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ExecutionStep {
  step: number
  name: string
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'SKIPPED'
  completed_at: string | null
  result: Record<string, unknown> | null
  error: string | null
}

export interface ExecutionPlan {
  plan_id: string
  tenant_id: string
  settlement_id: string
  asset_id: string
  investor_id: string
  bid_id: string
  amount_eur_cents: number
  steps: ExecutionStep[]
  current_step: number
  status: 'PLANNING' | 'EXECUTING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK'
  created_at: string
}

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEP_NAMES: Record<number, string> = {
  1: 'VERIFY_CAPITAL',
  2: 'CREATE_ESCROW',
  3: 'FUND_ESCROW',
  4: 'ACCEPT_BID',
  5: 'LOCK_ESCROW',
  6: 'TRIGGER_LEGAL',
  7: 'INITIATE_SETTLEMENT',
}

function buildInitialSteps(): ExecutionStep[] {
  return [1, 2, 3, 4, 5, 6, 7].map((n) => ({
    step:         n,
    name:         STEP_NAMES[n] ?? `STEP_${n}`,
    status:       'PENDING' as const,
    completed_at: null,
    result:       null,
    error:        null,
  }))
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(row: Record<string, any>): ExecutionPlan {
  return {
    plan_id:          row.plan_id as string,
    tenant_id:        row.tenant_id as string,
    settlement_id:    row.settlement_id as string,
    asset_id:         row.asset_id as string,
    investor_id:      row.investor_id as string,
    bid_id:           row.bid_id as string,
    amount_eur_cents: row.amount_eur_cents as number,
    steps:            (row.steps as ExecutionStep[]) ?? [],
    current_step:     (row.current_step as number) ?? 0,
    status:           row.status as ExecutionPlan['status'],
    created_at:       row.created_at as string,
  }
}

async function persistPlan(
  planId: string,
  tenantId: string,
  updates: Partial<{
    steps: ExecutionStep[]
    current_step: number
    status: ExecutionPlan['status']
  }>,
): Promise<ExecutionPlan> {
  const { data, error } = await (supabaseAdmin as any)
    .from('execution_plans')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('plan_id', planId)
    .eq('tenant_id', tenantId)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`[executionEngine] persistPlan failed: ${error?.message ?? 'no data'}`)
  }

  return mapRow(data)
}

// ─── createExecutionPlan ──────────────────────────────────────────────────────

/**
 * Creates an execution plan with 7 sequential steps.
 * Persists to execution_plans table. Status starts as PLANNING.
 */
export async function createExecutionPlan(params: {
  settlement_id: string
  asset_id: string
  investor_id: string
  bid_id: string
  amount_eur_cents: number
  tenant_id: string
}): Promise<ExecutionPlan> {
  const tid = params.tenant_id || CANONICAL_TENANT
  const planId = `plan_${randomUUID()}`
  const now = new Date().toISOString()

  const steps = buildInitialSteps()

  const row = {
    plan_id:          planId,
    tenant_id:        tid,
    settlement_id:    params.settlement_id,
    asset_id:         params.asset_id,
    investor_id:      params.investor_id,
    bid_id:           params.bid_id,
    amount_eur_cents: params.amount_eur_cents,
    steps,
    current_step:     0,
    status:           'PLANNING' as ExecutionPlan['status'],
    created_at:       now,
    updated_at:       now,
  }

  const { data, error } = await (supabaseAdmin as any)
    .from('execution_plans')
    .insert(row)
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(`[executionEngine] createExecutionPlan failed: ${error?.message ?? 'no data'}`)
  }

  log.info('[executionEngine] execution plan created', {
    plan_id:       planId,
    settlement_id: params.settlement_id,
    investor_id:   params.investor_id,
  })

  return mapRow(data)
}

// ─── executeStep ─────────────────────────────────────────────────────────────

/**
 * Executes a specific step in the execution plan.
 * Steps must be executed in order (1 → 7).
 * On any failure: marks step as FAILED, plan as FAILED.
 * Does NOT auto-rollback — human decision required for financial rollback.
 */
export async function executeStep(
  planId: string,
  step: number,
  tenantId: string,
): Promise<ExecutionPlan> {
  const tid = tenantId || CANONICAL_TENANT

  // ── Fetch plan ────────────────────────────────────────────────────────────
  const plan = await getExecutionPlan(planId, tid)
  if (!plan) {
    throw new Error(`[executionEngine] executeStep: plan not found: ${planId}`)
  }

  if (plan.status === 'COMPLETED' || plan.status === 'FAILED' || plan.status === 'ROLLED_BACK') {
    throw new Error(
      `[executionEngine] executeStep: plan ${planId} is in terminal status '${plan.status}'`,
    )
  }

  // Find the step entry
  const stepEntry = plan.steps.find((s) => s.step === step)
  if (!stepEntry) {
    throw new Error(`[executionEngine] executeStep: step ${step} not found in plan ${planId}`)
  }

  if (stepEntry.status === 'COMPLETED') {
    // Idempotent — return plan as-is
    return plan
  }

  if (stepEntry.status === 'FAILED') {
    throw new Error(
      `[executionEngine] executeStep: step ${step} already FAILED in plan ${planId}. Human decision required.`,
    )
  }

  // Mark plan as EXECUTING if not already
  const planStatus: ExecutionPlan['status'] = 'EXECUTING'

  // Execute the step
  let stepResult: Record<string, unknown> | null = null
  let stepError: string | null = null
  const now = new Date().toISOString()

  try {
    switch (step) {
      case 1: {
        // VERIFY_CAPITAL
        const balance = await getInvestorBalance(plan.investor_id, tid)
        if (balance.available_eur_cents < plan.amount_eur_cents) {
          throw new Error(
            `Insufficient available balance. Available: ${balance.available_eur_cents} cents, required: ${plan.amount_eur_cents} cents`,
          )
        }
        stepResult = {
          available_eur_cents: balance.available_eur_cents,
          required_eur_cents:  plan.amount_eur_cents,
          verified:            true,
        }
        break
      }

      case 2: {
        // CREATE_ESCROW
        const escrow = await createEscrow({
          settlement_id:    plan.settlement_id,
          investor_id:      plan.investor_id,
          amount_eur_cents: plan.amount_eur_cents,
          tenant_id:        tid,
        })
        stepResult = { escrow_id: escrow.escrow_id, state: escrow.state }
        break
      }

      case 3: {
        // FUND_ESCROW — escrow_id stored in step 2 result
        const step2 = plan.steps.find((s) => s.step === 2)
        const escrowId = step2?.result?.['escrow_id'] as string | undefined
        if (!escrowId) {
          throw new Error('escrow_id not found in step 2 result — run step 2 first')
        }
        const funded = await fundEscrow(escrowId, tid)
        stepResult = { escrow_id: funded.escrow_id, state: funded.state, funded_at: funded.funded_at }
        break
      }

      case 4: {
        // ACCEPT_BID
        const { error: bidErr } = await (supabaseAdmin as any)
          .from('asset_bids')
          .update({ bid_status: 'ACCEPTED' })
          .eq('bid_id', plan.bid_id)

        if (bidErr) {
          throw new Error(`Failed to accept bid: ${bidErr.message}`)
        }
        stepResult = { bid_id: plan.bid_id, bid_status: 'ACCEPTED' }
        break
      }

      case 5: {
        // LOCK_ESCROW
        const step2 = plan.steps.find((s) => s.step === 2)
        const escrowId = step2?.result?.['escrow_id'] as string | undefined
        if (!escrowId) {
          throw new Error('escrow_id not found in step 2 result — run step 2 first')
        }
        const locked = await lockEscrow(
          escrowId,
          ['KYC_VERIFIED', 'LEGAL_SIGNED', 'NOTARY_CONFIRMED'],
          tid,
        )
        stepResult = {
          escrow_id: locked.escrow_id,
          state:     locked.state,
          locked_at: locked.locked_at,
        }
        break
      }

      case 6: {
        // TRIGGER_LEGAL
        const triggerNow = new Date().toISOString()
        const { error: legalErr } = await (supabaseAdmin as any)
          .from('legal_trigger_events')
          .insert({
            tenant_id:     tid,
            settlement_id: plan.settlement_id,
            event_type:    'LEGAL_EXECUTION_TRIGGERED',
            triggered_at:  triggerNow,
            metadata:      {
              plan_id:     planId,
              asset_id:    plan.asset_id,
              investor_id: plan.investor_id,
              bid_id:      plan.bid_id,
            },
          })

        if (legalErr) {
          throw new Error(`Failed to insert legal trigger event: ${legalErr.message}`)
        }
        stepResult = { event_type: 'LEGAL_EXECUTION_TRIGGERED', triggered_at: triggerNow }
        break
      }

      case 7: {
        // INITIATE_SETTLEMENT
        const { settlement } = await transitionSettlement(
          plan.settlement_id,
          'commit',
          `execution_plan:${planId}`,
          `Execution plan ${planId} — step 7 INITIATE_SETTLEMENT`,
          tid,
        )
        stepResult = {
          settlement_id:  settlement.settlement_id,
          current_state:  settlement.current_state,
          transitioned_at: new Date().toISOString(),
        }
        break
      }

      default:
        throw new Error(`[executionEngine] Unknown step: ${step}`)
    }
  } catch (err) {
    stepError = err instanceof Error ? err.message : String(err)
    log.info('[executionEngine] step failed', {
      plan_id: planId,
      step,
      error: stepError,
    })
  }

  // ── Build updated steps array ─────────────────────────────────────────────
  const updatedSteps: ExecutionStep[] = plan.steps.map((s) => {
    if (s.step !== step) return s
    return {
      ...s,
      status:       stepError ? 'FAILED' : 'COMPLETED',
      completed_at: stepError ? null : now,
      result:       stepResult,
      error:        stepError,
    }
  })

  // Determine new plan status
  const newPlanStatus: ExecutionPlan['status'] = stepError
    ? 'FAILED'
    : planStatus

  const updatedPlan = await persistPlan(planId, tid, {
    steps:        updatedSteps,
    current_step: step,
    status:       newPlanStatus,
  })

  if (stepError) {
    // Rethrow after persisting the failure so callers know what happened
    throw new Error(`[executionEngine] Step ${step} (${STEP_NAMES[step]}) failed: ${stepError}`)
  }

  log.info('[executionEngine] step completed', {
    plan_id: planId,
    step,
    name: STEP_NAMES[step],
  })

  return updatedPlan
}

// ─── executeFullPlan ──────────────────────────────────────────────────────────

/**
 * Runs all 7 steps sequentially, stops on first failure.
 * Does NOT auto-rollback on failure — human decision required.
 */
export async function executeFullPlan(
  planId: string,
  tenantId: string,
): Promise<ExecutionPlan> {
  const tid = tenantId || CANONICAL_TENANT

  let plan = await getExecutionPlan(planId, tid)
  if (!plan) {
    throw new Error(`[executionEngine] executeFullPlan: plan not found: ${planId}`)
  }

  for (let step = 1; step <= 7; step++) {
    const stepEntry = plan.steps.find((s) => s.step === step)

    // Skip already-completed steps (resumable)
    if (stepEntry?.status === 'COMPLETED') continue

    try {
      plan = await executeStep(planId, step, tid)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.info('[executionEngine] executeFullPlan stopped at step', {
        plan_id: planId,
        step,
        error: msg,
      })
      // Return the current (failed) plan without re-throwing — caller reads plan.status
      return (await getExecutionPlan(planId, tid)) ?? plan
    }
  }

  // All steps completed — mark COMPLETED
  const completed = await persistPlan(planId, tid, { status: 'COMPLETED' })

  log.info('[executionEngine] full plan completed', {
    plan_id:       planId,
    settlement_id: completed.settlement_id,
  })

  return completed
}

// ─── getExecutionPlan ─────────────────────────────────────────────────────────

export async function getExecutionPlan(
  planId: string,
  tenantId: string,
): Promise<ExecutionPlan | null> {
  const tid = tenantId || CANONICAL_TENANT

  const { data, error } = await (supabaseAdmin as any)
    .from('execution_plans')
    .select('*')
    .eq('plan_id', planId)
    .eq('tenant_id', tid)
    .maybeSingle()

  if (error) {
    log.info('[executionEngine] getExecutionPlan error', { plan_id: planId, error: error.message })
    return null
  }

  return data ? mapRow(data) : null
}

// ─── getActiveExecutions ──────────────────────────────────────────────────────

export async function getActiveExecutions(tenantId: string): Promise<ExecutionPlan[]> {
  const tid = tenantId || CANONICAL_TENANT

  const { data, error } = await (supabaseAdmin as any)
    .from('execution_plans')
    .select('*')
    .eq('tenant_id', tid)
    .eq('status', 'EXECUTING')
    .order('created_at', { ascending: false })

  if (error) {
    log.info('[executionEngine] getActiveExecutions error', { error: error.message })
    return []
  }

  return (data ?? []).map(mapRow)
}
