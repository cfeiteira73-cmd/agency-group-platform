import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { removeCriterion, verifyMandateAccess } from '@/lib/crm/mandateService'

export const runtime = 'nodejs'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; critId: string }> },
) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, critId } = await params
  const access = await verifyMandateAccess(id, session.user.id, session.user.role)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status ?? 403 })

  if (session.user.role !== 'admin' && access.mandate?.owner_id !== session.user.id) {
    return NextResponse.json({ error: 'Only the mandate owner can remove criteria' }, { status: 403 })
  }

  const ownerId = session.user.role === 'admin' ? access.mandate!.owner_id : session.user.id
  const result = await removeCriterion(critId, id, ownerId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 })
  return NextResponse.json({ ok: true })
}
