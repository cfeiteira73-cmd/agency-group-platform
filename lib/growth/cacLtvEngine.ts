// Agency Group — CAC + LTV Engine
// lib/growth/cacLtvEngine.ts
// Computes:
//   CAC = total cost to acquire investor / investors acquired
//   LTV = total capital deployed by investor × 5% commission over lifetime
//   ROI per campaign = capital generated / campaign cost
//   capital generated per € spent = (total executed EUR) / (campaign spend EUR)

import { v4 as uuidv4 } from 'uuid'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

export const runtime = 'nodejs'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CampaignCost {
  campaign_id: string
  tenant_id: string
  channel: string
  spend_eur_cents: number
  period_start: string
  period_end: string
  investors_targeted: number
  notes: string
}

export interface CACMetrics {
  tenant_id: string
  period: string
  total_spend_eur_cents: number
  new_investors_acquired: number
  cac_eur_cents: number
  channel_breakdown: Array<{
    channel: string
    spend_eur_cents: number
    acquired: number
    cac_eur_cents: number
  }>
}

export interface LTVMetrics {
  investor_id: string
  tenant_id: string
  first_activity_at: string
  total_capital_deployed_eur_cents: number
  total_commission_earned_eur_cents: number
  tenure_days: number
  ltv_eur_cents: number
  ltv_per_day_eur_cents: number
  projected_12m_ltv_eur_cents: number | null
}

export interface CampaignROI {
  campaign_id: string
  tenant_id: string
  spend_eur_cents: number
  capital_generated_eur_cents: number
  commission_earned_eur_cents: number
  roi_multiple: number
  roi_pct: number
  investors_converted: number
  cost_per_euro_capital: number
}

// ─── recordCampaignCost ───────────────────────────────────────────────────────

/**
 * Inserts a campaign cost record. Returns with generated campaign_id.
 */
export async function recordCampaignCost(
  cost: Omit<CampaignCost, 'campaign_id'>,
): Promise<CampaignCost> {
  const campaign_id = uuidv4()

  const { error } = await (supabaseAdmin as any)
    .from('campaign_costs')
    .insert({
      campaign_id,
      tenant_id: cost.tenant_id,
      channel: cost.channel,
      spend_eur_cents: cost.spend_eur_cents,
      period_start: cost.period_start,
      period_end: cost.period_end,
      investors_targeted: cost.investors_targeted,
      notes: cost.notes,
    })

  if (error) {
    log.warn('[cacLtvEngine] recordCampaignCost insert error', { error })
  }

  log.info('[cacLtvEngine] recordCampaignCost', {
    campaign_id,
    channel: cost.channel,
    spend_eur_cents: cost.spend_eur_cents,
  })

  return { campaign_id, ...cost }
}

// ─── computeCAC ───────────────────────────────────────────────────────────────

/**
 * Computes Customer Acquisition Cost for the tenant within windowDays.
 * Reads campaign_costs + attribution_touchpoints to identify new investor acquisitions.
 * Persists to cac_metrics.
 */
