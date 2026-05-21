// Agency Group — Campaign Orchestration Engine
// lib/campaigns/campaignOrchestrator.ts
// Manages campaign workflows: triggers → sequences → branching → execution.
// Campaigns target investor segments. Every send is tracked for attribution.
// Does NOT send directly — writes to channel_send_queue for channel routers.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { queueSend } from '@/lib/campaigns/channelRouter'

// ─── Constants ────────────────────────────────────────────────────────────────

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CampaignStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'PAUSED'
  | 'COMPLETED'
  | 'ARCHIVED'

export type CampaignTriggerType =
  | 'BID_ACTIVITY'
  | 'LIQUIDITY_CHANGE'
  | 'INVESTOR_INACTIVITY'
  | 'ROI_OPPORTUNITY'
  | 'CAPITAL_THRESHOLD'
  | 'MARKET_ENTRY'
  | 'DEAL_CLOSED'
  | 'SCHEDULED'
  | 'MANUAL'

export interface CampaignStep {
  step_id: string
  step_number: number
  channel: string
  delay_hours: number
  message_template: string
  condition_branch: Record<string, unknown> | null
}

export interface Campaign {
  campaign_id: string
  tenant_id: string
  name: string
  status: CampaignStatus
  trigger_type: CampaignTriggerType
  target_segments: string[]
  channels: string[]
  message_template_id: string | null
  trigger_conditions: Record<string, unknown>
  sequence_steps: CampaignStep[]
  start_at: string | null
  end_at: string | null
  budget_eur_cents: number | null
  created_at: string
  updated_at: string
}

export interface CampaignExecution {
  execution_id: string
  campaign_id: string
  tenant_id: string
  investor_id: string
  current_step: number
  status: 'ENROLLED' | 'IN_PROGRESS' | 'COMPLETED' | 'OPTED_OUT' | 'FAILED'
  enrolled_at: string
  completed_at: string | null
  last_send_at: string | null
}

// ─── createCampaign ───────────────────────────────────────────────────────────

