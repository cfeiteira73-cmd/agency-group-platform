// =============================================================================
// Phase 2C.C1 — V1 Matching Scoring Engine
// Phase 2C.C0-SF1 — Structural Matching Repair
//
// Normalized scoring contract:
//   score = round((earned_pts / available_weight) × 100) + semantic_bonus
//   available_weight = sum of weights for criteria WHERE contact data EXISTS
//   Minimum available_weight = 0 when all criteria unknown (score = 0)
//   Semantic bonus: +0 to +5 — never in denominator
//
// INVARIANT: UNKNOWN ≠ BAD FIT
//   Empty zonas    → excluded from denominator (NOT penalized)
//   Empty tipos    → excluded from denominator (NOT penalized)
//   Missing budget  → excluded from denominator (NOT penalized)
//   Missing quartos → excluded from denominator (NOT penalized)
//   buyer_score     → commercial priority tiebreaker only (NOT in score)
//
// INVARIANT: MATCH FOUND ≠ PROPERTY DISCLOSED
//   Scores and results are for authorized agent review only.
//   Disclosure requires explicit human decision.
// =============================================================================

export interface V1ContactProfile {
  zonas:       string[]       // [] means UNKNOWN — excluded from denominator
  tipos:       string[]       // [] means UNKNOWN — excluded from denominator
  budget_min:  number | null  // nullable (67% of contacts have NULL)
  budget_max:  number | null  // nullable
  quartos_min: number | null  // nullable (contacts has no quartos field — from request)
  buyer_score: number | null  // commercial priority tiebreaker, NOT match quality
}

export interface V1PropertyCandidate {
  id:           string
  nome:         string | null
  zona:         string | null
  tipo:         string | null
  preco:        number | null
  quartos:      number | null
  area:         number | null
  is_off_market: boolean
  similarity:   number | null  // pgvector cosine similarity 0-1; null when no embedding
}

export type UpsertResult =
  | { result: 'created';              id: string }
  | { result: 'rescored';             id: string }
  | { result: 'legacy_duplicate_set'; lead_id: number; property_id: string; mandate_id: string | null; duplicate_count: number }
  | { result: 'below_threshold' }
  | { result: 'failed';               error: string }

export interface V1ScoreDetail {
  score:             number
  earned_pts:        number
  available_weight:  number
  zona_pts:          number       // 0 | 15 | 25
  tipo_pts:          number       // 0 | 20
  budget_pts:        number | null // null = excluded (unknown budget)
  quartos_pts:       number | null // null = excluded (unknown preference)
  semantic_bonus:    number        // 0–5
  commercial_priority: number | null  // buyer_score — separate from score
}

export interface V1Decision {
  next_best_action:     string
  priority_level:       'high' | 'medium' | 'low'
  next_action_deadline: string   // ISO 8601
  match_weaknesses:     string[]
}

export interface V1MatchResult {
  property:           V1PropertyCandidate
  score:              number
  score_detail:       V1ScoreDetail
  match_reasons:      string[]
  explanation:        string
  estimated_yield:    number | null
  decision:           V1Decision
  commercial_priority: number | null
}

// Score weights
const W_ZONA    = 25
const W_TIPO    = 20
const W_BUDGET  = 30
const W_QUARTOS = 10
const MAX_SEMANTIC_BONUS = 5

// Score thresholds
export const THRESHOLD_WRITE     = 40  // minimum to persist to matches table
export const THRESHOLD_ALERT     = 70  // agent alert threshold
export const THRESHOLD_DEAL_PACK = 80  // deal-pack eligibility (requires explicit gate)

// ---------------------------------------------------------------------------
// Internal scoring helpers
// ---------------------------------------------------------------------------

