// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import type { PropertyAnalysis, GeneratedListing, ListingLanguage } from '@/lib/property-ai/types'

export interface SEOPackage {
  meta_title: string                            // <60 chars
  meta_description: string                      // <160 chars
  keywords: string[]                            // 10-15 keywords
  og_title: string                              // Open Graph title
  og_description: string                        // Open Graph description
  structured_data: Record<string, unknown>      // JSON-LD schema for RealEstateListing
  geo_tags: { region?: string; placename?: string; position?: string }
}

async function callClaude(prompt: string): Promise<string> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await resp.json() as { content?: Array<{ text?: string }> }
  return data.content?.[0]?.text ?? ''
}

function buildStructuredData(
  analysis: PropertyAnalysis,
  listing: Partial<GeneratedListing>,
  language: ListingLanguage,
): Record<string, unknown> {
  const loc = analysis.location
  const price = listing.estimated_price_eur
  return {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: listing.title?.[language] ?? listing.title?.['pt'] ?? `Property in ${loc?.city ?? 'Portugal'}`,
    description: listing.description?.[language] ?? listing.description?.['pt'] ?? '',
    url: `https://agencygroup.pt/imoveis/${listing.listing_id ?? listing.submission_id ?? ''}`,
    image: [],
    offers: price != null ? {
      '@type': 'Offer',
      price: price,
      priceCurrency: 'EUR',
      availability: 'https://schema.org/InStock',
    } : undefined,
    address: loc != null ? {
      '@type': 'PostalAddress',
      addressLocality: loc.city ?? '',
      addressRegion: loc.zone ?? loc.neighborhood ?? '',
      addressCountry: 'PT',
    } : undefined,
    numberOfRooms: analysis.bedrooms ?? undefined,
    floorSize: analysis.area_sqm != null ? {
      '@type': 'QuantitativeValue',
      value: analysis.area_sqm,
      unitCode: 'MTK',
    } : undefined,
    amenityFeature: [
      ...(analysis.has_pool ? [{ '@type': 'LocationFeatureSpecification', name: 'Swimming Pool', value: true }] : []),
      ...(analysis.has_garden ? [{ '@type': 'LocationFeatureSpecification', name: 'Garden', value: true }] : []),
      ...(analysis.has_parking ? [{ '@type': 'LocationFeatureSpecification', name: 'Parking', value: true }] : []),
      ...(analysis.has_elevator ? [{ '@type': 'LocationFeatureSpecification', name: 'Elevator', value: true }] : []),
      ...(analysis.has_sea_view ? [{ '@type': 'LocationFeatureSpecification', name: 'Sea View', value: true }] : []),
    ],
  }
}

const LOCATION_KEYWORDS: Record<string, string[]> = {
  Lisboa: ['Lisboa', 'Lisbon', 'Príncipe Real', 'Chiado', 'Estrela', 'Avenidas Novas', 'Parque das Nações'],
  Cascais: ['Cascais', 'Estoril', 'Birre', 'Quinta da Marinha', 'Sintra', 'Linha de Cascais'],
  Algarve: ['Algarve', 'Quinta do Lago', 'Vale do Lobo', 'Vilamoura', 'Albufeira', 'Lagos', 'Portimão'],
  Porto: ['Porto', 'Foz do Douro', 'Boavista', 'Miramar', 'Espinho', 'Vila Nova de Gaia'],
  Madeira: ['Madeira', 'Funchal', 'Caniço', 'Câmara de Lobos'],
  Açores: ['Açores', 'Ponta Delgada', 'São Miguel'],
}

function getLocationKeywords(city?: string): string[] {
  if (!city) return ['Portugal', 'imóvel']
  for (const [key, kws] of Object.entries(LOCATION_KEYWORDS)) {
    if (city.toLowerCase().includes(key.toLowerCase())) return kws
  }
  return [city, 'Portugal']
}

