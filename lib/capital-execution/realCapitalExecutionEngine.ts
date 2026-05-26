// Agency Group — Real Capital Execution Engine
// lib/capital-execution/realCapitalExecutionEngine.ts
// Full pipeline: INVESTOR_BANK → PSP → ESCROW → LEGAL → NOTARY → LAND_REGISTRY → SETTLEMENT → CONFIRMATION
// TypeScript strict — 0 errors

import { createHash, randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ExecutionPipelineStage =
  | 'INVESTOR_BANK'
  | 'PSP'
  | 'ESCROW'
  | 'LEGAL'
  | 'NOTARY'
  | 'LAND_REGISTRY'
  | 'SETTLEMENT'
  | 'CONFIRMATION'

export type PipelineStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK'

export interface PipelineStageResult {
  stage: ExecutionPipelineStage
  status: PipelineStatus
  external_ref: string | null
  completed_at: string | null
  error: string | null
  metadata: Record<string, unknown>
}

export interface CapitalExecutionPipeline {
  pipeline_id: string
  tenant_id: string
  deal_id: string
  investor_id: string
  amount_eur_cents: number
  current_stage: ExecutionPipelineStage
  overall_status: PipelineStatus
  stages: PipelineStageResult[]
  idempotency_key: string
  sha256_chain: string
  started_at: string
  completed_at: string | null
  rolled_back_at: string | null
  rollback_reason: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGE_ORDER: ExecutionPipelineStage[] = [
  'INVESTOR_BANK',
  'PSP',
  'ESCROW',
  'LEGAL',
  'NOTARY',
  'LAND_REGISTRY',
  'SETTLEMENT',
  'CONFIRMATION',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

function nextStage(current: ExecutionPipelineStage): ExecutionPipelineStage | null {
  const idx = STAGE_ORDER.indexOf(current)
  return idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null
}

function rowToPipeline(row: Record<string, unknown>): CapitalExecutionPipeline {
  return {
    pipeline_id: row.pipeline_id as string,
    tenant_id: row.tenant_id as string,
    deal_id: row.deal_id as string,
    investor_id: row.investor_id as string,
    amount_eur_cents: row.amount_eur_cents as number,
    current_stage: row.current_stage as ExecutionPipelineStage,
    overall_status: row.overall_status as PipelineStatus,
    stages: (row.stages as PipelineStageResult[]) ?? [],
    idempotency_key: row.idempotency_key as string,
    sha256_chain: row.sha256_chain as string,
    started_at: row.started_at as string,
    completed_at: (row.completed_at as string | null) ?? null,
    rolled_back_at: (row.rolled_back_at as string | null) ?? null,
    rollback_reason: (row.rollback_reason as string | null) ?? null,
  }
}

// ─── initiatePipeline ─────────────────────────────────────────────────────────

/**
 * Creates a new pipeline record. Idempotent on idempotency_key.
 */
export async function initiatePipeline(
  dealId: string,
  investorId: string,
  amountEurCents: number,
  tenantId: string,
  idempotencyKey: string,
): Promise<CapitalExecutionPipeline> {
  // Idempotency check
  const { data: existing } = await (supabaseAdmin as any)
    .from('capital_execution_pipelines')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (existing) {
    log.info('[capital-execution] pipeline already exists for idempotency_key', {
      idempotency_key: idempotencyKey,
      pipeline_id: existing.pipeline_id as string,
    })
    return rowToPipeline(existing as Record<string, unknown>)
  }

  const pipelineId = `pipe_${randomUUID()}`
  const now = new Date().toISOString()

  const initialHash = sha256(`${dealId}:${investorId}:${amountEurCents}:${idempotencyKey}`)

  const initialStage: PipelineStageResult = {
    stage: 'INVESTOR_BANK',
    status: 'IN_PROGRESS',
    external_ref: null,
    completed_at: null,
    error: null,
    metadata: {},
  }

  const pipeline: CapitalExecutionPipeline = {
    pipeline_id: pipelineId,
    tenant_id: tenantId,
    deal_id: dealId,
    investor_id: investorId,
    amount_eur_cents: amountEurCents,
    current_stage: 'INVESTOR_BANK',
    overall_status: 'IN_PROGRESS',
    stages: [initialStage],
    idempotency_key: idempotencyKey,
    sha256_chain: initialHash,
    started_at: now,
    completed_at: null,
    rolled_back_at: null,
    rollback_reason: null,
  }

  const { error } = await (supabaseAdmin as any)
    .from('capital_execution_pipelines')
    .insert({
      pipeline_id: pipeline.pipeline_id,
      tenant_id: pipeline.tenant_id,
      deal_id: pipeline.deal_id,
      investor_id: pipeline.investor_id,
      amount_eur_cents: pipeline.amount_eur_cents,
      current_stage: pipeline.current_stage,
      overall_status: pipeline.overall_status,
      stages: pipeline.stages,
      idempotency_key: pipeline.idempotency_key,
      sha256_chain: pipeline.sha256_chain,
      started_at: pipeline.started_at,
    })

  if (error) {
    log.error('[capital-execution] failed to insert pipeline', error, { pipeline_id: pipelineId })
    throw new Error(`Failed to initiate pipeline: ${(error as { message: string }).message}`)
  }

  // Fire event
  void (supabaseAdmin as any)
    .from('capital_execution_events')
    .insert({
      event_id: `evt_${randomUUID()}`,
      tenant_id: tenantId,
      pipeline_id: pipelineId,
      event_type: 'PIPELINE_INITIATED',
      payload: { deal_id: dealId, investor_id: investorId, amount_eur_cents: amountEurCents },
    })
    .then(({ error: evtErr }: { error: unknown }) => {
      if (evtErr) log.warn('[capital-execution] event insert failed', { pipeline_id: pipelineId })
    })
    .catch((e: unknown) => log.warn('[capital-execution] event fire-and-forget error', { error: String(e) }))

  log.info('[capital-execution] pipeline initiated', { pipeline_id: pipelineId, deal_id: dealId })
  return pipeline
}

// ─── advanceStage ─────────────────────────────────────────────────────────────

/**
 * Advances the pipeline to the next stage. Updates SHA-256 chain.
 */
export async function advanceStage(
  pipelineId: string,
  tenantId: string,
  externalRef: string,
  metadata?: Record<string, unknown>,
): Promise<CapitalExecutionPipeline> {
  const existing = await getPipeline(pipelineId, tenantId)
  if (!existing) throw new Error(`Pipeline not found: ${pipelineId}`)

  if (existing.overall_status === 'COMPLETED') {
    log.info('[capital-execution] pipeline already completed', { pipeline_id: pipelineId })
    return existing
  }

  if (existing.overall_status === 'ROLLED_BACK') {
    throw new Error(`Cannot advance a rolled-back pipeline: ${pipelineId}`)
  }

  const now = new Date().toISOString()

  // Complete current stage
  const updatedStages = existing.stages.map((s) =>
    s.stage === existing.current_stage
      ? { ...s, status: 'COMPLETED' as PipelineStatus, external_ref: externalRef, completed_at: now, metadata: metadata ?? s.metadata }
      : s,
  )

  const next = nextStage(existing.current_stage)

  // New SHA-256: hash of prevHash + pipelineId + newStage + externalRef
  const newHash = sha256(`${existing.sha256_chain}:${pipelineId}:${next ?? 'FINAL'}:${externalRef}`)

  let newOverallStatus: PipelineStatus = 'IN_PROGRESS'
  let completedAt: string | null = null

  if (next) {
    const nextStageResult: PipelineStageResult = {
      stage: next,
      status: 'IN_PROGRESS',
      external_ref: null,
      completed_at: null,
      error: null,
      metadata: {},
    }
    updatedStages.push(nextStageResult)
  } else {
    // Last stage completed
    newOverallStatus = 'COMPLETED'
    completedAt = now
  }

  const updates: Record<string, unknown> = {
    current_stage: next ?? existing.current_stage,
    overall_status: newOverallStatus,
    stages: updatedStages,
    sha256_chain: newHash,
    ...(completedAt ? { completed_at: completedAt } : {}),
  }

  const { error } = await (supabaseAdmin as any)
    .from('capital_execution_pipelines')
    .update(updates)
    .eq('pipeline_id', pipelineId)
    .eq('tenant_id', tenantId)

  if (error) {
    log.error('[capital-execution] failed to advance pipeline', error, { pipeline_id: pipelineId })
    throw new Error(`Failed to advance pipeline: ${(error as { message: string }).message}`)
  }

  // Fire event
  void (supabaseAdmin as any)
    .from('capital_execution_events')
    .insert({
      event_id: `evt_${randomUUID()}`,
      tenant_id: tenantId,
      pipeline_id: pipelineId,
      event_type: 'STAGE_ADVANCED',
      payload: { from_stage: existing.current_stage, to_stage: next ?? 'FINAL', external_ref: externalRef },
    })
    .then(({ error: evtErr }: { error: unknown }) => {
      if (evtErr) log.warn('[capital-execution] event insert failed', { pipeline_id: pipelineId })
    })
    .catch((e: unknown) => log.warn('[capital-execution] event fire-and-forget error', { error: String(e) }))

  const updated = await getPipeline(pipelineId, tenantId)
  if (!updated) throw new Error(`Pipeline disappeared after advance: ${pipelineId}`)
  return updated
}

// ─── rollbackPipeline ─────────────────────────────────────────────────────────

/**
 * Marks a pipeline as ROLLED_BACK and records the reason.
 */
export async function rollbackPipeline(
  pipelineId: string,
  tenantId: string,
  reason: string,
): Promise<void> {
  const now = new Date().toISOString()

  const { error } = await (supabaseAdmin as any)
    .from('capital_execution_pipelines')
    .update({
      overall_status: 'ROLLED_BACK',
      rolled_back_at: now,
      rollback_reason: reason,
    })
    .eq('pipeline_id', pipelineId)
    .eq('tenant_id', tenantId)

  if (error) {
    log.error('[capital-execution] failed to rollback pipeline', error, { pipeline_id: pipelineId })
    throw new Error(`Failed to rollback pipeline: ${(error as { message: string }).message}`)
  }

  void (supabaseAdmin as any)
    .from('capital_execution_events')
    .insert({
      event_id: `evt_${randomUUID()}`,
      tenant_id: tenantId,
      pipeline_id: pipelineId,
      event_type: 'PIPELINE_ROLLED_BACK',
      payload: { reason },
    })
    .then(({ error: evtErr }: { error: unknown }) => {
      if (evtErr) log.warn('[capital-execution] event insert failed', { pipeline_id: pipelineId })
    })
    .catch((e: unknown) => log.warn('[capital-execution] rollback event fire-and-forget error', { error: String(e) }))

  log.info('[capital-execution] pipeline rolled back', { pipeline_id: pipelineId, reason })
}

// ─── getPipeline ──────────────────────────────────────────────────────────────

export async function getPipeline(
  pipelineId: string,
  tenantId: string,
): Promise<CapitalExecutionPipeline | null> {
  const { data, error } = await (supabaseAdmin as any)
    .from('capital_execution_pipelines')
    .select('*')
    .eq('pipeline_id', pipelineId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (error) {
    log.error('[capital-execution] getPipeline failed', error, { pipeline_id: pipelineId })
    return null
  }
  if (!data) return null
  return rowToPipeline(data as Record<string, unknown>)
}

// ─── getActivePipelines ───────────────────────────────────────────────────────

export async function getActivePipelines(tenantId: string): Promise<CapitalExecutionPipeline[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('capital_execution_pipelines')
    .select('*')
    .eq('tenant_id', tenantId)
    .not('overall_status', 'in', '("COMPLETED","ROLLED_BACK")')
    .order('started_at', { ascending: false })

  if (error) {
    log.error('[capital-execution] getActivePipelines failed', error, { tenant_id: tenantId })
    return []
  }

  return ((data as Record<string, unknown>[]) ?? []).map(rowToPipeline)
}

// ─── validatePipelineIntegrity ────────────────────────────────────────────────

/**
 * Recomputes the SHA-256 chain from all completed stages and verifies against stored hash.
 */
export function validatePipelineIntegrity(pipeline: CapitalExecutionPipeline): boolean {
  try {
    // Recompute initial hash
    let chain = sha256(
      `${pipeline.deal_id}:${pipeline.investor_id}:${pipeline.amount_eur_cents}:${pipeline.idempotency_key}`,
    )

    const completedStages = pipeline.stages.filter((s) => s.status === 'COMPLETED')

    for (const stage of completedStages) {
      const nextStageName =
        STAGE_ORDER[STAGE_ORDER.indexOf(stage.stage) + 1] ?? 'FINAL'
      chain = sha256(`${chain}:${pipeline.pipeline_id}:${nextStageName}:${stage.external_ref ?? ''}`)
    }

    return chain === pipeline.sha256_chain
  } catch (e) {
    log.warn('[capital-execution] integrity validation error', { pipeline_id: pipeline.pipeline_id, error: String(e) })
    return false
  }
}
