// AGENCY GROUP — Buyer Intelligence Engine | AMI: 22506
// lib/buyer-intelligence/types.ts

export type BuyerIntent =
  | 'investor'
  | 'luxury_buyer'
  | 'family'
  | 'relocating'
  | 'retirement'
  | 'international'
  | 'rental_yield'
  | 'unknown'

export type UrgencyLevel = 'hot' | 'warm' | 'browsing' | 'unknown'

export type BuyerEventType =
  | 'page_view'
  | 'listing_view'
  | 'listing_save'
  | 'filter_apply'
  | 'inquiry_start'
  | 'inquiry_submit'
  | 'price_range_view'
  | 'map_view'
  | 'scroll_depth'
  | 'revisit'

export interface BuyerBehaviorEvent {
  session_id: string
  event_type: BuyerEventType
  payload: Record<string, unknown>
  timestamp: Date
}

export interface BuyerIntentProfile {
  session_id: string
  primary_intent: BuyerIntent
  secondary_intent?: BuyerIntent
  urgency: UrgencyLevel
  budget_min_estimate?: number
  budget_max_estimate?: number
  preferred_zones: string[]
  preferred_types: string[]
  luxury_affinity: number      // 0-100
  investor_affinity: number    // 0-100
  family_affinity: number      // 0-100
  international_probability: number // 0-100
  confidence: number           // 0-100
  signal_count: number
  first_seen: Date
  last_seen: Date
  events: BuyerBehaviorEvent[]
}
