// AGENCY GROUP — SH-ROS | AMI: 22506
// lib/autonomous-marketing/index.ts
// Pure TypeScript. No DB. No fetch.
// Controlled autonomy: generates suggestions only — never auto-publishes.
// All campaigns are status: 'pending_approval' and require human sign-off.
// =============================================================================

import { randomUUID } from 'crypto'
import { COMMISSION_RATE } from '@/lib/constants/pipeline'

// ─── Channel & segment types ──────────────────────────────────────────────────

export type MarketingChannelType =
  | 'email'
  | 'whatsapp'
  | 'meta_ad'
  | 'google_ad'
  | 'instagram_story'
  | 'newsletter'
  | 'international_portal'

export type BuyerSegment =
  | 'investors_pt'
  | 'luxury_international'
  | 'families_pt'
  | 'expats_br'
  | 'expats_fr'
  | 'hnwi_global'
  | 'relocating_professionals'

// ─── Campaign suggestion type ─────────────────────────────────────────────────

export interface MarketingCampaignSuggestion {
  campaign_id: string
  listing_id: string
  channel: MarketingChannelType
  target_segment: BuyerSegment
  suggested_headline: string         // max 10 words
  suggested_body: string             // 2–3 sentences, in target language
  suggested_cta: string              // max 5 words
  language: 'pt' | 'en' | 'fr' | 'zh' | 'ar'
  expected_reach: number             // estimated impressions
  expected_inquiries: number         // estimated inquiries
  expected_revenue_impact_eur: number
  confidence: number                 // 0–1
  requires_human_approval: true      // always true — controlled autonomy
  status: 'pending_approval'         // never auto-published
}

// ─── Plan type ────────────────────────────────────────────────────────────────

export interface ListingMarketingPlan {
  listing_id: string
  listing_price_eur: number
  campaigns: MarketingCampaignSuggestion[]
  total_expected_revenue_impact_eur: number
  recommended_channels: MarketingChannelType[]
  relaunch_recommended: boolean
  relaunch_rationale?: string
}

// ─── Listing input type ───────────────────────────────────────────────────────

interface ListingInput {
  id: string
  price_eur: number
  zone: string
  luxury_score: number
  days_on_market: number
  has_sea_view: boolean
  has_pool: boolean
  bedrooms?: number
}

// ─── Copy templates ───────────────────────────────────────────────────────────

function ptFamiliesBody(zone: string, bedrooms?: number): string {
  const rooms = bedrooms ? `${bedrooms} quartos` : 'múltiplos quartos'
  return (
    `Com ${rooms} e localização privilegiada em ${zone}, este imóvel foi concebido para a sua família crescer com conforto e segurança. ` +
    `Acabamentos de qualidade superior e áreas generosas garantem o espaço que sempre procurou. ` +
    `Contacte-nos hoje para agendar visita.`
  )
}

function intlLuxuryBody(zone: string, bedrooms?: number): string {
  const rooms = bedrooms ? `${bedrooms}-bedroom` : 'multi-bedroom'
  return (
    `Exceptional ${rooms} property in ${zone}, offering unparalleled lifestyle and investment potential in one of Portugal's most sought-after locations. ` +
    `Designed for discerning buyers, with premium finishes and world-class amenities. ` +
    `Schedule a private viewing with our international team.`
  )
}

function frLuxuryBody(zone: string, bedrooms?: number): string {
  const rooms = bedrooms ? `${bedrooms} chambres` : 'plusieurs chambres'
  return (
    `Magnifique propriété de ${rooms} à ${zone}, offrant un cadre de vie exceptionnel et un fort potentiel d'investissement sur la côte portugaise. ` +
    `Prestations haut de gamme et architecture soignée pour les acquéreurs les plus exigeants. ` +
    `Contactez notre équipe internationale pour une visite privée.`
  )
}

function investorEmailBody(zone: string, price_eur: number): string {
  const priceLabel = price_eur >= 1_000_000
    ? `€${(price_eur / 1_000_000).toFixed(1)}M`
    : `€${Math.round(price_eur / 1_000)}K`
  return (
    `Imóvel em ${zone} disponível a ${priceLabel}, com yield bruto estimado de 5,5% em mercado em crescimento (+17,6% YoY). ` +
    `Este ativo apresenta oportunidade de valorização com procura de compradores internacionais em expansão. ` +
    `Solicite o dossier de investimento completo hoje.`
  )
}

