// =============================================================================
// Agency Group — Investor Types
// lib/investors/types.ts
//
// TypeScript interfaces for the investor matching engine.
// Mirrors the DB schema for `investors`, `investor_matches`, and engine I/O.
// AMI: 22506 | Segment: €100K–€100M
// =============================================================================

// ---------------------------------------------------------------------------
// DB row — investors table
// ---------------------------------------------------------------------------

export type InvestorStatus = 'active' | 'inactive' | 'archived'
export type RiskTolerance  = 'conservative' | 'moderate' | 'aggressive'

export interface InvestorProfile {
  /** UUID primary key */
  id: string

  /** Tenant isolation — all queries must filter by this */
  tenant_id: string

  // ── Identity ──────────────────────────────────────────────────────────────
  full_name:   string
  email:       string | null
  phone:       string | null
  company:     string | null
  nationality: string | null

  // ── Capital parameters ────────────────────────────────────────────────────
  /** Minimum ticket size in EUR */
  capital_min_eur: number | null
  /** Maximum ticket size in EUR */
  capital_max_eur: number | null

  // ── Return preferences ────────────────────────────────────────────────────
  /** Target gross yield percentage (e.g. 5.5 = 5.5%) */
  yield_target_pct: number | null

  // ── Risk ─────────────────────────────────────────────────────────────────
  risk_tolerance: RiskTolerance | null

  // ── Geographic preference ─────────────────────────────────────────────────
  /** Array of zone/region strings — e.g. ['Lisboa', 'Cascais', 'Algarve'] */
  geography_preference: string[] | null

  // ── Asset type preference ─────────────────────────────────────────────────
  /** Normalised types — e.g. ['apartment', 'commercial'] */
  property_type_preference: string[] | null

  // ── CRM ───────────────────────────────────────────────────────────────────
  status:          InvestorStatus
  notes:           string | null
  source:          string | null
  assigned_agent:  string | null

  // ── Timestamps ────────────────────────────────────────────────────────────
  created_at:      string
  updated_at:      string
  last_matched_at: string | null
}

// ---------------------------------------------------------------------------
// Engine I/O
// ---------------------------------------------------------------------------

/**
 * Minimal property shape required by the match engine.
 * Pulled from the `properties` DB table at match time.
 */
export interface PropertyInput {
  id:      string
  /** Asking price in EUR */
  preco:   number
  /** Zone identifier (maps to our zone system) */
  zona:    string | null
  /** Neighbourhood / bairro */
  bairro:  string | null
  /** Raw typology string — e.g. 'T2', 'Moradia', 'Loja' */
  tipo:    string | null
  /** Price per m² — used for risk classification */
  preco_m2: number | null
}

/**
 * Score dimensions returned by the engine for a single investor–property pair.
 */
export interface MatchScoreDimensions {
  /** 0-1 — how well the property price fits the investor's capital range */
  capital_fit:   number
  /** 0-1 — alignment between estimated yield and investor's yield target */
  yield_fit:     number
  /** 0-1 — whether the property zone is in the investor's geography preference */
  geography_fit: number
  /** 0-1 — alignment between property risk level and investor risk tolerance */
  risk_fit:      number
  /** 0-1 — whether the property type matches the investor's type preference */
  type_fit:      number
}

/**
 * Full result for one investor–property match.
 */
export interface InvestorMatchResult {
  investor_id:   string
  property_id:   string
  /** Composite score 0-100 */
  match_score:   number
  /** Raw dimension breakdown */
  dimensions:    MatchScoreDimensions
  /** The investor profile used (convenience — avoids a second lookup) */
  investor:      InvestorProfile
  /** ISO timestamp of the match computation */
  computed_at:   string
}

/**
 * Request payload for the match engine API endpoint.
 */
export interface InvestorMatchRequest {
  property_id: string
}
