// Agency Group — Market Integrity Validation Engine
// lib/market-integrity/priceValidationEngine.ts
// Wave 46 Phase 6 — Validates market data integrity:
//   1. Detects stale listings (not updated in >24h)
//   2. Compares system prices vs external provider prices
//   3. Flags deviations >5% between system and market data
//   4. Checks provider sync freshness
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ── Tenant constant ────────────────────────────────────────────────────────────

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PriceDeviationRecord {
  property_id: string
  system_price_cents: bigint
  external_price_cents: bigint
  deviation_pct: number
  provider_name: string
  exceeds_threshold: boolean  // deviation_pct > 5
  last_synced_at: string
}

export interface StaleListing {
  property_id: string
  last_updated: string
  hours_stale: number
}

export interface ProviderSyncStatus {
  provider_name: string
  last_synced_at: string | null
  hours_since_sync: number | null
  is_stale: boolean
  records_in_db: number
}

export interface MarketIntegrityReport {
  report_id: string
  tenant_id: string
  validated_at: string

  // Staleness
  total_active_listings: number
  stale_listings_count: number
  stale_listings_pct: number
  staleness_check: 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA'
  stale_listings_sample: StaleListing[]

  // Price deviation
  properties_with_external_data: number
  properties_checked_for_deviation: number
  deviations_above_threshold: number
  max_deviation_pct: number
  avg_deviation_pct: number
  price_integrity_check: 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA'
  deviation_sample: PriceDeviationRecord[]

  // Provider sync
  provider_sync_statuses: ProviderSyncStatus[]
  providers_synced_recently: number
  providers_stale_count: number
  sync_check: 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA'

  // Overall
  overall_integrity: 'VERIFIED' | 'WARNINGS' | 'DATA_QUALITY_ISSUES' | 'NO_EXTERNAL_DATA'
  integrity_score: number
  issues: string[]
}

// ── Internal row types ─────────────────────────────────────────────────────────

interface PropertyRow {
  id: string
  price: number | null
  updated_at: string | null
  status: string | null
}

interface ExternalListingRow {
  external_id: string
  price_cents: string | number | null
  provider_name: string
  synced_at: string
  metadata: Record<string, unknown> | null
}

interface SyncLogRow {
  provider_name: string
  synced_at: string
  status: string
  records_synced: number | null
}

interface ExternalCountRow {
  provider_name: string
}

// ── Step 1: Staleness check ────────────────────────────────────────────────────

async function checkStaleness(now: Date): Promise<{
  total: number
  staleCount: number
  stalePct: number
  check: 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA'
  sample: StaleListing[]
  issues: string[]
}> {
  const issues: string[] = []
  const sample: StaleListing[] = []

  try {
    const { data: properties } = await supabaseAdmin
      .from('properties')
      .select('id, price, updated_at, status')
      .eq('status', 'active')
      .limit(2000)

    const rows = (properties as PropertyRow[] | null) ?? []

    if (rows.length === 0) {
      return { total: 0, staleCount: 0, stalePct: 0, check: 'INSUFFICIENT_DATA', sample, issues: ['No active listings found in properties table'] }
    }

    let staleCount = 0
    for (const row of rows) {
      const updatedAt = row.updated_at ?? ''
      const hoursStale = updatedAt
        ? (now.getTime() - new Date(updatedAt).getTime()) / 3_600_000
        : 9999

      if (hoursStale > 24) {
        staleCount++
        if (sample.length < 5) {
          sample.push({ property_id: row.id, last_updated: updatedAt, hours_stale: Math.round(hoursStale) })
        }
      }
    }

    const total = rows.length
    const stalePct = (staleCount / total) * 100

    let check: 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA'
    if (stalePct < 20) {
      check = 'PASS'
    } else {
      check = 'FAIL'
      issues.push(`${staleCount} of ${total} active listings (${stalePct.toFixed(1)}%) not updated in >24h`)
    }

    return { total, staleCount, stalePct, check, sample, issues }
  } catch (e) {
    return {
      total: 0, staleCount: 0, stalePct: 0,
      check: 'INSUFFICIENT_DATA',
      sample,
      issues: [`properties query failed: ${String(e)}`],
    }
  }
}

