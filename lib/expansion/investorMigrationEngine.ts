// Agency Group — Investor Migration Engine
// lib/expansion/investorMigrationEngine.ts
// Moves capital between markets:
//   incentivizes investors toward new markets
//   redistributes attention based on liquidity
//   activates regional campaigns automatically
// NEVER forces moves — creates incentive signals and campaign triggers.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { createCampaign, bulkEnrollSegment } from '@/lib/campaigns/campaignOrchestrator'

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MigrationOpportunity {
  opportunity_id: string
  tenant_id: string
  investor_id: string
  current_market: string
  target_market: string
  reason: string
  incentive_type: 'ROI_BONUS' | 'EARLY_ACCESS' | 'REDUCED_FEE' | 'EXCLUSIVE_ASSET' | 'LIQUIDITY_PREMIUM'
  expected_capital_migration_eur_cents: number
  probability: number
  generated_at: string
}

export interface MigrationCampaign {
  campaign_id: string
  tenant_id: string
  target_market: string
  target_segment: string
  migration_opportunities: number
  total_capital_target_eur_cents: number
  launch_status: 'PLANNED' | 'ACTIVE' | 'COMPLETED'
  created_at: string
}

// ─── incentiveForSegment ──────────────────────────────────────────────────────

function _incentiveForSegment(
  segment: string,
): MigrationOpportunity['incentive_type'] {
  if (segment === 'INSTITUTIONAL_BUYER') return 'EXCLUSIVE_ASSET'
  if (segment === 'HIGH_CAPITAL_VELOCITY') return 'ROI_BONUS'
  if (segment === 'EARLY_ADOPTER') return 'EARLY_ACCESS'
  if (segment === 'COST_SENSITIVE') return 'REDUCED_FEE'
  return 'LIQUIDITY_PREMIUM'
}

// ─── identifyMigrationCandidates ──────────────────────────────────────────────

