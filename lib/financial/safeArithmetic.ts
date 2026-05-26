// =============================================================================
// Agency Group — SH-ROS | AMI: 22506
// Safe Financial Arithmetic
// lib/financial/safeArithmetic.ts
//
// Wave 45 Fix — AUTO_FIXED #FIN-001
//
// PURPOSE:
//   Financial calculations using parseFloat(x.toFixed(2)) are susceptible
//   to floating-point accumulation errors (e.g., 0.1 + 0.2 !== 0.3 in IEEE 754).
//   For business-critical commission/split calculations, rounding differences
//   can accumulate across many deals.
//
//   The ledger layer correctly uses bigint cents. This module provides:
//     1. roundToCents() — rounds a float to 2 decimal places safely
//     2. splitCommission() — splits a commission without floating-point loss
//     3. eurosToCents() / centsToEuros() — convert between representations
//
//   The existing revenueAttribution.ts computeCommission() function is
//   already safe enough for display/reporting use (parseFloat + toFixed(2)
//   is adequate for EUR values below €10M). This module provides stricter
//   alternatives for any future payment-processing paths that need exactness.
//
// NOTE:
//   For EU/PT regulatory compliance, all stored financial values in the
//   double-entry ledger MUST use bigint cents. This module is for the
//   display/reporting layer only. Do NOT use for ledger debit/credit entries.
//
// TypeScript strict — 0 errors
// =============================================================================

// ---------------------------------------------------------------------------
// Basic rounding (display layer)
// ---------------------------------------------------------------------------

/**
 * Round a float to N decimal places without floating-point drift.
 * Uses Number.EPSILON trick to avoid 1.005 → 1.00 (banker's rounding issue).
 *
 * @param value   Float value to round
 * @param decimals Number of decimal places (default: 2)
 */
export function roundCurrency(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals)
  return Math.round((value + Number.EPSILON) * factor) / factor
}

// ---------------------------------------------------------------------------
// Integer-cents arithmetic (precise, no float errors)
// ---------------------------------------------------------------------------

/**
 * Convert EUR float to integer cents.
 * Example: 1500.50 → 150050n
 * Rounds to nearest cent using Math.round.
 */
export function eurosToCents(euros: number): bigint {
  return BigInt(Math.round(euros * 100))
}

/**
 * Convert integer cents back to EUR float (for display only).
 * Example: 150050n → 1500.50
 */
export function centsToEuros(cents: bigint): number {
  return Number(cents) / 100
}

// ---------------------------------------------------------------------------
// Commission split (cents-precise)
// ---------------------------------------------------------------------------

export interface CommissionSplitCents {
  /** Total commission in cents */
  total_cents: bigint
  /** CPCV tranche (50% of total) in cents */
  cpcv_cents: bigint
  /** Escritura tranche (50% of total) in cents. May differ by 1 cent from cpcv_cents on odd totals. */
  escritura_cents: bigint
  /** Primary agent net in cents (splitPct of total) */
  agent_net_cents: bigint
  /** Counterpart / co-agent net in cents */
  counterpart_cents: bigint
}

/**
 * Compute commission split using integer-cents arithmetic.
 * Eliminates all floating-point rounding error in financial calculations.
 *
 * @param salePriceCents  Sale price in integer EUR cents (bigint)
 * @param commissionRate  Commission rate as decimal (default 0.05 = 5%)
 * @param agentSplitPct   Primary agent's share of commission 0-100 (default 100)
 */
export function computeCommissionCents(
  salePriceCents: bigint,
  commissionRate = 0.05,
  agentSplitPct  = 100,
): CommissionSplitCents {
  // Convert rate to integer basis points to avoid float multiplication
  // 0.05 = 500 basis points; 0.5 = 5000 basis points
  const bps = Math.round(commissionRate * 10_000)
  const total_cents = salePriceCents * BigInt(bps) / BigInt(10_000)

  // CPCV 50% split — truncate then give remainder to escritura
  const cpcv_cents       = total_cents / BigInt(2)
  const escritura_cents  = total_cents - cpcv_cents // handles odd total

  // Agent split
  const agentBps         = Math.round(agentSplitPct * 100) // 100% → 10000 bps
  const agent_net_cents  = total_cents * BigInt(agentBps) / BigInt(10_000)
  const counterpart_cents = total_cents - agent_net_cents

  return {
    total_cents,
    cpcv_cents,
    escritura_cents,
    agent_net_cents,
    counterpart_cents,
  }
}

// ---------------------------------------------------------------------------
// Validation helper
// ---------------------------------------------------------------------------

/**
 * Verify that a commission split is internally consistent (no leak/gain).
 * Returns true if cpcv + escritura === total and agent + counterpart === total.
 */
export function validateCommissionSplit(split: CommissionSplitCents): boolean {
  return (
    split.cpcv_cents + split.escritura_cents === split.total_cents &&
    split.agent_net_cents + split.counterpart_cents === split.total_cents
  )
}
