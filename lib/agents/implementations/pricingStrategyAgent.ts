// =============================================================================
// AGENCY GROUP — Pricing Strategy Agent v1.0
// Flags overpriced/underpriced properties vs zone medians
// AMI: 22506 | SH-ROS Layer: revenue_intelligence
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import { BaseAgent } from '../base'
import type { AgentConfig, AgentContext, AgentInsight, AgentAction } from '../types'

// Zone median price per m² (EUR) — Mercado 2026 data
const ZONE_MEDIANS: Record<string, number> = {
  lisboa:    5000,
  cascais:   4713,
  comporta:  6500,
  porto:     3643,
  algarve:   3941,
  madeira:   3760,
  acores:    1952,
}

export class PricingStrategyAgent extends BaseAgent {
  readonly id = 'pricing-strategy' as const
  readonly name = 'Pricing Strategy Agent'
  readonly description = 'Compares active property prices to zone medians and flags overpriced or underpriced opportunities'

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
      // properties table — org isolation: pending migration 015 (properties has no org_id column)
      const { data: properties } = await supabaseAdmin
        .from('properties')
        .select('id, title, zone, price, price_per_sqm, area_m2, status')
        .eq('status', 'active')
        .not('price_per_sqm', 'is', null)
        .limit(50)

      let overpriced = 0
      let underpriced = 0
      let totalRevenueDelta = 0

      for (const prop of properties ?? []) {
        const zone   = (prop.zone ?? '').toLowerCase()
        const median = ZONE_MEDIANS[zone]
        if (!median || !prop.price_per_sqm) continue

        const ppm2    = prop.price_per_sqm as number
        const diff    = (ppm2 - median) / median
        const estArea = prop.area_m2 ?? 100

        if (diff > 0.20) {
          overpriced++
          const revImpact = Math.abs(diff - 0.20) * estArea * median
          totalRevenueDelta += revImpact
          insights.push({
            type:               'overpriced_property',
            summary:            `"${prop.title}" sobrevalorizado em ${Math.round(diff * 100)}% vs mediana de ${zone} (€${ppm2}/m² vs €${median}/m²)`,
            severity:           diff > 0.40 ? 'critical' : 'warning',
            confidence:         0.85,
            revenue_impact_eur: revImpact,
            entity_type:        'property',
            entity_id:          prop.id,
            evidence:           { zone, price_per_sqm: ppm2, zone_median: median, diff_pct: Math.round(diff * 100) },
          })
          actions.push({
            type:               'create_task',
            description:        `Rever preço: "${prop.title}" ${Math.round(diff * 100)}% acima da mediana de ${zone}`,
            entity_type:        'property',
            entity_id:          prop.id,
            payload:            { recommended_price_per_sqm: median * 1.15, current_price_per_sqm: ppm2 },
            risk:               'medium',
            requires_approval:  true,
          })
        } else if (diff < -0.15) {
          underpriced++
          const revImpact = Math.abs(diff) * estArea * median
          insights.push({
            type:               'underpriced_opportunity',
            summary:            `"${prop.title}" subvalorizado em ${Math.round(Math.abs(diff) * 100)}% vs mediana de ${zone} — oportunidade de venda rápida`,
            severity:           'info',
            confidence:         0.80,
            revenue_impact_eur: revImpact,
            entity_type:        'property',
            entity_id:          prop.id,
            evidence:           { zone, price_per_sqm: ppm2, zone_median: median, diff_pct: Math.round(diff * 100) },
          })
        }
      }

      if (insights.length === 0) {
        insights.push({
          type:               'pricing_healthy',
          summary:            `Todos os ${properties?.length ?? 0} imóveis activos estão dentro dos limites de preço de zona`,
          severity:           'info',
          confidence:         0.75,
          revenue_impact_eur: null,
          entity_type:        'portfolio',
          entity_id:          null,
          evidence:           { properties_checked: properties?.length ?? 0 },
        })
      }

      return {
        insights,
        actions,
        metadata: {
          org_id:              ctx.org_id,
          properties_checked:  properties?.length ?? 0,
          overpriced_count:    overpriced,
          underpriced_count:   underpriced,
          total_revenue_delta: totalRevenueDelta,
        },
      }
    } catch (err) {
      return {
        insights: [{
          type: 'agent_error', summary: `Erro ao analisar preços: ${String(err)}`,
          severity: 'warning', confidence: 1, revenue_impact_eur: null,
          entity_type: 'system', entity_id: null, evidence: {},
        }],
        actions: [],
        metadata: { org_id: ctx.org_id },
      }
    }
  }
}
