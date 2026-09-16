import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { createClient } from '@/lib/supabase/server'
import track from '@/lib/trackLearningEvent'
import { emit } from '@/lib/events/producers'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// resolvePortalUser — Phase 2C.C1b-AR contacts auth reconciliation
//
// Accepts NextAuth sessions AND magic-link portal sessions, using the same
// hardened boundary (requirePortalAuth) that protects all other portal routes.
// Magic-link users are resolved against the canonical users table with the
// same is_active semantics as auth.ts (null=active, false=denied).
// Service tokens are intentionally rejected — contacts are user-context resources.
// ---------------------------------------------------------------------------
type ResolvedUser =
  | { ok: false; response: NextResponse }
  | { ok: true; userId: string; userRole: string; userEmail: string }

export async function resolvePortalUser(req: NextRequest): Promise<ResolvedUser> {
  const check = await requirePortalAuth(req)
  if (!check.ok) return { ok: false, response: check.response }

  // Service tokens (crons/n8n) are not portal user sessions — contacts route is user-context
  if (check.via === 'service_token') {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  if (check.via === 'nextauth') {
    // requirePortalAuth already verified the session; call auth() to get id + role
    const session = await auth()
    if (!session?.user?.id) {
      return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }
    return {
      ok:        true,
      userId:    session.user.id,
      userRole:  session.user.role ?? 'agent',
      userEmail: session.user.email ?? check.email,
    }
  }

  // magic_link: resolve canonical user record by email using service-role client
  // Same is_active semantics as auth.ts: null=active, false=denied (never touch this logic)
  const adminClient = createSupabaseAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const { data: user } = await adminClient
    .from('users')
    .select('id, role, is_active')
    .eq('email', check.email)
    .single()

  if (!user || user.is_active === false) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  return {
    ok:        true,
    userId:    user.id as string,
    userRole:  (user.role ?? 'agent') as string,
    userEmail: check.email,
  }
}

export async function GET(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)
  const u = await resolvePortalUser(req)
  if (!u.ok) return u.response

  try {
    const { searchParams } = new URL(req.url)
    const status  = searchParams.get('status')
    const search  = searchParams.get('search')
    const page    = parseInt(searchParams.get('page') || '1')
    const limit   = parseInt(searchParams.get('limit') || '50')

    const tenantId = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'
    const supabase = await createClient()
    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false })
      .range((page - 1) * limit, page * limit - 1)

    // Admins see all contacts; agents see only their own
    if (u.userRole !== 'admin') {
      query = query.eq('assigned_to', u.userId)
    }

    if (status && status !== 'all') query = query.eq('status', status)
    if (search) {
      const safeSearch = (search as string).replace(/[%(),']/g, '').slice(0, 100)
      query = query.or(`full_name.ilike.%${safeSearch}%,email.ilike.%${safeSearch}%,phone.ilike.%${safeSearch}%`)
    }

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      contacts: data,
      total: count,
      page,
      limit,
      pages: Math.ceil((count || 0) / limit),
    })
  } catch (error) {
    console.error('GET /api/contacts error:', error, { corrId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)
  const u = await resolvePortalUser(req)
  if (!u.ok) return u.response

  try {
    const body = await req.json()

    // Validate required fields (accept both full_name and legacy name)
    const contactName = body.full_name || body.name
    if (!contactName || typeof contactName !== 'string') {
      return NextResponse.json({ error: 'full_name is required' }, { status: 400 })
    }

    const tenantId = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('contacts')
      .insert({
        full_name:          body.name || body.full_name,
        email:              body.email || null,
        phone:              body.phone || null,
        nationality:        body.nationality || null,
        language:           (body.language || 'pt').toLowerCase(),
        budget_min:         body.budget_min || null,
        budget_max:         body.budget_max || null,
        preferred_locations: body.preferred_locations || body.zonas || [],
        typologies_wanted:  body.typologies_wanted || body.tipos || [],
        status:             body.status || 'lead',
        notes:              body.notes || null,
        source:             body.source || body.origin || null,
        last_contact_at:    body.last_contact_at || body.last_contact || null,
        lead_score:         body.lead_score || 0,
        assigned_to:        u.userId,
        tenant_id:          tenantId,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const agentEmail = u.userEmail
    const corrId2    = getRequestCorrelationId(req)
    // Non-blocking learning event (direct Supabase path — proven analytics)
    track.contactCreated({
      lead_id:        data?.id ?? null,
      agent_email:    agentEmail,
      correlation_id: corrId2,
      source_system:  'api',
      metadata:       { source: body.source ?? null, lead_score: body.lead_score ?? 0 },
    })
    // Event bus activation — typed lead_created event with dedup + DLQ (fire-and-forget)
    void emit.leadCreated(
      {
        lead_id:     String(data?.id ?? ''),
        nome:        body.full_name || body.name || '',
        source:      body.source ?? null,
        assigned_to: agentEmail,
        score:       body.lead_score ?? null,
        cidade:      body.preferred_locations?.[0] ?? null,
      },
      { correlation_id: corrId2, source_system: 'api' },
    )

    return NextResponse.json({ success: true, contact: data }, { status: 201 })
  } catch (error) {
    console.error('POST /api/contacts error:', error, { corrId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)
  const u = await resolvePortalUser(req)
  if (!u.ok) return u.response

  try {
    const body = await req.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const tenantId = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'
    const supabase = await createClient()

    // Build update object (only allowed fields)
    // Includes migration 007 buyer intelligence fields
    const allowed = [
      'full_name','email','phone','nationality','language',
      'budget_min','budget_max','preferred_locations','typologies_wanted',
      'status','notes','source','last_contact_at','lead_score',
      'next_followup_at','lead_tier','assigned_to','tags',
      'use_type','timeline','financing_type','features_required',
      'bedrooms_min','bedrooms_max','ai_summary','ai_suggested_action',
      'detected_intent','qualification_notes','qualified_at',
      'gdpr_consent','gdpr_consent_at','opt_out_marketing','opt_out_whatsapp',
      // Buyer intelligence
      'buyer_score','buyer_type','liquidity_profile','proof_of_funds_status',
      'ticket_preference','target_strategy','deals_closed_count','avg_close_days',
      'negotiation_style','reliability_score','response_rate','active_status',
      'buyer_readiness_score','buyer_ready_for_deal',
      'preferred_asset_types','buyer_scored_at','buyer_tier',
    ]
    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const key of allowed) {
      if (key in updates) updateData[key] = updates[key]
    }

    let query = supabase
      .from('contacts')
      .update(updateData)
      .eq('id', id)
      .eq('tenant_id', tenantId)

    // Agents can only update their own contacts
    if (u.userRole !== 'admin') {
      query = query.eq('assigned_to', u.userId)
    }

    const { data, error } = await query.select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Contact not found or access denied' }, { status: 404 })

    return NextResponse.json({ success: true, contact: data })
  } catch (error) {
    console.error('PUT /api/contacts error:', error, { corrId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const corrId = getRequestCorrelationId(req)
  const u = await resolvePortalUser(req)
  if (!u.ok) return u.response

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const tenantId = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'
    const supabase = await createClient()

    // Soft delete: mark as inactive
    let query = supabase
      .from('contacts')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('tenant_id', tenantId)

    if (u.userRole !== 'admin') {
      query = query.eq('assigned_to', u.userId)
    }

    const { data, error } = await query.select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Contact not found or access denied' }, { status: 404 })

    return NextResponse.json({ success: true, message: 'Contact archived' })
  } catch (error) {
    console.error('DELETE /api/contacts error:', error, { corrId })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