// ── Step 2: Price deviation check ─────────────────────────────────────────────

async function checkPriceDeviation(tenantId: string, now: Date): Promise<{
  propertiesWithExternal: number
  propertiesChecked: number
  deviationsAboveThreshold: number
  maxDeviationPct: number
  avgDeviationPct: number
  check: 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA'
  sample: PriceDeviationRecord[]
  issues: string[]
}> {
  const issues: string[] = []
  const deviationRecords: PriceDeviationRecord[] = []

  try {
    // Fetch external listings with possible internal_property_id in metadata
    const { data: externals } = await (supabaseAdmin as any)
      .from('external_property_listings')
      .select('external_id, price_cents, provider_name, synced_at, metadata')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)
      .limit(500)

    const extRows = (externals as ExternalListingRow[] | null) ?? []

    if (extRows.length === 0) {
      return {
        propertiesWithExternal: 0, propertiesChecked: 0,
        deviationsAboveThreshold: 0, maxDeviationPct: 0, avgDeviationPct: 0,
        check: 'INSUFFICIENT_DATA',
        sample: [],
        issues: ['No active external_property_listings found — provider sync may not have run yet'],
      }
    }

    // Build a set of internal property IDs to fetch
    const internalIds = extRows
      .map(r => r.metadata?.internal_property_id as string | undefined)
      .filter((id): id is string => typeof id === 'string' && id.length > 0)

    if (internalIds.length === 0) {
      return {
        propertiesWithExternal: 0, propertiesChecked: 0,
        deviationsAboveThreshold: 0, maxDeviationPct: 0, avgDeviationPct: 0,
        check: 'INSUFFICIENT_DATA',
        sample: [],
        issues: ['External listings not linked to internal properties (metadata.internal_property_id missing)'],
      }
    }

    const { data: internalProps } = await supabaseAdmin
      .from('properties')
      .select('id, price')
      .in('id', internalIds.slice(0, 500))

    const propMap = new Map<string, number>()
    for (const p of (internalProps as PropertyRow[] | null) ?? []) {
      propMap.set(p.id, p.price ?? 0)
    }

    let deviationsAbove = 0
    let totalDeviationPct = 0
    let maxDeviationPct = 0
    let checked = 0

    for (const ext of extRows) {
      const internalId = ext.metadata?.internal_property_id as string | undefined
      if (!internalId || !propMap.has(internalId)) continue

      const systemPriceCents = BigInt(Math.round((propMap.get(internalId) ?? 0) * 100))
      if (systemPriceCents === BigInt(0)) continue

      const externalPriceCents = BigInt(String(ext.price_cents ?? '0'))
      if (externalPriceCents === BigInt(0)) continue

      const diff = systemPriceCents > externalPriceCents
        ? systemPriceCents - externalPriceCents
        : externalPriceCents - systemPriceCents

      const deviationPct = Number(diff) / Number(systemPriceCents) * 100
      const exceedsThreshold = deviationPct > 5

      checked++
      totalDeviationPct += deviationPct
      if (deviationPct > maxDeviationPct) maxDeviationPct = deviationPct
      if (exceedsThreshold) deviationsAbove++

      deviationRecords.push({
        property_id: internalId,
        system_price_cents: systemPriceCents,
        external_price_cents: externalPriceCents,
        deviation_pct: Math.round(deviationPct * 100) / 100,
        provider_name: ext.provider_name,
        exceeds_threshold: exceedsThreshold,
        last_synced_at: ext.synced_at,
      })
    }

    if (checked === 0) {
      return {
        propertiesWithExternal: extRows.length, propertiesChecked: 0,
        deviationsAboveThreshold: 0, maxDeviationPct: 0, avgDeviationPct: 0,
        check: 'INSUFFICIENT_DATA',
        sample: [],
        issues: ['No matched property pairs found between internal and external listings'],
      }
    }

    const avgDeviationPct = totalDeviationPct / checked

    // Sample: worst 5 offenders (highest deviation)
    const sample = deviationRecords
      .sort((a, b) => b.deviation_pct - a.deviation_pct)
      .slice(0, 5)

    const check: 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA' = deviationsAbove === 0 ? 'PASS' : 'FAIL'
    if (deviationsAbove > 0) {
      issues.push(`${deviationsAbove} of ${checked} matched properties have price deviation >5% vs external market data`)
    }

    void now // suppress unused warning

    return {
      propertiesWithExternal: extRows.length,
      propertiesChecked: checked,
      deviationsAboveThreshold: deviationsAbove,
      maxDeviationPct: Math.round(maxDeviationPct * 100) / 100,
      avgDeviationPct: Math.round(avgDeviationPct * 100) / 100,
      check,
      sample,
      issues,
    }
  } catch (e) {
    return {
      propertiesWithExternal: 0, propertiesChecked: 0,
      deviationsAboveThreshold: 0, maxDeviationPct: 0, avgDeviationPct: 0,
      check: 'INSUFFICIENT_DATA',
      sample: [],
      issues: [`Price deviation check failed: ${String(e)}`],
    }
  }
}

