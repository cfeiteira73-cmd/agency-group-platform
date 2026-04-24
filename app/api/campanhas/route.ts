// =============================================================================
// Agency Group — Campanhas CRUD API
// GET    /api/campanhas           — list campaigns (with filters)
// POST   /api/campanhas           — create a campaign
// PATCH  /api/campanhas           — update a campaign (body must include id)
// =============================================================================
// Replaces hardcoded mock campaigns in crmStore with real Supabase persistence.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { portalAuthGate } from '@/lib/requirePortalAuth'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignRow {
  id: string
  name: string
  type: string
  status: string
  subject: string | null
  html: string | null
  recipient_list: string[]
  recipient_count: number
  sent_count: number
  delivered_count: number
  opened_count: number
  clicked_count: number
  scheduled_at: string | null
  sent_at: string | null
  created_by: string
  created_at: string
  updated_at: string
  metadata: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// Ensure campanhas table exists (idempotent DDL check — remove after migration)
// ---------------------------------------------------------------------------

// GET /api/campanhas
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const gate = await portalAuthGate(req)
  if (!gate.authed) return gate.response

  const url    = new URL(req.url)
  const status = url.searchParams.get('status')
  const type   = url.searchParams.get('type')
  const limit  = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200)
  const offset = parseInt(url.searchParams.get('offset') ?? '0', 10)

  let query = supabase
    .from('campanhas')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)
  if (type)   query = query.eq('type', type)

  const { data, count, error } = await query

  if (error) {
    // Table might not exist yet — return empty list gracefully
    if (error.code === '42P01') {
      return NextResponse.json({ campanhas: [], total: 0, limit, offset })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    campanhas: data ?? [],
    total:     count ?? 0,
    limit,
    offset,
  })
}

// ---------------------------------------------------------------------------
// POST /api/campanhas — create campaign
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const gate = await portalAuthGate(req)
  if (!gate.authed) return gate.response

  let body: Partial<CampaignRow>
  try {
    body = await req.json() as Partial<CampaignRow>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'Campo "name" é obrigatório' }, { status: 400 })
  }
  if (!body.type || typeof body.type !== 'string') {
    return NextResponse.json({ error: 'Campo "type" é obrigatório (email|whatsapp|sms|push)' }, { status: 400 })
  }

  const recipients = Array.isArray(body.recipient_list) ? body.recipient_list : []

  const { data, error } = await supabase
    .from('campanhas')
    .insert({
      name:           body.name,
      type:           body.type,
      status:         body.status ?? 'draft',
      subject:        body.subject ?? null,
      html:           body.html ?? null,
      recipient_list: recipients,
      recipient_count: recipients.length,
      sent_count:      0,
      delivered_count: 0,
      opened_count:    0,
      clicked_count:   0,
      scheduled_at:   body.scheduled_at ?? null,
      sent_at:        null,
      created_by:     gate.email,
      metadata:       body.metadata ?? {},
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, campanha: data }, { status: 201 })
}

// ---------------------------------------------------------------------------
// PATCH /api/campanhas — update campaign (id in body)
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const gate = await portalAuthGate(req)
  if (!gate.authed) return gate.response

  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.id || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Campo "id" é obrigatório no body para PATCH' }, { status: 400 })
  }

  // Allowlist of updatable fields
  const ALLOWED = [
    'name', 'type', 'status', 'subject', 'html',
    'recipient_list', 'sent_count', 'delivered_count',
    'opened_count', 'clicked_count', 'scheduled_at', 'sent_at', 'metadata',
  ] as const

  const updates: Record<string, unknown> = {}
  for (const key of ALLOWED) {
    if (key in body) updates[key] = body[key]
  }

  // Keep recipient_count in sync
  if (Array.isArray(updates.recipient_list)) {
    updates.recipient_count = (updates.recipient_list as string[]).length
  }

  // Auto-set sent_at when status → 'sent'
  if (updates.status === 'sent' && !updates.sent_at) {
    updates.sent_at = new Date().toISOString()
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('campanhas')
    .update(updates)
    .eq('id', body.id as string)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, campanha: data })
}
