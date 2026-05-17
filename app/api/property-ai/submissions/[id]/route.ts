// AGENCY GROUP — SH-ROS Property AI | AMI: 22506
// GET /api/property-ai/submissions/[id] — poll pipeline status + results
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isPortalAuth } from '@/lib/portalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/observability/logger'

export const runtime = 'nodejs'

const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  // Auth
  const session = await auth()
  if (!session?.user && !(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: submissionId } = await params

  if (!submissionId || typeof submissionId !== 'string') {
    return NextResponse.json({ error: 'Missing submission_id' }, { status: 400 })
  }

  try {
    // Fetch submission record
    const subTable = sb.from('property_ai_submissions') as {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>
        }
      }
    }
    const { data: submission, error: subErr } = await subTable
      .select('submission_id, status, org_id, created_at, updated_at')
      .eq('submission_id', submissionId)
      .single()

    if (subErr || !submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    const status = submission.status as string

    // If still processing, return early with status only
    if (status === 'ingesting' || status === 'analyzing' || status === 'enriching' || status === 'generating') {
      return NextResponse.json({
        submission_id: submissionId,
        status,
        ready: false,
      })
    }

    // Fetch all downstream records in parallel
    const [analysis, listing, intelligence, copilot, distribution] = await Promise.allSettled([
      fetchAnalysis(submissionId),
      fetchListing(submissionId),
      fetchIntelligence(submissionId),
      fetchCopilot(submissionId),
      fetchDistribution(submissionId),
    ])

    logger.info('[property-ai/submissions] fetched', { submissionId, status })

    return NextResponse.json({
      submission_id: submissionId,
      status,
      ready: status === 'live' || status === 'reviewing',
      data: {
        analysis:     analysis.status === 'fulfilled' ? analysis.value : null,
        listing:      listing.status === 'fulfilled' ? listing.value : null,
        intelligence: intelligence.status === 'fulfilled' ? intelligence.value : null,
        copilot:      copilot.status === 'fulfilled' ? copilot.value : null,
        distribution: distribution.status === 'fulfilled' ? distribution.value : null,
      },
      created_at:  submission.created_at,
      updated_at:  submission.updated_at,
    })
  } catch (err) {
    logger.error('[property-ai/submissions] fetch error', { submissionId, err })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// Helpers — individual table fetches
// ---------------------------------------------------------------------------

async function fetchAnalysis(submissionId: string): Promise<Record<string, unknown> | null> {
  const table = sb.from('property_ai_analysis') as {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>
      }
    }
  }
  const { data } = await table
    .select('analysis_id, bedrooms, bathrooms, area_sqm, condition, energy_class, luxury_score, confidence, location, analyzed_at')
    .eq('submission_id', submissionId)
    .single()
  return data
}

async function fetchListing(submissionId: string): Promise<Record<string, unknown> | null> {
  const table = sb.from('property_ai_listings') as {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>
      }
    }
  }
  const { data } = await table
    .select('listing_id, titles, descriptions, meta_descriptions, seo_keywords, estimated_price_eur, confidence, generated_at')
    .eq('submission_id', submissionId)
    .single()
  return data
}

async function fetchIntelligence(submissionId: string): Promise<Record<string, unknown> | null> {
  const table = sb.from('property_ai_intelligence') as {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>
      }
    }
  }
  const { data } = await table
    .select('intel_id, demand_score, conversion_probability, investor_attractiveness, homepage_placement_score, listing_readiness_score, computed_at')
    .eq('submission_id', submissionId)
    .single()
  return data
}

async function fetchCopilot(submissionId: string): Promise<Record<string, unknown> | null> {
  const table = sb.from('property_ai_copilot') as {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        single: () => Promise<{ data: Record<string, unknown> | null; error: unknown }>
      }
    }
  }
  const { data } = await table
    .select('readiness_report, pricing_advice, audience_profile, ai_summary, action_items, generated_at')
    .eq('submission_id', submissionId)
    .single()
  return data
}

