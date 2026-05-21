// Agency Group — Growth Signal Collector
// lib/growth/growthSignalCollector.ts
// Auto-collects economic signals from existing tables.
// Bridges existing capital/bid/settlement data into the growth graph.
// Runs as a periodic collector — does NOT duplicate existing data.
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { recordEconomicSignal } from './economicGrowthGraph'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CollectionResult {
  tenant_id: string
  collected_at: string
  signals_collected: number
  entities_indexed: number
  new_edges: number
  collection_errors: number
  duration_ms: number
}

// ─── collectFromBids ──────────────────────────────────────────────────────────

/**
 * Reads asset_bids submitted since sinceHours ago.
 * Records investor→asset BID_SUBMITTED signals.
 * Returns count of signals collected.
 */
export async function collectFromBids(
  tenantId: string,
  sinceHours = 24,
): Promise<number> {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString()

  const res = await (supabaseAdmin as any)
    .from('asset_bids')
    .select('investor_id, asset_id, amount_eur_cents, submitted_at')
    .eq('tenant_id', tenantId)
    .gte('submitted_at', since)

  const bids: Array<{
    investor_id: string
    asset_id: string
    amount_eur_cents: number
    submitted_at: string
  }> = (res.data ?? []) as Array<{
    investor_id: string
    asset_id: string
    amount_eur_cents: number
    submitted_at: string
  }>

  let count = 0
  for (const bid of bids) {
    if (!bid.investor_id || !bid.asset_id) continue
    try {
      await recordEconomicSignal({
        tenant_id: tenantId,
        from_entity_id: bid.investor_id,
        from_type: 'investor',
        to_entity_id: bid.asset_id,
        to_type: 'asset',
        signal_type: 'BID_SUBMITTED',
        eur_cents_value: bid.amount_eur_cents ?? undefined,
        metadata: { submitted_at: bid.submitted_at, source: 'asset_bids' },
      })
      count++
    } catch (err) {
      console.warn('[growthSignalCollector] collectFromBids signal error', { err: String(err), bid })
    }
  }

  log.info('[growthSignalCollector] collectFromBids', { count, sinceHours })
  return count
}

// ─── collectFromLedger ────────────────────────────────────────────────────────

/**
 * Reads investor_ledger_entries DEPOSIT entries since sinceHours ago.
 * Records investor→capital_flow CAPITAL_DEPOSIT signals.
 * Returns count of signals collected.
 */
export async function collectFromLedger(
  tenantId: string,
  sinceHours = 24,
): Promise<number> {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString()

  const res = await (supabaseAdmin as any)
    .from('investor_ledger_entries')
    .select('investor_id, amount_eur_cents, entry_type, created_at, id')
    .eq('tenant_id', tenantId)
    .eq('entry_type', 'DEPOSIT')
    .gte('created_at', since)

  const entries: Array<{
    investor_id: string
    amount_eur_cents: number
    entry_type: string
    created_at: string
    id: string
  }> = (res.data ?? []) as Array<{
    investor_id: string
    amount_eur_cents: number
    entry_type: string
    created_at: string
    id: string
  }>

  let count = 0
  for (const entry of entries) {
    if (!entry.investor_id) continue
    try {
      await recordEconomicSignal({
        tenant_id: tenantId,
        from_entity_id: entry.investor_id,
        from_type: 'investor',
        to_entity_id: entry.id,
        to_type: 'capital_flow',
        signal_type: 'CAPITAL_DEPOSIT',
        eur_cents_value: entry.amount_eur_cents ?? undefined,
        metadata: { created_at: entry.created_at, source: 'investor_ledger_entries' },
      })
      count++
    } catch (err) {
      console.warn('[growthSignalCollector] collectFromLedger signal error', { err: String(err) })
    }
  }

  log.info('[growthSignalCollector] collectFromLedger', { count, sinceHours })
  return count
}

// ─── collectFromSettlements ───────────────────────────────────────────────────

/**
 * Reads settlements that transitioned to TRANSFERRED since sinceHours ago.
 * Records DEAL_EXECUTION + ROI_REALIZED signals.
 * Returns count of signals collected.
 */
export async function collectFromSettlements(
  tenantId: string,
  sinceHours = 24,
): Promise<number> {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString()

  const res = await (supabaseAdmin as any)
    .from('settlements')
    .select('id, investor_id, asset_id, amount_eur_cents, roi_pct, updated_at, state')
    .eq('tenant_id', tenantId)
    .eq('state', 'TRANSFERRED')
    .gte('updated_at', since)

  const settlements: Array<{
    id: string
    investor_id: string
    asset_id: string
    amount_eur_cents: number
    roi_pct: number | null
    updated_at: string
    state: string
  }> = (res.data ?? []) as Array<{
    id: string
    investor_id: string
    asset_id: string
    amount_eur_cents: number
    roi_pct: number | null
    updated_at: string
    state: string
  }>

  let count = 0
  for (const settlement of settlements) {
    if (!settlement.investor_id || !settlement.asset_id) continue
    try {
      // DEAL_EXECUTION signal
      await recordEconomicSignal({
        tenant_id: tenantId,
        from_entity_id: settlement.investor_id,
        from_type: 'investor',
        to_entity_id: settlement.asset_id,
        to_type: 'asset',
        signal_type: 'DEAL_EXECUTION',
        eur_cents_value: settlement.amount_eur_cents ?? undefined,
        metadata: { settlement_id: settlement.id, updated_at: settlement.updated_at, source: 'settlements' },
      })
      count++

      // ROI_REALIZED signal (if roi_pct available)
      if (settlement.roi_pct != null && settlement.roi_pct > 0) {
        const roiCents = Math.round((settlement.amount_eur_cents ?? 0) * (settlement.roi_pct / 100))
        await recordEconomicSignal({
          tenant_id: tenantId,
          from_entity_id: settlement.asset_id,
          from_type: 'asset',
          to_entity_id: settlement.investor_id,
          to_type: 'investor',
          signal_type: 'ROI_REALIZED',
          eur_cents_value: roiCents,
          metadata: {
            settlement_id: settlement.id,
            roi_pct: settlement.roi_pct,
            source: 'settlements',
          },
        })
        count++
      }
    } catch (err) {
      console.warn('[growthSignalCollector] collectFromSettlements signal error', { err: String(err) })
    }
  }

  log.info('[growthSignalCollector] collectFromSettlements', { count, sinceHours })
  return count
}

