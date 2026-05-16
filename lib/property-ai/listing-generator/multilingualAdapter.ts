// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import type { PropertyAnalysis, ListingLanguage } from '@/lib/property-ai/types'

export interface MarketAdaptation {
  language: ListingLanguage
  target_market: string           // e.g. "Norte-americanos", "Franceses", "Britânicos"
  tone: 'formal' | 'warm' | 'luxury' | 'investment'
  price_format: string            // e.g. "€1,250,000" or "1.250.000 €"
  area_format: string             // e.g. "145 m²" or "1,560 sq ft"
  cultural_highlights: string[]   // what this market values most
}

// Hardcoded market profiles from AG ELITE CLAUDE.md
// €500K-€3M segment: Norte-americanos 16% · Franceses 13% · Britânicos 9% · Chineses 8% · Brasileiros 6% · Alemães 5% · Médio Oriente
interface MarketProfile {
  target: string
  tone: 'formal' | 'warm' | 'luxury' | 'investment'
  highlights: string[]
  price_format: (eur: number) => string
  area_format: (sqm: number) => string
}

const MARKET_PROFILES: Record<ListingLanguage, MarketProfile> = {
  en: {
    target: 'British/American',
    tone: 'luxury',
    highlights: ['privacy', 'investment returns', 'golden visa', 'NHR tax regime', 'security'],
    price_format: (eur) => `€${eur.toLocaleString('en-GB')}`,
    area_format: (sqm) => `${sqm} m² (${Math.round(sqm * 10.7639).toLocaleString('en-GB')} sq ft)`,
  },
  fr: {
    target: 'French',
    tone: 'warm',
    highlights: ['lifestyle', 'gastronomy', 'climate', 'culture', 'joie de vivre'],
    price_format: (eur) => `${eur.toLocaleString('fr-FR')} €`,
    area_format: (sqm) => `${sqm} m²`,
  },
  de: {
    target: 'German',
    tone: 'formal',
    highlights: ['quality construction', 'documentation', 'sustainability', 'energy efficiency', 'legal security'],
    price_format: (eur) => `${eur.toLocaleString('de-DE')} €`,
    area_format: (sqm) => `${sqm} m²`,
  },
  ar: {
    target: 'Middle East',
    tone: 'luxury',
    highlights: ['exclusivity', 'security', 'prestige', 'privacy', 'family space', 'pool'],
    price_format: (eur) => `€${eur.toLocaleString('en-US')}`,
    area_format: (sqm) => `${sqm} م²`,
  },
  pt: {
    target: 'Portuguese/Brazilian',
    tone: 'warm',
    highlights: ['value for money', 'location', 'community', 'schools', 'public transport'],
    price_format: (eur) => `${eur.toLocaleString('pt-PT')} €`,
    area_format: (sqm) => `${sqm} m²`,
  },
  es: {
    target: 'Spanish',
    tone: 'warm',
    highlights: ['lifestyle', 'location', 'price advantage vs Spain', 'climate', 'gastronomy'],
    price_format: (eur) => `${eur.toLocaleString('es-ES')} €`,
    area_format: (sqm) => `${sqm} m²`,
  },
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
      max_tokens: 3000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  const data = await resp.json() as { content?: Array<{ text?: string }> }
  return data.content?.[0]?.text ?? ''
}

class MultilingualAdapter {
  getMarketAdaptation(language: ListingLanguage, priceEur?: number, areaSqm?: number): MarketAdaptation {
    const profile = MARKET_PROFILES[language]
    return {
      language,
      target_market: profile.target,
      tone: profile.tone,
      price_format: priceEur != null ? profile.price_format(priceEur) : '—',
      area_format: areaSqm != null ? profile.area_format(areaSqm) : '—',
      cultural_highlights: profile.highlights,
    }
  }

  async adapt(
    baseContent: string,
    targetLanguage: ListingLanguage,
    analysis: PropertyAnalysis,
  ): Promise<string> {
    const profile = MARKET_PROFILES[targetLanguage]
    const loc = analysis.location?.city ?? analysis.location?.neighborhood ?? 'Portugal'
    const priceInfo = analysis.area_sqm != null ? `${analysis.area_sqm} m²` : ''

    const toneGuide: Record<MarketProfile['tone'], string> = {
      formal: 'formal, precise, fact-driven, documentation-focused',
      warm: 'warm, friendly, lifestyle-oriented, community-focused',
      luxury: 'aspirational, exclusive, prestige-focused, HNWI language',
      investment: 'ROI-focused, data-driven, yield and capital growth language',
    }

    const prompt = `You are an elite multilingual real estate copywriter for Agency Group Portugal (AMI 22506).

Adapt the following property listing text for the ${profile.target} market.

TARGET LANGUAGE: ${targetLanguage.toUpperCase()}
TARGET MARKET: ${profile.target}
TONE: ${toneGuide[profile.tone]}
CULTURAL HIGHLIGHTS to weave in (only if naturally relevant): ${profile.highlights.join(', ')}
PROPERTY LOCATION: ${loc}
AREA FORMAT: ${priceInfo ? profile.area_format(analysis.area_sqm!) : 'unknown'}

BASE CONTENT (translate + culturally adapt):
---
${baseContent}
---

RULES:
1. Write ONLY in ${targetLanguage.toUpperCase()} — no other language
2. Preserve all facts — do not add or remove property details
3. Adapt tone and cultural emphasis for ${profile.target} buyers
4. Do NOT make guaranteed return or appreciation claims
5. Keep similar length to the base content
6. If the base content mentions prices in EUR, format as: ${profile.price_format(500000)} (example)

Return ONLY the adapted text, no explanation, no markdown.`

    try {
      const adapted = await callClaude(prompt)
      const result = adapted.trim()
      logger.info('[MultilingualAdapter] adapted', { language: targetLanguage })
      return result
    } catch (err) {
      logger.error('[MultilingualAdapter] adaptation failed', { language: targetLanguage, err: String(err) })
      return baseContent
    }
  }
}

export const multilingualAdapter = new MultilingualAdapter()
