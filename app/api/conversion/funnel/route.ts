// AGENCY GROUP — SH-ROS | AMI: 22506
// GET /api/conversion/funnel
// Predicts conversion funnel + top revenue action for a buyer session.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { buyerToConversion } from '@/lib/buyer-to-conversion'
import type { BuyerIntentProfile } from '@/lib/buyer-intelligence/types'
import { valueAttributionEngine } from '@/lib/value-attribution-engine'
import type { ActionType } from '@/lib/value-attribution-engine'

export const runtime = 'nodejs'
export const maxDuration = 15

// All action types available for impact ranking
const ALL_ACTION_TYPES: ActionType[] = [
  'price_reduction',
  'photo_upgrade',
  'homepage_boost',
  'campaign_send',
  'inquiry_response',
  'visit_booking',
  'offer_submission',
  'negotiation_move',
  'listing_refresh',
  'deal_pack_send',
  'follow_up_call',
]

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = req.nextUrl
  const session_id = searchParams.get('session_id')?.trim() || null
  const property_value_eur = parseFloat(searchParams.get('property_value_eur') ?? '0')
  const current_p_close = parseFloat(searchParams.get('current_p_close') ?? '0')

  // ── 1. Fetch buyer profile if session_id provided ──────────────────────────
  let profile: BuyerIntentProfile | null = null

  if (session_id) {
    try {
      const base = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
      const url = `${base}/api/buyer-intelligence/profile?session_id=${encodeURIComponent(session_id)}`
      const res = await fetch(url, { next: { revalidate: 0 } })
      if (res.ok) {
        const json = await res.json() as { profile: BuyerIntentProfile | null }
        profile = json.profile ?? null
      }
    } catch {
      // fallback to demo profile
      profile = null
    }
  }

  // ── 2. Fallback profile ────────────────────────────────────────────────────
  if (!profile) {
    profile = {
      session_id: session_id ?? 'demo',
      primary_intent: 'unknown',
      urgency: 'unknown',
      preferred_zones: [],
      preferred_types: [],
      luxury_affinity: 0,
      investor_affinity: 0,
      family_affinity: 0,
      international_probability: 0,
      confidence: 0,
      signal_count: 0,
      first_seen: new Date(),
      last_seen: new Date(),
      events: [],
    } satisfies BuyerIntentProfile
  }

  // ── 3. Predict conversion funnel ──────────────────────────────────────────
  const prediction = buyerToConversion.predictConversionFunnel(profile)

  // ── 4. Top revenue action (only when property value is known) ─────────────
  const p_close = current_p_close > 0 ? current_p_close : prediction.p_close
  const prop_value = property_value_eur > 0 ? property_value_eur : 0

  const top_action =
    prop_value > 0
      ? valueAttributionEngine.getTopAction(prop_value, p_close, ALL_ACTION_TYPES)
      : null

  return NextResponse.json(
    {
      prediction,
      top_action,
      generated_at: new Date().toISOString(),
    },
    { status: 200 },
  )
}
