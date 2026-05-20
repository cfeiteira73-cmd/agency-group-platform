// lib/constants/revenue.ts
// Single Source of Truth for Portuguese real estate financial constants.

export { COMMISSION_RATE } from './pipeline'

export interface IMTBracket {
  upTo: number
  rate: number
  deduction: number
}

export const IMT_BRACKETS_RESIDENTIAL: IMTBracket[] = [
  { upTo: 97064,    rate: 0,     deduction: 0        },
  { upTo: 132774,   rate: 0.02,  deduction: 1941.28  },
  { upTo: 181034,   rate: 0.05,  deduction: 5924.50  },
  { upTo: 301688,   rate: 0.07,  deduction: 9546.18  },
  { upTo: 578598,   rate: 0.08,  deduction: 12563.06 },
  { upTo: 1050400,  rate: 0.06,  deduction: 0        },
  { upTo: Infinity, rate: 0.075, deduction: 0        },
]

export const IMT_BRACKETS_NON_RESIDENTIAL: IMTBracket[] = [
  { upTo: Infinity, rate: 0.065, deduction: 0 },
]

export function computeIMT(price: number, isResidential = true): number {
  const brackets = isResidential ? IMT_BRACKETS_RESIDENTIAL : IMT_BRACKETS_NON_RESIDENTIAL
  for (const bracket of brackets) {
    if (price <= bracket.upTo) {
      return Math.max(0, price * bracket.rate - bracket.deduction)
    }
  }
  return 0
}

export const STAMP_DUTY_RATE = 0.008
export const STAMP_DUTY_MORTGAGE_RATE = 0.006
export const IMI_RATE_URBAN_MIN = 0.003
export const IMI_RATE_URBAN_MAX = 0.0045
export const IMI_RATE_RUSTIC = 0.008
export const IFICI_FLAT_TAX_RATE = 0.20
export const NHR_FLAT_TAX_RATE_LEGACY = 0.20
export const MAIS_VALIAS_INCLUSION_RATE = 0.50
export const MAIS_VALIAS_MAX_TAX_RATE = 0.48
export const CPCV_PAYMENT_FRACTION = 0.50
export const ESCRITURA_PAYMENT_FRACTION = 0.50
export const TYPICAL_SIGNAL_RATE_MIN = 0.10
export const TYPICAL_SIGNAL_RATE_MAX = 0.20