async function fetchDistribution(submissionId: string): Promise<Record<string, unknown>[] | null> {
  const table = sb.from('property_ai_distribution') as {
    select: (cols: string) => {
      eq: (col: string, val: string) => Promise<{ data: Record<string, unknown>[] | null; error: unknown }>
    }
  }
  const { data } = await table
    .select('channel, status, asset_url, sent_at, error')
    .eq('submission_id', submissionId)
  return data
}

// ---------------------------------------------------------------------------
// PATCH /api/property-ai/submissions/[id] — update listing/analysis/status
// ---------------------------------------------------------------------------

export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  // Auth
  const session = await auth()
  if (!session?.user && !(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id: submissionId } = await params
  if (!submissionId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await req.json() as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const updates: { table: string; patch: Record<string, unknown> }[] = []

  // ── Listing update ──────────────────────────────────────────────────────────
  if (body.listing && typeof body.listing === 'object') {
    const l = body.listing as Record<string, unknown>
    const listingPatch: Record<string, unknown> = {}
    if (l.titles          !== undefined) listingPatch.titles           = l.titles
    if (l.descriptions    !== undefined) listingPatch.descriptions     = l.descriptions
    if (l.meta_descriptions !== undefined) listingPatch.meta_descriptions = l.meta_descriptions
    if (l.seo_keywords    !== undefined) listingPatch.seo_keywords     = l.seo_keywords
    if (l.estimated_price_eur !== undefined) listingPatch.estimated_price_eur = Number(l.estimated_price_eur)
    if (Object.keys(listingPatch).length > 0) {
      updates.push({ table: 'property_ai_listings', patch: listingPatch })
    }
  }

  // ── Analysis update ─────────────────────────────────────────────────────────
  if (body.analysis && typeof body.analysis === 'object') {
    const a = body.analysis as Record<string, unknown>
    const analysisPatch: Record<string, unknown> = {}
    if (a.bedrooms    !== undefined) analysisPatch.bedrooms    = a.bedrooms    !== '' ? Number(a.bedrooms)    : null
    if (a.bathrooms   !== undefined) analysisPatch.bathrooms   = a.bathrooms   !== '' ? Number(a.bathrooms)   : null
    if (a.area_sqm    !== undefined) analysisPatch.area_sqm    = a.area_sqm    !== '' ? Number(a.area_sqm)    : null
    if (a.condition   !== undefined) analysisPatch.condition   = a.condition
    if (a.luxury_score!== undefined) analysisPatch.luxury_score= a.luxury_score!== '' ? Number(a.luxury_score): null
    if (a.location    !== undefined) analysisPatch.location    = a.location
    if (Object.keys(analysisPatch).length > 0) {
      updates.push({ table: 'property_ai_analysis', patch: analysisPatch })
    }
  }

  // ── Status update ────────────────────────────────────────────────────────────
  if (body.status && typeof body.status === 'string') {
    const allowed = ['ingesting','analyzing','enriching','generating','reviewing','live','archived']
    if (allowed.includes(body.status)) {
      updates.push({ table: 'property_ai_submissions', patch: { status: body.status, updated_at: new Date().toISOString() } })
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  try {
    await Promise.all(updates.map(async ({ table, patch }) => {
      const t = sb.from(table) as {
        update: (data: Record<string, unknown>) => {
          eq: (col: string, val: string) => Promise<{ error: { message: string } | null }>
        }
      }
      const { error } = await t.update(patch).eq('submission_id', submissionId)
      if (error) throw new Error(`${table}: ${error.message}`)
    }))

    logger.info('[property-ai/submissions] patched', { submissionId, tables: updates.map(u => u.table) })
    return NextResponse.json({ success: true, submission_id: submissionId })
  } catch (err) {
    logger.error('[property-ai/submissions] patch error', { submissionId, err })
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Update failed' }, { status: 500 })
  }
}
