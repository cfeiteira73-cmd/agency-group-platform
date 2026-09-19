// =============================================================================
// Phase 2C.C0-SEM-IMPL — Canonical Semantic Document Builders
//
// Produces deterministic text documents for embedding generation and
// semantic shadow observation. Does NOT affect official structural V1.
//
// SHADOW MODE INVARIANT:
//   Embeddings → observational data only.
//   Official match_score = structural V1 always (semantic_bonus = 0 in shadow).
//   Structural V1 remains production authority.
//
// STALENESS NOTE (see Section AG of SEM-IMPL report):
//   DB trigger nulls embedding on descricao change only.
//   Fields nome/tipo/zona/bairro/features/amenities/lifestyle_tags/quartos/area
//   also participate in the canonical document but are NOT covered by the trigger.
//   Pre-existing fields (nome/tipo/zona/quartos/area) already had this limitation
//   before SEM-IMPL. New fields (bairro/features/amenities/lifestyle_tags) add
//   the same limitation incrementally. Acceptable for shadow mode only.
//   RECOMMENDED ACTION: migration to extend trigger — see technical debt.
// =============================================================================

// ---------------------------------------------------------------------------
// Property semantic document
// ---------------------------------------------------------------------------

export interface PropertySemanticFields {
  nome:          string | null
  tipo:          string | null
  zona:          string | null
  bairro:        string | null
  descricao:     string | null
  features:      unknown       // Json — may be string[], object, or null
  amenities:     unknown       // Json
  lifestyle_tags: unknown      // Json
  quartos:       number | null
  area:          number | null
}

/** Safely extract string values from a Json field. */
function jsonToStrings(value: unknown): string[] {
  if (!value) return []
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string' && v.trim() !== '')
  }
  if (typeof value === 'object' && value !== null) {
    return Object.keys(value as Record<string, unknown>)
      .filter(k => k.trim() !== '')
  }
  if (typeof value === 'string' && value.trim()) return [value.trim()]
  return []
}

/**
 * Canonical property embedding document.
 * Deterministic: same input → same output.
 * Excluded: id, status, preco (structural), is_off_market (auth metadata),
 *   agent_id, timestamps, internal operational fields.
 */
export function buildPropertySemanticDocument(p: PropertySemanticFields): string {
  const parts: string[] = []

  if (p.nome)     parts.push(p.nome)
  if (p.tipo)     parts.push(p.tipo)
  if (p.zona)     parts.push(p.zona)
  if (p.bairro)   parts.push(p.bairro)
  if (p.descricao) parts.push(p.descricao)

  const featStrs = jsonToStrings(p.features)
  if (featStrs.length) parts.push(`características: ${featStrs.join(', ')}`)

  const amenStrs = jsonToStrings(p.amenities)
  if (amenStrs.length) parts.push(`amenidades: ${amenStrs.join(', ')}`)

  const tagStrs = jsonToStrings(p.lifestyle_tags)
  if (tagStrs.length) parts.push(tagStrs.join(', '))

  if (p.quartos != null) parts.push(`${p.quartos} quartos`)
  if (p.area    != null) parts.push(`${p.area}m²`)

  return parts.join('. ')
}

// ---------------------------------------------------------------------------
// Buyer intent semantic document
// ---------------------------------------------------------------------------

export interface BuyerSemanticFields {
  preferred_locations: string[] | null  // zona preference (already structural but useful context)
  typologies_wanted:   string[] | null  // canonical typology preference
  buyer_purpose:       string | null    // 'investment' | 'primary_residence' | 'golden_visa' | etc.
  buyer_features:      string[] | null  // explicit feature requirements
  buyer_notes:         string | null    // buyer-specific notes
  notes:               string | null    // general contact notes
}

const NOTES_MAX_CHARS = 300

/**
 * Canonical buyer intent embedding document.
 * Uses ONLY production contacts fields with legitimate semantic meaning.
 * Excluded: full_name, email, phone, nationality, buyer_score, budget
 *   (structural), agent identity, demographic metadata, CRM operational fields.
 * Empty document (all null/empty inputs) returns '' — caller handles gracefully.
 */
export function buildBuyerSemanticDocument(b: BuyerSemanticFields): string {
  const parts: string[] = []

  if (b.preferred_locations?.length) {
    parts.push(`Localizações: ${b.preferred_locations.join(', ')}`)
  }
  if (b.typologies_wanted?.length) {
    parts.push(`Tipologias: ${b.typologies_wanted.join(', ')}`)
  }
  if (b.buyer_purpose) {
    parts.push(`Propósito: ${b.buyer_purpose}`)
  }
  if (b.buyer_features?.length) {
    parts.push(`Requisitos: ${b.buyer_features.join(', ')}`)
  }
  if (b.buyer_notes) {
    const t = b.buyer_notes.slice(0, NOTES_MAX_CHARS).trim()
    if (t) parts.push(t)
  }
  if (b.notes) {
    const t = b.notes.slice(0, NOTES_MAX_CHARS).trim()
    if (t) parts.push(t)
  }

  return parts.join('. ')
}

// ---------------------------------------------------------------------------
// Embedding parse utility (read back from Supabase: stored as string)
// ---------------------------------------------------------------------------

/**
 * Parse a pgvector string ("[0.1,0.2,...]") back to number[].
 * Returns null on any parse error or dimension mismatch.
 */
export function parseEmbeddingString(raw: string | null, expectedDim = 1536): number[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return null
    if (parsed.length !== expectedDim) return null
    if (!parsed.every(v => typeof v === 'number' && isFinite(v))) return null
    return parsed as number[]
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Cosine similarity
// ---------------------------------------------------------------------------

/**
 * Cosine similarity between two equal-length vectors. Returns 0 on zero norms.
 * Result ∈ [-1, 1]; for text-embedding-3-small practically ∈ [0, 1].
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot   += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return 0
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}
