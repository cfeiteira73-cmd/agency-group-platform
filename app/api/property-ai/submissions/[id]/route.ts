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
