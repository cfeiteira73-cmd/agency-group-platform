// POST /api/outcomes
// Records a transaction outcome (won/lost/withdrawn) with full economic truth.

import { NextRequest, NextResponse }    from 'next/server'
import { safeCompare }                  from '@/lib/safeCompare'
import { getAdminRole }                 from '@/lib/auth/adminAuth'
import { hasPermission }                from '@/lib/auth/adminAuth'
import { logAction, buildAuditEntry }   from '@/lib/auth/auditLog'
import {
  buildTransactionOutcome,
  recordTransactionOutcome,
  classifyRejectionCategory,
  buildRejectionRecord,
  recordRejection,
} from '@/lib/intelligence/outcomeCapture'
import type { ClosingFriction, OutcomeType } from '@/lib/intelligence/outcomeCapture'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')

  // Accept service key (cron/automation) or admin user token
  const isService = safeCompare(authHeader ?? '', process.env.CRON_SECRET ?? '')
  let actorEmail  = 'service'

  if (!isService) {
    const user = await getAdminRole(authHeader ?? '')
    if (!user || !hasPermission(user.role, 'commercial:write')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    actorEmail = user.user_email
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const {
    property_id,
    outcome_type,
    distribution_event_id,
    agent_email,
    investor_id,
    asking_price,
    sale_price,
    avm_value_at_time,
    duration_days,
    closing_friction,
    score_at_time,
    grade_at_time,
    rank_at_time,
    tier_at_time,
    closed_at,
    notes,
    // Rejection fields
    rejection_category,
    rejection_reason,
    lost_to_competitor,
    competitor_price,
    recipient_email,
    recipient_type,
  } = body

  if (!property_id || typeof property_id !== 'string') {
    return NextResponse.json({ error: 'property_id required' }, { status: 400 })
  }
  if (!outcome_type || !['won', 'lost', 'withdrawn'].includes(outcome_type as string)) {
    return NextResponse.json({ error: 'outcome_type must be won|lost|withdrawn' }, { status: 400 })
  }

  try {
    const outcome = buildTransactionOutcome(property_id, outcome_type as OutcomeType, {
      distributionEventId: distribution_event_id as string | undefined,
      agentEmail:          agent_email           as string | undefined,
      investorId:          investor_id           as string | undefined,
      askingPrice:         asking_price != null   ? Number(asking_price) : undefined,
      salePrice:           sale_price   != null   ? Number(sale_price)   : undefined,
      avmValueAtTime:      avm_value_at_time != null ? Number(avm_value_at_time) : undefined,
      durationDays:        duration_days != null  ? Number(duration_days) : undefined,
      closingFriction:     closing_friction       as ClosingFriction | undefined,
      scoreAtTime:         score_at_time != null  ? Number(score_at_time) : undefined,
      gradeAtTime:         grade_at_time          as string | undefined,
      rankAtTime:          rank_at_time != null   ? Number(rank_at_time) : undefined,
      tierAtTime:          tier_at_time           as string | undefined,
      closedAt:            closed_at              as string | undefined,
      recordedBy:          actorEmail,
      notes:               notes                  as string | undefined,
    })

    const outcomeId = await recordTransactionOutcome(outcome)

    // If lost/withdrawn — record rejection taxonomy
    let rejectionId: string | undefined
    if (outcome_type !== 'won') {
      const category = rejection_category
        ? (rejection_category as string)
        : rejection_reason
          ? classifyRejectionCategory(rejection_reason as string)
          : 'other'

      const rejection = buildRejectionRecord(property_id, category as Parameters<typeof buildRejectionRecord>[1], {
        distributionEventId: distribution_event_id as string | undefined,
        recipientEmail:      recipient_email        as string | undefined,
        recipientType:       recipient_type         as 'agent' | 'investor' | undefined,
        rejectionReason:     rejection_reason       as string | undefined,
        lostToCompetitor:    Boolean(lost_to_competitor),
        competitorPrice:     competitor_price != null ? Number(competitor_price) : undefined,
        scoreAtTime:         score_at_time != null   ? Number(score_at_time)     : undefined,
        gradeAtTime:         grade_at_time           as string | undefined,
      })
      rejectionId = await recordRejection(rejection)
    }

    await logAction(buildAuditEntry(actorEmail, 'record_outcome', 'property', property_id as string, {
      newValue: { outcome_type, outcome_id: outcomeId },
    }))

    return NextResponse.json({ success: true, outcome_id: outcomeId, rejection_id: rejectionId ?? null })
  } catch (err) {
    console.error('[outcomes] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
