// AGENCY GROUP — SH-ROS: Incident Governance Engine | AMI: 22506
// Phase Ω∞-11: Structured P1-P4 incident management with SLO tracking
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { signedAuditChain } from '@/lib/security/signedAuditChain'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type IncidentSeverity = 'P1' | 'P2' | 'P3' | 'P4'
export type IncidentStatus = 'open' | 'investigating' | 'mitigating' | 'resolved' | 'postmortem'

export interface SLOThresholds {
  ack_minutes: number      // time to acknowledge
  resolve_minutes: number  // time to resolve (MTTR target)
}

export const SLO_BY_SEVERITY: Record<IncidentSeverity, SLOThresholds> = {
  P1: { ack_minutes: 5,  resolve_minutes: 60  },   // Revenue impact, system down
  P2: { ack_minutes: 15, resolve_minutes: 240  },  // Significant degradation
  P3: { ack_minutes: 60, resolve_minutes: 1440 },  // Minor degradation
  P4: { ack_minutes: 240, resolve_minutes: 4320 }, // Informational
}

export interface IncidentRecord {
  incident_id: string
  org_id: string | null
  title: string
  severity: IncidentSeverity
  status: IncidentStatus
  detected_at: string
  acknowledged_at: string | null
  resolved_at: string | null
  mttr_minutes: number | null
  root_cause: string | null
  impact_summary: string | null
  affected_orgs: string[]
  slo_breached: boolean
  timeline: Array<{ ts: string; actor: string; note: string }>
}

export interface IncidentCreated {
  incident_id: string
  severity: IncidentSeverity
  ack_deadline: string
  resolve_deadline: string
  slo: SLOThresholds
}

// ─── Incident Governance Engine ───────────────────────────────────────────────

export class IncidentGovernanceEngine {
  /**
   * Open a new incident.
   */
  async openIncident(opts: {
    title: string
    severity: IncidentSeverity
    impact_summary?: string
    affected_orgs?: string[]
    org_id?: string
    detected_by?: string
  }): Promise<IncidentCreated> {
    const incident_id = randomUUID()
    const now = new Date().toISOString()
    const slo = SLO_BY_SEVERITY[opts.severity]
    const ack_deadline = new Date(Date.now() + slo.ack_minutes * 60_000).toISOString()
    const resolve_deadline = new Date(Date.now() + slo.resolve_minutes * 60_000).toISOString()

    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb.from('incident_governance') as any).insert({
      incident_id,
      org_id: opts.org_id ?? null,
      title: opts.title,
      severity: opts.severity,
      status: 'open',
      detected_at: now,
      acknowledged_at: null,
      resolved_at: null,
      mttr_minutes: null,
      root_cause: null,
      impact_summary: opts.impact_summary ?? null,
      affected_orgs: opts.affected_orgs ?? [],
      timeline: [{ ts: now, actor: opts.detected_by ?? 'system', note: `Incident opened: ${opts.title}` }],
      slo_breached: false,
      created_at: now,
    })

    if (error) {
      logger.error('[Incident] Open failed', { error, title: opts.title })
      throw new Error(`Incident open failed: ${(error as { message: string }).message}`)
    }

    // Audit trail
    await signedAuditChain.append({
      entry_id: randomUUID(),
      org_id: opts.org_id ?? 'global',
      actor: opts.detected_by ?? 'system',
      action: 'incident_opened',
      entity_type: 'incident',
      entity_id: incident_id,
      metadata: { severity: opts.severity, title: opts.title },
    })

    logger.error(`[Incident] ${opts.severity} INCIDENT OPENED`, {
      incident_id,
      title: opts.title,
      severity: opts.severity,
      ack_deadline,
      resolve_deadline,
    })

