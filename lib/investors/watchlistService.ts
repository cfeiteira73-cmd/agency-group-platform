// =============================================================================
// Agency Group — Investor Watchlist + Engagement Service
// lib/investors/watchlistService.ts
//
// Manages investor watchlists, engagement event recording, and deal
// subscription matching for the Network Effect Engine.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { recordInvestorOutcome } from '@/lib/ml/feedbackLoop'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WatchlistEntry {
  property_id: string
  priority:    string
  added_at:    string
  notes:       string | null
}

export interface EngagementEvent {
  tenantId:            string
  investorId:          string
  eventType:           'match_viewed' | 'property_saved' | 'deal_pack_opened' |
                       'call_booked'  | 'offer_made'     | 'deal_closed'      |
                       'offer_rejected' | 'unsubscribed'
  propertyId?:         string
  matchScore?:         number
  responseTimeHours?:  number
  metadata?:           Record<string, unknown>
}

export interface SubscriptionMatch {
  investor_id:     string
  subscription_id: string
}

// ─── Watchlist operations ─────────────────────────────────────────────────────

/**
 * Add (or update) a property to an investor's watchlist.
 * Idempotent — upserts on (investor_id, property_id).
 * Logs errors rather than throwing.
 */
export async function addToWatchlist(
  investorId:  string,
  propertyId:  string,
  tenantId:    string,
  priority?:   'urgent' | 'high' | 'normal' | 'low',
  notes?:      string,
): Promise<void> {
  const db = supabaseAdmin as any

  const { error } = await db
    .from('investor_watchlists')
    .upsert(
      {
        tenant_id:   tenantId,
        investor_id: investorId,
        property_id: propertyId,
        priority:    priority ?? 'normal',
        notes:       notes ?? null,
        added_at:    new Date().toISOString(),
      },
      { onConflict: 'investor_id,property_id' },
    )

  if (error) {
    console.error('[WatchlistService] addToWatchlist failed:', error.message, {
      investorId,
      propertyId,
      tenantId,
    })
  }
}

/**
 * Remove a property from an investor's watchlist.
 * Logs errors rather than throwing.
 */
export async function removeFromWatchlist(
  investorId: string,
  propertyId: string,
  tenantId:   string,
): Promise<void> {
  const db = supabaseAdmin as any

  const { error } = await db
    .from('investor_watchlists')
    .delete()
    .eq('tenant_id',   tenantId)
    .eq('investor_id', investorId)
    .eq('property_id', propertyId)

  if (error) {
    console.error('[WatchlistService] removeFromWatchlist failed:', error.message, {
      investorId,
      propertyId,
      tenantId,
    })
  }
}

/**
 * Return all watchlisted properties for an investor, newest first.
 */
export async function getInvestorWatchlist(
  investorId: string,
  tenantId:   string,
): Promise<WatchlistEntry[]> {
  const db = supabaseAdmin as any

  const { data, error } = await db
    .from('investor_watchlists')
    .select('property_id, priority, added_at, notes')
    .eq('tenant_id',   tenantId)
    .eq('investor_id', investorId)
    .order('added_at', { ascending: false })

  if (error) {
    console.error('[WatchlistService] getInvestorWatchlist failed:', error.message, {
      investorId,
      tenantId,
    })
    return []
  }

  return (data ?? []) as WatchlistEntry[]
}

// ─── Engagement tracking ──────────────────────────────────────────────────────

/**
 * Record an investor engagement event.
 * Fire-and-forget — errors are logged, never thrown.
 */
export async function recordEngagement(event: EngagementEvent): Promise<void> {
  const db = supabaseAdmin as any

  const { error } = await db
    .from('investor_engagement_events')
    .insert({
      tenant_id:            event.tenantId,
      investor_id:          event.investorId,
      event_type:           event.eventType,
      property_id:          event.propertyId   ?? null,
      match_score:          event.matchScore    ?? null,
      response_time_hours:  event.responseTimeHours ?? null,
      metadata:             event.metadata      ?? {},
      occurred_at:          new Date().toISOString(),
    })

  if (error) {
    console.error('[WatchlistService] recordEngagement failed:', error.message, {
      investorId: event.investorId,
      eventType:  event.eventType,
    })
  }

  // Wire recordInvestorOutcome for high-value engagement events (offer_made / deal_closed)
  // Fire-and-forget: failure must not block the primary engagement recording
  if (['offer_made', 'deal_closed'].includes(event.eventType) && event.propertyId) {
    void recordInvestorOutcome({
      investorId:         event.investorId,
      propertyId:         event.propertyId,
      tenantId:           event.tenantId,
      outcome:            event.eventType === 'deal_closed' ? 'closed_won' : 'converted',
      matchScore:         event.matchScore ?? 0,
      responseTimeHours:  event.responseTimeHours ?? null,
      occurredAt:         new Date().toISOString(),
    }).catch((e: unknown) => console.warn(
      '[WatchlistService] recordInvestorOutcome failed:',
      e instanceof Error ? e.message : String(e),
    ))
  }
}

// ─── Deal subscription matching ───────────────────────────────────────────────

interface PropertyCriteria {
  priceEur:  number
  zona:      string | null
  tipo:      string | null
  tenantId:  string
}

interface SubscriptionRow {
  id:              string
  investor_id:     string
  min_price_eur:   number | null
  max_price_eur:   number | null
  min_match_score: number | null
  geography:       string[] | null
  property_types:  string[] | null
}

/**
 * Return all active subscriptions that match the given property + matchScore.
 * Returns [] on error.
 */
export async function getMatchingSubscriptions(
  property:   PropertyCriteria,
  matchScore: number,
): Promise<SubscriptionMatch[]> {
  const db = supabaseAdmin as any

  const { data, error } = await db
    .from('deal_subscriptions')
    .select('id, investor_id, min_price_eur, max_price_eur, min_match_score, geography, property_types')
    .eq('tenant_id', property.tenantId)
    .eq('active',    true)

  if (error) {
    console.error('[WatchlistService] getMatchingSubscriptions failed:', error.message, {
      tenantId: property.tenantId,
    })
    return []
  }

  const rows = (data ?? []) as SubscriptionRow[]

  const matched: SubscriptionMatch[] = []

  for (const sub of rows) {
    // Price range filter (only apply if bounds are set)
    if (sub.min_price_eur !== null && property.priceEur < sub.min_price_eur) continue
    if (sub.max_price_eur !== null && property.priceEur > sub.max_price_eur) continue

    // Match score threshold
    const minScore = sub.min_match_score ?? 60
    if (matchScore < minScore) continue

    // Geography filter
    if (
      sub.geography !== null &&
      sub.geography.length > 0 &&
      property.zona !== null &&
      !sub.geography.includes(property.zona)
    ) continue

    // Property type filter
    if (
      sub.property_types !== null &&
      sub.property_types.length > 0 &&
      property.tipo !== null &&
      !sub.property_types.includes(property.tipo)
    ) continue

    matched.push({
      investor_id:     sub.investor_id,
      subscription_id: sub.id,
    })
  }

  return matched
}
