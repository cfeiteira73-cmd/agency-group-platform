// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import type { ArchitectureStyle, StagingQuality } from '@/lib/property-ai/types'

interface VisionAnalysisResult {
  rooms_detected: string[]
  bathroom_count: number
  bedroom_count: number
  kitchen_quality: 'basic' | 'modern' | 'luxury' | 'unknown'
  luxury_score: number
  renovation_needed: boolean
  renovation_probability: number
  sunlight_score: number
  has_outdoor: boolean
  has_pool: boolean
  has_garden: boolean
  has_sea_view: boolean
  has_golf_view: boolean
  has_city_view: boolean
  has_mountain_view: boolean
  architecture_style: ArchitectureStyle
  furniture_staging: StagingQuality
  construction_quality: 'basic' | 'standard' | 'premium' | 'luxury'
  confidence: number
}

const VISION_DEFAULTS: VisionAnalysisResult = {
  rooms_detected: [],
  bathroom_count: 0,
  bedroom_count: 0,
  kitchen_quality: 'unknown',
  luxury_score: 50,
  renovation_needed: false,
  renovation_probability: 0.2,
  sunlight_score: 50,
  has_outdoor: false,
  has_pool: false,
  has_garden: false,
  has_sea_view: false,
  has_golf_view: false,
  has_city_view: false,
  has_mountain_view: false,
  architecture_style: 'contemporary',
  furniture_staging: 'basic',
  construction_quality: 'standard',
  confidence: 0.3,
}

async function callClaudeVision(imageUrl: string, prompt: string): Promise<string> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url: imageUrl } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  })
  const data = (await resp.json()) as { content?: Array<{ text?: string }> }
  return data.content?.[0]?.text ?? ''
}

const VISION_PROMPT = `Analyze this real estate property photo and return a JSON object with EXACTLY these fields:
{
  "rooms_detected": ["living room", "kitchen", ...],
  "bathroom_count": 0,
  "bedroom_count": 0,
  "kitchen_quality": "basic|modern|luxury|unknown",
  "luxury_score": 0-100,
  "renovation_needed": true|false,
  "renovation_probability": 0.0-1.0,
  "sunlight_score": 0-100,
  "has_outdoor": true|false,
  "has_pool": true|false,
  "has_garden": true|false,
  "has_sea_view": true|false,
  "has_golf_view": true|false,
  "has_city_view": true|false,
  "has_mountain_view": true|false,
  "architecture_style": "modern|contemporary|traditional|luxury|rustic|art-deco|minimalist|mediterranean",
  "furniture_staging": "unstaged|basic|professional|luxury",
  "construction_quality": "basic|standard|premium|luxury",
  "confidence": 0.0-1.0
}
Return only the JSON object, no additional text.`

function mergeVisionResults(results: VisionAnalysisResult[]): VisionAnalysisResult {
  if (results.length === 0) return { ...VISION_DEFAULTS }

  const allRooms = Array.from(new Set(results.flatMap((r) => r.rooms_detected)))
  const avg = (key: keyof VisionAnalysisResult): number => {
    const vals = results.map((r) => r[key] as number).filter((v) => typeof v === 'number')
    return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  }
  const any = (key: keyof VisionAnalysisResult): boolean =>
    results.some((r) => r[key] === true)
  const majority = <T>(key: keyof VisionAnalysisResult): T => {
    const vals = results.map((r) => r[key] as T)
    const counts = new Map<T, number>()
    for (const v of vals) counts.set(v, (counts.get(v) ?? 0) + 1)
    let best: T = vals[0]
    let bestCount = 0
    for (const [v, c] of counts) {
      if (c > bestCount) { best = v; bestCount = c }
    }
    return best
  }

  return {
    rooms_detected: allRooms,
    bathroom_count: Math.round(avg('bathroom_count')),
    bedroom_count: Math.round(avg('bedroom_count')),
    kitchen_quality: majority<VisionAnalysisResult['kitchen_quality']>('kitchen_quality'),
    luxury_score: avg('luxury_score'),
    renovation_needed: any('renovation_needed'),
    renovation_probability: avg('renovation_probability'),
    sunlight_score: avg('sunlight_score'),
    has_outdoor: any('has_outdoor'),
    has_pool: any('has_pool'),
    has_garden: any('has_garden'),
    has_sea_view: any('has_sea_view'),
    has_golf_view: any('has_golf_view'),
    has_city_view: any('has_city_view'),
    has_mountain_view: any('has_mountain_view'),
    architecture_style: majority<ArchitectureStyle>('architecture_style'),
    furniture_staging: majority<StagingQuality>('furniture_staging'),
    construction_quality: majority<VisionAnalysisResult['construction_quality']>('construction_quality'),
    confidence: avg('confidence'),
  }
}

class VisionAnalyzer {
  async analyze(imageUrls: string[], submissionId: string): Promise<VisionAnalysisResult> {
    if (imageUrls.length === 0) {
      logger.warn('[VisionAnalyzer] no images provided', { submissionId })
      return { ...VISION_DEFAULTS }
    }

    const results: VisionAnalysisResult[] = []

    for (const url of imageUrls) {
      try {
        const raw = await callClaudeVision(url, VISION_PROMPT)
        const jsonMatch = raw.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
          logger.warn('[VisionAnalyzer] no JSON in response', { submissionId, url })
          results.push({ ...VISION_DEFAULTS })
          continue
        }
        const parsed = JSON.parse(jsonMatch[0]) as Partial<VisionAnalysisResult>
        results.push({
          rooms_detected: Array.isArray(parsed.rooms_detected) ? parsed.rooms_detected : [],
          bathroom_count: typeof parsed.bathroom_count === 'number' ? parsed.bathroom_count : 0,
          bedroom_count: typeof parsed.bedroom_count === 'number' ? parsed.bedroom_count : 0,
          kitchen_quality: parsed.kitchen_quality ?? 'unknown',
          luxury_score: typeof parsed.luxury_score === 'number' ? parsed.luxury_score : 50,
          renovation_needed: parsed.renovation_needed ?? false,
          renovation_probability: typeof parsed.renovation_probability === 'number' ? parsed.renovation_probability : 0.2,
          sunlight_score: typeof parsed.sunlight_score === 'number' ? parsed.sunlight_score : 50,
          has_outdoor: parsed.has_outdoor ?? false,
          has_pool: parsed.has_pool ?? false,
          has_garden: parsed.has_garden ?? false,
          has_sea_view: parsed.has_sea_view ?? false,
          has_golf_view: parsed.has_golf_view ?? false,
          has_city_view: parsed.has_city_view ?? false,
          has_mountain_view: parsed.has_mountain_view ?? false,
          architecture_style: (parsed.architecture_style as ArchitectureStyle) ?? 'contemporary',
          furniture_staging: (parsed.furniture_staging as StagingQuality) ?? 'basic',
          construction_quality: parsed.construction_quality ?? 'standard',
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
        })
      } catch (err) {
        logger.error('[VisionAnalyzer] failed to analyze image', { submissionId, url, err })
        results.push({ ...VISION_DEFAULTS })
      }
    }

    const merged = mergeVisionResults(results)
    const imageCount = imageUrls.length
    logger.info('[VisionAnalyzer] analyzed', { submissionId, imageCount, confidence: merged.confidence })
    return merged
  }
}

export const visionAnalyzer = new VisionAnalyzer()
