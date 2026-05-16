// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import type { MediaAsset } from '@/lib/property-ai/types'

export interface SocialCropSpec {
  asset_id: string
  original_url: string
  instagram_square_url: string     // 1:1 crop spec
  instagram_story_url: string      // 9:16 crop spec
  tiktok_url: string               // 9:16 crop spec
  facebook_url: string             // 16:9 crop spec
  whatsapp_thumbnail_url: string   // 1:1 small
  watermark_applied: boolean
  crop_confidence: number          // 0-1
}

// Org watermark config — per-org setting would be fetched from DB in production.
// For now: if orgId is present, assume watermark is enabled.
function hasWatermark(orgId: string): boolean {
  return orgId.length > 0
}

function appendCropParams(url: string, params: Record<string, string | undefined>): string {
  const separator = url.includes('?') ? '&' : '?'
  const query = Object.entries(params)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
  return `${url}${separator}${query}`
}

function buildCropSpec(asset: MediaAsset, orgId: string): SocialCropSpec {
  const url = asset.url
  const watermark = hasWatermark(orgId)

  // Crop confidence: based on aesthetic_score — higher score = more confidence in crop result
  const crop_confidence = Math.min(1, asset.aesthetic_score / 100)

  const watermarkParam = watermark ? { watermark: 'agency-group', wm_pos: 'bottom-right' } : {}

  const instagram_square_url = appendCropParams(url, { crop: '1:1', focus: 'center', ...watermarkParam })
  const instagram_story_url = appendCropParams(url, { crop: '9:16', focus: 'top', ...watermarkParam })
  const tiktok_url = appendCropParams(url, { crop: '9:16', focus: 'center', quality: 'high', ...watermarkParam })
  const facebook_url = appendCropParams(url, { crop: '16:9', focus: 'center', ...watermarkParam })
  const whatsapp_thumbnail_url = appendCropParams(url, { crop: '1:1', focus: 'center', w: '300', h: '300' })

  return {
    asset_id: asset.asset_id,
    original_url: url,
    instagram_square_url,
    instagram_story_url,
    tiktok_url,
    facebook_url,
    whatsapp_thumbnail_url,
    watermark_applied: watermark,
    crop_confidence,
  }
}

const TOP_N_ASSETS = 5

class SocialMediaCropper {
  generateCropSpecs(assets: MediaAsset[], orgId: string): SocialCropSpec[] {
    // Select top 5 assets: cover first, then by sequence_order and aesthetic_score
    const sorted = [...assets]
      .filter((a) => !a.is_blurry && !a.is_duplicate)
      .sort((a, b) => {
        if (a.is_cover && !b.is_cover) return -1
        if (!a.is_cover && b.is_cover) return 1
        if (a.sequence_order !== b.sequence_order) return a.sequence_order - b.sequence_order
        return b.aesthetic_score - a.aesthetic_score
      })
      .slice(0, TOP_N_ASSETS)

    const specs = sorted.map((asset) => buildCropSpec(asset, orgId))

    logger.info('[SocialMediaCropper] generated specs', { count: specs.length, orgId })
    return specs
  }
}

export const socialMediaCropper = new SocialMediaCropper()
