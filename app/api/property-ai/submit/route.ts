// AGENCY GROUP — SH-ROS Property AI | AMI: 22506
// POST /api/property-ai/submit — full autonomous property ingestion pipeline
// Pipeline: Ingest → Generate Listing → Score Media → Intelligence → Copilot → Distribute
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { isPortalAuth } from '@/lib/portalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/observability/logger'
import { getRequestCorrelationId } from '@/lib/observability/correlation'
import { z } from 'zod'
import { mediaIngestionOrchestrator } from '@/lib/property-ai/ingestion'
import { listingOrchestrator } from '@/lib/property-ai/listing-generator'
import { mediaOrchestrator } from '@/lib/property-ai/media'
import { propertyIntelligenceEngine } from '@/lib/property-ai/intelligence'
import { copilotOrchestrator } from '@/lib/property-ai/copilot'
import { distributionOrchestrator } from '@/lib/property-ai/distribution'
import type { PropertySubmission, InputFile } from '@/lib/property-ai/types'

export const runtime = 'nodejs'
export const maxDuration = 60 // seconds

// ---------------------------------------------------------------------------
// n8n live webhook — fire-and-forget, never blocks the pipeline
// ---------------------------------------------------------------------------

function triggerN8nLiveWebhook(payload: {
  submission_id: string
  org_id: string
  listing_id: string
  readiness_score: number
  channels: string[]
  optimal_price?: number
}): void {
  const webhookUrl = process.env.N8N_WEBHOOK_PROPERTY_LIVE
  if (!webhookUrl) return
  fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, event: 'property_live', fired_at: new Date().toISOString() }),
    signal: AbortSignal.timeout(5_000),
  }).catch((err) => {
    logger.warn('[property-ai/submit] n8n webhook error', { submission_id: payload.submission_id, err })
  })
}

// ---------------------------------------------------------------------------
// Zod validation
// ---------------------------------------------------------------------------

const InputFileSchema = z.object({
  file_id:    z.string(),
  type:       z.enum(['photo', 'video', 'pdf', 'audio', 'text', 'url', 'drone']),
  url:        z.string().url(),
  mime_type:  z.string().optional(),
  size_bytes: z.number().optional(),
  name:       z.string().optional(),
})

const SubmitSchema = z.object({
  submission_id:   z.string().optional(),
  org_id:          z.string().min(1),
  agent_id:        z.string().min(1),
  input_files:     z.array(InputFileSchema).default([]),
  raw_description: z.string().max(5000).optional(),
  raw_url:         z.string().optional(),
  price_eur:       z.number().positive().optional(),
})

// ---------------------------------------------------------------------------
// Supabase helpers
// ---------------------------------------------------------------------------

const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

