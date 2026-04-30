// =============================================================================
// Agency Group — Deal Pack CRUD
// GET /api/deal-packs/[id]   — fetch a deal pack
// PATCH /api/deal-packs/[id] — update status (e.g. mark sent / viewed)
// DELETE /api/deal-packs/[id] — delete (portal auth required)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { portalAuthGate } from '@/lib/requirePortalAuth'
import track from '@/lib/trackLearningEvent'

export const runtime = 'nodejs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ---------------------------------------------------------------------------
// GET /api/deal-packs/[id]
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const gate = await portalAuthGate(req)
  if (!gate.authed) return gate.response

  const { id } = await params

  // Base columns always in schema
  const { data: baseData, error } = await supabase
    .from('deal_packs')
    .select(`
      id, title, status, created_by, created_at,
      deal_id, property_id, lead_id,
      sent_at, viewed_at, ai_summary, metadata
    `)
    .eq('id', id)
    .single()

  if (error || !baseData) {
    return NextResponse.json({ error: 'Deal pack not found' }, { status: 404 })
  }

  // Merge rich content from metadata JSONB (populated by generate route)
  const meta = (baseData as Record<string, unknown>).metadata as Record<string, unknown> ?? {}
  const data = {
    ...baseData,
    investment_thesis:    meta.investment_thesis    ?? null,
    market_summary:       meta.market_summary       ?? null,
    highlights:           meta.highlights           ?? [],
    financial_projections: meta.financial_projections ?? {},
    opportunity_score:    meta.opportunity_score    ?? null,
    generated_at:         meta.generated_at         ?? null,
    view_count:           null,  // incremented below if column exists
  }

  // Track view: update viewed_at, increment view_count, advance status to 'viewed'
  // view_count: read-then-write (non-atomic but acceptable for analytics)
  // status: advance 'sent' → 'viewed' so revenue funnel counts correctly
  void (async () => {
    try {
      const { data: current } = await supabase
        .from('deal_packs')
        .select('view_count, status')
        .eq('id', id)
        .single()

      const newCount  = (Number(current?.view_count ?? 0)) + 1
      const newStatus = current?.status === 'sent' ? 'viewed' : current?.status

      await supabase
        .from('deal_packs')
        .update({
          viewed_at:  new Date().toISOString(),
          view_count: newCount,
          ...(newStatus !== current?.status ? { status: newStatus } : {}),
        })
        .eq('id', id)
    } catch {
      // Non-blocking — view tracking must never crash the GET response
    }
  })()

  return NextResponse.json({ deal_pack: data })
}

// ---------------------------------------------------------------------------
// PATCH /api/deal-packs/[id] — update status / sent_at / viewed_at
// ---------------------------------------------------------------------------

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const gate = await portalAuthGate(req)
  if (!gate.authed) return gate.response

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  // Allowlist of updatable fields (only columns confirmed in base schema)
  const allowed = ['status', 'sent_at', 'viewed_at'] as const
  type AllowedKey = typeof allowed[number]

  const updates: Partial<Record<AllowedKey, unknown>> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  // Auto-set sent_at when status changes to 'sent'
  if (updates.status === 'sent' && !updates.sent_at) {
    updates.sent_at = new Date().toISOString()
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('deal_packs')
    .update(updates)
    .eq('id', id)
    .select('id, status, sent_at, viewed_at, updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── Learning event: deal_pack_sent ─────────────────────────────────────────
  if (updates.status === 'sent') {
    track.dealPackSent({
      deal_pack_id: id,
      agent_email:  gate.email,
      metadata: { sent_at: updates.sent_at ?? new Date().toISOString() },
    })
  }

  return NextResponse.json({ success: true, deal_pack: data })
}

// ---------------------------------------------------------------------------
// DELETE /api/deal-packs/[id]
// ---------------------------------------------------------------------------

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const gate = await portalAuthGate(req)
  if (!gate.authed) return gate.response

  const { id } = await params

  const { error } = await supabase
    .from('deal_packs')
    .delete()
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, deleted_id: id })
}