export async function createCampaign(
  params: Omit<Campaign, 'campaign_id' | 'created_at' | 'updated_at'>,
  tenantId: string,
): Promise<Campaign> {
  const campaign_id = `camp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const now = new Date().toISOString()

  const insertPayload = {
    campaign_id,
    tenant_id: tenantId,
    name: params.name,
    status: params.status,
    trigger_type: params.trigger_type,
    target_segments: params.target_segments,
    channels: params.channels,
    message_template_id: params.message_template_id ?? null,
    trigger_conditions: params.trigger_conditions,
    sequence_steps: params.sequence_steps,
    start_at: params.start_at ?? null,
    end_at: params.end_at ?? null,
    budget_eur_cents: params.budget_eur_cents ?? null,
    created_at: now,
    updated_at: now,
  }

  const { data, error } = await (supabaseAdmin as any)
    .from('campaigns')
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    log.error('[campaignOrchestrator] createCampaign failed', error, {
      campaign_id,
      tenant_id: tenantId,
    })
    throw new Error(`createCampaign: ${error.message}`)
  }

  log.info('[campaignOrchestrator] campaign created', {
    campaign_id,
    tenant_id: tenantId,
    trigger_type: params.trigger_type,
  })

  return _mapCampaignRow(data)
}

// ─── enrollInvestor ───────────────────────────────────────────────────────────

export async function enrollInvestor(
  campaignId: string,
  investorId: string,
  tenantId: string,
): Promise<CampaignExecution> {
  // 1. Verify campaign is ACTIVE
  const { data: campaignRow, error: campaignErr } = await (supabaseAdmin as any)
    .from('campaigns')
    .select('status')
    .eq('campaign_id', campaignId)
    .eq('tenant_id', tenantId)
    .single()

  if (campaignErr || !campaignRow) {
    throw new Error(`enrollInvestor: campaign not found — ${campaignId}`)
  }
  if (campaignRow.status !== 'ACTIVE') {
    throw new Error(`enrollInvestor: campaign is not ACTIVE (status=${campaignRow.status})`)
  }

  // 2. Check investor not already enrolled
  const { data: existing } = await (supabaseAdmin as any)
    .from('campaign_executions')
    .select('execution_id')
    .eq('campaign_id', campaignId)
    .eq('investor_id', investorId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (existing) {
    throw new Error(
      `enrollInvestor: investor ${investorId} already enrolled in campaign ${campaignId}`,
    )
  }

  // 3. Insert execution record
  const execution_id = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  const now = new Date().toISOString()

  const { data, error } = await (supabaseAdmin as any)
    .from('campaign_executions')
    .insert({
      execution_id,
      campaign_id: campaignId,
      tenant_id: tenantId,
      investor_id: investorId,
      current_step: 0,
      status: 'ENROLLED',
      enrolled_at: now,
      completed_at: null,
      last_send_at: null,
    })
    .select()
    .single()

  if (error) {
    log.error('[campaignOrchestrator] enrollInvestor failed', error, {
      campaign_id: campaignId,
      investor_id: investorId,
    })
    throw new Error(`enrollInvestor: ${error.message}`)
  }

  log.info('[campaignOrchestrator] investor enrolled', {
    execution_id,
    campaign_id: campaignId,
    investor_id: investorId,
    tenant_id: tenantId,
  })

  return _mapExecutionRow(data)
}

// ─── processNextStep ──────────────────────────────────────────────────────────

export async function processNextStep(
  executionId: string,
  tenantId: string,
): Promise<CampaignExecution> {
  // 1. Load execution
  const { data: execRow, error: execErr } = await (supabaseAdmin as any)
    .from('campaign_executions')
    .select('*')
    .eq('execution_id', executionId)
    .eq('tenant_id', tenantId)
    .single()

  if (execErr || !execRow) {
    throw new Error(`processNextStep: execution not found — ${executionId}`)
  }

  const execution = _mapExecutionRow(execRow)

  if (execution.status === 'COMPLETED' || execution.status === 'OPTED_OUT') {
    return execution
  }

  // 2. Load campaign
  const { data: campaignRow, error: campErr } = await (supabaseAdmin as any)
    .from('campaigns')
    .select('*')
    .eq('campaign_id', execution.campaign_id)
    .eq('tenant_id', tenantId)
    .single()

  if (campErr || !campaignRow) {
    throw new Error(`processNextStep: campaign not found — ${execution.campaign_id}`)
  }

  const campaign = _mapCampaignRow(campaignRow)
  const steps: CampaignStep[] = campaign.sequence_steps ?? []
  const nextStepIndex = execution.current_step

  // 3. Check if steps exhausted
  if (nextStepIndex >= steps.length) {
    const { data: updated, error: updateErr } = await (supabaseAdmin as any)
      .from('campaign_executions')
      .update({ status: 'COMPLETED', completed_at: new Date().toISOString() })
      .eq('execution_id', executionId)
      .eq('tenant_id', tenantId)
      .select()
      .single()

    if (updateErr) {
      throw new Error(`processNextStep: update to COMPLETED failed — ${updateErr.message}`)
    }

    log.info('[campaignOrchestrator] execution completed', {
      execution_id: executionId,
      campaign_id: execution.campaign_id,
    })

    return _mapExecutionRow(updated)
  }

  const step = steps[nextStepIndex]
  if (!step) {
    throw new Error(`processNextStep: step ${nextStepIndex} not found in campaign`)
  }

  const now = new Date().toISOString()
  const sendAt = step.delay_hours > 0
    ? new Date(Date.now() + step.delay_hours * 3600 * 1000).toISOString()
    : now

  // 4. Fire-and-forget queue send
  void queueSend({
    tenant_id: tenantId,
    campaign_id: execution.campaign_id,
    execution_id: executionId,
    investor_id: execution.investor_id,
    channel: step.channel,
    message_content: step.message_template,
    send_at: sendAt,
  }).catch((e: unknown) => log.warn('[campaignOrchestrator] queueSend fire-and-forget failed', { error: String(e) }))

  // 5. Advance execution state
  const newStep = nextStepIndex + 1
  const isLastStep = newStep >= steps.length
  const { data: updated, error: updateErr } = await (supabaseAdmin as any)
    .from('campaign_executions')
    .update({
      current_step: newStep,
      status: isLastStep ? 'COMPLETED' : 'IN_PROGRESS',
      last_send_at: now,
      completed_at: isLastStep ? now : null,
    })
    .eq('execution_id', executionId)
    .eq('tenant_id', tenantId)
    .select()
    .single()

  if (updateErr) {
    throw new Error(`processNextStep: update failed — ${updateErr.message}`)
  }

  log.info('[campaignOrchestrator] step processed', {
    execution_id: executionId,
    step_number: nextStepIndex,
    channel: step.channel,
    send_at: sendAt,
  })

  return _mapExecutionRow(updated)
}

// ─── bulkEnrollSegment ────────────────────────────────────────────────────────

export async function bulkEnrollSegment(
  campaignId: string,
  segment: string,
  tenantId: string,
): Promise<{ enrolled: number; skipped: number }> {
  // Load investors in segment
  const { data: investors, error: invErr } = await (supabaseAdmin as any)
    .from('investor_segment_profiles')
    .select('investor_id')
    .eq('segment', segment)
    .eq('tenant_id', tenantId)

  if (invErr) {
    log.error('[campaignOrchestrator] bulkEnrollSegment: segment query failed', invErr, {
      campaign_id: campaignId,
      segment,
    })
    throw new Error(`bulkEnrollSegment: ${invErr.message}`)
  }

  const investorList: Array<{ investor_id: string }> = investors ?? []
  let enrolled = 0
  let skipped = 0

  for (const inv of investorList) {
    try {
      await enrollInvestor(campaignId, inv.investor_id, tenantId)
      enrolled++
    } catch (e: unknown) {
      // Already enrolled or other expected skip
      skipped++
      log.warn('[campaignOrchestrator] bulkEnrollSegment skip', {
        investor_id: inv.investor_id,
        reason: String(e),
      })
    }
  }

  log.info('[campaignOrchestrator] bulkEnrollSegment complete', {
    campaign_id: campaignId,
    segment,
    enrolled,
    skipped,
    tenant_id: tenantId,
  })

  return { enrolled, skipped }
}

// ─── getCampaignStats ─────────────────────────────────────────────────────────

export async function getCampaignStats(
  campaignId: string,
  tenantId: string,
): Promise<{
  campaign: Campaign
  total_enrolled: number
  completed: number
  opted_out: number
  in_progress: number
  completion_rate_pct: number
}> {
  const { data: campaignRow, error: campErr } = await (supabaseAdmin as any)
    .from('campaigns')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('tenant_id', tenantId)
    .single()

  if (campErr || !campaignRow) {
    throw new Error(`getCampaignStats: campaign not found — ${campaignId}`)
  }

  const { data: execRows, error: execErr } = await (supabaseAdmin as any)
    .from('campaign_executions')
    .select('status')
    .eq('campaign_id', campaignId)
    .eq('tenant_id', tenantId)

  if (execErr) {
    throw new Error(`getCampaignStats: executions query failed — ${execErr.message}`)
  }

  const rows: Array<{ status: string }> = execRows ?? []
  const total_enrolled = rows.length
  const completed = rows.filter((r) => r.status === 'COMPLETED').length
  const opted_out = rows.filter((r) => r.status === 'OPTED_OUT').length
  const in_progress = rows.filter(
    (r) => r.status === 'IN_PROGRESS' || r.status === 'ENROLLED',
  ).length
  const completion_rate_pct =
    total_enrolled > 0 ? Math.round((completed / total_enrolled) * 100) : 0

  return {
    campaign: _mapCampaignRow(campaignRow),
    total_enrolled,
    completed,
    opted_out,
    in_progress,
    completion_rate_pct,
  }
}

// ─── pauseCampaign ────────────────────────────────────────────────────────────

export async function pauseCampaign(
  campaignId: string,
  tenantId: string,
): Promise<void> {
  const { error } = await (supabaseAdmin as any)
    .from('campaigns')
    .update({ status: 'PAUSED', updated_at: new Date().toISOString() })
    .eq('campaign_id', campaignId)
    .eq('tenant_id', tenantId)

  if (error) {
    throw new Error(`pauseCampaign: ${error.message}`)
  }

  log.info('[campaignOrchestrator] campaign paused', {
    campaign_id: campaignId,
    tenant_id: tenantId,
  })
}

// ─── getActiveCampaigns ───────────────────────────────────────────────────────

export async function getActiveCampaigns(tenantId: string): Promise<Campaign[]> {
  const { data, error } = await (supabaseAdmin as any)
    .from('campaigns')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'ACTIVE')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`getActiveCampaigns: ${error.message}`)
  }

  return (data ?? []).map(_mapCampaignRow)
}

// ─── Internal mappers ─────────────────────────────────────────────────────────

function _mapCampaignRow(row: Record<string, unknown>): Campaign {
  return {
    campaign_id: row.campaign_id as string,
    tenant_id: row.tenant_id as string,
    name: row.name as string,
    status: row.status as CampaignStatus,
    trigger_type: row.trigger_type as CampaignTriggerType,
    target_segments: (row.target_segments as string[]) ?? [],
    channels: (row.channels as string[]) ?? [],
    message_template_id: (row.message_template_id as string | null) ?? null,
    trigger_conditions: (row.trigger_conditions as Record<string, unknown>) ?? {},
    sequence_steps: (row.sequence_steps as CampaignStep[]) ?? [],
    start_at: (row.start_at as string | null) ?? null,
    end_at: (row.end_at as string | null) ?? null,
    budget_eur_cents: (row.budget_eur_cents as number | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }
}

function _mapExecutionRow(row: Record<string, unknown>): CampaignExecution {
  return {
    execution_id: row.execution_id as string,
    campaign_id: row.campaign_id as string,
    tenant_id: row.tenant_id as string,
    investor_id: row.investor_id as string,
    current_step: (row.current_step as number) ?? 0,
    status: row.status as CampaignExecution['status'],
    enrolled_at: row.enrolled_at as string,
    completed_at: (row.completed_at as string | null) ?? null,
    last_send_at: (row.last_send_at as string | null) ?? null,
  }
}

// Export TENANT_ID for internal use
export { TENANT_ID as DEFAULT_CAMPAIGN_TENANT_ID }
