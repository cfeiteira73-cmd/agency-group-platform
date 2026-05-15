// AGENCY GROUP — SH-ROS Learning: Shadow Execution Engine | AMI: 22506
// Phase Ω∞-8: Run candidate logic in shadow without affecting production
// Compare shadow vs production outcomes for safe A/B validation
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ShadowConfig {
  experiment_id: string
  shadow_pct: number    // 0-100: % of events processed in shadow mode
  org_id?: string       // null = apply to all orgs
  active: boolean
}

export interface ShadowRun {
  run_id: string
  experiment_id: string
  org_id: string
  event_id: string
  production_result: Record<string, unknown>
  shadow_result: Record<string, unknown>
  diverged: boolean
  divergence_keys: string[]    // which output fields differ
  production_latency_ms: number
  shadow_latency_ms: number
  created_at: string
}

export interface ShadowDivergenceReport {
  experiment_id: string
  total_runs: number
  diverged_runs: number
  divergence_rate: number
  avg_production_latency_ms: number
  avg_shadow_latency_ms: number
  top_divergence_keys: Array<{ key: string; count: number; pct: number }>
  recommendation: 'promote' | 'reject' | 'investigate'
}

// ─── Shadow Execution Engine ──────────────────────────────────────────────────

export class ShadowExecutionEngine {
  private _configs = new Map<string, ShadowConfig>()

  /**
   * Register a shadow experiment configuration.
   */
  registerExperiment(config: ShadowConfig): void {
    this._configs.set(config.experiment_id, config)
    logger.info('[Shadow] Experiment registered', {
      experiment_id: config.experiment_id,
      shadow_pct: config.shadow_pct,
    })
  }

  /**
   * Execute a function in both production and shadow mode.
   * Returns the PRODUCTION result — shadow runs async and is logged only.
   * Shadow failures never affect production.
   */
  async execute<T extends Record<string, unknown>>(opts: {
    experiment_id: string
    event_id: string
    org_id: string
    production: () => Promise<T>
    shadow: () => Promise<T>
  }): Promise<T> {
    const config = this._configs.get(opts.experiment_id)
    const shouldShadow = config?.active && Math.random() * 100 < (config.shadow_pct ?? 0)

    // Always run production
    const prodStart = Date.now()
    const production_result = await opts.production()
    const production_latency_ms = Date.now() - prodStart

    // Shadow runs in background — never awaited on hot path
    if (shouldShadow) {
      this._runShadow({
        experiment_id: opts.experiment_id,
        event_id: opts.event_id,
        org_id: opts.org_id,
        production_result,
        production_latency_ms,
        shadowFn: opts.shadow,
      }).catch(err => {
        logger.error('[Shadow] Shadow run failed (non-blocking)', {
          experiment_id: opts.experiment_id,
          error: String(err),
        })
      })
    }

    return production_result
  }

  private async _runShadow(opts: {
    experiment_id: string
    event_id: string
    org_id: string
    production_result: Record<string, unknown>
    production_latency_ms: number
    shadowFn: () => Promise<Record<string, unknown>>
  }): Promise<void> {
    const run_id = randomUUID()
    const shadowStart = Date.now()
    let shadow_result: Record<string, unknown> = {}
    let shadow_error = false

    try {
      shadow_result = await opts.shadowFn()
    } catch (err) {
      logger.warn('[Shadow] Shadow function threw', { run_id, error: String(err) })
      shadow_result = { __error: String(err) }
      shadow_error = true
    }

    const shadow_latency_ms = Date.now() - shadowStart

    // Compute divergence
    const { diverged, divergence_keys } = this._computeDivergence(
      opts.production_result,
      shadow_result
    )

    if (diverged) {
      logger.warn('[Shadow] Divergence detected', {
        run_id,
        experiment_id: opts.experiment_id,
        divergence_keys,
        shadow_error,
      })
    }

    // Persist shadow run
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    await (sb.from('learning_events') as {
      insert: (d: unknown) => Promise<{ error: unknown }>
    }).insert({
      event_type: 'shadow_execution_run',
      org_id: opts.org_id,
      metadata: {
        run_id,
        experiment_id: opts.experiment_id,
        event_id: opts.event_id,
        production_result: opts.production_result,
        shadow_result,
        diverged,
        divergence_keys,
        production_latency_ms: opts.production_latency_ms,
        shadow_latency_ms,
        shadow_error,  // extra field beyond ShadowRun, stored in DB metadata
      } as Record<string, unknown>,
      created_at: new Date().toISOString(),
    })
  }

  /**
   * Compute field-level divergence between production and shadow outputs.
   */
  private _computeDivergence(
    prod: Record<string, unknown>,
    shadow: Record<string, unknown>
  ): { diverged: boolean; divergence_keys: string[] } {
    const allKeys = new Set([...Object.keys(prod), ...Object.keys(shadow)])
    const divergence_keys: string[] = []

    for (const key of allKeys) {
      if (JSON.stringify(prod[key]) !== JSON.stringify(shadow[key])) {
        divergence_keys.push(key)
      }
    }

    return { diverged: divergence_keys.length > 0, divergence_keys }
  }

  /**
   * Generate a divergence report for an experiment.
   */
  async getDivergenceReport(
    experiment_id: string,
    org_id?: string,
    period_hours = 24
  ): Promise<ShadowDivergenceReport> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    const since = new Date(Date.now() - period_hours * 3_600_000).toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from('learning_events') as any)
      .select('metadata, created_at')
      .eq('event_type', 'shadow_execution_run')
      .contains('metadata', { experiment_id })
      .gte('created_at', since)
      .limit(500)

    if (org_id) q = q.eq('org_id', org_id)
    const { data, error } = await q

    if (error || !data || data.length === 0) {
      return {
        experiment_id,
        total_runs: 0,
        diverged_runs: 0,
        divergence_rate: 0,
        avg_production_latency_ms: 0,
        avg_shadow_latency_ms: 0,
        top_divergence_keys: [],
        recommendation: 'investigate',
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data ?? []).map((r: any) => r.metadata as ShadowRun)
    const diverged_rows = rows.filter((r: ShadowRun) => r.diverged)
    const keyCount: Record<string, number> = {}

    for (const row of diverged_rows) {
      for (const key of row.divergence_keys ?? []) {
        keyCount[key] = (keyCount[key] ?? 0) + 1
      }
    }

    const top_divergence_keys = Object.entries(keyCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([key, count]) => ({
        key,
        count,
        pct: rows.length > 0 ? Math.round((count / rows.length) * 1000) / 10 : 0,
      }))

    const avg_prod_lat = rows.reduce((s: number, r: ShadowRun) => s + (r.production_latency_ms ?? 0), 0) / rows.length
    const avg_shadow_lat = rows.reduce((s: number, r: ShadowRun) => s + (r.shadow_latency_ms ?? 0), 0) / rows.length

    const divergence_rate = rows.length > 0 ? diverged_rows.length / rows.length : 0

    let recommendation: 'promote' | 'reject' | 'investigate' = 'investigate'
    if (rows.length >= 100) {
      if (divergence_rate < 0.02) recommendation = 'promote'
      else if (divergence_rate > 0.10) recommendation = 'reject'
    }

    return {
      experiment_id,
      total_runs: rows.length,
      diverged_runs: diverged_rows.length,
      divergence_rate: Math.round(divergence_rate * 1000) / 10,
      avg_production_latency_ms: Math.round(avg_prod_lat),
      avg_shadow_latency_ms: Math.round(avg_shadow_lat),
      top_divergence_keys,
      recommendation,
    }
  }
}

export const shadowExecutionEngine = new ShadowExecutionEngine()
