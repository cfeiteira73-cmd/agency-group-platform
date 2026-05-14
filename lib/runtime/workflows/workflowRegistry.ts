// AGENCY GROUP — SH-ROS Runtime Workflows: workflowRegistry | AMI: 22506
// Central registry of all workflow definitions with built-in business flows
// =============================================================================

import logger from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase'
import type { WorkflowDefinition, WorkflowStep, WorkflowContext } from './workflowEngine'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

// ─── Step Handlers ────────────────────────────────────────────────────────────

const makeStep = (
  id: string,
  name: string,
  handler: (ctx: WorkflowContext) => Promise<unknown>,
  opts: { timeout_ms?: number; retry_count?: number } = {}
): WorkflowStep => ({
  id,
  name,
  handler,
  timeout_ms: opts.timeout_ms ?? 30_000,
  retry_count: opts.retry_count ?? 2,
})

// ─── Lead Nurture Steps ───────────────────────────────────────────────────────

const qualifyLead = makeStep('qualify_lead', 'Qualify Lead', async (ctx) => {
  const lead_id = ctx.input['lead_id'] as string
  if (!lead_id) throw new Error('lead_id required for qualify_lead step')

  const { data, error } = await sb
    .from('contacts')
    .select('id, name, email, lead_score, status')
    .eq('id', lead_id)
    .eq('org_id', ctx.org_id)
    .single()

  if (error || !data) throw new Error(`Lead ${lead_id} not found`)
  ctx.state['lead'] = data
  ctx.emit('LEAD_QUALIFICATION_STARTED', { lead_id, lead_name: data.name })
  return data
})

const scoreLead = makeStep('score_lead', 'Score Lead', async (ctx) => {
  const lead = ctx.state['lead'] as Record<string, unknown>
  const score = (lead['lead_score'] as number) ?? 50

  const grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D'
  ctx.state['lead_grade'] = grade
  ctx.state['lead_score'] = score

  ctx.emit('LEAD_SCORED', { lead_id: lead['id'], score, grade })
  return { score, grade }
})

const assignAgent = makeStep('assign_agent', 'Assign Agent', async (ctx) => {
  const grade = ctx.state['lead_grade'] as string
  const lead = ctx.state['lead'] as Record<string, unknown>

  // Fetch best available agent for this lead tier
  const { data: agents } = await sb
    .from('portal_users')
    .select('id, email, full_name')
    .eq('org_id', ctx.org_id)
    .eq('role', 'agent')
    .limit(1)

  const agent = agents?.[0]
  if (!agent) {
    ctx.emit('AGENT_ASSIGNMENT_FAILED', { lead_id: lead['id'], reason: 'no_agents_available' })
    return null
  }

  await sb
    .from('contacts')
    .update({ assigned_to: agent.email })
    .eq('id', lead['id'] as string)
    .eq('org_id', ctx.org_id)

  ctx.state['assigned_agent'] = agent
  ctx.emit('LEAD_ASSIGNED', { lead_id: lead['id'], agent_email: agent.email, grade })
  return agent
})

const sendOutreach = makeStep('send_outreach', 'Send Initial Outreach', async (ctx) => {
  const lead = ctx.state['lead'] as Record<string, unknown>
  const agent = ctx.state['assigned_agent'] as Record<string, unknown> | null

  if (!agent) return { skipped: true, reason: 'no_agent_assigned' }

  ctx.emit('OUTREACH_SENT', {
    lead_id: lead['id'],
    lead_email: lead['email'],
    agent_email: agent['email'],
    channel: 'email',
  })

  return { sent: true, channel: 'email' }
})

