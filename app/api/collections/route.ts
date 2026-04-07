import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import Anthropic from '@anthropic-ai/sdk'
import { randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const maxDuration = 30

const client = new Anthropic()

interface Property {
  id: string; nome: string; zona: string; preco: number; area: number
  quartos: number; tipo: string; gradient?: string; badge?: string
}

interface CollectionItem {
  property: Property
  addedAt: string
  agentNote?: string
  clientNote?: string
  interestScore?: number
}

interface Comment {
  author: string; text: string; timestamp: string; language?: string; translated?: string
}

interface Collection {
  id: string
  name: string
  agentId: string
  clientEmail?: string
  clientName?: string
  shareToken: string
  items: CollectionItem[]
  comments: Comment[]
  aiProfile?: string
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// In-memory fallback store (used when Supabase is not configured)
// NOTE: This is ephemeral — data is lost on Vercel restarts.
// Run 20260407_004_collections.sql migration to enable persistent Supabase storage.
// ---------------------------------------------------------------------------
const collectionsStore = new Map<string, Collection>()

// ---------------------------------------------------------------------------
// Supabase helpers — graceful degradation if supabaseAdmin unavailable
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToCollection(row: any): Collection {
  return {
    id: row.id,
    name: row.name ?? 'Nova Colecção',
    agentId: row.agent_id ?? '',
    clientEmail: row.client_email ?? undefined,
    clientName: row.client_name ?? undefined,
    shareToken: row.share_token ?? row.id,
    items: Array.isArray(row.items) ? row.items : [],
    comments: Array.isArray(row.comments) ? row.comments : [],
    aiProfile: row.ai_profile ?? undefined,
    createdAt: row.created_at ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? new Date().toISOString(),
  }
}

async function dbGetByToken(token: string): Promise<Collection | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('property_collections')
      .select('*')
      .eq('share_token', token)
      .single()
    if (error || !data) return null
    // Increment view count (non-blocking)
    supabaseAdmin
      .from('property_collections')
      .update({ views: (data.views ?? 0) + 1, last_viewed_at: new Date().toISOString() })
      .eq('id', data.id)
      .then(({ error: e }) => { if (e) console.warn('[Collections] View count update failed:', e.message) })
    return rowToCollection(data)
  } catch {
    return null
  }
}

async function dbGetByAgent(agentId: string): Promise<Collection[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('property_collections')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
    if (error || !data) return []
    return (data as unknown[]).map(rowToCollection)
  } catch {
    return []
  }
}

async function dbUpsert(col: Collection): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('property_collections')
      .upsert({
        id: col.id,
        name: col.name,
        agent_id: col.agentId,
        client_email: col.clientEmail ?? null,
        client_name: col.clientName ?? null,
        share_token: col.shareToken,
        items: col.items,
        comments: col.comments,
        ai_profile: col.aiProfile ?? null,
      })
    return !error
  } catch {
    return false
  }
}

async function dbDelete(id: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('property_collections')
      .delete()
      .eq('id', id)
    return !error
  } catch {
    return false
  }
}

async function dbGetById(id: string): Promise<Collection | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('property_collections')
      .select('*')
      .eq('id', id)
      .single()
    if (error || !data) return null
    return rowToCollection(data)
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Determine if Supabase is configured (service role key present)
// ---------------------------------------------------------------------------
function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL)
}

// ---------------------------------------------------------------------------
// GET /api/collections — public share-token access + agent listing
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  // Public share-token access for clients — no auth required
  if (token) {
    if (isSupabaseConfigured()) {
      const col = await dbGetByToken(token)
      if (!col) return NextResponse.json({ error: 'Colecção não encontrada' }, { status: 404 })
      return NextResponse.json({ success: true, collection: col })
    }
    // Fallback: in-memory
    const col = [...collectionsStore.values()].find(c => c.shareToken === token)
    if (!col) return NextResponse.json({ error: 'Colecção não encontrada' }, { status: 404 })
    return NextResponse.json({ success: true, collection: col })
  }

  // Agent listing requires authentication
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const agentId = searchParams.get('agentId') || 'carlos'

  if (isSupabaseConfigured()) {
    const cols = await dbGetByAgent(agentId)
    return NextResponse.json({ success: true, collections: cols })
  }

  // Fallback: in-memory
  const cols = [...collectionsStore.values()].filter(c => c.agentId === agentId)
  return NextResponse.json({ success: true, collections: cols })
}

