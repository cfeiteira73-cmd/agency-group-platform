// =============================================================================
// Agency Group — Off-Market Leads API
// GET  /api/offmarket-leads          — list leads (filterable by status/cidade/score)
// POST /api/offmarket-leads          — create new lead (manual or from scraping)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { auth } from '@/auth'
import { safeCompare } from '@/lib/safeCompare'

const TABLE = 'offmarket_leads'
const DEFAULT_PAGE_SIZE = 50

function isAuthorized(req: NextRequest, session: { user?: unknown } | null): boolean {
  if (session?.user) return true
  const authHeader = req.headers.get('authorization') ?? ''
  const xCronSecret = req.headers.get('x-cron-secret') ?? ''
  return (
    safeCompare(authHeader, `Bearer ${process.env.CRON_SECRET ?? ''}`) ||
    safeCompare(authHeader, `Bearer ${process.env.PORTAL_API_SECRET ?? ''}`) ||
    safeCompare(xCronSecret, process.env.CRON_SECRET ?? '')
  )
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!isAuthorized(req, session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sp = req.nextUrl.searchParams
    const status   = sp.get('status')
    const cidade   = sp.get('cidade')
    const minScore = sp.get('min_score')
    const assigned = sp.get('assigned_to')
    const page     = Math.max(1, parseInt(sp.get('page') ?? '1', 10))
    const limit    = Math.min(200, parseInt(sp.get('limit') ?? String(DEFAULT_PAGE_SIZE), 10))
    const offset   = (page - 1) * limit

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabaseAdmin as any).from(TABLE)
      .select('*', { count: 'exact' })
      .order('score', { ascending: false })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (status)   query = query.eq('status', status)
    if (cidade)   query = query.ilike('cidade', `%${cidade}%`)
    if (minScore) query = query.gte('score', parseInt(minScore, 10))
    if (assigned) query = query.eq('assigned_to', assigned)

    const { data, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      data,
      pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
    })
  } catch (err) {
    console.error('[offmarket-leads GET]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    // Accept either: (1) authenticated portal session, or (2) Bearer/x-cron-secret for Apify/n8n
    const session = await auth()
    if (!isAuthorized(req, session)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: unknown = await req.json()
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    const data = body as Record<string, unknown>

    if (!data.nome || typeof data.nome !== 'string' || !data.nome.trim()) {
      return NextResponse.json({ error: '"nome" is required' }, { status: 400 })
    }

    const sourceListing = typeof data.source_listing_id === 'string' ? data.source_listing_id : null
    const source = typeof data.source === 'string' ? data.source : 'manual'

    // --- Anti-duplication: check source_listing_id uniqueness before insert ---
    if (sourceListing) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: existing } = await (supabaseAdmin as any).from(TABLE)
        .select('id, nome')
        .eq('source', source)
        .eq('source_listing_id', sourceListing)
        .maybeSingle()
      if (existing) {
        console.log(`[offmarket-leads POST] Duplicate blocked: source=${source} listing_id=${sourceListing}`)
        return NextResponse.json(
          { error: 'Lead already exists', existing_id: existing.id },
          { status: 409 }
        )
      }
    }

    const payload = {
      nome:              String(data.nome).trim(),
      tipo_ativo:        typeof data.tipo_ativo === 'string' ? data.tipo_ativo : null,
      localizacao:       typeof data.localizacao === 'string' ? data.localizacao : null,
      cidade:            typeof data.cidade === 'string' ? data.cidade : null,
      area_m2:           typeof data.area_m2 === 'number' ? data.area_m2 : null,
      price_ask:         typeof data.price_ask === 'number' ? data.price_ask : null,
      price_estimate:    typeof data.price_estimate === 'number' ? data.price_estimate : null,
      score:             typeof data.score === 'number' ? Math.min(100, Math.max(0, data.score)) : null,
      score_breakdown:   data.score_breakdown ?? null,
      score_updated_at:  data.score !== undefined ? new Date().toISOString() : null,
      score_status:      (data.score !== undefined ? 'scored' : 'pending_score') as string,
      contacto:          typeof data.contacto === 'string' ? data.contacto : null,
      owner_type:        typeof data.owner_type === 'string' ? data.owner_type : null,
      urgency:           typeof data.urgency === 'string' ? data.urgency : 'unknown',
      source,
      source_url:        typeof data.source_url === 'string' ? data.source_url : null,
      source_listing_id: sourceListing,
      status:            typeof data.status === 'string' ? data.status : 'new',
      assigned_to:       typeof data.assigned_to === 'string' ? data.assigned_to : null,
      next_followup_at:  typeof data.next_followup_at === 'string' ? data.next_followup_at : null,
      notes:             typeof data.notes === 'string' ? data.notes : null,
      tags:              Array.isArray(data.tags) ? data.tags : null,
      raw_data:          data.raw_data ?? null,
      // Contact intelligence fields (migration 016)
      owner_name:           typeof data.owner_name === 'string' ? data.owner_name : null,
      owner_type_detail:    typeof data.owner_type_detail === 'string' ? data.owner_type_detail : null,
      contact_phone_owner:  typeof data.contact_phone_owner === 'string' ? data.contact_phone_owner : null,
      contact_email_owner:  typeof data.contact_email_owner === 'string' ? data.contact_email_owner : null,
      source_network_type:  typeof data.source_network_type === 'string' ? data.source_network_type : null,
      source_network_contact: typeof data.source_network_contact === 'string' ? data.source_network_contact : null,
      // Gate status (migration 015) — default 'accepted_raw' on intake
      gate_status:       typeof data.gate_status === 'string' ? data.gate_status : 'accepted_raw',
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: inserted, error } = await (supabaseAdmin as any).from(TABLE)
      .insert(payload)
      .select()
      .single()

    if (error) throw error

    console.log(`[offmarket-leads POST] Created lead "${payload.nome}" score=${payload.score} city=${payload.cidade}`)
    return NextResponse.json(inserted, { status: 201 })
  } catch (err) {
    console.error('[offmarket-leads POST]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
