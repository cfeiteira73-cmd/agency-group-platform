import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { addCriterion, verifyMandateAccess } from '@/lib/crm/mandateService'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const access = await verifyMandateAccess(id, session.user.id, session.user.role)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status ?? 403 })

  const { data, error } = await supabaseAdmin
    .from('demand_mandate_criteria')
    .select('*')
    .eq('mandate_id', id)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, criteria: data })
}

const AddCriterionSchema = z.object({
  criterion_key:   z.string().min(1).max(100),
  criterion_val:   z.string().min(1).max(500),
  constraint_type: z.enum(['HARD', 'PREFERENCE', 'EXCLUSION']).optional(),
  provenance:      z.string().max(50).optional(),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const access = await verifyMandateAccess(id, session.user.id, session.user.role)
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status ?? 403 })

  if (session.user.role !== 'admin' && access.mandate?.owner_id !== session.user.id) {
    return NextResponse.json({ error: 'Only the mandate owner can add criteria' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = AddCriterionSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 })
  }

  const ownerId = session.user.role === 'admin' ? access.mandate!.owner_id : session.user.id
  const result = await addCriterion(id, ownerId, parsed.data)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 })
  return NextResponse.json({ ok: true, criterion: result.data }, { status: 201 })
}
