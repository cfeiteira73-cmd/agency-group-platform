import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getMandateHistory, verifyMandateAccess } from '@/lib/crm/mandateService'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const access = await verifyMandateAccess(id, session.user.id, session.user.role)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status ?? 403 })

  const result = await getMandateHistory(id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ ok: true, history: result.data })
}
