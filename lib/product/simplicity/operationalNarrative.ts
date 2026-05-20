// AGENCY GROUP — SH-ROS | AMI: 22506
// Product Simplicity Layer: Operational Narrative Engine
// Converts raw pipeline numbers into a motivating, context-aware revenue story
// Portugal context: 18% close rate, 210-day avg cycle, €320K avg deal, 5% commission

import logger from '@/lib/logger'
import { COMMISSION_RATE } from '@/lib/constants/pipeline'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface NarrativeContext {
  active_deals: number
  pipeline_value_eur: number
  hot_leads: number
  close_rate: number          // 0-1
  daily_target_eur: number
  target_gap_eur: number      // negative = behind target
  deals_won_mtd: number
  commission_mtd_eur: number
}

export type NarrativeTone = 'excellent' | 'positive' | 'neutral' | 'urgent' | 'critical'

export interface Narrative {
  headline: string
  body: string
  tone: NarrativeTone
  call_to_action: string
  emoji: string
}

// ─── Tone Emoji Map ───────────────────────────────────────────────────────────

const TONE_EMOJI: Record<NarrativeTone, string> = {
  excellent: '🏆',
  positive: '📈',
  neutral: '📊',
  urgent: '⚡',
  critical: '🚨',
}

// ─── Class ────────────────────────────────────────────────────────────────────

class OperationalNarrativeEngine {
  generate(context: NarrativeContext, timeframe: 'daily' | 'weekly'): Narrative {
    const tone = this.getTone(context)
    const headline = this._buildHeadline(context, tone)
    const body = this._buildBody(context, timeframe)
    const call_to_action = this._buildCTA(tone, context)

    const narrative: Narrative = {
      headline,
      body,
      tone,
      call_to_action,
      emoji: TONE_EMOJI[tone],
    }

    logger.info('[OperationalNarrative] generate', {
      tone,
      timeframe,
      pipeline_value: context.pipeline_value_eur,
      target_gap: context.target_gap_eur,
    })

    return narrative
  }

  getTone(context: NarrativeContext): NarrativeTone {
    const gapRatio = context.daily_target_eur > 0
      ? context.target_gap_eur / context.daily_target_eur
      : 0

    if (context.deals_won_mtd >= 3 && gapRatio >= 0) return 'excellent'
    if (gapRatio >= 0 && context.hot_leads >= 3) return 'positive'
    if (gapRatio >= -0.2) return 'neutral'
    if (gapRatio >= -0.5) return 'urgent'
    return 'critical'
  }

  private _formatEur(value: number): string {
    if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
    if (value >= 1_000)     return `€${Math.round(value / 1000)}K`
    return `€${value.toFixed(0)}`
  }

  private _buildHeadline(context: NarrativeContext, tone: NarrativeTone): string {
    const pipelineStr = this._formatEur(context.pipeline_value_eur)
    const gapAbs = Math.abs(context.target_gap_eur)
    const gapStr = this._formatEur(gapAbs)

    switch (tone) {
      case 'excellent':
        return `Outstanding — ${context.deals_won_mtd} deals closed, ${pipelineStr} pipeline strong`
      case 'positive':
        return `On track — ${context.hot_leads} hot leads and ${pipelineStr} in play`
      case 'neutral':
        return `Steady — ${context.active_deals} active deals, ${pipelineStr} pipeline`
      case 'urgent':
        return `${gapStr} behind target — act today to recover`
      case 'critical':
        return `Critical — ${gapStr} gap to target, immediate action required`
    }
  }

  private _buildBody(context: NarrativeContext, timeframe: string): string {
    const commissionStr = this._formatEur(context.commission_mtd_eur)
    const pipelineStr = this._formatEur(context.pipeline_value_eur)
    const closeRatePct = Math.round(context.close_rate * 100)
    const expectedDeals = Math.round(context.active_deals * context.close_rate)
    const expectedRevenue = this._formatEur(expectedDeals * 320_000 * COMMISSION_RATE)

    if (timeframe === 'daily') {
      return (
        `Today you have ${context.hot_leads} hot lead${context.hot_leads !== 1 ? 's' : ''} requiring follow-up ` +
        `and ${context.active_deals} active deal${context.active_deals !== 1 ? 's' : ''} in progress. ` +
        `At your ${closeRatePct}% close rate, you can expect roughly ${expectedDeals} deal${expectedDeals !== 1 ? 's' : ''} to close ` +
        `from your current pipeline — generating approximately ${expectedRevenue} in commission. ` +
        `Commission earned MTD: ${commissionStr}.`
      )
    }

    return (
      `This week you have ${pipelineStr} in the active pipeline across ${context.active_deals} deal${context.active_deals !== 1 ? 's' : ''}. ` +
      `With a ${closeRatePct}% close rate, projecting ${expectedDeals} close${expectedDeals !== 1 ? 's' : ''} generating ${expectedRevenue} commission. ` +
      `${context.hot_leads} lead${context.hot_leads !== 1 ? 's' : ''} are hot and need attention this week. ` +
      `Commission earned MTD: ${commissionStr}.`
    )
  }

  private _buildCTA(tone: NarrativeTone, context: NarrativeContext): string {
    switch (tone) {
      case 'excellent':
        return 'Maintain momentum — review next week\'s pipeline and book CPCV dates'
      case 'positive':
        return `Follow up ${context.hot_leads} hot lead${context.hot_leads !== 1 ? 's' : ''} now to keep deals moving`
      case 'neutral':
        return 'Review your pipeline for stale deals and schedule follow-ups'
      case 'urgent': {
        const gapStr = this._formatEur(Math.abs(context.target_gap_eur))
        return `Recover ${gapStr} gap — focus on the 2 deals closest to closing today`
      }
      case 'critical':
        return 'Immediate broker review required — escalate top 3 at-risk deals now'
    }
  }
}

export const operationalNarrativeEngine = new OperationalNarrativeEngine()
