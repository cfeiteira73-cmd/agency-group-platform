// =============================================================================
// Agency Group — ML Scoring Pipeline
// lib/ml/scoringPipeline.ts
//
// Orchestrates feature extraction → model inference → persistence.
// Single entry point for property opportunity scoring.
// Heuristic baseline — model_id from ml_model_registry when available.
// TypeScript strict — 0 errors
// =============================================================================

import type { YieldPrediction } from './models/yieldPredictor'
import type { ConversionPrediction } from './models/conversionPredictor'
import { predictYield } from './models/yieldPredictor'
import { predictConversion } from './models/conversionPredictor'
import { extractPropertyFeatures, extractInvestorFeatures } from './featureExtractor'
import { getOrLoadModel, scoreWithWeights } from '@/lib/ml/modelLoader'
import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PipelineInput {
  propertyId: string
  tenantId: string
  investorId?: string
}

export interface PipelineOutput {
  propertyId: string
  yield_prediction: YieldPrediction | null
  conversion_prediction: ConversionPrediction | null
  /** Composite opportunity score 0–100 */
  opportunity_score: number
  /** Investment grade: A+ | A | B+ | B | C */
  investment_grade: string
  /** ISO timestamp of scoring */
  scored_at: string
  /** Version string of the model used */
  model_version: string
  /** Whether the prediction was successfully persisted to ml_predictions */
  persisted: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FALLBACK_MODEL_ID = 'heuristic-v1'
const CURRENT_MODEL_VERSION = 'heuristic-v1'

/** Default match score when no investor context is available */
const DEFAULT_MATCH_SCORE = 75

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveInvestmentGrade(score: number): string {
  if (score >= 90) return 'A+'
  if (score >= 80) return 'A'
  if (score >= 70) return 'B+'
  if (score >= 60) return 'B'
  return 'C'
}

function computeOpportunityScore(
  yieldPct: number,
  conversionPrediction: ConversionPrediction | null,
): number {
  // Base: yield * 10, capped at 100
  const yieldScore = Math.min(100, yieldPct * 10)

  // Bonus: up to 10 points from conversion probability
  const conversionBonus = conversionPrediction !== null
    ? Math.round(conversionPrediction.probability * 10)
    : 0

  return Math.min(100, Math.round(yieldScore + conversionBonus))
}

async function resolveActiveModelId(tenantId: string): Promise<string> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('ml_model_registry')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('objective', 'yield_prediction')
      .eq('status', 'active')
      .order('activated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      return FALLBACK_MODEL_ID
    }
    return data.id as string
  } catch (err) {
    console.error('[scoringPipeline] resolveActiveModelId failed (using fallback):', err instanceof Error ? err.message : String(err))
    return FALLBACK_MODEL_ID
  }
}

async function persistPrediction(
  tenantId: string,
  modelId: string,
  propertyId: string,
  opportunityScore: number,
  yieldPrediction: YieldPrediction | null,
): Promise<boolean> {
  try {
    const { error } = await (supabaseAdmin as any)
      .from('ml_predictions')
      .insert({
        tenant_id:       tenantId,
        model_id:        modelId === FALLBACK_MODEL_ID ? null : modelId,
        entity_type:     'property',
        entity_id:       propertyId,
        prediction_type: 'opportunity_score',
        score:           opportunityScore,
        confidence:      yieldPrediction?.confidence ?? null,
        features_used:   yieldPrediction !== null
          ? {
              estimated_yield_pct: yieldPrediction.estimated_yield_pct,
              tier:                yieldPrediction.tier,
              basis:               yieldPrediction.basis,
            }
          : {},
      })

    if (error) {
      console.error('[scoringPipeline] persistPrediction failed (non-critical):', error.message)
      return false
    }
    return true
  } catch (err) {
    console.error('[scoringPipeline] persistPrediction unexpected error (non-critical):', err instanceof Error ? err.message : String(err))
    return false
  }
}

// ---------------------------------------------------------------------------
// runScoringPipeline — main export
// ---------------------------------------------------------------------------

export async function runScoringPipeline(input: PipelineInput): Promise<PipelineOutput> {
  const { propertyId, tenantId, investorId } = input
  const scoredAt = new Date().toISOString()

  const minimalOutput: PipelineOutput = {
    propertyId,
    yield_prediction:      null,
    conversion_prediction: null,
    opportunity_score:     0,
    investment_grade:      'C',
    scored_at:             scoredAt,
    model_version:         CURRENT_MODEL_VERSION,
    persisted:             false,
  }

  // 1. Extract property features — abort on failure
  let propertyFeatures
  try {
    propertyFeatures = await extractPropertyFeatures(propertyId, tenantId)
  } catch (err) {
    console.error('[scoringPipeline] extractPropertyFeatures failed:', err instanceof Error ? err.message : String(err))
    return minimalOutput
  }

  // 2. Extract investor features (optional)
  let investorFeatures = null
  if (investorId) {
    try {
      investorFeatures = await extractInvestorFeatures(investorId, tenantId)
    } catch (err) {
      console.error('[scoringPipeline] extractInvestorFeatures failed (continuing without investor context):', err instanceof Error ? err.message : String(err))
    }
  }

  // 3. Resolve active model from registry
  const modelId = await resolveActiveModelId(tenantId)

  // Try to load trained model weights; fall back to heuristic if unavailable
  const trainedWeights = modelId ? await getOrLoadModel(modelId).catch(() => null) : null

  // 4. Run yield predictor
  const yieldPrediction = predictYield(propertyFeatures)

  // 5. Run conversion predictor (if investor context available)
  let conversionPrediction: ConversionPrediction | null = null
  if (investorFeatures !== null) {
    conversionPrediction = predictConversion(investorFeatures, propertyFeatures, DEFAULT_MATCH_SCORE)
  }

  // 6. Compute composite opportunity score
  // If a trained model is loaded (and not a heuristic stub), use its score directly;
  // otherwise fall back to the heuristic computeOpportunityScore.
  let opportunityScore: number
  if (trainedWeights !== null) {
    const featureMap: Record<string, number | null> = {
      price_eur:         propertyFeatures.price_eur,
      price_per_m2:      propertyFeatures.price_per_m2,
      area_m2:           propertyFeatures.area_m2,
      days_listed:       propertyFeatures.days_listed,
      match_count:       propertyFeatures.match_count,
      avg_match_score:   propertyFeatures.avg_match_score,
      estimated_yield:   yieldPrediction.estimated_yield_pct,
    }
    const modelResult = scoreWithWeights(featureMap, trainedWeights)
    // scoreWithWeights signals heuristic fallback via fallback_used; respect it
    opportunityScore = modelResult.fallback_used
      ? computeOpportunityScore(yieldPrediction.estimated_yield_pct, conversionPrediction)
      : modelResult.score
  } else {
    opportunityScore = computeOpportunityScore(
      yieldPrediction.estimated_yield_pct,
      conversionPrediction,
    )
  }

  // 7. Derive investment grade
  const investmentGrade = deriveInvestmentGrade(opportunityScore)

  // 8. Persist prediction (non-critical — errors don't block response)
  const persisted = await persistPrediction(
    tenantId,
    modelId,
    propertyId,
    opportunityScore,
    yieldPrediction,
  )

  return {
    propertyId,
    yield_prediction:      yieldPrediction,
    conversion_prediction: conversionPrediction,
    opportunity_score:     opportunityScore,
    investment_grade:      investmentGrade,
    scored_at:             scoredAt,
    model_version:         CURRENT_MODEL_VERSION,
    persisted,
  }
}
