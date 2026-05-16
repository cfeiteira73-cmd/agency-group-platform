// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import type { PropertyAnalysis, PropertyIntelligence, DistributionChannel } from '@/lib/property-ai/types'

export interface AudienceProfile {
  primary_persona: string
  secondary_personas: string[]
  budget_affinity: string
  nationality_targets: string[]
  motivations: string[]
  channels_to_reach: DistributionChannel[]
  ad_targeting_keywords: string[]
}

// Portugal buyer data from CLAUDE.md
const BUYERS_MID = ['Portugueses', 'Brasileiros', 'Angolanos', 'Franceses']
const BUYERS_PREMIUM = ['Norte-americanos', 'Franceses', 'Britânicos', 'Chineses', 'Brasileiros', 'Alemães']
const BUYERS_ULTRA = ['Family offices', 'HNWI globais', 'Médio Oriente', 'Asiáticos']

function resolveBudgetAffinity(priceEur: number): string {
  if (priceEur >= 3_000_000) return '€3M+'
  if (priceEur >= 1_000_000) return '€1M–€3M'
  if (priceEur >= 500_000) return '€500K–€1M'
  if (priceEur >= 100_000) return '€100K–€500K'
  return '<€100K'
}

function resolveNationalities(priceEur: number): string[] {
  if (priceEur >= 3_000_000) return BUYERS_ULTRA
  if (priceEur >= 500_000) return BUYERS_PREMIUM
  return BUYERS_MID
}

function resolvePrimaryPersona(priceEur: number, luxuryScore: number): string {
  if (priceEur >= 5_000_000) return 'Family Office / Institutional, Global HNWI, 45–65'
  if (priceEur >= 2_000_000) return 'North American / Middle Eastern HNW, 40–60, lifestyle + investment'
  if (priceEur >= 1_000_000)
    return 'North American Expat, 45–60, HNW — Golden Visa / lifestyle'
  if (priceEur >= 500_000)
    return luxuryScore >= 70
      ? 'European Executive, 35–55, investment + second home'
      : 'Portuguese / Brazilian professional, 35–50, primary residence'
  return 'Portuguese / Brazilian buyer, 28–45, primary residence'
}

function resolveSecondaryPersonas(priceEur: number): string[] {
  if (priceEur >= 3_000_000)
    return [
      'HNWI from Middle East, 40–65, diversification',
      'Asian family office, portfolio expansion',
    ]
  if (priceEur >= 500_000)
    return [
      'French / British retiree, 55–70, lifestyle relocation',
      'Brazilian investor, 35–55, Golden Visa',
      'Chinese investor, 40–60, capital preservation',
    ]
  return [
    'Angolan diaspora, 30–50, returning home',
    'French buyer, 35–55, lifestyle',
  ]
}

function resolveMotivations(priceEur: number, luxuryScore: number): string[] {
  const motivations: string[] = []
  if (priceEur >= 500_000) motivations.push('Golden Visa eligibility')
  if (priceEur >= 500_000 && luxuryScore >= 60) motivations.push('NHR tax regime')
  if (luxuryScore >= 70) motivations.push('Luxury lifestyle')
  motivations.push('Capital appreciation (+17.6% YoY Portugal 2026)')
  if (priceEur >= 500_000) motivations.push('Portfolio diversification')
  motivations.push('Rental income potential')
  return motivations
}

function resolveChannels(priceEur: number): DistributionChannel[] {
  if (priceEur >= 1_000_000)
    return ['homepage', 'email', 'instagram', 'facebook', 'whatsapp', 'kyero', 'crm']
  return ['homepage', 'idealista', 'imovirtual', 'email', 'instagram', 'facebook', 'whatsapp', 'crm']
}

function resolveKeywords(analysis: PropertyAnalysis, priceEur: number): string[] {
  const kw: string[] = []
  const zone = analysis.location?.city ?? analysis.location?.zone ?? 'Portugal'
  kw.push(`luxury real estate ${zone}`)
  kw.push(`property for sale ${zone}`)
  if (priceEur >= 500_000) kw.push('golden visa portugal', 'nhr tax regime')
  if (analysis.has_sea_view) kw.push('sea view property portugal', 'ocean view villa')
  if (analysis.has_pool) kw.push('villa with pool portugal')
  if (analysis.location?.zone_classification === 'ultra-luxury')
    kw.push('ultra luxury villa portugal', 'prime portugal real estate')
  return kw
}

class TargetAudienceAdvisor {
  advise(
    analysis: PropertyAnalysis,
    intelligence: PropertyIntelligence,
    priceEur?: number,
  ): AudienceProfile {
    const effectivePrice = priceEur ?? intelligence.listing_readiness_score * 10_000

    const primary_persona = resolvePrimaryPersona(effectivePrice, analysis.luxury_score)
    const secondary_personas = resolveSecondaryPersonas(effectivePrice)
    const budget_affinity = resolveBudgetAffinity(effectivePrice)
    const nationality_targets = resolveNationalities(effectivePrice)
    const motivations = resolveMotivations(effectivePrice, analysis.luxury_score)
    const channels_to_reach = resolveChannels(effectivePrice)
    const ad_targeting_keywords = resolveKeywords(analysis, effectivePrice)

    logger.info('[TargetAudienceAdvisor] advised', {
      submission_id: analysis.submission_id,
      primary_persona,
    })

    return {
      primary_persona,
      secondary_personas,
      budget_affinity,
      nationality_targets,
      motivations,
      channels_to_reach,
      ad_targeting_keywords,
    }
  }
}

export const targetAudienceAdvisor = new TargetAudienceAdvisor()
