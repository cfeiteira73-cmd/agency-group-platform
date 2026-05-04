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
import { safeCompare }               from '@/lib/safeCompare'
import { createClient } from '@supabase/supabase-js'

export const runtime    = 'nodejs'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ---------------------------------------------------------------------------
// Auth: accept both legacy x-internal-token and new Authorization: Bearer CRON_SECRET
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  // Legacy internal token path
  const internalToken = req.headers.get('x-internal-token')
  if (safeCompare(internalToken ?? '', process.env.INTERNAL_API_TOKEN ?? '')) return true

  // Cron secret path (used by sync-listings cron)
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (safeCompare(bearer ?? '', process.env.CRON_SECRET ?? '')) return true

  return false
}

// ---------------------------------------------------------------------------
// Property row shape — matches current properties table schema
// ---------------------------------------------------------------------------

interface PropertyRow {
  id:          string
  title:       string | null
  type:        string | null
  zone:        string | null
  description: string | null
  bedrooms:    number | null
  area_m2:     number | null
  price:       number | null
}

// ---------------------------------------------------------------------------
// Build rich text for embedding from property data
// ---------------------------------------------------------------------------

function buildPropertyText(p: PropertyRow): string {
  return [
    p.title,
    p.type,
    p.zone,
    p.description,
    p.bedrooms != null ? `${p.bedrooms} quartos` : null,
    p.area_m2  != null ? `${p.area_m2}m²`        : null,
    p.price    != null ? `€${p.price.toLocaleString('pt-PT')}` : null,
  ].filter(Boolean).join('. ')
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
    return { embedding: data.data[0].embedding }
  } catch (e) {
    return { embedding: null, error: e instanceof Error ? e.message : 'unknown error' }
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
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

  // Build query
  let query = supabase
    .from('properties')
    .select('id, title, type, zone, description, bedrooms, area_m2, price')
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
