// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import type { ZoneClassification } from '@/lib/property-ai/types'

interface GeospatialResult {
  inferred_city?: string
  inferred_neighborhood?: string
  zone_classification: ZoneClassification
  premium_zone: boolean
  walkability_score: number
  price_per_sqm_estimate: number
  nearby_amenities: string[]
  beach_distance_km?: number
  airport_distance_km?: number
  quality_of_life_score: number
  confidence: number
}

// Portugal 2026 benchmarks
const ZONE_PRICE_MAP: Record<string, number> = {
  'Lisboa': 5000,
  'Cascais': 4713,
  'Algarve': 3941,
  'Porto': 3643,
  'Madeira': 3760,
  'Açores': 1952,
  'default': 3076,
}

const ULTRA_LUXURY_ZONES = [
  'Chiado',
  'Príncipe Real',
  'Lapa',
  'Campo de Ourique',
  'Sintra',
  'Quinta do Lago',
  'Vale do Lobo',
  'Vilamoura',
]

const LUXURY_ZONES = [
  'Cascais',
  'Estoril',
  'Belém',
  'Areeiro',
  'Faro',
  'Albufeira',
]

const DEFAULT_RESULT: GeospatialResult = {
  zone_classification: 'mid-range',
  premium_zone: false,
  walkability_score: 50,
  price_per_sqm_estimate: ZONE_PRICE_MAP['default'],
  nearby_amenities: [],
  quality_of_life_score: 60,
  confidence: 0.3,
}

function classifyZone(city: string | undefined, neighborhood: string | undefined): ZoneClassification {
  const loc = `${neighborhood ?? ''} ${city ?? ''}`.trim()
  for (const zone of ULTRA_LUXURY_ZONES) {
    if (loc.toLowerCase().includes(zone.toLowerCase())) return 'ultra-luxury'
  }
  for (const zone of LUXURY_ZONES) {
    if (loc.toLowerCase().includes(zone.toLowerCase())) return 'luxury'
  }
  if (city === 'Lisboa' || city === 'Porto' || city === 'Cascais') return 'premium'
  if (city === 'Madeira' || city === 'Algarve') return 'premium'
  if (city === 'Açores') return 'mid-range'
  return 'mid-range'
}

function estimatePricePerSqm(city: string | undefined): number {
  if (!city) return ZONE_PRICE_MAP['default']
  for (const [key, val] of Object.entries(ZONE_PRICE_MAP)) {
    if (city.toLowerCase().includes(key.toLowerCase())) return val
  }
  return ZONE_PRICE_MAP['default']
}

const LOCATION_PROMPT = (description: string) =>
  `You are a Portuguese real estate location expert. Analyze the following property description and infer location details.
Return a JSON object with EXACTLY these fields:
{
  "inferred_city": "city name or null",
  "inferred_neighborhood": "neighborhood name or null",
  "nearby_amenities": ["amenity1", "amenity2"],
  "beach_distance_km": number or null,
  "airport_distance_km": number or null,
  "walkability_score": 0-100,
  "quality_of_life_score": 0-100,
  "confidence": 0.0-1.0
}

Property description:
"""
${description}
"""

Focus on Portuguese cities, neighborhoods, and landmarks. Return only the JSON object.`

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
      max_tokens: 1024,
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }],
    }),
  })
  const data = (await resp.json()) as { content?: Array<{ text?: string }> }
  return data.content?.[0]?.text ?? ''
}

class GeospatialIntelligence {
  async analyzeLocation(
    description: string,
    imageUrls: string[],
    submissionId: string
  ): Promise<GeospatialResult> {
    // Combine description with image filenames for richer context
    const imageContext = imageUrls
      .map((u) => decodeURIComponent(u.split('/').pop() ?? ''))
      .join(', ')
    const combinedInput = [description, imageContext].filter(Boolean).join('\n')

    if (!combinedInput.trim()) {
      logger.warn('[GeospatialIntelligence] no location context', { submissionId })
      return { ...DEFAULT_RESULT }
    }

    try {
      const raw = await callClaude(LOCATION_PROMPT(combinedInput))
      const jsonMatch = raw.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        logger.warn('[GeospatialIntelligence] no JSON in response', { submissionId })
        return { ...DEFAULT_RESULT }
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        inferred_city?: string | null
        inferred_neighborhood?: string | null
        nearby_amenities?: string[]
        beach_distance_km?: number | null
        airport_distance_km?: number | null
        walkability_score?: number
        quality_of_life_score?: number
        confidence?: number
      }

      const inferred_city = parsed.inferred_city ?? undefined
      const inferred_neighborhood = parsed.inferred_neighborhood ?? undefined
      const zone_classification = classifyZone(inferred_city, inferred_neighborhood)
      const premium_zone =
        zone_classification === 'ultra-luxury' || zone_classification === 'luxury'
      const price_per_sqm_estimate = estimatePricePerSqm(inferred_city)

      const result: GeospatialResult = {
        inferred_city,
        inferred_neighborhood,
        zone_classification,
        premium_zone,
        walkability_score: typeof parsed.walkability_score === 'number' ? parsed.walkability_score : 50,
        price_per_sqm_estimate,
        nearby_amenities: Array.isArray(parsed.nearby_amenities) ? parsed.nearby_amenities : [],
        beach_distance_km: parsed.beach_distance_km ?? undefined,
        airport_distance_km: parsed.airport_distance_km ?? undefined,
        quality_of_life_score:
          typeof parsed.quality_of_life_score === 'number' ? parsed.quality_of_life_score : 60,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
      }

      logger.info('[GeospatialIntelligence] analyzed', {
        submissionId,
        inferred_city,
        zone_classification,
        confidence: result.confidence,
      })

      return result
    } catch (err) {
      logger.error('[GeospatialIntelligence] analysis failed', { submissionId, err })
      return { ...DEFAULT_RESULT }
    }
  }
}

export const geospatialIntelligence = new GeospatialIntelligence()
export type { GeospatialResult }
