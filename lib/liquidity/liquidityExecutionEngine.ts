// =============================================================================
// Agency Group — Liquidity Execution Engine v1.0
// lib/liquidity/liquidityExecutionEngine.ts
//
// Manages real external liquidity: connects to external buyers/sellers,
// confirms real estate closings outside the system, feeds ML reality engine.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { randomUUID } from 'crypto'
import { recordRealOutcome } from '@/lib/ml-reality/mlRealityAlignmentEngine'

// ─── Types ────────────────────────────────────────────────────────────────────

export type LiquidityProviderType =
  | 'INSTITUTIONAL_BUYER'
  | 'RETAIL_BUYER'
  | 'INVESTMENT_FUND'
  | 'FAMILY_OFFICE'
  | 'PLATFORM_POOL'

export interface ExternalLiquidityProvider {
  provider_id: string
  tenant_id: string
  name: string
  provider_type: LiquidityProviderType
  country: string
  available_capital_eur_cents: number
  preferred_asset_types: string[]
  preferred_markets: string[] // country:city
  kyc_status: 'VERIFIED' | 'PENDING' | 'REJECTED'
  contact_email: string
  last_active_at: string
  created_at: string
}

export interface LiquidityMatch {
  match_id: string
  tenant_id: string
  asset_id: string
  provider_id: string
  matched_capital_eur_cents: number
  match_score: number // 0–1
  status: 'PROPOSED' | 'ACCEPTED' | 'REJECTED' | 'EXECUTED' | 'EXPIRED'
  proposed_at: string
  responded_at: string | null
  executed_at: string | null
}

// ─── Internal row shapes ──────────────────────────────────────────────────────

interface ProviderRow {
  provider_id: string
  tenant_id: string
  name: string
  provider_type: string
  country: string
  available_capital_eur_cents: number
  preferred_asset_types: string[]
  preferred_markets: string[]
  kyc_status: string
  contact_email: string
  last_active_at: string
  created_at: string
}

interface MatchRow {
  match_id: string
  tenant_id: string
  asset_id: string
  provider_id: string
  matched_capital_eur_cents: number
  match_score: number
  status: string
  proposed_at: string
  responded_at: string | null
  executed_at: string | null
}

function rowToProvider(row: ProviderRow): ExternalLiquidityProvider {
  return {
    provider_id: row.provider_id,
    tenant_id: row.tenant_id,
    name: row.name,
    provider_type: row.provider_type as LiquidityProviderType,
    country: row.country,
    available_capital_eur_cents: row.available_capital_eur_cents,
    preferred_asset_types: row.preferred_asset_types ?? [],
    preferred_markets: row.preferred_markets ?? [],
    kyc_status: row.kyc_status as ExternalLiquidityProvider['kyc_status'],
    contact_email: row.contact_email,
    last_active_at: row.last_active_at,
    created_at: row.created_at,
  }
}

function rowToMatch(row: MatchRow): LiquidityMatch {
  return {
    match_id: row.match_id,
    tenant_id: row.tenant_id,
    asset_id: row.asset_id,
    provider_id: row.provider_id,
    matched_capital_eur_cents: row.matched_capital_eur_cents,
    match_score: row.match_score,
    status: row.status as LiquidityMatch['status'],
    proposed_at: row.proposed_at,
    responded_at: row.responded_at,
    executed_at: row.executed_at,
  }
}

// ─── registerLiquidityProvider ────────────────────────────────────────────────

export async function registerLiquidityProvider(
  provider: Omit<ExternalLiquidityProvider, 'provider_id' | 'created_at'>,
  tenantId: string,
): Promise<ExternalLiquidityProvider> {
  log.info('[liquidityExecutionEngine] registerLiquidityProvider', {
    name: provider.name,
    tenantId,
  })

  const providerId = `lp_${randomUUID()}`
  const createdAt = new Date().toISOString()

  const row: ProviderRow = {
    provider_id: providerId,
    tenant_id: tenantId,
    name: provider.name,
    provider_type: provider.provider_type,
    country: provider.country,
    available_capital_eur_cents: provider.available_capital_eur_cents,
    preferred_asset_types: provider.preferred_asset_types,
    preferred_markets: provider.preferred_markets,
    kyc_status: provider.kyc_status,
    contact_email: provider.contact_email,
    last_active_at: provider.last_active_at,
    created_at: createdAt,
  }

  const { error } = await (supabaseAdmin as any).from('external_liquidity_providers').insert(row)

  if (error) {
    log.error(
      '[liquidityExecutionEngine] registerLiquidityProvider failed',
      new Error(error.message),
      { providerId },
    )
    throw new Error(`registerLiquidityProvider failed: ${error.message}`)
  }

  log.info('[liquidityExecutionEngine] provider registered', { providerId, name: provider.name })
  return rowToProvider(row)
}

