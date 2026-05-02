// =============================================================================
// Agency Group — Listing Presentation Quality Scorer
// lib/scoring/presentationScore.ts
//
// Computes a 0-100 presentation quality score for any property listing,
// measuring how well the property is presented to potential buyers.
//
// DIMENSIONS:
//   Photos     (0-30)  — count and coverage
//   Description (0-25) — length and content quality
//   Title       (0-15) — professional, descriptive
//   Floorplan   (0-15) — has_floorplan boolean
//   Features    (0-15) — number of features/amenities listed
//
// OUTPUTS:
//   presentation_score          — 0-100 composite
//   presentation_flags          — array of detected issues
//   presentation_opportunity_bonus — 0-15 (inverse: poor = opportunity)
//
// PURE FUNCTION — no DB, no external dependencies.
// Intended to be called at ingestion time from lib/ingestion/pipeline.ts.
// =============================================================================

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PresentationFlag =
  | 'no_photos'
  | 'too_few_photos'
  | 'no_description'
  | 'short_description'
  | 'no_title'
  | 'poor_title'
  | 'no_floorplan'
  | 'no_features'

export interface PresentationInput {
  title?:         string | null
  description?:   string | null
  photos?:        string[] | null      // array of photo URLs
  num_photos?:    number | null        // fallback if photos array not available
  has_floorplan?: boolean | null
  has_video?:     boolean | null       // bonus but not penalized if absent
  features?:      string[] | null
}

export interface PresentationResult {
  presentation_score:              number              // 0-100
  presentation_flags:              PresentationFlag[]  // list of quality issues
  presentation_opportunity_bonus:  number              // 0-15 (poor listing = opportunity)
  breakdown: {
    photo_score:        number  // 0-30
    description_score:  number  // 0-25
    title_score:        number  // 0-15
    floorplan_score:    number  // 0-15
    features_score:     number  // 0-15
  }
}

// ---------------------------------------------------------------------------
// PURE: Photo score (0-30 pts)
// ---------------------------------------------------------------------------

function scorePhotos(input: PresentationInput): { score: number; flags: PresentationFlag[] } {
  const flags: PresentationFlag[] = []

  // Resolve photo count: prefer array length, fall back to num_photos
  const count =
    Array.isArray(input.photos) ? input.photos.length
    : typeof input.num_photos === 'number' ? input.num_photos
    : 0

  if (count === 0)    { flags.push('no_photos');       return { score: 0, flags } }
  if (count <= 2)     { flags.push('too_few_photos');  return { score: 5, flags } }
  if (count <= 5)     return { score: 12, flags }
  if (count <= 10)    return { score: 22, flags }
  if (count <= 20)    return { score: 28, flags }
  return { score: 30, flags }  // 20+ photos
}

// ---------------------------------------------------------------------------
// PURE: Description quality score (0-25 pts)
// ---------------------------------------------------------------------------

// Investment-relevant keywords that signal professional listing quality
const INVESTMENT_KEYWORDS = [
  'yield', 'rendimento', 'investimento', 'retorno', 'rentabilidade',
  'remodelado', 'renovado', 'condomínio', 'porteiro', 'piscina',
  'terraço', 'garagem', 'arrecadação', 'vista mar', 'vista rio',
  'luminoso', 'localização', 'infraestruturas', 'serviços',
]

function scoreDescription(input: PresentationInput): { score: number; flags: PresentationFlag[] } {
  const flags: PresentationFlag[] = []
  const desc = (input.description ?? '').trim()

  if (!desc) {
    flags.push('no_description')
    return { score: 0, flags }
  }

  if (desc.length < 50) {
    flags.push('short_description')
    return { score: 5, flags }
  }

  let base: number
  if (desc.length >= 500)     base = 25
  else if (desc.length >= 200) base = 18
  else                          base = 12   // 50-200 chars: passable

  // Bonus for investment-relevant content (max +2 pts within description band)
  const lowerDesc = desc.toLowerCase()
  const hasKeywords = INVESTMENT_KEYWORDS.some(kw => lowerDesc.includes(kw))
  const bonus = hasKeywords ? 2 : 0

  return { score: Math.min(25, base + bonus), flags }
}

// ---------------------------------------------------------------------------
// PURE: Title quality score (0-15 pts)
// ---------------------------------------------------------------------------

function scoreTitle(input: PresentationInput): { score: number; flags: PresentationFlag[] } {
  const flags: PresentationFlag[] = []
  const title = (input.title ?? '').trim()

  if (!title) {
    flags.push('no_title')
    return { score: 0, flags }
  }

  if (title.length < 10) {
    flags.push('poor_title')
    return { score: 5, flags }
  }

  if (title.length >= 30) return { score: 15, flags }
  return { score: 10, flags }   // 10-29 chars: adequate
}

// ---------------------------------------------------------------------------
// PURE: Floorplan score (0-15 pts)
// ---------------------------------------------------------------------------

function scoreFloorplan(input: PresentationInput): { score: number; flags: PresentationFlag[] } {
  if (input.has_floorplan) return { score: 15, flags: [] }
  return { score: 0, flags: ['no_floorplan'] }
}

// ---------------------------------------------------------------------------
// PURE: Features score (0-15 pts)
// ---------------------------------------------------------------------------

function scoreFeatures(input: PresentationInput): { score: number; flags: PresentationFlag[] } {
  const count = Array.isArray(input.features) ? input.features.length : 0
  if (count === 0)    return { score: 0,  flags: ['no_features'] }
  if (count <= 2)     return { score: 5,  flags: [] }
  if (count <= 5)     return { score: 8,  flags: [] }
  if (count <= 10)    return { score: 12, flags: [] }
  return { score: 15, flags: [] }  // 10+ features
}

// ---------------------------------------------------------------------------
// Opportunity bonus (inverse relationship with quality)
// Poor presentation → other buyers overlook the property → less competition
// ---------------------------------------------------------------------------

function computeOpportunityBonus(presentationScore: number): number {
  if (presentationScore < 40) return 15  // very poor = maximum hidden gem potential
  if (presentationScore < 60) return 8   // below average = moderate opportunity
  if (presentationScore < 80) return 3   // acceptable = slight opportunity
  return 0                                // well-presented = no advantage
}

// ---------------------------------------------------------------------------
// Main export: computePresentationScore
// ---------------------------------------------------------------------------

export function computePresentationScore(input: PresentationInput): PresentationResult {
  const photos      = scorePhotos(input)
  const description = scoreDescription(input)
  const title       = scoreTitle(input)
  const floorplan   = scoreFloorplan(input)
  const features    = scoreFeatures(input)

  const presentation_score = Math.min(
    100,
    photos.score + description.score + title.score + floorplan.score + features.score,
  )

  const presentation_flags: PresentationFlag[] = [
    ...photos.flags,
    ...description.flags,
    ...title.flags,
    ...floorplan.flags,
    ...features.flags,
  ]

  return {
    presentation_score,
    presentation_flags,
    presentation_opportunity_bonus: computeOpportunityBonus(presentation_score),
    breakdown: {
      photo_score:       photos.score,
      description_score: description.score,
      title_score:       title.score,
      floorplan_score:   floorplan.score,
      features_score:    features.score,
    },
  }
}
