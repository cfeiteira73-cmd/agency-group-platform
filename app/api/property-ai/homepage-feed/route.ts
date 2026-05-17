// AGENCY GROUP — SH-ROS Property AI | AMI: 22506
// GET /api/property-ai/homepage-feed
// Public endpoint — returns ranked live AI-processed listings for the homepage.
// No auth required. Cached at CDN layer (s-maxage=900).
// Node.js runtime — uses supabaseAdmin (not compatible with Edge).
// =============================================================================

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/observability/logger'

export const runtime = 'nodejs'
export const maxDuration = 15

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SubmissionRow {
  submission_id: string
  status: string
  created_at: string
}

interface ListingRow {
  submission_id: string
  titles: Record<string, string> | null
  estimated_price_eur: number | null
  price_per_sqm: number | null
  confidence: number | null
}

interface AnalysisRow {
  submission_id: string
  property_type: string | null
  bedrooms: number | null
  bathrooms: number | null
  area_sqm: number | null
  has_pool: boolean
  has_sea_view: boolean
  has_golf_view: boolean
  has_city_view: boolean
  has_parking: boolean
  has_elevator: boolean
  energy_class: string | null
  luxury_score: number
  location: {
    city?: string
    neighborhood?: string
    zone?: string
    region?: string
  } | null
}

interface IntelligenceRow {
  submission_id: string
  homepage_placement_score: number
  demand_score: number
  listing_readiness_score: number
}

interface MediaRow {
  submission_id: string
  url: string
  hero_crop_url: string | null
  thumbnail_url: string | null
  is_cover: boolean
  aesthetic_score: number
}

export interface HomepageFeedItem {
  id: string
  feat: boolean
  badge: 'b-new' | 'b-off' | 'b-exc' | null
  bl: string | null
  zona: string
  zonaLabel: string
  tipo: string
  titulo: string
  specs: string[]
  preco: number
  precoLabel: string
  pm2: string
  quartos: number
  grad: string
  photo: string
  submission_id: string
  placement_score: number
  demand_score: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

function formatPrice(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000
    return `€ ${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`
  }
  return `€ ${new Intl.NumberFormat('pt-PT').format(n)}`
}

function formatPricePerSqm(pricePerSqm: number | null, price: number | null, area: number | null): string {
  const ppm = pricePerSqm ?? (price && area && area > 0 ? Math.round(price / area) : null)
  if (!ppm) return ''
  return `€${new Intl.NumberFormat('pt-PT').format(ppm)}/m²`
}

function propertyTypeLabel(type: string | null): string {
  const map: Record<string, string> = {
    apartment: 'Apartamento',
    villa: 'Villa',
    townhouse: 'Moradia',
    penthouse: 'Penthouse',
    studio: 'Estúdio',
    commercial: 'Comercial',
    land: 'Terreno',
    garage: 'Garagem',
  }
  return type ? (map[type] ?? 'Imóvel') : 'Imóvel'
}

function buildSpecs(a: AnalysisRow): string[] {
  const specs: string[] = []
  if (a.bedrooms) specs.push(`${a.bedrooms} Quarto${a.bedrooms !== 1 ? 's' : ''}`)
  if (a.bathrooms) specs.push(`${a.bathrooms} WC`)
  if (a.area_sqm) specs.push(`${a.area_sqm} m²`)
  if (a.has_pool) specs.push('Piscina')
  if (a.has_sea_view) specs.push('Vista Mar')
  if (a.has_golf_view) specs.push('Vista Golf')
  if (a.has_city_view) specs.push('Vista Cidade')
  if (a.energy_class && a.energy_class !== 'unknown') specs.push(`EPC ${a.energy_class}`)
  return specs.slice(0, 5) // cap at 5
}

function buildZoneLabel(loc: AnalysisRow['location']): { zona: string; zonaLabel: string } {
  const city = loc?.city ?? 'Portugal'
  const neighborhood = loc?.neighborhood ?? loc?.zone ?? ''
  return {
    zona: city,
    zonaLabel: neighborhood ? `${city} · ${neighborhood}` : city,
  }
}

