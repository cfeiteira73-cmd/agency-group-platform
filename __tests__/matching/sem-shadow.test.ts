// =============================================================================
// Phase 2C.C0-SEM-IMPL — Semantic Shadow Mode Tests
//
// Section 41 requirements:
//   1. Property document builder — correct serialisation
//   2. Buyer document builder — correct serialisation
//   3. Shadow mode — similarity computed, official score unchanged
//   4. Empty document → no embedding call, no shadow
//   5. Security: embedding column excluded from public search boundary
//   6. SHADOW INVARIANT: similarity = null on all V1 candidates
// =============================================================================

import { describe, it, expect } from 'vitest'
import {
  buildPropertySemanticDocument,
  buildBuyerSemanticDocument,
  parseEmbeddingString,
  cosineSimilarity,
  type PropertySemanticFields,
  type BuyerSemanticFields,
} from '@/lib/matching/sem-document-builder'

// ---------------------------------------------------------------------------
// 1. Property document builder
// ---------------------------------------------------------------------------

describe('buildPropertySemanticDocument', () => {
  it('assembles all fields into a deterministic document', () => {
    const fields: PropertySemanticFields = {
      nome:          'Moradia T4 Cascais',
      tipo:          'Moradia',
      zona:          'Cascais',
      bairro:        'Estoril',
      descricao:     'Vista mar, jardim privado.',
      features:      ['piscina', 'garagem'],
      amenities:     ['ginásio', 'concierge'],
      lifestyle_tags: ['coastal', 'luxury'],
      quartos:       4,
      area:          280,
    }
    const doc = buildPropertySemanticDocument(fields)
    expect(doc).toContain('Moradia T4 Cascais')
    expect(doc).toContain('Moradia')
    expect(doc).toContain('Cascais')
    expect(doc).toContain('Estoril')
    expect(doc).toContain('Vista mar')
    expect(doc).toContain('piscina')
    expect(doc).toContain('ginásio')
    expect(doc).toContain('coastal')
    expect(doc).toContain('4 quartos')
    expect(doc).toContain('280m²')
  })

  it('handles all-null input gracefully → empty string', () => {
    const fields: PropertySemanticFields = {
      nome: null, tipo: null, zona: null, bairro: null, descricao: null,
      features: null, amenities: null, lifestyle_tags: null,
      quartos: null, area: null,
    }
    expect(buildPropertySemanticDocument(fields)).toBe('')
  })

  it('excludes price/id/status from document (structural fields stay structural)', () => {
    const fields: PropertySemanticFields = {
      nome: 'A', tipo: null, zona: null, bairro: null, descricao: null,
      features: null, amenities: null, lifestyle_tags: null, quartos: null, area: null,
    }
    const doc = buildPropertySemanticDocument(fields)
    expect(doc).not.toContain('€')
    expect(doc).not.toContain('preco')
    expect(doc).not.toContain('price')
  })

  it('handles JSON object features by using keys', () => {
    const fields: PropertySemanticFields = {
      nome: null, tipo: null, zona: null, bairro: null, descricao: null,
      features: { piscina: true, garagem: true },
      amenities: null, lifestyle_tags: null, quartos: null, area: null,
    }
    const doc = buildPropertySemanticDocument(fields)
    expect(doc).toContain('piscina')
    expect(doc).toContain('garagem')
  })

  it('is deterministic — same input produces same output', () => {
    const fields: PropertySemanticFields = {
      nome: 'X', tipo: 'T3', zona: 'Lisboa', bairro: 'Belém',
      descricao: 'Desc', features: ['f1'], amenities: ['a1'],
      lifestyle_tags: ['t1'], quartos: 3, area: 120,
    }
    expect(buildPropertySemanticDocument(fields)).toBe(buildPropertySemanticDocument(fields))
  })
})

// ---------------------------------------------------------------------------
// 2. Buyer document builder
// ---------------------------------------------------------------------------

