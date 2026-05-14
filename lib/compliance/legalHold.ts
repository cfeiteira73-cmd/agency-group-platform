// AGENCY GROUP — SH-ROS Compliance: legalHold | AMI: 22506
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

export interface LegalHold {
  hold_id: string
  org_id: string
  entity_type: string
  entity_ids: string[]
  reason: string
  placed_by: string
  placed_at: string
  lifted_by?: string
  lifted_at?: string
  expires_at?: string
}

export class LegalHoldManager {
  async place(hold: LegalHold): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin as any).from('operator_tasks').insert({
        task_type:   'legal_hold',
        title:       `Legal Hold: ${hold.entity_type} — ${hold.reason.slice(0, 80)}`,
        priority:    'critical',
        entity_type: hold.entity_type,
        entity_id:   hold.entity_ids[0] ?? null,
        metadata:    hold as unknown as Record<string, unknown>,
      })
    } catch (err) {
      console.warn('[LegalHoldManager] place failed:', err instanceof Error ? err.message : String(err))
      throw err
    }
  }

  async lift(hold_id: string, lifted_by: string): Promise<void> {
    try {
      const { data } = await supabaseAdmin
        .from('operator_tasks')
        .select('id, metadata')
        .eq('task_type', 'legal_hold')
        .limit(500)

      const task = (data ?? []).find(t => (t.metadata as Record<string, unknown> | null)?.hold_id === hold_id)
      if (!task) throw new Error(`Legal hold ${hold_id} not found`)

      const updated = {
        ...(task.metadata as unknown as LegalHold),
        lifted_by, lifted_at: new Date().toISOString(),
      }

      await supabaseAdmin
        .from('operator_tasks')
        .update({ metadata: updated, priority: 'low' })
        .eq('id', task.id)
    } catch (err) {
      console.warn('[LegalHoldManager] lift failed:', err instanceof Error ? err.message : String(err))
      throw err
    }
  }

  async isHeld(entity_type: string, entity_id: string, org_id: string): Promise<boolean> {
    try {
      const holds = await this.list(org_id)
      return holds.some(h =>
        !h.lifted_at &&
        h.entity_type === entity_type &&
        h.entity_ids.includes(entity_id) &&
        (!h.expires_at || new Date(h.expires_at) > new Date()),
      )
    } catch { return false }
  }

  async list(org_id: string): Promise<LegalHold[]> {
    try {
      const { data } = await supabaseAdmin
        .from('operator_tasks')
        .select('metadata')
        .eq('task_type', 'legal_hold')
        .limit(200)

      return (data ?? [])
        .map(t => t.metadata as unknown as LegalHold)
        .filter(h => h?.org_id === org_id)
    } catch { return [] }
  }

  static create(
    org_id: string,
    entity_type: string,
    entity_ids: string[],
    reason: string,
    placed_by: string,
    expires_at?: string,
  ): LegalHold {
    return {
      hold_id: randomUUID(), org_id, entity_type, entity_ids,
      reason, placed_by, placed_at: new Date().toISOString(), expires_at,
    }
  }
}

export const legalHoldManager = new LegalHoldManager()
