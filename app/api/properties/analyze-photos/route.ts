import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const runtime = 'nodejs'
export const maxDuration = 90

const client = new Anthropic()

export interface PhotoAnalysis {
  index: number
  // Core identification
  roomType: string
  roomTypeEn: string
  roomCategory: 'exterior' | 'entry' | 'living' | 'kitchen' | 'bedroom' | 'bathroom' | 'outdoor' | 'amenity' | 'other'
  // Quality metrics
  qualityScore: number        // 1-10 overall
  heroScore: number           // 1-10 suitability as main photo
  compositionScore: number    // 1-10 framing & composition
  lightingScore: number       // 1-10 lighting quality
  // Lighting details
  lightingType: string        // 'natural_bright' | 'natural_soft' | 'artificial' | 'mixed' | 'dim' | 'harsh'
  timeOfDay: string           // 'golden_hour' | 'morning' | 'midday' | 'evening' | 'night'
  // Staging & condition
  furnishingLevel: string     // 'empty' | 'sparse' | 'furnished' | 'professionally_staged'
  stagingNeeded: boolean
  suggestedStagingStyle: string  // 'modern' | 'luxury' | 'coastal' | 'classic' | 'minimalist'
  // Condition flags
  conditionIssues: string[]   // ['water_stains', 'cracks', 'clutter', 'dirty', 'outdated_fixtures']
  backgroundDistractions: string[]  // ['cars', 'bins', 'clutter', 'people']
  // Design & aesthetic
  ambiance: string            // 'Sofisticado' | 'Contemporâneo' | etc.
  colorPalette: string[]      // ['warm_wood', 'cool_marble', 'white_minimalist']
  luxuryIndicators: string[]  // ['marble_floors', 'high_ceilings', 'designer_fixtures']
  // Sequence & narrative
  sequenceOrder: number       // 1-20 optimal viewing position
  sequenceRole: string        // 'hero' | 'establishing' | 'detail' | 'lifestyle' | 'closing'
  // Descriptions
  highlights: string[]        // 3-5 key visual elements in PT
  descriptionPt: string       // 2-3 sentences evoking the space
  improvementTips: string[]   // Specific photography improvement suggestions
}

