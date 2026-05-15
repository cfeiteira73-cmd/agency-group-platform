// AGENCY GROUP — SH-ROS Ω∞∞ Forensics: retryTopology | AMI: 22506
// Maps retry storm topology — cascading retry chains
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

export interface RetryNode {
  event_id: string
  attempt_number: number
  timestamp: string
  failure_reason?: string
  backoff_ms: number
  agent_id?: string
  status: 'retried' | 'dlq' | 'succeeded'
}

export interface RetryTopologyData {
  root_event_id: string
  org_id: string
  total_attempts: number
  total_duration_ms: number
  total_backoff_ms: number
  final_outcome: 'success' | 'dlq' | 'abandoned'
  retry_chain: RetryNode[]
  failure_pattern: string
  estimated_cost_eur: number
}

const COST_PER_MS_EUR = 0.000001

export class RetryTopologyAnalyzer {
  async analyzeRetryChain(
    root_event_id: string,
    org_id: string
  ): Promise<RetryTopologyData> {
    const { data } = await sb
      .from('learning_events')
      .select('metadata, created_at, event_type')
      .eq('org_id', org_id)
      .contains('metadata', { root_event_id })
      .order('created_at', { ascending: true })
      .limit(50)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events: any[] = data ?? []

    const retry_chain: RetryNode[] = events.map((e: any, i: number) => {
      const meta = (e.metadata as Record<string, unknown>) ?? {}
      return {
        event_id: (meta['event_id'] as string) ?? `retry-${i}`,
        attempt_number: (meta['retry_count'] as number) ?? i,
        timestamp: e.created_at as string,
        failure_reason: (meta['error'] as string) ?? undefined,
        backoff_ms: (meta['backoff_ms'] as number) ?? 0,
        agent_id: (meta['agent_id'] as string) ?? undefined,
        status: this._classifyStatus(meta),
      }
    })

    const last = retry_chain[retry_chain.length - 1]
    const final_outcome: RetryTopologyData['final_outcome'] =
      last?.status === 'succeeded' ? 'success'
      : last?.status === 'dlq' ? 'dlq'
      : 'abandoned'

    const total_backoff_ms = retry_chain.reduce((s, n) => s + n.backoff_ms, 0)
    const total_duration_ms = retry_chain.length >= 2
      ? new Date(retry_chain[retry_chain.length - 1].timestamp).getTime() -
        new Date(retry_chain[0].timestamp).getTime()
      : 0

    const failure_pattern = this._classifyPattern(retry_chain)
    const estimated_cost_eur = total_duration_ms * COST_PER_MS_EUR * retry_chain.length

    logger.info('[RetryTopology] Chain analyzed', {
      root_event_id, org_id, attempts: retry_chain.length, final_outcome,
    })

    return {
      root_event_id, org_id,
      total_attempts: retry_chain.length,
      total_duration_ms,
      total_backoff_ms,
      final_outcome,
      retry_chain,
      failure_pattern,
      estimated_cost_eur: Math.round(estimated_cost_eur * 10000) / 10000,
    }
  }

  async getRetryStorms(
    org_id: string,
    period_hours = 24
  ): Promise<RetryTopologyData[]> {
    const from = new Date(Date.now() - period_hours * 3_600_000).toISOString()

    const { data } = await sb
      .from('learning_events')
      .select('metadata')
      .eq('org_id', org_id)
      .gte('created_at', from)
      .limit(2000)

    // Find distinct root_event_ids that appear > 3 times
    const rootCounts: Record<string, number> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const e of (data ?? []) as any[]) {
      const meta = (e.metadata as Record<string, unknown>) ?? {}
      const root = (meta['root_event_id'] as string) ?? null
      if (root) rootCounts[root] = (rootCounts[root] ?? 0) + 1
    }

    const stormRoots = Object.entries(rootCounts)
      .filter(([, count]) => count > 3)
      .map(([root]) => root)

    const results: RetryTopologyData[] = []
    for (const root of stormRoots.slice(0, 20)) {
      results.push(await this.analyzeRetryChain(root, org_id))
    }

    return results
  }

  private _classifyStatus(meta: Record<string, unknown>): RetryNode['status'] {
    if (meta['status'] === 'dlq') return 'dlq'
    if (meta['status'] === 'completed' || meta['outcome'] === 'success') return 'succeeded'
    return 'retried'
  }

  private _classifyPattern(chain: RetryNode[]): string {
    if (chain.length <= 1) return 'no_retry'
    const errors = chain.map((n) => n.failure_reason ?? '').filter(Boolean)
    if (errors.every((e) => e.includes('timeout'))) return 'intermittent_timeout'
    if (errors.every((e) => e.includes('rate_limit'))) return 'rate_limit_exhaustion'
    const backoffs = chain.map((n) => n.backoff_ms)
    const isExponential = backoffs.every((b, i) => i === 0 || b >= backoffs[i - 1])
    if (isExponential && chain[chain.length - 1]?.status === 'dlq') return 'permanent_failure'
    return 'transient_failure'
  }
}

export const retryTopologyAnalyzer = new RetryTopologyAnalyzer()