export async function computeCAC(
  tenantId: string,
  windowDays = 30,
): Promise<CACMetrics> {
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString()
  const period = `${since.slice(0, 10)}/${new Date().toISOString().slice(0, 10)}`

  // Read campaign costs in window
  const { data: costsData, error: costsErr } = await (supabaseAdmin as any)
    .from('campaign_costs')
    .select('*')
    .eq('tenant_id', tenantId)
    .gte('period_start', since)

  if (costsErr) {
    log.warn('[cacLtvEngine] computeCAC costs error', { error: costsErr })
  }

  const costs = ((costsData ?? []) as CampaignCost[])

  // Total spend
  const total_spend_eur_cents = costs.reduce((sum, c) => sum + c.spend_eur_cents, 0)

  // Read first touchpoints per investor in window (proxy for new acquisition)
  const { data: tpData, error: tpErr } = await (supabaseAdmin as any)
    .from('attribution_touchpoints')
    .select('investor_id, channel, occurred_at')
    .eq('tenant_id', tenantId)
    .gte('occurred_at', since)
    .order('occurred_at', { ascending: true })

  if (tpErr) {
    log.warn('[cacLtvEngine] computeCAC touchpoints error', { error: tpErr })
  }

  // Track first channel per new investor
  const firstChannelPerInvestor = new Map<string, string>()
  for (const tp of ((tpData ?? []) as Array<{ investor_id: string; channel: string; occurred_at: string }>)) {
    if (!firstChannelPerInvestor.has(tp.investor_id)) {
      firstChannelPerInvestor.set(tp.investor_id, tp.channel)
    }
  }

  const new_investors_acquired = firstChannelPerInvestor.size

  // Aggregate by channel
  const channelSpend: Record<string, number> = {}
  const channelAcquired: Record<string, number> = {}

  for (const cost of costs) {
    channelSpend[cost.channel] = (channelSpend[cost.channel] ?? 0) + cost.spend_eur_cents
  }

  for (const [, ch] of firstChannelPerInvestor) {
    channelAcquired[ch] = (channelAcquired[ch] ?? 0) + 1
  }

  const allChannels = new Set([...Object.keys(channelSpend), ...Object.keys(channelAcquired)])
  const channel_breakdown = [...allChannels].map(ch => {
    const spend = channelSpend[ch] ?? 0
    const acquired = channelAcquired[ch] ?? 0
    return {
      channel: ch,
      spend_eur_cents: spend,
      acquired,
      cac_eur_cents: acquired > 0 ? Math.round(spend / acquired) : 0,
    }
  })

  const cac_eur_cents = new_investors_acquired > 0
    ? Math.round(total_spend_eur_cents / new_investors_acquired)
    : 0

  const metrics: CACMetrics = {
    tenant_id: tenantId,
    period,
    total_spend_eur_cents,
    new_investors_acquired,
    cac_eur_cents,
    channel_breakdown,
  }

  // Persist
  void (supabaseAdmin as any)
    .from('cac_metrics')
    .insert({
      tenant_id: tenantId,
      period,
      window_days: windowDays,
      total_spend_eur_cents,
      new_investors_acquired,
      cac_eur_cents,
      channel_breakdown,
      computed_at: new Date().toISOString(),
    })
    .catch((e: unknown) => console.warn('[cacLtvEngine] persist cac_metrics', e))

  log.info('[cacLtvEngine] computeCAC', {
    tenant_id: tenantId,
    windowDays,
    total_spend_eur_cents,
    new_investors_acquired,
    cac_eur_cents,
  })

  return metrics
}

// ─── computeInvestorLTV ───────────────────────────────────────────────────────

/**
 * Computes Lifetime Value for a single investor.
 * LTV = total capital deployed × 5% commission.
 * Persists to ltv_metrics.
 */
export async function computeInvestorLTV(
  investorId: string,
  tenantId: string,
): Promise<LTVMetrics> {
  // Read all ledger entries for this investor
  const { data: ledgerData, error: ledgerErr } = await (supabaseAdmin as any)
    .from('investor_ledger_entries')
    .select('amount_eur_cents, created_at')
    .eq('tenant_id', tenantId)
    .eq('investor_id', investorId)
    .order('created_at', { ascending: true })

  if (ledgerErr) {
    log.warn('[cacLtvEngine] computeInvestorLTV ledger error', { error: ledgerErr })
  }

  const entries = ((ledgerData ?? []) as Array<{ amount_eur_cents: number; created_at: string }>)

  const total_capital_deployed_eur_cents = entries
    .filter(e => e.amount_eur_cents > 0)
    .reduce((sum, e) => sum + e.amount_eur_cents, 0)

  const total_commission_earned_eur_cents = Math.round(total_capital_deployed_eur_cents * 0.05)

  const first_activity_at = entries.length > 0 ? entries[0].created_at : new Date().toISOString()
  const tenure_days = Math.max(
    1,
    Math.floor((Date.now() - new Date(first_activity_at).getTime()) / 86_400_000),
  )

  const ltv_eur_cents = total_commission_earned_eur_cents
  const ltv_per_day_eur_cents = Math.round(ltv_eur_cents / tenure_days)

  const projected_12m_ltv_eur_cents = tenure_days > 30
    ? Math.round(ltv_per_day_eur_cents * 365)
    : null

  const metrics: LTVMetrics = {
    investor_id: investorId,
    tenant_id: tenantId,
    first_activity_at,
    total_capital_deployed_eur_cents,
    total_commission_earned_eur_cents,
    tenure_days,
    ltv_eur_cents,
    ltv_per_day_eur_cents,
    projected_12m_ltv_eur_cents,
  }

  // Persist (upsert by investor_id+tenant_id)
  void (supabaseAdmin as any)
    .from('ltv_metrics')
    .upsert(
      {
        tenant_id: tenantId,
        investor_id: investorId,
        first_activity_at,
        total_capital_deployed_eur_cents,
        total_commission_earned_eur_cents,
        tenure_days,
        ltv_eur_cents,
        ltv_per_day_eur_cents,
        projected_12m_ltv_eur_cents,
        computed_at: new Date().toISOString(),
      },
      { onConflict: 'tenant_id,investor_id' },
    )
    .catch((e: unknown) => console.warn('[cacLtvEngine] persist ltv_metrics', e))

  return metrics
}

