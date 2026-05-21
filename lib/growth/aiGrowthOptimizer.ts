// Agency Group — AI Growth Optimization Engine
// lib/growth/aiGrowthOptimizer.ts
// Autonomous growth engine: reads system signals, creates optimal campaigns,
// selects best segments, adjusts channel allocation.
// Goal: maximize capital inflow + liquidity creation + conversion rate + ROI per euro spent.
// Uses rule-based optimization (no external ML model needed) backed by real data.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Types ────────────────────────────────────────────────────────────────────

export type DecisionType =
  | 'CREATE_CAMPAIGN'
  | 'PAUSE_CAMPAIGN'
  | 'SHIFT_BUDGET'
  | 'RETARGET_SEGMENT'
  | 'EXPAND_CHANNEL'
  | 'REDUCE_CHANNEL'
  | 'ACTIVATE_DORMANT'
  | 'ESCALATE_WHALE'

export interface OptimizationDecision {
  decision_id: string
  tenant_id: string
  decision_type: DecisionType
  rationale: string
  expected_capital_impact_eur_cents: number
  confidence: number
  action_payload: Record<string, unknown>
  executed: boolean
  generated_at: string
}

export interface OptimizationCycle {
  cycle_id: string
  tenant_id: string
  run_at: string
  signals_analyzed: number
  decisions_made: number
  decisions_executed: number
  projected_capital_uplift_eur_cents: number
  next_cycle_in_hours: number
  decisions: OptimizationDecision[]
}

