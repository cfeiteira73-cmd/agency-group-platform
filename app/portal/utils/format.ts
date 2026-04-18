// =============================================================================
// AGENCY GROUP — Portal Format Utilities
// Shared number / currency parsing helpers used across portal components.
// Single source of truth — do not duplicate in individual components.
// =============================================================================

/**
 * Parses a Portuguese/European currency string or number into a plain float.
 * Handles formats: "€ 1.250.000", "1.250.000,00", "1250000", 1250000, etc.
 *
 * @example
 *   parsePTValue("€ 3.800.000")  // → 3800000
 *   parsePTValue("2.100.000,50") // → 2100000.5
 *   parsePTValue(1500000)        // → 1500000
 *   parsePTValue(null)           // → 0
 */
export function parsePTValue(val: string | number | null | undefined): number {
  if (typeof val === 'number') return isNaN(val) ? 0 : val
  if (!val) return 0
  const clean = String(val).trim().replace(/[€$£\s\u00A0]/g, '')
  if (!clean) return 0
  const hasComma = clean.includes(',')
  const dotCount = (clean.match(/\./g) || []).length
  if (hasComma) return parseFloat(clean.replace(/\./g, '').replace(',', '.')) || 0
  if (dotCount > 1) return parseFloat(clean.replace(/\./g, '')) || 0
  if (dotCount === 1) {
    const parts = clean.split('.')
    if (parts[1] && parts[1].length === 3) return parseFloat(clean.replace('.', '')) || 0
    return parseFloat(clean) || 0
  }
  return parseFloat(clean) || 0
}

/**
 * Formats a number as a Portuguese currency string.
 * @example formatCurrency(1250000) → "€ 1.250.000"
 */
export function formatCurrency(value: number, decimals = 0): string {
  if (!value || isNaN(value)) return '€ 0'
  return `€ ${value.toLocaleString('pt-PT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

/**
 * Computes average days a deal spends in a given stage from a list of deals.
 * Uses createdAt as a proxy for stage entry time (approximation).
 * Returns a record of stage → average days, capped at 365.
 */
export function computeStageAvgDays(
  deals: { fase: string; createdAt?: string; cpcvDate?: string; escrituraDate?: string }[],
  stages: string[],
): Record<string, number> {
  const stageDays: Record<string, number[]> = {}

  for (const deal of deals) {
    if (!deal.fase || !deal.createdAt) continue
    const created = new Date(deal.createdAt)
    if (isNaN(created.getTime())) continue

    // Use latest meaningful date as proxy for "moved out of stage"
    const exitDate =
      (deal.escrituraDate && new Date(deal.escrituraDate).getTime()) ||
      (deal.cpcvDate && new Date(deal.cpcvDate).getTime()) ||
      Date.now()

    const days = Math.min(365, Math.max(0, Math.floor((exitDate - created.getTime()) / 86400000)))
    if (!stageDays[deal.fase]) stageDays[deal.fase] = []
    stageDays[deal.fase].push(days)
  }

  const result: Record<string, number> = {}
  for (const stage of stages) {
    const arr = stageDays[stage]
    if (arr && arr.length > 0) {
      result[stage] = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length)
    } else {
      result[stage] = 0 // no data for this stage
    }
  }
  return result
}