// ─── computeCampaignROI ───────────────────────────────────────────────────────

/**
 * Computes ROI for a single campaign.
 * Capital generated = sum of ledger entries for investors whose first touchpoint
 * was via this campaign. Persists to campaign_roi_results.
 */
export async function computeCampaignROI(
  campaignId: string,
  tenantId: string,
): Promise<CampaignROI> {
  // Read campaign cost
  const { data: costData, error: costErr } = await (supabaseAdmin as any)
    .from('campaign_costs')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('campaign_id', campaignId)
    .maybeSingle()

  if (costErr) {
    log.warn('[cacLtvEngine] computeCampaignROI cost error', { error: costErr })
  }

  const spend_eur_cents: number = (costData as CampaignCost | null)?.spend_eur_cents ?? 0

  // Find all touchpoints for this campaign
  const { data: tpData, error: tpErr } = await (supabaseAdmin as any)
    .from('attribution_touchpoints')
    .select('investor_id, occurred_at')
    .eq('tenant_id', tenantId)
    .eq('campaign_id', campaignId)
    .order('occurred_at', { ascending: true })

  if (tpErr) {
    log.warn('[cacLtvEngine] computeCampaignROI touchpoints error', { error: tpErr })
  }

  const investorIds = [
    ...new Set(
      ((tpData ?? []) as Array<{ investor_id: string }>).map(t => t.investor_id),
    ),
  ]

  // For each investor, check if first overall touchpoint was via this campaign
  let capital_generated_eur_cents = 0
  let investors_converted = 0

  for (const investorId of investorIds) {
    const { data: firstTp } = await (supabaseAdmin as any)
      .from('attribution_touchpoints')
      .select('campaign_id')
      .eq('tenant_id', tenantId)
      .eq('investor_id', investorId)
      .order('occurred_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    if ((firstTp as { campaign_id?: string } | null)?.campaign_id === campaignId) {
      // This investor was first acquired by this campaign — attribute their capital
      const { data: ledger } = await (supabaseAdmin as any)
        .from('investor_ledger_entries')
        .select('amount_eur_cents')
        .eq('tenant_id', tenantId)
        .eq('investor_id', investorId)

      const investorCapital = ((ledger ?? []) as Array<{ amount_eur_cents: number }>)
        .filter(e => e.amount_eur_cents > 0)
        .reduce((sum, e) => sum + e.amount_eur_cents, 0)

      capital_generated_eur_cents += investorCapital
      if (investorCapital > 0) investors_converted++
    }
  }

  const commission_earned_eur_cents = Math.round(capital_generated_eur_cents * 0.05)

  // roi_multiple = commission / spend (0 if no spend)
  const roi_multiple = spend_eur_cents > 0
    ? parseFloat((commission_earned_eur_cents / spend_eur_cents).toFixed(4))
    : 0

  const roi_pct = roi_multiple * 100

  // cost_per_euro_capital = spend_eur_cents / capital_generated_eur_cents (0 if no capital)
  const cost_per_euro_capital = capital_generated_eur_cents > 0
    ? parseFloat((spend_eur_cents / capital_generated_eur_cents).toFixed(6))
    : 0

  const roi: CampaignROI = {
    campaign_id: campaignId,
    tenant_id: tenantId,
    spend_eur_cents,
    capital_generated_eur_cents,
    commission_earned_eur_cents,
    roi_multiple,
    roi_pct,
    investors_converted,
    cost_per_euro_capital,
  }

  // Persist
  void (supabaseAdmin as any)
    .from('campaign_roi_results')
    .insert({
      tenant_id: tenantId,
      campaign_id: campaignId,
      spend_eur_cents,
      capital_generated_eur_cents,
      commission_earned_eur_cents,
      roi_multiple,
      roi_pct,
      investors_converted,
      cost_per_euro_capital,
      computed_at: new Date().toISOString(),
    })
    .catch((e: unknown) => console.warn('[cacLtvEngine] persist campaign_roi_results', e))

  log.info('[cacLtvEngine] computeCampaignROI', {
    campaign_id: campaignId,
    spend_eur_cents,
    capital_generated_eur_cents,
    roi_multiple,
  })

  return roi
}

