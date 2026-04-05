// =============================================================================
// Agency Group — Lead Scoring API
// POST /api/automation/lead-score
// Scores leads 0-100, classifies A/B/C, returns recommended action
// After scoring, upserts contact to Supabase if available
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LeadScoreRequest {
  name: string
  email?: string
  phone?: string
  source?: string
  message?: string
  budget?: number
  nationality?: string
  language?: string
  timeline?: string
}

interface ScoreBreakdown {
  budget: number
  source: number
  contact_info: number
  message_quality: number
  nationality: number
  timeline: number
}

interface LeadScoreResponse {
  score: number
  tier: 'A' | 'B' | 'C'
  breakdown: ScoreBreakdown
  recommended_action: string
  assigned_consultant_type: string
  estimated_budget_range: string
  detected_language: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HIGH_VALUE_NATIONALITIES = ['US', 'FR', 'GB', 'DE', 'AE', 'CN', 'BR', 'SA', 'QA', 'KW']

const LOCATION_KEYWORDS = [
  'lisboa', 'cascais', 'sintra', 'estoril', 'algarve', 'comporta', 'ericeira',
  'porto', 'foz', 'chiado', 'príncipe real', 'lapa', 'santos', 'bairro alto',
  'parque das nações', 'vilamoura', 'lagos', 'albufeira', 'quinta do lago',
  'vale do lobo', 'aroeira', 'azeitão', 'setúbal', 'madeira', 'açores',
  'lisbon', 'algarve', 'silver coast', 'costa de prata'
]

const LANGUAGE_MAP: Record<string, string> = {
  pt: 'Português',
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  ar: 'العربية',
  zh: '中文',
  es: 'Español',
  it: 'Italiano',
}

// ---------------------------------------------------------------------------
// Scoring algorithm
// ---------------------------------------------------------------------------

function detectLanguage(text: string, language?: string, nationality?: string): string {
  if (language) return language

  // Detect from nationality
  const nationalityLangMap: Record<string, string> = {
    PT: 'pt', BR: 'pt', AO: 'pt',
    US: 'en', GB: 'en', AU: 'en', CA: 'en', ZA: 'en', NZ: 'en',
    FR: 'fr', BE: 'fr', CH: 'fr',
    DE: 'de', AT: 'de',
    AE: 'ar', SA: 'ar', QA: 'ar', KW: 'ar', BH: 'ar', OM: 'ar',
    CN: 'zh', TW: 'zh', HK: 'zh',
    ES: 'es', MX: 'es', AR: 'es',
    IT: 'it',
  }

  if (nationality && nationalityLangMap[nationality.toUpperCase()]) {
    return nationalityLangMap[nationality.toUpperCase()]
  }

  // Basic text detection heuristics
  const lowerText = text.toLowerCase()
  if (/[à-ü]/.test(lowerText) && (lowerText.includes('olá') || lowerText.includes('quero') || lowerText.includes('procuro'))) return 'pt'
  if (/[à-ü]/.test(lowerText) && (lowerText.includes('je cherche') || lowerText.includes('bonjour'))) return 'fr'
  if (/[äöü]/.test(lowerText) || lowerText.includes('ich suche') || lowerText.includes('kaufen')) return 'de'
  if (/[\u4e00-\u9fff]/.test(text)) return 'zh'
  if (/[\u0600-\u06ff]/.test(text)) return 'ar'

  return 'en'
}

function calculateBudgetScore(budget?: number): { score: number; range: string } {
  if (!budget || budget <= 0) return { score: 0, range: 'Não especificado' }

  if (budget >= 3_000_000) return { score: 30, range: '€3M+' }
  if (budget >= 1_000_000) return { score: 30, range: '€1M–€3M' }
  if (budget >= 500_000)   return { score: 20, range: '€500K–€1M' }
  if (budget >= 200_000)   return { score: 10, range: '€200K–€500K' }
  if (budget >= 100_000)   return { score: 5,  range: '€100K–€200K' }

  return { score: 0, range: '<€100K' }
}

function calculateSourceScore(source?: string): number {
  if (!source) return 0

  const normalised = source.toLowerCase().replace(/[\s-]/g, '_')

  if (normalised.includes('referral') || normalised.includes('referencia')) return 20
  if (normalised.includes('idealista_premium') || normalised.includes('idealista premium')) return 10
  if (normalised.includes('linkedin')) return 10
  if (normalised.includes('website') || normalised.includes('web')) return 5
  if (normalised.includes('instagram') || normalised.includes('social')) return 5
  if (normalised.includes('cold_call') || normalised.includes('prospe')) return 3

  return 2
}

function calculateMessageScore(message?: string): { messageLength: number; hasLocation: boolean } {
  if (!message) return { messageLength: 0, hasLocation: false }

  const lower = message.toLowerCase()
  const hasLocation = LOCATION_KEYWORDS.some((kw) => lower.includes(kw))

  return {
    messageLength: message.length,
    hasLocation,
  }
}

function scoreLeadRequest(data: LeadScoreRequest): LeadScoreResponse {
  const breakdown: ScoreBreakdown = {
    budget: 0,
    source: 0,
    contact_info: 0,
    message_quality: 0,
    nationality: 0,
    timeline: 0,
  }

  // 1. Budget scoring (max 30)
  const { score: budgetScore, range: budgetRange } = calculateBudgetScore(data.budget)
  breakdown.budget = budgetScore

  // 2. Source scoring (max 20)
  breakdown.source = calculateSourceScore(data.source)

  // 3. Contact info (max 15)
  if (data.phone && data.phone.trim().length > 5) breakdown.contact_info += 10
  if (data.email && data.email.includes('@')) breakdown.contact_info += 5

  // 4. Message quality (max 15)
  const { messageLength, hasLocation } = calculateMessageScore(data.message)
  if (messageLength > 200) {
    breakdown.message_quality += 10
  } else if (messageLength > 100) {
    breakdown.message_quality += 7
  } else if (messageLength > 50) {
    breakdown.message_quality += 3
  }
  if (hasLocation) breakdown.message_quality += 5

  // 5. Nationality (max 10)
  const nationalityUpper = data.nationality?.toUpperCase() ?? ''
  if (HIGH_VALUE_NATIONALITIES.includes(nationalityUpper)) {
    breakdown.nationality = 10
  }

  // 6. Timeline (max 15)
  const timeline = data.timeline?.toLowerCase() ?? ''
  if (timeline === 'immediate' || timeline === 'imediato' || timeline === 'now') {
    breakdown.timeline = 15
  } else if (
    timeline === '3months' || timeline === '3_months' ||
    timeline === '3 meses' || timeline === 'short_term'
  ) {
    breakdown.timeline = 8
  } else if (
    timeline === '6months' || timeline === '6_months' ||
    timeline === '6 meses'
  ) {
    breakdown.timeline = 4
  }

  const totalScore = Math.min(
    100,
    breakdown.budget +
    breakdown.source +
    breakdown.contact_info +
    breakdown.message_quality +
    breakdown.nationality +
    breakdown.timeline
  )

  // Classify tier
  let tier: 'A' | 'B' | 'C'
  if (totalScore > 70) tier = 'A'
  else if (totalScore >= 40) tier = 'B'
  else tier = 'C'

  // Recommended action based on tier + budget
  let recommended_action: string
  let assigned_consultant_type: string

  if (tier === 'A') {
    if ((data.budget ?? 0) >= 1_000_000) {
      recommended_action = 'Contacto imediato por WhatsApp + email personalizado. Agendar reunião presencial esta semana. Preparar dossier de propriedades premium.'
      assigned_consultant_type = 'senior_consultant'
    } else {
      recommended_action = 'Contacto por WhatsApp em menos de 15 minutos. Enviar seleção de 3-5 propriedades matching. Agendar visita para os próximos 3 dias.'
      assigned_consultant_type = 'senior_consultant'
    }
  } else if (tier === 'B') {
    recommended_action = 'Enviar email de boas-vindas com propriedades sugeridas. Follow-up por WhatsApp em 24h. Enrolar em sequência de nurturing.'
    assigned_consultant_type = 'consultant'
  } else {
    recommended_action = 'Enrolar em sequência de email automática (7 emails, 30 dias). Follow-up manual em 14 dias se sem resposta.'
    assigned_consultant_type = 'junior_consultant'
  }

  // Detect language
  const combinedText = [data.message ?? '', data.name ?? ''].join(' ')
  const detectedLang = detectLanguage(combinedText, data.language, data.nationality)

  return {
    score: totalScore,
    tier,
    breakdown,
    recommended_action,
    assigned_consultant_type,
    estimated_budget_range: budgetRange,
    detected_language: LANGUAGE_MAP[detectedLang] ?? detectedLang,
  }
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: unknown = await request.json()

    // Validate required fields
    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Request body must be a JSON object' },
        { status: 400 }
      )
    }

    const data = body as Record<string, unknown>

    if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Field "name" is required' },
        { status: 400 }
      )
    }

    const leadData: LeadScoreRequest = {
      name: String(data.name).trim(),
      email: typeof data.email === 'string' ? data.email.trim() : undefined,
      phone: typeof data.phone === 'string' ? data.phone.trim() : undefined,
      source: typeof data.source === 'string' ? data.source.trim() : undefined,
      message: typeof data.message === 'string' ? data.message.trim() : undefined,
      budget: typeof data.budget === 'number' ? data.budget :
              typeof data.budget === 'string' ? parseFloat(data.budget) || undefined : undefined,
      nationality: typeof data.nationality === 'string' ? data.nationality.trim().toUpperCase() : undefined,
      language: typeof data.language === 'string' ? data.language.trim().toLowerCase() : undefined,
      timeline: typeof data.timeline === 'string' ? data.timeline.trim().toLowerCase() : undefined,
    }

    const result = scoreLeadRequest(leadData)

    // --- Upsert to Supabase contacts table (best-effort, non-blocking) ---
    try {
      const upsertPayload: Record<string, unknown> = {
        full_name:            leadData.name,
        email:                leadData.email ?? null,
        phone:                leadData.phone ?? null,
        nationality:          leadData.nationality ?? null,
        language:             leadData.language ?? null,
        status:               result.tier === 'A' ? 'active' : result.tier === 'B' ? 'prospect' : 'lead',
        lead_tier:            result.tier,
        lead_score:           result.score,
        lead_score_breakdown: { ...result.breakdown } as Record<string, number>,
        source:               leadData.source ?? null,
        ai_suggested_action:  result.recommended_action,
        detected_intent:      'buy',
        timeline:             leadData.timeline ?? null,
        gdpr_consent:         false,
        updated_at:           new Date().toISOString(),
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabaseAdmin.from('contacts') as any)
        .upsert(upsertPayload, { onConflict: 'email', ignoreDuplicates: false })
    } catch (supabaseError) {
      // Non-fatal: Supabase unavailable or upsert failed — continue
      console.warn('[lead-score] Supabase upsert skipped:', supabaseError instanceof Error ? supabaseError.message : 'unknown')
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error('[lead-score] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET: return scoring criteria documentation
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    endpoint: 'POST /api/automation/lead-score',
    description: 'Score inbound leads 0-100 and classify as A (hot), B (warm), or C (cold)',
    algorithm: {
      max_score: 100,
      factors: {
        budget: {
          max: 30,
          rules: {
            '>= 1M': 30,
            '500K–1M': 20,
            '200K–500K': 10,
            '100K–200K': 5,
            '< 100K or not specified': 0,
          },
        },
        source: {
          max: 20,
          rules: {
            referral: 20,
            idealista_premium: 10,
            linkedin: 10,
            website: 5,
            social_media: 5,
          },
        },
        contact_info: {
          max: 15,
          rules: { has_phone: 10, has_email: 5 },
        },
        message_quality: {
          max: 15,
          rules: {
            message_length_over_200: 10,
            message_length_100_200: 7,
            message_length_50_100: 3,
            specific_location_mentioned: 5,
          },
        },
        nationality: {
          max: 10,
          high_value: ['US', 'FR', 'GB', 'DE', 'AE', 'CN', 'BR', 'SA', 'QA', 'KW'],
        },
        timeline: {
          max: 15,
          rules: { immediate: 15, '3_months': 8, '6_months': 4 },
        },
      },
      tiers: { A: '> 70 (hot)', B: '40–70 (warm)', C: '< 40 (cold)' },
    },
  })
}
