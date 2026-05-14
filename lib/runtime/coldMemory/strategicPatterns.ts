// AGENCY GROUP — SH-ROS coldMemory: strategicPatterns | AMI: 22506
// Strategic pattern extraction — win/loss, velocity, revenue, risk, seasonality
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

// ─── Types ────────────────────────────────────────────────────────────────────

export type PatternType = 'conversion' | 'velocity' | 'revenue' | 'risk' | 'seasonality'

export interface StrategicPattern {
  id: string
  pattern_type: PatternType
  description: string
  confidence: number
  frequency: number
  impact_eur: number
  evidence: Record<string, unknown>
  discovered_at: string
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export class StrategicPatternEngine {
  /**
   * Extract all strategic patterns from data over a rolling period.
   * Runs all pattern detectors and persists results.
   */
  async extractPatterns(
    org_id: string,
    period_days = 90
  ): Promise<StrategicPattern[]> {
    const from = new Date(Date.now() - period_days * 86_400_000).toISOString()

    const [deals, contacts] = await Promise.all([
      sb
        .from('deals')
        .select('id, stage, status, value_eur, source, assigned_to, created_at, updated_at')
        .eq('org_id', org_id)
        .gte('created_at', from)
        .limit(1000),
      sb
        .from('contacts')
        .select('id, lead_score, status, source, created_at')
        .eq('org_id', org_id)
        .gte('created_at', from)
        .limit(1000),
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dealsData: any[] = deals.data ?? []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contactsData: any[] = contacts.data ?? []

    const patterns: StrategicPattern[] = []
    const now = new Date().toISOString()

    // ─── Conversion pattern ──────────────────────────────────────────────────
    const totalDeals = dealsData.length
    const closedWon = dealsData.filter((d) => d.status === 'closed_won').length
    const closedLost = dealsData.filter((d) => d.status === 'closed_lost').length

    if (totalDeals > 0) {
      const convRate = closedWon / totalDeals
      const lossRate = closedLost / totalDeals

      // Source analysis
      const sourceConversions: Record<string, { won: number; total: number }> = {}
      for (const deal of dealsData) {
        const src = (deal.source as string) ?? 'unknown'
        if (!sourceConversions[src]) sourceConversions[src] = { won: 0, total: 0 }
        sourceConversions[src].total += 1
        if (deal.status === 'closed_won') sourceConversions[src].won += 1
      }

      const bestSource = Object.entries(sourceConversions).sort(
        (a, b) => (b[1].won / (b[1].total || 1)) - (a[1].won / (a[1].total || 1))
      )[0]

      if (bestSource && bestSource[1].total >= 5) {
        patterns.push({
          id: randomUUID(),
          pattern_type: 'conversion',
          description: `Source '${bestSource[0]}' converts at ${((bestSource[1].won / bestSource[1].total) * 100).toFixed(1)}% — ${Math.round((bestSource[1].won / bestSource[1].total - convRate) * 100)}pp above average`,
          confidence: Math.min(0.95, 0.5 + bestSource[1].total / 50),
          frequency: bestSource[1].total,
          impact_eur: closedWon > 0
            ? (dealsData
                .filter((d) => d.source === bestSource[0] && d.status === 'closed_won')
                .reduce((s, d) => s + ((d.value_eur as number) ?? 0), 0))
            : 0,
          evidence: {
            source: bestSource[0],
            conversion_rate: bestSource[1].won / bestSource[1].total,
            global_rate: convRate,
            loss_rate: lossRate,
          },
          discovered_at: now,
        })
      }
    }

    // ─── Revenue pattern ─────────────────────────────────────────────────────
    const wonDeals = dealsData.filter((d) => d.status === 'closed_won')
    if (wonDeals.length >= 3) {
      const values = wonDeals.map((d) => (d.value_eur as number) ?? 0)
      const avg = values.reduce((s, v) => s + v, 0) / values.length
      const max = Math.max(...values)
      const min = Math.min(...values)

      // Check concentration: top 20% of deals by value
      const sorted = [...values].sort((a, b) => b - a)
      const top20Count = Math.max(1, Math.floor(sorted.length * 0.2))
      const top20Revenue = sorted.slice(0, top20Count).reduce((s, v) => s + v, 0)
      const total_revenue = sorted.reduce((s, v) => s + v, 0)
      const concentration = total_revenue > 0 ? top20Revenue / total_revenue : 0

      if (concentration > 0.6) {
        patterns.push({
          id: randomUUID(),
          pattern_type: 'revenue',
          description: `Top ${top20Count} deal${top20Count > 1 ? 's' : ''} account for ${(concentration * 100).toFixed(0)}% of revenue — high concentration risk`,
          confidence: Math.min(0.9, 0.5 + wonDeals.length / 20),
          frequency: wonDeals.length,
          impact_eur: total_revenue,
          evidence: { avg, max, min, concentration, top20Count, total_revenue },
          discovered_at: now,
        })
      }
    }

    // ─── Velocity pattern ────────────────────────────────────────────────────
    const closedDeals = dealsData.filter(
      (d) => d.status === 'closed_won' || d.status === 'closed_lost'
    )
    if (closedDeals.length >= 5) {
      const cycle_times = closedDeals
        .map((d) => {
          const created = new Date(d.created_at as string).getTime()
          const closed = new Date(d.updated_at as string).getTime()
          return (closed - created) / 86_400_000
        })
        .filter((t) => t > 0)

      if (cycle_times.length > 0) {
        const avg_cycle = cycle_times.reduce((s, t) => s + t, 0) / cycle_times.length
        const fast = cycle_times.filter((t) => t < avg_cycle * 0.5).length
        const slow = cycle_times.filter((t) => t > avg_cycle * 2).length

        if (slow > cycle_times.length * 0.2) {
          patterns.push({
            id: randomUUID(),
            pattern_type: 'velocity',
            description: `${slow} deals (${((slow / cycle_times.length) * 100).toFixed(0)}%) take >2x avg cycle time of ${avg_cycle.toFixed(0)} days — pipeline drag detected`,
            confidence: Math.min(0.85, 0.4 + cycle_times.length / 30),
            frequency: slow,
            impact_eur: 0,
            evidence: { avg_cycle_days: avg_cycle, slow_deals: slow, fast_deals: fast },
            discovered_at: now,
          })
        }
      }
    }

    // ─── Risk pattern ────────────────────────────────────────────────────────
    const highValueAtRisk = dealsData.filter((d) => {
      const value = (d.value_eur as number) ?? 0
      const isStalled = d.status === 'active' && d.stage !== 'closed_won'
      return isStalled && value > 500_000
    })

    if (highValueAtRisk.length > 0) {
      const total_at_risk = highValueAtRisk.reduce(
        (s, d) => s + ((d.value_eur as number) ?? 0),
        0
      )
      patterns.push({
        id: randomUUID(),
        pattern_type: 'risk',
        description: `${highValueAtRisk.length} high-value deal${highValueAtRisk.length > 1 ? 's' : ''} (>€500K) active but not progressing — €${(total_at_risk / 1_000_000).toFixed(2)}M at risk`,
        confidence: 0.8,
        frequency: highValueAtRisk.length,
        impact_eur: total_at_risk,
        evidence: {
          deal_ids: highValueAtRisk.map((d) => d.id).slice(0, 10),
          total_at_risk,
        },
        discovered_at: now,
      })
    }

    // ─── Seasonality pattern ─────────────────────────────────────────────────
    const monthlyVolume: Record<number, number> = {}
    for (const deal of dealsData) {
      const month = new Date(deal.created_at as string).getMonth()
      monthlyVolume[month] = (monthlyVolume[month] ?? 0) + 1
    }

    const monthEntries = Object.entries(monthlyVolume)
    if (monthEntries.length >= 3) {
      const volumes = monthEntries.map(([, v]) => v)
      const avg_volume = volumes.reduce((s, v) => s + v, 0) / volumes.length
      const peakEntry = monthEntries.sort((a, b) => Number(b[1]) - Number(a[1]))[0]
      const peak_month = Number(peakEntry[0])
      const peak_volume = Number(peakEntry[1])

      if (peak_volume > avg_volume * 1.5) {
        const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
        patterns.push({
          id: randomUUID(),
          pattern_type: 'seasonality',
          description: `${MONTHS[peak_month]} shows ${((peak_volume / avg_volume - 1) * 100).toFixed(0)}% above-average deal volume — seasonal peak opportunity`,
          confidence: Math.min(0.75, 0.3 + monthEntries.length / 12),
          frequency: peak_volume,
          impact_eur: 0,
          evidence: { peak_month: MONTHS[peak_month], peak_volume, avg_volume, monthly_volume: monthlyVolume },
          discovered_at: now,
        })
      }
    }

    // Persist all patterns
    for (const pattern of patterns) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin.from('learning_events') as any).insert({
        event_type: 'strategic_pattern',
        org_id,
        metadata: { ...pattern, org_id },
        created_at: pattern.discovered_at,
      })
    }

    logger.info('[StrategicPatternEngine] Patterns extracted', {
      org_id,
      count: patterns.length,
      period_days,
    })

    return patterns
  }

  /**
   * Get the top N patterns for an org from stored history.
   */
  async getTopPatterns(org_id: string, limit = 10): Promise<StrategicPattern[]> {
    const { data, error } = await sb
      .from('learning_events')
      .select('metadata, created_at')
      .eq('event_type', 'strategic_pattern')
      .eq('org_id', org_id)
      .order('created_at', { ascending: false })
      .limit(limit * 3) // Over-fetch so we can de-dup by type

    if (error || !data) {
      return []
    }

    // Return most recent per pattern_type, up to limit
    const seen = new Set<string>()
    const results: StrategicPattern[] = []

    for (const row of data) {
      const meta = row.metadata as Record<string, unknown>
      const type = meta['pattern_type'] as string
      if (!seen.has(type)) {
        seen.add(type)
        results.push({
          id: meta['id'] as string,
          pattern_type: meta['pattern_type'] as PatternType,
          description: meta['description'] as string,
          confidence: meta['confidence'] as number,
          frequency: meta['frequency'] as number,
          impact_eur: meta['impact_eur'] as number,
          evidence: (meta['evidence'] as Record<string, unknown>) ?? {},
          discovered_at: meta['discovered_at'] as string,
        })
      }
      if (results.length >= limit) break
    }

    return results
  }
}

export const strategicPatternEngine = new StrategicPatternEngine()
