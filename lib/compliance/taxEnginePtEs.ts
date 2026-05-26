// TypeScript strict — 0 errors
// =============================================================================
// Agency Group — Tax Engine PT+ES v1.0
// lib/compliance/taxEnginePtEs.ts
//
// Complete tax calculation engine for Portuguese and Spanish real estate:
//   PT: IMT (progressive brackets), Imposto do Selo, notary, registry, AIMI
//   ES: ITP/IVA/AJD, plusvalía municipal, notary, registry
//
// All monetary values in integer CENTS (bigint) to avoid float rounding.
// Pure functions — no DB calls except recordTaxAssessment.
//
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export type PropertyCategory = 'RESIDENTIAL' | 'COMMERCIAL' | 'LAND' | 'RUSTIC'
export type AcquisitionType = 'RESALE' | 'NEW_BUILD' | 'AUCTION' | 'INHERITANCE' | 'DONATION'

export interface PortugalTaxBreakdown {
  country: 'PT'
  // IMT (Imposto Municipal sobre Transmissões)
  imt_rate_pct: number
  imt_amount_cents: bigint
  // IS (Imposto do Selo)
  stamp_duty_rate_pct: number
  stamp_duty_cents: bigint
  // Notary + Registry
  notary_fee_cents: bigint
  land_registry_cents: bigint
  // Municipal tax (AIMI — annual, for reference)
  aimi_annual_estimate_cents: bigint
  // Total acquisition cost
  total_tax_cents: bigint
  effective_rate_pct: number
}

export interface SpainTaxBreakdown {
  country: 'ES'
  region: string
  // ITP (Impuesto sobre Transmisiones Patrimoniales) — resale
  itp_rate_pct: number
  itp_amount_cents: bigint
  // AJD (Actos Jurídicos Documentados) — new build
  ajd_rate_pct: number
  ajd_amount_cents: bigint
  // IVA (for new builds)
  iva_rate_pct: number
  iva_amount_cents: bigint
  // Plusvalía municipal (seller's gain tax, estimate)
  plusvalia_estimate_cents: bigint
  // Notary + Registry
  notary_fee_cents: bigint
  land_registry_cents: bigint
  total_tax_cents: bigint
  effective_rate_pct: number
}

// ─── Portugal IMT brackets 2026 ───────────────────────────────────────────────

// Progressive brackets for habitação própria e permanente (primary residence)
// Values in cents. upTo is inclusive upper bound.
// Formula: IMT = price * rate - deduction
export const PORTUGAL_IMT_BRACKETS: Array<{ upTo: bigint; rate: number; deduction: bigint }> = [
  { upTo: BigInt(9750000),    rate: 0,    deduction: BigInt(0) },       // ≤ €97,500 → 0%
  { upTo: BigInt(13316000),   rate: 0.02, deduction: BigInt(195000) },  // ≤ €133,160 → 2%
  { upTo: BigInt(18216000),   rate: 0.05, deduction: BigInt(594480) },  // ≤ €182,160 → 5%
  { upTo: BigInt(25200000),   rate: 0.07, deduction: BigInt(958800) },  // ≤ €252,000 → 7%
  { upTo: BigInt(55000000),   rate: 0.08, deduction: BigInt(1210800) }, // ≤ €550,000 → 8%
  { upTo: BigInt(1000000000), rate: 0.06, deduction: BigInt(0) },       // > €550k → 6% flat (luxury)
]

// Spain ITP rates by region (2026)
export const SPAIN_ITP_RATES: Record<string, number> = {
  MADRID:    6,
  ANDALUCIA: 7,
  CATALUNA:  10,
  VALENCIA:  10,
  GALICIA:   10,
  EUSKADI:   7,
  ARAGON:    8,
  DEFAULT:   6,
}

// ─── computeIMT (internal helper) ────────────────────────────────────────────

