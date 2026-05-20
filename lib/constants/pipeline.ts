// =============================================================================
// Agency Group — Pipeline Constants (Single Source of Truth)
// lib/constants/pipeline.ts
//
// CANONICAL definitions for all revenue-critical pipeline constants.
// ALL pipeline calculations MUST import from here — never define inline.
//
// Rules:
//   • NEVER duplicate these values in other files
//   • NEVER override COMMISSION_RATE without explicit business approval
//   • NEVER change STAGE_PROBABILITY without updating stage_history records
//   • LEAD_SCORE thresholds must match across scoring engine AND operational agents
//
// AMI: 22506 | Segment: €100K–€100M | Commission: 5%
// =============================================================================

// ─── Commission ───────────────────────────────────────────────────────────────

/** Agency Group standard commission rate: 5% of transaction value */
export const COMMISSION_RATE = 0.05

/** CPCV split: 50% at signing, 50% at completion */
export const CPCV_SPLIT = 0.5

// ─── Pipeline stage close probabilities ──────────────────────────────────────

/**
 * Weighted close probability per pipeline stage (decimal 0.0–1.0).
 * Used to compute stage-weighted pipeline value:
 *   pipelineValue = deal.valor * STAGE_PROBABILITY[normalisedStage]
 *
 * Keys are lowercase normalised (remove accents/spaces).
 */
export const STAGE_PROBABILITY: Record<string, number> = {
  // ── Normalised keys (lowercase, no accents, no spaces) ──
  contacto:          0.05,
  angariacao:        0.05,  // listing acquisition
  lead:              0.05,
  qualificacao:      0.20,
  qualificado:       0.20,
  visitaagendada:    0.35,
  visita:            0.35,
  visitarealizada:   0.45,
  propostaenviada:   0.55,
  proposta:          0.60,
  propostaaceite:    0.65,
  negociacao:        0.70,
  duediligence:      0.72,
  financiamento:     0.78,
  cpcv:              0.85,
  cpcvassinado:      0.85,
  escrituramarcada:  0.92,
  escritura:         1.00,
  escrituraconcluida: 1.00,
  fechado:           1.00,
  posvenda:          1.00,
  postsale:          1.00,
  perdido:           0.00,
}

/** Default probability for unknown/unmapped stage */
export const STAGE_PROBABILITY_DEFAULT = 0.10

/**
 * Resolve stage probability from a raw stage string.
 * Normalises: lowercase, removes accents, spaces, underscores.
 */
export function getStageProbability(fase: unknown): number {
  if (!fase || typeof fase !== 'string') return STAGE_PROBABILITY_DEFAULT
  const k = fase.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')  // remove accents
    .replace(/[\s_-]+/g, '')                            // remove spaces/dashes
  if (STAGE_PROBABILITY[k] !== undefined) return STAGE_PROBABILITY[k]
  // Partial match fallback
  for (const [key, prob] of Object.entries(STAGE_PROBABILITY)) {
    if (k.includes(key) || key.includes(k)) return prob
  }
  return STAGE_PROBABILITY_DEFAULT
}

/**
 * Compute stage-weighted pipeline value for a single deal.
 * @param valor  Deal value in EUR
 * @param fase   Pipeline stage string (raw, will be normalised)
 */
export function computePipelineValue(valor: number, fase: unknown): number {
  return valor * getStageProbability(fase)
}

/**
 * Compute expected commission from a stage-weighted deal value.
 * @param valor  Deal value in EUR
 * @param fase   Pipeline stage string
 */
export function computeExpectedCommission(valor: number, fase: unknown): number {
  return computePipelineValue(valor, fase) * COMMISSION_RATE
}

// ─── Lead scoring thresholds ──────────────────────────────────────────────────

/**
 * Lead score tier thresholds (0–100 scale).
 * MUST match scoring engine (opportunityScore.ts) and operational agents.
 *
 * Canonical: HIGH ≥ 80, MEDIUM ≥ 60, LOW < 60
 */
export const LEAD_SCORE_THRESHOLDS = {
  HIGH:   80,   // Immediate action: auto-trigger deal pack, direct agent contact
  MEDIUM: 60,   // Warm nurturing: scheduled follow-up
  LOW:    0,    // Long-term nurturing: automated sequences only
} as const

export type LeadScoreTier = 'HIGH' | 'MEDIUM' | 'LOW'

/** Classify a lead score (0–100) into a tier */
export function classifyLeadScore(score: number): LeadScoreTier {
  if (score >= LEAD_SCORE_THRESHOLDS.HIGH)   return 'HIGH'
  if (score >= LEAD_SCORE_THRESHOLDS.MEDIUM) return 'MEDIUM'
  return 'LOW'
}

// ─── Lead scoring weights ─────────────────────────────────────────────────────

/**
 * Weights used by the agentic lead scoring formula.
 * Must sum to 1.0.
 * Canonical source — all `score_lead` tool implementations must import from here.
 *
 * score = engagement * 0.30 + budget_fit * 0.30 + timeline_urgency * 0.25 + profile_completeness * 0.15
 */
export const LEAD_SCORING_WEIGHTS = {
  engagement:            0.30,
  budget_fit:            0.30,
  timeline_urgency:      0.25,
  profile_completeness:  0.15,
} as const

// ─── Conversion baseline ──────────────────────────────────────────────────────

/**
 * Monthly close rate baseline (1 deal per 7 weeks ≈ 0.143).
 * Used in revenue forecasting as the default conversion probability
 * when no deal-specific signal is available.
 */
export const MONTHLY_CLOSE_RATE = 1 / 7 // ≈ 0.143
