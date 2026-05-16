// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import { supabaseAdmin } from '@/lib/supabase'
import type { MediaAsset } from '@/lib/property-ai/types'
import { imageScoringEngine } from './imageScoringEngine'
import type { ImageScore } from './imageScoringEngine'
import { coverImageSelector } from './coverImageSelector'

const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

export interface MediaPackage {
  submission_id: string
  cover_image_url: string
  hero_image_url: string
  social_image_url: string
  gallery_sequence: string[]    // ordered URLs
  total_assets: number
  assets_removed: number        // blurry + duplicates removed
  avg_aesthetic_score: number
  media_quality: 'poor' | 'adequate' | 'good' | 'excellent'
  assets: MediaAsset[]
}

function determineMediaQuality(avgScore: number): MediaPackage['media_quality'] {
  if (avgScore >= 80) return 'excellent'
  if (avgScore >= 60) return 'good'
  if (avgScore >= 40) return 'adequate'
  return 'poor'
}

function buildMediaAssets(
  scores: ImageScore[],
  submissionId: string,
  coverImageId: string,
  socialImageId: string,
  heroImageId: string,
  sequenceOrder: string[],
): MediaAsset[] {
  return scores.map((score) => {
    const seqIndex = sequenceOrder.indexOf(score.url)
    return {
      asset_id: score.asset_id,
      submission_id: submissionId,
      type: 'photo' as const,
      url: score.url,
      thumbnail_url: undefined,
      aesthetic_score: score.aesthetic_score,
      is_cover: score.asset_id === coverImageId,
      sequence_order: seqIndex >= 0 ? seqIndex : 999,
      is_blurry: score.is_blurry,
      is_duplicate: score.is_duplicate,
      social_crop_url: score.asset_id === socialImageId ? `${score.url}?crop=9:16&focus=center` : undefined,
      hero_crop_url: score.asset_id === heroImageId ? `${score.url}?crop=16:9&focus=center` : undefined,
      created_at: new Date(),
    }
  })
}

class MediaOrchestrator {
  async process(submissionId: string, imageUrls: string[]): Promise<MediaPackage> {
    // Score all images
    const scores = await imageScoringEngine.scoreImages(imageUrls, submissionId)

    const totalAssets = scores.length
    const removed = scores.filter((s) => s.is_blurry || s.is_duplicate).length

    // Select cover + rank sequence
    const photoSequence = coverImageSelector.selectAndRank(scores)

    const gallery_sequence = photoSequence.sequence.map((s) => s.url)
    const usableScores = scores.filter((s) => !s.is_blurry && !s.is_duplicate)
    const avg_aesthetic_score =
      usableScores.length > 0
        ? Math.round(usableScores.reduce((sum, s) => sum + s.aesthetic_score, 0) / usableScores.length)
        : 0

    const media_quality = determineMediaQuality(avg_aesthetic_score)

    const assets = buildMediaAssets(
      scores,
      submissionId,
      photoSequence.cover_image.asset_id,
      photoSequence.social_image.asset_id,
      photoSequence.hero_image.asset_id,
      gallery_sequence,
    )

    const pkg: MediaPackage = {
      submission_id: submissionId,
      cover_image_url: photoSequence.cover_image.url,
      hero_image_url: photoSequence.hero_image.url,
      social_image_url: photoSequence.social_image.url,
      gallery_sequence,
      total_assets: totalAssets,
      assets_removed: removed,
      avg_aesthetic_score,
      media_quality,
      assets,
    }

    // Persist to Supabase
    try {
      const table = (sb.from('property_ai_media') as {
        upsert: (data: unknown[]) => Promise<{ error: unknown }>
      })
      await table.upsert(
        assets.map((a) => ({
          asset_id: a.asset_id,
          submission_id: a.submission_id,
          type: a.type,
          url: a.url,
          thumbnail_url: a.thumbnail_url ?? null,
          aesthetic_score: a.aesthetic_score,
          is_cover: a.is_cover,
          sequence_order: a.sequence_order,
          is_blurry: a.is_blurry,
          is_duplicate: a.is_duplicate,
          social_crop_url: a.social_crop_url ?? null,
          hero_crop_url: a.hero_crop_url ?? null,
          created_at: a.created_at.toISOString(),
        })),
      )
    } catch (err) {
      logger.error('[MediaOrchestrator] supabase persist failed', {
        submission_id: submissionId,
        err: String(err),
      })
    }

    logger.info('[MediaOrchestrator] complete', {
      submission_id: submissionId,
      total_assets: totalAssets,
      assets_removed: removed,
      media_quality,
    })

    return pkg
  }
}

export const mediaOrchestrator = new MediaOrchestrator()
