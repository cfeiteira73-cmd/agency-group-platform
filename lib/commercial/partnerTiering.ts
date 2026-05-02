// =============================================================================
// Agency Group — Partner Tiering Engine
// lib/commercial/partnerTiering.ts
//
// Auto-classifies agents and investors into tiers based on performance.
//
// TIERS:
//   ELITE      — score ≥ 80: top performers, priority routing
//   PRIORITY   — score 65-79: high performers, early access
//   STANDARD   — score 45-64: baseline performers
//   WATCHLIST  — score < 45: underperformers, reduced routing, coaching flag
//
// SCORING FORMULA (agents, 0-100):
//   execution_score × 0.50
//   + close_rate × 30
//   + responsiveness_score × 20
//
// SCORING FORMULA (investors, 0-100):
//   engagement_score × 0.60
//   + conversion_rate × 100 × 0.30
//   + budget_adherence × 100 × 0.10
//
// PURE FUNCTIONS (unit-testable):
//   computeAgentPartnerScore, computeInvestorPartnerScore, classifyTier, rankPartners
//
// DB FUNCTIONS:
//   persistPartnerTier, batchUpdateAllPartnerTiers
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PartnerTier = 'ELITE' | 'PRIORITY' | 'STANDARD' | 'WATCHLIST'
export type PartnerType = 'agent' | 'investor'

export interface AgentTierInput {
  agent_email:          string
  agent_execution_score: number    // 0-100 from agentPerformance.ts
  close_rate:           number    // 0-1
  avg_response_hours?:  number | null  // hours to respond to deal pack
  total_deals_closed:   number
}

export interface InvestorTierInput {
  investor_id:     string
  email:           string
  engagement_score: number    // 0-100
  conversion_rate: number    // 0-1
  budget_adherence?: number | null  // 0-1
  total_deals:     number
}

export interface TierResult {
  partner_email:   string
  partner_type:    PartnerType
  tier:            PartnerTier
  tier_score:      number
  criteria:        Record<string, unknown>
}

// ---------------------------------------------------------------------------
// PURE: Score responsiveness (0-100) from avg response hours
// ---------------------------------------------------------------------------

export function scoreResponsiveness(avgResponseHours: number | null): number {
  if (avgResponseHours == null) return 50  // no data → neutral
  if (avgResponseHours <= 1)   return 100
  if (avgResponseHours <= 4)   return 85
  if (avgResponseHours <= 12)  return 65
  if (avgResponseHours <= 24)  return 45
  if (avgResponseHours <= 48)  return 25
  return 10
}

// ---------------------------------------------------------------------------
// PURE: Compute composite partner score for an agent (0-100)
// ---------------------------------------------------------------------------

export function computeAgentPartnerScore(input: AgentTierInput): number {
  const executionContrib     = input.agent_execution_score * 0.50         // 0-50
  const closeRateContrib     = Math.min(input.close_rate * 100, 100) * 0.30   // 0-30
  const responsivenessContrib = scoreResponsiveness(input.avg_response_hours ?? null) * 0.20  // 0-20

  return Math.min(100, Math.round(executionContrib + closeRateContrib + responsivenessContrib))
}

// ---------------------------------------------------------------------------
// PURE: Compute composite partner score for an investor (0-100)
// ---------------------------------------------------------------------------

export function computeInvestorPartnerScore(input: InvestorTierInput): number {
  const engagementContrib   = input.engagement_score * 0.60                          // 0-60
  const conversionContrib   = Math.min(input.conversion_rate * 100, 100) * 0.30      // 0-30
  const adherenceContrib    = Math.min((input.budget_adherence ?? 0.5) * 100, 100) * 0.10  // 0-10

  return Math.min(100, Math.round(engagementContrib + conversionContrib + adherenceContrib))
}

// ---------------------------------------------------------------------------
// PURE: Classify tier from composite score
// ---------------------------------------------------------------------------

export function classifyTier(score: number): PartnerTier {
  if (score >= 80) return 'ELITE'
  if (score >= 65) return 'PRIORITY'
  if (score >= 45) return 'STANDARD'
  return 'WATCHLIST'
}

// ---------------------------------------------------------------------------
// PURE: Compute and classify an agent's partner tier
// ---------------------------------------------------------------------------

