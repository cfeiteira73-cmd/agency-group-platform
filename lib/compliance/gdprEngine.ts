// AGENCY GROUP — SH-ROS Compliance: gdprEngine | AMI: 22506

import { supabaseAdmin } from '@/lib/supabase'

export interface ErasureResult {
  request_id: string
  email: string
  org_id: string
  tables_affected: string[]
  records_anonymized: number
  records_deleted: number
  completed_at: string
}

export interface DataExportPackage {
  request_id: string
  email: string
  org_id: string
  data: Record<string, unknown[]>
  generated_at: string
  format: 'json'
}

export interface ConsentStatus {
  email: string
  has_consent: boolean
  consent_date?: string
  withdrawal_date?: string
  purposes: string[]
}

const PII_TABLES = ['contacts'] as const
const PII_FIELDS: Record<string, string[]> = {
  contacts: ['full_name', 'email', 'phone', 'whatsapp'],
}

export class GDPREngine {
  async requestErasure(email: string, org_id: string, requested_by: string): Promise<ErasureResult> {
    const request_id = crypto.randomUUID()
    const completed_at = new Date().toISOString()
    const tables_affected: string[] = []
    let records_anonymized = 0
    let records_deleted = 0

    for (const table of PII_TABLES) {
      const fields = PII_FIELDS[table]
      if (!fields) continue

      try {
        // Fetch records to count
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rows, error: fetchErr } = await (supabaseAdmin as any)
          .from(table)
          .select('id')
          .eq('tenant_id', org_id)
          .eq('email', email)

        if (fetchErr) {
          console.warn(`[GDPREngine] fetch ${table} error:`, fetchErr)
          continue
        }

        if (!rows || rows.length === 0) continue

        tables_affected.push(table)

        // Anonymize PII fields
        const anonymized: Record<string, string> = {}
        for (const f of fields) {
          anonymized[f] = '[ANONYMIZED]'
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error: updateErr } = await (supabaseAdmin as any)
          .from(table)
          .update(anonymized)
          .eq('tenant_id', org_id)
          .eq('email', email)

        if (updateErr) {
          console.warn(`[GDPREngine] anonymize ${table} error:`, updateErr)
          continue
        }

        records_anonymized += rows.length
      } catch (err) {
        console.warn(`[GDPREngine] erasure error on ${table}:`, err)
      }
    }

    // Delete from learning_events related to this email (event_data containing email)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: leRows } = await (supabaseAdmin.from('learning_events') as any)
        .select('id')
        .eq('tenant_id', org_id)
        .contains('metadata', { email })

      if (leRows && leRows.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabaseAdmin.from('learning_events') as any)
          .delete()
          .eq('tenant_id', org_id)
          .contains('metadata', { email })
        records_deleted += leRows.length
        tables_affected.push('learning_events')
      }
    } catch (err) {
      console.warn('[GDPREngine] learning_events delete error:', err)
    }

    // Audit the GDPR operation
    await this._logGDPR('gdpr_erasure', org_id, {
      request_id,
      email_hash: await this._hashEmail(email),
      requested_by,
      tables_affected,
      records_anonymized,
      records_deleted,
    })

    return {
      request_id,
      email,
      org_id,
      tables_affected,
      records_anonymized,
      records_deleted,
      completed_at,
    }
  }

  async requestExport(email: string, org_id: string): Promise<DataExportPackage> {
    const request_id = crypto.randomUUID()
    const generated_at = new Date().toISOString()
    const data: Record<string, unknown[]> = {}

    for (const table of PII_TABLES) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: rows, error } = await (supabaseAdmin as any)
          .from(table)
          .select('*')
          .eq('tenant_id', org_id)
          .eq('email', email)

        if (error) {
          console.warn(`[GDPREngine] export ${table} error:`, error)
          continue
        }

        if (rows && rows.length > 0) {
          data[table] = rows
        }
      } catch (err) {
        console.warn(`[GDPREngine] export error on ${table}:`, err)
      }
    }

    await this._logGDPR('gdpr_export', org_id, {
      request_id,
      email_hash: await this._hashEmail(email),
      tables_exported: Object.keys(data),
    })

    return { request_id, email, org_id, data, generated_at, format: 'json' }
  }

  async requestRectification(
    email: string,
    org_id: string,
    corrections: Record<string, unknown>,
  ): Promise<void> {
    for (const table of PII_TABLES) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { error } = await (supabaseAdmin as any)
          .from(table)
          .update(corrections)
          .eq('tenant_id', org_id)
          .eq('email', email)

        if (error) {
          console.warn(`[GDPREngine] rectification ${table} error:`, error)
        }
      } catch (err) {
        console.warn(`[GDPREngine] rectification error on ${table}:`, err)
      }
    }

    await this._logGDPR('gdpr_rectification', org_id, {
      email_hash: await this._hashEmail(email),
      fields_corrected: Object.keys(corrections),
    })
  }

  async checkConsentStatus(email: string, org_id: string): Promise<ConsentStatus> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabaseAdmin.from('learning_events') as any)
        .select('metadata, created_at')
        .eq('tenant_id', org_id)
        .eq('event_type', 'consent_record')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        console.warn('[GDPREngine] checkConsentStatus error:', error)
        return { email, has_consent: false, purposes: [] }
      }

      const emailHash = await this._hashEmail(email)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const relevant = ((data as any[]) ?? []).filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (r: any) => (r.metadata as Record<string, unknown>)?.email_hash === emailHash,
      )

      if (relevant.length === 0) {
        return { email, has_consent: false, purposes: [] }
      }

      // Find latest consent and withdrawal
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const consents = relevant.filter((r: any) => (r.metadata as Record<string, unknown>)?.granted === true)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const withdrawals = relevant.filter((r: any) => (r.metadata as Record<string, unknown>)?.granted === false)

      const latestConsent = consents[0]
      const latestWithdrawal = withdrawals[0]

      const purposes: string[] = [...new Set<string>(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        consents.map((r: any) => String((r.metadata as Record<string, unknown>)?.purpose ?? ''))
      )].filter(Boolean)

      const has_consent = !!latestConsent && (!latestWithdrawal ||
        new Date(latestConsent.created_at) > new Date(latestWithdrawal.created_at))

      return {
        email,
        has_consent,
        consent_date: latestConsent?.created_at ?? undefined,
        withdrawal_date: latestWithdrawal?.created_at ?? undefined,
        purposes,
      }
    } catch (err) {
      console.warn('[GDPREngine] checkConsentStatus exception:', err)
      return { email, has_consent: false, purposes: [] }
    }
  }

  private async _logGDPR(operation: string, org_id: string, metadata: Record<string, unknown>): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin.from('learning_events') as any).insert({
        event_type: 'gdpr_operation',
        org_id,
        correlation_id: crypto.randomUUID(),
        metadata: { operation, ...metadata },
        created_at: new Date().toISOString(),
      })
    } catch (err) {
      console.warn('[GDPREngine] audit log error:', err)
    }
  }

  private async _hashEmail(email: string): Promise<string> {
    const enc = new TextEncoder()
    const buf = await crypto.subtle.digest('SHA-256', enc.encode(email.toLowerCase().trim()))
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
  }
}

export const gdprEngine = new GDPREngine()
