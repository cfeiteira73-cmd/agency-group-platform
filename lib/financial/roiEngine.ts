// Agency Group — ROI Engine
// lib/financial/roiEngine.ts
// ROI per channel, agent, market zone. Real revenue intelligence.

import log from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ROIDimension {
  dimension: string
  value: string
  deal_count: number
  total_revenue_eur: number
  avg_deal_value_eur: number
  avg_cycle_days: number
  roi_score: number
}

export interface ROIReport {
  tenant_id: string
  generated_at: string
  by_channel: ROIDimension[]
  by_zone: ROIDimension[]
  top_channel: string | null
  top_zone: string | null
  avg_roi_score: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COMMISSION_RATE = 0.05

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractValue(row: Record<string, unknown>): number {
  const candidates = ['valor', 'price', 'value', 'amount', 'deal_value']
  for (const key of candidates) {
    const v = row[key]
    if (v !== null && v !== undefined && !isNaN(Number(v))) {
      return Number(v)
    }
  }
  return 0
}

function extractChannel(
  deal: Record<string, unknown>,
  contact: Record<string, unknown> | null,
): string {
  const candidates = [
    deal['channel_origin'],
    deal['channel'],
    deal['source'],
    contact?.['source'],
    contact?.['channel'],
    contact?.['origem'],
    contact?.['lead_source'],
  ]
  for (const c of candidates) {
    if (c && typeof c === 'string' && c.trim().length > 0) return c.trim()
  }
  return 'UNKNOWN'
}

function extractZone(deal: Record<string, unknown>): string {
  const candidates = [
    deal['zone'],
    deal['zona'],
    deal['location'],
    deal['city'],
    deal['cidade'],
    deal['region'],
  ]
  for (const c of candidates) {
    if (c && typeof c === 'string' && c.trim().length > 0) return c.trim()
  }
  return 'UNKNOWN'
}

function daysBetween(from: string | null, to: string | null): number {
  if (!from) return 90
  const toDate = to ? new Date(to) : new Date()
  const diff = toDate.getTime() - new Date(from).getTime()
  return Math.max(1, diff / (1000 * 60 * 60 * 24))
}

function computeRoiScore(
  totalRevenue: number,
  dealCount: number,
  avgCycleDays: number,
): number {
  if (dealCount === 0 || avgCycleDays === 0) return 0
  const raw = (totalRevenue / dealCount / avgCycleDays) * 100
  return Math.round(raw * 100) / 100
}

function aggregateDimension(
  deals: Record<string, unknown>[],
  keyFn: (deal: Record<string, unknown>) => string,
  dimensionName: string,
): ROIDimension[] {
  const map = new Map<
    string,
    {
      deal_count: number
      total_value: number
      total_cycle_days: number
    }
  >()

  for (const deal of deals) {
    const key = keyFn(deal) || 'UNKNOWN'
    const entry = map.get(key) ?? { deal_count: 0, total_value: 0, total_cycle_days: 0 }
    const val = extractValue(deal)
    const cycle = daysBetween(
      String(deal['created_at'] ?? ''),
      String(deal['closed_at'] ?? deal['updated_at'] ?? ''),
    )
    entry.deal_count++
    entry.total_value += val
    entry.total_cycle_days += cycle
    map.set(key, entry)
  }

  const results: ROIDimension[] = []
  for (const [dimValue, entry] of map.entries()) {
    const total_revenue_eur =
      Math.round(entry.total_value * COMMISSION_RATE * 100) / 100
    const avg_deal_value_eur =
      entry.deal_count > 0
        ? Math.round((entry.total_value / entry.deal_count) * 100) / 100
        : 0
    const avg_cycle_days =
      entry.deal_count > 0
        ? Math.round((entry.total_cycle_days / entry.deal_count) * 100) / 100
        : 0
    const roi_score = computeRoiScore(
      total_revenue_eur,
      entry.deal_count,
      avg_cycle_days,
    )

    results.push({
      dimension: dimensionName,
      value: dimValue,
      deal_count: entry.deal_count,
      total_revenue_eur,
      avg_deal_value_eur,
      avg_cycle_days,
      roi_score,
    })
  }

  return results.sort((a, b) => b.total_revenue_eur - a.total_revenue_eur)
}

// ─── Main Function ────────────────────────────────────────────────────────────

export async function computeROI(tenantId: string): Promise<ROIReport> {
  const generated_at = new Date().toISOString()

  log.info('[roiEngine] computing ROI report', { tenantId })

  // Query deals with contact join
  const { data: deals, error: dealsError } = await (supabaseAdmin as any)
    .from('deals')
    .select('*, contacts(*)')
    .eq('tenant_id', tenantId)

  if (dealsError) {
    log.info('[roiEngine] deals query error — using empty dataset', {
      tenantId,
      error: dealsError.message,
    })
  }

  const rows: Record<string, unknown>[] = Array.isArray(deals) ? deals : []

  // ── By channel ────────────────────────────────────────────────────────────
  const by_channel = aggregateDimension(
    rows,
    (deal) => {
      const contact = (deal['contacts'] as Record<string, unknown> | null) ?? null
      return extractChannel(deal, contact)
    },
    'channel',
  )

  // ── By zone ───────────────────────────────────────────────────────────────
  const by_zone = aggregateDimension(rows, (deal) => extractZone(deal), 'zone')

  // ── Scores ────────────────────────────────────────────────────────────────
  const top_channel = by_channel.length > 0 ? (by_channel[0]!.value) : null
  const top_zone = by_zone.length > 0 ? (by_zone[0]!.value) : null

  const allDimensions = [...by_channel, ...by_zone]
  const avg_roi_score =
    allDimensions.length > 0
      ? Math.round(
          (allDimensions.reduce((s, d) => s + d.roi_score, 0) /
            allDimensions.length) *
            100,
        ) / 100
      : 0

  const report: ROIReport = {
    tenant_id: tenantId,
    generated_at,
    by_channel,
    by_zone,
    top_channel,
    top_zone,
    avg_roi_score,
  }

  // ── Persist to roi_reports ────────────────────────────────────────────────
  void (supabaseAdmin as any)
    .from('roi_reports')
    .insert({
      tenant_id: tenantId,
      generated_at,
      top_channel,
      top_zone,
      avg_roi_score,
      by_channel,
      by_zone,
    })
    .then(({ error: e }: { error: { message: string } | null }) => {
      if (e) log.info('[roiEngine] persist warn', { error: e.message })
    })
    .catch((e: unknown) => console.warn('[roiEngine] persist error', e))

  log.info('[roiEngine] ROI report complete', {
    tenantId,
    top_channel,
    top_zone,
    avg_roi_score,
    channels: by_channel.length,
    zones: by_zone.length,
  })

  return report
}
