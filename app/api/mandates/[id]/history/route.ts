import { NextRequest, NextResponse } from 'next/server'
import { getAnySession, mandateAuthRole } from '@/lib/auth/getSession'
import { getMandateHistory, verifyMandateAccess } from '@/lib/crm/mandateService'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAnySession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const authRole = mandateAuthRole(session)
  const access = await verifyMandateAccess(id, session.user.id, authRole)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status ?? 403 })

  const result = await getMandateHistory(id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ ok: true, history: result.data })
}
