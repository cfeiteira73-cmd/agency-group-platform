// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'

export interface ImageScore {
  asset_id: string
  url: string
  aesthetic_score: number                                          // 0-100
  is_blurry: boolean
  is_duplicate: boolean
  lighting_quality: 'poor' | 'adequate' | 'good' | 'excellent'
  composition_score: number                                        // 0-100
  room_type?: string                                               // 'living_room', 'kitchen', 'bedroom', 'bathroom', 'exterior', etc.
  hero_candidate: boolean                                          // suitable as main cover photo
  social_candidate: boolean                                        // suitable for social media (vertical crop possible)
}

interface ClaudeVisionScore {
  aesthetic_score: number
  lighting_quality: 'poor' | 'adequate' | 'good' | 'excellent'
  composition_score: number
  room_type: string
  hero_candidate: boolean
  social_candidate: boolean
  notes?: string
}

const BLUR_THRESHOLD = 30

async function scoreImageBatch(
  urls: string[],
  assetIds: string[],
): Promise<ClaudeVisionScore[]> {
  const imageContent = urls.map((url) => ({
    type: 'image',
    source: { type: 'url', url },
  }))

  const prompt = `You are a professional real estate photography assessor for Agency Group Portugal (AMI 22506).
Assess each of the ${urls.length} image(s) provided and return a JSON array with one object per image, in the same order as provided.

For each image return:
{
  "aesthetic_score": <0-100, overall visual appeal for real estate listings>,
  "lighting_quality": <"poor"|"adequate"|"good"|"excellent">,
  "composition_score": <0-100, framing, perspective, balance>,
  "room_type": <"exterior"|"living_room"|"kitchen"|"bedroom"|"bathroom"|"dining_room"|"office"|"pool"|"garden"|"terrace"|"garage"|"other">,
  "hero_candidate": <true if high-impact, emotionally compelling, excellent lighting and composition>,
  "social_candidate": <true if has strong visual impact for social media — dramatic, aspirational or lifestyle-rich>
}

Return ONLY a valid JSON array, no markdown, no explanation.`

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY ?? '',
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: [
            ...imageContent,
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  })

  const data = await resp.json() as { content?: Array<{ text?: string }> }
  const raw = data.content?.[0]?.text ?? '[]'
  const cleaned = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim()
  return JSON.parse(cleaned) as ClaudeVisionScore[]
}

function detectDuplicates(scores: ImageScore[]): ImageScore[] {
  const result: ImageScore[] = [...scores]
  for (let i = 0; i < result.length; i++) {
    if (result[i].is_duplicate) continue
    for (let j = i + 1; j < result.length; j++) {
      if (result[j].is_duplicate) continue
      const sameRoom = result[i].room_type === result[j].room_type && result[i].room_type !== 'exterior'
      const similarScore = Math.abs(result[i].composition_score - result[j].composition_score) < 10
      if (sameRoom && similarScore) {
        // Keep the higher aesthetic score
        if (result[i].aesthetic_score >= result[j].aesthetic_score) {
          result[j].is_duplicate = true
        } else {
          result[i].is_duplicate = true
        }
      }
    }
  }
  return result
}

const BATCH_SIZE = 4

class ImageScoringEngine {
  async scoreImages(imageUrls: string[], submissionId: string): Promise<ImageScore[]> {
    const allScores: ImageScore[] = []

    // Process in batches of BATCH_SIZE
    for (let i = 0; i < imageUrls.length; i += BATCH_SIZE) {
      const batchUrls = imageUrls.slice(i, i + BATCH_SIZE)
      const batchIds = batchUrls.map(() => crypto.randomUUID())

      let visionScores: ClaudeVisionScore[]
      try {
        visionScores = await scoreImageBatch(batchUrls, batchIds)
      } catch (err) {
        logger.error('[ImageScoringEngine] batch scoring failed', {
          submissionId,
          batchStart: i,
          err: String(err),
        })
        // Fallback: default neutral scores
        visionScores = batchUrls.map(() => ({
          aesthetic_score: 50,
          lighting_quality: 'adequate' as const,
          composition_score: 50,
          room_type: 'other',
          hero_candidate: false,
          social_candidate: false,
        }))
      }

      for (let j = 0; j < batchUrls.length; j++) {
        const score = visionScores[j] ?? {
          aesthetic_score: 50,
          lighting_quality: 'adequate' as const,
          composition_score: 50,
          room_type: 'other',
          hero_candidate: false,
          social_candidate: false,
        }
        allScores.push({
          asset_id: batchIds[j],
          url: batchUrls[j],
          aesthetic_score: Math.max(0, Math.min(100, score.aesthetic_score)),
          is_blurry: score.aesthetic_score < BLUR_THRESHOLD,
          is_duplicate: false,
          lighting_quality: score.lighting_quality ?? 'adequate',
          composition_score: Math.max(0, Math.min(100, score.composition_score)),
          room_type: score.room_type ?? 'other',
          hero_candidate: score.hero_candidate ?? false,
          social_candidate: score.social_candidate ?? false,
        })
      }
    }

    // Detect duplicates across all scores
    const deduped = detectDuplicates(allScores)

    const validScores = deduped.filter((s) => !s.is_blurry && !s.is_duplicate)
    const avg_aesthetic_score =
      validScores.length > 0
        ? Math.round(validScores.reduce((sum, s) => sum + s.aesthetic_score, 0) / validScores.length)
        : 0

    logger.info('[ImageScoringEngine] scored', {
      submissionId,
      imageCount: imageUrls.length,
      avg_aesthetic_score,
    })

    return deduped
  }
}

export const imageScoringEngine = new ImageScoringEngine()
