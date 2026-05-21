// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Normalization Pipeline (Wave 32 Layer 1)
// lib/ingestion/normalizationPipeline.ts
//
// Normalizes CasafariProperty | IdealistaProperty → CanonicalPropertyInput.
// Canonical typology set: T0 / T1 / T2 / T3 / T4 / T5+
// price_per_sqm is computed; null if area_sqm <= 0.
// =============================================================================

import type { CasafariProperty }  from '@/lib/ingestion/casafariClient'
import type { IdealistaProperty } from '@/lib/ingestion/idealistaClient'

// ─── Public types ─────────────────────────────────────────────────────────────

export interface CanonicalPropertyInput {
  external_id: string
  source: 'casafari' | 'idealista' | 'crm' | 'broker' | 'manual'
  title: string
  price_eur: number
  area_sqm: number
  typology: string
  zone: string
  district: string
  country: 'PT' | 'ES'
  latitude: number | null
  longitude: number | null
  description: string | null
  price_per_sqm: number | null   // price_eur / area_sqm; null if area_sqm <= 0
  listed_at: string
  updated_at: string
}

// ─── Typology normalizer ──────────────────────────────────────────────────────

const CANONICAL_TYPOLOGIES = new Set(['T0', 'T1', 'T2', 'T3', 'T4', 'T5+'])

export function normalizeTypology(raw: string): string {
  const upper = raw.toUpperCase().trim()
  if (CANONICAL_TYPOLOGIES.has(upper)) return upper
  // Attempt to extract numeric part
  const match = upper.match(/T(\d+)/)
  if (match) {
    const n = parseInt(match[1], 10)
    if (n >= 5) return 'T5+'
    return `T${n}`
  }
  // studio / bedsit → T0
  if (/STUDIO|BEDSIT|ZERO|0/.test(upper)) return 'T0'
  // 5+ bedrooms variant
  if (/T5\+|T6|T7|T8|T9/.test(upper)) return 'T5+'
  return 'T0'
}

// ─── price_per_sqm helper ─────────────────────────────────────────────────────

function computePricePerSqm(price: number, area: number): number | null {
  if (area <= 0) return null
  return Math.round((price / area) * 100) / 100
}

// ─── Country normalizer ───────────────────────────────────────────────────────

function normalizeCountry(raw: string): 'PT' | 'ES' {
  const upper = raw.toUpperCase()
  if (upper === 'ES' || upper === 'ESP' || upper === 'SPAIN' || upper === 'ESPANHA') return 'ES'
  return 'PT'
}

// ─── Individual normalizers ───────────────────────────────────────────────────

export function normalizeCasafari(p: CasafariProperty): CanonicalPropertyInput {
  return {
    external_id:   p.external_id,
    source:        'casafari',
    title:         p.title,
    price_eur:     p.price,
    area_sqm:      p.area_sqm,
    typology:      normalizeTypology(p.typology),
    zone:          p.zone,
    district:      p.district,
    country:       normalizeCountry(p.country),
    latitude:      p.latitude ?? null,
    longitude:     p.longitude ?? null,
    description:   p.description ?? null,
    price_per_sqm: computePricePerSqm(p.price, p.area_sqm),
    listed_at:     p.listed_at,
    updated_at:    p.updated_at,
  }
}

export function normalizeIdealista(p: IdealistaProperty): CanonicalPropertyInput {
  return {
    external_id:   p.external_id,
    source:        'idealista',
    title:         p.title,
    price_eur:     p.price,
    area_sqm:      p.area_sqm,
    typology:      normalizeTypology(p.typology),
    zone:          p.zone,
    district:      p.province,
    country:       normalizeCountry(p.country),
    latitude:      p.latitude ?? null,
    longitude:     p.longitude ?? null,
    description:   p.description ?? null,
    price_per_sqm: computePricePerSqm(p.price, p.area_sqm),
    listed_at:     p.listed_at,
    updated_at:    p.updated_at,
  }
}

export function normalizeBatch(
  items: (CasafariProperty | IdealistaProperty)[],
): CanonicalPropertyInput[] {
  const results: CanonicalPropertyInput[] = []
  for (const item of items) {
    if (item.source === 'casafari') {
      results.push(normalizeCasafari(item as CasafariProperty))
    } else {
      results.push(normalizeIdealista(item as IdealistaProperty))
    }
  }
  return results
}
