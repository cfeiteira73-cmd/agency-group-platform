// AGENCY GROUP — SH-ROS Property AI | AMI: 22506

import { logger } from '@/lib/observability/logger'
import { supabaseAdmin } from '@/lib/supabase'
import type {
  PropertySubmission,
  PropertyAnalysis,
  InputFile,
  ArchitectureStyle,
  PropertyCondition,
  EnergyClass,
  StagingQuality,
} from '@/lib/property-ai/types'
import { visionAnalyzer } from './visionAnalyzer'
import { ocrDocumentIntelligence } from './ocrDocumentIntelligence'
import { voiceIntelligence } from './voiceIntelligence'
import { geospatialIntelligence, type GeospatialResult } from './geospatialIntelligence'

const sb = supabaseAdmin as unknown as { from: (t: string) => unknown }

interface DocumentExtractionResult {
  energy_class?: EnergyClass
  area_sqm?: number
  license_number?: string
  legal_description?: string
  missing_docs: string[]
  extraction_confidence: number
  detected_doc_type: 'energy_certificate' | 'floorplan' | 'legal_doc' | 'property_register' | 'unknown'
}

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

interface IngestionResult {
  submission_id: string
  analysis: PropertyAnalysis
  media_files: InputFile[]
  geospatial: GeospatialResult
  doc_extraction?: DocumentExtractionResult
  voice_analysis?: VoiceAnalysisResult
  processing_time_ms: number
  confidence: number
  missing_info: string[]
}

function detectMissingInfo(
  analysis: PropertyAnalysis,
  docExtraction?: DocumentExtractionResult
): string[] {
  const missing: string[] = []
  if (!analysis.bedrooms) missing.push('bedrooms')
  if (!analysis.bathrooms) missing.push('bathrooms')
  if (!analysis.area_sqm) missing.push('area_sqm')
  if (!analysis.location?.city) missing.push('location_city')
  if (analysis.energy_class === 'unknown') missing.push('energy_class')
  if (!analysis.property_type) missing.push('property_type')
  if (docExtraction) {
    for (const doc of docExtraction.missing_docs) {
      if (!missing.includes(doc)) missing.push(doc)
    }
  }
  return missing
}

function mergeEnergyClass(
  fromVision: EnergyClass | undefined,
  fromDoc: EnergyClass | undefined
): EnergyClass {
  if (fromDoc && fromDoc !== 'unknown') return fromDoc
  if (fromVision && fromVision !== 'unknown') return fromVision
  return 'unknown'
}

function weightedConfidence(scores: Array<{ value: number; weight: number }>): number {
  const totalWeight = scores.reduce((sum, s) => sum + s.weight, 0)
  const weighted = scores.reduce((sum, s) => sum + s.value * s.weight, 0)
  return totalWeight > 0 ? weighted / totalWeight : 0.3
}

function buildPropertyAnalysis(
  submissionId: string,
  orgId: string,
  vision: Awaited<ReturnType<typeof visionAnalyzer.analyze>>,
  docExtraction: DocumentExtractionResult | undefined,
  voiceResult: VoiceAnalysisResult | undefined,
  geo: GeospatialResult
): PropertyAnalysis {
  const analysis_id = crypto.randomUUID()
  const now = new Date()

  const bedrooms =
    vision.bedroom_count > 0
      ? vision.bedroom_count
      : voiceResult?.extracted_facts.bedrooms

  const bathrooms =
    vision.bathroom_count > 0
      ? vision.bathroom_count
      : voiceResult?.extracted_facts.bathrooms

  const area_sqm =
    docExtraction?.area_sqm ?? voiceResult?.extracted_facts.area_sqm

  const energy_class = mergeEnergyClass(undefined, docExtraction?.energy_class)

  const condition: PropertyCondition = vision.renovation_probability > 0.6
    ? 'needs_renovation'
    : vision.renovation_probability < 0.2
      ? 'excellent'
      : 'good'

  const architectureStyle: ArchitectureStyle =
    vision.architecture_style as ArchitectureStyle ?? 'contemporary'

  const stagingQuality: StagingQuality = vision.furniture_staging

  const location = geo.inferred_city
    ? {
        city: geo.inferred_city,
        neighborhood: geo.inferred_neighborhood,
        walkability_score: geo.walkability_score,
        premium_zone: geo.premium_zone,
        zone_classification: geo.zone_classification,
        nearby_amenities: geo.nearby_amenities,
      }
    : undefined

  const confidence = weightedConfidence([
    { value: vision.confidence, weight: 3 },
    { value: geo.confidence, weight: 2 },
    { value: docExtraction?.extraction_confidence ?? 0.3, weight: 1 },
    { value: voiceResult?.confidence ?? 0.3, weight: 1 },
  ])

  return {
    analysis_id,
    submission_id: submissionId,
    org_id: orgId,
    property_type: undefined, // to be inferred in a later enrichment pass
    bedrooms,
    bathrooms,
    area_sqm,
    floor: undefined,
    condition,
    energy_class,
    has_pool: vision.has_pool,
    has_garden: vision.has_garden,
    has_parking: false, // requires dedicated parking detection in future
    has_elevator: false,
    has_sea_view: vision.has_sea_view,
    has_golf_view: vision.has_golf_view,
    has_city_view: vision.has_city_view,
    has_mountain_view: vision.has_mountain_view,
    architecture_style: architectureStyle,
    luxury_score: vision.luxury_score,
    renovation_probability: vision.renovation_probability,
    sunlight_score: vision.sunlight_score,
    staging_quality: stagingQuality,
    location,
    confidence,
    analyzed_at: now,
  }
}

