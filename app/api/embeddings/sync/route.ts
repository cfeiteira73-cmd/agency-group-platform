// =============================================================================
// Agency Group — Property Embeddings Sync
// POST /api/embeddings/sync
//
// Generates OpenAI text-embedding-3-small vectors (1536-dim) for active
// properties that lack embeddings and writes them to the `embedding` column.
//
// USAGE:
//   - Called fire-and-forget from sync-listings cron (passes property_ids)
//   - Can also be called manually (no body = sync all unembedded properties)
//
// AUTH: x-internal-token: INTERNAL_API_TOKEN  OR  Authorization: Bearer CRON_SECRET
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { requireServiceAuth }        from '@/lib/auth/serviceAuth'
import { createClient } from '@supabase/supabase-js'

export const runtime    = 'nodejs'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ---------------------------------------------------------------------------
// Auth: accept both legacy x-internal-token (INTERNAL_API_TOKEN) and Authorization: Bearer CRON_SECRET
// ---------------------------------------------------------------------------

async function isAuthorized(req: NextRequest): Promise<boolean> {
  const check = await requireServiceAuth(req)
  return check.ok
}

// ---------------------------------------------------------------------------
// Property row shape — canonical production properties table schema
// ---------------------------------------------------------------------------

interface PropertyRow {
  id:            string
  nome:          string | null
  tipo:          string | null
  zona:          string | null
  bairro:        string | null
  descricao:     string | null
  features:      unknown       // Json (string[], object, or null in production)
  amenities:     unknown       // Json
  lifestyle_tags: unknown      // Json
  quartos:       number | null
  area:          number | null
  // preco excluded: budget is structural in V1, not semantic (SEM-IMPL Section 5/6)
}

// ---------------------------------------------------------------------------
// Build canonical semantic text for embedding (SEM-IMPL D.1 repair)
// Delegates to shared document builder for deterministic canonical output.
// ---------------------------------------------------------------------------

import { buildPropertySemanticDocument } from '@/lib/matching/sem-document-builder'

function buildPropertyText(p: PropertyRow): string {
  return buildPropertySemanticDocument({
    nome:          p.nome,
    tipo:          p.tipo,
    zona:          p.zona,
    bairro:        p.bairro,
    descricao:     p.descricao,
    features:      p.features,
    amenities:     p.amenities,
    lifestyle_tags: p.lifestyle_tags,
    quartos:       p.quartos,
    area:          p.area,
  })
}

// ---------------------------------------------------------------------------
// Generate embedding via OpenAI text-embedding-3-small (1536 dims)
// ---------------------------------------------------------------------------

async function generateEmbedding(text: string): Promise<{ embedding: number[] | null; error?: string }> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return { embedding: null, error: 'OPENAI_API_KEY not set' }

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
    })

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({})) as { error?: { message?: string } }
      const msg = errBody?.error?.message ?? `HTTP ${res.status}`
      return { embedding: null, error: msg }
    }

    const data = await res.json() as { data: Array<{ embedding: number[] }> }
    if (!data?.data?.length) return { embedding: null, error: 'empty embedding response from OpenAI' }
    return { embedding: data.data[0].embedding }
  } catch (e) {
    return { embedding: null, error: e instanceof Error ? e.message : 'unknown error' }
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!await isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Optional: filter to specific property_ids (from sync-listings cron)
  let propertyIds: string[] | null = null
  try {
    const body = await req.json().catch(() => ({})) as { property_ids?: string[] }
    if (Array.isArray(body.property_ids) && body.property_ids.length > 0) {
      propertyIds = body.property_ids
    }
  } catch { /* no body = sync all */ }

  // Build query — select canonical semantic fields (preco excluded: structural, not semantic)
  let query = supabase
    .from('properties')
    .select('id, nome, tipo, zona, bairro, descricao, features, amenities, lifestyle_tags, quartos, area')
    .eq('status', 'active')
    .is('embedding', null)
    .limit(50)

  if (propertyIds && propertyIds.length > 0) {
    query = query.in('id', propertyIds)
  }

  const { data: properties, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!properties || properties.length === 0) {
    return NextResponse.json({ synced: 0, message: 'All properties have embeddings' })
  }

  let synced = 0
  const errors: string[] = []
  let firstOpenAIError: string | undefined

  for (const property of (properties as PropertyRow[])) {
    const text = buildPropertyText(property)
    if (!text.trim()) {
      errors.push(`${property.id}: skipped — empty text`)
      continue
    }

    const { embedding, error: embError } = await generateEmbedding(text)

    if (!embedding) {
      const msg = embError ?? 'embedding failed'
      if (!firstOpenAIError) firstOpenAIError = msg
      errors.push(`${property.id}: ${msg}`)
      continue
    }

    const { error: updateError } = await supabase
      .from('properties')
      .update({ embedding: JSON.stringify(embedding) })
      .eq('id', property.id)

    if (updateError) {
      errors.push(`${property.id}: ${updateError.message}`)
    } else {
      synced++
    }

    // Respect OpenAI rate limits: 5ms between calls
    await new Promise(r => setTimeout(r, 5))
  }

  return NextResponse.json({
    synced,
    total_processed: properties.length,
    errors:          errors.length > 0 ? errors : undefined,
    openai_error:    firstOpenAIError,
  })
}
