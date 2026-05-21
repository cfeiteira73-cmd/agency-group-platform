// Agency Group — Multi-Touch Attribution Engine
// lib/growth/attributionEngine.ts
// 5 attribution models: first_touch, last_touch, multi_touch_linear,
//   time_decay, capital_weighted.
// Tracks: channel → touchpoint → capital commitment → deal execution → ROI.
// GOAL: know exactly which channel generates capital, not just clicks.
//
// Wave 40: Full attribution engine on top of existing touchpoint recorder stub.

import { v4 as uuidv4 } from 'uuid'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ─── Existing stub types (preserved) ─────────────────────────────────────────

export interface TouchpointRecord {
  tenant_id: string
  investor_id: string
  channel: string
  campaign_id: string | null
  execution_id: string | null
  job_id: string | null
  event_type: 'send' | 'delivered' | 'opened' | 'clicked' | 'opted_out' | 'bounced'
  metadata: Record<string, unknown>
  occurred_at: string
}

// ─── Wave 40 Attribution Types ────────────────────────────────────────────────

export type AttributionModel =
  | 'first_touch'
  | 'last_touch'
  | 'multi_touch_linear'
  | 'time_decay'
  | 'capital_weighted'

export type TouchpointChannel =
  | 'email'
  | 'whatsapp'
  | 'sms'
  | 'in_app'
  | 'direct'
  | 'referral'
  | 'organic'
  | 'paid_social'
  | 'campaign'
  | 'cold_outreach'

export interface Touchpoint {
  touchpoint_id: string
  investor_id: string
  tenant_id: string
  channel: TouchpointChannel
  campaign_id: string | null
  occurred_at: string
  signal_type: string
  metadata: Record<string, unknown>
}

export interface AttributionResult {
  investor_id: string
  tenant_id: string
  model: AttributionModel
  touchpoints: Touchpoint[]
  capital_generated_eur_cents: number
  attribution_by_channel: Record<TouchpointChannel, number>
  attributed_capital_by_channel: Record<TouchpointChannel, number>
  computed_at: string
}

