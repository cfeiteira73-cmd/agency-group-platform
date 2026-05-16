// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'

interface VoiceAnalysisResult {
  transcription: string
  seller_intent: 'motivated' | 'flexible' | 'holding' | 'unknown'
  urgency_level: 'immediate' | 'within_30_days' | 'flexible' | 'unknown'
  extracted_facts: {
    bedrooms?: number
    bathrooms?: number
    area_sqm?: number
    price_expectation_eur?: number
    key_features: string[]
    location_hints: string[]
  }
  sentiment: 'positive' | 'neutral' | 'concerned'
  confidence: number
}

const DEFAULT_RESULT: VoiceAnalysisResult = {
  transcription: '',
  seller_intent: 'unknown',
  urgency_level: 'unknown',
  extracted_facts: {
    key_features: [],
    location_hints: [],
  },
  sentiment: 'neutral',
  confidence: 0.2,
}

const TEXT_ANALYSIS_PROMPT = (text: string) => `You are a real estate expert analyzing a voice note transcription from a property seller.
Extract structured information and return a JSON object with EXACTLY these fields:
{
  "seller_intent": "motivated|flexible|holding|unknown",
  "urgency_level": "immediate|within_30_days|flexible|unknown",
  "extracted_facts": {
    "bedrooms": number or null,
    "bathrooms": number or null,
    "area_sqm": number or null,
    "price_expectation_eur": number or null,
    "key_features": ["feature1", "feature2"],
    "location_hints": ["hint1", "hint2"]
  },
  "sentiment": "positive|neutral|concerned",
  "confidence": 0.0-1.0
}

Transcription to analyze:
"""
${text}
"""

Return only the JSON object, no additional text.`

async function analyzeTranscriptionText(transcription: string): Promise<Omit<VoiceAnalysisResult, 'transcription'>> {
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
          content: [{ type: 'text', text: TEXT_ANALYSIS_PROMPT(transcription) }],
        },
      ],
    }),
  })
  const data = (await resp.json()) as { content?: Array<{ text?: string }> }
  return parseAnalysisResponse(data.content?.[0]?.text ?? '')
}

function parseAnalysisResponse(raw: string): Omit<VoiceAnalysisResult, 'transcription'> {
  const jsonMatch = raw.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return omitTranscription(DEFAULT_RESULT)

  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      seller_intent?: string
      urgency_level?: string
      extracted_facts?: {
        bedrooms?: number | null
        bathrooms?: number | null
        area_sqm?: number | null
        price_expectation_eur?: number | null
        key_features?: string[]
        location_hints?: string[]
      }
      sentiment?: string
      confidence?: number
    }

    return {
      seller_intent: normalizeSellerIntent(parsed.seller_intent),
      urgency_level: normalizeUrgencyLevel(parsed.urgency_level),
      extracted_facts: {
        bedrooms: parsed.extracted_facts?.bedrooms ?? undefined,
        bathrooms: parsed.extracted_facts?.bathrooms ?? undefined,
        area_sqm: parsed.extracted_facts?.area_sqm ?? undefined,
        price_expectation_eur: parsed.extracted_facts?.price_expectation_eur ?? undefined,
        key_features: Array.isArray(parsed.extracted_facts?.key_features)
          ? parsed.extracted_facts.key_features
          : [],
        location_hints: Array.isArray(parsed.extracted_facts?.location_hints)
          ? parsed.extracted_facts.location_hints
          : [],
      },
      sentiment: normalizeSentiment(parsed.sentiment),
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5,
    }
  } catch {
    return omitTranscription(DEFAULT_RESULT)
  }
}

function omitTranscription(r: VoiceAnalysisResult): Omit<VoiceAnalysisResult, 'transcription'> {
  const { transcription: _t, ...rest } = r
  void _t
  return rest
}

function normalizeSellerIntent(raw: string | undefined): VoiceAnalysisResult['seller_intent'] {
  const valid: VoiceAnalysisResult['seller_intent'][] = ['motivated', 'flexible', 'holding', 'unknown']
  return valid.includes(raw as VoiceAnalysisResult['seller_intent'])
    ? (raw as VoiceAnalysisResult['seller_intent'])
    : 'unknown'
}

function normalizeUrgencyLevel(raw: string | undefined): VoiceAnalysisResult['urgency_level'] {
  const valid: VoiceAnalysisResult['urgency_level'][] = [
    'immediate',
    'within_30_days',
    'flexible',
    'unknown',
  ]
  return valid.includes(raw as VoiceAnalysisResult['urgency_level'])
    ? (raw as VoiceAnalysisResult['urgency_level'])
    : 'unknown'
}

function normalizeSentiment(raw: string | undefined): VoiceAnalysisResult['sentiment'] {
  const valid: VoiceAnalysisResult['sentiment'][] = ['positive', 'neutral', 'concerned']
  return valid.includes(raw as VoiceAnalysisResult['sentiment'])
    ? (raw as VoiceAnalysisResult['sentiment'])
    : 'neutral'
}

class VoiceIntelligence {
  async analyzeVoiceNote(audioUrl: string, submissionId: string): Promise<VoiceAnalysisResult> {
    // Transcription is assumed to be handled externally via Whisper.
    // We use the audio URL path/filename as a transcription seed for now,
    // and rely on Claude to extract what is available from the URL metadata.
    const transcriptionSeed = decodeURIComponent(audioUrl.split('/').pop() ?? audioUrl)
      .replace(/[-_]/g, ' ')
      .replace(/\.[^.]+$/, '')

    if (!transcriptionSeed || transcriptionSeed.length < 5) {
      logger.warn('[VoiceIntelligence] insufficient transcription data', { submissionId, audioUrl })
      return { ...DEFAULT_RESULT, confidence: 0.2 }
    }

    try {
      const analysis = await analyzeTranscriptionText(transcriptionSeed)
      const result: VoiceAnalysisResult = {
        transcription: transcriptionSeed,
        ...analysis,
      }

      logger.info('[VoiceIntelligence] analyzed', {
        submissionId,
        seller_intent: result.seller_intent,
        urgency_level: result.urgency_level,
        confidence: result.confidence,
      })

      return result
    } catch (err) {
      logger.error('[VoiceIntelligence] analysis failed', { submissionId, audioUrl, err })
      return { ...DEFAULT_RESULT, transcription: transcriptionSeed }
    }
  }
}

export const voiceIntelligence = new VoiceIntelligence()