// ─── collectFromDeals ─────────────────────────────────────────────────────────

/**
 * Reads deals (existing CRM table) updated since sinceHours ago.
 * Maps stage to LEAD_CREATED, LEAD_QUALIFIED, DEAL_EXECUTION signals.
 * Returns count of signals collected.
 */
export async function collectFromDeals(
  tenantId: string,
  sinceHours = 24,
): Promise<number> {
  const since = new Date(Date.now() - sinceHours * 60 * 60 * 1000).toISOString()

  const res = await (supabaseAdmin as any)
    .from('deals')
    .select('id, contact_id, asset_id, stage, amount_eur_cents, updated_at')
    .eq('tenant_id', tenantId)
    .gte('updated_at', since)

  const deals: Array<{
    id: string
    contact_id: string | null
    asset_id: string | null
    stage: string
    amount_eur_cents: number | null
    updated_at: string
  }> = (res.data ?? []) as Array<{
    id: string
    contact_id: string | null
    asset_id: string | null
    stage: string
    amount_eur_cents: number | null
    updated_at: string
  }>

  let count = 0
  for (const deal of deals) {
    const fromId = deal.contact_id ?? deal.id
    const toId = deal.asset_id ?? deal.id

    const stageUpper = (deal.stage ?? '').toUpperCase()
    let signalType: 'LEAD_CREATED' | 'LEAD_QUALIFIED' | 'DEAL_EXECUTION' | null = null

    if (stageUpper === 'NEW' || stageUpper === 'LEAD' || stageUpper === 'CREATED') {
      signalType = 'LEAD_CREATED'
    } else if (
      stageUpper === 'QUALIFIED' ||
      stageUpper === 'PROPOSAL' ||
      stageUpper === 'NEGOTIATION'
    ) {
      signalType = 'LEAD_QUALIFIED'
    } else if (
      stageUpper === 'WON' ||
      stageUpper === 'CLOSED' ||
      stageUpper === 'EXECUTED' ||
      stageUpper === 'SIGNED'
    ) {
      signalType = 'DEAL_EXECUTION'
    }

    if (!signalType) continue

    try {
      await recordEconomicSignal({
        tenant_id: tenantId,
        from_entity_id: fromId,
        from_type: deal.contact_id ? 'lead' : 'broker',
        to_entity_id: toId,
        to_type: 'asset',
        signal_type: signalType,
        eur_cents_value: deal.amount_eur_cents ?? undefined,
        metadata: { deal_id: deal.id, stage: deal.stage, updated_at: deal.updated_at, source: 'deals' },
      })
      count++
    } catch (err) {
      console.warn('[growthSignalCollector] collectFromDeals signal error', { err: String(err) })
    }
  }

  log.info('[growthSignalCollector] collectFromDeals', { count, sinceHours })
  return count
}

// ─── runFullCollection ────────────────────────────────────────────────────────

/**
 * Runs all 4 collectors via Promise.allSettled.
 * Aggregates results and persists to signal_collection_runs.
 */
export async function runFullCollection(
  tenantId: string,
  sinceHours = 24,
): Promise<CollectionResult> {
  const startMs = Date.now()

  const results = await Promise.allSettled([
    collectFromBids(tenantId, sinceHours),
    collectFromLedger(tenantId, sinceHours),
    collectFromSettlements(tenantId, sinceHours),
    collectFromDeals(tenantId, sinceHours),
  ])

  let signalsCollected = 0
  let collectionErrors = 0

  for (const r of results) {
    if (r.status === 'fulfilled') {
      signalsCollected += r.value
    } else {
      collectionErrors++
      console.warn('[growthSignalCollector] collector failed', r.reason)
    }
  }

  const durationMs = Date.now() - startMs

  const collectionResult: CollectionResult = {
    tenant_id: tenantId,
    collected_at: new Date().toISOString(),
    signals_collected: signalsCollected,
    entities_indexed: signalsCollected * 2, // each signal touches 2 nodes
    new_edges: signalsCollected,
    collection_errors: collectionErrors,
    duration_ms: durationMs,
  }

  void (supabaseAdmin as any)
    .from('signal_collection_runs')
    .insert({
      tenant_id: collectionResult.tenant_id,
      collected_at: collectionResult.collected_at,
      signals_collected: collectionResult.signals_collected,
      entities_indexed: collectionResult.entities_indexed,
      new_edges: collectionResult.new_edges,
      collection_errors: collectionResult.collection_errors,
      duration_ms: collectionResult.duration_ms,
    })
    .catch((e: unknown) => console.warn('[growthSignalCollector] persist run', e))

  log.info('[growthSignalCollector] full collection complete', {
    signals_collected: signalsCollected,
    collection_errors: collectionErrors,
    duration_ms: durationMs,
  })

  return collectionResult
}