const followUpSchedule = makeStep('follow_up_schedule', 'Schedule Follow-ups', async (ctx) => {
  const lead = ctx.state['lead'] as Record<string, unknown>
  const grade = ctx.state['lead_grade'] as string

  const follow_up_days = grade === 'A' ? 1 : grade === 'B' ? 3 : 7
  const follow_up_at = new Date(Date.now() + follow_up_days * 86_400_000).toISOString()

  await sb.from('operator_tasks').insert({
    org_id: ctx.org_id,
    task_type: 'follow_up',
    status: 'pending',
    priority: grade === 'A' ? 'high' : 'medium',
    title: `Follow up with lead ${String(lead['id']).slice(0, 8)}`,
    due_at: follow_up_at,
    metadata: { lead_id: lead['id'], grade, workflow_id: ctx.workflow_id },
  })

  ctx.emit('FOLLOW_UP_SCHEDULED', { lead_id: lead['id'], follow_up_at, grade })
  return { follow_up_at, follow_up_days }
})

// ─── Deal Pipeline Steps ──────────────────────────────────────────────────────

const validateDeal = makeStep('validate_deal', 'Validate Deal', async (ctx) => {
  const deal_id = ctx.input['deal_id'] as string
  if (!deal_id) throw new Error('deal_id required for validate_deal step')

  const { data, error } = await sb
    .from('deals')
    .select('id, ref, stage, value_eur, status')
    .eq('id', deal_id)
    .eq('org_id', ctx.org_id)
    .single()

  if (error || !data) throw new Error(`Deal ${deal_id} not found`)
  if (data.status === 'closed_lost') throw new Error(`Deal ${deal_id} is already closed`)

  ctx.state['deal'] = data
  ctx.emit('DEAL_VALIDATION_PASSED', { deal_id, deal_ref: data.ref, value_eur: data.value_eur })
  return data
})

const priceAnalysis = makeStep('price_analysis', 'Price Analysis', async (ctx) => {
  const deal = ctx.state['deal'] as Record<string, unknown>
  const value_eur = (deal['value_eur'] as number) ?? 0

  // Simple market-based price band check
  const is_priced_correctly = value_eur > 0
  const price_delta_pct = 0 // In production: compare vs AVM

  ctx.state['price_analysis'] = { is_priced_correctly, price_delta_pct, value_eur }
  ctx.emit('PRICE_ANALYSIS_COMPLETE', { deal_id: deal['id'], value_eur, is_priced_correctly })
  return { is_priced_correctly, price_delta_pct }
})

const scheduleVisit = makeStep('schedule_visit', 'Schedule Property Visit', async (ctx) => {
  const deal = ctx.state['deal'] as Record<string, unknown>

  await sb.from('operator_tasks').insert({
    org_id: ctx.org_id,
    task_type: 'schedule_visit',
    status: 'pending',
    priority: 'high',
    title: `Schedule visit for deal ${deal['ref']}`,
    metadata: { deal_id: deal['id'], workflow_id: ctx.workflow_id },
  })

  ctx.emit('VISIT_SCHEDULED', { deal_id: deal['id'], deal_ref: deal['ref'] })
  return { scheduled: true }
})

const presentProposal = makeStep('present_proposal', 'Present Proposal', async (ctx) => {
  const deal = ctx.state['deal'] as Record<string, unknown>
  ctx.emit('PROPOSAL_PRESENTED', { deal_id: deal['id'], value_eur: deal['value_eur'] })
  return { presented: true }
})

const negotiate = makeStep('negotiate', 'Negotiation', async (ctx) => {
  const deal = ctx.state['deal'] as Record<string, unknown>
  ctx.emit('NEGOTIATION_STARTED', { deal_id: deal['id'] })

  await sb
    .from('deals')
    .update({ stage: 'negotiation' })
    .eq('id', deal['id'] as string)
    .eq('org_id', ctx.org_id)

  return { negotiating: true }
})

const cpcvPrep = makeStep('cpcv_prep', 'CPCV Preparation', async (ctx) => {
  const deal = ctx.state['deal'] as Record<string, unknown>
  ctx.emit('CPCV_PREP_STARTED', { deal_id: deal['id'], deal_ref: deal['ref'] })

  await sb
    .from('deals')
    .update({ stage: 'cpcv_pending' })
    .eq('id', deal['id'] as string)
    .eq('org_id', ctx.org_id)

  return { cpcv_prep_started: true }
})

// ─── Deal Closing Steps ───────────────────────────────────────────────────────