// ---------------------------------------------------------------------------
// POST /api/collections — all mutating actions
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { action, collectionId, data } = await req.json()
    const useSupabase = isSupabaseConfigured()

    switch (action) {
      case 'create': {
        const id = `col_${Date.now()}_${randomBytes(4).toString('hex')}`
        const collection: Collection = {
          id,
          name: data.name || 'Nova Colecção',
          agentId: data.agentId || 'carlos',
          clientEmail: data.clientEmail,
          clientName: data.clientName,
          shareToken: randomBytes(32).toString('hex'),
          items: [],
          comments: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        if (useSupabase) {
          await dbUpsert(collection)
        } else {
          collectionsStore.set(id, collection)
        }
        return NextResponse.json({ success: true, collection })
      }

      case 'add_property': {
        let col = useSupabase ? await dbGetById(collectionId) : collectionsStore.get(collectionId) ?? null
        if (!col) return NextResponse.json({ error: 'Colecção não encontrada' }, { status: 404 })
        // Avoid duplicates
        const exists = col.items.find(i => i.property.id === data.property?.id)
        if (exists) return NextResponse.json({ success: true, collection: col, duplicate: true })
        col = {
          ...col,
          items: [...col.items, {
            property: data.property,
            addedAt: new Date().toISOString(),
            agentNote: data.agentNote,
            interestScore: data.interestScore,
          }],
          updatedAt: new Date().toISOString(),
        }
        if (useSupabase) { await dbUpsert(col) } else { collectionsStore.set(collectionId, col) }
        return NextResponse.json({ success: true, collection: col })
      }

      case 'update_item': {
        let col = useSupabase ? await dbGetById(collectionId) : collectionsStore.get(collectionId) ?? null
        if (!col) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        col = {
          ...col,
          items: col.items.map(i => {
            if (i.property.id !== data.propertyId) return i
            return {
              ...i,
              ...(data.agentNote !== undefined && { agentNote: data.agentNote }),
              ...(data.clientNote !== undefined && { clientNote: data.clientNote }),
              ...(data.interestScore !== undefined && { interestScore: data.interestScore }),
            }
          }),
          updatedAt: new Date().toISOString(),
        }
        if (useSupabase) { await dbUpsert(col) } else { collectionsStore.set(collectionId, col) }
        return NextResponse.json({ success: true, collection: col })
      }

      case 'remove_property': {
        let col = useSupabase ? await dbGetById(collectionId) : collectionsStore.get(collectionId) ?? null
        if (!col) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        col = {
          ...col,
          items: col.items.filter(i => i.property.id !== data.propertyId),
          updatedAt: new Date().toISOString(),
        }
        if (useSupabase) { await dbUpsert(col) } else { collectionsStore.set(collectionId, col) }
        return NextResponse.json({ success: true, collection: col })
      }

      case 'add_comment': {
        let col = useSupabase ? await dbGetById(collectionId) : collectionsStore.get(collectionId) ?? null
        if (!col) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        col = {
          ...col,
          comments: [...col.comments, {
            author: data.author || 'Agente',
            text: data.text,
            timestamp: new Date().toISOString(),
            language: data.language || 'pt',
          }],
          updatedAt: new Date().toISOString(),
        }
        if (useSupabase) { await dbUpsert(col) } else { collectionsStore.set(collectionId, col) }
        return NextResponse.json({ success: true, collection: col })
      }

      case 'ai_recommend': {
        let col = useSupabase ? await dbGetById(collectionId) : collectionsStore.get(collectionId) ?? null
        if (!col || !col.items.length) return NextResponse.json({ success: true, recommendations: [], clientProfile: '', nextStep: '' })

        const prompt = `És Carlos Feiteira, consultor sénior da Agency Group (AMI 22506).

Analisa esta colecção colaborativa e recomenda os 3 próximos imóveis mais adequados ao perfil emergente do cliente.

COLECÇÃO: "${col.name}" ${col.clientName ? `(cliente: ${col.clientName})` : ''}

IMÓVEIS GUARDADOS (${col.items.length}):
${col.items.map(i => `- ${i.property.nome} (${i.property.zona}) · €${(i.property.preco/1e6).toFixed(2)}M · T${i.property.quartos} · ${i.property.area}m²${i.interestScore ? ` · Interesse ${i.interestScore}/5` : ''}${i.agentNote ? ` · "${i.agentNote}"` : ''}${i.clientNote ? ` · Nota cliente: "${i.clientNote}"` : ''}`).join('\n')}

PORTFÓLIO DISPONÍVEL:
${(data.portfolio || []).map((p: Property) => `- ${p.id}: ${p.nome} (${p.zona}) · €${(p.preco/1e6).toFixed(2)}M · T${p.quartos} · ${p.area}m²`).join('\n')}

Responde em JSON:
{
  "recommendations": [
    { "propertyId": "id", "reason": "porquê em 1 frase precisa", "matchScore": 85, "urgency": "alta|média|baixa" }
  ],
  "clientProfile": "resumo do perfil inferido em 1-2 frases",
  "budgetSignal": "interpretação do padrão de preços da colecção",
  "nextStep": "próxima acção recomendada para fechar negócio",
  "engagementTip": "como envolver este cliente especificamente"
}`

        const response = await client.messages.create({
          model: 'claude-opus-4-5',
          max_tokens: 600,
          messages: [{ role: 'user', content: prompt }],
        })

        const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
        const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const result = JSON.parse(clean)

        // Save AI profile back to collection
        col = { ...col, aiProfile: result.clientProfile, updatedAt: new Date().toISOString() }
        if (useSupabase) { await dbUpsert(col) } else { collectionsStore.set(collectionId, col) }

        return NextResponse.json({ success: true, ...result })
      }

      case 'translate_comment': {
        const { text, targetLang } = data
        const langNames: Record<string, string> = { pt: 'português europeu', en: 'English', fr: 'français', de: 'Deutsch', es: 'español', it: 'italiano', ar: 'العربية', zh: '中文' }
        const prompt = `Traduz este comentário sobre um imóvel para ${langNames[targetLang] || targetLang} de forma natural e profissional. Responde APENAS com a tradução, sem aspas nem explicação:\n\n${text}`
        const response = await client.messages.create({
          model: 'claude-opus-4-5',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        })
        const translated = response.content[0].type === 'text' ? response.content[0].text.trim() : text
        return NextResponse.json({ success: true, translated })
      }

      case 'delete': {
        if (useSupabase) {
          await dbDelete(collectionId)
        } else {
          collectionsStore.delete(collectionId)
        }
        return NextResponse.json({ success: true })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error) {
    console.error('[Collections] Error:', error)
    return NextResponse.json({ error: 'Erro na colecção' }, { status: 500 })
  }
}