function newsletterBody(zone: string, bedrooms?: number): string {
  const rooms = bedrooms ? `${bedrooms} quartos` : 'espaçoso'
  return (
    `Novo imóvel disponível em ${zone} — ${rooms}, perfeito para quem procura conforto e qualidade de vida. ` +
    `Integrado numa zona de elevada procura, este imóvel representa uma oportunidade única no mercado actual. ` +
    `Veja todos os detalhes e agende a sua visita.`
  )
}

// ─── Revenue impact estimator ─────────────────────────────────────────────────

function estimateRevenueImpact(
  price_eur: number,
  channel: MarketingChannelType,
  confidence: number,
): number {
  // Expected commission: 5% of sale price, discounted by channel conversion rate + confidence
  const commission = price_eur * COMMISSION_RATE
  const channelConversionRate: Record<MarketingChannelType, number> = {
    email: 0.04,
    whatsapp: 0.06,
    meta_ad: 0.02,
    google_ad: 0.025,
    instagram_story: 0.015,
    newsletter: 0.03,
    international_portal: 0.05,
  }
  return Math.round(commission * (channelConversionRate[channel] ?? 0.03) * confidence)
}

// ─── generateCampaignSuggestions ──────────────────────────────────────────────

export function generateCampaignSuggestions(
  listing: ListingInput,
): MarketingCampaignSuggestion[] {
  const { id, price_eur, zone, luxury_score, days_on_market, has_sea_view, has_pool, bedrooms } = listing
  const suggestions: MarketingCampaignSuggestion[] = []

  // ── Always: newsletter for families PT ──────────────────────────────────────
  suggestions.push({
    campaign_id: randomUUID(),
    listing_id: id,
    channel: 'newsletter',
    target_segment: 'families_pt',
    suggested_headline: 'Imóvel perfeito para a sua família',
    suggested_body: newsletterBody(zone, bedrooms),
    suggested_cta: 'Ver detalhes agora',
    language: 'pt',
    expected_reach: 4_200,
    expected_inquiries: 8,
    expected_revenue_impact_eur: estimateRevenueImpact(price_eur, 'newsletter', 0.55),
    confidence: 0.55,
    requires_human_approval: true,
    status: 'pending_approval',
  })

  // ── Luxury score > 70: international portal + Instagram story ───────────────
  if (luxury_score > 70) {
    suggestions.push({
      campaign_id: randomUUID(),
      listing_id: id,
      channel: 'international_portal',
      target_segment: 'luxury_international',
      suggested_headline: `Luxury property in ${zone}`,
      suggested_body: intlLuxuryBody(zone, bedrooms),
      suggested_cta: 'Book private viewing',
      language: 'en',
      expected_reach: 18_000,
      expected_inquiries: 14,
      expected_revenue_impact_eur: estimateRevenueImpact(price_eur, 'international_portal', 0.72),
      confidence: 0.72,
      requires_human_approval: true,
      status: 'pending_approval',
    })

    suggestions.push({
      campaign_id: randomUUID(),
      listing_id: id,
      channel: 'instagram_story',
      target_segment: 'luxury_international',
      suggested_headline: `Exclusive listing — ${zone}`,
      suggested_body: `Prime luxury property in ${zone}. Enquire now for a private tour of this exceptional residence.`,
      suggested_cta: 'Enquire now',
      language: 'en',
      expected_reach: 22_000,
      expected_inquiries: 6,
      expected_revenue_impact_eur: estimateRevenueImpact(price_eur, 'instagram_story', 0.5),
      confidence: 0.5,
      requires_human_approval: true,
      status: 'pending_approval',
    })
  }

  // ── Sea view or pool: Meta ad for French expats ──────────────────────────────
  if (has_sea_view || has_pool) {
    suggestions.push({
      campaign_id: randomUUID(),
      listing_id: id,
      channel: 'meta_ad',
      target_segment: 'expats_fr',
      suggested_headline: `Propriété de luxe à ${zone}`,
      suggested_body: frLuxuryBody(zone, bedrooms),
      suggested_cta: 'Demander une visite',
      language: 'fr',
      expected_reach: 31_000,
      expected_inquiries: 11,
      expected_revenue_impact_eur: estimateRevenueImpact(price_eur, 'meta_ad', 0.6),
      confidence: 0.6,
      requires_human_approval: true,
      status: 'pending_approval',
    })
  }

  // ── Price > €800K: WhatsApp for HNWI ────────────────────────────────────────
  if (price_eur > 800_000) {
    const priceLabel = price_eur >= 1_000_000
      ? `€${(price_eur / 1_000_000).toFixed(1)}M`
      : `€${Math.round(price_eur / 1_000)}K`
    suggestions.push({
      campaign_id: randomUUID(),
      listing_id: id,
      channel: 'whatsapp',
      target_segment: 'hnwi_global',
      suggested_headline: `Exclusive ${zone} property — ${priceLabel}`,
      suggested_body: `We have identified a rare ${bedrooms ? `${bedrooms}-bedroom ` : ''}property in ${zone} at ${priceLabel} that matches your investment profile. This is an off-market opportunity with exceptional return potential. Our senior advisor is available for a private briefing.`,
      suggested_cta: 'Schedule briefing',
      language: 'en',
      expected_reach: 120,
      expected_inquiries: 9,
      expected_revenue_impact_eur: estimateRevenueImpact(price_eur, 'whatsapp', 0.68),
      confidence: 0.68,
      requires_human_approval: true,
      status: 'pending_approval',
    })
  }

  // ── Stale listing (DOM > 90): email relaunch for investors PT ────────────────
  if (days_on_market > 90) {
    suggestions.push({
      campaign_id: randomUUID(),
      listing_id: id,
      channel: 'email',
      target_segment: 'investors_pt',
      suggested_headline: 'Oportunidade de investimento em destaque',
      suggested_body: investorEmailBody(zone, price_eur),
      suggested_cta: 'Solicitar dossier',
      language: 'pt',
      expected_reach: 2_800,
      expected_inquiries: 5,
      expected_revenue_impact_eur: estimateRevenueImpact(price_eur, 'email', 0.45),
      confidence: 0.45,
      requires_human_approval: true,
      status: 'pending_approval',
    })
  }

  return suggestions
}

