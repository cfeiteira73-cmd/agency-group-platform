// =============================================================================
// AGENCY GROUP — Growth Strategy Agent v1.0
// Analyses acquisition channels, referral conversion, zone activity, and CAC
// AMI: 22506 | SH-ROS Layer: strategy_analytics
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { BaseAgent } from '../base'
import type { AgentConfig, AgentContext, AgentInsight, AgentAction } from '../types'
import { COMMISSION_RATE } from '@/lib/constants/pipeline'

export class GrowthStrategyAgent extends BaseAgent {
  readonly id = 'growth-strategy' as const
  readonly name = 'Growth Strategy Agent'
  readonly description = 'Identifies top acquisition channels, referral conversion rate, zone hotspots, and CAC per source to rank growth opportunities by ROI'

  readonly config: AgentConfig = {
    rate_limit_per_hour:    4,
    max_retries:            2,
    timeout_ms:             2000,
    require_human_approval: false,
    can_send_comms:         false,
    layer:                  'strategy_analytics',
  }

  protected async execute(ctx: AgentContext): Promise<{ insights: AgentInsight[]; actions: AgentAction[]; metadata: Record<string, unknown> }> {
    const insights: AgentInsight[] = []
    const actions:  AgentAction[]  = []

    try {
      // 1. Contact source distribution — org isolation: pending migration 015 (contacts has no org_id column)
      const { data: contactSources } = await supabaseAdmin
        .from('contacts')
        .select('source, status')
        .not('source', 'is', null)
        .limit(50)

      const sourceCounts: Record<string, number> = {}
      const sourceConverted: Record<string, number> = {}
      for (const c of contactSources ?? []) {
        const src = c.source ?? 'unknown'
        sourceCounts[src] = (sourceCounts[src] ?? 0) + 1
        if (c.status === 'qualified' || c.status === 'client' || c.status === 'vip') {
          sourceConverted[src] = (sourceConverted[src] ?? 0) + 1
        }
      }

      const topSources = Object.entries(sourceCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)

      if (topSources.length > 0) {
        const [bestSource, bestCount] = topSources[0]
        const bestConvRate = bestCount > 0 ? (sourceConverted[bestSource] ?? 0) / bestCount : 0
        insights.push({
          type:               'top_acquisition_channel',
          summary:            `Canal de aquisição #1: "${bestSource}" com ${bestCount} contactos (taxa de conversão ${Math.round(bestConvRate * 100)}%)`,
          severity:           'info',
          confidence:         0.88,
          revenue_impact_eur: bestCount * bestConvRate * 15000,
          entity_type:        'acquisition_channel',
          entity_id:          null,
          evidence:           { source: bestSource, count: bestCount, conversion_rate: bestConvRate, top_5: topSources },
        })
      }

      // 2. Referral conversion rate — org isolation: pending migration 015 (referrals has no org_id column)
      const { data: referrals } = await supabaseAdmin
        .from('referrals')
        .select('id, source, deal_id, reward_triggered, organization_id')
        .limit(50)

      const totalReferrals   = referrals?.length ?? 0
      const convertedRefs    = (referrals ?? []).filter(r => r.deal_id || r.reward_triggered).length
      const referralConvRate = totalReferrals > 0 ? convertedRefs / totalReferrals : 0

      if (totalReferrals > 0) {
        insights.push({
          type:               'referral_conversion',
          summary:            `Taxa de conversão de referrals: ${Math.round(referralConvRate * 100)}% (${convertedRefs}/${totalReferrals})`,
          severity:           referralConvRate < 0.10 ? 'warning' : 'info',
          confidence:         0.85,
          revenue_impact_eur: convertedRefs * 25000 * COMMISSION_RATE,
          entity_type:        'referral_program',
          entity_id:          null,
          evidence:           { total: totalReferrals, converted: convertedRefs, rate: referralConvRate },
        })
        if (referralConvRate < 0.10) {
          actions.push({
            type:               'create_task',
            description:        `Optimizar programa de referrals: apenas ${Math.round(referralConvRate * 100)}% de conversão — rever incentivos`,
            entity_type:        'referral_program',
            entity_id:          null,
            payload:            { conversion_rate: referralConvRate, total_referrals: totalReferrals },
            risk:               'low',
            requires_approval:  false,
          })
        }
      }

      // Note: contacts table has no zone column — zone hotspot insight skipped

      // 4. CAC from growth_metrics
      const { data: growthMetrics } = await supabaseAdmin
        .from('growth_metrics')
        .select('week_start, new_leads, organic_leads, paid_leads, cac_eur')
        .or(`organization_id.is.null,organization_id.eq.${ctx.org_id}`)
        .not('cac_eur', 'is', null)
        .order('cac_eur', { ascending: true })
        .limit(10)

      if ((growthMetrics?.length ?? 0) > 0) {
        const bestCac   = growthMetrics![0]
        const worstCac  = growthMetrics![growthMetrics!.length - 1]
        insights.push({
          type:               'cac_analysis',
          summary:            `CAC mais baixo: €${bestCac.cac_eur} (semana ${bestCac.week_start}) — CAC mais alto: €${worstCac.cac_eur} (semana ${worstCac.week_start})`,
          severity:           'info',
          confidence:         0.80,
          revenue_impact_eur: ((worstCac.cac_eur as number) - (bestCac.cac_eur as number)) * 10,
          entity_type:        'growth_metrics',
          entity_id:          null,
          evidence:           { best_cac: bestCac.cac_eur, best_week: bestCac.week_start, worst_cac: worstCac.cac_eur, worst_week: worstCac.week_start },
        })
        actions.push({
          type:               'create_task',
          description:        `Optimizar CAC: semana com melhor CAC €${bestCac.cac_eur} vs pior €${worstCac.cac_eur} — rever alocação de budget`,
          entity_type:        'growth_metrics',
          entity_id:          null,
          payload:            { best_cac: bestCac.cac_eur, worst_cac: worstCac.cac_eur },
          risk:               'low',
          requires_approval:  false,
        })
      }

      if (insights.length === 0) {
        insights.push({
          type:               'growth_data_insufficient',
          summary:            'Dados insuficientes para análise de crescimento — adicionar campos source/zone aos contactos',
          severity:           'warning',
          confidence:         0.7,
          revenue_impact_eur: null,
          entity_type:        'system',
          entity_id:          null,
          evidence:           {},
        })
      }

      return {
        insights,
        actions,
        metadata: {
          org_id:               ctx.org_id,
          sources_analysed:     Object.keys(sourceCounts).length,
          top_source:           topSources[0]?.[0] ?? null,
          referral_conv_rate:   referralConvRate,
          growth_metrics_rows:  growthMetrics?.length ?? 0,
        },
      }
    } catch (err) {
      return {
        insights: [{
          type: 'agent_error', summary: `Erro ao analisar crescimento: ${String(err)}`,
          severity: 'warning', confidence: 1, revenue_impact_eur: null,
          entity_type: 'system', entity_id: null, evidence: {},
        }],
        actions: [],
        metadata: { org_id: ctx.org_id },
      }
    }
  }
}
