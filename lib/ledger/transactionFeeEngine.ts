// Agency Group — Transaction Fee Engine
// lib/ledger/transactionFeeEngine.ts
// Pure fee computation + persistence for real-estate transaction costs.
// Portugal: IMT 6%, stamp 0.8%, notary €1,500, registry €500
// Spain:    ITP 6% (resale) / AJD 1.5% (new build), stamp 0.5%, notary €1,800, registry €600
// All amounts in bigint integer cents (EUR). No float arithmetic.
// TypeScript strict — 0 errors

import { supabaseAdmin } from '@/lib/supabase'
import { recordCommissionRevenue } from '@/lib/ledger/doubleEntryLedger'

// ── Logger ─────────────────────────────────────────────────────────────────────

let log: {
  info: (m: string, c?: Record<string, unknown>) => void
  warn: (m: string, c?: Record<string, unknown>) => void
  error: (m: string, c?: Record<string, unknown>) => void
}
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { logger } = require('@/lib/observability/logger') as { logger: typeof log }
  log = logger
} catch {
  log = {
    info: (m, c) => console.log('[fee-engine]', m, c ?? {}),
    warn: (m, c) => console.warn('[fee-engine]', m, c ?? {}),
    error: (m, c) => console.error('[fee-engine]', m, c ?? {}),
  }
}

const TENANT_ID =
  process.env.DEFAULT_TENANT_ID ??
  process.env.SYSTEM_ORG_ID ??
  '00000000-0000-0000-0000-000000000001'

// ── Bigint constants (no n-literal syntax for ES2017 compat) ─────────────────

const B5   = BigInt(5)
const B6   = BigInt(6)
const B8   = BigInt(8)
const B15  = BigInt(15)
const B100 = BigInt(100)
const B500 = BigInt(500)
const B1000 = BigInt(1000)
const NOTARY_PT  = BigInt(150000)  // €1,500
const NOTARY_ES  = BigInt(180000)  // €1,800
const REGISTRY_PT = BigInt(50000)  // €500
const REGISTRY_ES = BigInt(60000)  // €600

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FeeBreakdown {
  agency_commission_cents: bigint   // 5% of sale price
  imt_tax_cents: bigint             // 6% PT / 6% ES resale / 1.5% ES new build
  stamp_duty_cents: bigint          // 0.8% PT / 0.5% ES
  notary_fee_cents: bigint          // €1,500 PT / €1,800 ES flat
  land_registry_cents: bigint       // €500 PT / €600 ES
  psp_fee_cents: bigint             // 0.3% of transaction
  total_buyer_costs_cents: bigint   // sale + imt + stamp + notary + registry
  total_seller_revenue_cents: bigint // sale - agency commission
  net_to_platform_cents: bigint     // agency commission - PSP fee
}

// ── computeFeeBreakdown ───────────────────────────────────────────────────────

export function computeFeeBreakdown(
  salePriceCents: bigint,
  country: 'PT' | 'ES',
  propertyType: 'resale' | 'new_build' = 'resale'
): FeeBreakdown {
  // Agency commission: 5%
  const agency_commission_cents = salePriceCents * B5 / B100

  // IMT / Transfer tax
  let imt_tax_cents: bigint
  if (country === 'PT') {
    imt_tax_cents = salePriceCents * B6 / B100
  } else {
    // ES: ITP 6% resale, AJD 1.5% new build
    imt_tax_cents =
      propertyType === 'new_build'
        ? salePriceCents * B15 / B1000  // 1.5%
        : salePriceCents * B6 / B100    // 6%
  }

  // Stamp duty
  const stamp_duty_cents =
    country === 'PT'
      ? salePriceCents * B8 / B1000    // 0.8%
      : salePriceCents * B5 / B1000    // 0.5%

  // Notary fee (flat)
  const notary_fee_cents = country === 'PT' ? NOTARY_PT : NOTARY_ES

  // Land registry (flat estimate)
  const land_registry_cents = country === 'PT' ? REGISTRY_PT : REGISTRY_ES

  // PSP fee: 0.3%
  const psp_fee_cents = salePriceCents * BigInt(3) / B1000

  // Totals
  const total_buyer_costs_cents =
    salePriceCents + imt_tax_cents + stamp_duty_cents + notary_fee_cents + land_registry_cents
  const total_seller_revenue_cents = salePriceCents - agency_commission_cents
  const net_to_platform_cents = agency_commission_cents - psp_fee_cents

  return {
    agency_commission_cents,
    imt_tax_cents,
    stamp_duty_cents,
    notary_fee_cents,
    land_registry_cents,
    psp_fee_cents,
    total_buyer_costs_cents,
    total_seller_revenue_cents,
    net_to_platform_cents,
  }
}

// ── recordFeeCollection ───────────────────────────────────────────────────────

export async function recordFeeCollection(
  transactionId: string,
  breakdown: FeeBreakdown,
  tenantId: string = TENANT_ID
): Promise<void> {
  const { error } = await (supabaseAdmin as any)
    .from('transaction_fee_records')
    .upsert(
      {
        tenant_id: tenantId,
        transaction_id: transactionId,
        agency_commission_cents: Number(breakdown.agency_commission_cents),
        imt_tax_cents: Number(breakdown.imt_tax_cents),
        stamp_duty_cents: Number(breakdown.stamp_duty_cents),
        notary_fee_cents: Number(breakdown.notary_fee_cents),
        land_registry_cents: Number(breakdown.land_registry_cents),
        psp_fee_cents: Number(breakdown.psp_fee_cents),
        total_buyer_costs_cents: Number(breakdown.total_buyer_costs_cents),
        total_seller_revenue_cents: Number(breakdown.total_seller_revenue_cents),
        net_to_platform_cents: Number(breakdown.net_to_platform_cents),
        recorded_at: new Date().toISOString(),
      },
      { onConflict: 'transaction_id', ignoreDuplicates: true }
    )

  if (error) {
    log.error('[fee-engine] recordFeeCollection upsert failed', {
      error,
      transaction_id: transactionId,
    })
    throw new Error(`recordFeeCollection failed: ${String(error.message)}`)
  }

  // Post commission journal entry (fire-and-forget)
  void recordCommissionRevenue(
    transactionId,
    transactionId,
    breakdown.agency_commission_cents,
    5 // 5% commission rate
  ).catch((e) => console.warn('[fee-engine] journal commission', e))

  log.info('[fee-engine] fee record saved', {
    transaction_id: transactionId,
    net_to_platform: Number(breakdown.net_to_platform_cents),
  })
}

// ── Utility: serialize FeeBreakdown to plain numbers for JSON responses ───────

export function serializeFeeBreakdown(b: FeeBreakdown): Record<string, number> {
  return {
    agency_commission_cents: Number(b.agency_commission_cents),
    imt_tax_cents: Number(b.imt_tax_cents),
    stamp_duty_cents: Number(b.stamp_duty_cents),
    notary_fee_cents: Number(b.notary_fee_cents),
    land_registry_cents: Number(b.land_registry_cents),
    psp_fee_cents: Number(b.psp_fee_cents),
    total_buyer_costs_cents: Number(b.total_buyer_costs_cents),
    total_seller_revenue_cents: Number(b.total_seller_revenue_cents),
    net_to_platform_cents: Number(b.net_to_platform_cents),
  }
}