export interface GrowthSignals {
  dormant_capital_eur_cents: number
  best_performing_channel: string | null
  worst_performing_channel: string | null
  underserved_segments: string[]
  high_liquidity_assets: string[]
  whale_count: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

// ─── analyzeGrowthSignals ──────────────────────────────────────────────────────

/**
 * Reads from: investor_segment_profiles (dormant), channel_attribution_summaries
 * (channel performance), asset_liquidity_scores (top assets),
 * growth_kpi_snapshots (latest). Graceful fallback to defaults if tables empty.
 */
export async function analyzeGrowthSignals(tenantId: string): Promise<GrowthSignals> {
  const defaults: GrowthSignals = {
    dormant_capital_eur_cents: 0,
    best_performing_channel: null,
    worst_performing_channel: null,
    underserved_segments: [],
    high_liquidity_assets: [],
    whale_count: 0,
  }

  try {
    // 1. Dormant capital from investor_segment_profiles
    const dormantRes = await (supabaseAdmin as any)
      .from('investor_segment_profiles')
      .select('capital_size_eur_cents')
      .eq('tenant_id', tenantId)
      .eq('segment', 'DORMANT_CAPITAL')

    const dormantRows: Array<{ capital_size_eur_cents: number }> =
      (dormantRes.data ?? []) as Array<{ capital_size_eur_cents: number }>
    const dormant_capital_eur_cents = dormantRows.reduce(
      (sum, r) => sum + (r.capital_size_eur_cents ?? 0),
      0,
    )

    // 2. Whale count
    const whaleRes = await (supabaseAdmin as any)
      .from('investor_segment_profiles')
      .select('investor_id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('segment', 'WHALE')

    const whale_count: number = (whaleRes.count as number | null) ?? 0

    // 3. Channel performance from channel_attribution_summaries
    const channelRes = await (supabaseAdmin as any)
      .from('channel_attribution_summaries')
      .select('channel, roi_multiple, conversion_rate_pct')
      .eq('tenant_id', tenantId)
      .order('roi_multiple', { ascending: false })

    const channels: Array<{ channel: string; roi_multiple: number; conversion_rate_pct: number }> =
      (channelRes.data ?? []) as Array<{
        channel: string
        roi_multiple: number
        conversion_rate_pct: number
      }>

    const best_performing_channel = channels.length > 0 ? (channels[0]?.channel ?? null) : null
    const worst_performing_channel =
      channels.length > 0 ? (channels[channels.length - 1]?.channel ?? null) : null

    // 4. High liquidity assets from asset_liquidity_scores
    const liquidityRes = await (supabaseAdmin as any)
      .from('asset_liquidity_scores')
      .select('asset_id, liquidity_score')
      .eq('tenant_id', tenantId)
      .gte('liquidity_score', 0.75)
      .order('liquidity_score', { ascending: false })
      .limit(10)

    const highLiquidityRows: Array<{ asset_id: string; liquidity_score: number }> =
      (liquidityRes.data ?? []) as Array<{ asset_id: string; liquidity_score: number }>
    const high_liquidity_assets = highLiquidityRows.map((r) => r.asset_id)

    // 5. Underserved segments — segments with no recent campaign targeting
    const allSegments = [
      'HIGH_CAPITAL_VELOCITY',
      'INSTITUTIONAL_BUYER',
      'OPPORTUNISTIC_BIDDER',
      'HIGH_ROI_CONTRIBUTOR',
      'EMERGING_INVESTOR',
    ]
    // Check which segments had campaigns in last 30d
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const campaignSegmentRes = await (supabaseAdmin as any)
      .from('campaigns')
      .select('target_segment')
      .eq('tenant_id', tenantId)
      .gte('created_at', since30d)
      .not('target_segment', 'is', null)

    const recentSegments = new Set<string>(
      ((campaignSegmentRes.data ?? []) as Array<{ target_segment: string }>).map(
        (r) => r.target_segment,
      ),
    )
    const underserved_segments = allSegments.filter((s) => !recentSegments.has(s))

    log.info('[aiGrowthOptimizer] signals analyzed', {
      tenantId,
      dormant_capital_eur_cents,
      whale_count,
      best_performing_channel,
      worst_performing_channel,
      underserved_count: underserved_segments.length,
      high_liquidity_count: high_liquidity_assets.length,
    })

    return {
      dormant_capital_eur_cents,
      best_performing_channel,
      worst_performing_channel,
      underserved_segments,
      high_liquidity_assets,
      whale_count,
    }
  } catch (err) {
    log.info('[aiGrowthOptimizer] analyzeGrowthSignals fallback', {
      tenantId,
      error: String(err),
    })
    return defaults
  }
}

// ─── generateOptimizationDecisions ────────────────────────────────────────────

/**
 * Analyzes signals and generates rule-based optimization decisions.
 * Persists to optimization_decisions table.
 */
export async function generateOptimizationDecisions(
  tenantId: string,
): Promise<OptimizationDecision[]> {
  const signals = await analyzeGrowthSignals(tenantId)
  const now = new Date().toISOString()
  const decisions: OptimizationDecision[] = []

  // 1. Dormant capital > €500K → CREATE_CAMPAIGN targeting DORMANT_CAPITAL via email
  if (signals.dormant_capital_eur_cents > 500_000_00) {
    decisions.push({
      decision_id: makeId('dec'),
      tenant_id: tenantId,
      decision_type: 'CREATE_CAMPAIGN',
      rationale: `Dormant capital pool of €${(signals.dormant_capital_eur_cents / 100).toLocaleString()} detected. Targeting DORMANT_CAPITAL segment via email to reactivate.`,
      expected_capital_impact_eur_cents: Math.round(
        signals.dormant_capital_eur_cents * 0.15,
      ),
      confidence: 0.72,
      action_payload: {
        target_segment: 'DORMANT_CAPITAL',
        channel: 'email',
        campaign_type: 'REACTIVATION',
        dormant_capital_eur_cents: signals.dormant_capital_eur_cents,
      },
      executed: false,
      generated_at: now,
    })
  }

  // 2. Whale investors present → ESCALATE_WHALE (high-touch direct outreach)
  if (signals.whale_count > 0) {
    decisions.push({
      decision_id: makeId('dec'),
      tenant_id: tenantId,
      decision_type: 'ESCALATE_WHALE',
      rationale: `${signals.whale_count} WHALE investor(s) identified. Trigger high-touch direct outreach for maximum capital deployment velocity.`,
      expected_capital_impact_eur_cents: signals.whale_count * 500_000_00,
      confidence: 0.85,
      action_payload: {
        whale_count: signals.whale_count,
        channel: 'direct_outreach',
        priority: 'CRITICAL',
      },
      executed: false,
      generated_at: now,
    })
  }

  // 3. Channel performance: get channel ROIs from channel_attribution_summaries
  let worstChannelRoi: number | null = null
  let bestChannelRoi: number | null = null
  try {
    const channelRes = await (supabaseAdmin as any)
      .from('channel_attribution_summaries')
      .select('channel, roi_multiple')
      .eq('tenant_id', tenantId)
      .order('roi_multiple', { ascending: true })

    const channelRows: Array<{ channel: string; roi_multiple: number }> =
      (channelRes.data ?? []) as Array<{ channel: string; roi_multiple: number }>

    if (channelRows.length > 0) {
      worstChannelRoi = channelRows[0]?.roi_multiple ?? null
      bestChannelRoi = channelRows[channelRows.length - 1]?.roi_multiple ?? null
    }
  } catch {
    // graceful fallback
  }

  // 3a. Worst channel ROI < 1 → REDUCE_CHANNEL
  if (
    signals.worst_performing_channel !== null &&
    worstChannelRoi !== null &&
    worstChannelRoi < 1
  ) {
    decisions.push({
      decision_id: makeId('dec'),
      tenant_id: tenantId,
      decision_type: 'REDUCE_CHANNEL',
      rationale: `Channel "${signals.worst_performing_channel}" has ROI ${worstChannelRoi.toFixed(2)}x (below 1.0). Reducing allocation prevents capital waste.`,
      expected_capital_impact_eur_cents: 0,
      confidence: 0.78,
      action_payload: {
        channel: signals.worst_performing_channel,
        current_roi: worstChannelRoi,
        action: 'reduce_budget_50_pct',
      },
      executed: false,
      generated_at: now,
    })
  }

  // 3b. Best channel ROI > 3 → EXPAND_CHANNEL (increase budget 20%)
  if (
    signals.best_performing_channel !== null &&
    bestChannelRoi !== null &&
    bestChannelRoi > 3
  ) {
    decisions.push({
      decision_id: makeId('dec'),
      tenant_id: tenantId,
      decision_type: 'EXPAND_CHANNEL',
      rationale: `Channel "${signals.best_performing_channel}" achieving ${bestChannelRoi.toFixed(2)}x ROI. Increasing budget 20% for compounding growth.`,
      expected_capital_impact_eur_cents: Math.round(
        signals.dormant_capital_eur_cents * 0.05,
      ),
      confidence: 0.81,
      action_payload: {
        channel: signals.best_performing_channel,
        current_roi: bestChannelRoi,
        budget_increase_pct: 20,
      },
      executed: false,
      generated_at: now,
    })
  }

  // 4. Underserved segments → RETARGET_SEGMENT for first unserved segment
  if (signals.underserved_segments.length > 0) {
    const segment = signals.underserved_segments[0]!
    decisions.push({
      decision_id: makeId('dec'),
      tenant_id: tenantId,
      decision_type: 'RETARGET_SEGMENT',
      rationale: `Segment "${segment}" has received no campaign in the last 30 days. Retargeting to capture latent capital.`,
      expected_capital_impact_eur_cents: 50_000_00,
      confidence: 0.65,
      action_payload: {
        target_segment: segment,
        all_underserved: signals.underserved_segments,
        channel: signals.best_performing_channel ?? 'email',
      },
      executed: false,
      generated_at: now,
    })
  }

  // Persist decisions to optimization_decisions
  if (decisions.length > 0) {
    const rows = decisions.map((d) => ({
      decision_id: d.decision_id,
      tenant_id: d.tenant_id,
      decision_type: d.decision_type,
      rationale: d.rationale,
      expected_capital_impact_eur_cents: d.expected_capital_impact_eur_cents,
      confidence: d.confidence,
      action_payload: d.action_payload,
      executed: d.executed,
      generated_at: d.generated_at,
    }))

    const { error } = await (supabaseAdmin as any)
      .from('optimization_decisions')
      .insert(rows)

    if (error) {
      log.info('[aiGrowthOptimizer] persist decisions warning', {
        tenantId,
        error: error.message,
      })
    }
  }

  log.info('[aiGrowthOptimizer] decisions generated', {
    tenantId,
    count: decisions.length,
    types: decisions.map((d) => d.decision_type),
  })

  return decisions
}

// ─── executeDecisions ─────────────────────────────────────────────────────────

/**
 * Executes automation-eligible decisions. Budget change decisions are recorded
 * as PLANNED and await human confirmation.
 * Returns count of executed decisions.
 */
export async function executeDecisions(
  decisions: OptimizationDecision[],
  tenantId: string,
): Promise<number> {
  let executed = 0

  for (const decision of decisions) {
    try {
      switch (decision.decision_type) {
        case 'CREATE_CAMPAIGN': {
          // Dynamic import to avoid circular dependency risk
          const { createCampaign } = await import('@/lib/campaigns/campaignOrchestrator')
          const payload = decision.action_payload as {
            target_segment?: string
            channel?: string
            campaign_type?: string
          }
          const segment = payload.target_segment ?? 'DORMANT_CAPITAL'
          const channel = payload.channel ?? 'email'
          await createCampaign(
            {
              tenant_id: tenantId,
              name: `AI Campaign — ${segment} — ${new Date().toISOString().slice(0, 10)}`,
              status: 'ACTIVE',
              trigger_type: 'MANUAL',
              target_segments: [segment],
              channels: [channel],
              message_template_id: null,
              trigger_conditions: {
                source: 'ai_optimizer',
                decision_id: decision.decision_id,
                campaign_type: payload.campaign_type ?? 'REACTIVATION',
              },
              sequence_steps: [],
              start_at: new Date().toISOString(),
              end_at: null,
              budget_eur_cents: null,
            },
            tenantId,
          )
          executed++
          break
        }

        case 'ACTIVATE_DORMANT':
        case 'RETARGET_SEGMENT': {
          // First create a campaign, then bulk enroll the segment
          const { createCampaign: createCamp, bulkEnrollSegment } = await import(
            '@/lib/campaigns/campaignOrchestrator'
          )
          const payload = decision.action_payload as {
            target_segment?: string
            channel?: string
          }
          const seg = payload.target_segment ?? 'DORMANT_CAPITAL'
          const ch = payload.channel ?? 'email'
          const camp = await createCamp(
            {
              tenant_id: tenantId,
              name: `AI Retarget — ${seg} — ${new Date().toISOString().slice(0, 10)}`,
              status: 'ACTIVE',
              trigger_type: 'MANUAL',
              target_segments: [seg],
              channels: [ch],
              message_template_id: null,
              trigger_conditions: {
                source: 'ai_optimizer',
                decision_id: decision.decision_id,
              },
              sequence_steps: [],
              start_at: new Date().toISOString(),
              end_at: null,
              budget_eur_cents: null,
            },
            tenantId,
          )
          await bulkEnrollSegment(camp.campaign_id, seg, tenantId)
          executed++
          break
        }

        // Budget/channel decisions: record as PLANNED, require human confirmation
        case 'SHIFT_BUDGET':
        case 'REDUCE_CHANNEL':
        case 'EXPAND_CHANNEL':
        case 'PAUSE_CAMPAIGN':
        case 'ESCALATE_WHALE': {
          void (supabaseAdmin as any)
            .from('optimization_actions')
            .insert({
              decision_id: decision.decision_id,
              tenant_id: tenantId,
              decision_type: decision.decision_type,
              status: 'PLANNED',
              action_payload: decision.action_payload,
              requires_human_confirmation: true,
              created_at: new Date().toISOString(),
            })
            .then(
              ({ error }: { error: { message: string } | null }) =>
                error &&
                log.info('[aiGrowthOptimizer] optimization_actions insert warning', {
                  tenantId,
                  error: error.message,
                }),
            )
          // Does not count toward executed (human confirmation needed)
          break
        }

        default:
          break
      }

      // Mark decision as executed if automated
      if (
        decision.decision_type === 'CREATE_CAMPAIGN' ||
        decision.decision_type === 'ACTIVATE_DORMANT' ||
        decision.decision_type === 'RETARGET_SEGMENT'
      ) {
        void (supabaseAdmin as any)
          .from('optimization_decisions')
          .update({ executed: true })
          .eq('decision_id', decision.decision_id)
          .catch((e: unknown) =>
            log.info('[aiGrowthOptimizer] mark-executed warning', {
              tenantId,
              error: String(e),
            }),
          )
      }
    } catch (err) {
      log.info('[aiGrowthOptimizer] executeDecision error', {
        tenantId,
        decision_id: decision.decision_id,
        decision_type: decision.decision_type,
        error: String(err),
      })
    }
  }

  return executed
}

// ─── runOptimizationCycle ─────────────────────────────────────────────────────

/**
 * Full optimization cycle: generate → execute → persist cycle record.
 * Determines next cycle timing based on growth mode.
 */
export async function runOptimizationCycle(tenantId: string): Promise<OptimizationCycle> {
  const cycleId = makeId('cycle')
  const runAt = new Date().toISOString()

  log.info('[aiGrowthOptimizer] runOptimizationCycle start', { tenantId, cycleId })

  const decisions = await generateOptimizationDecisions(tenantId)
  const executedCount = await executeDecisions(decisions, tenantId)

  const projected_capital_uplift_eur_cents = decisions.reduce(
    (sum, d) => sum + d.expected_capital_impact_eur_cents,
    0,
  )

  // Determine next cycle timing based on growth mode
  let next_cycle_in_hours = 24 // STABLE

  if (decisions.length >= 5) {
    // HYPERGROWTH mode
    next_cycle_in_hours = 4
  } else if (decisions.length >= 2) {
    // GROWTH mode
    next_cycle_in_hours = 8
  }

  const cycle: OptimizationCycle = {
    cycle_id: cycleId,
    tenant_id: tenantId,
    run_at: runAt,
    signals_analyzed: 7, // dormant, whales, channels (x2), segments, assets, kpis
    decisions_made: decisions.length,
    decisions_executed: executedCount,
    projected_capital_uplift_eur_cents,
    next_cycle_in_hours,
    decisions,
  }

  // Persist cycle
  void (supabaseAdmin as any)
    .from('optimization_cycles')
    .insert({
      cycle_id: cycleId,
      tenant_id: tenantId,
      run_at: runAt,
      signals_analyzed: cycle.signals_analyzed,
      decisions_made: decisions.length,
      decisions_executed: executedCount,
      projected_capital_uplift_eur_cents,
      next_cycle_in_hours,
    })
    .then(
      ({ error }: { error: { message: string } | null }) =>
        error &&
        log.info('[aiGrowthOptimizer] persist cycle warning', {
          tenantId,
          error: error.message,
        }),
    )

  log.info('[aiGrowthOptimizer] cycle complete', {
    tenantId,
    cycleId,
    decisions_made: decisions.length,
    decisions_executed: executedCount,
    projected_capital_uplift_eur_cents,
    next_cycle_in_hours,
  })

  return cycle
}