// ─── buildMarketingPlan ───────────────────────────────────────────────────────

export function buildMarketingPlan(listing: ListingInput): ListingMarketingPlan {
  const campaigns = generateCampaignSuggestions(listing)

  const total_expected_revenue_impact_eur = campaigns.reduce(
    (sum, c) => sum + c.expected_revenue_impact_eur,
    0,
  )

  // Deduplicate recommended channels, ordered by expected impact descending
  const channelByImpact = [...campaigns].sort(
    (a, b) => b.expected_revenue_impact_eur - a.expected_revenue_impact_eur,
  )
  const seen = new Set<MarketingChannelType>()
  const recommended_channels: MarketingChannelType[] = []
  for (const c of channelByImpact) {
    if (!seen.has(c.channel)) {
      seen.add(c.channel)
      recommended_channels.push(c.channel)
    }
  }

  const relaunch_recommended = listing.days_on_market > 90
  const relaunch_rationale = relaunch_recommended
    ? `Imóvel há ${listing.days_on_market} dias no mercado sem fecho — relançamento com novas campanhas e possível revisão de preço recomendado.`
    : undefined

  return {
    listing_id: listing.id,
    listing_price_eur: listing.price_eur,
    campaigns,
    total_expected_revenue_impact_eur,
    recommended_channels,
    relaunch_recommended,
    ...(relaunch_rationale !== undefined ? { relaunch_rationale } : {}),
  }
}

// ─── identifyUnderperformingListings ─────────────────────────────────────────

export function identifyUnderperformingListings(
  listings: Array<{
    id: string
    demand_score: number
    days_on_market: number
    inquiry_count: number
    price_eur: number
  }>,
): Array<{ id: string; issue: string; suggested_action: string }> {
  const results: Array<{ id: string; issue: string; suggested_action: string }> = []

  for (const listing of listings) {
    const { id, demand_score, days_on_market, inquiry_count } = listing

    if (demand_score < 30) {
      results.push({
        id,
        issue: 'Procura baixa',
        suggested_action: 'Campanha de reativação',
      })
      continue // avoid duplicate entries
    }

    if (days_on_market > 120 && inquiry_count < 2) {
      results.push({
        id,
        issue: 'Imóvel estagnado',
        suggested_action: 'Relançamento com novas fotografias',
      })
      continue
    }

    if (days_on_market > 60 && inquiry_count === 0) {
      results.push({
        id,
        issue: 'Sem inquéritos',
        suggested_action: 'Distribuição internacional urgente',
      })
    }
  }

  return results
}

// ─── Namespace export ─────────────────────────────────────────────────────────

export const autonomousMarketing = {
  generateCampaignSuggestions,
  buildMarketingPlan,
  identifyUnderperformingListings,
}
