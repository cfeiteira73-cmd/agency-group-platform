// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import { supabaseAdmin } from '@/lib/supabase'

const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

export interface ListingPattern {
  pattern_id: string
  feature: string
  avg_inquiry_rate: number
  avg_days_to_inquiry: number
  conversion_lift: number
  sample_count: number
  last_updated: Date
}

export interface LearningInsights {
  top_converting_features: ListingPattern[]
  underperforming_patterns: string[]
  recommended_improvements: string[]
  model_confidence: number
  based_on_listings: number
}

const MIN_LISTINGS_FOR_INSIGHTS = 10
const BASELINE_INQUIRY_RATE = 5 // inquiries per 100 views

interface IntelligenceRow {
  submission_id: string
  luxury_score: number
  homepage_placement_score: number
  investor_attractiveness: number
  demand_score: number
  has_sea_view?: boolean
  has_pool?: boolean
  pricing_competitiveness?: number
}

interface PerfRow {
  submission_id: string
  inquiries: number
  clicks: number
}

class ConversionLearningEngine {
  private static instance: ConversionLearningEngine

  private constructor() {}

  static getInstance(): ConversionLearningEngine {
    if (!ConversionLearningEngine.instance) {
      ConversionLearningEngine.instance = new ConversionLearningEngine()
    }
    return ConversionLearningEngine.instance
  }

  private async fetchIntelligence(orgId: string): Promise<IntelligenceRow[]> {
    const q = (sb.from('property_ai_intelligence') as {
      select: (cols: string) => {
        eq: (col: string, val: string) => Promise<{ data: IntelligenceRow[] | null; error: unknown }>
      }
    })
      .select('submission_id, luxury_score, homepage_placement_score, investor_attractiveness, demand_score, has_sea_view, has_pool, pricing_competitiveness')
      .eq('org_id', orgId)

    const { data, error } = await q
    if (error) logger.error('[ConversionLearningEngine] intelligence fetch error', { orgId, error })
    return data ?? []
  }

  private async fetchPerformance(orgId: string): Promise<PerfRow[]> {
    const q = (sb.from('property_ai_performance_events') as {
      select: (cols: string) => {
        eq: (col: string, val: string) => Promise<{ data: PerfRow[] | null; error: unknown }>
      }
    })
      .select('submission_id, inquiries, clicks')
      .eq('org_id', orgId)

    const { data, error } = await q
    if (error) logger.error('[ConversionLearningEngine] performance fetch error', { orgId, error })
    return data ?? []
  }

  private computeInquiryRate(perf: PerfRow): number {
    if (!perf.clicks || perf.clicks === 0) return 0
    return (perf.inquiries / perf.clicks) * 100
  }

  private detectFeatures(row: IntelligenceRow): string[] {
    const features: string[] = []
    if ((row.luxury_score ?? 0) > 80) features.push('luxury_score_>80')
    if ((row.luxury_score ?? 0) > 60 && (row.luxury_score ?? 0) <= 80) features.push('luxury_score_60-80')
    if (row.has_sea_view) features.push('has_sea_view')
    if (row.has_pool) features.push('has_pool')
    if ((row.investor_attractiveness ?? 0) > 75) features.push('high_investor_attractiveness')
    if ((row.pricing_competitiveness ?? 0) > 80) features.push('price_below_market')
    if ((row.demand_score ?? 0) > 80) features.push('high_demand_score')
    return features
  }

  async computeInsights(orgId: string): Promise<LearningInsights> {
    const [intel, perf] = await Promise.all([
      this.fetchIntelligence(orgId),
      this.fetchPerformance(orgId),
    ])

    const totalListings = intel.length

    if (totalListings < MIN_LISTINGS_FOR_INSIGHTS) {
      logger.warn('[ConversionLearningEngine] insufficient data', { orgId, totalListings })
      return {
        top_converting_features: [],
        underperforming_patterns: [],
        recommended_improvements: ['Adicionar mais imóveis para gerar insights (mínimo 10)'],
        model_confidence: 0.1,
        based_on_listings: totalListings,
      }
    }

    const perfMap = new Map<string, PerfRow>(perf.map((p) => [p.submission_id, p]))

    // Group inquiry rates by feature
    const featureStats: Record<string, { totalRate: number; count: number; totalDays: number }> = {}

    for (const row of intel) {
      const p = perfMap.get(row.submission_id)
      const rate = p ? this.computeInquiryRate(p) : 0
      const features = this.detectFeatures(row)

      for (const feature of features) {
        if (!featureStats[feature]) featureStats[feature] = { totalRate: 0, count: 0, totalDays: 0 }
        featureStats[feature].totalRate += rate
        featureStats[feature].count += 1
        featureStats[feature].totalDays += 7 // default 7 days to first inquiry (placeholder)
      }
    }

    const patterns: ListingPattern[] = Object.entries(featureStats).map(([feature, stats]) => {
      const avgRate = stats.count > 0 ? stats.totalRate / stats.count : 0
      const lift = BASELINE_INQUIRY_RATE > 0 ? (avgRate - BASELINE_INQUIRY_RATE) / BASELINE_INQUIRY_RATE : 0
      return {
        pattern_id: crypto.randomUUID(),
        feature,
        avg_inquiry_rate: Math.round(avgRate * 100) / 100,
        avg_days_to_inquiry: Math.round(stats.totalDays / Math.max(1, stats.count)),
        conversion_lift: Math.round(lift * 100) / 100,
        sample_count: stats.count,
        last_updated: new Date(),
      }
    })

    patterns.sort((a, b) => b.conversion_lift - a.conversion_lift)

    const topFeatures = patterns.filter((p) => p.conversion_lift > 0).slice(0, 5)
    const underperforming = patterns.filter((p) => p.conversion_lift < -0.1).map((p) => p.feature)

    const recommendations: string[] = []
    if (topFeatures.some((f) => f.feature === 'has_sea_view')) {
      recommendations.push('Destacar vista mar no título e primeiras fotos')
    }
    if (topFeatures.some((f) => f.feature === 'price_below_market')) {
      recommendations.push('Comunicar vantagem de preço vs. mercado')
    }
    if (underperforming.includes('luxury_score_60-80')) {
      recommendations.push('Reposicionar imóveis mid-luxury com copy mais aspiracional')
    }
    if (recommendations.length === 0) {
      recommendations.push('Continuar estratégia atual — desempenho acima do baseline')
    }

    const topFeature = topFeatures[0]?.feature ?? 'n/a'
    const confidence = Math.min(0.95, 0.4 + (totalListings / 100) * 0.55)

    logger.info('[ConversionLearningEngine] computed insights', {
      orgId,
      top_feature: topFeature,
      model_confidence: Math.round(confidence * 100) / 100,
    })

    return {
      top_converting_features: topFeatures,
      underperforming_patterns: underperforming,
      recommended_improvements: recommendations,
      model_confidence: Math.round(confidence * 100) / 100,
      based_on_listings: totalListings,
    }
  }
}

export const conversionLearningEngine = ConversionLearningEngine.getInstance()