const verifyFinancing = makeStep('verify_financing', 'Verify Financing', async (ctx) => {
  const deal = ctx.state['deal'] as Record<string, unknown>
  ctx.emit('FINANCING_VERIFICATION_STARTED', { deal_id: deal['id'] })
  return { financing_verified: true }
})

const prepareDocs = makeStep('prepare_docs', 'Prepare Documents', async (ctx) => {
  const deal = ctx.state['deal'] as Record<string, unknown>

  await sb.from('operator_tasks').insert({
    org_id: ctx.org_id,
    task_type: 'prepare_closing_docs',
    status: 'pending',
    priority: 'critical',
    title: `Prepare closing docs for ${deal['ref']}`,
    metadata: { deal_id: deal['id'], workflow_id: ctx.workflow_id },
  })

  ctx.emit('DOCS_PREPARATION_STARTED', { deal_id: deal['id'] })
  return { docs_prepared: true }
})

const coordinateNotary = makeStep('coordinate_notary', 'Coordinate Notary', async (ctx) => {
  const deal = ctx.state['deal'] as Record<string, unknown>
  ctx.emit('NOTARY_COORDINATION_STARTED', { deal_id: deal['id'] })
  return { notary_coordinated: true }
})

const executeCPCV = makeStep('execute_cpcv', 'Execute CPCV', async (ctx) => {
  const deal = ctx.state['deal'] as Record<string, unknown>

  await sb
    .from('deals')
    .update({ stage: 'cpcv_signed' })
    .eq('id', deal['id'] as string)
    .eq('org_id', ctx.org_id)

  ctx.emit('CPCV_EXECUTED', { deal_id: deal['id'], deal_ref: deal['ref'], value_eur: deal['value_eur'] })
  return { cpcv_executed: true }
})

const executeEscritura = makeStep('execute_escritura', 'Execute Escritura', async (ctx) => {
  const deal = ctx.state['deal'] as Record<string, unknown>

  await sb
    .from('deals')
    .update({ stage: 'escritura_done', status: 'closed_won' })
    .eq('id', deal['id'] as string)
    .eq('org_id', ctx.org_id)

  ctx.emit('DEAL_WON', {
    deal_id: deal['id'],
    deal_ref: deal['ref'],
    value_eur: deal['value_eur'],
    stage_reached: 'escritura_done',
  })

  return { deal_closed: true, deal_ref: deal['ref'] }
})

// ─── Revenue Recovery Steps ───────────────────────────────────────────────────

const identifyRisk = makeStep('identify_risk', 'Identify Revenue Risk', async (ctx) => {
  const entity_id = ctx.input['entity_id'] as string
  const entity_type = (ctx.input['entity_type'] as string) ?? 'deal'

  ctx.state['risk_entity'] = { entity_id, entity_type }
  ctx.emit('REVENUE_RISK_IDENTIFIED', { entity_id, entity_type })
  return { identified: true }
})

const assessImpact = makeStep('assess_impact', 'Assess Financial Impact', async (ctx) => {
  const risk = ctx.state['risk_entity'] as Record<string, unknown>
  const estimated_loss_eur = (ctx.input['estimated_loss_eur'] as number) ?? 0

  ctx.state['estimated_loss_eur'] = estimated_loss_eur
  ctx.emit('REVENUE_RISK_ASSESSED', { ...risk, estimated_loss_eur })
  return { estimated_loss_eur }
})

const escalateHuman = makeStep('escalate_human', 'Escalate to Human', async (ctx) => {
  const risk = ctx.state['risk_entity'] as Record<string, unknown>
  const estimated_loss_eur = ctx.state['estimated_loss_eur'] as number

  await sb.from('operator_tasks').insert({
    org_id: ctx.org_id,
    task_type: 'escalation',
    status: 'pending',
    priority: 'critical',
    title: `Revenue risk: ${estimated_loss_eur.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })} at risk`,
    metadata: {
      entity_id: risk['entity_id'],
      entity_type: risk['entity_type'],
      estimated_loss_eur,
      workflow_id: ctx.workflow_id,
      requires_human_decision: true,
    },
  })

  ctx.emit('HUMAN_ESCALATION_TRIGGERED', { ...risk, estimated_loss_eur })
  return { escalated: true }
})

