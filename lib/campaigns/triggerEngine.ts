// Agency Group — Campaign Trigger Engine
// lib/campaigns/triggerEngine.ts
// Monitors system events and fires campaign triggers automatically.
// Checks conditions against real data. Enrolls investors when conditions met.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import {
  type CampaignTriggerType,
  getActiveCampaigns,
  enrollInvestor,
} from '@/lib/campaigns/campaignOrchestrator'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TriggerCheckResult {
  trigger_type: CampaignTriggerType
  tenant_id: string
  triggered_at: string
  investors_affected: string[]
  campaigns_activated: number
  details: Record<string, unknown>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function enrollInCampaignsOfType(
  tenantId: string,
  triggerType: CampaignTriggerType,
  investorIds: string[],
): Promise<number> {
  const allCampaigns = await getActiveCampaigns(tenantId)
  const matching = allCampaigns.filter((c) => c.trigger_type === triggerType)
  let activations = 0

  for (const campaign of matching) {
    for (const investorId of investorIds) {
      try {
        await enrollInvestor(campaign.campaign_id, investorId, tenantId)
        activations++
      } catch {
        // Already enrolled or campaign not active — expected, skip silently
      }
    }
  }

  return activations
}

// ─── checkBidActivityTrigger ──────────────────────────────────────────────────

export async function checkBidActivityTrigger(
  tenantId: string,
): Promise<TriggerCheckResult> {
  const triggered_at = new Date().toISOString()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Find assets with 3+ bids in last 24h
  const { data: bids, error: bidsErr } = await (supabaseAdmin as any)
    .from('asset_bids')
    .select('asset_id, investor_id, is_winner')
    .gte('created_at', since)
    .eq('tenant_id', tenantId)

  if (bidsErr) {
    log.warn('[triggerEngine] checkBidActivityTrigger: query failed', {
      error: bidsErr.message,
    })
    return {
      trigger_type: 'BID_ACTIVITY',
      tenant_id: tenantId,
      triggered_at,
      investors_affected: [],
      campaigns_activated: 0,
      details: { error: bidsErr.message },
    }
  }

  const bidRows: Array<{ asset_id: string; investor_id: string; is_winner: boolean }> =
    bids ?? []

  // Group by asset, find assets with bid_count >= 3
  const assetBidMap = new Map<string, Array<{ investor_id: string; is_winner: boolean }>>()
  for (const row of bidRows) {
    const existing = assetBidMap.get(row.asset_id) ?? []
    existing.push({ investor_id: row.investor_id, is_winner: row.is_winner })
    assetBidMap.set(row.asset_id, existing)
  }

  const affectedInvestorSet = new Set<string>()
  for (const [, assetBids] of assetBidMap) {
    if (assetBids.length >= 3) {
      // Non-winning investors on this asset
      for (const b of assetBids) {
        if (!b.is_winner) {
          affectedInvestorSet.add(b.investor_id)
        }
      }
    }
  }

  const investors_affected = Array.from(affectedInvestorSet)
  const campaigns_activated = await enrollInCampaignsOfType(
    tenantId,
    'BID_ACTIVITY',
    investors_affected,
  )

  log.info('[triggerEngine] checkBidActivityTrigger complete', {
    investors_count: investors_affected.length,
    campaigns_activated,
    tenant_id: tenantId,
  })

  return {
    trigger_type: 'BID_ACTIVITY',
    tenant_id: tenantId,
    triggered_at,
    investors_affected,
    campaigns_activated,
    details: {
      assets_checked: assetBidMap.size,
      bids_in_window: bidRows.length,
    },
  }
}

// ─── checkInactivityTrigger ───────────────────────────────────────────────────

export async function checkInactivityTrigger(
  tenantId: string,
): Promise<TriggerCheckResult> {
  const triggered_at = new Date().toISOString()

  const { data: dormant, error: dormantErr } = await (supabaseAdmin as any)
    .from('investor_segment_profiles')
    .select('investor_id')
    .eq('tenant_id', tenantId)
    .eq('segment', 'DORMANT_CAPITAL')
    .gt('days_since_last_activity', 60)

  if (dormantErr) {
    log.warn('[triggerEngine] checkInactivityTrigger: query failed', {
      error: dormantErr.message,
    })
    return {
      trigger_type: 'INVESTOR_INACTIVITY',
      tenant_id: tenantId,
      triggered_at,
      investors_affected: [],
      campaigns_activated: 0,
      details: { error: dormantErr.message },
    }
  }

  const dormantRows: Array<{ investor_id: string }> = dormant ?? []
  const investors_affected = dormantRows.map((r) => r.investor_id)

  const campaigns_activated = await enrollInCampaignsOfType(
    tenantId,
    'INVESTOR_INACTIVITY',
    investors_affected,
  )

  log.info('[triggerEngine] checkInactivityTrigger complete', {
    dormant_count: investors_affected.length,
    campaigns_activated,
    tenant_id: tenantId,
  })

  return {
    trigger_type: 'INVESTOR_INACTIVITY',
    tenant_id: tenantId,
    triggered_at,
    investors_affected,
    campaigns_activated,
    details: { dormant_investors: investors_affected.length },
  }
}

// ─── checkROIOpportunityTrigger ───────────────────────────────────────────────

export async function checkROIOpportunityTrigger(
  tenantId: string,
): Promise<TriggerCheckResult> {
  const triggered_at = new Date().toISOString()

  // Graceful skip if liquidity_predictions table doesn't exist
  const { data: predictions, error: predErr } = await (supabaseAdmin as any)
    .from('liquidity_predictions')
    .select('asset_id')
    .eq('tenant_id', tenantId)
    .gt('predicted_sale_probability_30d', 0.7)

  if (predErr) {
    // Table may not exist — graceful skip
    log.warn('[triggerEngine] checkROIOpportunityTrigger: graceful skip', {
      error: predErr.message,
    })
    return {
      trigger_type: 'ROI_OPPORTUNITY',
      tenant_id: tenantId,
      triggered_at,
      investors_affected: [],
      campaigns_activated: 0,
      details: { skipped: true, reason: predErr.message },
    }
  }

  const predRows: Array<{ asset_id: string }> = predictions ?? []

  if (predRows.length === 0) {
    return {
      trigger_type: 'ROI_OPPORTUNITY',
      tenant_id: tenantId,
      triggered_at,
      investors_affected: [],
      campaigns_activated: 0,
      details: { high_probability_assets: 0 },
    }
  }

  // Find HIGH_CAPITAL_VELOCITY and INSTITUTIONAL_BUYER investors
  const { data: segInvestors, error: segErr } = await (supabaseAdmin as any)
    .from('investor_segment_profiles')
    .select('investor_id')
    .eq('tenant_id', tenantId)
    .in('segment', ['HIGH_CAPITAL_VELOCITY', 'INSTITUTIONAL_BUYER'])

  if (segErr) {
    log.warn('[triggerEngine] checkROIOpportunityTrigger: segment query failed', {
      error: segErr.message,
    })
    return {
      trigger_type: 'ROI_OPPORTUNITY',
      tenant_id: tenantId,
      triggered_at,
      investors_affected: [],
      campaigns_activated: 0,
      details: { error: segErr.message },
    }
  }

  const investors_affected: string[] = (
    (segInvestors ?? []) as Array<{ investor_id: string }>
  ).map((r) => r.investor_id)

  const campaigns_activated = await enrollInCampaignsOfType(
    tenantId,
    'ROI_OPPORTUNITY',
    investors_affected,
  )

  log.info('[triggerEngine] checkROIOpportunityTrigger complete', {
    high_prob_assets: predRows.length,
    investors_count: investors_affected.length,
    campaigns_activated,
    tenant_id: tenantId,
  })

  return {
    trigger_type: 'ROI_OPPORTUNITY',
    tenant_id: tenantId,
    triggered_at,
    investors_affected,
    campaigns_activated,
    details: {
      high_probability_assets: predRows.length,
      segments_targeted: ['HIGH_CAPITAL_VELOCITY', 'INSTITUTIONAL_BUYER'],
    },
  }
}

// ─── checkLiquidityChangeTrigger ──────────────────────────────────────────────

export async function checkLiquidityChangeTrigger(
  tenantId: string,
): Promise<TriggerCheckResult> {
  const triggered_at = new Date().toISOString()

  // Read assets with significant liquidity score change (> 20 points vs previous snapshot)
  const { data: liquidityRows, error: liqErr } = await (supabaseAdmin as any)
    .from('asset_liquidity_scores')
    .select('asset_id, investor_id, score, previous_score')
    .eq('tenant_id', tenantId)

  if (liqErr) {
    log.warn('[triggerEngine] checkLiquidityChangeTrigger: query failed', {
      error: liqErr.message,
    })
    return {
      trigger_type: 'LIQUIDITY_CHANGE',
      tenant_id: tenantId,
      triggered_at,
      investors_affected: [],
      campaigns_activated: 0,
      details: { error: liqErr.message },
    }
  }

  const rows: Array<{
    asset_id: string
    investor_id: string | null
    score: number
    previous_score: number | null
  }> = liquidityRows ?? []

  // Find assets with change > 20 points
  const significantChanges = rows.filter(
    (r) =>
      r.previous_score != null &&
      Math.abs(r.score - r.previous_score) > 20,
  )

  const affectedInvestorSet = new Set<string>()
  for (const r of significantChanges) {
    if (r.investor_id) {
      affectedInvestorSet.add(r.investor_id)
    }
  }

  // Also pull investors watching changed assets if no direct investor_id
  const changedAssetIds = [...new Set(significantChanges.map((r) => r.asset_id))]
  if (changedAssetIds.length > 0) {
    const { data: watchRows } = await (supabaseAdmin as any)
      .from('investor_asset_watchlist')
      .select('investor_id')
      .eq('tenant_id', tenantId)
      .in('asset_id', changedAssetIds)

    const watchInvestors: Array<{ investor_id: string }> = watchRows ?? []
    for (const w of watchInvestors) {
      affectedInvestorSet.add(w.investor_id)
    }
  }

  const investors_affected = Array.from(affectedInvestorSet)
  const campaigns_activated = await enrollInCampaignsOfType(
    tenantId,
    'LIQUIDITY_CHANGE',
    investors_affected,
  )

  log.info('[triggerEngine] checkLiquidityChangeTrigger complete', {
    significant_changes: significantChanges.length,
    investors_affected: investors_affected.length,
    campaigns_activated,
    tenant_id: tenantId,
  })

  return {
    trigger_type: 'LIQUIDITY_CHANGE',
    tenant_id: tenantId,
    triggered_at,
    investors_affected,
    campaigns_activated,
    details: {
      significant_changes: significantChanges.length,
      assets_changed: changedAssetIds.length,
    },
  }
}

// ─── runAllTriggers ───────────────────────────────────────────────────────────

export async function runAllTriggers(tenantId: string): Promise<TriggerCheckResult[]> {
  const results = await Promise.allSettled([
    checkBidActivityTrigger(tenantId),
    checkInactivityTrigger(tenantId),
    checkROIOpportunityTrigger(tenantId),
    checkLiquidityChangeTrigger(tenantId),
  ])

  const triggerResults: TriggerCheckResult[] = results.map((r, idx) => {
    const fallbackTypes: CampaignTriggerType[] = [
      'BID_ACTIVITY',
      'INVESTOR_INACTIVITY',
      'ROI_OPPORTUNITY',
      'LIQUIDITY_CHANGE',
    ]
    if (r.status === 'fulfilled') return r.value
    log.error('[triggerEngine] trigger check failed', r.reason, {
      trigger_index: idx,
      trigger_type: fallbackTypes[idx],
    })
    return {
      trigger_type: fallbackTypes[idx]!,
      tenant_id: tenantId,
      triggered_at: new Date().toISOString(),
      investors_affected: [],
      campaigns_activated: 0,
      details: { error: String(r.reason) },
    }
  })

  // Fire-and-forget: record logs
  void (async () => {
    try {
      const logInserts = triggerResults.map((r) => ({
        tenant_id: tenantId,
        trigger_type: r.trigger_type,
        triggered_at: r.triggered_at,
        investors_affected: r.investors_affected,
        campaigns_activated: r.campaigns_activated,
        details: r.details,
      }))

      const { error: logErr } = await (supabaseAdmin as any)
        .from('trigger_check_logs')
        .insert(logInserts)

      if (logErr) {
        log.warn('[triggerEngine] trigger_check_logs insert failed', {
          error: logErr.message,
        })
      }
    } catch (e: unknown) {
      log.warn('[triggerEngine] trigger_check_logs fire-and-forget error', {
        error: String(e),
      })
    }
  })()

  log.info('[triggerEngine] runAllTriggers complete', {
    triggers_ran: triggerResults.length,
    total_activations: triggerResults.reduce((s, r) => s + r.campaigns_activated, 0),
    tenant_id: tenantId,
  })

  return triggerResults
}