// ─── getFullROIReport ─────────────────────────────────────────────────────────

/**
 * Assembles a full ROI report for the tenant. Persists to roi_reports_full.
 */
export async function getFullROIReport(tenantId: string): Promise<{
  cac: CACMetrics
  top_ltv_investors: LTVMetrics[]
  campaign_rois: CampaignROI[]
  best_channel: string | null
  worst_channel: string | null
  overall_roi_multiple: number
}> {
  // CAC (30-day default)
  const cac = await computeCAC(tenantId, 30)

  // Top LTV investors from ltv_metrics
  const { data: ltvData, error: ltvErr } = await (supabaseAdmin as any)
    .from('ltv_metrics')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('ltv_eur_cents', { ascending: false })
    .limit(10)

  if (ltvErr) {
    log.warn('[cacLtvEngine] getFullROIReport ltv error', { error: ltvErr })
  }

  const top_ltv_investors: LTVMetrics[] = ((ltvData ?? []) as Array<Record<string, unknown>>).map(r => ({
    investor_id: r.investor_id as string,
    tenant_id: r.tenant_id as string,
    first_activity_at: r.first_activity_at as string,
    total_capital_deployed_eur_cents: r.total_capital_deployed_eur_cents as number,
    total_commission_earned_eur_cents: r.total_commission_earned_eur_cents as number,
    tenure_days: r.tenure_days as number,
    ltv_eur_cents: r.ltv_eur_cents as number,
    ltv_per_day_eur_cents: r.ltv_per_day_eur_cents as number,
    projected_12m_ltv_eur_cents: (r.projected_12m_ltv_eur_cents as number | null) ?? null,
  }))

  // Campaign ROIs from campaign_roi_results
  const { data: roiData, error: roiErr } = await (supabaseAdmin as any)
    .from('campaign_roi_results')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('computed_at', { ascending: false })
    .limit(50)

  if (roiErr) {
    log.warn('[cacLtvEngine] getFullROIReport roi error', { error: roiErr })
  }

  const campaign_rois: CampaignROI[] = ((roiData ?? []) as Array<Record<string, unknown>>).map(r => ({
    campaign_id: r.campaign_id as string,
    tenant_id: r.tenant_id as string,
    spend_eur_cents: r.spend_eur_cents as number,
    capital_generated_eur_cents: r.capital_generated_eur_cents as number,
    commission_earned_eur_cents: r.commission_earned_eur_cents as number,
    roi_multiple: Number(r.roi_multiple),
    roi_pct: Number(r.roi_pct),
    investors_converted: r.investors_converted as number,
    cost_per_euro_capital: Number(r.cost_per_euro_capital),
  }))

  // Best/worst channel by avg roi_multiple per channel from cac breakdown
  let best_channel: string | null = null
  let worst_channel: string | null = null
  if (cac.channel_breakdown.length > 0) {
    const sorted = [...cac.channel_breakdown].sort((a, b) => {
      const aRoi = a.spend_eur_cents > 0 ? a.acquired / a.spend_eur_cents : 0
      const bRoi = b.spend_eur_cents > 0 ? b.acquired / b.spend_eur_cents : 0
      return bRoi - aRoi
    })
    best_channel = sorted[0]?.channel ?? null
    worst_channel = sorted[sorted.length - 1]?.channel ?? null
  }

  // Overall ROI multiple = sum commission / sum spend across all campaigns
  const totalCommission = campaign_rois.reduce((s, r) => s + r.commission_earned_eur_cents, 0)
  const totalSpend = campaign_rois.reduce((s, r) => s + r.spend_eur_cents, 0)
  const overall_roi_multiple = totalSpend > 0
    ? parseFloat((totalCommission / totalSpend).toFixed(4))
    : 0

  const report = {
    cac,
    top_ltv_investors,
    campaign_rois,
    best_channel,
    worst_channel,
    overall_roi_multiple,
  }

  // Persist
  void (supabaseAdmin as any)
    .from('roi_reports_full')
    .insert({
      tenant_id: tenantId,
      computed_at: new Date().toISOString(),
      report_data: report,
    })
    .catch((e: unknown) => console.warn('[cacLtvEngine] persist roi_reports_full', e))

  log.info('[cacLtvEngine] getFullROIReport', {
    tenant_id: tenantId,
    overall_roi_multiple,
    campaigns: campaign_rois.length,
    top_investors: top_ltv_investors.length,
  })

  return report
}