class MediaIngestionOrchestrator {
  async orchestrate(submission: PropertySubmission): Promise<IngestionResult> {
    const start = Date.now()
    const { submission_id, org_id, input_files, raw_description } = submission

    const photoUrls = input_files
      .filter((f) => f.type === 'photo' || f.type === 'drone')
      .map((f) => f.url)

    const videoUrls = input_files
      .filter((f) => f.type === 'video')
      .map((f) => f.url)
    void videoUrls // reserved for future video frame extraction

    const pdfFiles = input_files.filter((f) => f.type === 'pdf')
    const audioFiles = input_files.filter((f) => f.type === 'audio')

    const descriptionText = raw_description ?? submission.raw_url ?? ''

    const allImageUrls = [...photoUrls]

    // Run all analyzers in parallel
    const [visionResult, docResults, voiceResults, geoResult] = await Promise.all([
      photoUrls.length > 0
        ? visionAnalyzer.analyze(allImageUrls, submission_id)
        : visionAnalyzer.analyze([], submission_id),

      Promise.all(
        pdfFiles.map((f) =>
          ocrDocumentIntelligence.extractFromDocument(f.url, submission_id)
        )
      ),

      Promise.all(
        audioFiles.map((f) =>
          voiceIntelligence.analyzeVoiceNote(f.url, submission_id)
        )
      ),

      geospatialIntelligence.analyzeLocation(descriptionText, allImageUrls, submission_id),
    ])

    // Merge document extractions — take best energy_class and smallest area_sqm
    const mergedDoc: DocumentExtractionResult | undefined =
      docResults.length > 0
        ? docResults.reduce((acc, cur) => ({
            energy_class: acc.energy_class ?? cur.energy_class,
            area_sqm: acc.area_sqm ?? cur.area_sqm,
            license_number: acc.license_number ?? cur.license_number,
            legal_description: acc.legal_description ?? cur.legal_description,
            missing_docs: Array.from(new Set([...acc.missing_docs, ...cur.missing_docs])),
            extraction_confidence: (acc.extraction_confidence + cur.extraction_confidence) / 2,
            detected_doc_type:
              acc.detected_doc_type !== 'unknown' ? acc.detected_doc_type : cur.detected_doc_type,
          }))
        : undefined

    // Use highest-confidence voice result
    const mergedVoice: VoiceAnalysisResult | undefined =
      voiceResults.length > 0
        ? voiceResults.reduce((best, cur) => (cur.confidence > best.confidence ? cur : best))
        : undefined

    const analysis = buildPropertyAnalysis(
      submission_id,
      org_id,
      visionResult,
      mergedDoc,
      mergedVoice,
      geoResult
    )

    const missing_info = detectMissingInfo(analysis, mergedDoc)

    // Persist analysis to Supabase
    try {
      const table = sb.from('property_ai_analysis') as {
        upsert: (data: Record<string, unknown>) => Promise<{ error: { message: string } | null }>
      }
      const { error } = await table.upsert({
        analysis_id: analysis.analysis_id,
        submission_id: analysis.submission_id,
        org_id: analysis.org_id,
        property_type: analysis.property_type ?? null,
        bedrooms: analysis.bedrooms ?? null,
        bathrooms: analysis.bathrooms ?? null,
        area_sqm: analysis.area_sqm ?? null,
        floor: analysis.floor ?? null,
        condition: analysis.condition,
        energy_class: analysis.energy_class,
        has_pool: analysis.has_pool,
        has_garden: analysis.has_garden,
        has_parking: analysis.has_parking,
        has_elevator: analysis.has_elevator,
        has_sea_view: analysis.has_sea_view,
        has_golf_view: analysis.has_golf_view,
        has_city_view: analysis.has_city_view,
        has_mountain_view: analysis.has_mountain_view,
        architecture_style: analysis.architecture_style,
        luxury_score: analysis.luxury_score,
        renovation_probability: analysis.renovation_probability,
        sunlight_score: analysis.sunlight_score,
        staging_quality: analysis.staging_quality,
        location: analysis.location ?? null,
        confidence: analysis.confidence,
        analyzed_at: analysis.analyzed_at.toISOString(),
      })
      if (error) {
        logger.error('[MediaIngestionOrchestrator] supabase persist failed', {
          submission_id,
          error: error.message,
        })
      }
    } catch (err) {
      logger.error('[MediaIngestionOrchestrator] supabase error', { submission_id, err })
    }

    const processing_time_ms = Date.now() - start

    logger.info('[MediaIngestionOrchestrator] completed', {
      submission_id,
      confidence: analysis.confidence,
      missing_info_count: missing_info.length,
      processing_time_ms,
    })

    return {
      submission_id,
      analysis,
      media_files: input_files,
      geospatial: geoResult,
      doc_extraction: mergedDoc,
      voice_analysis: mergedVoice,
      processing_time_ms,
      confidence: analysis.confidence,
      missing_info,
    }
  }
}

export const mediaIngestionOrchestrator = new MediaIngestionOrchestrator()
export type { IngestionResult }