// ─── matchAssetToLiquidity ────────────────────────────────────────────────────

/**
 * Reads verified providers with sufficient capital.
 * Scores by: capital fit (40%) + market preference (30%) + asset type (30%).
 * Creates LiquidityMatch for top 3 providers.
 */
export async function matchAssetToLiquidity(
  assetId: string,
  requiredCapitalEurCents: number,
  tenantId: string,
): Promise<LiquidityMatch[]> {
  log.info('[liquidityExecutionEngine] matchAssetToLiquidity', {
    assetId,
    requiredCapitalEurCents,
    tenantId,
  })

  // Fetch verified providers with enough capital
  const { data: providers, error } = await (supabaseAdmin as any)
    .from('external_liquidity_providers')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('kyc_status', 'VERIFIED')
    .gte('available_capital_eur_cents', requiredCapitalEurCents)

  if (error) {
    log.warn('[liquidityExecutionEngine] matchAssetToLiquidity query error', {
      error: error.message,
    })
    return []
  }

  const eligibleProviders: ProviderRow[] = (providers as ProviderRow[] | null) ?? []

  // Score providers
  const scored = eligibleProviders.map((p) => {
    // Capital fit: ratio of required to available (closer to 1.0 = better fit, penalise overcapacity)
    const capitalRatio = requiredCapitalEurCents / p.available_capital_eur_cents
    const capitalFit = capitalRatio <= 1 ? capitalRatio : 1 / capitalRatio

    // Market preference: check if any preferred market matches (simplified: 1.0 if matches, 0.5 if generic)
    const marketScore =
      p.preferred_markets.length === 0
        ? 0.5
        : p.preferred_markets.some((m: string) => m.startsWith('PT') || m.startsWith('ES'))
          ? 1.0
          : 0.3

    // Asset type: residential preferred
    const assetScore =
      p.preferred_asset_types.length === 0
        ? 0.5
        : p.preferred_asset_types.some(
              (t: string) => t.toLowerCase().includes('residential') || t.toLowerCase() === 'all',
            )
          ? 1.0
          : 0.4

    const matchScore = capitalFit * 0.4 + marketScore * 0.3 + assetScore * 0.3

    return { provider: p, matchScore }
  })

  // Top 3 by score
  const top3 = scored.sort((a, b) => b.matchScore - a.matchScore).slice(0, 3)

  const proposedAt = new Date().toISOString()

  const matches: LiquidityMatch[] = await Promise.all(
    top3.map(async ({ provider, matchScore }) => {
      const matchId = `match_${randomUUID()}`
      const matchRow: MatchRow = {
        match_id: matchId,
        tenant_id: tenantId,
        asset_id: assetId,
        provider_id: provider.provider_id,
        matched_capital_eur_cents: requiredCapitalEurCents,
        match_score: Math.round(matchScore * 1000) / 1000,
        status: 'PROPOSED',
        proposed_at: proposedAt,
        responded_at: null,
        executed_at: null,
      }

      void (supabaseAdmin as any)
        .from('liquidity_matches')
        .insert(matchRow)
        .then(({ error: e }: { error: { message: string } | null }) => {
          if (e)
            log.warn('[liquidityExecutionEngine] liquidity_matches insert failed', {
              error: e.message,
            })
        })

      return rowToMatch(matchRow)
    }),
  )

  log.info('[liquidityExecutionEngine] liquidity matches created', {
    assetId,
    matchCount: matches.length,
  })
  return matches
}

// ─── confirmLiquidityExecution ────────────────────────────────────────────────

/**
 * Marks match as EXECUTED. Updates provider available_capital (subtract matched amount).
 */
