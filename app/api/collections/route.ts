import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { randomBytes } from 'crypto'

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

// In-memory store (replace with Supabase in production)
const collectionsStore = new Map<string, Collection>()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  const agentId = searchParams.get('agentId') || 'carlos'

  if (token) {
    const col = [...collectionsStore.values()].find(c => c.shareToken === token)
    if (!col) return NextResponse.json({ error: 'Colecção não encontrada' }, { status: 404 })
    return NextResponse.json({ success: true, collection: col })
  }

  const cols = [...collectionsStore.values()].filter(c => c.agentId === agentId)
  return NextResponse.json({ success: true, collections: cols })
}

export async function POST(req: NextRequest) {
  try {
    const { action, collectionId, data } = await req.json()

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
        collectionsStore.set(id, collection)
        return NextResponse.json({ success: true, collection })
      }

      case 'add_property': {
        const col = collectionsStore.get(collectionId)
        if (!col) return NextResponse.json({ error: 'Colecção não encontrada' }, { status: 404 })
        // Avoid duplicates
        const exists = col.items.find(i => i.property.id === data.property?.id)
        if (exists) return NextResponse.json({ success: true, collection: col, duplicate: true })
        col.items.push({
          property: data.property,
          addedAt: new Date().toISOString(),
          agentNote: data.agentNote,
          interestScore: data.interestScore,
        })
        col.updatedAt = new Date().toISOString()
        collectionsStore.set(collectionId, col)
        return NextResponse.json({ success: true, collection: col })
      }

      case 'update_item': {
        const col = collectionsStore.get(collectionId)
        if (!col) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        const item = col.items.find(i => i.property.id === data.propertyId)
        if (item) {
          if (data.agentNote !== undefined) item.agentNote = data.agentNote
          if (data.clientNote !== undefined) item.clientNote = data.clientNote
          if (data.interestScore !== undefined) item.interestScore = data.interestScore
        }
        col.updatedAt = new Date().toISOString()
        collectionsStore.set(collectionId, col)
        return NextResponse.json({ success: true, collection: col })
      }

      case 'remove_property': {
        const col = collectionsStore.get(collectionId)
        if (!col) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        col.items = col.items.filter(i => i.property.id !== data.propertyId)
        col.updatedAt = new Date().toISOString()
        collectionsStore.set(collectionId, col)
        return NextResponse.json({ success: true, collection: col })
      }

      case 'add_comment': {
        const col = collectionsStore.get(collectionId)
        if (!col) return NextResponse.json({ error: 'Not found' }, { status: 404 })
        col.comments.push({
          author: data.author || 'Agente',
          text: data.text,
          timestamp: new Date().toISOString(),
          language: data.language || 'pt',
        })
        col.updatedAt = new Date().toISOString()
        collectionsStore.set(collectionId, col)
        return NextResponse.json({ success: true, collection: col })
      }

      case 'ai_recommend': {
        const col = collectionsStore.get(collectionId)
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

        // Save AI profile to collection
        col.aiProfile = result.clientProfile
        collectionsStore.set(collectionId, col)

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
        collectionsStore.delete(collectionId)
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