// Zone-based gradient colours — matches site palette
function buildGradient(city: string): string {
  const city_l = city.toLowerCase()
  if (city_l.includes('cascais') || city_l.includes('sintra') || city_l.includes('estoril')) {
    return 'linear-gradient(145deg,#1c3d28,#0b1a10 55%,#3d8b68 100%)'
  }
  if (city_l.includes('lisboa') || city_l.includes('lisbon')) {
    return 'linear-gradient(145deg,#0c2030,#060e18 60%,#1c4a35 100%)'
  }
  if (city_l.includes('comporta') || city_l.includes('alentejo') || city_l.includes('grândola')) {
    return 'linear-gradient(145deg,#2e2009,#140e05 60%,#c9a96e 100%)'
  }
  if (city_l.includes('porto') || city_l.includes('gaia') || city_l.includes('matosinhos')) {
    return 'linear-gradient(145deg,#1a2a3a,#0a1220 60%,#2d5a7a 100%)'
  }
  if (city_l.includes('algarve') || city_l.includes('albufeira') || city_l.includes('vilamoura') || city_l.includes('faro') || city_l.includes('loulé')) {
    return 'linear-gradient(145deg,#1a2a10,#0a1505 60%,#4a8a30 100%)'
  }
  if (city_l.includes('madeira') || city_l.includes('funchal')) {
    return 'linear-gradient(145deg,#1a0a1a,#0a050a 60%,#6a2a8a 100%)'
  }
  if (city_l.includes('ericeira') || city_l.includes('peniche') || city_l.includes('óbidos')) {
    return 'linear-gradient(145deg,#081e1e,#040f0f 60%,#1c4a35 100%)'
  }
  // Default — deep forest green
  return 'linear-gradient(145deg,#0c1f15,#060f0a 60%,#1c4a35 100%)'
}

function buildBadge(row: SubmissionRow, luxuryScore: number): { badge: HomepageFeedItem['badge']; bl: string | null } {
  const ageMs = Date.now() - new Date(row.created_at).getTime()
  const ageDays = ageMs / (1000 * 60 * 60 * 24)
  if (ageDays <= 7) return { badge: 'b-new', bl: 'Novo' }
  if (luxuryScore >= 80) return { badge: 'b-exc', bl: 'Exclusivo' }
  if (luxuryScore >= 60) return { badge: 'b-off', bl: 'Off-Market' }
  return { badge: null, bl: null }
}

// ---------------------------------------------------------------------------
// Main fetch logic
// ---------------------------------------------------------------------------

async function fetchLiveSubmissions(): Promise<SubmissionRow[]> {
  const t = sb.from('property_ai_submissions') as {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        order: (col: string, opts: { ascending: boolean }) => {
          limit: (n: number) => Promise<{ data: SubmissionRow[] | null; error: unknown }>
        }
      }
    }
  }
  const { data, error } = await t
    .select('submission_id, status, created_at')
    .eq('status', 'live')
    .order('created_at', { ascending: false })
    .limit(50) // fetch up to 50, rank, return top 12

  if (error) {
    logger.error('[homepage-feed] fetch submissions error', { error })
    return []
  }
  return data ?? []
}

async function fetchListings(submissionIds: string[]): Promise<ListingRow[]> {
  if (submissionIds.length === 0) return []
  const t = sb.from('property_ai_listings') as {
    select: (cols: string) => {
      in: (col: string, vals: string[]) => Promise<{ data: ListingRow[] | null; error: unknown }>
    }
  }
  const { data, error } = await t
    .select('submission_id, titles, estimated_price_eur, price_per_sqm, confidence')
    .in('submission_id', submissionIds)

  if (error) logger.error('[homepage-feed] fetch listings error', { error })
  return data ?? []
}

async function fetchAnalyses(submissionIds: string[]): Promise<AnalysisRow[]> {
  if (submissionIds.length === 0) return []
  const t = sb.from('property_ai_analysis') as {
    select: (cols: string) => {
      in: (col: string, vals: string[]) => Promise<{ data: AnalysisRow[] | null; error: unknown }>
    }
  }
  const { data, error } = await t
    .select('submission_id, property_type, bedrooms, bathrooms, area_sqm, has_pool, has_sea_view, has_golf_view, has_city_view, has_parking, has_elevator, energy_class, luxury_score, location')
    .in('submission_id', submissionIds)

  if (error) logger.error('[homepage-feed] fetch analyses error', { error })
  return (data ?? []).map(row => ({
    ...row,
    has_pool: Boolean(row.has_pool),
    has_sea_view: Boolean(row.has_sea_view),
    has_golf_view: Boolean(row.has_golf_view),
    has_city_view: Boolean(row.has_city_view),
    has_parking: Boolean(row.has_parking),
    has_elevator: Boolean(row.has_elevator),
    luxury_score: Number(row.luxury_score ?? 0),
  }))
}

async function fetchIntelligence(submissionIds: string[]): Promise<IntelligenceRow[]> {
  if (submissionIds.length === 0) return []
  const t = sb.from('property_ai_intelligence') as {
    select: (cols: string) => {
      in: (col: string, vals: string[]) => Promise<{ data: IntelligenceRow[] | null; error: unknown }>
    }
  }
  const { data, error } = await t
    .select('submission_id, homepage_placement_score, demand_score, listing_readiness_score')
    .in('submission_id', submissionIds)

  if (error) logger.error('[homepage-feed] fetch intelligence error', { error })
  return (data ?? []).map(row => ({
    ...row,
    homepage_placement_score: Number(row.homepage_placement_score ?? 0),
    demand_score: Number(row.demand_score ?? 0),
    listing_readiness_score: Number(row.listing_readiness_score ?? 0),
  }))
}

