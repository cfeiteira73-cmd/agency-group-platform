// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import type { PropertyAnalysis, ListingLanguage } from '@/lib/property-ai/types'
import { withAI } from '@/lib/ops/withAI'

export interface TitleSet {
  standard: string   // "Apartamento T3 com vista mar, Cascais"
  premium: string    // "Apartamento Boutique com Vista Panorâmica sobre o Mar"
  luxury: string     // "Residência Privé — Vistas Infinitas sobre o Atlântico, Cascais"
  seo: string        // keyword-optimized for search engines
  social: string     // attention-grabbing for social media
}

async function callClaude(prompt: string): Promise<string> {
  return withAI('anthropic-opus', async () => {
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
    if (!resp.ok) throw new Error(`Anthropic error: ${resp.status}`)
    const data = await resp.json() as { content?: Array<{ text?: string }> }
    return data.content?.[0]?.text ?? ''
  }, '')
}

function buildFallbackTitleSet(analysis: PropertyAnalysis, language: ListingLanguage): TitleSet {
  const loc = analysis.location?.city ?? analysis.location?.neighborhood ?? 'Portugal'
  const bed = analysis.bedrooms != null ? `T${analysis.bedrooms}` : ''
  const type = analysis.property_type ?? 'Imóvel'
  const typeLabel: Record<string, string> = {
    apartment: language === 'pt' ? 'Apartamento' : language === 'es' ? 'Apartamento' : language === 'fr' ? 'Appartement' : language === 'de' ? 'Wohnung' : 'Apartment',
    villa: language === 'pt' ? 'Moradia' : language === 'es' ? 'Villa' : language === 'fr' ? 'Villa' : language === 'de' ? 'Villa' : 'Villa',
    townhouse: language === 'pt' ? 'Casa em Banda' : 'Townhouse',
    penthouse: 'Penthouse',
    studio: language === 'pt' ? 'Estúdio' : language === 'fr' ? 'Studio' : 'Studio',
    commercial: language === 'pt' ? 'Espaço Comercial' : 'Commercial Space',
    land: language === 'pt' ? 'Terreno' : 'Land',
    garage: language === 'pt' ? 'Garagem' : 'Garage',
  }
  const label = typeLabel[type] ?? type
  const view = analysis.has_sea_view ? (language === 'pt' ? 'vista mar' : language === 'es' ? 'vista al mar' : language === 'fr' ? 'vue mer' : language === 'de' ? 'Meerblick' : 'sea view') : ''

  const standard = [label, bed, view, loc].filter(Boolean).join(' ')
  return {
    standard,
    premium: standard,
    luxury: standard,
    seo: standard,
    social: standard,
  }
}

const LANGUAGE_INSTRUCTION: Record<ListingLanguage, string> = {
  pt: 'Escreve em Português Europeu (PT-PT). Tom elegante e profissional.',
  en: 'Write in British/American English. Tone: luxury real estate professional.',
  es: 'Escribe en Español. Tono cálido y profesional.',
  fr: 'Écris en Français. Ton chaleureux et luxueux.',
  de: 'Schreibe auf Deutsch. Ton: formal und qualitätsbewusst.',
  ar: 'اكتب باللغة العربية. النبرة: فاخرة وحصرية.',
}

class TitleGenerator {
  async generate(analysis: PropertyAnalysis, language: ListingLanguage): Promise<TitleSet> {
    const loc = analysis.location?.city ?? analysis.location?.neighborhood ?? 'Portugal'
    const features: string[] = []
    if (analysis.has_sea_view) features.push('sea view')
    if (analysis.has_pool) features.push('pool')
    if (analysis.has_garden) features.push('garden')
    if (analysis.has_golf_view) features.push('golf view')
    if (analysis.has_city_view) features.push('city view')
    if (analysis.has_mountain_view) features.push('mountain view')
    if (analysis.has_elevator) features.push('elevator')
    if (analysis.has_parking) features.push('parking')

    const prompt = `${LANGUAGE_INSTRUCTION[language]}

You are an elite real estate copywriter for Agency Group Portugal (AMI 22506).
Generate 5 property listing titles for the following property. Return ONLY valid JSON.

Property facts:
- type: ${analysis.property_type ?? 'unknown'}
- bedrooms: ${analysis.bedrooms ?? 'unknown'}
- bathrooms: ${analysis.bathrooms ?? 'unknown'}
- area: ${analysis.area_sqm != null ? `${analysis.area_sqm} m²` : 'unknown'}
- floor: ${analysis.floor ?? 'unknown'}
- location: ${loc}${analysis.location?.neighborhood ? ` (${analysis.location.neighborhood})` : ''}
- condition: ${analysis.condition}
- architecture: ${analysis.architecture_style}
- features: ${features.join(', ') || 'none specified'}
- luxury_score: ${analysis.luxury_score}/100
- energy_class: ${analysis.energy_class}

Return JSON with exactly these keys:
{
  "standard": "short factual title, e.g. Apartamento T3 com vista mar, Cascais",
  "premium": "aspirational title with highlight feature, boutique language",
  "luxury": "exclusive, emotional, poetic — use em dash or ellipsis for effect",
  "seo": "keyword-rich title under 60 chars with location and type",
  "social": "attention-grabbing, emoji allowed, max 80 chars"
}

Return ONLY the JSON object, no markdown, no explanation.`

    try {
      const raw = await callClaude(prompt)
      const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
      const parsed = JSON.parse(cleaned) as TitleSet
      logger.info('[TitleGenerator] generated', { submission_id: analysis.submission_id, language })
      return parsed
    } catch (err) {
      logger.warn('[TitleGenerator] parse failed, using fallback', { submission_id: analysis.submission_id, language, err: String(err) })
      return buildFallbackTitleSet(analysis, language)
    }
  }
}

export const titleGenerator = new TitleGenerator()
