import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 60

const client = new Anthropic()

interface PhotoAnalysis {
  index: number
  roomType: string
  roomTypeEn: string
  qualityScore: number // 1-10
  heroScore: number // 1-10 (how suitable as hero/main photo)
  ambiance: string
  highlights: string[]
  descriptionPt: string
  issues: string[]
}

export async function POST(req: NextRequest) {
  try {
    const { photos } = await req.json() as { photos: string[] }

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json({ error: 'No photos provided' }, { status: 400 })
    }

    const analyses: PhotoAnalysis[] = []

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i]

      // Extract base64 data (remove data URL prefix if present)
      let base64Data = photo
      let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg'

      if (photo.startsWith('data:')) {
        const match = photo.match(/^data:(image\/[a-z]+);base64,(.+)$/)
        if (match) {
          mediaType = match[1] as typeof mediaType
          base64Data = match[2]
        }
      }

      const response = await client.messages.create({
        model: 'claude-opus-4-5',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data,
              }
            },
            {
              type: 'text',
              text: `Analyze this real estate property photo and respond ONLY with a valid JSON object (no markdown, no explanation):

{
  "roomType": "string in Portuguese (e.g. Sala de Estar, Quarto Principal, Quarto, Cozinha, Casa de Banho, Casa de Banho Suite, Exterior, Piscina, Jardim, Varanda, Terraço, Vista, Hall de Entrada, Escritório, Garagem, Área de Lazer, Sótão, Adega)",
  "roomTypeEn": "string in English",
  "qualityScore": number 1-10 (1=very poor/dark/blurry, 10=professional magazine quality),
  "heroScore": number 1-10 (1=not suitable as main photo, 10=perfect hero/cover photo - exterior, pool, best living room, panoramic view score higher),
  "ambiance": "one of: Sofisticado, Contemporâneo, Clássico, Minimalista, Rústico, Familiar, Moderno, Luxuoso",
  "highlights": ["array", "of", "3-5", "key", "visual", "features", "in", "Portuguese"],
  "descriptionPt": "2-3 sentence evocative description in Portuguese focusing on what makes this space special for a luxury buyer",
  "issues": ["array of any photographic or presentation issues, empty array if none - in Portuguese"]
}`
            }
          ]
        }]
      })

      try {
        const text = response.content[0].type === 'text' ? response.content[0].text : ''
        const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const parsed = JSON.parse(cleanText)
        analyses.push({ index: i, ...parsed })
      } catch {
        analyses.push({
          index: i,
          roomType: 'Espaço',
          roomTypeEn: 'Space',
          qualityScore: 5,
          heroScore: 5,
          ambiance: 'Contemporâneo',
          highlights: [],
          descriptionPt: 'Espaço com potencial.',
          issues: ['Análise não disponível']
        })
      }
    }

    // Find best hero photo
    const heroIndex = analyses.reduce((best, a, i) =>
      a.heroScore > (analyses[best]?.heroScore ?? 0) ? i : best, 0)

    return NextResponse.json({ analyses, heroIndex })
  } catch (error) {
    console.error('analyze-photos error:', error)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