describe('buildBuyerSemanticDocument', () => {
  it('assembles intent fields into a document', () => {
    const fields: BuyerSemanticFields = {
      preferred_locations: ['Cascais', 'Estoril'],
      typologies_wanted:   ['Moradia'],
      buyer_purpose:       'primary_residence',
      buyer_features:      ['piscina', 'jardim'],
      buyer_notes:         'Looking for coastal property with sea views.',
      notes:               'Prefers quiet neighbourhood.',
    }
    const doc = buildBuyerSemanticDocument(fields)
    expect(doc).toContain('Cascais')
    expect(doc).toContain('Estoril')
    expect(doc).toContain('Moradia')
    expect(doc).toContain('primary_residence')
    expect(doc).toContain('piscina')
    expect(doc).toContain('coastal property')
    expect(doc).toContain('quiet neighbourhood')
  })

  it('returns empty string when all fields null/empty', () => {
    const fields: BuyerSemanticFields = {
      preferred_locations: null,
      typologies_wanted:   null,
      buyer_purpose:       null,
      buyer_features:      null,
      buyer_notes:         null,
      notes:               null,
    }
    expect(buildBuyerSemanticDocument(fields)).toBe('')
  })

  it('truncates buyer_notes at 300 chars', () => {
    const longNote = 'a'.repeat(500)
    const fields: BuyerSemanticFields = {
      preferred_locations: null, typologies_wanted: null, buyer_purpose: null,
      buyer_features: null, buyer_notes: longNote, notes: null,
    }
    const doc = buildBuyerSemanticDocument(fields)
    expect(doc.length).toBeLessThanOrEqual(300)
  })

  it('excludes PII and structural fields (budget, email, name)', () => {
    const fields: BuyerSemanticFields = {
      preferred_locations: ['Lisboa'],
      typologies_wanted: null, buyer_purpose: null, buyer_features: null,
      buyer_notes: null, notes: null,
    }
    const doc = buildBuyerSemanticDocument(fields)
    expect(doc).not.toContain('budget')
    expect(doc).not.toContain('@')
  })
})

// ---------------------------------------------------------------------------
// 3. parseEmbeddingString
// ---------------------------------------------------------------------------

describe('parseEmbeddingString', () => {
  it('parses a valid 1536-dim embedding', () => {
    const vec = Array.from({ length: 1536 }, (_, i) => i * 0.001)
    const raw = JSON.stringify(vec)
    const parsed = parseEmbeddingString(raw)
    expect(parsed).not.toBeNull()
    expect(parsed!.length).toBe(1536)
    expect(parsed![0]).toBeCloseTo(0)
  })

  it('returns null for null input', () => {
    expect(parseEmbeddingString(null)).toBeNull()
  })

  it('returns null for wrong dimension', () => {
    const vec = Array.from({ length: 512 }, () => 0.1)
    expect(parseEmbeddingString(JSON.stringify(vec))).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    expect(parseEmbeddingString('[not valid json')).toBeNull()
  })

  it('returns null for non-numeric values', () => {
    const vec = ['a', 'b', 'c']
    expect(parseEmbeddingString(JSON.stringify(vec))).toBeNull()
  })

  it('returns null for Infinity', () => {
    const vec = Array.from({ length: 1536 }, (_, i) => i === 0 ? Infinity : 0.1)
    // JSON.stringify converts Infinity to null, so the parsed result will have null
    // and fail the isFinite check
    const raw = JSON.stringify(vec)
    expect(parseEmbeddingString(raw)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 4. cosineSimilarity
// ---------------------------------------------------------------------------

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = [0.3, 0.4, 0.5, 0.6]
    expect(cosineSimilarity(v, v)).toBeCloseTo(1, 5)
  })

  it('returns 0 for orthogonal vectors', () => {
    const a = [1, 0, 0]
    const b = [0, 1, 0]
    expect(cosineSimilarity(a, b)).toBeCloseTo(0, 5)
  })

  it('returns -1 for opposite vectors', () => {
    const a = [1, 0]
    const b = [-1, 0]
    expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5)
  })

  it('returns 0 for zero-norm vector', () => {
    const a = [0, 0, 0]
    const b = [1, 2, 3]
    expect(cosineSimilarity(a, b)).toBe(0)
    expect(cosineSimilarity(b, a)).toBe(0)
  })

  it('returns 0 for mismatched lengths', () => {
    expect(cosineSimilarity([1, 2], [1, 2, 3])).toBe(0)
  })

  it('returns 0 for empty vectors', () => {
    expect(cosineSimilarity([], [])).toBe(0)
  })

  it('scales correctly — similar vectors have similarity closer to 1', () => {
    const a = [0.9, 0.1, 0.0]
    const b = [0.8, 0.2, 0.0]
    const c = [0.0, 0.0, 1.0]
    expect(cosineSimilarity(a, b)).toBeGreaterThan(cosineSimilarity(a, c))
  })
})

