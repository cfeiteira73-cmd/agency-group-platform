// Agency Group — Followup Worker Handler
// lib/workers/handlers/followupHandler.ts
//
// Increments contact_attempts, updates last_contact_at, calculates next_followup_at,
// and emits a leadQualified event (fire-and-forget).
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import { emit } from '@/lib/events/producers'
import type { WorkerJob, WorkerResult } from '../types'

// ─── Payload ──────────────────────────────────────────────────────────────────

export interface FollowupJobPayload {
  contact_id:      string
  tenant_id:       string
  action:          'call' | 'whatsapp' | 'email'
  scheduled_for?:  string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ACTIVE_FOLLOWUP_HOURS   = 72
const INACTIVE_FOLLOWUP_DAYS  = 7

// Active lead statuses — adjust to match your contacts schema
const ACTIVE_STATUSES = new Set(['new', 'contacted', 'qualified', 'hot', 'active', 'interested'])

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function followupHandler(
  job: WorkerJob<FollowupJobPayload>,
): Promise<WorkerResult> {
  const start = Date.now()
  const { contact_id, tenant_id, action } = job.payload

  try {
    // 1. Fetch contact
    const { data: contact, error: fetchErr } = await (supabaseAdmin as any)
      .from('contacts')
      .select('*')
      .eq('id', contact_id)
      .eq('tenant_id', tenant_id)
      .single()

    if (fetchErr || !contact) {
      return {
        jobId:      job.jobId,
        success:    false,
        durationMs: Date.now() - start,
        error:      `Contact not found: ${contact_id} — ${fetchErr?.message ?? 'no data'}`,
      }
    }

    const c = contact as Record<string, unknown>
    const now = new Date()

    // 2. Increment contact_attempts, update last_contact_at
    const currentAttempts = typeof c.contact_attempts === 'number' ? c.contact_attempts : 0
    const newAttempts = currentAttempts + 1

    // 3. Calculate next followup
    const status = typeof c.status === 'string' ? c.status.toLowerCase() : ''
    const isActive = ACTIVE_STATUSES.has(status)

    let nextFollowupAt: string
    if (isActive) {
      // Active lead: follow up in 72 hours
      nextFollowupAt = new Date(
        now.getTime() + ACTIVE_FOLLOWUP_HOURS * 60 * 60 * 1000,
      ).toISOString()
    } else {
      // Inactive lead: follow up in 7 days
      nextFollowupAt = new Date(
        now.getTime() + INACTIVE_FOLLOWUP_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString()
    }

    // 4. Persist updates
    const { error: updateErr } = await (supabaseAdmin as any)
      .from('contacts')
      .update({
        contact_attempts: newAttempts,
        last_contact_at:  now.toISOString(),
        next_followup_at: nextFollowupAt,
        updated_at:       now.toISOString(),
      })
      .eq('id', contact_id)
      .eq('tenant_id', tenant_id)

    if (updateErr) {
      console.error(`[followupHandler] update failed for ${contact_id}:`, updateErr.message)
      return {
        jobId:      job.jobId,
        success:    false,
        durationMs: Date.now() - start,
        error:      `contacts update failed: ${updateErr.message}`,
      }
    }

    // 5. Emit leadQualified (fire-and-forget)
    void emit.leadQualified({
      lead_id:      contact_id,
      qualified_by: 'engine',
      score:        null,
      budget_min:   typeof c.budget_min === 'number' ? c.budget_min : null,
      budget_max:   typeof c.budget_max === 'number' ? c.budget_max : null,
      zona:         typeof c.zona === 'string' ? c.zona : null,
    })

    return {
      jobId:      job.jobId,
      success:    true,
      durationMs: Date.now() - start,
      output: {
        contact_id,
        action,
        contact_attempts:  newAttempts,
        last_contact_at:   now.toISOString(),
        next_followup_at:  nextFollowupAt,
        is_active_lead:    isActive,
      },
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[followupHandler] unexpected error for job ${job.jobId}:`, msg)
    return {
      jobId:      job.jobId,
      success:    false,
      durationMs: Date.now() - start,
      error:      msg,
    }
  }
}
