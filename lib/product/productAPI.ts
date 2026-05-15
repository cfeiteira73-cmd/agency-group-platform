// AGENCY GROUP — SH-ROS Product: Product API | AMI: 22506
// Unified product-level API — single interface for all product operations
// Orchestrates: BusinessPrimitives + DecisionInterface + Explainability + Revenue
// =============================================================================

import { businessPrimitiveEngine }    from './businessPrimitiveEngine'
import { outcomeAbstractionLayer }     from './outcomeAbstractionLayer'
import { simplifiedDecisionInterface } from './simplifiedDecisionInterface'
import { explainabilityRenderer }      from './explainabilityRenderer'
import { revenueOutcomeMapper }        from './revenueOutcomeMapper'
import logger from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductContext {
  org_id:   string
  agent_id: string
  locale?:  'pt' | 'en'
}

export interface DashboardPayload {
  pipeline:      Awaited<ReturnType<typeof businessPrimitiveEngine.getPipeline>>
  top_leads:     Awaited<ReturnType<typeof businessPrimitiveEngine.getTopLeads>>
  decisions:     Awaited<ReturnType<typeof simplifiedDecisionInterface.getDecisions>>
  funnel:        Awaited<ReturnType<typeof revenueOutcomeMapper.buildFunnel>>
  daily_target:  Awaited<ReturnType<typeof revenueOutcomeMapper.getDailyTarget>>
  loaded_at:     string
}

export interface EntityInsight {
  prediction:   ReturnType<typeof outcomeAbstractionLayer.predict>
  explanation:  ReturnType<typeof explainabilityRenderer.render>
  decision:     ReturnType<typeof simplifiedDecisionInterface.quickDecide>
  revenue_event: ReturnType<typeof revenueOutcomeMapper.mapEvent>
}

// ─── Product API ──────────────────────────────────────────────────────────────

export class ProductAPI {

  /**
   * Load full dashboard for an org.
   * Single call that replaces 5 separate API calls.
   * Used by Control Tower and mobile app.
   */
  async loadDashboard(ctx: ProductContext): Promise<DashboardPayload> {
    const start = Date.now()

    const [pipeline, top_leads, decisions, funnel, daily_target] = await Promise.all([
      businessPrimitiveEngine.getPipeline(ctx.org_id),
      businessPrimitiveEngine.getTopLeads(ctx.org_id, 10),
      simplifiedDecisionInterface.getDecisions({
        org_id:       ctx.org_id,
        context_type: 'daily_review',
      }),
      revenueOutcomeMapper.buildFunnel(ctx.org_id),
      revenueOutcomeMapper.getDailyTarget(ctx.org_id),
    ])

    logger.info('[ProductAPI] Dashboard loaded', {
      org_id:     ctx.org_id,
      latency_ms: Date.now() - start,
      actions:    decisions.actions.length,
      leads:      top_leads.length,
    })

    return {
      pipeline,
      top_leads,
      decisions,
      funnel,
      daily_target,
      loaded_at: new Date().toISOString(),
    }
  }

  /**
   * Get full insight for a single entity (lead/deal/match).
   * Combines prediction + explanation + decision + revenue mapping.
   */
  getEntityInsight(ctx: ProductContext, params: {
    entity_id:    string
    entity_type:  'lead' | 'deal' | 'match'
    score:        number
    features:     Record<string, number>
    deal_value?:  number
    days_active?: number
  }): EntityInsight {
    const prediction = outcomeAbstractionLayer.predict({
      entity_id:    params.entity_id,
      entity_type:  params.entity_type,
      org_id:       ctx.org_id,
      match_score:  params.score,
      deal_value:   params.deal_value,
      days_in_stage: params.days_active,
    })

    const explanation = explainabilityRenderer.render({
      entity_id:   params.entity_id,
      entity_type: params.entity_type as 'match' | 'lead' | 'deal' | 'prediction',
      score:       params.score,
      features:    params.features,
      audience:    'agent',
      language:    ctx.locale ?? 'en',
    })

    const decision = simplifiedDecisionInterface.quickDecide({
      entity_id:   params.entity_id,
      score:       params.score,
      days_active: params.days_active ?? 0,
      value:       params.deal_value ?? 500_000,
      org_id:      ctx.org_id,
    })

    const revenue_event = revenueOutcomeMapper.mapEvent({
      org_id:      ctx.org_id,
      event_type:  params.entity_type === 'deal' ? 'deal_closed_won' : 'match_created',
      entity_id:   params.entity_id,
      gross_value: params.deal_value,
    })

    return { prediction, explanation, decision, revenue_event }
  }

  /**
   * Record deal outcome and update all downstream systems.
   * Single call to close a deal.
   */
  async recordDealOutcome(ctx: ProductContext, params: {
    deal_id:     string
    won:         boolean
    final_value: number
    days_to_close: number
  }): Promise<void> {
    // Map the outcome
    revenueOutcomeMapper.mapEvent({
      org_id:      ctx.org_id,
      event_type:  params.won ? 'deal_closed_won' : 'deal_closed_lost',
      entity_id:   params.deal_id,
      gross_value: params.final_value,
    })

    // Record actual outcome for prediction calibration
    outcomeAbstractionLayer.recordActual(
      params.deal_id,
      params.won ? 'closed' : 'lost',
      params.won ? params.final_value : null
    )

    // Invalidate pipeline cache so next load is fresh
    businessPrimitiveEngine.invalidateCache(ctx.org_id)

    logger.info('[ProductAPI] Deal outcome recorded', {
      org_id:   ctx.org_id,
      deal_id:  params.deal_id,
      won:      params.won,
      value:    params.final_value,
    })
  }

  /**
   * Get revenue attribution report.
   */
  async getRevenueAttribution(ctx: ProductContext, since_ts: string) {
    return revenueOutcomeMapper.getAttribution(ctx.org_id, since_ts)
  }

  /**
   * Get revenue forecast.
   */
  async getRevenueForecast(ctx: ProductContext) {
    return businessPrimitiveEngine.getRevenueSnapshot(ctx.org_id, 'mtd')
  }
}

export const productAPI = new ProductAPI()

// ─── Re-exports ────────────────────────────────────────────────────────────────

export {
  businessPrimitiveEngine,
  outcomeAbstractionLayer,
  simplifiedDecisionInterface,
  explainabilityRenderer,
  revenueOutcomeMapper,
}
