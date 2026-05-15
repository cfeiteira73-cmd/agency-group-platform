// AGENCY GROUP — SH-ROS Ω∞∞ Operations: frictionDetector | AMI: 22506
// Identifies friction points — places where deals get stuck in the pipeline
// =============================================================================

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import logger from '@/lib/logger'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sb = supabaseAdmin as any

export interface FrictionPoint {
  id: string
  org_id: string
  location: string
  friction_type: 'stage_stall' | 'missing_action' | 'data_gap' | 'agent_gap' | 'manual_bottleneck'
  affected_deals: string[]
  avg_delay_days: number
  estimated_revenue_at_risk_eur: number
  occurrence_count: number
  first_detected: string
  suggested_fix: string
}

export class FrictionDetector {
  async detectFrictionPoints(
    org_id: string,
    period_days = 90
  ): Promise<FrictionPoint[]> {
    const from = new Date(Date.now() - period_days * 86_400_000).toISOString()
    const frictions: FrictionPoint[] = []
    const now = new Date().toISOString()

    const { data, error } = await sb
      .from('deals')
      .select('id, stage, status, value_eur, updated_at, created_at, assigned_to')
      .eq('org_id', org_id)
      .gte('created_at', from)
      .limit(500)

    if (error) {
      logger.error('[FrictionDetector] Query failed', { error, org_id })
      return []
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deals: any[] = data ?? []

    // Group by stage
    const byStage: Record<string, typeof deals> = {}
    for (const d of deals) {
      const stage = (d.stage as string) ?? 'unknown'
      if (!byStage[stage]) byStage[stage] = []
      byStage[stage].push(d)
    }

    // Per-stage stall detection
    for (const [stage, stageDeals] of Object.entries(byStage)) {
      const stalled = stageDeals.filter((d: any) => {
        const daysSinceUpdate =
          (Date.now() - new Date(d.updated_at as string).getTime()) / 86_400_000
        return daysSinceUpdate > 14 && d.status === 'active'
      })

      if (stalled.length >= 2) {
        const stalledDays = stalled.map((d: any) =>
          (Date.now() - new Date(d.updated_at as string).getTime()) / 86_400_000
        )
        const avg_delay = stalledDays.reduce((s: number, v: number) => s + v, 0) / stalled.length
        const at_risk = stalled.reduce((s: number, d: any) =>
          s + ((d.value_eur as number) ?? 0), 0)

        frictions.push({
          id: randomUUID(), org_id,
          location: `deal:${stage}`,
          friction_type: 'stage_stall',
          affected_deals: stalled.map((d: any) => d.id as string),
          avg_delay_days: Math.round(avg_delay * 10) / 10,
          estimated_revenue_at_risk_eur: Math.round(at_risk * 100) / 100,
          occurrence_count: stalled.length,
          first_detected: now,
          suggested_fix: `Automate stage advancement trigger for ${stage} — add 7-day follow-up nudge`,
        })
      }
    }

    // Missing assignment
    const unassigned = deals.filter((d: any) => !d.assigned_to && d.status === 'active')
    if (unassigned.length > 0) {
      frictions.push({
        id: randomUUID(), org_id,
        location: 'assignment:unassigned',
        friction_type: 'agent_gap',
        affected_deals: unassigned.map((d: any) => d.id as string),
        avg_delay_days: 0,
        estimated_revenue_at_risk_eur: unassigned.reduce(
          (s: number, d: any) => s + ((d.value_eur as number) ?? 0), 0
        ),
        occurrence_count: unassigned.length,
        first_detected: now,
        suggested_fix: 'Auto-assign unassigned deals via round-robin or EV-based routing',
      })
    }

    logger.info('[FrictionDetector] Detection complete', { org_id, frictions: frictions.length })
    return frictions
  }

  async getCriticalFrictionPoints(org_id: string): Promise<FrictionPoint[]> {
    const all = await this.detectFrictionPoints(org_id)
    return all
      .filter((f) => f.estimated_revenue_at_risk_eur > 500_000)
      .sort((a, b) => b.estimated_revenue_at_risk_eur - a.estimated_revenue_at_risk_eur)
  }
}

export const frictionDetector = new FrictionDetector()