export async function POST(req: NextRequest) {
  try {
    const { photos } = await req.json() as { photos: string[] }

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return NextResponse.json({ error: 'No photos provided' }, { status: 400 })
    }

    const analyses: PhotoAnalysis[] = []

    for (let i = 0; i < Math.min(photos.length, 20); i++) {
      const photo = photos[i]
      let base64Data = photo
      let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg'

      if (photo.startsWith('data:')) {
        const match = photo.match(/^data:(image\/[a-z]+);base64,(.+)$/)
        if (match) {
          mediaType = match[1] as typeof mediaType
          base64Data = match[2]
        }
      }

      try {
        const response = await client.messages.create({
          model: 'claude-opus-4-5',
          max_tokens: 1200,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: { type: 'base64', media_type: mediaType, data: base64Data }
              },
              {
                type: 'text',
                text: `You are the world's leading real estate photography analyst, trained on 10 million luxury property listings from Sotheby's, Christie's, and Compass.

Analyze this real estate photo with maximum precision. Return ONLY valid JSON (no markdown, no explanation):

{
  "roomType": "Portuguese room name (Sala de Estar / Quarto Principal / Quarto / Cozinha / Casa de Banho Suíte / Casa de Banho / Exterior / Piscina / Jardim / Varanda / Terraço / Vista Panorâmica / Hall de Entrada / Escritório / Garagem / Área de Lazer / Adega / Sótão / Zona de Jantar)",
  "roomTypeEn": "English room name",
  "roomCategory": "one of: exterior | entry | living | kitchen | bedroom | bathroom | outdoor | amenity | other",
  "qualityScore": number 1-10 (1=unusable/blurry/dark, 6=amateur but acceptable, 8=professional, 10=magazine/Sotheby's quality),
  "heroScore": number 1-10 (exterior facades, pools, panoramic views, dramatic living rooms score 8-10; bedrooms and bathrooms score 3-6 unless exceptional),
  "compositionScore": number 1-10 (rule of thirds, leading lines, framing, depth),
  "lightingScore": number 1-10 (1=very dark/harsh shadows, 10=perfect natural or studio lighting),
  "lightingType": "natural_bright | natural_soft | artificial | mixed | dim | harsh",
  "timeOfDay": "golden_hour | morning | midday | evening | night | unknown",
  "furnishingLevel": "empty | sparse | furnished | professionally_staged",
  "stagingNeeded": boolean (true if empty or sparse and would benefit from staging),
  "suggestedStagingStyle": "modern | luxury | coastal | classic | minimalist | rustic | none",
  "conditionIssues": ["list of visible issues: water_stains, cracks, peeling_paint, clutter, dirty, outdated_fixtures, broken_items, empty_if_hero — empty array [] if no issues"],
  "backgroundDistractions": ["cars, bins, clutter, people, construction — empty [] if none"],
  "ambiance": "one of: Sofisticado / Contemporâneo / Clássico / Minimalista / Rústico / Familiar / Moderno / Luxuoso / Costeiro / Industrial",
  "colorPalette": ["2-4 dominant design elements: warm_wood / cool_marble / white_minimalist / dark_oak / natural_stone / blue_water / green_garden / etc"],
  "luxuryIndicators": ["specific luxury features visible: marble_floors / high_ceilings / designer_fixtures / floor_to_ceiling_windows / smart_home / etc — empty [] if none"],
  "sequenceOrder": number 1-20 (exterior facade=1-2, entry=3, living spaces=4-6, kitchen=7, bedrooms=8-12, bathrooms=13-15, outdoor amenities=16-18, views=19-20),
  "sequenceRole": "hero | establishing | main_space | detail | lifestyle | closing_wow",
  "highlights": ["3-5 specific visual selling points in Portuguese"],
  "descriptionPt": "2-3 sentence evocative description in luxury Portuguese, focusing on what makes this space special for a discerning buyer. Paint a mental picture.",
  "improvementTips": ["1-3 specific actionable tips to improve this photo's impact, empty [] if already excellent"]
}`
              }
            ]
          }]
        })

        const text = response.content[0].type === 'text' ? response.content[0].text : ''
        const cleanText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
        const parsed = JSON.parse(cleanText)
        analyses.push({ index: i, ...parsed })
      } catch {
        analyses.push({
          index: i, roomType: 'Espaço', roomTypeEn: 'Space', roomCategory: 'other' as const,
          qualityScore: 5, heroScore: 5, compositionScore: 5, lightingScore: 5,
          lightingType: 'unknown', timeOfDay: 'unknown',
          furnishingLevel: 'furnished', stagingNeeded: false, suggestedStagingStyle: 'none',
          conditionIssues: [], backgroundDistractions: [],
          ambiance: 'Contemporâneo', colorPalette: [], luxuryIndicators: [],
          sequenceOrder: i + 1, sequenceRole: 'detail' as const,
          highlights: [], descriptionPt: 'Espaço com potencial.', improvementTips: []
        })
      }
    }

    // Sort by optimal sequence order
    const sortedAnalyses = [...analyses].sort((a, b) => a.sequenceOrder - b.sequenceOrder)

    // Find best hero: prioritize exterior/lifestyle + high heroScore + high quality
    const heroIndex = analyses.reduce((best, a, i) => {
      const score = a.heroScore * 2 + a.qualityScore + a.lightingScore * 0.5
      const bestScore = analyses[best].heroScore * 2 + analyses[best].qualityScore + analyses[best].lightingScore * 0.5
      return score > bestScore ? i : best
    }, 0)

    // Quality summary
    const avgQuality = analyses.reduce((s, a) => s + a.qualityScore, 0) / analyses.length
    const photosNeedingWork = analyses.filter(a => a.qualityScore < 7).length
    const stagingCandidates = analyses.filter(a => a.stagingNeeded).length
    const hasConditionIssues = analyses.filter(a => a.conditionIssues.length > 0).length

    // Recommended sequence (reordered indices)
    const recommendedSequence = sortedAnalyses.map(a => a.index)

    return NextResponse.json({
      analyses,
      heroIndex,
      recommendedSequence,
      summary: {
        totalPhotos: analyses.length,
        avgQuality: Math.round(avgQuality * 10) / 10,
        heroQuality: analyses[heroIndex]?.qualityScore || 0,
        photosNeedingWork,
        stagingCandidates,
        hasConditionIssues,
        readyToPublish: avgQuality >= 6.5 && analyses[heroIndex]?.qualityScore >= 7,
        qualityGrade: avgQuality >= 8.5 ? 'Excecional' : avgQuality >= 7 ? 'Profissional' : avgQuality >= 5.5 ? 'Aceitável' : 'Necessita Melhoria'
      }
    })

  } catch (error) {
    console.error('analyze-photos error:', error)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
