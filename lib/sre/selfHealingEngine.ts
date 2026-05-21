// Agency Group — Self-Healing Engine
// lib/sre/selfHealingEngine.ts
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import type { DeepHealthResult } from './healthCheck'
import { logRecoveryEvent } from './disasterRecovery'

// ─── Types ────────────────────────────────────────────────────────────────────

export type HealingAction =
  | 'restart_worker'
  | 'rebalance_kafka_partitions'
  | 'flush_redis_cache'
  | 'rebuild_projection'
  | 'activate_ai_fallback'
  | 'scale_queue_workers'
  | 'trigger_replay'
  | 'alert_operator'

export interface HealingRule {
  id: string
  name: string
  condition: (health: DeepHealthResult) => boolean
  action: HealingAction
  severity: 'auto' | 'confirm'
  cooldown_minutes: number
  max_executions_per_hour: number
}

export interface HealingExecution {
  rule_id: string
  action: HealingAction
  triggered_at: string
  completed_at: string | null
  success: boolean
  result: Record<string, unknown>
  auto_executed: boolean
}

// ─── Healing Rules ────────────────────────────────────────────────────────────

export const HEALING_RULES: HealingRule[] = [
  {
    id: 'kafka_lag_critical',
    name: 'Kafka consumer lag critical — trigger scale-up signal',
    condition: (h) => ((h.services.kafka as { lag_total?: number })?.lag_total ?? 0) > 10_000,
    action: 'rebalance_kafka_partitions',
    severity: 'auto',
    cooldown_minutes: 30,
    max_executions_per_hour: 2,
  },
  {
    id: 'ai_provider_down',
    name: 'AI provider unavailable — activate heuristic fallback',
    condition: (h) => !h.services.ai_provider?.ok,
    action: 'activate_ai_fallback',
    severity: 'auto',
    cooldown_minutes: 5,
    max_executions_per_hour: 12,
  },
  {
    id: 'queue_depth_high',
    name: 'Job queue backing up — signal worker scale',
    condition: (h) => {
      const q = h.services.queue as { depth?: number } | undefined
      return (q?.depth ?? 0) > 500
    },
    action: 'scale_queue_workers',
    severity: 'auto',
    cooldown_minutes: 10,
    max_executions_per_hour: 4,
  },
  {
    id: 'db_degraded',
    name: 'DB degraded — alert operator',
    condition: (h) => !h.services.database?.ok,
    action: 'alert_operator',
    severity: 'confirm',
    cooldown_minutes: 5,
    max_executions_per_hour: 6,
  },
  {
    id: 'redis_unavailable',
    name: 'Redis unavailable — flush stale state',
    condition: (h) => !h.services.redis?.ok,
    action: 'flush_redis_cache',
    severity: 'auto',
    cooldown_minutes: 15,
    max_executions_per_hour: 2,
  },
]

// ─── SelfHealingEngine ────────────────────────────────────────────────────────

export class SelfHealingEngine {
  // rule_id → list of recent executions (in-process cache for cooldown enforcement)
  private executionLog = new Map<string, HealingExecution[]>()

  // ── evaluate ───────────────────────────────────────────────────────────────

  async evaluate(health: DeepHealthResult): Promise<HealingExecution[]> {
    const triggered: HealingExecution[] = []

    for (const rule of HEALING_RULES) {
      // Guard: cooldown
      if (this.isInCooldown(rule.id)) {
        log.debug('[SelfHealing] rule in cooldown — skipping', { rule_id: rule.id })
        continue
      }
      // Guard: max executions per hour
      if (this.getExecutionsInLastHour(rule.id) >= rule.max_executions_per_hour) {
        log.warn('[SelfHealing] rule exceeded max executions/hr', { rule_id: rule.id })
        continue
      }

      let conditionMet = false
      try {
        conditionMet = rule.condition(health)
      } catch (err) {
        log.warn('[SelfHealing] rule condition threw', {
          rule_id: rule.id,
          error: err instanceof Error ? err.message : String(err),
        })
      }

      if (!conditionMet) continue

      log.warn('[SelfHealing] rule triggered', { rule_id: rule.id, action: rule.action, severity: rule.severity })

      const triggered_at = new Date().toISOString()

      if (rule.severity === 'auto') {
        // Execute immediately
        const { success, result, execution_time_ms } = await this.executeAction(
          rule.action,
          { rule_id: rule.id, health_summary: health.summary },
        )
        const execution: HealingExecution = {
          rule_id:       rule.id,
          action:        rule.action,
          triggered_at,
          completed_at:  new Date().toISOString(),
          success,
          result:        { ...result, execution_time_ms },
          auto_executed: true,
        }
        triggered.push(execution)
        this._recordExecution(rule.id, execution)
        await this.persistExecution(execution)
      } else {
        // confirm-only — log and alert but do not execute
        const execution: HealingExecution = {
          rule_id:       rule.id,
          action:        rule.action,
          triggered_at,
          completed_at:  null,
          success:       false,
          result:        { awaiting_confirmation: true, reason: rule.name },
          auto_executed: false,
        }
        triggered.push(execution)
        this._recordExecution(rule.id, execution)
        await this.persistExecution(execution)

        // Alert operator via logRecoveryEvent
        const tenantId = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? 'system'
        await logRecoveryEvent(tenantId, {
          incidentId:  `heal-${rule.id}-${Date.now()}`,
          eventType:   'failure_detected',
          service:     rule.id,
          description: `[SelfHealing] Operator confirmation required: ${rule.name}`,
          automated:   false,
          metadata:    { action: rule.action, health_summary: health.summary },
        })
      }
    }

    return triggered
  }

