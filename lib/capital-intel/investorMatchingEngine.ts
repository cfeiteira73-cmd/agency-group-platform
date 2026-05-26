// Agency Group — Investor Matching Engine
// lib/capital-intel/investorMatchingEngine.ts
// Matches opportunities to investors based on capital profile + historical behavior.
// TypeScript strict — 0 errors

import { randomUUID } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'
import { predictInvestorInterest } from './capitalIntelligenceEngine'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OpportunityInvestorMatch {
  match_id: string
  tenant_id: string
  opportunity_id: string
  investor_id: string
  match_score: number
  match_reasons: string[]
  bid_likelihood: number
  expected_bid_eur_cents: number | null
  priority: 'IMMEDIATE' | 'HIGH' | 'MEDIUM' | 'LOW'
  notification_sent: boolean
  notified_at: string | null
  investor_response: 'VIEWED' | 'BID' | 'PASSED' | 'NO_RESPONSE' | null
  responded_at: string | null
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreToPriority(score: number): OpportunityInvestorMatch['priority'] {
  if (score >= 80) return 'IMMEDIATE'
  if (score >= 60) return 'HIGH'
  if (score >= 40) return 'MEDIUM'
  return 'LOW'
}

// ─── matchOpportunityToInvestors ──────────────────────────────────────────────

/**
 * Computes match scores for all active investors against one opportunity.
 * Only creates matches where score > 0.3 (30 out of 100).
 * Upserts to opportunity_investor_matches on conflict(opportunity_id, investor_id).
 */
export async function matchOpportunityToInvestors(
  opportunityId: string,
  tenantId: string
): Promise<OpportunityInvestorMatch[]> {
  // Get all investor profiles for tenant
  const { data: profileRows } = await (supabaseAdmin as any)
    .from('investor_capital_profiles')
    .select('investor_id, min_ticket_eur_cents, max_ticket_eur_cents, bid_win_rate, available_capital_eur_cents')
    .eq('tenant_id', tenantId)

  const profiles: Array<{
    investor_id: string
    min_ticket_eur_cents: number
    max_ticket_eur_cents: number
    bid_win_rate: number
    available_capital_eur_cents: number
  }> = (profileRows ?? []) as Array<{
    investor_id: string
    min_ticket_eur_cents: number
    max_ticket_eur_cents: number
    bid_win_rate: number
    available_capital_eur_cents: number
  }>

  if (profiles.length === 0) return []

  const BATCH = 10
  const matches: OpportunityInvestorMatch[] = []

  for (let i = 0; i < profiles.length; i += BATCH) {
    const batch = profiles.slice(i, i + BATCH)
    const results = await Promise.all(
      batch.map(async (p) => {
        const { probability, reasoning } = await predictInvestorInterest(
          p.investor_id,
          opportunityId,
          tenantId
        )

        if (probability <= 0.3) return null

        const matchScore = Math.round(probability * 100)

        // Expected bid: midpoint of ticket range, adjusted by available capital
        const midTicket = p.min_ticket_eur_cents > 0 || p.max_ticket_eur_cents > 0
          ? Math.round((p.min_ticket_eur_cents + (p.max_ticket_eur_cents || p.min_ticket_eur_cents * 2)) / 2)
          : null
        const expectedBid =
          midTicket != null && p.available_capital_eur_cents >= midTicket ? midTicket : null

        const match: OpportunityInvestorMatch = {
          match_id: randomUUID(),
          tenant_id: tenantId,
          opportunity_id: opportunityId,
          investor_id: p.investor_id,
          match_score: matchScore,
          match_reasons: reasoning,
          bid_likelihood: probability,
          expected_bid_eur_cents: expectedBid,
          priority: scoreToPriority(matchScore),
          notification_sent: false,
          notified_at: null,
          investor_response: null,
          responded_at: null,
          created_at: new Date().toISOString(),
        }

        return match
      })
    )

    for (const m of results) {
      if (m != null) matches.push(m)
    }
  }

  // Sort by match_score descending
  matches.sort((a, b) => b.match_score - a.match_score)

  // Upsert to DB (conflict on opportunity_id, investor_id — update match_score/reasons)
  if (matches.length > 0) {
    void (supabaseAdmin as any)
      .from('opportunity_investor_matches')
      .upsert(
        matches.map((m) => ({
          id: randomUUID(),
          match_id: m.match_id,
          tenant_id: m.tenant_id,
          opportunity_id: m.opportunity_id,
          investor_id: m.investor_id,
          match_score: m.match_score,
          match_reasons: m.match_reasons,
          bid_likelihood: m.bid_likelihood,
          expected_bid_eur_cents: m.expected_bid_eur_cents,
          priority: m.priority,
          notification_sent: false,
          notified_at: null,
          investor_response: null,
          responded_at: null,
          created_at: m.created_at,
        })),
        { onConflict: 'opportunity_id,investor_id' }
      )
      .catch((e: unknown) =>
        log.warn('[investorMatchingEngine] upsert opportunity_investor_matches', { error: e })
      )
  }

  return matches
}

// ─── runBatchMatching ─────────────────────────────────────────────────────────

/**
 * Runs matchOpportunityToInvestors for all ACTIVE opportunities created in last 24h.
 */
export async function runBatchMatching(
  tenantId: string
): Promise<{ opportunities_processed: number; matches_created: number }> {
  const since = new Date(Date.now() - 24 * 3_600_000).toISOString()

  const { data: oppRows } = await (supabaseAdmin as any)
    .from('capital_opportunities')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'ACTIVE')
    .gte('created_at', since)

  const opps: Array<{ id: string }> = (oppRows ?? []) as Array<{ id: string }>

  let totalMatches = 0

  for (const opp of opps) {
    try {
      const matches = await matchOpportunityToInvestors(opp.id, tenantId)
      totalMatches += matches.length
    } catch (e: unknown) {
      log.warn('[investorMatchingEngine] runBatchMatching opp failed', { opp_id: opp.id, error: e })
    }
  }

  log.info('[investorMatchingEngine] runBatchMatching complete', {
    tenant_id: tenantId,
    opportunities_processed: opps.length,
    matches_created: totalMatches,
  })

  return {
    opportunities_processed: opps.length,
    matches_created: totalMatches,
  }
}