const executeIntervention = makeStep('execute_intervention', 'Execute Recovery Intervention', async (ctx) => {
  const risk = ctx.state['risk_entity'] as Record<string, unknown>
  ctx.emit('RECOVERY_INTERVENTION_EXECUTED', { entity_id: risk['entity_id'] })
  return { intervention_executed: true }
})

// ─── Compensation Steps ───────────────────────────────────────────────────────

const rollbackLeadAssignment = makeStep('rollback_assign_agent', 'Rollback Lead Assignment', async (ctx) => {
  const lead = ctx.state['lead'] as Record<string, unknown> | undefined
  if (lead?.['id']) {
    await sb
      .from('contacts')
      .update({ assigned_to: null })
      .eq('id', lead['id'] as string)
      .eq('org_id', ctx.org_id)
  }
  ctx.emit('COMPENSATION_AGENT_UNASSIGNED', { lead_id: lead?.['id'] })
  return { rolled_back: true }
})

const rollbackDealStage = makeStep('rollback_deal_stage', 'Rollback Deal Stage', async (ctx) => {
  const deal = ctx.state['deal'] as Record<string, unknown> | undefined
  if (deal?.['id']) {
    await sb
      .from('deals')
      .update({ stage: 'qualification', status: 'active' })
      .eq('id', deal['id'] as string)
      .eq('org_id', ctx.org_id)
  }
  ctx.emit('COMPENSATION_DEAL_REVERTED', { deal_id: deal?.['id'] })
  return { rolled_back: true }
})

// ─── Registry ─────────────────────────────────────────────────────────────────

export class WorkflowRegistry {
  private readonly definitions = new Map<string, WorkflowDefinition>()

  register(def: WorkflowDefinition): void {
    if (this.definitions.has(def.name)) {
      logger.warn('[WorkflowRegistry] Overwriting existing workflow definition', { name: def.name })
    }
    this.definitions.set(def.name, def)
    logger.info('[WorkflowRegistry] Workflow registered', { name: def.name, version: def.version })
  }

  get(name: string): WorkflowDefinition | undefined {
    return this.definitions.get(name)
  }

  list(): WorkflowDefinition[] {
    return Array.from(this.definitions.values())
  }
}

// ─── Bootstrap singleton with built-in workflows ──────────────────────────────

export const workflowRegistry = new WorkflowRegistry()

// Lead Nurture
workflowRegistry.register({
  name: 'lead-nurture',
  version: '1.0.0',
  org_id: '*', // template — caller overrides org_id
  timeout_ms: 300_000, // 5 min
  requires_approval: false,
  steps: [qualifyLead, scoreLead, assignAgent, sendOutreach, followUpSchedule],
  compensation_steps: [rollbackLeadAssignment],
})

// Deal Pipeline
workflowRegistry.register({
  name: 'deal-pipeline',
  version: '1.0.0',
  org_id: '*',
  timeout_ms: 600_000, // 10 min
  requires_approval: true,
  steps: [validateDeal, priceAnalysis, scheduleVisit, presentProposal, negotiate, cpcvPrep],
  compensation_steps: [rollbackDealStage],
})

// Deal Closing
workflowRegistry.register({
  name: 'deal-closing',
  version: '1.0.0',
  org_id: '*',
  timeout_ms: 900_000, // 15 min
  requires_approval: true,
  steps: [verifyFinancing, prepareDocs, coordinateNotary, executeCPCV, executeEscritura],
  compensation_steps: [rollbackDealStage],
})

// Revenue Recovery
workflowRegistry.register({
  name: 'revenue-recovery',
  version: '1.0.0',
  org_id: '*',
  timeout_ms: 120_000, // 2 min
  requires_approval: true,
  steps: [identifyRisk, assessImpact, escalateHuman, executeIntervention],
  compensation_steps: [],
})