async function persistSubmission(sub: PropertySubmission): Promise<void> {
  try {
    const table = sb.from('property_ai_submissions') as {
      upsert: (d: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
    }
    const { error } = await table.upsert({
      submission_id:   sub.submission_id,
      org_id:          sub.org_id,
      agent_id:        sub.agent_id,
      status:          sub.status,
      input_files:     sub.input_files,
      raw_description: sub.raw_description ?? null,
      raw_url:         sub.raw_url ?? null,
      created_at:      sub.created_at.toISOString(),
      updated_at:      sub.updated_at.toISOString(),
    })
    if (error) {
      logger.warn('[property-ai/submit] submission persist error', { error: error.message })
    }
  } catch (err) {
    logger.warn('[property-ai/submit] submission persist exception', { err })
  }
}

async function updateStatus(submissionId: string, status: string): Promise<void> {
  try {
    const table = sb.from('property_ai_submissions') as {
      update: (d: Record<string, unknown>) => { eq: (col: string, val: string) => Promise<{ error: unknown }> }
    }
    await table.update({ status, updated_at: new Date().toISOString() }).eq('submission_id', submissionId)
  } catch {
    // non-blocking
  }
}

// ---------------------------------------------------------------------------
// POST /api/property-ai/submit
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  const correlationId = getRequestCorrelationId(req)
  const start = Date.now()

  // Auth
  const session = await auth()
  if (!session?.user && !(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Parse + validate
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = SubmitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    )
  }

  const d = parsed.data
  const now = new Date()
  const submission_id = d.submission_id ?? crypto.randomUUID()

  // Build properly-typed PropertySubmission
  const submission: PropertySubmission = {
    submission_id,
    org_id:          d.org_id,
    agent_id:        d.agent_id,
    status:          'ingesting',
    input_files:     d.input_files.map((f) => ({
      file_id:    f.file_id,
      type:       f.type,
      url:        f.url,
      filename:   f.name ?? f.file_id,
      size_bytes: f.size_bytes ?? 0,
      uploaded_at: now,
    } as InputFile)),
    raw_description: d.raw_description,
    raw_url:         d.raw_url,
    created_at:      now,
    updated_at:      now,
  }

  logger.info('[property-ai/submit] pipeline start', {
    submission_id,
    org_id:     d.org_id,
    file_count: d.input_files.length,
    has_text:   Boolean(d.raw_description),
    has_url:    Boolean(d.raw_url),
    correlationId,
  })

  // Persist submission immediately (status = ingesting)
  await persistSubmission(submission)

  try {
    // ── STEP 1: Media Ingestion (vision + OCR + voice + geo) ───────────────
    await updateStatus(submission_id, 'analyzing')
    const ingestionResult = await mediaIngestionOrchestrator.orchestrate(submission)

    // ── STEP 2: Generate Multilingual Listing ──────────────────────────────
    await updateStatus(submission_id, 'generating')
    const listing = await listingOrchestrator.generate(
      ingestionResult.analysis,
      d.price_eur,
    )

    // ── STEP 3: Score + Rank Media ─────────────────────────────────────────
    await updateStatus(submission_id, 'enriching')
    const photoUrls = submission.input_files
      .filter((f) => f.type === 'photo' || f.type === 'drone')
      .map((f) => f.url)

    const mediaPackage = await mediaOrchestrator.process(submission_id, photoUrls)

    // ── STEP 4: Intelligence Scores ────────────────────────────────────────
    const intelligence = await propertyIntelligenceEngine.compute(
      ingestionResult.analysis,
      d.price_eur,
      mediaPackage.media_quality,
    )

    // ── STEP 5: Copilot Recommendations ───────────────────────────────────
    const copilot = await copilotOrchestrator.generate(
      ingestionResult.analysis,
      intelligence,
      d.price_eur,
    )

    // ── STEP 6: Distribute to Channels ────────────────────────────────────
    await updateStatus(submission_id, 'reviewing')
    const distributionPlan = await distributionOrchestrator.distribute(
      submission_id,
      ingestionResult.analysis,
      listing,
      {
        submission_id,
        cover_image_url:  mediaPackage.cover_image_url,
        hero_image_url:   mediaPackage.hero_image_url,
        gallery_sequence: mediaPackage.gallery_sequence,
      },
      d.price_eur,
    )

    await updateStatus(submission_id, 'live')

    // Fire n8n webhook (non-blocking — never delays response)
    triggerN8nLiveWebhook({
      submission_id,
      org_id:          d.org_id,
      listing_id:      listing.listing_id,
      readiness_score: copilot.readiness.listing_readiness_score,
      channels:        distributionPlan.planned_channels,
      optimal_price:   copilot.pricing.recommended_price_eur,
    })

    const elapsed = Date.now() - start

    logger.info('[property-ai/submit] pipeline complete', {
      submission_id,
      elapsed_ms:       elapsed,
      confidence:       ingestionResult.confidence,
      missing_info_ct:  ingestionResult.missing_info.length,
      listing_id:       listing.listing_id,
      media_total:      mediaPackage.total_assets,
      readiness_score:  copilot.readiness.listing_readiness_score,
      channels:         distributionPlan.planned_channels.length,
      correlationId,
    })

    return NextResponse.json({
      submission_id,
      status: 'live',
      pipeline: {
        ingestion: {
          confidence:   ingestionResult.confidence,
          missing_info: ingestionResult.missing_info,
          analysis:     ingestionResult.analysis,
        },
        listing: {
          listing_id:  listing.listing_id,
          title:       listing.title,
          confidence:  listing.confidence,
        },
        media: {
          total:    mediaPackage.total_assets,
          removed:  mediaPackage.assets_removed,
          quality:  mediaPackage.media_quality,
          cover:    mediaPackage.cover_image_url,
          gallery:  mediaPackage.gallery_sequence.slice(0, 5),
        },
        intelligence: {
          demand_score:            intelligence.demand_score,
          listing_readiness:       intelligence.listing_readiness_score,
          homepage_placement:      intelligence.homepage_placement_score,
          investor_attractiveness: intelligence.investor_attractiveness,
          pricing_competitiveness: intelligence.pricing_competitiveness,
        },
        copilot: {
          readiness_score:  copilot.readiness.listing_readiness_score,
          ready_to_publish: copilot.readiness.ready_to_publish,
          grade:            copilot.readiness.grade,
          action_items:     copilot.action_items.slice(0, 5),
          ai_summary:       copilot.ai_summary,
          optimal_price:    copilot.pricing.recommended_price_eur,
          publish_day:      copilot.publishing.target_day,
          publish_hour:     copilot.publishing.target_hour,
          audience:         copilot.audience.nationality_targets.slice(0, 3),
        },
        distribution: {
          channels:      distributionPlan.planned_channels,
          success_count: distributionPlan.success_count,
          failure_count: distributionPlan.failure_count,
        },
      },
      processing_time_ms: elapsed,
    })
  } catch (err) {
    const elapsed = Date.now() - start
    logger.error('[property-ai/submit] pipeline error', {
      submission_id,
      elapsed_ms: elapsed,
      err,
      correlationId,
    })
    return NextResponse.json(
      {
        error:        'Pipeline failed',
        submission_id,
        message:      err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 },
    )
  }
}
