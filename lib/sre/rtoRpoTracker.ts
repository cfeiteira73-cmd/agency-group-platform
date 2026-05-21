// Agency Group — RTO/RPO Tracker
// lib/sre/rtoRpoTracker.ts
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── SLA Targets ─────────────────────────────────────────────────────────────

export const RTO_SLA_SECONDS: Record<string, number> = {
  'database':    300,
  'redis':       180,
  'kafka':       600,
  'ai-provider': 600,
  'queue':       300,
}

export const RPO_SLA_SECONDS: Record<string, number> = {
  'database':    60,
  'redis':       30,
  'kafka':       30,
  'ai-provider': 300,
  'queue':       120,
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RTOEvent {
  incident_id: string
  service: string
  region: string
  failure_detected_at: string
  recovery_completed_at: string
  rto_actual_seconds: number
  recovery_method: 'automatic' | 'manual' | 'hybrid'
  playbook_used: string | null
}

export interface RPOEvent {
  incident_id: string
  service: string
  last_committed_at: string
  recovery_point_at: string
  rpo_actual_seconds: number
  data_loss_detected: boolean
}

export interface RTORPOStats {
  service: string
  rto_p50_seconds: number
  rto_p95_seconds: number
  rpo_p50_seconds: number
  rpo_p95_seconds: number
  sla_rto_seconds: number
  sla_rpo_seconds: number
  sla_met_pct: number
  total_incidents: number
}

// ─── Percentile helper ────────────────────────────────────────────────────────

function percentile(sorted: number[], pct: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((pct / 100) * sorted.length) - 1
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))]
}

// ─── recordRTOEvent ───────────────────────────────────────────────────────────

