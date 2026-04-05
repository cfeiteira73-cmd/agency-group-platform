// =============================================================================
// AGENCY GROUP — Activities Service
// Append-only interaction log: calls, emails, WhatsApp, visits, notes
// Records are immutable — no updates, no deletes (audit trail)
// =============================================================================

import { supabase, supabaseAdmin } from '../supabase'
import type { Database, ActivityType } from '../database.types'

type Activity = Database['public']['Tables']['activities']['Row']
type ActivityInsert = Database['public']['Tables']['activities']['Insert']

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

/**
 * Get the most recent activities across all contacts.
 * Used for the activity feed on the dashboard.
 */
export async function getRecentActivities(limit = 50): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getRecentActivities: ${error.message}`)
  return data
}

/**
 * Get all activities for a specific contact.
 * Ordered chronologically desc — most recent first.
 */
export async function getContactActivities(contactId: string): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('contact_id', contactId)
    .order('occurred_at', { ascending: false })

  if (error) throw new Error(`getContactActivities(${contactId}): ${error.message}`)
  return data
}

/**
 * Get all activities for a specific deal.
 */
export async function getDealActivities(dealId: string): Promise<Activity[]> {
  const { data, error } = await supabase
    .from('activities')
    .select('*')
    .eq('deal_id', dealId)
    .order('occurred_at', { ascending: false })

  if (error) throw new Error(`getDealActivities(${dealId}): ${error.message}`)
  return data
}

/**
 * Get activities by type (e.g., all WhatsApp messages sent this week).
 */
export async function getActivitiesByType(
  type: ActivityType,
  since?: Date
): Promise<Activity[]> {
  let query = supabase
    .from('activities')
    .select('*')
    .eq('type', type)
    .order('occurred_at', { ascending: false })

  if (since) {
    query = query.gte('occurred_at', since.toISOString())
  }

  const { data, error } = await query
  if (error) throw new Error(`getActivitiesByType(${type}): ${error.message}`)
  return data
}

/**
 * Get activities performed by a specific consultant.
 */
export async function getConsultantActivities(
  consultantId: string,
  since?: Date,
  limit = 100
): Promise<Activity[]> {
  let query = supabase
    .from('activities')
    .select('*')
    .eq('performed_by', consultantId)
    .order('occurred_at', { ascending: false })
    .limit(limit)

  if (since) {
    query = query.gte('occurred_at', since.toISOString())
  }

  const { data, error } = await query
  if (error) throw new Error(`getConsultantActivities(${consultantId}): ${error.message}`)
  return data
}

// ---------------------------------------------------------------------------
// WRITE
// ---------------------------------------------------------------------------

/**
 * Log a new activity. Activities are immutable — no update/delete allowed.
 * Call recordContactInteraction() after this to bump engagement metrics.
 */
export async function logActivity(activity: ActivityInsert): Promise<Activity> {
  const { data, error } = await supabase
    .from('activities')
    .insert({
      ...activity,
      occurred_at: activity.occurred_at ?? new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw new Error(`logActivity: ${error.message}`)
  return data
}

/**
 * Log a call activity with outcome.
 * Convenience wrapper for logActivity with type = call_outbound/call_inbound.
 */
export async function logCall(params: {
  contactId: string
  performedBy: string
  direction: 'outbound' | 'inbound'
  durationMin?: number
  outcome: string
  notes?: string
  dealId?: string
}): Promise<Activity> {
  return logActivity({
    contact_id: params.contactId,
    performed_by: params.performedBy,
    type: params.direction === 'outbound' ? 'call_outbound' : 'call_inbound',
    duration_min: params.durationMin ?? null,
    outcome: params.outcome,
    body: params.notes ?? null,
    deal_id: params.dealId ?? null,
    occurred_at: new Date().toISOString(),
  })
}

/**
 * Log a WhatsApp message.
 * Convenience wrapper for logActivity with type = whatsapp_sent/whatsapp_received.
 */
export async function logWhatsApp(params: {
  contactId: string
  performedBy?: string
  direction: 'sent' | 'received'
  body: string
  isAutomated?: boolean
  automationId?: string
  dealId?: string
}): Promise<Activity> {
  return logActivity({
    contact_id: params.contactId,
    performed_by: params.performedBy ?? null,
    type: params.direction === 'sent' ? 'whatsapp_sent' : 'whatsapp_received',
    body: params.body,
    is_automated: params.isAutomated ?? false,
    automation_id: params.automationId ?? null,
    deal_id: params.dealId ?? null,
    occurred_at: new Date().toISOString(),
  })
}

// ---------------------------------------------------------------------------
// ADMIN — SERVER ONLY
// ---------------------------------------------------------------------------

/**
 * SERVER ONLY — use in API routes.
 * Bulk insert activities from n8n workflow executions.
 */
export async function bulkLogActivities(
  activities: ActivityInsert[]
): Promise<Activity[]> {
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('activities')
    .insert(
      activities.map((a) => ({
        ...a,
        occurred_at: a.occurred_at ?? now,
      }))
    )
    .select()

  if (error) throw new Error(`bulkLogActivities: ${error.message}`)
  return data
}
