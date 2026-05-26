// Agency Group — Synthetic Transaction Engine
// lib/financial-integrity/syntheticTransactionEngine.ts
// Runs synthetic (non-real) transaction tests to validate the fee calculation
// logic WITHOUT writing to financial tables. Pure in-memory test runner.
// TypeScript strict — 0 errors

import { computeFeeBreakdown, type FeeBreakdown } from '@/lib/ledger/transactionFeeEngine'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SyntheticTestCase {
  name: string
  sale_price_cents: bigint
  country: 'PT' | 'ES'
  expected_commission_min_cents: bigint
  expected_commission_max_cents: bigint
  expected_total_costs_min_cents: bigint
}

export interface SyntheticTestResult {
  test_name: string
  passed: boolean
  commission_cents: bigint
  expected_range: { min: bigint; max: bigint }
  total_costs_cents: bigint
  fee_breakdown: {
    imt_tax_cents?: bigint
    stamp_duty_cents?: bigint
    notary_fee_cents?: bigint
    land_registry_cents?: bigint
  }
  error: string | null
}

export interface SyntheticTestSuiteResult {
  results: SyntheticTestResult[]
  pass_count: number
  fail_count: number
  all_passed: boolean
}

// ── 10 canonical test cases ───────────────────────────────────────────────────

export const SYNTHETIC_TEST_CASES: SyntheticTestCase[] = [
  {
    name: 'PT_ENTRY_LEVEL',
    sale_price_cents: BigInt(10_000_000), // €100,000
    country: 'PT',
    expected_commission_min_cents: BigInt(490_000), // ~4.9%
    expected_commission_max_cents: BigInt(510_000), // ~5.1%
    expected_total_costs_min_cents: BigInt(10_800_000), // 8% overhead min
  },
  {
    name: 'PT_MID_MARKET',
    sale_price_cents: BigInt(50_000_000), // €500,000
    country: 'PT',
    expected_commission_min_cents: BigInt(2_450_000),
    expected_commission_max_cents: BigInt(2_550_000),
    expected_total_costs_min_cents: BigInt(53_000_000),
  },
  {
    name: 'PT_LUXURY',
    sale_price_cents: BigInt(200_000_000), // €2M
    country: 'PT',
    expected_commission_min_cents: BigInt(9_800_000),
    expected_commission_max_cents: BigInt(10_200_000),
    expected_total_costs_min_cents: BigInt(212_000_000),
  },
  {
    name: 'ES_MADRID_MID',
    sale_price_cents: BigInt(60_000_000), // €600,000
    country: 'ES',
    expected_commission_min_cents: BigInt(2_940_000),
    expected_commission_max_cents: BigInt(3_060_000),
    expected_total_costs_min_cents: BigInt(63_000_000),
  },
  {
    name: 'PT_ZERO_IMT_THRESHOLD',
    sale_price_cents: BigInt(9_700_000), // €97,000 — just under 0% bracket
    country: 'PT',
    expected_commission_min_cents: BigInt(470_000),
    expected_commission_max_cents: BigInt(490_000),
    expected_total_costs_min_cents: BigInt(10_100_000),
  },
  {
    name: 'PT_ABOVE_550K_FLAT_6PCT',
    sale_price_cents: BigInt(60_000_000), // €600,000 → flat 6%
    country: 'PT',
    expected_commission_min_cents: BigInt(2_940_000),
    expected_commission_max_cents: BigInt(3_060_000),
    expected_total_costs_min_cents: BigInt(63_500_000),
  },
  {
    name: 'ES_NEW_BUILD_IVA',
    sale_price_cents: BigInt(30_000_000), // €300,000
    country: 'ES',
    expected_commission_min_cents: BigInt(1_450_000),
    expected_commission_max_cents: BigInt(1_550_000),
    expected_total_costs_min_cents: BigInt(31_000_000),
  },
  {
    name: 'PT_MINIMUM_DEAL',
    sale_price_cents: BigInt(5_000_000), // €50,000
    country: 'PT',
    expected_commission_min_cents: BigInt(240_000),
    expected_commission_max_cents: BigInt(260_000),
    expected_total_costs_min_cents: BigInt(5_100_000),
  },
  {
    name: 'PT_HIGH_VALUE_10M',
    sale_price_cents: BigInt(1_000_000_000), // €10M
    country: 'PT',
    expected_commission_min_cents: BigInt(49_000_000),
    expected_commission_max_cents: BigInt(51_000_000),
    expected_total_costs_min_cents: BigInt(1_060_000_000),
  },
  {
    name: 'ES_ANDALUCIA_7PCT',
    sale_price_cents: BigInt(45_000_000), // €450,000
    country: 'ES',
    expected_commission_min_cents: BigInt(2_200_000),
    expected_commission_max_cents: BigInt(2_300_000),
    expected_total_costs_min_cents: BigInt(47_000_000),
  },
]

// ── runSyntheticTests ─────────────────────────────────────────────────────────

export function runSyntheticTests(): SyntheticTestSuiteResult {
  const results: SyntheticTestResult[] = []

  for (const tc of SYNTHETIC_TEST_CASES) {
    try {
      const breakdown: FeeBreakdown = computeFeeBreakdown(tc.sale_price_cents, tc.country)
      const commission = breakdown.agency_commission_cents
      const inRange =
        commission >= tc.expected_commission_min_cents &&
        commission <= tc.expected_commission_max_cents
      const costsAboveMin = breakdown.total_buyer_costs_cents >= tc.expected_total_costs_min_cents

      const passed = inRange && costsAboveMin

      let errorMsg: string | null = null
      if (!inRange) {
        errorMsg = `Commission ${commission} outside range [${tc.expected_commission_min_cents}, ${tc.expected_commission_max_cents}]`
      } else if (!costsAboveMin) {
        errorMsg = `Total costs ${breakdown.total_buyer_costs_cents} below minimum ${tc.expected_total_costs_min_cents}`
      }

      results.push({
        test_name: tc.name,
        passed,
        commission_cents: commission,
        expected_range: { min: tc.expected_commission_min_cents, max: tc.expected_commission_max_cents },
        total_costs_cents: breakdown.total_buyer_costs_cents,
        fee_breakdown: {
          imt_tax_cents: breakdown.imt_tax_cents,
          stamp_duty_cents: breakdown.stamp_duty_cents,
          notary_fee_cents: breakdown.notary_fee_cents,
          land_registry_cents: breakdown.land_registry_cents,
        },
        error: errorMsg,
      })
    } catch (e) {
      results.push({
        test_name: tc.name,
        passed: false,
        commission_cents: BigInt(0),
        expected_range: { min: tc.expected_commission_min_cents, max: tc.expected_commission_max_cents },
        total_costs_cents: BigInt(0),
        fee_breakdown: {},
        error: e instanceof Error ? e.message : 'Unknown error',
      })
    }
  }

  const pass_count = results.filter(r => r.passed).length
  return {
    results,
    pass_count,
    fail_count: results.length - pass_count,
    all_passed: pass_count === results.length,
  }
}
