// AGENCY GROUP — SH-ROS Property AI | AMI: 22506
// GET /api/property-ai/submissions — list all submissions for the authenticated org
// ?status=live&limit=20&offset=0
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isPortalAuth } from '@/lib/portalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/observability/logger'

export const runtime = 'nodejs'

const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

const VALID_STATUSES = ['ingesting','analyzing','enriching','generating','reviewing','live','archived']
const MAX_LIMIT = 50

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user && !(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const orgId   = searchParams.get('org_id') ?? 'agency-group'
  const status  = searchParams.get('status')
  const limit   = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), MAX_LIMIT)
  const offset  = parseInt(searchParams.get('offset') ?? '0', 10)

  if (status && !VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` }, { status: 400 })
  }

  try {
    // Fetch submissions with joined intelligence scores for ranking
    const subTable = sb.from('property_ai_submissions') as {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          order: (col: string, opts: Record<string, unknown>) => {
            range: (from: number, to: number) => Promise<{ data: Record<string, unknown>[] | null; error: { message: string } | null; count: number | null }>
          }
        }
      }
    }

    // Base query
    let query = subTable
      .select('submission_id, org_id, agent_id, status, input_files, raw_description, raw_url, created_at, updated_at')
      .eq('org_id', orgId)

    // TypeScript limitation with dynamic chaining — use type assertion
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = query
    if (status) {
      q = q.eq('status', status)
    }
    q = q.order('created_at', { ascending: false }).range(offset, offset + limit - 1)

    const { data: submissions, error, count } = await q

    if (error) {
      logger.error('[property-ai/submissions] list error', { orgId, error: error.message })
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Fetch intelligence scores for all returned submissions in parallel
    const submissionIds = (submissions ?? []).map((s: Record<string, unknown>) => s.submission_id as string)

    let intelligenceMap: Record<string, Record<string, unknown>> = {}
    if (submissionIds.length > 0) {
      try {
        const intelTable = sb.from('property_ai_intelligence') as {
          select: (cols: string) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            in: (col: string, vals: string[]) => Promise<{ data: any[] | null; error: unknown }>
          }
        }
        const { data: intelRows } = await intelTable
          .select('submission_id, demand_score, homepage_placement_score, listing_readiness_score, investor_attractiveness')
          .in('submission_id', submissionIds)

        if (intelRows) {
          intelligenceMap = Object.fromEntries(
            intelRows.map((r: Record<string, unknown>) => [r.submission_id, r])
          )
        }
      } catch {
        // non-blocking — intel scores are optional in the list view
      }
    }

    // Merge intelligence into submissions
    const enriched = (submissions ?? []).map((s: Record<string, unknown>) => ({
      ...s,
      intelligence: intelligenceMap[s.submission_id as string] ?? null,
      file_count: Array.isArray(s.input_files) ? (s.input_files as unknown[]).length : 0,
    }))

    logger.info('[property-ai/submissions] listed', { orgId, count: enriched.length, status: status ?? 'all' })

    return NextResponse.json({
      submissions: enriched,
      total:  count ?? enriched.length,
      limit,
      offset,
      has_more: enriched.length === limit,
    })
  } catch (err) {
    logger.error('[property-ai/submissions] exception', { err })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
