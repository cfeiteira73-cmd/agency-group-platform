// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import type { DistributionChannel } from '@/lib/property-ai/types'

export interface ChannelAsset {
  channel: DistributionChannel
  submission_id: string
  title: string
  description: string
  image_url: string
  cta_text: string
  link_url: string
  hashtags?: string[]
  price_display: string
  character_count: number
  ready: boolean
}

export const CHANNEL_LIMITS: Record<DistributionChannel, { title_chars: number; desc_chars: number }> = {
  homepage: { title_chars: 80, desc_chars: 200 },
  crm: { title_chars: 100, desc_chars: 500 },
  email: { title_chars: 60, desc_chars: 300 },
  instagram: { title_chars: 125, desc_chars: 2200 },
  facebook: { title_chars: 100, desc_chars: 500 },
  tiktok: { title_chars: 60, desc_chars: 150 },
  whatsapp: { title_chars: 50, desc_chars: 200 },
  idealista: { title_chars: 70, desc_chars: 4000 },
  imovirtual: { title_chars: 70, desc_chars: 4000 },
  kyero: { title_chars: 70, desc_chars: 3000 },
}

const SOCIAL_CHANNELS: DistributionChannel[] = ['instagram', 'facebook', 'tiktok', 'whatsapp']
const LUXURY_THRESHOLD_EUR = 1_000_000

const BASE_HASHTAGS = ['#realEstate', '#Portugal', '#imoveis', '#agencygroup']
const LUXURY_HASHTAGS = ['#LuxuryLiving', '#LuxuryRealEstate', '#MillionDollarListing', '#PremiumProperty']

const CTA_BY_CHANNEL: Record<DistributionChannel, string> = {
  homepage: 'Ver Imóvel',
  crm: 'Ver Detalhes',
  email: 'Saber Mais',
  instagram: 'Ver Imóvel',
  facebook: 'Saiba Mais',
  tiktok: 'Ver Imóvel',
  whatsapp: 'Ver Imóvel',
  idealista: 'Ver Anúncio',
  imovirtual: 'Ver Anúncio',
  kyero: 'View Property',
}

class ChannelManager {
  private static instance: ChannelManager

  private constructor() {}

  static getInstance(): ChannelManager {
    if (!ChannelManager.instance) {
      ChannelManager.instance = new ChannelManager()
    }
    return ChannelManager.instance
  }

  private truncate(text: string, maxChars: number): string {
    if (text.length <= maxChars) return text
    return text.slice(0, maxChars - 1).trimEnd() + '…'
  }

  private formatPrice(channel: DistributionChannel, priceEur?: number): string {
    if (!priceEur) return 'Price on Request'
    if (channel === 'instagram' && priceEur > LUXURY_THRESHOLD_EUR) return 'Price on Request'
    return `€${priceEur.toLocaleString('pt-PT')}`
  }

  private buildHashtags(channel: DistributionChannel, priceEur?: number): string[] | undefined {
    if (!SOCIAL_CHANNELS.includes(channel)) return undefined
    const tags = [...BASE_HASHTAGS]
    if (priceEur && priceEur > LUXURY_THRESHOLD_EUR) tags.push(...LUXURY_HASHTAGS)
    return tags
  }

  private buildLinkUrl(submissionId: string, channel: DistributionChannel): string {
    const base = 'https://agencygroup.pt/imoveis'
    return `${base}/${submissionId}?utm_source=${channel}&utm_medium=distribution`
  }

  prepareAsset(
    channel: DistributionChannel,
    submissionId: string,
    title: string,
    description: string,
    imageUrl: string,
    priceEur?: number
  ): ChannelAsset {
    const limits = CHANNEL_LIMITS[channel]
    const truncatedTitle = this.truncate(title, limits.title_chars)
    const truncatedDesc = this.truncate(description, limits.desc_chars)
    const priceDisplay = this.formatPrice(channel, priceEur)
    const hashtags = this.buildHashtags(channel, priceEur)
    const hashtagsText = hashtags ? `\n\n${hashtags.join(' ')}` : ''
    const totalChars = truncatedTitle.length + truncatedDesc.length + hashtagsText.length

    const asset: ChannelAsset = {
      channel,
      submission_id: submissionId,
      title: truncatedTitle,
      description: truncatedDesc,
      image_url: imageUrl,
      cta_text: CTA_BY_CHANNEL[channel],
      link_url: this.buildLinkUrl(submissionId, channel),
      hashtags,
      price_display: priceDisplay,
      character_count: totalChars,
      ready: true,
    }

    logger.info('[ChannelManager] prepared', { channel, submission_id: submissionId })

    return asset
  }
}

export const channelManager = ChannelManager.getInstance()
