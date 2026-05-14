// AGENCY GROUP — SH-ROS Compliance: retentionPolicies | AMI: 22506

import { supabaseAdmin } from '@/lib/supabase'

export interface RetentionPolicy {
  table: string
  retention_days: number
  action: 'delete' | 'anonymize' | 'archive'
  conditions?: Record<string, unknown>
}

export interface RetentionResult {
  run_id: string
  policies_applied: number
  records_processed: number
  records_deleted: number
  records_anonymized: number
  completed_at: string
}

export interface RetentionStatus {
  org_id?: string
  oldest_records: Record<string, string>
  compliance_status: 'compliant' | 'at_risk' | 'non_compliant'
}

const DEFAULT_POLICIES: RetentionPolicy[] = [
  { table: 'runtime_events', retention_days: 90, action: 'delete' },
  { table: 'learning_events', retention_days: 365, action: 'delete' },
  { table: 'automations_log', retention_days: 180, action: 'delete' },
  { table: 'system_alerts', retention_days: 30, action: 'delete', conditions: { acknowledged: true } },
]

export class RetentionPolicyEngine {
  private readonly _policies: RetentionPolicy[] = [...DEFAULT_POLICIES]
  private _scheduledHandle: ReturnType<typeof setInterval> | null = null

  getPolicy(table: string, _org_id?: string): RetentionPolicy {
    return (
      this._policies.find((p) => p.table === table) ?? {
        table,
        retention_days: 365,
        action: 'delete',
      }
    )
  }

  async applyRetention(org_id?: string): Promise<RetentionResult> {
    const run_id = crypto.randomUUID()
    const completed_at = new Date().toISOString()
    let policies_applied = 0
    let records_processed = 0
    let records_deleted = 0
    let records_anonymized = 0

    for (const policy of this._policies) {
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - policy.retention_days)
      const cutoff_iso = cutoff.toISOString()

      // Check legal holds before deletion
      const { legalHoldManager } = await import('./legalHold')
      const held = await legalHoldManager.isHeld('table', policy.table, org_id ?? '*')
      if (held) {
        console.warn(`[RetentionPolicies] Legal hold in place for ${policy.table}, skipping`)
        continue
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabaseAdmin as any
        let query = sb
          .from(policy.table)
          .select('id, created_at', { count: 'exact' })
          .lt('created_at', cutoff_iso)

        if (org_id) query = query.eq('org_id', org_id)
        if (policy.conditions) {
          for (const [k, v] of Object.entries(policy.conditions)) {
            query = query.eq(k, v)
          }
        }

        const { data: rows, count, error: fetchErr } = await query
        if (fetchErr) {
          console.warn(`[RetentionPolicies] fetch ${policy.table}:`, fetchErr)
          continue
        }

        const row_count = count ?? rows?.length ?? 0
        records_processed += row_count
        policies_applied++

        if (row_count === 0) continue

        if (policy.action === 'delete') {
          let delQuery = sb
            .from(policy.table)
            .delete()
            .lt('created_at', cutoff_iso)

          if (org_id) delQuery = delQuery.eq('org_id', org_id)
          if (policy.conditions) {
            for (const [k, v] of Object.entries(policy.conditions)) {
              delQuery = delQuery.eq(k, v)
            }
          }

          const { error: delErr } = await delQuery
          if (delErr) {
            console.warn(`[RetentionPolicies] delete ${policy.table}:`, delErr)
            continue
          }
          records_deleted += row_count
        } else if (policy.action === 'anonymize') {
          let anonQuery = sb
            .from(policy.table)
            .update({ metadata: '[ANONYMIZED]' })
            .lt('created_at', cutoff_iso)

          if (org_id) anonQuery = anonQuery.eq('org_id', org_id)

          const { error: anonErr } = await anonQuery
          if (anonErr) {
            console.warn(`[RetentionPolicies] anonymize ${policy.table}:`, anonErr)
            continue
          }
          records_anonymized += row_count
        }

        // Immutable audit entry
        await this._auditDeletion(run_id, policy, row_count, cutoff_iso, org_id)
      } catch (err) {
        console.warn(`[RetentionPolicies] policy error for ${policy.table}:`, err)
      }
    }

    return {
      run_id,
      policies_applied,
      records_processed,
      records_deleted,
      records_anonymized,
      completed_at,
    }
  }

  scheduleRetention(): void {
    if (this._scheduledHandle) return
    // Run daily
    const INTERVAL_MS = 24 * 60 * 60 * 1000
    this._scheduledHandle = setInterval(async () => {
      try {
        await this.applyRetention()
      } catch (err) {
        console.warn('[RetentionPolicies] scheduled run error:', err)
      }
    }, INTERVAL_MS)
  }

  async getRetentionStatus(org_id?: string): Promise<RetentionStatus> {
    const oldest_records: Record<string, string> = {}
    let compliance_status: RetentionStatus['compliance_status'] = 'compliant'

    for (const policy of this._policies) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb2 = supabaseAdmin as any
        let query = sb2
          .from(policy.table)
          .select('created_at')
          .order('created_at', { ascending: true })
          .limit(1)

        if (org_id) query = query.eq('org_id', org_id)

        const { data, error } = await query
        if (error) {
          console.warn(`[RetentionPolicies] status check ${policy.table}:`, error)
          continue
        }

        if (data && data.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          oldest_records[policy.table] = (data[0] as any).created_at

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const oldest = new Date((data[0] as any).created_at)
          const cutoff = new Date()
          cutoff.setDate(cutoff.getDate() - policy.retention_days)

          const daysOverdue = Math.floor((cutoff.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24))

          if (daysOverdue > 30) {
            compliance_status = 'non_compliant'
          } else if (daysOverdue > 0 && compliance_status === 'compliant') {
            compliance_status = 'at_risk'
          }
        }
      } catch (err) {
        console.warn(`[RetentionPolicies] status error for ${policy.table}:`, err)
      }
    }

    return { org_id, oldest_records, compliance_status }
  }

  private async _auditDeletion(
    run_id: string,
    policy: RetentionPolicy,
    count: number,
    cutoff: string,
    org_id?: string,
  ): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin.from('learning_events') as any).insert({
        event_type: 'immutable_audit',
        org_id: org_id ?? null,
        correlation_id: run_id,
        metadata: {
          action: 'retention_applied',
          table: policy.table,
          retention_days: policy.retention_days,
          policy_action: policy.action,
          records_affected: count,
          cutoff_date: cutoff,
          run_id,
        },
        created_at: new Date().toISOString(),
      })
    } catch (err) {
      console.warn('[RetentionPolicies] audit log error:', err)
    }
  }
}

export const retentionPolicyEngine = new RetentionPolicyEngine()
