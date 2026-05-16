// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import type { PropertyAnalysis, GeneratedListing } from '@/lib/property-ai/types'

export interface PortalListing {
  portal: 'idealista' | 'imovirtual' | 'kyero'
  submission_id: string
  external_reference: string
  title_pt: string
  title_en: string
  description_pt: string
  description_en: string
  price_eur: number
  area_sqm?: number
  bedrooms?: number
  bathrooms?: number
  energy_class: string
  image_urls: string[]
  location: {
    city?: string
    neighborhood?: string
    latitude?: number
    longitude?: number
  }
  features: string[]
  status: 'draft' | 'ready_to_publish' | 'published'
  portal_specific_fields: Record<string, unknown>
}

class PortalAdapter {
  private static instance: PortalAdapter

  private constructor() {}

  static getInstance(): PortalAdapter {
    if (!PortalAdapter.instance) {
      PortalAdapter.instance = new PortalAdapter()
    }
    return PortalAdapter.instance
  }

  private buildFeatures(analysis: PropertyAnalysis): string[] {
    const features: string[] = []
    if (analysis.has_pool) features.push('Piscina')
    if (analysis.has_garden) features.push('Jardim')
    if (analysis.has_parking) features.push('Garagem')
    if (analysis.has_elevator) features.push('Elevador')
    if (analysis.has_sea_view) features.push('Vista Mar')
    if (analysis.has_golf_view) features.push('Vista Golfe')
    if (analysis.has_city_view) features.push('Vista Cidade')
    if (analysis.has_mountain_view) features.push('Vista Montanha')
    return features
  }

  private formatExternalRef(submissionId: string, portal: 'idealista' | 'imovirtual' | 'kyero'): string {
    const prefix = { idealista: 'IDL', imovirtual: 'IMV', kyero: 'KYR' }[portal]
    return `${prefix}-${submissionId.slice(0, 8).toUpperCase()}`
  }

  private buildIdealistaFields(analysis: PropertyAnalysis): Record<string, unknown> {
    return {
      catastral_reference: null, // requires manual entry
      floor_number: analysis.floor ?? null,
      has_lift: analysis.has_elevator,
      architecture_style: analysis.architecture_style,
      property_condition: analysis.condition,
      sunlight_score: analysis.sunlight_score,
    }
  }

  private buildImovirtualFields(analysis: PropertyAnalysis): Record<string, unknown> {
    return {
      energy_certificate_class: analysis.energy_class,
      usable_area_sqm: analysis.area_sqm ? Math.round(analysis.area_sqm * 0.85) : null,
      gross_area_sqm: analysis.area_sqm ?? null,
      renovation_probability: analysis.renovation_probability,
      staging_quality: analysis.staging_quality,
    }
  }

  private buildKyeroFields(analysis: PropertyAnalysis): Record<string, unknown> {
    return {
      international_buyer_focus: true,
      luxury_score: analysis.luxury_score,
      investor_attractiveness_note:
        analysis.luxury_score > 70 ? 'Prime investment-grade property in premium location' : null,
      architect_style_en: analysis.architecture_style,
    }
  }

  adapt(
    submissionId: string,
    analysis: PropertyAnalysis,
    listing: GeneratedListing,
    priceEur: number,
    imageUrls: string[]
  ): PortalListing[] {
    const titlePt = listing.title?.pt ?? listing.title?.en ?? ''
    const titleEn = listing.title?.en ?? listing.title?.pt ?? ''
    const descPt = listing.description?.pt ?? listing.description?.en ?? ''
    const descEn = listing.description?.en ?? listing.description?.pt ?? ''
    const features = this.buildFeatures(analysis)
    const location = {
      city: analysis.location?.city,
      neighborhood: analysis.location?.neighborhood,
      latitude: analysis.location?.latitude,
      longitude: analysis.location?.longitude,
    }

    const portals: Array<'idealista' | 'imovirtual' | 'kyero'> = ['idealista', 'imovirtual', 'kyero']

    const results: PortalListing[] = portals.map((portal) => {
      let portalSpecific: Record<string, unknown>
      if (portal === 'idealista') portalSpecific = this.buildIdealistaFields(analysis)
      else if (portal === 'imovirtual') portalSpecific = this.buildImovirtualFields(analysis)
      else portalSpecific = this.buildKyeroFields(analysis)

      return {
        portal,
        submission_id: submissionId,
        external_reference: this.formatExternalRef(submissionId, portal),
        title_pt: titlePt,
        title_en: titleEn,
        description_pt: descPt,
        description_en: descEn,
        price_eur: priceEur,
        area_sqm: analysis.area_sqm,
        bedrooms: analysis.bedrooms,
        bathrooms: analysis.bathrooms,
        energy_class: analysis.energy_class,
        image_urls: imageUrls,
        location,
        features,
        status: 'ready_to_publish',
        portal_specific_fields: portalSpecific,
      }
    })

    logger.info('[PortalAdapter] adapted', { submission_id: submissionId, portals: 3 })

    return results
  }
}

export const portalAdapter = PortalAdapter.getInstance()