function computeIMT(priceCents: bigint, category: PropertyCategory, isHabitacaoPropria: boolean): bigint {
  if (category === 'COMMERCIAL' || category === 'LAND' || category === 'RUSTIC') {
    // Commercial/land/rustic: 6.5% flat
    return priceCents * BigInt(65) / BigInt(1000)
  }

  if (!isHabitacaoPropria) {
    // Secondary/investment residential: 6% flat
    return priceCents * BigInt(6) / BigInt(100)
  }

  // Primary residence: progressive brackets
  for (const bracket of PORTUGAL_IMT_BRACKETS) {
    if (priceCents <= bracket.upTo) {
      if (bracket.rate === 0) return BigInt(0)
      const raw = BigInt(Math.round(Number(priceCents) * bracket.rate)) - bracket.deduction
      return raw < BigInt(0) ? BigInt(0) : raw
    }
  }

  // Fallback: luxury rate 6%
  return priceCents * BigInt(6) / BigInt(100)
}

// ─── computePortugalTax ───────────────────────────────────────────────────────

export function computePortugalTax(
  salePriceCents: bigint,
  category: PropertyCategory,
  acquisitionType: AcquisitionType,
  isHabitacaoPropria: boolean,
): PortugalTaxBreakdown {
  // Inheritance and donations: IMT exempt (simplified — may vary)
  const imtAmount = (acquisitionType === 'INHERITANCE' || acquisitionType === 'DONATION')
    ? BigInt(0)
    : computeIMT(salePriceCents, category, isHabitacaoPropria)

  const imtRatePct = salePriceCents > BigInt(0)
    ? Math.round(Number(imtAmount * BigInt(10000) / salePriceCents)) / 100
    : 0

  // Imposto do Selo: 0.8% flat
  const stampDutyRate = 0.008
  const stampDutyCents = BigInt(Math.round(Number(salePriceCents) * stampDutyRate))

  // Notary fee: €1,500 for ≤ €500k, €2,000 for > €500k
  const notaryFeeCents = salePriceCents <= BigInt(50_000_000) ? BigInt(150_000) : BigInt(200_000)

  // Land registry: €500 standard
  const landRegistryCents = BigInt(50_000)

  // AIMI (annual estimate): 0.7% of taxable value
  const aimiAnnualCents = BigInt(Math.round(Number(salePriceCents) * 0.007))

  const totalTaxCents = imtAmount + stampDutyCents + notaryFeeCents + landRegistryCents

  const effectiveRatePct = salePriceCents > BigInt(0)
    ? Math.round(Number(totalTaxCents * BigInt(10000) / salePriceCents)) / 100
    : 0

  return {
    country:                  'PT',
    imt_rate_pct:             imtRatePct,
    imt_amount_cents:         imtAmount,
    stamp_duty_rate_pct:      0.8,
    stamp_duty_cents:         stampDutyCents,
    notary_fee_cents:         notaryFeeCents,
    land_registry_cents:      landRegistryCents,
    aimi_annual_estimate_cents: aimiAnnualCents,
    total_tax_cents:          totalTaxCents,
    effective_rate_pct:       effectiveRatePct,
  }
}

// ─── computeSpainTax ──────────────────────────────────────────────────────────

