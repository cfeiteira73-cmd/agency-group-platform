// =============================================================================
// AGENCY GROUP — Contacts Service
// Buyers, sellers, investors, referrers — master contact table
// =============================================================================

import { supabase, supabaseAdmin } from '../supabase'
import type { Database } from '../database.types'

type Contact = Database['public']['Tables']['contacts']['Row']
type ContactInsert = Database['public']['Tables']['contacts']['Insert']
type ContactUpdate = Database['public']['Tables']['contacts']['Update']

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

/**
 * Get all contacts, optionally scoped to a consultant.
 * Ordered by last_contact_at desc (most recently active first).
 */
export async function getContacts(assignedTo?: string): Promise<Contact[]> {
  let query = supabase
    .from('contacts')
    .select('*')
    .order('last_contact_at', { ascending: false, nullsFirst: false })

  if (assignedTo) {
    query = query.eq('assigned_to', assignedTo)
  }

  const { data, error } = await query
  if (error) throw new Error(`getContacts: ${error.message}`)
  return data
}

/**
 * Get a single contact by ID.
 */
export async function getContactById(id: string): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(`getContactById(${id}): ${error.message}`)
  return data
}

/**
 * Get contacts whose next_followup_at is due today or overdue and are active.
 * Ordered by lead_score desc so highest-value contacts are actioned first.
 */
export async function getContactsForFollowUp(): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .lte('next_followup_at', new Date().toISOString())
    .not('next_followup_at', 'is', null)
    .in('status', ['lead', 'prospect', 'qualified', 'active', 'negotiating'])
    .order('lead_score', { ascending: false })

  if (error) throw new Error(`getContactsForFollowUp: ${error.message}`)
  return data
}

/**
 * Get dormant contacts — no activity in the last N days.
 * Defaults to 90 days (standard dormancy threshold).
 */
export async function getDormantContacts(daysSilent = 90): Promise<Contact[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - daysSilent)

  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .lte('last_contact_at', cutoff.toISOString())
    .not('status', 'in', '("lost","referrer")')
    .order('lead_score', { ascending: false })

  if (error) throw new Error(`getDormantContacts: ${error.message}`)
  return data
}

/**
 * Search contacts by name, email, or phone (case-insensitive partial match).
 */
export async function searchContacts(query: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .or(
      `full_name.ilike.%${query}%,email.ilike.%${query}%,phone.ilike.%${query}%`
    )
    .order('lead_score', { ascending: false })
    .limit(50)

  if (error) throw new Error(`searchContacts: ${error.message}`)
  return data
}

/**
 * Get top investors by lead_score, optionally scoped to a consultant.
 */
export async function getTopInvestors(
  assignedTo?: string,
  limit = 20
): Promise<Contact[]> {
  let query = supabase
    .from('contacts')
    .select('*')
    .eq('role', 'investor')
    .order('lead_score', { ascending: false })
    .limit(limit)

  if (assignedTo) {
    query = query.eq('assigned_to', assignedTo)
  }

  const { data, error } = await query
  if (error) throw new Error(`getTopInvestors: ${error.message}`)
  return data
}

// ---------------------------------------------------------------------------
// WRITE
// ---------------------------------------------------------------------------

/**
 * Upsert a contact. If id is provided and exists, updates; otherwise inserts.
 * Returns the full updated record.
 */
export async function upsertContact(contact: ContactInsert): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .upsert({
      ...contact,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw new Error(`upsertContact: ${error.message}`)
  return data
}

/**
 * Update a contact by ID. Partial update — only provided fields are changed.
 */
export async function updateContact(
  id: string,
  updates: ContactUpdate
): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`updateContact(${id}): ${error.message}`)
  return data
}

/**
 * Update a contact's AI lead score and tier classification.
 * Called by the n8n lead scoring workflow.
 */
export async function updateContactScore(
  id: string,
  score: number,
  tier: 'A' | 'B' | 'C',
  breakdown?: Record<string, number>
): Promise<Contact> {
  const { data, error } = await supabase
    .from('contacts')
    .update({
      lead_score: score,
      lead_tier: tier,
      lead_score_breakdown: breakdown ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`updateContactScore(${id}): ${error.message}`)
  return data
}

/**
 * Record a contact interaction — bumps total_interactions and last_contact_at.
 * Call this after logging an activity to keep engagement metrics current.
 */
export async function recordContactInteraction(id: string): Promise<void> {
  // Use RPC or manual increment — Supabase JS v2 does not support SQL increment natively
  const contact = await getContactById(id)

  const { error } = await supabase
    .from('contacts')
    .update({
      last_contact_at: new Date().toISOString(),
      total_interactions: (contact.total_interactions ?? 0) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(`recordContactInteraction(${id}): ${error.message}`)
}

// ---------------------------------------------------------------------------
// ADMIN — SERVER ONLY
// ---------------------------------------------------------------------------

/**
 * SERVER ONLY — use in API routes.
 * Hard-delete a contact (bypasses RLS). Use with extreme caution.
 */
export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabaseAdmin.from('contacts').delete().eq('id', id)
  if (error) throw new Error(`deleteContact(${id}): ${error.message}`)
}

/**
 * SERVER ONLY — use in API routes.
 * Bulk upsert contacts from enrichment pipeline (Apollo, Clearbit).
 */
export async function bulkUpsertContacts(
  contacts: ContactInsert[]
): Promise<Contact[]> {
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('contacts')
    .upsert(contacts.map((c) => ({ ...c, updated_at: now })))
    .select()

  if (error) throw new Error(`bulkUpsertContacts: ${error.message}`)
  return data
}