// ── Step 3: Provider sync check ────────────────────────────────────────────────

async function checkProviderSync(tenantId: string, now: Date): Promise<{
  statuses: ProviderSyncStatus[]
  syncedRecently: number
  staleCount: number
  check: 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA'
  issues: string[]
}> {
  const issues: string[] = []

  try {
    const { data: syncLogs } = await (supabaseAdmin as any)
      .from('provider_sync_logs')
      .select('provider_name, synced_at, status, records_synced')
      .eq('tenant_id', tenantId)
      .order('synced_at', { ascending: false })
      .limit(100)

    const logs = (syncLogs as SyncLogRow[] | null) ?? []

    // Get latest sync per provider
    const latestByProvider = new Map<string, SyncLogRow>()
    for (const row of logs) {
      if (!latestByProvider.has(row.provider_name)) {
        latestByProvider.set(row.provider_name, row)
      }
    }

    // Get record counts per provider from external_property_listings
    const { data: extCounts } = await (supabaseAdmin as any)
      .from('external_property_listings')
      .select('provider_name')
      .eq('tenant_id', tenantId)
      .eq('is_active', true)

    const countByProvider = new Map<string, number>()
    for (const row of (extCounts as ExternalCountRow[] | null) ?? []) {
      countByProvider.set(row.provider_name, (countByProvider.get(row.provider_name) ?? 0) + 1)
    }

    if (latestByProvider.size === 0) {
      return {
        statuses: [], syncedRecently: 0, staleCount: 0,
        check: 'INSUFFICIENT_DATA',
        issues: ['No provider sync logs found — provider sync has not run yet'],
      }
    }

    const statuses: ProviderSyncStatus[] = []
    let syncedRecently = 0
    let staleCount = 0

    for (const [providerName, row] of latestByProvider) {
      const hoursSinceSync = row.synced_at
        ? (now.getTime() - new Date(row.synced_at).getTime()) / 3_600_000
        : null

      const isStale = hoursSinceSync === null || hoursSinceSync > 24

      statuses.push({
        provider_name: providerName,
        last_synced_at: row.synced_at ?? null,
        hours_since_sync: hoursSinceSync !== null ? Math.round(hoursSinceSync * 10) / 10 : null,
        is_stale: isStale,
        records_in_db: countByProvider.get(providerName) ?? 0,
      })

      if (!isStale) syncedRecently++
      else staleCount++
    }

    let check: 'PASS' | 'FAIL' | 'INSUFFICIENT_DATA'
    if (staleCount === 0) {
      check = 'PASS'
    } else {
      check = 'FAIL'
      issues.push(`${staleCount} of ${statuses.length} providers not synced in last 24h`)
    }

    return { statuses, syncedRecently, staleCount, check, issues }
  } catch (e) {
    return {
      statuses: [], syncedRecently: 0, staleCount: 0,
      check: 'INSUFFICIENT_DATA',
      issues: [`Provider sync check failed: ${String(e)}`],
    }
  }
}

// ── runMarketIntegrityValidation ───────────────────────────────────────────────

