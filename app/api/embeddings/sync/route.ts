import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface PropertyRow {
  id: string
  nome: string | null
  tipo: string | null
  zona: string | null
  descricao: string | null
  quartos: number | null
  area: number | null
  preco: number | null
}

// Generate embedding via OpenAI text-embedding-3-small (1536 dims, cheap)
async function generateEmbedding(text: string): Promise<number[] | null> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
    })
    if (!res.ok) return null
    const data = await res.json() as { data: Array<{ embedding: number[] }> }
    return data.data[0].embedding
  } catch {
    return null
  }
}

// Build rich text for embedding from property data
function buildPropertyText(p: PropertyRow): string {
  return [
    p.nome, p.tipo, p.zona, p.descricao,
    p.quartos != null ? `${p.quartos} quartos` : null,
    p.area != null ? `${p.area}m²` : null,
    p.preco != null ? `€${p.preco.toLocaleString('pt-PT')}` : null,
  ].filter(Boolean).join('. ')
}

export async function POST(req: NextRequest) {
  // Require internal auth token
  const token = req.headers.get('x-internal-token')
  if (token !== process.env.INTERNAL_API_TOKEN) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get properties without embeddings (up to 50 at a time)
  const { data: properties, error } = await supabase
    .from('properties')
    .select('id, nome, tipo, zona, descricao, quartos, area, preco')
    .eq('status', 'active')
    .is('embedding', null)
    .limit(50)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!properties || properties.length === 0) {
    return NextResponse.json({ synced: 0, message: 'All properties have embeddings' })
  }

  let synced = 0
  const errors: string[] = []

  for (const property of (properties as PropertyRow[])) {
    const text = buildPropertyText(property)
    const embedding = await generateEmbedding(text)

    if (!embedding) {
      errors.push(`${property.id}: embedding failed`)
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

    // Rate limit: 5ms between calls
    await new Promise(r => setTimeout(r, 5))
  }

  return NextResponse.json({ synced, errors: errors.length > 0 ? errors : undefined })
}
