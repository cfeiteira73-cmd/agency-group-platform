// lib/constants/scoring.ts
// Single Source of Truth for lead scoring thresholds and weights.

export { LEAD_SCORING_WEIGHTS } from './pipeline'

export const LEAD_SCORE_HOT   = 80
export const LEAD_SCORE_WARM  = 60
export const LEAD_SCORE_COLD  = 40

export const PRIORITY_HIGH_THRESHOLD   = 80
export const PRIORITY_MEDIUM_THRESHOLD = 60

export function getPriorityLevel(score: number): 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= PRIORITY_HIGH_THRESHOLD) return 'HIGH'
  if (score >= PRIORITY_MEDIUM_THRESHOLD) return 'MEDIUM'
  return 'LOW'
}

export const OFFMARKET_SCORE_EXCELLENT = 80
export const OFFMARKET_SCORE_GOOD      = 60
export const OFFMARKET_SCORE_MARGINAL  = 40
export const OFFMARKET_AUTO_EVAL_THRESHOLD = 40

export const MATCH_SCORE_AUTO_DEALPACK = 80
export const MATCH_SCORE_QUALIFY       = 50

export const BUYER_SCORE_HOT  = 75
export const BUYER_SCORE_WARM = 50

export const STALLED_DEAL_DAYS_WARN     = 7
export const STALLED_DEAL_DAYS_ALERT    = 14
export const STALLED_DEAL_DAYS_CRITICAL = 30