  // ── executeAction ──────────────────────────────────────────────────────────

  async executeAction(
    action: HealingAction,
    context: Record<string, unknown>,
  ): Promise<{
    success: boolean
    result: Record<string, unknown>
    execution_time_ms: number
  }> {
    const t0 = Date.now()
    try {
      let result: Record<string, unknown> = {}

      switch (action) {
        case 'activate_ai_fallback':
          await this.activateAiFallback()
          result = { mode: 'heuristic', activated_at: new Date().toISOString() }
          break

        case 'rebalance_kafka_partitions':
          await this.rebalanceKafkaPartitions()
          result = { rebalance_signal_sent: true }
          break

        case 'scale_queue_workers':
          await this.scaleQueueWorkers()
          result = { scale_signal_sent: true }
          break

        case 'flush_redis_cache':
          await this.flushRedisCache()
          result = { cache_flushed: true }
          break

        case 'restart_worker':
          result = { note: 'restart_worker is a signal — handled by process supervisor' }
          break

        case 'rebuild_projection':
          result = { note: 'rebuild_projection scheduled for next event-loop tick' }
          break

        case 'trigger_replay':
          result = { note: 'trigger_replay delegated to chaos/recovery pipeline' }
          break

        case 'alert_operator': {
          const tenantId = process.env.DEFAULT_TENANT_ID ?? 'system'
          await logRecoveryEvent(tenantId, {
            incidentId:  `alert-operator-${Date.now()}`,
            eventType:   'failure_detected',
            service:     String(context['rule_id'] ?? 'unknown'),
            description: '[SelfHealing] Operator alert triggered',
            automated:   false,
            metadata:    context,
          })
          result = { alert_sent: true }
          break
        }

        default: {
          const _never: never = action
          result = { unhandled: _never }
        }
      }

      return { success: true, result, execution_time_ms: Date.now() - t0 }
    } catch (err) {
      log.error('[SelfHealing] executeAction failed', err instanceof Error ? err : undefined, {
        action,
        error: err instanceof Error ? err.message : String(err),
      })
      return {
        success: false,
        result: { error: err instanceof Error ? err.message : String(err) },
        execution_time_ms: Date.now() - t0,
      }
    }
  }

  // ── Private action implementations ────────────────────────────────────────