export async function confirmLiquidityExecution(
  matchId: string,
  tenantId: string,
): Promise<void> {
  log.info('[liquidityExecutionEngine] confirmLiquidityExecution', { matchId, tenantId })

  // Fetch match
  const { data: matchData, error: matchErr } = await (supabaseAdmin as any)
    .from('liquidity_matches')
    .select('*')
    .eq('match_id', matchId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (matchErr || !matchData) {
    log.warn('[liquidityExecutionEngine] match not found', { matchId })
    return
  }

  const match = matchData as MatchRow
  const executedAt = new Date().toISOString()

  // Mark EXECUTED
  await (supabaseAdmin as any)
    .from('liquidity_matches')
    .update({ status: 'EXECUTED', executed_at: executedAt })
    .eq('match_id', matchId)
    .eq('tenant_id', tenantId)

  // Fetch provider current capital
  const { data: providerData } = await (supabaseAdmin as any)
    .from('external_liquidity_providers')
    .select('available_capital_eur_cents')
    .eq('provider_id', match.provider_id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (providerData) {
    const currentCapital = (providerData as { available_capital_eur_cents: number })
      .available_capital_eur_cents
    const newCapital = Math.max(0, currentCapital - match.matched_capital_eur_cents)

    void (supabaseAdmin as any)
      .from('external_liquidity_providers')
      .update({ available_capital_eur_cents: newCapital, last_active_at: executedAt })
      .eq('provider_id', match.provider_id)
      .eq('tenant_id', tenantId)
      .then(({ error: e }: { error: { message: string } | null }) => {
        if (e)
          log.warn('[liquidityExecutionEngine] capital update failed', { error: e.message })
      })
  }

  log.info('[liquidityExecutionEngine] execution confirmed', { matchId })
}

// ─── getLiquidityDepth ────────────────────────────────────────────────────────

/**
 * Aggregates available capital from all verified providers.
 * Optionally filters by market (e.g. 'PT:Lisboa').
 */
export async function getLiquidityDepth(
  tenantId: string,
  market?: string,
): Promise<{ available_eur_cents: number; providers: number; by_type: Record<string, number> }> {
  log.info('[liquidityExecutionEngine] getLiquidityDepth', { tenantId, market })

  const { data, error } = await (supabaseAdmin as any)
    .from('external_liquidity_providers')
    .select('available_capital_eur_cents, provider_type, preferred_markets')
    .eq('tenant_id', tenantId)
    .eq('kyc_status', 'VERIFIED')

  if (error) {
    log.warn('[liquidityExecutionEngine] getLiquidityDepth error', { error: error.message })
    return { available_eur_cents: 0, providers: 0, by_type: {} }
  }

  let rows: ProviderRow[] = (data as ProviderRow[] | null) ?? []

  // Filter by market if provided
  if (market) {
    rows = rows.filter(
      (r) => r.preferred_markets.length === 0 || r.preferred_markets.includes(market),
    )
  }

  const totalCapital = rows.reduce((sum, r) => sum + r.available_capital_eur_cents, 0)
  const byType: Record<string, number> = {}

  for (const row of rows) {
    const t = row.provider_type
    byType[t] = (byType[t] ?? 0) + row.available_capital_eur_cents
  }

  return {
    available_eur_cents: totalCapital,
    providers: rows.length,
    by_type: byType,
  }
}

// ─── confirmExternalClosing ───────────────────────────────────────────────────

/**
 * Records an external closing confirmation. Fires signal to ML reality engine
 * by inserting a real_outcome record.
 */
export async function confirmExternalClosing(
  assetId: string,
  actualPriceEurCents: number,
  buyerRef: string,
  tenantId: string,
): Promise<void> {
  log.info('[liquidityExecutionEngine] confirmExternalClosing', {
    assetId,
    actualPriceEurCents,
    tenantId,
  })

  // Record in external_closing_confirmations
  void (supabaseAdmin as any)
    .from('external_closing_confirmations')
    .insert({
      tenant_id: tenantId,
      asset_id: assetId,
      actual_price_eur_cents: actualPriceEurCents,
      buyer_ref: buyerRef,
      confirmed_at: new Date().toISOString(),
    })
    .then(({ error: e }: { error: { message: string } | null }) => {
      if (e)
        log.warn('[liquidityExecutionEngine] external_closing_confirmations insert failed', {
          error: e.message,
        })
    })

  // Fire to ML reality engine
  void recordRealOutcome(
    assetId,
    actualPriceEurCents,
    0, // actual ROI unknown at closing confirmation stage
    'EXTERNAL_REGISTRY',
    tenantId,
  ).catch((err: unknown) => {
    log.warn('[liquidityExecutionEngine] recordRealOutcome failed', {
      error: err instanceof Error ? err.message : String(err),
    })
  })

  log.info('[liquidityExecutionEngine] external closing confirmed', { assetId, buyerRef })
}