    return { incident_id, severity: opts.severity, ack_deadline, resolve_deadline, slo }
  }

  /**
   * Acknowledge an incident (starts the MTTR clock).
   */
  async acknowledge(incident_id: string, actor: string): Promise<void> {
    const now = new Date().toISOString()
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: incident } = await (sb.from('incident_governance') as any)
      .select('severity, detected_at, timeline, org_id')
      .eq('incident_id', incident_id)
      .single()

    if (!incident) throw new Error(`Incident ${incident_id} not found`)

    const slo = SLO_BY_SEVERITY[incident.severity as IncidentSeverity]
    const detected = new Date(incident.detected_at as string)
    const ack_minutes = (Date.now() - detected.getTime()) / 60_000
    const slo_breached = ack_minutes > slo.ack_minutes

    const newTimeline = [
      ...((incident.timeline ?? []) as Array<{ ts: string; actor: string; note: string }>),
      { ts: now, actor, note: `Acknowledged${slo_breached ? ' (SLO BREACHED)' : ''}` },
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('incident_governance') as any)
      .update({
        acknowledged_at: now,
        status: 'investigating',
        timeline: newTimeline,
        slo_breached: slo_breached || undefined,
      })
      .eq('incident_id', incident_id)

    if (slo_breached) {
      logger.warn('[Incident] ACK SLO BREACHED', {
        incident_id, ack_minutes: Math.round(ack_minutes),
        slo_target: slo.ack_minutes,
      })
    }

    logger.info('[Incident] Acknowledged', { incident_id, actor, slo_breached })
  }

  /**
   * Resolve an incident. Computes MTTR.
   */
  async resolve(incident_id: string, actor: string, root_cause: string): Promise<{
    mttr_minutes: number
    slo_met: boolean
  }> {
    const now = new Date().toISOString()
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: incident } = await (sb.from('incident_governance') as any)
      .select('severity, detected_at, timeline, org_id')
      .eq('incident_id', incident_id)
      .single()

    if (!incident) throw new Error(`Incident ${incident_id} not found`)

    const slo = SLO_BY_SEVERITY[incident.severity as IncidentSeverity]
    const detected = new Date(incident.detected_at as string)
    const mttr_minutes = Math.round((Date.now() - detected.getTime()) / 60_000)
    const slo_met = mttr_minutes <= slo.resolve_minutes

    const newTimeline = [
      ...((incident.timeline ?? []) as Array<{ ts: string; actor: string; note: string }>),
      {
        ts: now, actor,
        note: `Resolved in ${mttr_minutes}min. Root cause: ${root_cause}. SLO: ${slo_met ? '✓ MET' : '✗ BREACHED'}`,
      },
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('incident_governance') as any)
      .update({
        status: 'resolved',
        resolved_at: now,
        mttr_minutes,
        root_cause,
        slo_breached: !slo_met,
        timeline: newTimeline,
      })
      .eq('incident_id', incident_id)

    await signedAuditChain.append({
      entry_id: randomUUID(),
      org_id: incident.org_id as string ?? 'global',
      actor,
      action: 'incident_resolved',
      entity_type: 'incident',
      entity_id: incident_id,
      metadata: { mttr_minutes, root_cause, slo_met },
    })

    logger.info('[Incident] Resolved', { incident_id, mttr_minutes, slo_met, actor })
    return { mttr_minutes, slo_met }
  }

  /**
   * Add a timeline note to an incident.
   */
  async addNote(incident_id: string, actor: string, note: string): Promise<void> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: incident } = await (sb.from('incident_governance') as any)
      .select('timeline').eq('incident_id', incident_id).single()

    if (!incident) return

    const newTimeline = [
      ...((incident.timeline ?? []) as Array<{ ts: string; actor: string; note: string }>),
      { ts: new Date().toISOString(), actor, note },
    ]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (sb.from('incident_governance') as any)
      .update({ timeline: newTimeline })
      .eq('incident_id', incident_id)
  }

  /**
   * List open incidents (optionally by severity).
   */
  async listOpen(severity?: IncidentSeverity): Promise<IncidentRecord[]> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from('incident_governance') as any)
      .select('*')
      .in('status', ['open', 'investigating', 'mitigating'])
      .order('detected_at', { ascending: false })
      .limit(50)

    if (severity) q = q.eq('severity', severity)
    const { data, error } = await q

    if (error) return []

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data ?? []).map((row: any) => ({
      incident_id: row.incident_id as string,
      org_id: row.org_id as string | null,
      title: row.title as string,
      severity: row.severity as IncidentSeverity,
      status: row.status as IncidentStatus,
      detected_at: row.detected_at as string,
      acknowledged_at: row.acknowledged_at as string | null,
      resolved_at: row.resolved_at as string | null,
      mttr_minutes: row.mttr_minutes as number | null,
      root_cause: row.root_cause as string | null,
      impact_summary: row.impact_summary as string | null,
      affected_orgs: (row.affected_orgs ?? []) as string[],
      slo_breached: row.slo_breached as boolean,
      timeline: (row.timeline ?? []) as Array<{ ts: string; actor: string; note: string }>,
    }))
  }
}

export const incidentGovernanceEngine = new IncidentGovernanceEngine()
