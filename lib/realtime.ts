// =============================================================================
// Agency Group — Supabase Realtime Subscriptions v1.0
// lib/realtime.ts
//
// Client-side Realtime hooks for the portal dashboard.
// Subscribe to live changes in: priority_items, matches, deal_packs,
// learning_events (for notifications).
//
// Usage (in portal React components):
//   import { useRealtimePriority, useRealtimeMatches } from '@/lib/realtime'
//
//   const { items, connected } = useRealtimePriority(agentEmail)
//   const { matches, connected } = useRealtimeMatches(leadId)
//
// Design:
//   - Each hook manages its own Supabase channel subscription
//   - Cleanup on unmount (no leaks)
//   - Falls back gracefully if Realtime is unavailable
//   - Patches local state on INSERT/UPDATE/DELETE (no full re-fetch)
// =============================================================================

'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient, RealtimeChannel } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Supabase browser client (Realtime requires the anon key, not service role)
// ---------------------------------------------------------------------------

function getBrowserClient() {
  if (typeof window === 'undefined') return null
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key)
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RealtimePriorityItem {
  id: string
  entity_type: string
  entity_id: string
  priority_score: number
  reason: string
  next_best_action?: string
  deadline?: string
  owner_id?: string
  revenue_impact?: number
  status: string
  source: string
  created_at: string
  updated_at: string
}

export interface RealtimeMatch {
  id: string
  lead_id: string
  property_id?: string
  match_score: number
  priority_level: 'high' | 'medium' | 'low'
  next_best_action?: string
  next_action_deadline?: string
  status: string
  created_at: string
}

export interface RealtimeDealPack {
  id: string
  title: string
  status: string
  lead_id?: string
  view_count: number
  sent_at?: string
  viewed_at?: string
  created_by: string
  created_at: string
}

// ---------------------------------------------------------------------------
// Hook: useRealtimePriority
// Subscribes to priority_items for the given agent
// ---------------------------------------------------------------------------

export function useRealtimePriority(agentEmail?: string): {
  items: RealtimePriorityItem[]
  connected: boolean
  lastUpdated: Date | null
} {
  const [items,       setItems]       = useState<RealtimePriorityItem[]>([])
  const [connected,   setConnected]   = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const supabase = getBrowserClient()
    if (!supabase) return

    let cancelled = false

    // Initial fetch
    ;(async () => {
      const q = supabase
        .from('priority_items')
        .select('*')
        .eq('status', 'open')
        .order('priority_score', { ascending: false })
        .limit(100)

      const { data } = agentEmail
        ? await q.eq('owner_id', agentEmail)
        : await q

      if (!cancelled && data) {
        setItems(data as RealtimePriorityItem[])
        setLastUpdated(new Date())
      }
    })()

    // Realtime subscription
    const channel = supabase
      .channel(`priority_items:agent:${agentEmail ?? 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table:  'priority_items',
          filter: agentEmail ? `owner_id=eq.${agentEmail}` : undefined,
        },
        (payload) => {
          if (cancelled) return
          setLastUpdated(new Date())

          if (payload.eventType === 'INSERT') {
            setItems(prev => [payload.new as RealtimePriorityItem, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setItems(prev => prev.map(i =>
              i.id === (payload.new as RealtimePriorityItem).id
                ? payload.new as RealtimePriorityItem
                : i
            ))
          } else if (payload.eventType === 'DELETE') {
            setItems(prev => prev.filter(i => i.id !== (payload.old as { id: string }).id))
          }
        }
      )
      .subscribe((status) => {
        if (!cancelled) setConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    return () => {
      cancelled = true
      channel.unsubscribe()
    }
  }, [agentEmail])

  return { items, connected, lastUpdated }
}

// ---------------------------------------------------------------------------
// Hook: useRealtimeMatches
// Subscribes to matches for a given lead_id
// ---------------------------------------------------------------------------

export function useRealtimeMatches(leadId?: string): {
  matches: RealtimeMatch[]
  connected: boolean
  lastUpdated: Date | null
} {
  const [matches,     setMatches]     = useState<RealtimeMatch[]>([])
  const [connected,   setConnected]   = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const supabase = getBrowserClient()
    if (!supabase || !leadId) return

    let cancelled = false

    // Initial fetch
    ;(async () => {
      const { data } = await supabase
        .from('matches')
        .select('id, lead_id, property_id, match_score, priority_level, next_best_action, next_action_deadline, status, created_at')
        .eq('lead_id', leadId)
        .order('match_score', { ascending: false })
        .limit(20)

      if (!cancelled && data) {
        setMatches(data as RealtimeMatch[])
        setLastUpdated(new Date())
      }
    })()

    const channel = supabase
      .channel(`matches:lead:${leadId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches', filter: `lead_id=eq.${leadId}` },
        (payload) => {
          if (cancelled) return
          setLastUpdated(new Date())
          if (payload.eventType === 'INSERT') {
            setMatches(prev => [payload.new as RealtimeMatch, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setMatches(prev => prev.map(m =>
              m.id === (payload.new as RealtimeMatch).id ? payload.new as RealtimeMatch : m
            ))
          }
        }
      )
      .subscribe((status) => {
        if (!cancelled) setConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel
    return () => { cancelled = true; channel.unsubscribe() }
  }, [leadId])

  return { matches, connected, lastUpdated }
}

// ---------------------------------------------------------------------------
// Hook: useRealtimeDealPacks
// Subscribes to deal_packs created by a specific agent
// ---------------------------------------------------------------------------

export function useRealtimeDealPacks(agentEmail?: string): {
  packs: RealtimeDealPack[]
  connected: boolean
  lastUpdated: Date | null
} {
  const [packs,       setPacks]       = useState<RealtimeDealPack[]>([])
  const [connected,   setConnected]   = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  useEffect(() => {
    const supabase = getBrowserClient()
    if (!supabase) return

    let cancelled = false

    // Initial fetch
    ;(async () => {
      const q = supabase
        .from('deal_packs')
        .select('id, title, status, lead_id, view_count, sent_at, viewed_at, created_by, created_at')
        .order('created_at', { ascending: false })
        .limit(50)

      const { data } = agentEmail ? await q.eq('created_by', agentEmail) : await q
      if (!cancelled && data) {
        setPacks(data as RealtimeDealPack[])
        setLastUpdated(new Date())
      }
    })()

    const channel = supabase
      .channel(`deal_packs:agent:${agentEmail ?? 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'deal_packs',
          filter: agentEmail ? `created_by=eq.${agentEmail}` : undefined,
        },
        (payload) => {
          if (cancelled) return
          setLastUpdated(new Date())
          if (payload.eventType === 'INSERT') {
            setPacks(prev => [payload.new as RealtimeDealPack, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setPacks(prev => prev.map(p =>
              p.id === (payload.new as RealtimeDealPack).id ? payload.new as RealtimeDealPack : p
            ))
          } else if (payload.eventType === 'DELETE') {
            setPacks(prev => prev.filter(p => p.id !== (payload.old as { id: string }).id))
          }
        }
      )
      .subscribe((status) => {
        if (!cancelled) setConnected(status === 'SUBSCRIBED')
      })

    return () => { cancelled = true; channel.unsubscribe() }
  }, [agentEmail])

  return { packs, connected, lastUpdated }
}