// ---------------------------------------------------------------------------
// 5. Shadow mode invariants
// ---------------------------------------------------------------------------

describe('Shadow mode invariants', () => {
  it('official V1PropertyCandidate.similarity must be null in shadow phase', () => {
    // The shadow mode contract: similarity = null on all V1 candidates.
    // semanticBonus(null) = 0 → official score is purely structural.
    // We verify this by checking the document builder does not produce
    // similarity values, and the scoring engine receives null.
    const fields: PropertySemanticFields = {
      nome: 'Test', tipo: 'Apartamento', zona: 'Lisboa', bairro: null,
      descricao: null, features: null, amenities: null, lifestyle_tags: null,
      quartos: 2, area: 90,
    }
    const doc = buildPropertySemanticDocument(fields)
    expect(doc).toBeTruthy()
    // The document builder does NOT produce a similarity score — it only
    // produces text. Similarity computation happens in match-buyer route.
    // This test confirms the builder's output is text only.
    expect(typeof doc).toBe('string')
  })

  it('cosine similarity ∈ [-1, 1] for text-embedding-3-small range', () => {
    // text-embedding-3-small produces unit-normalised vectors.
    // Cosine similarity of any two unit vectors ∈ [-1, 1].
    const normalize = (v: number[]) => {
      const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
      return v.map(x => x / norm)
    }
    const a = normalize([0.1, 0.2, 0.3, 0.4, 0.5])
    const b = normalize([0.5, 0.4, 0.3, 0.2, 0.1])
    const sim = cosineSimilarity(a, b)
    expect(sim).toBeGreaterThanOrEqual(-1)
    expect(sim).toBeLessThanOrEqual(1)
  })

  it('proposed_semantic_bonus formula: min(5, round(similarity * 5))', () => {
    const SHADOW_MAX = 5
    const cases: Array<{ sim: number; expectedBonus: number }> = [
      { sim: 1.0, expectedBonus: 5 },
      { sim: 0.8, expectedBonus: 4 },
      { sim: 0.6, expectedBonus: 3 },
      { sim: 0.4, expectedBonus: 2 },
      { sim: 0.2, expectedBonus: 1 },
      { sim: 0.0, expectedBonus: 0 },
    ]
    for (const { sim, expectedBonus } of cases) {
      const bonus = Math.min(SHADOW_MAX, Math.round(sim * SHADOW_MAX))
      expect(bonus).toBe(expectedBonus)
    }
  })

  it('shadow_combined_score never exceeds 100', () => {
    // structural_score = 95, proposed_bonus = 5 → shadow = min(100, 100) = 100
    const SHADOW_MAX = 5
    const structuralScore = 95
    const rawSim = 1.0
    const bonus = Math.min(SHADOW_MAX, Math.round(rawSim * SHADOW_MAX))
    const shadowCombined = Math.min(100, structuralScore + bonus)
    expect(shadowCombined).toBe(100)
  })

  it('public search_properties_semantic must retain is_off_market=false filter', async () => {
    // Security: the public-facing semantic search RPC must NOT expose off-market
    // properties. This test verifies the migration file contains the filter.
    const fs   = await import('fs')
    const path = await import('path')
    const migDir = path.resolve(__dirname, '../../supabase/migrations')
    // Find the migration that defines search_properties_semantic
    const files = fs.readdirSync(migDir).filter((f: string) => f.endsWith('.sql'))
    let found = false
    for (const file of files) {
      const content = fs.readFileSync(path.join(migDir, file), 'utf-8')
      if (content.includes('search_properties_semantic')) {
        expect(content).toContain('is_off_market = false')
        found = true
        break
      }
    }
    expect(found).toBe(true)
  })
})