export async function runMarketIntegrityValidation(tenantId: string): Promise<MarketIntegrityReport> {
  const now = new Date()
  const reportId = randomUUID()
  const allIssues: string[] = []

  const [stalenessResult, deviationResult, syncResult] = await Promise.all([
    checkStaleness(now),
    checkPriceDeviation(tenantId, now),
    checkProviderSync(tenantId, now),
  ])

  allIssues.push(...stalenessResult.issues, ...deviationResult.issues, ...syncResult.issues)

  // Score calculation
  let score = 100
  if (stalenessResult.check === 'FAIL') score -= 20
  if (deviationResult.check === 'FAIL') score -= 30
  if (syncResult.check === 'FAIL') score -= 20
  score -= Math.min(allIssues.length * 5, 30)
  score = Math.max(0, score)

  // Overall integrity
  const hasNoExternal =
    deviationResult.check === 'INSUFFICIENT_DATA' &&
    syncResult.check === 'INSUFFICIENT_DATA'

  let overall_integrity: MarketIntegrityReport['overall_integrity']
  if (hasNoExternal) {
    overall_integrity = 'NO_EXTERNAL_DATA'
  } else if (score >= 80 && deviationResult.deviationsAboveThreshold === 0) {
    overall_integrity = 'VERIFIED'
  } else if (score >= 60 || deviationResult.deviationsAboveThreshold <= 3) {
    overall_integrity = 'WARNINGS'
  } else {
    overall_integrity = 'DATA_QUALITY_ISSUES'
  }

  log.info('[priceValidationEngine] market integrity check complete', {
    report_id: reportId,
    overall_integrity,
    integrity_score: score,
    tenantId,
  })

  return {
    report_id: reportId,
    tenant_id: tenantId,
    validated_at: now.toISOString(),

    total_active_listings: stalenessResult.total,
    stale_listings_count: stalenessResult.staleCount,
    stale_listings_pct: Math.round(stalenessResult.stalePct * 100) / 100,
    staleness_check: stalenessResult.check,
    stale_listings_sample: stalenessResult.sample,

    properties_with_external_data: deviationResult.propertiesWithExternal,
    properties_checked_for_deviation: deviationResult.propertiesChecked,
    deviations_above_threshold: deviationResult.deviationsAboveThreshold,
    max_deviation_pct: deviationResult.maxDeviationPct,
    avg_deviation_pct: deviationResult.avgDeviationPct,
    price_integrity_check: deviationResult.check,
    deviation_sample: deviationResult.sample,

    provider_sync_statuses: syncResult.statuses,
    providers_synced_recently: syncResult.syncedRecently,
    providers_stale_count: syncResult.staleCount,
    sync_check: syncResult.check,

    overall_integrity,
    integrity_score: score,
    issues: allIssues,
  }
}

// ── runAndPersistMarketIntegrity ───────────────────────────────────────────────

export async function runAndPersistMarketIntegrity(
  tenantId: string = TENANT_ID,
): Promise<MarketIntegrityReport> {
  const report = await runMarketIntegrityValidation(tenantId)

  // Convert bigint fields in deviation_sample to strings for JSONB storage
  const deviationSampleSafe = report.deviation_sample.map(r => ({
    ...r,
    system_price_cents: r.system_price_cents.toString(),
    external_price_cents: r.external_price_cents.toString(),
  }))

  void (supabaseAdmin as any)
    .from('market_integrity_checks')
    .insert({
      report_id: report.report_id,
      tenant_id: report.tenant_id,
      validated_at: report.validated_at,
      total_active_listings: report.total_active_listings,
      stale_listings_count: report.stale_listings_count,
      stale_listings_pct: report.stale_listings_pct,
      staleness_check: report.staleness_check,
      properties_with_external_data: report.properties_with_external_data,
      deviations_above_threshold: report.deviations_above_threshold,
      max_deviation_pct: report.max_deviation_pct,
      avg_deviation_pct: report.avg_deviation_pct,
      price_integrity_check: report.price_integrity_check,
      sync_check: report.sync_check,
      overall_integrity: report.overall_integrity,
      integrity_score: report.integrity_score,
      issues: report.issues,
      deviation_sample: deviationSampleSafe,
      provider_sync_statuses: report.provider_sync_statuses,
    })
    .catch((e: unknown) => log.warn('[priceValidationEngine] persist failed', { e: String(e) }))

  return report
}
