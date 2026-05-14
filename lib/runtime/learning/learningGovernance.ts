// AGENCY GROUP — SH-ROS Learning: learningGovernance | AMI: 22506
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

export interface LearningChange {
  change_id: string
  org_id: string
  type: 'weight_update' | 'calibration_update' | 'rollback' | 'snapshot_restore'
  agent_id?: string
  before: Record<string, unknown>
  after: Record<string, unknown>
  reason: string
  changed_by: string
  approved_by?: string
  timestamp: string
  auto_approved: boolean
}

export interface ValidationResult {
  valid: boolean
  issues: string[]
  risk_level: 'none' | 'low' | 'medium' | 'high'
}

export class LearningGovernance {
  async logChange(change: LearningChange): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin.from('learning_events') as any).insert({
        event_type:    'learning_change',
        source_system: 'agent',
        metadata:      change,
      })
    } catch (err) {
      console.warn('[LearningGovernance] logChange failed:', err instanceof Error ? err.message : String(err))
    }
  }

  async getAuditLog(org_id: string, period_days = 30): Promise<LearningChange[]> {
    try {
      const since = new Date(Date.now() - period_days * 86_400_000).toISOString()
      const { data } = await supabaseAdmin
        .from('learning_events')
        .select('metadata, created_at')
        .eq('event_type', 'learning_change')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200)

      return (data ?? [])
        .filter(r => (r.metadata as Record<string, unknown> | null)?.org_id === org_id)
        .map(r => r.metadata as unknown as LearningChange)
    } catch { return [] }
  }

  validateChange(change: LearningChange): ValidationResult {
    const issues: string[] = []
    let risk: ValidationResult['risk_level'] = 'none'

    if (!change.reason || change.reason.trim().length < 5) {
      issues.push('Change reason is too short (min 5 chars)')
    }
    if (!change.changed_by) {
      issues.push('changed_by is required')
      risk = 'high'
    }

    // Check magnitude for weight updates
    if (change.type === 'weight_update') {
      const before = change.before as Record<string, number>
      const after  = change.after  as Record<string, number>
      for (const key of Object.keys(after)) {
        const delta = Math.abs((after[key] ?? 1) - (before[key] ?? 1))
        if (delta > 0.3) { risk = 'high'; issues.push(`Weight change for ${key} exceeds 30% threshold`) }
        else if (delta > 0.1) { risk = risk === 'high' ? 'high' : 'medium' }
      }
    }

    if (change.type === 'rollback' || change.type === 'snapshot_restore') {
      risk = 'high'
      if (!change.approved_by) issues.push('Rollback requires approved_by')
    }

    return { valid: issues.length === 0, issues, risk_level: risk }
  }

  requiresApproval(change: LearningChange): boolean {
    if (change.type === 'rollback' || change.type === 'snapshot_restore') return true
    if (change.type === 'weight_update') {
      const before = change.before as Record<string, number>
      const after  = change.after  as Record<string, number>
      for (const key of Object.keys(after)) {
        if (Math.abs((after[key] ?? 1) - (before[key] ?? 1)) > 0.05) return true
      }
    }
    return false
  }

  createChange(
    opts: Omit<LearningChange, 'change_id' | 'timestamp' | 'auto_approved'> & { auto_approve?: boolean },
  ): LearningChange {
    const change: LearningChange = {
      change_id:     randomUUID(),
      timestamp:     new Date().toISOString(),
      auto_approved: opts.auto_approve ?? !this.requiresApproval({
        ...opts, change_id: '', timestamp: '', auto_approved: false,
      }),
      ...opts,
    }
    return change
  }
}

export const learningGovernance = new LearningGovernance()
