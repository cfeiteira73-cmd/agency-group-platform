// GET /api/analytics/conversion-propensity?property_id=...
// Rank all eligible recipients for a property by conversion propensity

import { NextRequest, NextResponse }   from 'next/server'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import {
  getRecipientSignalsForProperty,
  rankRecipientsByPropensity,
  explainRanking,
} from '@/lib/intelligence/conversionPropensity'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const user       = await getAdminRole(authHeader ?? '')
  if (!user || !hasPermission(user.role, 'analytics:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url           = new URL(req.url)
  const propertyId    = url.searchParams.get('property_id')
  const zoneKey       = url.searchParams.get('zone')           ?? ''
  const propertyType  = url.searchParams.get('property_type')  ?? ''
  const askingPrice   = Number(url.searchParams.get('price')   ?? 0)
  const estYield      = url.searchParams.get('yield')         != null ? Number(url.searchParams.get('yield')) : null
  const recipientType = (url.searchParams.get('recipient_type') ?? 'all') as 'agent' | 'investor' | 'all'
  const limit         = Math.min(Number(url.searchParams.get('limit') ?? 30), 100)
  const explain       = url.searchParams.get('explain') === 'true'

  if (!propertyId && (!zoneKey || !propertyType)) {
    return NextResponse.json(
      { error: 'property_id required (or zone + property_type + price)' },
      { status: 400 },
    )
  }

  try {
    const property = {
      zone_key:            zoneKey,
      property_type:       propertyType,
      asking_price:        askingPrice,
      estimated_yield_pct: estYield,
    }

    const signals = await getRecipientSignalsForProperty({
      propertyId:    propertyId ?? '',
      recipientType,
      limit:         limit * 3,   // fetch extra, trim after ranking
    })

    const ranked = rankRecipientsByPropensity(signals, property).slice(0, limit)

    const response = ranked.map(r => ({
      rank:             r.rank,
      recipient_email:  r.recipient_email,
      propensity_score: r.propensity_score,
      is_eligible:      r.is_eligible,
      tier:             signals.find(s => s.recipient_email === r.recipient_email)?.tier,
      breakdown: {
        property_fit:   r.property_fit,
        engagement:     r.engagement,
        response_speed: r.response_speed,
        capacity:       r.capacity,
        tier_multiplier: r.tier_multiplier,
      },
      explanation:      explain ? explainRanking(r) : undefined,
      ineligibility_reason: r.ineligibility_reason,
    }))

    return NextResponse.json({
      property_id:   propertyId,
      zone_key:      zoneKey,
      ranked_recipients: response,
      eligible_count:    ranked.filter(r => r.is_eligible).length,
      total_evaluated:   signals.length,
    })
  } catch (err) {
    console.error('[conversion-propensity GET]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
