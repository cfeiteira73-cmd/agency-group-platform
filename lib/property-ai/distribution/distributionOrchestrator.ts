// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import { supabaseAdmin } from '@/lib/supabase'
import type { DistributionChannel, PropertyAnalysis, GeneratedListing, DistributionResult } from '@/lib/property-ai/types'
import { channelManager } from '@/lib/property-ai/distribution/channelManager'
import { portalAdapter } from '@/lib/property-ai/distribution/portalAdapter'

const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

interface MediaPackage {
  submission_id: string
  cover_image_url: string
  hero_image_url: string
  gallery_sequence: string[]
}

export interface DistributionPlan {
  submission_id: string
  planned_channels: DistributionChannel[]
  results: DistributionResult[]
  success_count: number
  failure_count: number
  published_at: Date
}

const LUXURY_THRESHOLD_EUR = 1_000_000
const AFFORDABLE_THRESHOLD_EUR = 500_000

class DistributionOrchestrator {
  private static instance: DistributionOrchestrator

  private constructor() {}

  static getInstance(): DistributionOrchestrator {
    if (!DistributionOrchestrator.instance) {
      DistributionOrchestrator.instance = new DistributionOrchestrator()
    }
    return DistributionOrchestrator.instance
  }

  private resolveChannels(priceEur?: number): DistributionChannel[] {
    const base: DistributionChannel[] = ['homepage', 'crm', 'email']

    if (!priceEur) return [...base, 'instagram', 'facebook', 'idealista', 'imovirtual']

    if (priceEur >= LUXURY_THRESHOLD_EUR) {
      return [...base, 'instagram', 'facebook', 'kyero', 'idealista', 'whatsapp']
    }

    if (priceEur < AFFORDABLE_THRESHOLD_EUR) {
      return [...base, 'facebook', 'imovirtual', 'idealista', 'tiktok']
    }

    return [...base, 'instagram', 'facebook', 'idealista', 'imovirtual']
  }

  private buildAssetResult(
    submissionId: string,
    channel: DistributionChannel,
    analysis: PropertyAnalysis,
    listing: GeneratedListing,
    media: MediaPackage,
    priceEur?: number
  ): DistributionResult {
    try {
      const title = listing.title?.pt ?? listing.title?.en ?? ''
      const description = listing.description?.pt ?? listing.description?.en ?? ''
      const asset = channelManager.prepareAsset(
        channel,
        submissionId,
        title,
        description,
        media.hero_image_url,
        priceEur
      )

      return {
        distribution_id: crypto.randomUUID(),
        submission_id: submissionId,
        channel,
        status: 'pending',
        asset_url: asset.link_url,
      }
    } catch (err) {
      logger.warn('[DistributionOrchestrator] asset prep failed', { channel, submission_id: submissionId, err })
      return {
        distribution_id: crypto.randomUUID(),
        submission_id: submissionId,
        channel,
        status: 'failed',
        error: String(err),
      }
    }
  }

  private async persistResults(results: DistributionResult[]): Promise<void> {
    try {
      const table = sb.from('property_ai_distribution') as {
        insert: (rows: unknown[]) => Promise<{ error: unknown }>
      }
      const { error } = await table.insert(results)
      if (error) {
        logger.error('[DistributionOrchestrator] persist error', { error })
      }
    } catch (err) {
      logger.error('[DistributionOrchestrator] persist exception', { err })
    }
  }

  async distribute(
    submissionId: string,
    analysis: PropertyAnalysis,
    listing: GeneratedListing,
    mediaPackage: MediaPackage,
    priceEur?: number
  ): Promise<DistributionPlan> {
    const channels = this.resolveChannels(priceEur)

    // Generate channel assets in parallel
    const assetPromises = channels.map((channel) =>
      Promise.resolve(
        this.buildAssetResult(submissionId, channel, analysis, listing, mediaPackage, priceEur)
      )
    )

    // Also adapt portal listings in parallel (non-blocking enrichment)
    const portalAdaptPromise = Promise.resolve(
      portalAdapter.adapt(submissionId, analysis, listing, priceEur ?? 0, mediaPackage.gallery_sequence)
    )

    const [results] = await Promise.all([Promise.all(assetPromises), portalAdaptPromise])

    const successCount = results.filter((r) => r.status === 'pending').length
    const failureCount = results.filter((r) => r.status === 'failed').length

    await this.persistResults(results)

    const plan: DistributionPlan = {
      submission_id: submissionId,
      planned_channels: channels,
      results,
      success_count: successCount,
      failure_count: failureCount,
      published_at: new Date(),
    }

    logger.info('[DistributionOrchestrator] distributed', {
      submission_id: submissionId,
      success_count: successCount,
      failure_count: failureCount,
    })

    return plan
  }
}

export const distributionOrchestrator = DistributionOrchestrator.getInstance()
