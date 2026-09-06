import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { transitionMandateLifecycle, verifyMandateAccess } from '@/lib/crm/mandateService'
import type { MandateLifecycleState } from '@/lib/database.types'

export const runtime = 'nodejs'

const LifecycleSchema = z.object({
  action: z.enum(['ACTIVATE', 'PAUSE', 'REACTIVATE', 'COMPLETE', 'CANCEL']),
  reason: z.string().max(500).optional(),
})

const ACTION_TO_STATE: Record<string, MandateLifecycleState> = {
  ACTIVATE:   'ACTIVE',
  PAUSE:      'PAUSED',
  REACTIVATE: 'ACTIVE',
  COMPLETE:   'COMPLETED',
  CANCEL:     'CANCELLED',
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const access = await verifyMandateAccess(id, session.user.id, session.user.role)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status ?? 403 })
  }

  // Only owner (or admin) can change lifecycle
  if (session.user.role !== 'admin' && access.mandate?.owner_id !== session.user.id) {
    return NextResponse.json({ error: 'Only the mandate owner can change its lifecycle' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = LifecycleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 })
  }

  const targetState = ACTION_TO_STATE[parsed.data.action]
  const ownerId = session.user.role === 'admin'
    ? access.mandate!.owner_id
    : session.user.id

  const result = await transitionMandateLifecycle(
    id,
    ownerId,
    targetState,
    access.mandate!.holder_contact_id as number,
    parsed.data.reason,
  )

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 })
  return NextResponse.json({ ok: true, mandate: result.data })
}
