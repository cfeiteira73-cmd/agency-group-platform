// AGENCY GROUP — SH-ROS Compliance: GDPR Art.33 Breach Notification | AMI: 22506
// Phase Ω∞-4: Enterprise Compliance 87→95 — 72h notification window
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { signedAuditChain } from '@/lib/security/signedAuditChain'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BreachType = 'data_leak' | 'unauthorized_access' | 'data_loss' | 'data_destruction' | 'ransomware'
export type BreachSeverity = 'low' | 'medium' | 'high' | 'critical'
export type BreachStatus = 'open' | 'reported' | 'closed' | 'waived'

export interface BreachNotification {
  breach_id: string
  org_id: string
  detected_at: string
  notification_deadline: string  // detected_at + 72h (Art.33 requirement)
  breach_type: BreachType
  severity: BreachSeverity
  status: BreachStatus
  description: string
  affected_records: number | null
  affected_data_types: string[]
  remediation_steps: string | null
  reported_at: string | null
  hours_remaining: number  // computed
}

export interface BreachReport {
  breach_id: string
  org_id: string
  detected_at: string
  reported_at: string
  notification_deadline: string
  compliant: boolean           // reported within 72h
  late_by_hours: number | null // null if compliant
  breach_type: BreachType
  severity: BreachSeverity
  description: string
  affected_records: number | null
  affected_data_types: string[]
  remediation_steps: string | null
}

// ─── GDPR Breach Notification Engine ─────────────────────────────────────────

export class GDPRBreachNotificationEngine {
  private readonly NOTIFICATION_WINDOW_HOURS = 72

  /**
   * Register a new breach (GDPR Art.33 — must be reported within 72h).
   * Returns the breach_id and the notification deadline.
   */
  async registerBreach(opts: {
    org_id: string
    breach_type: BreachType
    severity: BreachSeverity
    description: string
    affected_records?: number
    affected_data_types?: string[]
    detected_at?: string
    metadata?: Record<string, unknown>
  }): Promise<{ breach_id: string; notification_deadline: string; hours_remaining: number }> {
    const breach_id = randomUUID()
    const detected_at = opts.detected_at ?? new Date().toISOString()
    const deadline = new Date(new Date(detected_at).getTime() + this.NOTIFICATION_WINDOW_HOURS * 3_600_000)
    const notification_deadline = deadline.toISOString()
    const hours_remaining = Math.max(0, (deadline.getTime() - Date.now()) / 3_600_000)

    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb.from('gdpr_breach_notifications') as any).insert({
      breach_id,
      org_id: opts.org_id,
      detected_at,
      notification_deadline,
      breach_type: opts.breach_type,
      severity: opts.severity,
      status: 'open',
      description: opts.description,
      affected_records: opts.affected_records ?? null,
      affected_data_types: opts.affected_data_types ?? [],
      remediation_steps: null,
      reported_at: null,
      created_at: new Date().toISOString(),
      metadata: opts.metadata ?? {},
    })

    if (error) {
      logger.error('[BreachNotification] Register failed', { error, org_id: opts.org_id })
      throw new Error(`BreachNotification register failed: ${(error as { message: string }).message}`)
    }

    // Immutable audit entry
    await signedAuditChain.append({
      entry_id: randomUUID(),
      org_id: opts.org_id,
      actor: 'system',
      action: 'gdpr_breach_registered',
      entity_type: 'breach_notification',
      entity_id: breach_id,
      metadata: {
        breach_type: opts.breach_type,
        severity: opts.severity,
        notification_deadline,
        hours_remaining: Math.round(hours_remaining),
      },
    })

    logger.error('[BreachNotification] BREACH REGISTERED', {
      breach_id,
      org_id: opts.org_id,
      breach_type: opts.breach_type,
      severity: opts.severity,
      notification_deadline,
      hours_remaining: Math.round(hours_remaining),
    })

    return { breach_id, notification_deadline, hours_remaining }
  }

  /**
   * Mark breach as reported to supervisory authority.
   */
  async markReported(breach_id: string, org_id: string, reported_by: string): Promise<BreachReport> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    const reported_at = new Date().toISOString()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from('gdpr_breach_notifications') as any)
      .update({ status: 'reported', reported_at })
      .eq('breach_id', breach_id)
      .eq('org_id', org_id)
      .select()
      .single()

    if (error || !data) throw new Error(`BreachNotification markReported failed`)

    await signedAuditChain.append({
      entry_id: randomUUID(),
      org_id,
      actor: reported_by,
      action: 'gdpr_breach_reported',
      entity_type: 'breach_notification',
      entity_id: breach_id,
      metadata: { reported_at },
    })

    const detected = new Date(data.detected_at as string)
    const reported = new Date(reported_at)
    const hours_to_report = (reported.getTime() - detected.getTime()) / 3_600_000
    const compliant = hours_to_report <= this.NOTIFICATION_WINDOW_HOURS

    logger.info('[BreachNotification] Breach reported', {
      breach_id, org_id, compliant,
      hours_to_report: Math.round(hours_to_report),
    })

    return {
      breach_id,
      org_id,
      detected_at: data.detected_at as string,
      reported_at,
      notification_deadline: data.notification_deadline as string,
      compliant,
      late_by_hours: compliant ? null : Math.round(hours_to_report - this.NOTIFICATION_WINDOW_HOURS),
      breach_type: data.breach_type as BreachType,
      severity: data.severity as BreachSeverity,
      description: data.description as string,
      affected_records: data.affected_records as number | null,
      affected_data_types: (data.affected_data_types ?? []) as string[],
      remediation_steps: data.remediation_steps as string | null,
    }
  }

  /**
   * Get open breaches approaching their 72h deadline.
   */
  async getUrgentBreaches(org_id?: string): Promise<BreachNotification[]> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    const urgentCutoff = new Date(Date.now() + 24 * 3_600_000).toISOString()  // < 24h remaining

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from('gdpr_breach_notifications') as any)
      .select('*')
      .eq('status', 'open')
      .lte('notification_deadline', urgentCutoff)
      .order('notification_deadline', { ascending: true })

    if (org_id) q = q.eq('org_id', org_id)

    const { data, error } = await q
    if (error) return []

    return this._mapRows(data ?? [])
  }

  /**
   * Get all breaches for an org.
   */
  async listBreaches(org_id: string, status?: BreachStatus): Promise<BreachNotification[]> {
    const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (sb.from('gdpr_breach_notifications') as any)
      .select('*')
      .eq('org_id', org_id)
      .order('detected_at', { ascending: false })
      .limit(50)

    if (status) q = q.eq('status', status)
    const { data, error } = await q
    if (error) return []
    return this._mapRows(data ?? [])
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _mapRows(rows: any[]): BreachNotification[] {
    return rows.map(row => ({
      breach_id: row.breach_id as string,
      org_id: row.org_id as string,
      detected_at: row.detected_at as string,
      notification_deadline: row.notification_deadline as string,
      breach_type: row.breach_type as BreachType,
      severity: row.severity as BreachSeverity,
      status: row.status as BreachStatus,
      description: row.description as string,
      affected_records: row.affected_records as number | null,
      affected_data_types: (row.affected_data_types ?? []) as string[],
      remediation_steps: row.remediation_steps as string | null,
      reported_at: row.reported_at as string | null,
      hours_remaining: Math.max(0, (new Date(row.notification_deadline as string).getTime() - Date.now()) / 3_600_000),
    }))
  }
}

export const gdprBreachNotification = new GDPRBreachNotificationEngine()