export interface ChannelAttributionSummary {
  channel: TouchpointChannel
  tenant_id: string
  model: AttributionModel
  touchpoint_count: number
  investor_count: number
  total_attributed_capital_eur_cents: number
  avg_capital_per_touchpoint_eur_cents: number
  conversion_rate_pct: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_CHANNELS: TouchpointChannel[] = [
  'email', 'whatsapp', 'sms', 'in_app', 'direct',
  'referral', 'organic', 'paid_social', 'campaign', 'cold_outreach',
]

function emptyChannelRecord(): Record<TouchpointChannel, number> {
  return Object.fromEntries(ALL_CHANNELS.map(c => [c, 0])) as Record<TouchpointChannel, number>
}

// ─── recordTouchpoint (existing stub — preserved) ─────────────────────────────

/**
 * Fire-and-forget: records a channel touchpoint for attribution.
 * Called by channelRouter after each send attempt.
 * @deprecated Use recordTouchpoint(Omit<Touchpoint,'touchpoint_id'>) overload for Wave 40.
 */
export async function recordTouchpoint(tp: TouchpointRecord): Promise<void>
/**
 * Wave 40 overload: records a typed Touchpoint with full attribution metadata.
 */
export async function recordTouchpoint(tp: Omit<Touchpoint, 'touchpoint_id'>): Promise<void>
export async function recordTouchpoint(
  tp: TouchpointRecord | Omit<Touchpoint, 'touchpoint_id'>,
): Promise<void> {
  // Detect which overload: TouchpointRecord has event_type, Touchpoint has signal_type
  if ('event_type' in tp) {
    // Legacy TouchpointRecord path
    const { error } = await (supabaseAdmin as any)
      .from('attribution_touchpoints')
      .insert({
        tenant_id: tp.tenant_id,
        investor_id: tp.investor_id,
        channel: tp.channel,
        campaign_id: tp.campaign_id,
        execution_id: (tp as TouchpointRecord).execution_id,
        job_id: (tp as TouchpointRecord).job_id,
        event_type: (tp as TouchpointRecord).event_type,
        metadata: tp.metadata,
        occurred_at: tp.occurred_at,
      })
    if (error) {
      log.warn('[attributionEngine] touchpoint insert failed', {
        error: (error as { message?: string }).message,
        investor_id: tp.investor_id,
        channel: tp.channel,
      })
    }
    return
  }

  // Wave 40 Touchpoint path
  const touchpoint_id = uuidv4()
  void (supabaseAdmin as any)
    .from('attribution_touchpoints')
    .insert({
      touchpoint_id,
      tenant_id: tp.tenant_id,
      investor_id: tp.investor_id,
      channel: tp.channel,
      campaign_id: tp.campaign_id ?? null,
      occurred_at: tp.occurred_at,
      signal_type: (tp as Omit<Touchpoint, 'touchpoint_id'>).signal_type,
      metadata: tp.metadata,
    })
    .then(({ error }: { error: unknown }) => {
      if (error) log.warn('[attributionEngine] recordTouchpoint insert error', { error })
    })
    .catch((e: unknown) => console.warn('[attributionEngine] recordTouchpoint', e))
}

// ─── computeAttribution ───────────────────────────────────────────────────────

/**
 * Computes multi-touch attribution for a single investor using the given model.
 * Reads touchpoints + capital from DB, distributes capital across channels,
 * persists result to attribution_results.
 */
export async function computeAttribution(
  investorId: string,
  tenantId: string,
  model: AttributionModel,
): Promise<AttributionResult> {
  // 1. Load touchpoints ordered by occurred_at ASC
  const { data: tpRows, error: tpErr } = await (supabaseAdmin as any)
    .from('attribution_touchpoints')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('investor_id', investorId)
    .order('occurred_at', { ascending: true })

  if (tpErr) {
    log.warn('[attributionEngine] computeAttribution touchpoints error', { error: tpErr })
  }

  const touchpoints: Touchpoint[] = ((tpRows ?? []) as Array<Record<string, unknown>>).map(r => ({
    touchpoint_id: (r.touchpoint_id as string | undefined) ?? (r.id as string),
    investor_id: r.investor_id as string,
    tenant_id: r.tenant_id as string,
    channel: r.channel as TouchpointChannel,
    campaign_id: (r.campaign_id as string | null) ?? null,
    occurred_at: r.occurred_at as string,
    signal_type: (r.signal_type as string | undefined) ?? (r.event_type as string | undefined) ?? '',
    metadata: (r.metadata as Record<string, unknown>) ?? {},
  }))

  // 2. Read total capital committed for this investor from investor_ledger_entries
  const { data: ledgerRows, error: ledgerErr } = await (supabaseAdmin as any)
    .from('investor_ledger_entries')
    .select('amount_eur_cents')
    .eq('tenant_id', tenantId)
    .eq('investor_id', investorId)

  if (ledgerErr) {
    log.warn('[attributionEngine] computeAttribution ledger error', { error: ledgerErr })
  }

  const capital_generated_eur_cents: number = (
    (ledgerRows ?? []) as Array<{ amount_eur_cents: number }>
  ).reduce((sum, row) => sum + (row.amount_eur_cents > 0 ? row.amount_eur_cents : 0), 0)

  // 3. Distribute capital across channels per model
  const attribution_by_channel = emptyChannelRecord()
  const attributed_capital_by_channel = emptyChannelRecord()

  if (touchpoints.length > 0) {
    applyAttributionModel(
      model,
      touchpoints,
      capital_generated_eur_cents,
      attribution_by_channel,
      attributed_capital_by_channel,
    )
  }

  const result: AttributionResult = {
    investor_id: investorId,
    tenant_id: tenantId,
    model,
    touchpoints,
    capital_generated_eur_cents,
    attribution_by_channel,
    attributed_capital_by_channel,
    computed_at: new Date().toISOString(),
  }

  // 4. Persist
  void (supabaseAdmin as any)
    .from('attribution_results')
    .insert({
      tenant_id: result.tenant_id,
      investor_id: result.investor_id,
      model: result.model,
      capital_generated_eur_cents: result.capital_generated_eur_cents,
      attribution_by_channel: result.attribution_by_channel,
      attributed_capital_by_channel: result.attributed_capital_by_channel,
      touchpoints: result.touchpoints,
      computed_at: result.computed_at,
    })
    .catch((e: unknown) => console.warn('[attributionEngine] persist attribution_results', e))

  return result
}

function applyAttributionModel(
  model: AttributionModel,
  touchpoints: Touchpoint[],
  capital: number,
  attributionByChannel: Record<TouchpointChannel, number>,
  capitalByChannel: Record<TouchpointChannel, number>,
): void {
  if (model === 'first_touch') {
    const ch = touchpoints[0].channel
    attributionByChannel[ch] = 1
    capitalByChannel[ch] = capital

  } else if (model === 'last_touch') {
    const ch = touchpoints[touchpoints.length - 1].channel
    attributionByChannel[ch] = 1
    capitalByChannel[ch] = capital

  } else if (model === 'multi_touch_linear') {
    const uniqueChannels = [...new Set(touchpoints.map(t => t.channel))]
    const weight = 1 / uniqueChannels.length
    const capPerChannel = Math.round(capital / uniqueChannels.length)
    for (const ch of uniqueChannels) {
      attributionByChannel[ch] = weight
      capitalByChannel[ch] = capPerChannel
    }

  } else if (model === 'time_decay') {
    const lastTime = new Date(touchpoints[touchpoints.length - 1].occurred_at).getTime()
    const rawWeights = touchpoints.map(tp => {
      const daysDiff = (lastTime - new Date(tp.occurred_at).getTime()) / 86_400_000
      return Math.pow(2, -daysDiff)
    })
    const totalWeight = rawWeights.reduce((s, w) => s + w, 0)
    const channelWeights: Partial<Record<TouchpointChannel, number>> = {}
    for (let i = 0; i < touchpoints.length; i++) {
      const ch = touchpoints[i].channel
      channelWeights[ch] = (channelWeights[ch] ?? 0) + (totalWeight > 0 ? rawWeights[i] / totalWeight : 0)
    }
    for (const [ch, w] of Object.entries(channelWeights) as Array<[TouchpointChannel, number]>) {
      attributionByChannel[ch] = w
      capitalByChannel[ch] = Math.round(capital * w)
    }

  } else if (model === 'capital_weighted') {
    const rawWeights = touchpoints.map(tp => {
      const v = tp.metadata.eur_cents_value
      return typeof v === 'number' && v > 0 ? v : 0
    })
    const totalWeight = rawWeights.reduce((s, w) => s + w, 0)
    if (totalWeight === 0) {
      // Fallback to linear across unique channels
      const uniqueChannels = [...new Set(touchpoints.map(t => t.channel))]
      const weight = 1 / uniqueChannels.length
      const capPerChannel = Math.round(capital / uniqueChannels.length)
      for (const ch of uniqueChannels) {
        attributionByChannel[ch] = weight
        capitalByChannel[ch] = capPerChannel
      }
    } else {
      const channelWeights: Partial<Record<TouchpointChannel, number>> = {}
      for (let i = 0; i < touchpoints.length; i++) {
        const ch = touchpoints[i].channel
        channelWeights[ch] = (channelWeights[ch] ?? 0) + rawWeights[i] / totalWeight
      }
      for (const [ch, w] of Object.entries(channelWeights) as Array<[TouchpointChannel, number]>) {
        attributionByChannel[ch] = w
        capitalByChannel[ch] = Math.round(capital * w)
      }
    }
  }
}

// ─── getChannelAttributionSummary ─────────────────────────────────────────────

/**
 * Aggregates attribution across all investors for all channels within windowDays.
 * Persists to channel_attribution_summaries. Returns array.
 */
export async function getChannelAttributionSummary(
  tenantId: string,
  model: AttributionModel,
  windowDays = 30,
): Promise<ChannelAttributionSummary[]> {
  const since = new Date(Date.now() - windowDays * 86_400_000).toISOString()

  const { data: results, error } = await (supabaseAdmin as any)
    .from('attribution_results')
    .select('investor_id, attribution_by_channel, attributed_capital_by_channel, touchpoints, computed_at')
    .eq('tenant_id', tenantId)
    .eq('model', model)
    .gte('computed_at', since)

  if (error) {
    log.warn('[attributionEngine] getChannelAttributionSummary error', { error })
  }

  const channelData: Record<string, {
    totalCapital: number
    investorIds: Set<string>
    touchpointCount: number
    convertedCount: number
    totalInvestors: number
  }> = {}

  for (const row of ((results ?? []) as Array<Record<string, unknown>>)) {
    const investorId = row.investor_id as string
    const attrByChannel = ((row.attribution_by_channel ?? {}) as Record<string, number>)
    const capitalByChannel = ((row.attributed_capital_by_channel ?? {}) as Record<string, number>)
    const tps = ((row.touchpoints ?? []) as Array<{ channel: string }>)

    for (const [ch, weight] of Object.entries(attrByChannel)) {
      if (!channelData[ch]) {
        channelData[ch] = {
          totalCapital: 0,
          investorIds: new Set(),
          touchpointCount: 0,
          convertedCount: 0,
          totalInvestors: 0,
        }
      }
      channelData[ch].totalCapital += capitalByChannel[ch] ?? 0
      channelData[ch].investorIds.add(investorId)
      channelData[ch].touchpointCount += tps.filter(t => t.channel === ch).length
      if (weight > 0) channelData[ch].convertedCount++
      channelData[ch].totalInvestors++
    }
  }

  const computedAt = new Date().toISOString()

  const summaries: ChannelAttributionSummary[] = Object.entries(channelData).map(([ch, data]) => {
    const avg = data.touchpointCount > 0
      ? Math.round(data.totalCapital / data.touchpointCount)
      : 0
    const conversionRate = data.totalInvestors > 0
      ? parseFloat(((data.convertedCount / data.totalInvestors) * 100).toFixed(2))
      : 0
    return {
      channel: ch as TouchpointChannel,
      tenant_id: tenantId,
      model,
      touchpoint_count: data.touchpointCount,
      investor_count: data.investorIds.size,
      total_attributed_capital_eur_cents: data.totalCapital,
      avg_capital_per_touchpoint_eur_cents: avg,
      conversion_rate_pct: conversionRate,
    }
  })

  for (const summary of summaries) {
    void (supabaseAdmin as any)
      .from('channel_attribution_summaries')
      .insert({
        tenant_id: summary.tenant_id,
        channel: summary.channel,
        model: summary.model,
        window_days: windowDays,
        touchpoint_count: summary.touchpoint_count,
        investor_count: summary.investor_count,
        total_attributed_capital_eur_cents: summary.total_attributed_capital_eur_cents,
        avg_capital_per_touchpoint_eur_cents: summary.avg_capital_per_touchpoint_eur_cents,
        conversion_rate_pct: summary.conversion_rate_pct,
        computed_at: computedAt,
      })
      .catch((e: unknown) => console.warn('[attributionEngine] persist channel_attribution_summaries', e))
  }

  log.info('[attributionEngine] getChannelAttributionSummary complete', {
    tenant_id: tenantId,
    model,
    windowDays,
    channels: summaries.length,
  })

  return summaries
}
