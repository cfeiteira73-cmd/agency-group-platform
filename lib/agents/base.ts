// =============================================================================
// AGENCY GROUP — Base Agent Class v3.0 (SH-ROS Final)
// Tenant-isolated, observable, deterministic, retry-safe
// AMI: 22506
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import type {
  AgentId, AgentConfig, AgentContext, AgentResult,
  AgentInsight, AgentAction, AgentStatus, AgentOutputContract,
} from './types'

// ─── In-process rate limiter ──────────────────────────────────────────────────
// Per-agent call log (timestamps). Not shared across serverless instances.
// TODO: CRITICAL #INFRA-011 — move to Supabase for multi-instance correctness.
// This Map resets on cold starts and is not shared across concurrent serverless
// instances, so agent rate limits are per-instance only. A parallel burst of
// requests across instances bypasses all per-agent call throttles entirely.

const _callLog = new Map<AgentId, number[]>()

export abstract class BaseAgent {
  abstract readonly id: AgentId
  abstract readonly name: string
  abstract readonly description: string
  abstract readonly config: AgentConfig

  /** Implement agent logic here. Return insights + actions + optional metadata. */
  protected abstract execute(ctx: AgentContext): Promise<{
    insights: AgentInsight[]
    actions: AgentAction[]
    metadata?: Record<string, unknown>
  }>

  // ─── PUBLIC: run ─────────────────────────────────────────────────────────────

