// =============================================================================
// Agency Group — Schema Drift Report API
// GET /api/schema/drift-report
//
// Returns the full SchemaDriftReport as JSON.
// Used by Control Tower governance page and CI gates.
//
// Auth: Bearer INTERNAL_API_SECRET or ADMIN_SECRET
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'
import { validateRuntimeSchemaAgainstDB } from '@/lib/schema/schemaRegistry'

export const runtime  = 'nodejs'
export const revalidate = 0

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isBearerAuthorized(req: NextRequest): boolean {
  const auth    = req.headers.get('authorization') ?? ''
  const internal = process.env.INTERNAL_API_SECRET ?? ''
  const admin    = process.env.ADMIN_SECRET         ?? ''

  if (internal && safeCompare(auth, `Bearer ${internal}`)) return true
  if (admin    && safeCompare(auth, `Bearer ${admin}`))    return true

  return false
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isBearerAuthorized(req)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    )
  }

  try {
    const report = await validateRuntimeSchemaAgainstDB()

    return NextResponse.json(report, {
      status: report.clean ? 200 : 200,   // Always 200 — clients inspect report.clean
      headers: {
        'Cache-Control': 'no-store',
        'X-Schema-Clean': report.clean ? 'true' : 'false',
        'X-Tables-With-Drift': String(report.tables_with_drift),
      },
    })
  } catch (err) {
    console.error('[API /schema/drift-report] Unexpected error:', err)
    return NextResponse.json(
      { error: 'Internal server error', detail: String(err) },
      { status: 500 },
    )
  }
}
