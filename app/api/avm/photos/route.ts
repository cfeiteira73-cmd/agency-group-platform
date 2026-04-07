import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ─── SSRF Protection ──────────────────────────────────────────────────────────
const ALLOWED_HOSTS = [
  'idealista.com',
  'imovirtual.com',
  'century21.pt',
  'remax.pt',
  'era.pt',
  'jll.pt',
  'cushmanwakefield.com',
]

function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && ALLOWED_HOSTS.some(h => parsed.hostname.endsWith(h))
  } catch { return false }
}

interface PhotoScore {
  url: string
  quality: number       // 0-100
  brightness: number    // 0-100
  composition: number   // 0-100
  staging: number       // 0-100: is it staged/furnished?
  issues: string[]      // detected issues: 'dark', 'blurry', 'clutter', 'bad_angle'
  strengths: string[]   // 'natural_light', 'wide_angle', 'luxury_finish', 'garden_view'
}

interface PhotoAnalysisResult {
  overall_score: number     // weighted average 0-100
  photo_count: number
  scores: PhotoScore[]
  value_impact_pct: number  // estimated impact on listing price: -5% to +8%
  recommendations: string[]
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { photos: string[]; property_id?: string }
  const { photos } = body

  if (!photos || !Array.isArray(photos) || photos.length === 0) {
    return NextResponse.json({ error: 'photos array required' }, { status: 400 })
  }

  // Limit to 8 photos max (API cost control)
  const photosToAnalyze = photos.slice(0, 8)

  // SSRF protection — reject URLs not from allowed hosts
  const unsafeUrls = photosToAnalyze.filter(url => !isSafeUrl(url))
  if (unsafeUrls.length > 0) {
    return NextResponse.json(
      { error: 'URL not allowed. Only photos from trusted real estate portals are accepted.' },
      { status: 400 }
    )
  }

  try {
    // Build vision message with all photos
    const imageContents: Anthropic.ImageBlockParam[] = photosToAnalyze
      .filter(url => url.startsWith('http'))
      .map(url => ({
        type: 'image' as const,
        source: { type: 'url' as const, url },
      }))

    if (imageContents.length === 0) {
      return NextResponse.json({ error: 'No valid photo URLs' }, { status: 400 })
    }

    const response = await anthropic.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1500,
      messages: [{
        role: 'user',
        content: [
          ...imageContents,
          {
            type: 'text',
            text: `You are a luxury real estate photography expert. Analyze these ${imageContents.length} property photos for the Portuguese luxury market (Agency Group, AMI 22506).

Return ONLY valid JSON (no markdown):
{
  "photos": [
    {
      "index": 0,
      "quality": 85,
      "brightness": 78,
      "composition": 90,
      "staging": 95,
      "issues": ["slightly_dark"],
      "strengths": ["wide_angle", "luxury_finish", "natural_light"]
    }
  ],
  "overall_score": 87,
  "value_impact_pct": 4.5,
  "grade": "A",
  "recommendations": [
    "Increase brightness in photo 1",
    "Consider decluttering kitchen counter in photo 3"
  ]
}

Scoring guide:
- quality: Overall photo quality (lighting, sharpness, colors)
- brightness: 0=very dark, 100=perfectly bright
- composition: framing, angles, showing space effectively
- staging: 0=empty/cluttered, 100=professionally staged
- value_impact_pct: -5 to +8, how much these photos affect perceived value vs average photos
- grade: A(90+), B(75-89), C(60-74), D(45-59), F(<45)
- issues: from [dark, blurry, clutter, bad_angle, reflection, distortion, small_room]
- strengths: from [natural_light, wide_angle, luxury_finish, garden_view, pool, sea_view, staged, high_ceiling]`,
          },
        ],
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'

    // Parse JSON response
    let parsed: {
      photos: Array<{
        index: number; quality: number; brightness: number;
        composition: number; staging: number; issues: string[]; strengths: string[]
      }>;
      overall_score: number;
      value_impact_pct: number;
      grade: string;
      recommendations: string[];
    }

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      parsed = JSON.parse(jsonMatch?.[0] || '{}')
    } catch {
      return NextResponse.json({ error: 'Vision analysis parsing failed' }, { status: 500 })
    }

    const result: PhotoAnalysisResult = {
      overall_score: parsed.overall_score || 50,
      photo_count: imageContents.length,
      scores: (parsed.photos || []).map((p, i) => ({
        url: photosToAnalyze[p.index ?? i] || '',
        quality: p.quality || 50,
        brightness: p.brightness || 50,
        composition: p.composition || 50,
        staging: p.staging || 50,
        issues: p.issues || [],
        strengths: p.strengths || [],
      })),
      value_impact_pct: parsed.value_impact_pct || 0,
      recommendations: parsed.recommendations || [],
      grade: (parsed.grade || 'C') as PhotoAnalysisResult['grade'],
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('[avm/photos] Error:', error)
    return NextResponse.json({ error: 'Photo analysis failed' }, { status: 500 })
  }
}