async function fetchCoverMedia(submissionIds: string[]): Promise<MediaRow[]> {
  if (submissionIds.length === 0) return []
  const t = sb.from('property_ai_media') as {
    select: (cols: string) => {
      in: (col: string, vals: string[]) => {
        eq: (col: string, val: boolean) => {
          order: (col: string, opts: { ascending: boolean }) => Promise<{ data: MediaRow[] | null; error: unknown }>
        }
      }
    }
  }
  const { data, error } = await t
    .select('submission_id, url, hero_crop_url, thumbnail_url, is_cover, aesthetic_score')
    .in('submission_id', submissionIds)
    .eq('is_cover', true)
    .order('aesthetic_score', { ascending: false })

  if (error) logger.error('[homepage-feed] fetch media error', { error })
  return data ?? []
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(): Promise<NextResponse> {
  try {
    // 1. Fetch all live submissions
    const submissions = await fetchLiveSubmissions()

    if (submissions.length === 0) {
      return NextResponse.json(
        { items: [], source: 'live', count: 0 },
        {
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
          },
        }
      )
    }

    const ids = submissions.map(s => s.submission_id)

    // 2. Fetch all downstream data in parallel
    const [listings, analyses, intelligence, media] = await Promise.all([
      fetchListings(ids),
      fetchAnalyses(ids),
      fetchIntelligence(ids),
      fetchCoverMedia(ids),
    ])

    // 3. Build lookup maps for O(1) access
    const listingMap = new Map(listings.map(l => [l.submission_id, l]))
    const analysisMap = new Map(analyses.map(a => [a.submission_id, a]))
    const intelMap = new Map(intelligence.map(i => [i.submission_id, i]))
    const mediaMap = new Map(media.map(m => [m.submission_id, m]))

    // 4. Filter to submissions that have at least listing + analysis data
    const complete = submissions.filter(
      s => listingMap.has(s.submission_id) && analysisMap.has(s.submission_id)
    )

    // 5. Rank by homepage_placement_score DESC (with demand_score as tiebreaker)
    complete.sort((a, b) => {
      const ia = intelMap.get(a.submission_id)
      const ib = intelMap.get(b.submission_id)
      const scoreA = (ia?.homepage_placement_score ?? 0) * 100 + (ia?.demand_score ?? 0)
      const scoreB = (ib?.homepage_placement_score ?? 0) * 100 + (ib?.demand_score ?? 0)
      return scoreB - scoreA
    })

    // 6. Take top 12
    const top = complete.slice(0, 12)

    // 7. Map to HomepageFeedItem
    const items: HomepageFeedItem[] = top.map((sub, index) => {
      const listing = listingMap.get(sub.submission_id)!
      const analysis = analysisMap.get(sub.submission_id)
      const intel = intelMap.get(sub.submission_id)
      const coverMedia = mediaMap.get(sub.submission_id)

      const titles = listing.titles ?? {}
      const titulo = titles['pt'] ?? titles['en'] ?? titles['fr'] ?? 'Imóvel de Luxo'

      const preco = listing.estimated_price_eur ?? 0
      const area = analysis?.area_sqm ?? null
      const ppm = listing.price_per_sqm ?? (preco && area ? Math.round(preco / area) : null)

      const loc = analysis?.location ?? null
      const { zona, zonaLabel } = buildZoneLabel(loc)
      const { badge, bl } = buildBadge(sub, analysis?.luxury_score ?? 0)

      const photoUrl =
        coverMedia?.hero_crop_url ??
        coverMedia?.url ??
        '/hero-poster.jpg'

      return {
        id: sub.submission_id,
        feat: index === 0,
        badge,
        bl,
        zona,
        zonaLabel,
        tipo: propertyTypeLabel(analysis?.property_type ?? null),
        titulo,
        specs: analysis ? buildSpecs(analysis) : [],
        preco,
        precoLabel: preco > 0 ? formatPrice(preco) : 'Preço sob consulta',
        pm2: formatPricePerSqm(ppm, preco, area),
        quartos: analysis?.bedrooms ?? 0,
        grad: buildGradient(zona),
        photo: photoUrl,
        submission_id: sub.submission_id,
        placement_score: intel?.homepage_placement_score ?? 0,
        demand_score: intel?.demand_score ?? 0,
      }
    })

    logger.info('[homepage-feed] ranked feed generated', {
      total_live: submissions.length,
      complete: complete.length,
      returned: items.length,
    })

    return NextResponse.json(
      { items, source: 'live', count: items.length },
      {
        headers: {
          // CDN cache: 15 min fresh, serve stale for 60s while revalidating
          'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=60',
        },
      }
    )
  } catch (err) {
    logger.error('[homepage-feed] unhandled error', { err })
    // Return empty — component falls back to static PROPERTIES
    return NextResponse.json(
      { items: [], source: 'error', count: 0 },
      { status: 200 } // 200 so client-side doesn't throw, just uses fallback
    )
  }
}