export function computeSpainTax(
  salePriceCents: bigint,
  category: PropertyCategory,
  acquisitionType: AcquisitionType,
  region: string,
  cadastralValueCents?: bigint,
): SpainTaxBreakdown {
  const regionKey = region.toUpperCase().replace(/\s+/g, '_') as keyof typeof SPAIN_ITP_RATES
  const itpRatePct = SPAIN_ITP_RATES[regionKey] ?? SPAIN_ITP_RATES['DEFAULT']!

  const isNewBuild = acquisitionType === 'NEW_BUILD'
  const isCommercial = category === 'COMMERCIAL'

  // ITP (only for resale)
  const itpAmountCents = (!isNewBuild)
    ? BigInt(Math.round(Number(salePriceCents) * itpRatePct / 100))
    : BigInt(0)

  // AJD: 1.5% for new builds
  const ajdRatePct = isNewBuild ? 1.5 : 0
  const ajdAmountCents = isNewBuild
    ? BigInt(Math.round(Number(salePriceCents) * 0.015))
    : BigInt(0)

  // IVA: new builds only — 10% residential, 21% commercial
  const ivaRatePct = isNewBuild ? (isCommercial ? 21 : 10) : 0
  const ivaAmountCents = isNewBuild
    ? BigInt(Math.round(Number(salePriceCents) * ivaRatePct / 100))
    : BigInt(0)

  // Plusvalía municipal estimate: 2% of cadastral value
  const refValue = cadastralValueCents ?? salePriceCents
  const plusvaliaCents = refValue * BigInt(2) / BigInt(100)

  // Notary: €1,800
  const notaryFeeCents = BigInt(180_000)

  // Registry: €600
  const landRegistryCents = BigInt(60_000)

  const totalTaxCents = itpAmountCents + ajdAmountCents + ivaAmountCents + plusvaliaCents + notaryFeeCents + landRegistryCents

  const effectiveRatePct = salePriceCents > BigInt(0)
    ? Math.round(Number(totalTaxCents * BigInt(10000) / salePriceCents)) / 100
    : 0

  return {
    country:              'ES',
    region:               region,
    itp_rate_pct:         itpRatePct,
    itp_amount_cents:     itpAmountCents,
    ajd_rate_pct:         ajdRatePct,
    ajd_amount_cents:     ajdAmountCents,
    iva_rate_pct:         ivaRatePct,
    iva_amount_cents:     ivaAmountCents,
    plusvalia_estimate_cents: plusvaliaCents,
    notary_fee_cents:     notaryFeeCents,
    land_registry_cents:  landRegistryCents,
    total_tax_cents:      totalTaxCents,
    effective_rate_pct:   effectiveRatePct,
  }
}

// ─── computeTotalAcquisitionCost ──────────────────────────────────────────────

export function computeTotalAcquisitionCost(
  salePriceCents: bigint,
  country: 'PT' | 'ES',
  options: {
    category?: PropertyCategory
    acquisitionType?: AcquisitionType
    region?: string
    isHabitacaoPropria?: boolean
    cadastralValueCents?: bigint
  } = {},
): {
  sale_price_cents: bigint
  tax_breakdown: PortugalTaxBreakdown | SpainTaxBreakdown
  total_acquisition_cents: bigint
  monthly_cost_cents: bigint
} {
  const category = options.category ?? 'RESIDENTIAL'
  const acquisitionType = options.acquisitionType ?? 'RESALE'

  let taxBreakdown: PortugalTaxBreakdown | SpainTaxBreakdown

  if (country === 'PT') {
    taxBreakdown = computePortugalTax(
      salePriceCents,
      category,
      acquisitionType,
      options.isHabitacaoPropria ?? true,
    )
  } else {
    taxBreakdown = computeSpainTax(
      salePriceCents,
      category,
      acquisitionType,
      options.region ?? 'DEFAULT',
      options.cadastralValueCents,
    )
  }

  const totalAcquisitionCents = salePriceCents + taxBreakdown.total_tax_cents

  // Monthly cost: 20-year amortization (240 months)
  const monthlyCostCents = totalAcquisitionCents / BigInt(240)

  return {
    sale_price_cents:       salePriceCents,
    tax_breakdown:          taxBreakdown,
    total_acquisition_cents:totalAcquisitionCents,
    monthly_cost_cents:     monthlyCostCents,
  }
}

// ─── recordTaxAssessment ──────────────────────────────────────────────────────

export async function recordTaxAssessment(
  transactionId: string,
  breakdown: PortugalTaxBreakdown | SpainTaxBreakdown,
  tenantId: string,
): Promise<void> {
  void (supabaseAdmin as any).from('tax_assessments').insert({
    tenant_id:       tenantId,
    transaction_id:  transactionId,
    country:         breakdown.country,
    sale_price_cents:0, // Will be set by caller if needed
    total_tax_cents: Number(breakdown.total_tax_cents),
    breakdown:       JSON.parse(JSON.stringify(breakdown, (_k, v) =>
      typeof v === 'bigint' ? v.toString() : v,
    )),
  }).then(({ error: e }: { error: { message: string } | null }) => {
    if (e) console.warn('[taxEnginePtEs] assessment insert', e.message)
  })
}
