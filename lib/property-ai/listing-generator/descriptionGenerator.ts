// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import type { PropertyAnalysis, ListingLanguage } from '@/lib/property-ai/types'

export interface DescriptionSet {
  full: string       // 3-5 paragraphs, emotional storytelling
  short: string      // 2-3 sentences for cards
  portal: string     // portal-formatted, fact-based
  investor: string   // ROI-focused, market data
  family: string     // lifestyle-focused, schools/space
  luxury: string     // aspirational, exclusive tone
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
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await resp.json() as { content?: Array<{ text?: string }> }
  return data.content?.[0]?.text ?? ''
}

const LANGUAGE_INSTRUCTION: Record<ListingLanguage, string> = {
  pt: 'Escreve em Português Europeu (PT-PT). Tom elegante, profissional e emocional.',
  en: 'Write in English. Professional luxury real estate tone. British spelling preferred.',
  es: 'Escribe en Español. Tono cálido, profesional y aspiracional.',
  fr: 'Écris en Français. Ton chaleureux, élégant et luxueux.',
  de: 'Schreibe auf Deutsch. Ton: formal, präzise und qualitätsbewusst.',
  ar: 'اكتب باللغة العربية. النبرة: فاخرة، حصرية وراقية.',
}

const MARKET_CONTEXT_2026 = `Portugal 2026 market context (use where relevant):
- National median: €3.076/m² (+17.6% YoY)
- Lisboa prime zones: €5.000/m²
- Cascais: €4.713/m²
- Algarve: €3.941/m²
- Porto: €3.643/m²
- Madeira: €3.760/m²
- Average days on market: 210 days
- Total transactions 2025: 169,812
- Luxury Lisboa: top 5 globally`

function buildFallbackDescriptionSet(analysis: PropertyAnalysis, language: ListingLanguage, priceEur?: number): DescriptionSet {
  const loc = analysis.location?.city ?? analysis.location?.neighborhood ?? 'Portugal'
  const bed = analysis.bedrooms != null ? `${analysis.bedrooms} bedrooms` : ''
  const area = analysis.area_sqm != null ? `${analysis.area_sqm} m²` : ''
  const price = priceEur != null ? `€${priceEur.toLocaleString('pt-PT')}` : ''
  const base = `${analysis.property_type ?? 'Property'} in ${loc}. ${[bed, area, price].filter(Boolean).join(', ')}.`
  return { full: base, short: base, portal: base, investor: base, family: base, luxury: base }
}

class DescriptionGenerator {
  async generate(
    analysis: PropertyAnalysis,
    language: ListingLanguage,
    priceEur?: number,
  ): Promise<DescriptionSet> {
    const loc = analysis.location?.city ?? analysis.location?.neighborhood ?? 'Portugal'
    const features: string[] = []
    if (analysis.has_sea_view) features.push('sea view')
    if (analysis.has_pool) features.push('swimming pool')
    if (analysis.has_garden) features.push('private garden')
    if (analysis.has_golf_view) features.push('golf view')
    if (analysis.has_city_view) features.push('city view')
    if (analysis.has_mountain_view) features.push('mountain view')
    if (analysis.has_elevator) features.push('elevator')
    if (analysis.has_parking) features.push('private parking')

    const pricePerSqm =
      priceEur != null && analysis.area_sqm != null && analysis.area_sqm > 0
        ? Math.round(priceEur / analysis.area_sqm)
        : null

    const prompt = `${LANGUAGE_INSTRUCTION[language]}

You are an elite real estate copywriter for Agency Group Portugal (AMI 22506).
Generate 6 property descriptions. Return ONLY valid JSON.

LEGAL REQUIREMENT: Do NOT make guaranteed appreciation or investment return claims.
Use only facts from the property data below — no hallucination.

${MARKET_CONTEXT_2026}

Property facts:
- type: ${analysis.property_type ?? 'unknown'}
- bedrooms: ${analysis.bedrooms ?? 'unknown'}
- bathrooms: ${analysis.bathrooms ?? 'unknown'}
- area: ${analysis.area_sqm != null ? `${analysis.area_sqm} m²` : 'unknown'}
- floor: ${analysis.floor ?? 'unknown'}
- location: ${loc}${analysis.location?.neighborhood ? ` — ${analysis.location.neighborhood}` : ''}
- condition: ${analysis.condition}
- architecture: ${analysis.architecture_style}
- energy_class: ${analysis.energy_class}
- staging_quality: ${analysis.staging_quality}
- features: ${features.join(', ') || 'standard'}
- luxury_score: ${analysis.luxury_score}/100
- sunlight_score: ${analysis.sunlight_score}/100
- renovation_probability: ${analysis.renovation_probability}%
- premium_zone: ${analysis.location?.premium_zone ?? false}
- zone_classification: ${analysis.location?.zone_classification ?? 'unknown'}
- nearby_amenities: ${analysis.location?.nearby_amenities?.join(', ') ?? 'unknown'}${priceEur != null ? `\n- asking_price: €${priceEur.toLocaleString('pt-PT')}` : ''}${pricePerSqm != null ? `\n- price_per_sqm: €${pricePerSqm}/m²` : ''}

Return JSON with exactly these keys:
{
  "full": "3-5 paragraphs, emotional storytelling, paint a lifestyle picture — 400-600 words",
  "short": "2-3 sentences for property cards — max 200 chars",
  "portal": "fact-based portal description, structured paragraphs, professional — 200-300 words",
  "investor": "ROI-focused, references market data, yield potential, area growth, NHR/Golden Visa if relevant — 200-300 words",
  "family": "lifestyle-focused: space, schools, safety, community, outdoor living — 200-300 words",
  "luxury": "aspirational, exclusive, poetic — written for HNWI audience — 200-300 words"
}

Return ONLY the JSON object, no markdown, no explanation.`

    try {
      const raw = await callClaude(prompt)
      const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
      const parsed = JSON.parse(cleaned) as DescriptionSet
      logger.info('[DescriptionGenerator] generated', { submission_id: analysis.submission_id, language })
      return parsed
    } catch (err) {
      logger.warn('[DescriptionGenerator] parse failed, using fallback', {
        submission_id: analysis.submission_id,
        language,
        err: String(err),
      })
      return buildFallbackDescriptionSet(analysis, language, priceEur)
    }
  }
}

export const descriptionGenerator = new DescriptionGenerator()
