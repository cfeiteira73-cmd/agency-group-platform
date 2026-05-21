// app/api/dashboard/health-map/route.ts
// Returns portal system health map
// GET  = latest cached map for the tenant
// POST = trigger fresh scan (may take up to 60s)
// Auth: requirePortalAuth — session or service token required
// runtime = 'nodejs', maxDuration = 60

export const runtime    = 'nodejs'
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import {
  generateSystemHealthMap,
  type SystemHealthMap,
} from '@/lib/dashboard/systemHealthMap'

// ---------------------------------------------------------------------------
// Canonical tenant helper
// ---------------------------------------------------------------------------

function getCanonicalTenantId(): string {
  return (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    '00000000-0000-0000-0000-000000000001'
  )
}

// ---------------------------------------------------------------------------
// GET /api/dashboard/health-map — returns latest cached health map
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  const tenantId = getCanonicalTenantId()
  const db       = supabaseAdmin as any

  try {
    const { data, error } = await db
      .from('portal_health_maps')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('generated_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !data) {
      return NextResponse.json(
        { error: 'No health map found. POST to /api/dashboard/health-map to generate one.' },
        { status: 404 }
      )
    }

    const map: SystemHealthMap = {
      map_id:           data.id as string,
      tenant_id:        data.tenant_id as string,
      portal_sections:  data.portal_sections as SystemHealthMap['portal_sections'],
      api_coverage:     data.api_coverage as SystemHealthMap['api_coverage'],
      data_consistency: data.data_consistency as SystemHealthMap['data_consistency'],
      issues:           data.issues as SystemHealthMap['issues'],
      summary:          data.summary as SystemHealthMap['summary'],
      generated_at:     data.generated_at as string,
    }

    return NextResponse.json(map, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to fetch health map', detail: message },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/dashboard/health-map — triggers a fresh system health scan
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  const tenantId = getCanonicalTenantId()

  try {
    const map = await generateSystemHealthMap(tenantId)

    return NextResponse.json(map, {
      status: 201,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Health scan failed', detail: message },
      { status: 500 }
    )
  }
}