export async function recordRTOEvent(
  event: Omit<RTOEvent, 'rto_actual_seconds'>,
  tenantId?: string,
): Promise<RTOEvent> {
  const detectedMs   = new Date(event.failure_detected_at).getTime()
  const recoveredMs  = new Date(event.recovery_completed_at).getTime()
  const rto_actual_seconds = Math.max(0, Math.round((recoveredMs - detectedMs) / 1000))

  const full: RTOEvent = { ...event, rto_actual_seconds }

  const sla_rto_seconds = RTO_SLA_SECONDS[event.service] ?? 600
  const sla_met = rto_actual_seconds <= sla_rto_seconds

  if (!sla_met) {
    log.warn('[RtoRpo] RTO SLA breach', {
      service:          event.service,
      rto_actual_seconds,
      sla_rto_seconds,
      incident_id:      event.incident_id,
    })
  }

  try {
    const { error } = await (supabaseAdmin as any)
      .from('rto_rpo_events')
      .insert({
        tenant_id:             tenantId ?? null,
        incident_id:           event.incident_id,
        event_type:            'rto',
        service:               event.service,
        region:                event.region,
        failure_detected_at:   event.failure_detected_at,
        recovery_completed_at: event.recovery_completed_at,
        actual_seconds:        rto_actual_seconds,
        sla_seconds:           sla_rto_seconds,
        sla_met,
        recovery_method:       event.recovery_method,
        playbook_used:         event.playbook_used,
      })

    if (error) {
      log.warn('[RtoRpo] recordRTOEvent insert error', { error: error.message })
    }
  } catch (err) {
    log.warn('[RtoRpo] recordRTOEvent threw', {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return full
}

// ─── recordRPOEvent ───────────────────────────────────────────────────────────

export async function recordRPOEvent(
  event: Omit<RPOEvent, 'rpo_actual_seconds'>,
  tenantId?: string,
): Promise<RPOEvent> {
  const lastCommit    = new Date(event.last_committed_at).getTime()
  const recoveryPoint = new Date(event.recovery_point_at).getTime()
  const rpo_actual_seconds = Math.max(0, Math.round((recoveryPoint - lastCommit) / 1000))

  const full: RPOEvent = { ...event, rpo_actual_seconds }

  const sla_rpo_seconds = RPO_SLA_SECONDS[event.service] ?? 120
  const sla_met = rpo_actual_seconds <= sla_rpo_seconds

  if (!sla_met) {
    log.warn('[RtoRpo] RPO SLA breach', {
      service:         event.service,
      rpo_actual_seconds,
      sla_rpo_seconds,
      incident_id:     event.incident_id,
    })
  }

  try {
    const { error } = await (supabaseAdmin as any)
      .from('rto_rpo_events')
      .insert({
        tenant_id:          tenantId ?? null,
        incident_id:        event.incident_id,
        event_type:         'rpo',
        service:            event.service,
        last_committed_at:  event.last_committed_at,
        recovery_point_at:  event.recovery_point_at,
        actual_seconds:     rpo_actual_seconds,
        sla_seconds:        sla_rpo_seconds,
        sla_met,
        data_loss_detected: event.data_loss_detected,
      })

    if (error) {
      log.warn('[RtoRpo] recordRPOEvent insert error', { error: error.message })
    }
  } catch (err) {
    log.warn('[RtoRpo] recordRPOEvent threw', {
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return full
}

// ─── computeRTORPOStats ───────────────────────────────────────────────────────

export async function computeRTORPOStats(
  service: string,
  tenantId: string,
  lookbackDays = 30,
): Promise<RTORPOStats> {
  const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000).toISOString()

  const sla_rto_seconds = RTO_SLA_SECONDS[service] ?? 600
  const sla_rpo_seconds = RPO_SLA_SECONDS[service] ?? 120

  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('rto_rpo_events')
      .select('event_type,actual_seconds,sla_met')
      .eq('tenant_id', tenantId)
      .eq('service', service)
      .gte('recorded_at', cutoff)
      .order('recorded_at', { ascending: true })

    if (error || !data) {
      return _emptyStats(service, sla_rto_seconds, sla_rpo_seconds)
    }

    const rows = data as Array<{
      event_type: string
      actual_seconds: number | null
      sla_met: boolean | null
    }>

    const rtoRows = rows.filter(r => r.event_type === 'rto' && r.actual_seconds !== null)
    const rpoRows = rows.filter(r => r.event_type === 'rpo' && r.actual_seconds !== null)

    const rtoValues = rtoRows.map(r => r.actual_seconds as number).sort((a, b) => a - b)
    const rpoValues = rpoRows.map(r => r.actual_seconds as number).sort((a, b) => a - b)

    const totalRtoIncidents = rtoRows.length
    const rtoMetCount = rtoRows.filter(r => r.sla_met === true).length
    const sla_met_pct = totalRtoIncidents > 0
      ? Math.round((rtoMetCount / totalRtoIncidents) * 1000) / 10
      : 100

    return {
      service,
      rto_p50_seconds: percentile(rtoValues, 50),
      rto_p95_seconds: percentile(rtoValues, 95),
      rpo_p50_seconds: percentile(rpoValues, 50),
      rpo_p95_seconds: percentile(rpoValues, 95),
      sla_rto_seconds,
      sla_rpo_seconds,
      sla_met_pct,
      total_incidents: totalRtoIncidents,
    }
  } catch (err) {
    log.warn('[RtoRpo] computeRTORPOStats threw', {
      error: err instanceof Error ? err.message : String(err),
      service,
    })
    return _emptyStats(service, sla_rto_seconds, sla_rpo_seconds)
  }
}

// ─── computeAllServicesStats ──────────────────────────────────────────────────

export async function computeAllServicesStats(
  tenantId: string,
  lookbackDays = 30,
): Promise<RTORPOStats[]> {
  const services = Object.keys(RTO_SLA_SECONDS)
  const results = await Promise.allSettled(
    services.map(s => computeRTORPOStats(s, tenantId, lookbackDays)),
  )
  return results
    .filter(r => r.status === 'fulfilled')
    .map(r => (r as PromiseFulfilledResult<RTORPOStats>).value)
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function _emptyStats(
  service: string,
  sla_rto_seconds: number,
  sla_rpo_seconds: number,
): RTORPOStats {
  return {
    service,
    rto_p50_seconds: 0,
    rto_p95_seconds: 0,
    rpo_p50_seconds: 0,
    rpo_p95_seconds: 0,
    sla_rto_seconds,
    sla_rpo_seconds,
    sla_met_pct:     100,
    total_incidents: 0,
  }
}
