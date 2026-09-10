import { NextRequest, NextResponse } from 'next/server'
import { getAnySession, mandateAuthRole } from '@/lib/auth/getSession'
import { removeLocation, verifyMandateAccess } from '@/lib/crm/mandateService'

export const runtime = 'nodejs'

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; locId: string }> },
) {
  const session = await getAnySession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, locId } = await params
  const authRole = mandateAuthRole(session)
  const access = await verifyMandateAccess(id, session.user.id, authRole)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status ?? 403 })

  if (authRole !== 'admin' && access.mandate?.owner_id !== session.user.id) {
    return NextResponse.json({ error: 'Only the mandate owner can remove locations' }, { status: 403 })
  }

  const ownerId = authRole === 'admin' ? access.mandate!.owner_id : session.user.id
  const result = await removeLocation(locId, id, ownerId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 })
  return NextResponse.json({ ok: true })
}
