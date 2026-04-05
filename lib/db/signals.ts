// =============================================================================
// AGENCY GROUP — Signals Service
// Off-market opportunity signals: DR parsing, market intelligence, network
// Signal types: inheritance, insolvency, divorce, relocation, stagnated, etc.
// =============================================================================

import { supabase, supabaseAdmin } from '../supabase'
import type { Database, SignalStatus, SignalType } from '../database.types'

type Signal = Database['public']['Tables']['signals']['Row']
type SignalInsert = Database['public']['Tables']['signals']['Insert']
type SignalUpdate = Database['public']['Tables']['signals']['Update']

// ---------------------------------------------------------------------------
// FILTER TYPES
// ---------------------------------------------------------------------------

export interface SignalFilters {
  status?: SignalStatus
  type?: SignalType
  minPriority?: number
  zone?: string
  assignedTo?: string
  minEstimatedValue?: number
}

// ---------------------------------------------------------------------------
// READ
// ---------------------------------------------------------------------------

/**
 * Get signals with optional filters.
 * Ordered by priority asc (1=highest) then created_at desc.
 */
export async function getSignals(filters?: SignalFilters): Promise<Signal[]> {
  let query = supabase
    .from('signals')
    .select('*')
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })

  if (filters?.status) query = query.eq('status', filters.status)
  if (filters?.type) query = query.eq('type', filters.type)
  if (filters?.minPriority !== undefined) {
    query = query.lte('priority', filters.minPriority) // lower number = higher priority
  }
  if (filters?.zone) query = query.eq('property_zone', filters.zone)
  if (filters?.assignedTo) query = query.eq('assigned_to', filters.assignedTo)
  if (filters?.minEstimatedValue !== undefined) {
    query = query.gte('estimated_value', filters.minEstimatedValue)
  }

  const { data, error } = await query
  if (error) throw new Error(`getSignals: ${error.message}`)
  return data
}

/**
 * Get a single signal by ID.
 */
export async function getSignalById(id: string): Promise<Signal> {
  const { data, error } = await supabase
    .from('signals')
    .select('*')
    .eq('id', id)
    .single()

  if (error) throw new Error(`getSignalById(${id}): ${error.message}`)
  return data
}

/**
 * Get new and in_progress signals (actionable signals).
 * Used for the Deal Radar dashboard widget.
 */
export async function getActionableSignals(limit = 50): Promise<Signal[]> {
  const { data, error } = await supabase
    .from('signals')
    .select('*')
    .in('status', ['new', 'in_progress'])
    .eq('acted_on', false)
    .order('priority', { ascending: true })
    .order('probability_score', { ascending: false })
    .limit(limit)

  if (error) throw new Error(`getActionableSignals: ${error.message}`)
  return data
}

/**
 * Get signals of a specific type for analysis.
 */
export async function getSignalsByType(type: SignalType): Promise<Signal[]> {
  const { data, error } = await supabase
    .from('signals')
    .select('*')
    .eq('type', type)
    .order('created_at', { ascending: false })

  if (error) throw new Error(`getSignalsByType(${type}): ${error.message}`)
  return data
}

// ---------------------------------------------------------------------------
// WRITE
// ---------------------------------------------------------------------------

/**
 * Create a new off-market signal.
 */
export async function createSignal(signal: SignalInsert): Promise<Signal> {
  const { data, error } = await supabase
    .from('signals')
    .insert({
      ...signal,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw new Error(`createSignal: ${error.message}`)
  return data
}

/**
 * Update signal status (new → in_progress → contacted → converted/dismissed).
 */
export async function updateSignalStatus(
  id: string,
  status: SignalStatus
): Promise<Signal> {
  const updates: SignalUpdate = {
    status,
    updated_at: new Date().toISOString(),
  }

  // Auto-stamp acted_on when converting or dismissing
  if (status === 'converted' || status === 'dismissed') {
    updates.acted_on = true
    updates.acted_on_at = new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('signals')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`updateSignalStatus(${id}, ${status}): ${error.message}`)
  return data
}

/**
 * Assign a signal to a consultant.
 */
export async function assignSignal(
  id: string,
  consultantId: string
): Promise<Signal> {
  const { data, error } = await supabase
    .from('signals')
    .update({
      assigned_to: consultantId,
      status: 'in_progress',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`assignSignal(${id}): ${error.message}`)
  return data
}

/**
 * Mark a signal as converted and link it to a deal.
 */
export async function convertSignalToDeal(
  id: string,
  dealId: string
): Promise<Signal> {
  const { data, error } = await supabase
    .from('signals')
    .update({
      status: 'converted',
      converted_deal_id: dealId,
      acted_on: true,
      acted_on_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`convertSignalToDeal(${id}): ${error.message}`)
  return data
}

// ---------------------------------------------------------------------------
// ADMIN — SERVER ONLY
// ---------------------------------------------------------------------------

/**
 * SERVER ONLY — use in API routes.
 * Bulk insert signals from DR parser or market monitoring workflow.
 */
export async function bulkCreateSignals(signals: SignalInsert[]): Promise<Signal[]> {
  const now = new Date().toISOString()
  const { data, error } = await supabaseAdmin
    .from('signals')
    .insert(signals.map((s) => ({ ...s, updated_at: now })))
    .select()

  if (error) throw new Error(`bulkCreateSignals: ${error.message}`)
  return data
}
