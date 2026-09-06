import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { auth } from '@/auth'
import { getMandateById, patchMandate, verifyMandateAccess } from '@/lib/crm/mandateService'

export const runtime = 'nodejs'

// ── GET /api/mandates/[id] ────────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const access = await verifyMandateAccess(id, session.user.id, session.user.role)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status ?? 403 })
  }

  const result = await getMandateById(id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ ok: true, mandate: result.data })
}

// ── PATCH /api/mandates/[id] ──────────────────────────────────────────────────

const PatchMandateSchema = z.object({
  notes:             z.string().max(5000).nullable().optional(),
  expires_at:        z.string().datetime().nullable().optional(),
  budget_min:        z.number().min(0).nullable().optional(),
  budget_max:        z.number().min(0).nullable().optional(),
  currency_code:     z.string().length(3).regex(/^[A-Z]{3}$/).optional(),
  budget_provenance: z.enum(['USER_STATED', 'AGENT_VERIFIED', 'AI_EXTRACTED', 'INFERRED', 'IMPORT']).optional(),
  paused_reason:     z.string().max(500).nullable().optional(),
}).strict() // reject unknown fields — prevent mass assignment

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  // Mandate access + ownership check
  const access = await verifyMandateAccess(id, session.user.id, session.user.role)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status ?? 403 })
  }

  // Only owner (or admin) can update mandate core fields
  if (session.user.role !== 'admin' && access.mandate?.owner_id !== session.user.id) {
    return NextResponse.json({ error: 'Only the mandate owner can update it' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = PatchMandateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 })
  }

  const ownerId = session.user.role === 'admin'
    ? access.mandate!.owner_id  // admin can patch any mandate
    : session.user.id

  const result = await patchMandate(id, ownerId, parsed.data)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 422 })
  return NextResponse.json({ ok: true, mandate: result.data })
}
