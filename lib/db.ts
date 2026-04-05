import { supabase } from './supabase'
import type { Database } from './database.types'

type ContactInsert = Database['public']['Tables']['contacts']['Insert']
type DealInsert = Database['public']['Tables']['deals']['Insert']
type PropertyInsert = Database['public']['Tables']['properties']['Insert']

// CONTACTS

export async function getContacts(agentId?: string) {
  if (!supabase) return null
  let query = supabase
    .from('contacts')
    .select('*')
    .order('created_at', { ascending: false })
  if (agentId) query = query.eq('assigned_to', agentId)
  const { data, error } = await query
  if (error) { console.error('getContacts error:', error); return null }
  return data
}

export async function upsertContact(contact: ContactInsert) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('contacts')
    .upsert(contact)
    .select()
  if (error) { console.error('upsertContact error:', error); return null }
  return data?.[0]
}

// DEALS

export async function getDeals(agentId?: string) {
  if (!supabase) return null
  let query = supabase
    .from('deals')
    .select('*')
    .order('created_at', { ascending: false })
  if (agentId) query = query.eq('assigned_consultant', agentId)
  const { data, error } = await query
  if (error) { console.error('getDeals error:', error); return null }
  return data
}

export async function upsertDeal(deal: DealInsert) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('deals')
    .upsert(deal)
    .select()
  if (error) { console.error('upsertDeal error:', error); return null }
  return data?.[0]
}

// PROPERTIES

export async function getProperties(filters?: {
  zone?: string
  type?: string
  maxPrice?: number
}) {
  if (!supabase) return null
  let query = supabase
    .from('properties')
    .select('*')
    .eq('status', 'active')
  if (filters?.zone) query = query.eq('zone', filters.zone)
  if (filters?.type) query = query.eq('type', filters.type as import('./database.types').PropertyType)
  if (filters?.maxPrice) query = query.lte('price', filters.maxPrice)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) { console.error('getProperties error:', error); return null }
  return data
}

export async function upsertProperty(property: PropertyInsert) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('properties')
    .upsert(property)
    .select()
  if (error) { console.error('upsertProperty error:', error); return null }
  return data?.[0]
}

// Optimistic update helper
export function optimisticUpdate<T extends { id: string | number }>(
  items: T[],
  updated: T
): T[] {
  return items.map(item => item.id === updated.id ? updated : item)
}
