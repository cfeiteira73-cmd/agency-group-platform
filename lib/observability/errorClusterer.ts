// Agency Group — Error Clusterer
// lib/observability/errorClusterer.ts
// Groups errors by signature, computes frequency, detects error storms.
// Reads from siem_events (action='api_error'|'system_error') and trace_spans (status='error').
// TypeScript strict — 0 errors

import { createHash } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ErrorCluster {
  cluster_id: string
  signature: string
  error_message_pattern: string
  first_seen_at: string
  last_seen_at: string
  occurrence_count: number
  affected_components: string[]
  trend: 'INCREASING' | 'STABLE' | 'DECREASING' | 'NEW'
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
}

export interface ErrorClusterReport {
  tenant_id: string
  generated_at: string
  window_hours: number
  total_errors: number
  clusters: ErrorCluster[]
  error_storm_detected: boolean
  most_affected_component: string | null
}

// ─── computeErrorSignature ────────────────────────────────────────────────────

export function computeErrorSignature(message: string): string {
  // Normalize: lowercase, strip UUIDs, numbers, timestamps
  const normalized = message
    .toLowerCase()
    .slice(0, 120)
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, 'UUID')
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, 'TS')
    .replace(/\b\d+\b/g, 'N')
    .trim()

  return createHash('sha256').update(normalized).digest('hex').slice(0, 16)
}

// ─── buildErrorClusterReport ──────────────────────────────────────────────────

export async function buildErrorClusterReport(
  tenantId: string,
  windowHours = 24
): Promise<ErrorClusterReport> {
  const now = new Date()
  const windowStart = new Date(now.getTime() - windowHours * 60 * 60 * 1000).toISOString()
  const halfwayPoint = new Date(now.getTime() - (windowHours / 2) * 60 * 60 * 1000).toISOString()
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
  const generatedAt = now.toISOString()

  // Fetch siem_events errors
  const { data: siemData } = await sb
    .from('siem_events')
    .select('action, details, created_at, component, actor_id')
    .eq('tenant_id', tenantId)
    .in('action', ['api_error', 'system_error', 'auth_failure'])
    .gte('created_at', windowStart)
    .order('created_at', { ascending: true })

  // Fetch trace_spans errors
  const { data: spanData } = await sb
    .from('trace_spans')
    .select('operation, error_message, started_at, service')
    .eq('tenant_id', tenantId)
    .eq('status', 'error')
    .gte('started_at', windowStart)
    .order('started_at', { ascending: true })

  // Unify events into a common shape
  interface RawEvent {
    message: string
    component: string
    occurred_at: string
  }

  const events: RawEvent[] = []

  for (const row of (siemData ?? []) as Record<string, unknown>[]) {
    const details = row.details as Record<string, unknown> | null
    const msg =
      (details?.error as string) ??
      (details?.message as string) ??
      (row.action as string) ??
      'unknown'
    events.push({
      message: msg,
      component: (row.component as string | null) ?? (row.action as string) ?? 'unknown',
      occurred_at: row.created_at as string,
    })
  }

  for (const row of (spanData ?? []) as Record<string, unknown>[]) {
    events.push({
      message: (row.error_message as string | null) ?? (row.operation as string) ?? 'unknown',
      component: (row.service as string) ?? 'api',
      occurred_at: row.started_at as string,
    })
  }

  // Group by signature
  const clusterMap = new Map<
    string,
    {
      signature: string
      first_seen_at: string
      last_seen_at: string
      pattern: string
      components: Set<string>
      first_half_count: number
      second_half_count: number
      last_hour_count: number
      total: number
    }
  >()

  for (const ev of events) {
    const sig = computeErrorSignature(ev.message)
    const existing = clusterMap.get(sig)
    const inFirstHalf = ev.occurred_at < halfwayPoint
    const inLastHour = ev.occurred_at >= oneHourAgo

    if (!existing) {
      clusterMap.set(sig, {
        signature: sig,
        first_seen_at: ev.occurred_at,
        last_seen_at: ev.occurred_at,
        pattern: ev.message.slice(0, 80),
        components: new Set([ev.component]),
        first_half_count: inFirstHalf ? 1 : 0,
        second_half_count: inFirstHalf ? 0 : 1,
        last_hour_count: inLastHour ? 1 : 0,
        total: 1,
      })
    } else {
      existing.components.add(ev.component)
      if (ev.occurred_at < existing.first_seen_at) existing.first_seen_at = ev.occurred_at
      if (ev.occurred_at > existing.last_seen_at) existing.last_seen_at = ev.occurred_at
      existing.total++
      if (inFirstHalf) existing.first_half_count++
      else existing.second_half_count++
      if (inLastHour) existing.last_hour_count++
    }
  }

  // Build clusters
  const clusters: ErrorCluster[] = []
  let errorStormDetected = false

  for (const [, c] of clusterMap) {
    // Trend
    let trend: ErrorCluster['trend']
    if (c.first_half_count === 0 && c.second_half_count === 0) {
      trend = 'NEW'
    } else if (c.first_half_count === 0) {
      trend = 'NEW'
    } else {
      const ratio = c.second_half_count / (c.first_half_count || 1)
      if (ratio > 1.5) trend = 'INCREASING'
      else if (ratio < 0.5) trend = 'DECREASING'
      else trend = 'STABLE'
    }

    // Severity
    let severity: ErrorCluster['severity']
    if (c.total > 100) severity = 'CRITICAL'
    else if (c.total > 50) severity = 'HIGH'
    else if (c.total > 10) severity = 'MEDIUM'
    else severity = 'LOW'

    if (c.last_hour_count > 50) errorStormDetected = true

    clusters.push({
      cluster_id: `cluster_${c.signature}`,
      signature: c.signature,
      error_message_pattern: c.pattern,
      first_seen_at: c.first_seen_at,
      last_seen_at: c.last_seen_at,
      occurrence_count: c.total,
      affected_components: [...c.components],
      trend,
      severity,
    })
  }

  // Sort by occurrence descending
  clusters.sort((a, b) => b.occurrence_count - a.occurrence_count)

  // Most affected component
  const componentCounts = new Map<string, number>()
  for (const cluster of clusters) {
    for (const comp of cluster.affected_components) {
      componentCounts.set(comp, (componentCounts.get(comp) ?? 0) + cluster.occurrence_count)
    }
  }
  let mostAffectedComponent: string | null = null
  let maxCount = 0
  for (const [comp, count] of componentCounts) {
    if (count > maxCount) {
      maxCount = count
      mostAffectedComponent = comp
    }
  }

  const report: ErrorClusterReport = {
    tenant_id: tenantId,
    generated_at: generatedAt,
    window_hours: windowHours,
    total_errors: events.length,
    clusters,
    error_storm_detected: errorStormDetected,
    most_affected_component: mostAffectedComponent,
  }

  // Persist report (fire-and-forget)
  void sb
    .from('error_cluster_reports')
    .insert({
      tenant_id: tenantId,
      generated_at: generatedAt,
      window_hours: windowHours,
      total_errors: events.length,
      clusters: clusters,
      error_storm_detected: errorStormDetected,
      most_affected_component: mostAffectedComponent,
    })
    .then(({ error }: { error: unknown }) => {
      if (error) log.info('[errorClusterer] persist warn', { error })
    })
    .catch((e: unknown) => console.warn('[errorClusterer]', e))

  return report
}