export function classifyAgentTier(input: AgentTierInput): TierResult {
  const score = computeAgentPartnerScore(input)
  return {
    partner_email: input.agent_email,
    partner_type:  'agent',
    tier:          classifyTier(score),
    tier_score:    score,
    criteria: {
      agent_execution_score: input.agent_execution_score,
      close_rate:            parseFloat((input.close_rate * 100).toFixed(1)),
      avg_response_hours:    input.avg_response_hours ?? null,
      total_deals_closed:    input.total_deals_closed,
    },
  }
}

// ---------------------------------------------------------------------------
// PURE: Compute and classify an investor's partner tier
// ---------------------------------------------------------------------------

export function classifyInvestorTier(input: InvestorTierInput): TierResult {
  const score = computeInvestorPartnerScore(input)
  return {
    partner_email: input.email,
    partner_type:  'investor',
    tier:          classifyTier(score),
    tier_score:    score,
    criteria: {
      engagement_score: input.engagement_score,
      conversion_rate:  parseFloat((input.conversion_rate * 100).toFixed(1)),
      budget_adherence: input.budget_adherence != null
        ? parseFloat((input.budget_adherence * 100).toFixed(1))
        : null,
      total_deals:      input.total_deals,
    },
  }
}

// ---------------------------------------------------------------------------
// PURE: Rank a mixed list of partner results by score descending
// ---------------------------------------------------------------------------

export function rankPartners(partners: TierResult[]): Array<TierResult & { rank: number }> {
  return [...partners]
    .sort((a, b) => b.tier_score - a.tier_score)
    .map((p, idx) => ({ ...p, rank: idx + 1 }))
}

// ---------------------------------------------------------------------------
// DB: Persist a partner tier result
// ---------------------------------------------------------------------------

export async function persistPartnerTier(
  result:       TierResult,
  previousTier?: PartnerTier,
): Promise<void> {
  const now = new Date().toISOString()
  const tierChanged = previousTier != null && previousTier !== result.tier

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('partner_tiers')
    .upsert({
      partner_email:    result.partner_email,
      partner_type:     result.partner_type,
      tier:             result.tier,
      tier_score:       result.tier_score,
      criteria:         result.criteria,
      tier_computed_at: now,
      previous_tier:    previousTier ?? null,
      tier_changed_at:  tierChanged ? now : undefined,
      updated_at:       now,
    }, { onConflict: 'partner_email' })

  if (error) throw new Error(`persistPartnerTier: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Batch update all agent partner tiers from agent_performance_metrics
// ---------------------------------------------------------------------------

export async function batchUpdateAllPartnerTiers(): Promise<{
  agents: number
  investors: number
  errors: string[]
}> {
  const errors: string[] = []
  let agents = 0, investors = 0

  // Pull latest agent metrics
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: agentRows, error: agentError } = await (supabaseAdmin as any)
    .from('v_agent_performance_latest')
    .select('agent_email, agent_execution_score, close_rate, total_deals_closed')

  if (agentError) {
    errors.push(`agent fetch: ${agentError.message}`)
  } else {
    for (const row of (agentRows ?? [])) {
      try {
        const input: AgentTierInput = {
          agent_email:            row.agent_email,
          agent_execution_score:  Number(row.agent_execution_score ?? 0),
          close_rate:             Number(row.close_rate ?? 0),
          avg_response_hours:     null,  // enriched separately
          total_deals_closed:     Number(row.total_deals_closed ?? 0),
        }
        const result = classifyAgentTier(input)
        await persistPartnerTier(result)
        agents++
      } catch (err) {
        errors.push(`agent ${row.agent_email}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  // Pull investor intelligence
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: invRows, error: invError } = await (supabaseAdmin as any)
    .from('investor_intelligence')
    .select('investor_id, engagement_score, conversion_rate, budget_adherence, total_deals')

  if (invError) {
    errors.push(`investor fetch: ${invError.message}`)
  } else {
    for (const row of (invRows ?? [])) {
      try {
        const input: InvestorTierInput = {
          investor_id:      row.investor_id,
          email:            row.investor_id,  // investor_id is the contact email/id
          engagement_score: Number(row.engagement_score ?? 0),
          conversion_rate:  Number(row.conversion_rate ?? 0),
          budget_adherence: row.budget_adherence != null ? Number(row.budget_adherence) : null,
          total_deals:      Number(row.total_deals ?? 0),
        }
        const result = classifyInvestorTier(input)
        await persistPartnerTier(result)
        investors++
      } catch (err) {
        errors.push(`investor ${row.investor_id}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }

  return { agents, investors, errors }
}
