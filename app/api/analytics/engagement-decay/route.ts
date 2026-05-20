// GET /api/analytics/engagement-decay
// Recipient engagement decay analysis + re-engagement targets

import { NextRequest, NextResponse }   from 'next/server'
import { auth }                        from '@/auth'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { getRequestCorrelationId }     from '@/lib/observability/correlation'
import {
  getRecipientsByDecayStatus,
  getReengagementTargets,
  buildDecayAdjustedProfile,
} from '@/lib/intelligence/engagementDecay'
import type { EngagementStatus } from '@/lib/intelligence/engagementDecay'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const user = await getAdminRole(session.user.email)
  if (!user || !hasPermission(user.role, 'analytics:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url    = new URL(req.url)
  const view   = url.searchParams.get('view') ?? 'summary'
  const status = url.searchParams.get('status') as EngagementStatus | null
  const limit  = Math.min(Number(url.searchParams.get('limit') ?? 50), 200)

  try {
    if (view === 'reengagement') {
      const targets = await getReengagementTargets(limit)
      return NextResponse.json({
        reengagement_targets: targets,
        count: targets.length,
      })
    }

    if (view === 'by_status' && status) {
      const recipients = await getRecipientsByDecayStatus(status, limit)
      const profiles   = recipients.map(r =>
        buildDecayAdjustedProfile(r.recipient_email, r.roi_score ?? 0, r.last_distributed_at),
      )
      return NextResponse.json({ status, recipients: profiles, count: profiles.length })
    }

    // Summary: counts per status band
    const statuses: EngagementStatus[] = ['active', 'warming', 'cooling', 'dormant', 'inactive']
    const counts = await Promise.all(
      statuses.map(async s => ({
        status: s,
        count:  (await getRecipientsByDecayStatus(s, 1000)).length,
      })),
    )

    const reengagementTargets = await getReengagementTargets(10)

    return NextResponse.json({
      engagement_distribution: counts,
      total_recipients:        counts.reduce((s, c) => s + c.count, 0),
      top_reengagement_targets: reengagementTargets,
    })
  } catch (err) {
    console.error('[engagement-decay GET]', err, { corrId })
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
