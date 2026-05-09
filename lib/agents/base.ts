// =============================================================================
// AGENCY GROUP — Base Agent Class v1.0
// Extend this to build any SH-ROS operational agent
// AMI: 22506
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import type {
  AgentId, AgentConfig, AgentContext, AgentResult,
  AgentInsight, AgentAction, AgentStatus,
} from './types'

// In-process rate limiter (per-agent)
const _callLog = new Map<AgentId, number[]>()

export abstract class BaseAgent {
  abstract readonly id: AgentId
  abstract readonly name: string
  abstract readonly description: string
  abstract readonly config: AgentConfig

  /** Implement agent logic here. Return insights + actions. */
  protected abstract execute(ctx: AgentContext): Promise<{
    insights: AgentInsight[]
    actions: AgentAction[]
    metadata?: Record<string, unknown>
  }>

  /** Run the agent with full lifecycle management */
  async run(ctx: AgentContext): Promise<AgentResult> {
    const started_at = new Date().toISOString()
    const start_ms = Date.now()

    // Rate limit check
    if (!this._checkRateLimit()) {
      return this._errorResult(ctx, started_at, 'Rate limit exceeded')
    }

    let status: AgentStatus = ctx.dry_run ? 'dry_run_complete' : 'success'
    let insights: AgentInsight[] = []
    let actions: AgentAction[] = []
    let pendingApproval: AgentAction[] = []
    let error: string | null = null
    let metadata: Record<string, unknown> = {}

    try {
      const result = await Promise.race([
        this.execute(ctx),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Agent timeout')), this.config.timeout_ms)
        ),
      ])

      insights = result.insights
      metadata = result.metadata ?? {}

      // Classify actions
      for (const action of result.actions) {
        if (action.requires_approval || (action.risk === 'high' && this.config.require_human_approval)) {
          pendingApproval.push(action)
        } else if (!ctx.dry_run) {
          actions.push(action)
          await this._executeAction(action, ctx)
        } else {
          actions.push(action) // In dry_run, record but don't execute
        }
      }
    } catch (err) {
      status = 'failed'
      error = err instanceof Error ? err.message : String(err)
      console.error(`[Agent:${this.id}] execution failed`, { error, correlation_id: ctx.correlation_id })
    }

    const result: AgentResult = {
      agent_id:        this.id,
      status,
      correlation_id:  ctx.correlation_id,
      started_at,
      completed_at:    new Date().toISOString(),
      duration_ms:     Date.now() - start_ms,
      dry_run:         ctx.dry_run,
      insights,
      actions,
      pending_approval: pendingApproval,
      error,
      metadata,
    }

    // Non-blocking logging
    void this._logExecution(result)
    return result
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private _checkRateLimit(): boolean {
    const now = Date.now()
    const window_ms = 3_600_000 // 1 hour
    const calls = (_callLog.get(this.id) ?? []).filter(t => now - t < window_ms)
    if (calls.length >= this.config.rate_limit_per_hour) return false
    _callLog.set(this.id, [...calls, now])
    return true
  }

  private async _executeAction(action: AgentAction, ctx: AgentContext): Promise<void> {
    if (action.type === 'create_task') {
      await supabaseAdmin.from('operator_tasks').insert({
        task_type:   action.entity_type,
        title:       action.description,
        priority:    action.risk === 'high' ? 'high' : action.risk === 'medium' ? 'medium' : 'low',
        entity_type: action.entity_type,
        entity_id:   action.entity_id,
        metadata:    { ...action.payload, agent_id: this.id, correlation_id: ctx.correlation_id },
      }).then(({ error }) => { if (error) console.warn(`[Agent:${this.id}] task insert error`, error.message) })
    }
    // Other action types are no-ops here — handled by downstream consumers
  }

  private async _logExecution(result: AgentResult): Promise<void> {
    try {
      await supabaseAdmin.from('automations_log').insert({
        workflow_name: `agent:${this.id}`,
        trigger_type:  'agent',
        status:        result.status === 'failed' ? 'error' : 'success',
        started_at:    result.started_at,
        completed_at:  result.completed_at,
        duration_ms:   result.duration_ms,
        outcome: {
          insights_count: result.insights.length,
          actions_count:  result.actions.length,
          pending_count:  result.pending_approval.length,
          dry_run:        result.dry_run,
        },
        error_message: result.error,
        automation_type: 'agent',
      })
    } catch {
      // Best-effort
    }
  }

  private _errorResult(ctx: AgentContext, started_at: string, error: string): AgentResult {
    return {
      agent_id:        this.id,
      status:          'failed',
      correlation_id:  ctx.correlation_id,
      started_at,
      completed_at:    new Date().toISOString(),
      duration_ms:     0,
      dry_run:         ctx.dry_run,
      insights:        [],
      actions:         [],
      pending_approval: [],
      error,
      metadata:        {},
    }
  }

  /** Helper to create a typed context */
  static createContext(opts: Partial<AgentContext> = {}): AgentContext {
    return {
      correlation_id: opts.correlation_id ?? randomUUID(),
      triggered_by:   opts.triggered_by ?? 'api',
      triggered_at:   opts.triggered_at ?? new Date().toISOString(),
      dry_run:        opts.dry_run ?? false,
      entity_type:    opts.entity_type,
      entity_id:      opts.entity_id,
      agent_email:    opts.agent_email,
    }
  }
}
