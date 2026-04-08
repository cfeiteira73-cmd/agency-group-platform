import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 30

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Generate embedding via OpenAI text-embedding-3-small
async function generateQueryEmbedding(query: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: query.trim().slice(0, 500),
      }),
    })
    if (!res.ok) return null
    const data = await res.json() as { data: Array<{ embedding: number[] }> }
    return data.data[0]?.embedding ?? null
  } catch {
    return null
  }
}

// Keyword fallback — searches nome, zona, descricao
async function keywordSearch(query: string, limit: number, filters?: Record<string, unknown>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = supabase
    .from('properties')
    .select('id, nome, zona, bairro, tipo, preco, area, quartos, casas_banho, energia, status, descricao, features, gradient')
    .or(`nome.ilike.%${query}%,zona.ilike.%${query}%,descricao.ilike.%${query}%`)

  if (filters?.status) {
    q = q.eq('status', filters.status)
  } else {
    q = q.eq('status', 'active')
  }
  if (filters?.zona) q = q.eq('zona', filters.zona)
  if (filters?.tipo) q = q.eq('tipo', filters.tipo)
  if (filters?.maxPreco) q = q.lte('preco', filters.maxPreco)

  q = q.limit(limit)

  const { data, error } = await q
  if (error) return []
  return data ?? []
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      query?: unknown
      limit?: unknown
      filters?: Record<string, unknown>
      lang?: string
    }

    const { query, limit = 10, filters, lang } = body

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 })
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 50)

    // 1. Try semantic search with pgvector
    const queryEmbedding = await generateQueryEmbedding(query)

    if (queryEmbedding) {
      // Attempt pgvector RPC — Supabase function: search_properties_semantic
      const { data: semanticResults, error: rpcError } = await supabase.rpc(
        'search_properties_semantic',
        {
          query_embedding: queryEmbedding,
          match_count: safeLimit,
          similarity_threshold: 0.45,
        }
      )

      if (!rpcError && semanticResults && Array.isArray(semanticResults) && semanticResults.length > 0) {
        return NextResponse.json({
          properties: semanticResults,
          method: 'semantic',
          query,
          lang: lang ?? 'pt',
        })
      }

      // pgvector RPC not available or no results — log and fall through
      if (rpcError) {
        console.warn('[search-natural] pgvector RPC unavailable, falling back to keyword:', rpcError.message)
      }
    }

    // 2. Keyword fallback
    const keywordResults = await keywordSearch(query, safeLimit, filters)

    if (keywordResults.length > 0) {
      return NextResponse.json({
        properties: keywordResults,
        method: queryEmbedding ? 'keyword_fallback' : 'keyword',
        query,
        lang: lang ?? 'pt',
      })
    }

    // 3. Broader fallback — active properties by type/zone extracted from query
    const zoneKeywords: Record<string, string> = {
      lisboa: 'Lisboa', cascais: 'Cascais', porto: 'Porto',
      algarve: 'Algarve', madeira: 'Madeira', sintra: 'Sintra',
      comporta: 'Comporta', ericeira: 'Ericeira', açores: 'Açores',
    }
    const queryLower = query.toLowerCase()
    const matchedZone = Object.entries(zoneKeywords).find(([k]) => queryLower.includes(k))?.[1]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let broadQuery: any = supabase
      .from('properties')
      .select('id, nome, zona, bairro, tipo, preco, area, quartos, casas_banho, energia, status, descricao, features, gradient')
      .eq('status', 'active')

    if (matchedZone) broadQuery = broadQuery.eq('zona', matchedZone)
    broadQuery = broadQuery.limit(safeLimit)

    const { data: broadResults } = await broadQuery

    return NextResponse.json({
      properties: broadResults ?? [],
      method: 'broad_fallback',
      query,
      lang: lang ?? 'pt',
    })
  } catch (err) {
    console.error('[search-natural] Error:', err)
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }
}
