// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import { supabaseAdmin } from '@/lib/supabase'
import type { DistributionChannel, ListingLanguage } from '@/lib/property-ai/types'

const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

export interface HomepageSlot {
  slot_id: string
  submission_id: string
  position: number
  placement_type: 'hero' | 'featured' | 'premium' | 'standard'
  ranking_score: number
  geo_relevance: number
  budget_affinity: number
  luxury_intent_match: number
  ctr_estimate: number
  rotation_bucket: 'A' | 'B' | 'C'
}

export interface HomepageRanking {
  ranking_id: string
  org_id: string
  hero_submission_id?: string
  featured_slots: HomepageSlot[]
  premium_slots: HomepageSlot[]
  standard_slots: HomepageSlot[]
  generated_at: Date
  valid_until: Date
}

interface VisitorContext {
  region?: string
  budget_min?: number
  budget_max?: number
  luxury_intent?: boolean
}

interface CacheEntry {
  ranking: HomepageRanking
  expires_at: number
}

interface IntelligenceRow {
  submission_id: string
  homepage_placement_score: number
  luxury_visibility_score: number
  investor_attractiveness: number
  demand_score: number
  location?: { city?: string; region?: string }
  estimated_price_eur?: number
}

const CACHE_TTL_MS = 15 * 60 * 1000
const ROTATION_INTERVAL_MS = 8 * 60 * 60 * 1000
const BUCKETS: Array<'A' | 'B' | 'C'> = ['A', 'B', 'C']

class HomepageRankingEngine {
  private static instance: HomepageRankingEngine
  private cache = new Map<string, CacheEntry>()
  private rotationStart = Date.now()

  private constructor() {}

  static getInstance(): HomepageRankingEngine {
    if (!HomepageRankingEngine.instance) {
      HomepageRankingEngine.instance = new HomepageRankingEngine()
    }
    return HomepageRankingEngine.instance
  }

  private currentRotationBucket(): 'A' | 'B' | 'C' {
    const elapsed = Date.now() - this.rotationStart
    const idx = Math.floor(elapsed / ROTATION_INTERVAL_MS) % 3
    return BUCKETS[idx]
  }

  private computeGeoRelevance(row: IntelligenceRow, region?: string): number {
    if (!region) return 0.5
    const rowRegion = (row.location?.region ?? row.location?.city ?? '').toLowerCase()
    return rowRegion.includes(region.toLowerCase()) ? 1.0 : 0.3
  }

  private computeBudgetAffinity(row: IntelligenceRow, budgetMin?: number, budgetMax?: number): number {
    if (budgetMin === undefined && budgetMax === undefined) return 0.5
    const price = row.estimated_price_eur ?? 0
    if (price === 0) return 0.5
    const min = budgetMin ?? 0
    const max = budgetMax ?? Infinity
    if (price >= min && price <= max) return 1.0
    const distance = price < min ? (min - price) / min : (price - max) / max
    return Math.max(0, 1.0 - distance)
  }

  private assignPlacementType(position: number): 'hero' | 'featured' | 'premium' | 'standard' {
    if (position === 1) return 'hero'
    if (position <= 3) return 'featured'
    if (position <= 8) return 'premium'
    return 'standard'
  }

  async rank(orgId: string, visitorContext?: VisitorContext): Promise<HomepageRanking> {
    const cacheKey = `${orgId}:${JSON.stringify(visitorContext ?? {})}`
    const cached = this.cache.get(cacheKey)
    if (cached && Date.now() < cached.expires_at) {
      return cached.ranking
    }

    const query = (sb.from('property_ai_intelligence') as {
      select: (cols: string) => {
        eq: (col: string, val: string) => {
          gt: (col: string, val: number) => Promise<{ data: IntelligenceRow[] | null; error: unknown }>
        }
      }
    })
      .select('submission_id, homepage_placement_score, luxury_visibility_score, investor_attractiveness, demand_score, location, estimated_price_eur')
      .eq('org_id', orgId)
      .gt('homepage_placement_score', 0)

    const { data, error } = await query
    if (error) {
      logger.error('[HomepageRankingEngine] fetch error', { orgId, error })
    }

    const rows: IntelligenceRow[] = data ?? []
    const bucket = this.currentRotationBucket()

    const scored = rows.map((row) => {
      const geo = this.computeGeoRelevance(row, visitorContext?.region)
      const budget = this.computeBudgetAffinity(row, visitorContext?.budget_min, visitorContext?.budget_max)
      const luxuryBoost = visitorContext?.luxury_intent ? row.luxury_visibility_score / 100 : 0.5

      const baseScore = row.homepage_placement_score
      const boosted =
        baseScore +
        geo * 20 +
        budget * 15 +
        luxuryBoost * 15

      return {
        row,
        geo,
        budget,
        luxuryBoost,
        finalScore: Math.min(100, boosted),
      }
    })

    scored.sort((a, b) => b.finalScore - a.finalScore)

    const slots: HomepageSlot[] = scored.map((s, i) => ({
      slot_id: crypto.randomUUID(),
      submission_id: s.row.submission_id,
      position: i + 1,
      placement_type: this.assignPlacementType(i + 1),
      ranking_score: Math.round(s.finalScore * 100) / 100,
      geo_relevance: Math.round(s.geo * 100) / 100,
      budget_affinity: Math.round(s.budget * 100) / 100,
      luxury_intent_match: Math.round(s.luxuryBoost * 100) / 100,
      ctr_estimate: Math.round((s.finalScore / 100) * 0.08 * 1000) / 1000,
      rotation_bucket: bucket,
    }))

    const hero = slots.find((s) => s.placement_type === 'hero')
    const featured = slots.filter((s) => s.placement_type === 'featured')
    const premium = slots.filter((s) => s.placement_type === 'premium')
    const standard = slots.filter((s) => s.placement_type === 'standard')

    const now = new Date()
    const ranking: HomepageRanking = {
      ranking_id: crypto.randomUUID(),
      org_id: orgId,
      hero_submission_id: hero?.submission_id,
      featured_slots: featured,
      premium_slots: premium,
      standard_slots: standard,
      generated_at: now,
      valid_until: new Date(now.getTime() + CACHE_TTL_MS),
    }

    this.cache.set(cacheKey, { ranking, expires_at: now.getTime() + CACHE_TTL_MS })

    logger.info('[HomepageRankingEngine] ranked', {
      orgId,
      total_listings: rows.length,
      hero_submission_id: ranking.hero_submission_id ?? null,
    })

    return ranking
  }
}

export const homepageRankingEngine = HomepageRankingEngine.getInstance()
