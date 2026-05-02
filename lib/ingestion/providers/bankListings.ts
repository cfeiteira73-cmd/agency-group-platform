// =============================================================================
// Agency Group — Bank & Judicial Auction Provider Adapter
// lib/ingestion/providers/bankListings.ts
//
// Wraps lib/eleiloes-api.ts into the unified ProviderAdapter interface.
// Sources: e-Leilões.pt (judicial) + Portal das Finanças (fiscal auctions)
//
// Confidence: 1.00 (official government sources, legally public data)
// Auth: None required — public portals
//
// NOTE: Auction properties are ingested with status='auction'.
//       Their `price` = valorBase (base auction price, NOT market value).
//       The AVM engine is especially valuable for these to estimate market value.
// =============================================================================

import {
  fetchEleiloesListings,
  fetchLeiloesTaxListings,
  type EleiloesListing,
} from '@/lib/eleiloes-api'
import {
  type ProviderAdapter,
  type ProviderListing,
  type ProviderFetchParams,
  type NormalizedPropertyType,
  PROVIDER_CONFIDENCE,
} from '@/lib/ingestion/types'
import { resolvePropertyZone } from '@/lib/market/zones'

// ---------------------------------------------------------------------------
// Normalize e-Leilões listing → ProviderListing
// ---------------------------------------------------------------------------

function normalizeType(titulo: string, descricao: string): NormalizedPropertyType {
  const text = (titulo + ' ' + descricao).toLowerCase()
  if (text.includes('moradia') || text.includes('vivenda') || text.includes('villa')) return 'villa'
  if (text.includes('apartamento') || text.includes('flat') || text.includes('t1') ||
      text.includes('t2') || text.includes('t3') || text.includes('t4')) return 'apartment'
  if (text.includes('terreno') || text.includes('lote') || text.includes('plot')) return 'land'
  if (text.includes('comercial') || text.includes('loja') || text.includes('armazém')) return 'commercial'
  if (text.includes('escritório') || text.includes('office')) return 'office'
  if (text.includes('prédio') || text.includes('edificio')) return 'development_plot'
  return 'other'
}

function normalize(l: EleiloesListing): ProviderListing {
  const zone = resolvePropertyZone({ address: l.localizacao, city: l.cidade })

  return {
    provider:            'eleiloes',
    provider_listing_id: l.id,
    source_confidence:   PROVIDER_CONFIDENCE.eleiloes,
    source_url:          l.url,

    title:       l.titulo,
    price:       l.valorBase,  // base auction price (NOT market value)
    area_m2:     l.areaM2 ?? null,
    type:        normalizeType(l.titulo, l.descricao),
    status:      'auction' as const,

    address:     l.localizacao,
    zone,
    city:        l.cidade,

    description: l.descricao || null,
    photos:      [],
    features:    [],
    has_floorplan: false,
    has_video:     false,
    num_photos:    0,

    // Auction-specific fields
    auction_end_date:   l.dataEncerramento || null,
    auction_base_price: l.valorBase,
    auction_min_bid:    l.valorMinimoLicitacao,

    scraped_at: new Date().toISOString(),
  }
}

// ---------------------------------------------------------------------------
// Bank Listings Provider Adapter
// ---------------------------------------------------------------------------

export const bankListingsAdapter: ProviderAdapter = {
  name:       'eleiloes',
  confidence: PROVIDER_CONFIDENCE.eleiloes,

  // Always configured — no API keys needed
  isConfigured: () => true,

  async fetchListings(params: ProviderFetchParams = {}): Promise<ProviderListing[]> {
    const limit = params.limit ?? 100
    const all: ProviderListing[] = []

    // Fetch judicial auctions (e-leiloes.pt)
    const pages = Math.ceil(limit / 20)
    for (let page = 1; page <= pages && all.length < limit; page++) {
      const listings = await fetchEleiloesListings(page)
      if (listings.length === 0) break

      for (const l of listings) {
        // Filter by city if requested
        if (params.city && !l.cidade.toLowerCase().includes(params.city.toLowerCase())) {
          continue
        }
        // Filter by price if requested
        if (params.minPrice && l.valorBase < params.minPrice) continue
        if (params.maxPrice && l.valorBase > params.maxPrice) continue

        all.push(normalize(l))
        if (all.length >= limit) break
      }
    }

    // Also fetch fiscal auctions (Portal das Finanças)
    if (all.length < limit) {
      const taxListings = await fetchLeiloesTaxListings()
      for (const l of taxListings) {
        if (all.length >= limit) break
        all.push(normalize(l))
      }
    }

    return all
  },
}