// ─── recordInvestorResponse ───────────────────────────────────────────────────

/**
 * Updates investor response on a match record.
 */
export async function recordInvestorResponse(
  matchId: string,
  response: OpportunityInvestorMatch['investor_response'],
  tenantId: string
): Promise<void> {
  void (supabaseAdmin as any)
    .from('opportunity_investor_matches')
    .update({
      investor_response: response,
      responded_at: new Date().toISOString(),
    })
    .eq('match_id', matchId)
    .eq('tenant_id', tenantId)
    .catch((e: unknown) =>
      log.warn('[investorMatchingEngine] recordInvestorResponse', { match_id: matchId, error: e })
    )
}

// ─── getMatchesForInvestor ────────────────────────────────────────────────────

/**
 * Personalized opportunity feed for an investor.
 */
export async function getMatchesForInvestor(
  investorId: string,
  tenantId: string,
  limit = 20
): Promise<OpportunityInvestorMatch[]> {
  const { data: rows } = await (supabaseAdmin as any)
    .from('opportunity_investor_matches')
    .select('*')
    .eq('investor_id', investorId)
    .eq('tenant_id', tenantId)
    .order('match_score', { ascending: false })
    .limit(limit)

  return (rows ?? []) as OpportunityInvestorMatch[]
}

// ─── getMatchesForOpportunity ─────────────────────────────────────────────────

/**
 * All investor matches for a specific opportunity.
 */
export async function getMatchesForOpportunity(
  opportunityId: string,
  tenantId: string
): Promise<OpportunityInvestorMatch[]> {
  const { data: rows } = await (supabaseAdmin as any)
    .from('opportunity_investor_matches')
    .select('*')
    .eq('opportunity_id', opportunityId)
    .eq('tenant_id', tenantId)
    .order('match_score', { ascending: false })

  return (rows ?? []) as OpportunityInvestorMatch[]
}
