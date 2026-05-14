// AGENCY GROUP — SH-ROS Compliance: consentTracking | AMI: 22506
import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

export interface ConsentRecord {
  consent_id: string
  email: string
  org_id: string
  purpose: string
  granted: boolean
  method: 'explicit' | 'implicit'
  source: string
  timestamp: string
  ip_hash?: string
  withdrawal_timestamp?: string
}

export class ConsentTracker {
  async record(consent: ConsentRecord): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin.from('learning_events') as any).insert({
        event_type:    'consent_record',
        source_system: 'agent',
        metadata:      consent,
      })
    } catch (err) {
      console.warn('[ConsentTracker] record failed:', err instanceof Error ? err.message : String(err))
    }
  }

  async withdraw(email: string, org_id: string, purpose: string): Promise<void> {
    const withdrawRecord: ConsentRecord = {
      consent_id:             randomUUID(),
      email, org_id, purpose,
      granted:                false,
      method:                 'explicit',
      source:                 'withdrawal',
      timestamp:              new Date().toISOString(),
      withdrawal_timestamp:   new Date().toISOString(),
    }
    await this.record(withdrawRecord)
  }

  async getStatus(email: string, org_id: string): Promise<ConsentRecord[]> {
    try {
      const since = new Date(Date.now() - 5 * 365 * 86_400_000).toISOString()
      const { data } = await supabaseAdmin
        .from('learning_events')
        .select('metadata, created_at')
        .eq('event_type', 'consent_record')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(200)

      return (data ?? [])
        .map(r => r.metadata as unknown as ConsentRecord)
        .filter(c => c?.email === email && c?.org_id === org_id)
    } catch { return [] }
  }

  async hasActiveConsent(email: string, org_id: string, purpose: string): Promise<boolean> {
    const records = await this.getStatus(email, org_id)
    // Most recent record for this purpose wins
    const forPurpose = records.filter(r => r.purpose === purpose)
    if (forPurpose.length === 0) return false
    return forPurpose[0].granted && !forPurpose[0].withdrawal_timestamp
  }
}

export const consentTracker = new ConsentTracker()