  async run(ctx: AgentContext): Promise<AgentResult> {
    const started_at = new Date().toISOString()
    const start_ms   = Date.now()

    // Rate limit check
    if (!this._checkRateLimit()) {
      return this._errorResult(ctx, started_at, 'Rate limit exceeded')
    }

    let status: AgentStatus = ctx.dry_run ? 'dry_run_complete' : 'success'
    let insights: AgentInsight[]  = []
    let actions: AgentAction[]    = []
    let pendingApproval: AgentAction[] = []
    let error: string | null      = null
    let metadata: Record<string, unknown> = {}

    try {
      const executionResult = await Promise.race([
        this.execute(ctx),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`Agent timeout (${this.config.timeout_ms}ms)`)), this.config.timeout_ms)
        ),
      ])

      insights = executionResult.insights
      metadata = executionResult.metadata ?? {}

      // Classify and execute actions
      for (const action of executionResult.actions) {
        if (action.requires_approval || (action.risk === 'high' && this.config.require_human_approval)) {
          pendingApproval.push(action)
        } else if (!ctx.dry_run) {
          actions.push(action)
          await this._executeAction(action, ctx)
        } else {
          actions.push(action) // dry_run: record but don't execute
        }
      }
    } catch (err) {
      status = 'failed'
      error  = err instanceof Error ? err.message : String(err)
      console.error(`[Agent:${this.id}]`, { error, correlation_id: ctx.correlation_id, org_id: ctx.org_id })
    }

    const result: AgentResult = {
      agent_id:         this.id,
      org_id:           ctx.org_id,
      status,
      correlation_id:   ctx.correlation_id,
      started_at,
      completed_at:     new Date().toISOString(),
      duration_ms:      Date.now() - start_ms,
      dry_run:          ctx.dry_run,
      insights,
      actions,
      pending_approval: pendingApproval,
      error,
      metadata,
      output:           this._buildOutputContract(ctx, insights, actions, error),
    }

    // Non-blocking execution log — errors captured, never thrown
    void this._logExecution(result)
    return result
  }

  // ─── PRIVATE: rate limit ─────────────────────────────────────────────────────

  private _checkRateLimit(): boolean {
    const now       = Date.now()
    const window_ms = 3_600_000 // 1 hour
    const calls     = (_callLog.get(this.id) ?? []).filter(t => now - t < window_ms)
    if (calls.length >= this.config.rate_limit_per_hour) return false
    _callLog.set(this.id, [...calls, now])
    return true
  }

  // ─── PRIVATE: execute action ─────────────────────────────────────────────────

  private async _executeAction(action: AgentAction, ctx: AgentContext): Promise<void> {
    try {
      switch (action.type) {
        case 'create_task': {
          const { error } = await supabaseAdmin.from('operator_tasks').insert({
            task_type:   action.entity_type,
            title:       action.description,
            priority:    action.risk === 'high' ? 'high' : action.risk === 'medium' ? 'medium' : 'low',
            entity_type: action.entity_type,
            entity_id:   action.entity_id,
            metadata:    { ...action.payload, agent_id: this.id, correlation_id: ctx.correlation_id, org_id: ctx.org_id },
          })
          if (error) console.warn(`[Agent:${this.id}] create_task failed:`, error.message)
          break
        }

        case 'log_insight': {
          // Persist insight to learning_events for model feedback
          const { error } = await supabaseAdmin.from('learning_events').insert({
            event_type:    'agent_insight',
            source_system: 'agent',
            entity_type:   action.entity_type,
            entity_id:     action.entity_id,
            data: {
              agent_id:        this.id,
              description:     action.description,
              payload:         action.payload,
              correlation_id:  ctx.correlation_id,
              org_id:          ctx.org_id,
            },
          })
          if (error) console.warn(`[Agent:${this.id}] log_insight failed:`, error.message)
          break
        }

        case 'send_notification': {
          // Emit system alert for notification downstream consumers
          const { error } = await supabaseAdmin.from('system_alerts').insert({
            alert_type:    'agent_notification',
            severity:      action.risk === 'high' ? 'P1' : 'P2',
            title:         `[Agent] ${action.description.slice(0, 100)}`,
            message:       action.description,
            resource_type: this.id,                                        // agent id stored in resource_type
            resource_id:   action.entity_id ?? null,
            status:        'open' as const,
            metadata:      { ...action.payload, entity_type: action.entity_type, entity_id: action.entity_id },
          })
          if (error) console.warn(`[Agent:${this.id}] send_notification failed:`, error.message)
          break
        }

        case 'update_record': {
          // Generic update — entity_type determines the table
          // Safety: only allow known safe update targets
          const SAFE_TABLES = new Set(['contacts', 'deals', 'properties', 'operator_tasks'])
          const table = action.entity_type?.toLowerCase()
          if (!table || !SAFE_TABLES.has(table) || !action.entity_id) {
            console.warn(`[Agent:${this.id}] update_record: unsafe target '${table}'`)
            break
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const { error } = await (supabaseAdmin.from(table as any) as any)
            .update({ ...action.payload, updated_at: new Date().toISOString() })
            .eq('id', action.entity_id)
          if (error) console.warn(`[Agent:${this.id}] update_record failed:`, error.message)
          break
        }

        case 'escalate_human': {
          // High-priority task + P1 alert
          await Promise.all([
            supabaseAdmin.from('operator_tasks').insert({
              task_type:   'escalation',
              title:       `[ESCALATION] ${action.description}`,
              priority:    'critical',
              entity_type: action.entity_type,
              entity_id:   action.entity_id,
              metadata:    { ...action.payload, agent_id: this.id, org_id: ctx.org_id },
            }),
            supabaseAdmin.from('system_alerts').insert({
              alert_type:    'escalation',
              severity:      'P1',
              title:         `[ESCALATION] ${action.description.slice(0, 100)}`,
              message:       action.description,
              resource_type: this.id,                   // agent id stored in resource_type
              resource_id:   action.entity_id ?? null,
              status:        'open' as const,
              metadata:      action.payload ?? null,
            }),
          ]).then(results => {
            for (const { error } of results) {
              if (error) console.warn(`[Agent:${this.id}] escalate_human partial error:`, error.message)
            }
          })
          break
        }

        case 'trigger_workflow': {
          // Log to learning_events — actual n8n trigger is a downstream concern
          const { error } = await supabaseAdmin.from('learning_events').insert({
            event_type:    'workflow_trigger',
            source_system: 'agent',
            entity_type:   action.entity_type,
            entity_id:     action.entity_id,
            data: {
              agent_id:       this.id,
              workflow:       action.payload?.workflow_id ?? action.description,
              payload:        action.payload,
              correlation_id: ctx.correlation_id,
              org_id:         ctx.org_id,
            },
          })
          if (error) console.warn(`[Agent:${this.id}] trigger_workflow failed:`, error.message)
          break
        }

        default: {
          console.warn(`[Agent:${this.id}] unknown action type:`, (action as { type: string }).type)
        }
      }
    } catch (err) {
      console.error(`[Agent:${this.id}] _executeAction error`, { type: action.type, error: err instanceof Error ? err.message : String(err) })
    }
  }

  // ─── PRIVATE: execution log ──────────────────────────────────────────────────

  private async _logExecution(result: AgentResult): Promise<void> {
    try {
      const { error } = await supabaseAdmin.from('automations_log').insert({
        workflow_name:   `agent:${this.id}`,
        trigger_type:    'agent',
        status:          result.status === 'failed' ? 'error' : 'success',
        started_at:      result.started_at,
        completed_at:    result.completed_at,
        duration_ms:     result.duration_ms,
        outcome: {
          insights_count:  result.insights.length,
          actions_count:   result.actions.length,
          pending_count:   result.pending_approval.length,
          dry_run:         result.dry_run,
          org_id:          result.org_id,
          economic_impact: result.output.financial_impact,
          ev_score:        result.output.probability * result.output.financial_impact * result.output.confidence,
        },
        error_message:   result.error,
        automation_type: 'agent',
      })
      if (error) {
        // automations_log insert failed — log to console but never throw
        console.warn(`[Agent:${this.id}] _logExecution: automations_log insert failed:`, error.message)
      }
    } catch (err) {
      console.warn(`[Agent:${this.id}] _logExecution: unexpected error:`, err instanceof Error ? err.message : String(err))
    }
  }

  // ─── PRIVATE: output contract ────────────────────────────────────────────────

  /** Build the standardised flat output contract from execution results.
   *  EV formula inputs: probability × financial_impact × urgency × confidence × feasibility − (risk × penalty)
   *  probability: P(recommended action achieves outcome) — derived from confidence with a discount factor
   *  confidence: P(agent's analysis of the situation is correct)
   */
  private _buildOutputContract(
    ctx: AgentContext,
    insights: AgentInsight[],
    actions: AgentAction[],
    error: string | null,
  ): AgentOutputContract {
    const criticalInsights = insights.filter(i => i.severity === 'critical')
    const warningInsights  = insights.filter(i => i.severity === 'warning')
    const totalRevenue     = insights.reduce((s, i) => s + (i.revenue_impact_eur ?? 0), 0)
    const avgConfidence    = insights.length > 0
      ? insights.reduce((s, i) => s + i.confidence, 0) / insights.length
      : 0

    // probability = P(action succeeds | analysis is correct) = confidence × 0.85 discount
    // Distinct from confidence — represents execution uncertainty on top of analytical uncertainty
    const probability = parseFloat((avgConfidence * 0.85).toFixed(2))

    const priority: AgentOutputContract['priority'] =
      error                        ? 'critical' :
      criticalInsights.length > 0  ? 'critical' :
      warningInsights.length  > 0  ? 'high'     :
      insights.length         > 0  ? 'medium'   :
      'low'

    const topInsight = insights[0]?.summary ?? (error ? `Agent failed: ${error}` : 'No significant findings')

    const riskScore = error ? 1.0 :
      criticalInsights.length > 0 ? 0.85 :
      warningInsights.length  > 0 ? 0.55 :
      0.2

    return {
      agent:            this.name,
      org_id:           ctx.org_id,
      priority,
      financial_impact: Math.round(totalRevenue),
      insight:          topInsight,
      actions:          actions.map(a => a.description),
      probability,
      confidence:       parseFloat(avgConfidence.toFixed(2)),
      risk_score:       riskScore,
      next_events:      [], // agents override this to emit follow-up events
    }
  }

  // ─── PRIVATE: error result ───────────────────────────────────────────────────

  private _errorResult(ctx: AgentContext, started_at: string, error: string): AgentResult {
    return {
      agent_id:         this.id,
      org_id:           ctx.org_id,
      status:           'failed',
      correlation_id:   ctx.correlation_id,
      started_at,
      completed_at:     new Date().toISOString(),
      duration_ms:      0,
      dry_run:          ctx.dry_run,
      insights:         [],
      actions:          [],
      pending_approval: [],
      error,
      metadata:         {},
      output: {
        agent:            this.name,
        org_id:           ctx.org_id,
        priority:         'critical',
        financial_impact: 0,
        insight:          `Agent failed: ${error}`,
        actions:          [],
        probability:      0,
        confidence:       0,
        risk_score:       1.0,
        next_events:      [],
      },
    }
  }

  // ─── PUBLIC: context factory ─────────────────────────────────────────────────

  static createContext(opts: Partial<AgentContext> = {}): AgentContext {
    return {
      org_id:         opts.org_id         ?? 'default',
      correlation_id: opts.correlation_id ?? randomUUID(),
      triggered_by:   opts.triggered_by   ?? 'api',
      triggered_at:   opts.triggered_at   ?? new Date().toISOString(),
      dry_run:        opts.dry_run        ?? false,
      entity_type:    opts.entity_type,
      entity_id:      opts.entity_id,
      agent_email:    opts.agent_email,
      event_id:       opts.event_id,
      trigger_event:  opts.trigger_event,
    }
  }
}
