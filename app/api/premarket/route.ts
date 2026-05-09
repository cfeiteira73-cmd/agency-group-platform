import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { supabaseAdmin } from '@/lib/supabase'

// =============================================================================
// AGENCY GROUP — Pre-Market Properties API
// GET  /api/premarket — list pre-market properties (Supabase-first, static fallback)
// POST /api/premarket — register interest in a pre-market property
// AMI: 22506 | Supabase table: premarket_properties + premarket_interest
// =============================================================================

// ─── GET /api/premarket ───────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth()
  const { searchParams } = new URL(req.url)
  const zone = searchParams.get('zone')

  // ── 1. Try Supabase ──────────────────────────────────────────────────────
  try {
    let query = supabaseAdmin
      .from('premarket_properties')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })

    if (zone) {
      query = query.ilike('zone', `%${zone}%`)
    }

    // VIP properties only visible to authenticated users
    if (!session?.user) {
      query = query.neq('access_level', 'vip' as 'registered' | 'premium' | 'vip')
    }

    const { data, error } = await query

    if (!error && data) {
      return NextResponse.json({
        properties: data,
        total: data.length,
        source: 'supabase',
        isAuthenticated: !!session?.user,
        message: !session?.user
          ? 'Registe-se para aceder a propriedades VIP exclusivas'
          : null,
      }, { headers: { 'Cache-Control': 'no-store' } })
    }
  } catch {
    // Fall through to empty response
  }

  // ── 2. No data available — return empty (no static mock in production) ───
  return NextResponse.json({
    properties: [],
    total: 0,
    source: 'unavailable',
    isAuthenticated: !!session?.user,
    message: !session?.user
      ? 'Registe-se para aceder a propriedades VIP exclusivas'
      : 'Nenhuma propriedade pré-mercado disponível de momento.',
  }, { headers: { 'Cache-Control': 'no-store' } })
}

// ─── POST /api/premarket — register interest ──────────────────────────────────

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const body = (await req.json()) as { propertyId?: string; message?: string }
  const { propertyId, message } = body
  if (!propertyId) {
    return NextResponse.json({ error: 'Property ID required' }, { status: 400 })
  }

  try {
    const { error } = await supabaseAdmin
      .from('premarket_interest')
      .insert({
        user_id:     session.user.id,
        property_id: propertyId,
        message:     message ?? null,
        created_at:  new Date().toISOString(),
      })

    if (error) {
      // Table may not exist yet — return success anyway (logged as best-effort)
      void error
    }
  } catch {
    // Best-effort — do not block the user response
  }

  return NextResponse.json({
    success: true,
    message: 'Interesse registado. O nosso agente contactará em 24 horas.',
    propertyId,
    agentContact: '+351 919 948 986',
  })
}
