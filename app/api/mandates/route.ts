import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getAnySession } from '@/lib/auth/getSession'
import {
  createMandate,
  getMandatesByContactId,
  verifyContactAccess,
  verifyProfileExists,
} from '@/lib/crm/mandateService'
import type { MandateLifecycleState } from '@/lib/database.types'

export const runtime = 'nodejs'

// ── GET /api/mandates?contact_id=N[&lifecycle=STATE] ─────────────────────────

export async function GET(req: NextRequest) {
  const session = await getAnySession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const contactIdParam = searchParams.get('contact_id')
  if (!contactIdParam || !/^\d+$/.test(contactIdParam)) {
    return NextResponse.json({ error: 'contact_id (numeric) is required' }, { status: 400 })
  }
  const contactId = Number(contactIdParam)

  const lifecycleParam = searchParams.get('lifecycle') as MandateLifecycleState | null

  // Verify CRM access to contact
  const access = await verifyContactAccess(contactId, session.user.id, session.user.role)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status ?? 403 })
  }

  const result = await getMandatesByContactId(
    contactId,
    lifecycleParam ? { lifecycle_state: lifecycleParam } : undefined,
  )

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ ok: true, mandates: result.data })
}

// ── POST /api/mandates ────────────────────────────────────────────────────────

const CreateMandateSchema = z.object({
  holder_contact_id: z.number().int().positive(),
  transaction_mode:  z.enum(['BUY', 'RENT']),
  purpose:           z.enum(['PRIMARY_RESIDENCE', 'SECONDARY_RESIDENCE', 'HOLIDAY', 'INVESTMENT', 'DEVELOPMENT', 'OTHER']),
  lifecycle_state:   z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'EXPIRED', 'CANCELLED']).optional(),
  budget_min:        z.number().min(0).nullable().optional(),
  budget_max:        z.number().min(0).nullable().optional(),
  currency_code:     z.string().length(3).regex(/^[A-Z]{3}$/).optional(),
  budget_provenance: z.enum(['USER_STATED', 'AGENT_VERIFIED', 'AI_EXTRACTED', 'INFERRED', 'IMPORT']).optional(),
  origin:            z.enum(['CONTACT_FORM', 'SOFIA_DRAFT', 'AGENT_ENTRY', 'IMPORT', 'SAVED_SEARCH']).optional(),
  notes:             z.string().max(5000).nullable().optional(),
  expires_at:        z.string().datetime().nullable().optional(),
  mandate_type:      z.enum(['buyer', 'investor']).optional(),
  buyer_details:     z.object({
    bedrooms_min:        z.number().int().min(0).nullable().optional(),
    bedrooms_max:        z.number().int().min(0).nullable().optional(),
    bathrooms_min:       z.number().int().min(0).nullable().optional(),
    area_min_m2:         z.number().min(0).nullable().optional(),
    area_max_m2:         z.number().min(0).nullable().optional(),
    financing_type:      z.enum(['CASH', 'MORTGAGE', 'MIXED', 'UNKNOWN']).nullable().optional(),
    timeline:            z.enum(['IMMEDIATE', '3_MONTHS', '6_MONTHS', '1_YEAR', 'FLEXIBLE', 'UNKNOWN']).nullable().optional(),
    proof_of_funds:      z.enum(['NONE', 'STATED', 'DOCUMENT_SEEN', 'VERIFIED']).optional(),
    golden_visa_required: z.boolean().optional(),
    mortgage_preapproved: z.boolean().optional(),
  }).optional(),
  investor_details: z.object({
    target_yield_min_pct: z.number().min(0).nullable().optional(),
    target_yield_max_pct: z.number().min(0).nullable().optional(),
    ticket_min:           z.number().min(0).nullable().optional(),
    ticket_max:           z.number().min(0).nullable().optional(),
    ticket_currency_code: z.string().length(3).optional(),
    risk_tolerance:       z.enum(['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']).nullable().optional(),
    requires_management:  z.boolean().optional(),
    open_to_off_market:   z.boolean().optional(),
  }).optional(),
  locations: z.array(z.object({
    geography_node_id: z.string().uuid(),
    mode:              z.enum(['INCLUDE', 'EXCLUDE']).optional(),
    preference_weight: z.number().int().min(0).max(100).optional(),
  })).max(20).optional(),
  criteria: z.array(z.object({
    criterion_key:   z.string().min(1).max(100),
    criterion_val:   z.string().min(1).max(500),
    constraint_type: z.enum(['HARD', 'PREFERENCE', 'EXCLUSION']).optional(),
    provenance:      z.string().max(50).optional(),
  })).max(50).optional(),
  participants: z.array(z.object({
    contact_id: z.number().int().positive(),
    role:       z.enum(['HOLDER', 'DECISION_MAKER', 'ADVISER', 'REPRESENTATIVE', 'OTHER']).optional(),
  })).max(10).optional(),
})

export async function POST(req: NextRequest) {
  const session = await getAnySession()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = CreateMandateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 })
  }

  const input = parsed.data

  // IDOR prevention: verify session user has CRM access to holder contact
  const access = await verifyContactAccess(input.holder_contact_id, session.user.id, session.user.role)
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status ?? 403 })
  }

  // Profile existence check: mandate creation requires a profile row
  const hasProfile = await verifyProfileExists(session.user.id)
  if (!hasProfile) {
    return NextResponse.json(
      { error: 'Your user account has no CRM profile. Contact an administrator.' },
      { status: 409 },
    )
  }

  // owner_id is ALWAYS derived server-side — never from client payload
  const result = await createMandate({
    ...input,
    owner_id: session.user.id,  // server-side resolution, not client-supplied
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 422 })
  }

  return NextResponse.json({ ok: true, mandate_id: result.data!.mandate_id }, { status: 201 })
}
