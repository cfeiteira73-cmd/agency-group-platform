// =============================================================================
// Agency Group — Deterministic Commission Engine
// lib/economics/commissionEngine.ts
//
// Pure commission calculation with full lineage tracking.
// Three tiers: standard (5%), premium (4.5%), institutional (4%)
// Agency/agent split varies by tier.
// All calculations are deterministic — same input always produces same output.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export type CommissionTier = 'standard' | 'premium' | 'institutional'

export interface CommissionInput {
  deal_id: string
  tenant_id: string
  deal_value_eur: number
  zone: string | null
  agent_email: string | null
  deal_ref: string | null
  correlation_id: string
}

export interface CommissionResult {
  commission_id: string
  tier: CommissionTier
  commission_rate: number        // e.g. 0.05 for 5%
  gross_commission_eur: number
  net_commission_eur: number     // gross - VAT (23% PT)
  agency_split_eur: number
  agent_split_eur: number
  agency_split_pct: number       // e.g. 0.50
  agent_split_pct: number        // e.g. 0.50
  vat_eur: number
  deal_value_eur: number
}

// ─── Tier thresholds ─────────────────────────────────────────────────────────

const TIERS: { threshold: number; rate: number; agency_pct: number; agent_pct: number }[] = [
  { threshold: 5_000_000, rate: 0.040, agency_pct: 0.60, agent_pct: 0.40 },  // institutional ≥ €5M
  { threshold: 1_000_000, rate: 0.045, agency_pct: 0.55, agent_pct: 0.45 },  // premium €1M–€5M
  { threshold: 0,         rate: 0.050, agency_pct: 0.50, agent_pct: 0.50 },  // standard < €1M
]

const VAT_RATE = 0.23  // Portugal IVA

// ─── Pure calculation ─────────────────────────────────────────────────────────

export function calculateCommission(input: CommissionInput): CommissionResult {
  const { deal_value_eur } = input

  // Find the appropriate tier (highest threshold that applies)
  const tierDef = TIERS.find(t => deal_value_eur >= t.threshold)!
  const tier: CommissionTier =
    deal_value_eur >= 5_000_000 ? 'institutional' :
    deal_value_eur >= 1_000_000 ? 'premium' :
    'standard'

  const gross_commission_eur = Math.round(deal_value_eur * tierDef.rate * 100) / 100
  const vat_eur              = Math.round(gross_commission_eur * VAT_RATE * 100) / 100
  const net_commission_eur   = Math.round((gross_commission_eur - vat_eur) * 100) / 100
  const agency_split_eur     = Math.round(net_commission_eur * tierDef.agency_pct * 100) / 100
  const agent_split_eur      = Math.round((net_commission_eur - agency_split_eur) * 100) / 100

  return {
    commission_id:         crypto.randomUUID(),
    tier,
    commission_rate:       tierDef.rate,
    gross_commission_eur,
    net_commission_eur,
    agency_split_eur,
    agent_split_eur,
    agency_split_pct:      tierDef.agency_pct,
    agent_split_pct:       tierDef.agent_pct,
    vat_eur,
    deal_value_eur,
  }
}

// ─── Persistence ─────────────────────────────────────────────────────────────

/**
 * Calculate commission and persist to commission_events table.
 * Returns the full result including the generated commission_id.
 * Fire-and-forget safe — errors are logged and rethrown for callers to handle.
 */
export async function calculateAndPersistCommission(
  input: CommissionInput,
): Promise<CommissionResult> {
  const result = calculateCommission(input)

  const { error } = await (supabaseAdmin as any)
    .from('commission_events')
    .insert({
      id:                   result.commission_id,
      tenant_id:            input.tenant_id,
      deal_id:              input.deal_id,
      deal_ref:             input.deal_ref ?? null,
      gross_commission_eur: result.gross_commission_eur,
      net_commission_eur:   result.net_commission_eur,
      agency_split_eur:     result.agency_split_eur,
      agent_split_eur:      result.agent_split_eur,
      commission_rate:      result.commission_rate,
      tier:                 result.tier,
      agent_email:          input.agent_email ?? null,
      zone:                 input.zone ?? null,
      status:               'pending',
      revenue_event_id:     input.correlation_id,
    })

  if (error) {
    console.error('[CommissionEngine] persist failed:', error.message)
    // Re-throw so the worker can fail the job and trigger a retry.
    // Commission MUST be persisted — silent swallow = untracked revenue.
    throw new Error(`Commission persist failed for deal ${input.deal_id}: ${error.message}`)
  }

  return result
}
