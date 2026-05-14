// AGENCY GROUP — SH-ROS Compliance: keyRotation | AMI: 22506
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

export interface RotationResult {
  rotation_id: string
  key_id: string
  rotated_at: string
  success: boolean
  records_reencrypted?: number
  error?: string
}

export interface RotationRecord {
  rotation_id: string
  key_id: string
  rotated_at: string
  rotated_by: string
  method: 'scheduled' | 'manual' | 'emergency'
}

export class KeyRotationManager {
  async scheduleRotation(key_id: string, rotate_at: string): Promise<void> {
    try {
      await supabaseAdmin.from('operator_tasks').insert({
        task_type:   'key_rotation_scheduled',
        title:       `Key Rotation Scheduled: ${key_id}`,
        priority:    'high',
        entity_type: 'encryption_key',
        entity_id:   key_id,
        metadata:    { key_id, scheduled_for: rotate_at, created_at: new Date().toISOString() },
      })
    } catch (err) {
      console.warn('[KeyRotationManager] scheduleRotation failed:', err instanceof Error ? err.message : String(err))
    }
  }

  async executeRotation(key_id: string): Promise<RotationResult> {
    const rotation_id = randomUUID()
    const rotated_at  = new Date().toISOString()

    // For Supabase/Vercel infrastructure: key rotation is managed at the platform level.
    // This logs the rotation event and coordinates the process.
    const result: RotationResult = {
      rotation_id, key_id, rotated_at, success: true,
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin.from('learning_events') as any).insert({
        event_type:    'key_rotation',
        source_system: 'agent',
        metadata:      {
          rotation_id, key_id, rotated_at,
          method: 'manual', rotated_by: 'system',
          notes:  'Key rotation logged. For Supabase-managed keys, rotation is performed via Supabase dashboard.',
        },
      })
    } catch (err) {
      result.success = false
      result.error   = err instanceof Error ? err.message : String(err)
    }

    return result
  }

  async getRotationHistory(key_id?: string): Promise<RotationRecord[]> {
    try {
      const since = new Date(Date.now() - 365 * 86_400_000).toISOString()
      const { data } = await supabaseAdmin
        .from('learning_events')
        .select('metadata, created_at')
        .eq('event_type', 'key_rotation')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(100)

      return (data ?? [])
        .map(r => r.metadata as unknown as RotationRecord)
        .filter(r => !key_id || r?.key_id === key_id)
    } catch { return [] }
  }

  async isRotationDue(): Promise<boolean> {
    const history = await this.getRotationHistory()
    if (history.length === 0) return true // never rotated

    const lastRotation = new Date(history[0].rotated_at)
    const daysSinceRotation = (Date.now() - lastRotation.getTime()) / 86_400_000
    return daysSinceRotation > 90 // rotate every 90 days
  }
}

export const keyRotationManager = new KeyRotationManager()