export async function identifyMigrationCandidates(
  tenantId: string,
): Promise<MigrationOpportunity[]> {
  // 1. Fetch PRIORITY_1 + PRIORITY_2 markets from market_selection_reports
  const { data: reportRows, error: reportErr } = await (supabaseAdmin as any)
    .from('market_selection_reports')
    .select('*')
    .eq('tenant_id', tenantId)
    .in('priority_tier', ['PRIORITY_1', 'PRIORITY_2'])
    .order('generated_at', { ascending: false })
    .limit(20)

  if (reportErr) {
    log.warn('[investorMigrationEngine] market_selection_reports query failed', {
      error: reportErr.message,
      tenant_id: tenantId,
    })
  }

  const priorityMarkets: Array<{
    market: string
    opportunity_score: number
    investor_count: number
    priority_tier: string
  }> = (reportRows ?? []).map((r: Record<string, unknown>) => ({
    market: (r.market ?? r.city ?? r.country ?? '') as string,
    opportunity_score: Number(r.opportunity_score ?? 0),
    investor_count: Number(r.investor_count ?? 0),
    priority_tier: r.priority_tier as string,
  }))

  if (priorityMarkets.length === 0) {
    log.info('[investorMigrationEngine] no priority markets found', { tenant_id: tenantId })
    return []
  }

  // 2. Fetch HIGH_CAPITAL_VELOCITY + INSTITUTIONAL_BUYER investors
  const { data: segmentRows, error: segmentErr } = await (supabaseAdmin as any)
    .from('investor_segment_profiles')
    .select('investor_id, segment, total_capital_eur_cents')
    .eq('tenant_id', tenantId)
    .in('segment', ['HIGH_CAPITAL_VELOCITY', 'INSTITUTIONAL_BUYER'])
    .limit(200)

  if (segmentErr) {
    log.warn('[investorMigrationEngine] investor_segment_profiles query failed', {
      error: segmentErr.message,
      tenant_id: tenantId,
    })
  }

  const investors: Array<{
    investor_id: string
    segment: string
    total_capital_eur_cents: number
  }> = (segmentRows ?? []).map((r: Record<string, unknown>) => ({
    investor_id: r.investor_id as string,
    segment: r.segment as string,
    total_capital_eur_cents: Number(r.total_capital_eur_cents ?? 0),
  }))

  if (investors.length === 0) {
    log.info('[investorMigrationEngine] no eligible investors found', { tenant_id: tenantId })
    return []
  }

  // 3. Fetch current active markets per investor from asset_bids
  const investorIds = investors.map((i) => i.investor_id)
  const { data: bidRows, error: bidErr } = await (supabaseAdmin as any)
    .from('asset_bids')
    .select('investor_id, market')
    .eq('tenant_id', tenantId)
    .in('investor_id', investorIds)
    .eq('status', 'ACTIVE')

  if (bidErr) {
    log.warn('[investorMigrationEngine] asset_bids query failed', {
      error: bidErr.message,
      tenant_id: tenantId,
    })
  }

  const currentMarketByInvestor = new Map<string, string>()
  for (const bid of (bidRows ?? []) as Array<{ investor_id: string; market: string }>) {
    if (!currentMarketByInvestor.has(bid.investor_id)) {
      currentMarketByInvestor.set(bid.investor_id, bid.market ?? 'UNKNOWN')
    }
  }

  // 4. Match investors to PRIORITY markets with low investor_count but high opportunity_score
  const now = new Date().toISOString()
  const opportunities: MigrationOpportunity[] = []

  for (const market of priorityMarkets) {
    if (market.investor_count > 10) continue // already well-served
    if (market.opportunity_score < 50) continue

    for (const investor of investors) {
      const currentMarket = currentMarketByInvestor.get(investor.investor_id) ?? 'UNKNOWN'
      if (currentMarket === market.market) continue // already in this market

      const incentive_type = _incentiveForSegment(investor.segment)
      const probability =
        investor.segment === 'INSTITUTIONAL_BUYER'
          ? 0.7
          : investor.segment === 'HIGH_CAPITAL_VELOCITY'
          ? 0.6
          : 0.4

      const reason = `Market ${market.market} has opportunity_score ${market.opportunity_score} with only ${market.investor_count} active investors. ` +
        `Segment ${investor.segment} investors benefit from ${incentive_type} in emerging markets.`

      const expected_capital_migration_eur_cents = Math.round(
        investor.total_capital_eur_cents * probability * 0.2,
      )

      const opportunity_id = `mig_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

      opportunities.push({
        opportunity_id,
        tenant_id: tenantId,
        investor_id: investor.investor_id,
        current_market: currentMarket,
        target_market: market.market,
        reason,
        incentive_type,
        expected_capital_migration_eur_cents,
        probability,
        generated_at: now,
      })
    }
  }

  // 5. Persist to migration_opportunities
  if (opportunities.length > 0) {
    void (supabaseAdmin as any)
      .from('migration_opportunities')
      .upsert(
        opportunities.map((o) => ({
          opportunity_id: o.opportunity_id,
          tenant_id: o.tenant_id,
          investor_id: o.investor_id,
          current_market: o.current_market,
          target_market: o.target_market,
          reason: o.reason,
          incentive_type: o.incentive_type,
          expected_capital_migration_eur_cents: o.expected_capital_migration_eur_cents,
          probability: o.probability,
          generated_at: o.generated_at,
        })),
        { onConflict: 'opportunity_id' },
      )
      .catch((e: unknown) =>
        log.warn('[investorMigrationEngine] persist opportunities failed', {
          error: String(e),
        }),
      )
  }

  log.info('[investorMigrationEngine] migration candidates identified', {
    tenant_id: tenantId,
    count: opportunities.length,
    markets: priorityMarkets.map((m) => m.market),
  })

  return opportunities
}

// ─── launchMigrationCampaign ──────────────────────────────────────────────────

export async function launchMigrationCampaign(
  targetMarket: string,
  targetSegment: string,
  tenantId: string,
): Promise<MigrationCampaign> {
  const now = new Date().toISOString()

  // Fetch migration opportunities for this market + segment
  const { data: oppRows, error: oppErr } = await (supabaseAdmin as any)
    .from('migration_opportunities')
    .select('opportunity_id, expected_capital_migration_eur_cents, investor_id')
    .eq('tenant_id', tenantId)
    .eq('target_market', targetMarket)

  if (oppErr) {
    log.warn('[investorMigrationEngine] launchMigrationCampaign: opportunities query failed', {
      error: oppErr.message,
      target_market: targetMarket,
      tenant_id: tenantId,
    })
  }

  const opps: Array<{
    opportunity_id: string
    expected_capital_migration_eur_cents: number
    investor_id: string
  }> = (oppRows ?? []).map((r: Record<string, unknown>) => ({
    opportunity_id: r.opportunity_id as string,
    expected_capital_migration_eur_cents: Number(r.expected_capital_migration_eur_cents ?? 0),
    investor_id: r.investor_id as string,
  }))

  const total_capital_target_eur_cents = opps.reduce(
    (sum, o) => sum + o.expected_capital_migration_eur_cents,
    0,
  )

  // Create campaign via campaignOrchestrator
  const campaign = await createCampaign(
    {
      tenant_id: tenantId,
      name: `Market Migration — ${targetMarket} — ${targetSegment}`,
      status: 'ACTIVE',
      trigger_type: 'MARKET_ENTRY',
      target_segments: [targetSegment],
      channels: ['email', 'in_app'],
      message_template_id: null,
      trigger_conditions: {
        target_market: targetMarket,
        incentive_driven: true,
      },
      sequence_steps: [
        {
          step_id: `step_1_${Date.now()}`,
          step_number: 1,
          channel: 'email',
          delay_hours: 0,
          message_template: `Exclusive opportunity in ${targetMarket}: Early access for ${targetSegment} investors. Discover high-yield assets in this emerging market.`,
          condition_branch: null,
        },
        {
          step_id: `step_2_${Date.now()}`,
          step_number: 2,
          channel: 'in_app',
          delay_hours: 48,
          message_template: `${targetMarket} market update: New assets available matching your investment profile. Act now to secure priority access.`,
          condition_branch: null,
        },
      ],
      start_at: now,
      end_at: null,
      budget_eur_cents: null,
    },
    tenantId,
  )

  // Enroll investors from opportunities
  void bulkEnrollSegment(campaign.campaign_id, targetSegment, tenantId).catch((e: unknown) =>
    log.warn('[investorMigrationEngine] bulkEnrollSegment fire-and-forget failed', {
      error: String(e),
      campaign_id: campaign.campaign_id,
    }),
  )

  const campaign_id = `migcamp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`

  const migrationCampaign: MigrationCampaign = {
    campaign_id,
    tenant_id: tenantId,
    target_market: targetMarket,
    target_segment: targetSegment,
    migration_opportunities: opps.length,
    total_capital_target_eur_cents,
    launch_status: 'ACTIVE',
    created_at: now,
  }

  // Persist to migration_campaigns
  void (supabaseAdmin as any)
    .from('migration_campaigns')
    .insert({
      campaign_id: migrationCampaign.campaign_id,
      tenant_id: migrationCampaign.tenant_id,
      target_market: migrationCampaign.target_market,
      target_segment: migrationCampaign.target_segment,
      migration_opportunities: migrationCampaign.migration_opportunities,
      total_capital_target_eur_cents: migrationCampaign.total_capital_target_eur_cents,
      launch_status: migrationCampaign.launch_status,
      created_at: migrationCampaign.created_at,
    })
    .catch((e: unknown) =>
      log.warn('[investorMigrationEngine] persist migration_campaigns failed', {
        error: String(e),
      }),
    )

  log.info('[investorMigrationEngine] migration campaign launched', {
    campaign_id,
    target_market: targetMarket,
    target_segment: targetSegment,
    opportunities: opps.length,
    total_capital_target_eur_cents,
    tenant_id: tenantId,
  })

  return migrationCampaign
}

// ─── getMigrationMetrics ──────────────────────────────────────────────────────

export async function getMigrationMetrics(tenantId: string): Promise<{
  total_opportunities: number
  markets_targeted: number
  capital_in_migration_eur_cents: number
  migrations_completed: number
  success_rate_pct: number
}> {
  const [oppsResult, campaignsResult] = await Promise.all([
    (supabaseAdmin as any)
      .from('migration_opportunities')
      .select('opportunity_id, target_market, expected_capital_migration_eur_cents')
      .eq('tenant_id', tenantId),
    (supabaseAdmin as any)
      .from('migration_campaigns')
      .select('launch_status, migration_opportunities')
      .eq('tenant_id', tenantId),
  ])

  const opps: Array<{
    opportunity_id: string
    target_market: string
    expected_capital_migration_eur_cents: number
  }> = (oppsResult.data ?? []).map((r: Record<string, unknown>) => ({
    opportunity_id: r.opportunity_id as string,
    target_market: r.target_market as string,
    expected_capital_migration_eur_cents: Number(r.expected_capital_migration_eur_cents ?? 0),
  }))

  const campaigns: Array<{
    launch_status: string
    migration_opportunities: number
  }> = (campaignsResult.data ?? []).map((r: Record<string, unknown>) => ({
    launch_status: r.launch_status as string,
    migration_opportunities: Number(r.migration_opportunities ?? 0),
  }))

  const total_opportunities = opps.length
  const markets_targeted = new Set(opps.map((o) => o.target_market)).size
  const capital_in_migration_eur_cents = opps.reduce(
    (sum, o) => sum + o.expected_capital_migration_eur_cents,
    0,
  )
  const migrations_completed = campaigns.filter(
    (c) => c.launch_status === 'COMPLETED',
  ).length
  const total_campaigns = campaigns.length
  const success_rate_pct =
    total_campaigns > 0
      ? Math.round((migrations_completed / total_campaigns) * 100)
      : 0

  return {
    total_opportunities,
    markets_targeted,
    capital_in_migration_eur_cents,
    migrations_completed,
    success_rate_pct,
  }
}

export { DEFAULT_TENANT_ID as MIGRATION_DEFAULT_TENANT_ID }
