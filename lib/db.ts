import { supabase } from './supabase'

// CONTACTS

export async function getContacts(agentEmail: string) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('agent_email', agentEmail)
    .order('created_at', { ascending: false })
  if (error) { console.error('getContacts error:', error); return null }
  return data
}

export async function upsertContact(contact: Record<string, unknown>) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('contacts')
    .upsert(contact)
    .select()
  if (error) { console.error('upsertContact error:', error); return null }
  return data?.[0]
}

// DEALS

export async function getDeals(agentEmail: string) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .eq('agent_email', agentEmail)
    .order('created_at', { ascending: false })
  if (error) { console.error('getDeals error:', error); return null }
  return data
}

export async function upsertDeal(deal: Record<string, unknown>) {
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
  zona?: string
  tipo?: string
  precoMax?: number
}) {
  if (!supabase) return null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .from('properties')
    .select('*')
    .eq('status', 'Ativo')
  if (filters?.zona) query = query.eq('zona', filters.zona)
  if (filters?.tipo) query = query.eq('tipo', filters.tipo)
  if (filters?.precoMax) query = query.lte('preco', filters.precoMax)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) { console.error('getProperties error:', error); return null }
  return data
}

export async function upsertProperty(property: Record<string, unknown>) {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('properties')
    .upsert(property)
    .select()
  if (error) { console.error('upsertProperty error:', error); return null }
  return data?.[0]
}
