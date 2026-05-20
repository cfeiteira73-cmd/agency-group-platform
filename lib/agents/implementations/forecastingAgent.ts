// =============================================================================
// AGENCY GROUP — Forecasting Agent v1.0
// Revenue and pipeline forecasting using growth_metrics trends
// AMI: 22506 | SH-ROS Layer: revenue_intelligence
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { BaseAgent } from '../base'
import type { AgentConfig, AgentContext, AgentInsight, AgentAction } from '../types'

export class ForecastingAgent extends BaseAgent {
  readonly id = 'forecasting' as const
  readonly name = 'Forecasting Agent'
  readonly description = 'Revenue and pipeline forecasting using growth_metrics trends'

  readonly config: AgentConfig = {
    rate_limit_per_hour:    4,
    max_retries:            2,
    timeout_ms:             2000,
    require_human_approval: false,
    can_send_comms:         false,
    layer:                  'revenue_intelligence',
  }

  protected async execute(ctx: AgentContext): Promise<{ insights: AgentInsight[]; actions: AgentAction[]; metadata: Record<string, unknown> }> {
    const insights: AgentInsight[] = []
    const actions:  AgentAction[]  = []

    try {
      // Query last 12 weeks of growth metrics
      const { data: metrics } = await supabaseAdmin
        .from('growth_metrics')
        .select('new_leads, organic_leads, paid_leads, cac_eur, viral_coefficient, week_start, created_at')
        .or(`organization_id.is.null,organization_id.eq.${ctx.org_id}`)
        .order('week_start', { ascending: false })
        .limit(12)

      const weeks = metrics ?? []
      const weeksAnalyzed = weeks.length

      if (weeksAnalyzed < 3) {
        insights.push({
          type:               'insufficient_data',
          summary:            'Dados insuficientes para previsão',
          severity:           'info',
          confidence:         1.0,
          revenue_impact_eur: null,
          entity_type:        'growth_metrics',
          entity_id:          null,
          evidence:           { weeks_available: weeksAnalyzed },
        })
      } else {
        // Calculate week-over-week lead growth rate
        // Compare avg new_leads of last 3 weeks vs previous 3 weeks
        const recent3  = weeks.slice(0, 3)
        const prev3    = weeks.slice(3, 6)

        const avgRecent = recent3.reduce((sum, w) => sum + (w.new_leads ?? 0), 0) / recent3.length
        const avgPrev   = prev3.length > 0
          ? prev3.reduce((sum, w) => sum + (w.new_leads ?? 0), 0) / prev3.length
          : avgRecent

        const avgWoWGrowth = avgPrev > 0
          ? ((avgRecent - avgPrev) / avgPrev) * 100
          : 0

        if (avgWoWGrowth > 10) {
          insights.push({
            type:               'lead_growth_acceleration',
            summary:            `Crescimento acelerado: +${avgWoWGrowth.toFixed(1)}% leads/semana`,
            severity:           'info',
            confidence:         0.85,
            revenue_impact_eur: null,
            entity_type:        'growth_metrics',
            entity_id:          null,
            evidence:           { avg_recent_leads: avgRecent, avg_prev_leads: avgPrev, wow_growth_pct: avgWoWGrowth },
          })
        } else if (avgWoWGrowth < -5) {
          insights.push({
            type:               'lead_growth_decline',
            summary:            `Declínio de leads: ${avgWoWGrowth.toFixed(1)}% WoW — revisão de estratégia necessária`,
            severity:           'warning',
            confidence:         0.85,
            revenue_impact_eur: Math.abs(avgWoWGrowth) * 100000,
            entity_type:        'growth_metrics',
            entity_id:          null,
            evidence:           { avg_recent_leads: avgRecent, avg_prev_leads: avgPrev, wow_growth_pct: avgWoWGrowth },
          })
        }
      }

      // Count active deals — org isolation: pending migration 015 (deals has no org_id column)
      const { data: activeDeals } = await supabaseAdmin
        .from('deals')
        .select('id, valor, fase')
        .not('fase', 'in', '("Escritura Concluída","Perdido","Rejeitado")')
        .limit(50)

      const dealList        = activeDeals ?? []
      const activeDealCount = dealList.length
      // SCHEMA FIX: deals.valor is TEXT (e.g. "€ 1.250.000") — must parse, NOT treat as number.
      // Using `d.valor ?? 0` on a TEXT column returns the raw string when non-null,
      // causing arithmetic NaN. Use parseFloat after stripping non-numeric characters.
      const parseValorText  = (v: unknown): number => {
        if (!v) return 0
        if (typeof v === 'number') return v
        return parseFloat(String(v).replace(/[^\d.]/g, '')) || 0
      }
      const pipelineValue   = dealList.reduce((sum, d) => sum + parseValorText(d.valor), 0)
      const pipelineM       = (pipelineValue / 1_000_000).toFixed(2)

      insights.push({
        type:               'active_pipeline',
        summary:            `Pipeline activo: ${activeDealCount} deals (~€${pipelineM}M estimado)`,
        severity:           'info',
        confidence:         0.95,
        revenue_impact_eur: pipelineValue,
        entity_type:        'deals',
        entity_id:          null,
        evidence:           { active_deals: activeDealCount, pipeline_value_eur: pipelineValue },
      })

      return {
        insights,
        actions,
        metadata: {
          org_id:               ctx.org_id,
          weeks_analyzed:       weeksAnalyzed,
          avg_wow_growth:       weeksAnalyzed >= 3
            ? (() => {
                const r = (metrics ?? []).slice(0, 3)
                const p = (metrics ?? []).slice(3, 6)
                const ar = r.reduce((s, w) => s + (w.new_leads ?? 0), 0) / r.length
                const ap = p.length > 0 ? p.reduce((s, w) => s + (w.new_leads ?? 0), 0) / p.length : ar
                return ap > 0 ? ((ar - ap) / ap) * 100 : 0
              })()
            : null,
          active_deals:         activeDealCount,
          pipeline_estimate_eur: pipelineValue,
        },
      }
    } catch (err) {
      insights.push({
        type: 'agent_error', summary: `Erro: ${String(err)}`,
        severity: 'warning', confidence: 1, revenue_impact_eur: null,
        entity_type: 'system', entity_id: null, evidence: {},
      })
    }

    return { insights, actions, metadata: { org_id: ctx.org_id } }
  }
}