function normalise(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function scoreZona(propertyZona: string | null, zonas: string[]): number {
  if (!propertyZona || zonas.length === 0) return 0
  const normProp = normalise(propertyZona)
  for (const z of zonas) {
    const normZ = normalise(z)
    if (normProp === normZ) return W_ZONA           // exact match: 25
    if (normProp.includes(normZ) || normZ.includes(normProp)) return 15  // partial: 15
  }
  return 0
}

function scoreTipo(propertyTipo: string | null, tipos: string[]): number {
  if (!propertyTipo || tipos.length === 0) return 0
  const normProp = normalise(propertyTipo)
  return tipos.some(t => {
    const normT = normalise(t)
    return normProp === normT || normProp.includes(normT) || normT.includes(normProp)
  }) ? W_TIPO : 0
}

function scoreBudget(
  preco: number | null,
  budgetMin: number | null,
  budgetMax: number | null
): number {
  if (preco === null || preco <= 0) return 0
  const min = budgetMin ?? 0
  const max = budgetMax ?? Infinity
  if (preco >= min && preco <= max) return W_BUDGET                                           // in range: 30
  if (isFinite(max) && preco > max && preco <= max * 1.1) return Math.round(W_BUDGET * 0.5)  // above max by ≤10%: 15
  return 0
}

function scoreQuartos(propertyQuartos: number | null, quartosMin: number): number {
  if (propertyQuartos === null) return 0
  return propertyQuartos >= quartosMin ? W_QUARTOS : 0
}

function semanticBonus(similarity: number | null): number {
  if (!similarity || similarity <= 0) return 0
  return Math.min(MAX_SEMANTIC_BONUS, Math.round(similarity * MAX_SEMANTIC_BONUS))
}

// ---------------------------------------------------------------------------
// Core scoring function — exported for unit testing
// ---------------------------------------------------------------------------

export function scoreV1(
  contact:  V1ContactProfile,
  property: V1PropertyCandidate
): V1ScoreDetail {
  const zona_pts = scoreZona(property.zona, contact.zonas)
  const tipo_pts = scoreTipo(property.tipo, contact.tipos)

  // Budget: exclude from denominator if BOTH budget_min and budget_max are null
  const hasBudget = contact.budget_min !== null || contact.budget_max !== null
  const budget_pts = hasBudget
    ? scoreBudget(property.preco, contact.budget_min, contact.budget_max)
    : null

  // Quartos: exclude from denominator if contact has no quartos preference
  const hasQuartos = contact.quartos_min !== null && contact.quartos_min > 0
  const quartos_pts = hasQuartos
    ? scoreQuartos(property.quartos, contact.quartos_min as number)
    : null

  const bonus = semanticBonus(property.similarity)

  // Denominator: only criteria where contact data exists (UNKNOWN ≠ BAD FIT)
  let available_weight = 0
  if (contact.zonas.length > 0)  available_weight += W_ZONA
  if (contact.tipos.length > 0)  available_weight += W_TIPO
  if (budget_pts  !== null) available_weight += W_BUDGET
  if (quartos_pts !== null) available_weight += W_QUARTOS

  const earned_pts = zona_pts + tipo_pts + (budget_pts ?? 0) + (quartos_pts ?? 0)
  const base_score = available_weight > 0
    ? Math.round((earned_pts / available_weight) * 100)
    : 0
  const score      = Math.min(100, base_score + bonus)

  return {
    score,
    earned_pts,
    available_weight,
    zona_pts,
    tipo_pts,
    budget_pts,
    quartos_pts,
    semantic_bonus:      bonus,
    commercial_priority: contact.buyer_score,
  }
}

// ---------------------------------------------------------------------------
// Decision engine
// ---------------------------------------------------------------------------

export function computeV1Decision(
  score:    number,
  detail:   V1ScoreDetail,
  property: V1PropertyCandidate
): V1Decision {
  let priority_level:   'high' | 'medium' | 'low'
  let next_best_action: string
  let hoursToDeadline:  number

  if (score >= THRESHOLD_DEAL_PACK) {
    priority_level   = 'high'
    next_best_action = 'Enviar ficha do imóvel e contactar comprador hoje'
    hoursToDeadline  = 24
  } else if (score >= THRESHOLD_ALERT) {
    priority_level   = 'medium'
    next_best_action = 'Agendar visita esta semana'
    hoursToDeadline  = 72
  } else {
    priority_level   = 'low'
    next_best_action = 'Adicionar a sequência de nurture (D+7 follow-up)'
    hoursToDeadline  = 168
  }

  const next_action_deadline = new Date(
    Date.now() + hoursToDeadline * 3_600_000
  ).toISOString()

  const weaknesses: string[] = []
  if (detail.zona_pts === 0) {
    weaknesses.push('Fora da zona pretendida pelo comprador')
  }
  if (detail.tipo_pts === 0) {
    weaknesses.push('Tipologia diferente do pretendido')
  }
  if (detail.budget_pts !== null) {
    if (detail.budget_pts === Math.round(W_BUDGET * 0.5)) {
      weaknesses.push('Preço ligeiramente acima do orçamento (+10%)')
    } else if (detail.budget_pts === 0) {
      weaknesses.push('Preço acima do orçamento do comprador')
    }
  }
  if (detail.quartos_pts !== null && detail.quartos_pts === 0) {
    weaknesses.push('Número de quartos abaixo do preferido')
  }
  if (weaknesses.length === 0) {
    weaknesses.push('Sem fraquezas significativas identificadas')
  }

  return { next_best_action, priority_level, next_action_deadline, match_weaknesses: weaknesses }
}

// ---------------------------------------------------------------------------
// Reason builder
// ---------------------------------------------------------------------------

function buildReasons(
  detail:   V1ScoreDetail,
  property: V1PropertyCandidate
): string[] {
  const reasons: string[] = []

  if (detail.zona_pts > 0) {
    reasons.push(`Zona ${property.zona ?? ''} conforme pretendido`)
  }
  if (detail.tipo_pts > 0) {
    reasons.push(`Tipologia ${property.tipo ?? ''} conforme solicitado`)
  }
  if (detail.budget_pts === W_BUDGET) {
    const k = Math.round((property.preco ?? 0) / 1_000)
    reasons.push(`Preço €${k}K dentro do orçamento`)
  } else if (detail.budget_pts === Math.round(W_BUDGET * 0.5)) {
    reasons.push('Preço ligeiramente acima do orçamento (+10%)')
  }
  if (detail.quartos_pts === W_QUARTOS) {
    reasons.push(`${property.quartos} quartos — atende ao mínimo pretendido`)
  }
  if (detail.semantic_bonus > 0) {
    const pct = ((property.similarity ?? 0) * 100).toFixed(0)
    reasons.push(`Alta semelhança semântica (${pct}%)`)
  }
  if (property.is_off_market) {
    reasons.push('Imóvel off-market — acesso exclusivo para clientes internos')
  }
  return reasons
}

// ---------------------------------------------------------------------------
// Explanation builder
// ---------------------------------------------------------------------------

function buildExplanation(
  property: V1PropertyCandidate,
  score:    number,
  reasons:  string[]
): string {
  const quality  = score >= 80 ? 'excelente' : score >= 60 ? 'muito boa' : score >= 40 ? 'boa' : 'razoável'
  const priceK   = Math.round((property.preco ?? 0) / 1_000)
  const offNote  = property.is_off_market ? ' (off-market)' : ''
  const topReasons = reasons.filter(r => !r.includes('off-market')).slice(0, 2).join(' · ')
  return `Correspondência ${quality} (${score}/100)${offNote}. €${priceK}K · ${topReasons}.`
}

// ---------------------------------------------------------------------------
// Rank results: score DESC then commercial_priority DESC (UNKNOWN ≠ BAD FIT)
// Only includes results at or above THRESHOLD_WRITE
// ---------------------------------------------------------------------------

export function rankV1Results(results: V1MatchResult[]): V1MatchResult[] {
  return results
    .filter(r => r.score >= THRESHOLD_WRITE)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return (b.commercial_priority ?? 0) - (a.commercial_priority ?? 0)
    })
}

// ---------------------------------------------------------------------------
// Main entry point: score + rank a list of properties against a contact
// ---------------------------------------------------------------------------

export function matchV1(
  contact:    V1ContactProfile,
  properties: V1PropertyCandidate[]
): V1MatchResult[] {
  const results = properties.map(property => {
    const detail    = scoreV1(contact, property)
    const reasons   = buildReasons(detail, property)
    const decision  = computeV1Decision(detail.score, detail, property)
    const explain   = buildExplanation(property, detail.score, reasons)

    return {
      property,
      score:             detail.score,
      score_detail:      detail,
      match_reasons:     reasons,
      explanation:       explain,
      estimated_yield:   null,
      decision,
      commercial_priority: contact.buyer_score,
    } satisfies V1MatchResult
  })

  return rankV1Results(results)
}