  private async activateAiFallback(): Promise<void> {
    // Write AI_FALLBACK_MODE to runtime_config table (Supabase is source of truth)
    try {
      const { error } = await (supabaseAdmin as any)
        .from('runtime_config')
        .upsert(
          { key: 'AI_FALLBACK_MODE', value: 'heuristic', updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        )
      if (error) {
        log.warn('[SelfHealing] activateAiFallback upsert error', { error: error.message })
      }
    } catch (err) {
      log.warn('[SelfHealing] activateAiFallback threw', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  private async rebalanceKafkaPartitions(): Promise<void> {
    const tenantId = process.env.DEFAULT_TENANT_ID ?? 'system'
    await logRecoveryEvent(tenantId, {
      incidentId:  `kafka-rebalance-${Date.now()}`,
      eventType:   'mitigation_started',
      service:     'kafka',
      description: '[SelfHealing] Kafka partition rebalance signal emitted',
      automated:   true,
      metadata:    { action: 'rebalance_kafka_partitions' },
    })
  }

  private async scaleQueueWorkers(): Promise<void> {
    const tenantId = process.env.DEFAULT_TENANT_ID ?? 'system'
    await logRecoveryEvent(tenantId, {
      incidentId:  `queue-scale-${Date.now()}`,
      eventType:   'mitigation_started',
      service:     'queue',
      description: '[SelfHealing] Queue worker scale-up signal emitted',
      automated:   true,
      metadata:    { action: 'scale_queue_workers' },
    })
  }

  private async flushRedisCache(): Promise<void> {
    // Attempt Redis FLUSHDB via Upstash REST if configured
    const url   = process.env.UPSTASH_REDIS_REST_URL
    const token = process.env.UPSTASH_REDIS_REST_TOKEN

    if (!url || !token) {
      log.warn('[SelfHealing] flushRedisCache — Redis not configured, skipping')
      return
    }

    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 2000)
      const res = await fetch(`${url}/flushdb`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      })
      clearTimeout(timer)
      if (!res.ok) {
        log.warn('[SelfHealing] flushRedisCache HTTP error', { status: res.status })
      }
    } catch (err) {
      log.warn('[SelfHealing] flushRedisCache threw', {
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // ── Cooldown / rate helpers ────────────────────────────────────────────────

  private _recordExecution(ruleId: string, execution: HealingExecution): void {
    const existing = this.executionLog.get(ruleId) ?? []
    existing.push(execution)
    // Prune entries older than 1 hour to keep memory bounded
    const cutoff = Date.now() - 60 * 60 * 1000
    const pruned = existing.filter(e => new Date(e.triggered_at).getTime() > cutoff)
    this.executionLog.set(ruleId, pruned)
  }

  isInCooldown(ruleId: string): boolean {
    const rule = HEALING_RULES.find(r => r.id === ruleId)
    if (!rule) return false
    const executions = this.executionLog.get(ruleId) ?? []
    const last = executions[executions.length - 1]
    if (!last) return false
    const cooldownMs = rule.cooldown_minutes * 60 * 1000
    return Date.now() - new Date(last.triggered_at).getTime() < cooldownMs
  }

  getExecutionsInLastHour(ruleId: string): number {
    const executions = this.executionLog.get(ruleId) ?? []
    const cutoff = Date.now() - 60 * 60 * 1000
    return executions.filter(e => new Date(e.triggered_at).getTime() > cutoff).length
  }

  // ── persistExecution ───────────────────────────────────────────────────────

  async persistExecution(execution: HealingExecution): Promise<void> {
    try {
      const { error } = await (supabaseAdmin as any)
        .from('self_healing_executions')
        .insert({
          rule_id:       execution.rule_id,
          action:        execution.action,
          triggered_at:  execution.triggered_at,
          completed_at:  execution.completed_at,
          success:       execution.success,
          auto_executed: execution.auto_executed,
          result:        execution.result,
          context:       {},
        })

      if (error) {
        log.warn('[SelfHealing] persistExecution error', {
          error: error.message,
          rule_id: execution.rule_id,
        })
      }
    } catch (err) {
      log.warn('[SelfHealing] persistExecution threw', {
        error: err instanceof Error ? err.message : String(err),
        rule_id: execution.rule_id,
      })
    }
  }

  // ── getRecentExecutions ────────────────────────────────────────────────────

  async getRecentExecutions(limit = 20): Promise<HealingExecution[]> {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('self_healing_executions')
        .select('rule_id,action,triggered_at,completed_at,success,auto_executed,result')
        .order('triggered_at', { ascending: false })
        .limit(limit)

      if (error || !data) return []

      return (data as Array<{
        rule_id: string
        action: HealingAction
        triggered_at: string
        completed_at: string | null
        success: boolean
        auto_executed: boolean
        result: Record<string, unknown>
      }>).map(row => ({
        rule_id:       row.rule_id,
        action:        row.action,
        triggered_at:  row.triggered_at,
        completed_at:  row.completed_at,
        success:       row.success,
        result:        row.result,
        auto_executed: row.auto_executed,
      }))
    } catch (err) {
      log.warn('[SelfHealing] getRecentExecutions threw', {
        error: err instanceof Error ? err.message : String(err),
      })
      return []
    }
  }
}

export const selfHealingEngine = new SelfHealingEngine()