const LANGUAGE_LABEL: Record<ListingLanguage, string> = {
  pt: 'Português Europeu (PT-PT)',
  en: 'English',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  ar: 'العربية',
}

class SEOGenerator {
  async generate(
    analysis: PropertyAnalysis,
    listing: Partial<GeneratedListing>,
    language: ListingLanguage,
  ): Promise<SEOPackage> {
    const loc = analysis.location?.city ?? analysis.location?.neighborhood ?? 'Portugal'
    const locationKws = getLocationKeywords(analysis.location?.city)
    const features: string[] = []
    if (analysis.has_sea_view) features.push('vista mar')
    if (analysis.has_pool) features.push('piscina')
    if (analysis.has_garden) features.push('jardim')
    if (analysis.bedrooms != null) features.push(`T${analysis.bedrooms}`)
    if (analysis.area_sqm != null) features.push(`${analysis.area_sqm}m²`)

    const prompt = `You are an SEO specialist for Agency Group Portugal (AMI 22506).
Generate SEO metadata for a property listing in ${LANGUAGE_LABEL[language]}. Return ONLY valid JSON.

Property:
- type: ${analysis.property_type ?? 'unknown'}
- bedrooms: ${analysis.bedrooms ?? 'unknown'}
- area: ${analysis.area_sqm != null ? `${analysis.area_sqm} m²` : 'unknown'}
- location: ${loc}
- luxury_score: ${analysis.luxury_score}/100
- features: ${features.join(', ') || 'standard'}
- location_keywords: ${locationKws.join(', ')}
- existing_title: ${listing.title?.[language] ?? listing.title?.['pt'] ?? 'none'}

Rules:
- meta_title: max 60 chars, include type + location + key feature
- meta_description: max 160 chars, compelling, include location and CTA
- keywords: 10-15 relevant search terms (mix pt/en/local area terms)
- og_title: can be slightly longer than meta_title, more emotional
- og_description: 1-2 sentences, social-share optimized

Return JSON:
{
  "meta_title": "...",
  "meta_description": "...",
  "keywords": ["...", "..."],
  "og_title": "...",
  "og_description": "..."
}

Return ONLY the JSON object, no markdown.`

    const structured_data = buildStructuredData(analysis, listing, language)
    const geo_tags: SEOPackage['geo_tags'] = {
      region: analysis.location?.zone ?? analysis.location?.city,
      placename: analysis.location?.neighborhood ?? analysis.location?.city ?? 'Portugal',
      position:
        analysis.location?.latitude != null && analysis.location?.longitude != null
          ? `${analysis.location.latitude};${analysis.location.longitude}`
          : undefined,
    }

    try {
      const raw = await callClaude(prompt)
      const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
      const parsed = JSON.parse(cleaned) as Omit<SEOPackage, 'structured_data' | 'geo_tags'>

      // Enforce character limits
      const meta_title = (parsed.meta_title ?? '').slice(0, 60)
      const meta_description = (parsed.meta_description ?? '').slice(0, 160)
      const keywords = Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 15) : locationKws

      logger.info('[SEOGenerator] generated', { submission_id: analysis.submission_id })
      return { meta_title, meta_description, keywords, og_title: parsed.og_title ?? meta_title, og_description: parsed.og_description ?? meta_description, structured_data, geo_tags }
    } catch (err) {
      logger.warn('[SEOGenerator] parse failed, using fallback', { submission_id: analysis.submission_id, err: String(err) })
      const fallback_title = `${analysis.property_type ?? 'Imóvel'} em ${loc}`.slice(0, 60)
      const fallback_desc = `${analysis.property_type ?? 'Property'} ${features.join(', ')} — Agency Group Portugal`.slice(0, 160)
      return {
        meta_title: fallback_title,
        meta_description: fallback_desc,
        keywords: locationKws,
        og_title: fallback_title,
        og_description: fallback_desc,
        structured_data,
        geo_tags,
      }
    }
  }
}

export const seoGenerator = new SEOGenerator()
