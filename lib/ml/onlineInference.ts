// =============================================================================
// Agency Group — Online Inference
// lib/ml/onlineInference.ts
//
// Real-time inference endpoint wrapper with in-process cache, calibration,
// and SHAP-style feature contribution explanations.
// TypeScript strict — 0 errors
// =============================================================================

import { supabaseAdmin }            from '@/lib/supabase'
import log                          from '@/lib/logger'
import { getLatestFeatures }        from './featureStore'
import { runScoringPipeline }       from './scoringPipeline'
import { getActiveCalibrationModel, calibrateScore, scoreToExpectedYield } from './calibrationLayer'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InferenceRequest {
  entity_type: 'property' | 'investor' | 'deal'
  entity_id:   string
  tenant_id:   string
  context?:    Record<string, unknown>  // optional extra context
  use_cache?:  boolean                  // default true, 5min TTL
}

export interface InferenceResult {
  entity_id:               string
  raw_score:               number
  calibrated_probability:  number | null
  expected_yield_pct:      number | null
  confidence_interval:     [number, number] | null
  model_version:           string
  inference_latency_ms:    number
  cache_hit:               boolean
  features_used:           Record<string, number>
  explanation:             Array<{ feature: string; contribution: number }>
}

// ---------------------------------------------------------------------------
// In-process cache (shared across requests within a worker)
// ---------------------------------------------------------------------------

interface CacheEntry {
  result:     InferenceResult
  expires_at: number   // epoch ms
}

const INFERENCE_CACHE = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 5 * 60 * 1000   // 5 minutes

function buildCacheKey(req: InferenceRequest): string {
  return `inf:${req.tenant_id}:${req.entity_type}:${req.entity_id}`
}

function getCachedResult(key: string): InferenceResult | null {
  const entry = INFERENCE_CACHE.get(key)
  if (!entry) return null
  if (Date.now() > entry.expires_at) {
    INFERENCE_CACHE.delete(key)
    return null
  }
  return entry.result
}

function setCachedResult(key: string, result: InferenceResult): void {
  INFERENCE_CACHE.set(key, {
    result,
    expires_at: Date.now() + CACHE_TTL_MS,
  })
}

// ---------------------------------------------------------------------------
// Feature contribution (SHAP-like approximation)
// Contribution_i = feature_value_normalised * weight_i / sum(|contributions|)
// When no trained weights are available we use a uniform distribution.
// ---------------------------------------------------------------------------

function computeFeatureContributions(
  featuresUsed: Record<string, number>,
  rawScore: number,
): Array<{ feature: string; contribution: number }> {
  const entries = Object.entries(featuresUsed)
  if (entries.length === 0) return []

  // Uniform weight approximation
  const totalAbsValue = entries.reduce((s, [, v]) => s + Math.abs(v), 0) || 1
  const contributions = entries.map(([feature, value]) => ({
    feature,
    contribution: Math.round(((Math.abs(value) / totalAbsValue) * rawScore) * 100) / 100,
  }))

  // Sort descending and return top 5
  return contributions
    .sort((a, b) => b.contribution - a.contribution)
    .slice(0, 5)
}

// ---------------------------------------------------------------------------
// persistPrediction (non-critical)
// ---------------------------------------------------------------------------

async function persistInferencePrediction(
  tenantId:  string,
  entityType: string,
  entityId:  string,
  result:    InferenceResult,
): Promise<void> {
  try {
    const { error } = await (supabaseAdmin as any)
      .from('ml_predictions')
      .insert({
        tenant_id:       tenantId,
        model_id:        null,   // no registry entry for online heuristic
        entity_type:     entityType,
        entity_id:       entityId,
        prediction_type: 'online_inference',
        score:           result.raw_score,
        confidence:      result.calibrated_probability,
        features_used:   result.features_used,
      })

    if (error) {
      log.error('[onlineInference] persistInferencePrediction — insert failed (non-critical)', undefined, {
        error: error.message,
        entity_id: entityId,
      })
    }
  } catch (err) {
    log.error('[onlineInference] persistInferencePrediction — unexpected error (non-critical)', err instanceof Error ? err : undefined, {
      error: err instanceof Error ? err.message : String(err),
      entity_id: entityId,
    })
  }
}

// ---------------------------------------------------------------------------
// tryPersistToDbCache (non-critical DB fallback cache)
// ---------------------------------------------------------------------------

async function tryPersistToDbCache(
  cacheKey: string,
  tenantId: string,
  result: InferenceResult,
): Promise<void> {
  try {
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString()
    const { error } = await (supabaseAdmin as any)
      .from('inference_cache')
      .upsert(
        {
          cache_key:  cacheKey,
          tenant_id:  tenantId,
          result:     JSON.stringify(result),
          expires_at: expiresAt,
        },
        { onConflict: 'cache_key' },
      )

    if (error) {
      log.error('[onlineInference] tryPersistToDbCache — upsert failed (non-critical)', undefined, {
        error: error.message,
        cache_key: cacheKey,
      })
    }
  } catch (err) {
    log.error('[onlineInference] tryPersistToDbCache — unexpected error (non-critical)', err instanceof Error ? err : undefined, {
      error: err instanceof Error ? err.message : String(err),
      cache_key: cacheKey,
    })
  }
}

// ---------------------------------------------------------------------------
// infer — single entity inference
// ---------------------------------------------------------------------------

export async function infer(request: InferenceRequest): Promise<InferenceResult> {
  const startMs = Date.now()
  const useCache = request.use_cache !== false

  const cacheKey = buildCacheKey(request)

  // 1. Check in-process cache
  if (useCache) {
    const cached = getCachedResult(cacheKey)
    if (cached !== null) {
      return { ...cached, cache_hit: true }
    }
  }

  // 2. Get latest features from feature store
  const featureVector = await getLatestFeatures(
    request.entity_type,
    request.entity_id,
    request.tenant_id,
  )

  // 3. Run scoring pipeline for properties; use feature-based heuristic for others
  let rawScore = 0
  let modelVersion = 'heuristic-v1'
  const featuresUsed: Record<string, number> = {}

  if (request.entity_type === 'property') {
    try {
      const pipelineOutput = await runScoringPipeline({
        propertyId: request.entity_id,
        tenantId:   request.tenant_id,
      })
      rawScore    = pipelineOutput.opportunity_score
      modelVersion = pipelineOutput.model_version

      // Extract numeric features for contribution analysis
      if (pipelineOutput.yield_prediction) {
        featuresUsed['estimated_yield_pct'] = pipelineOutput.yield_prediction.estimated_yield_pct
      }
      if (pipelineOutput.conversion_prediction) {
        featuresUsed['conversion_probability'] = pipelineOutput.conversion_prediction.probability * 100
      }
    } catch (err) {
      log.error('[onlineInference] infer — pipeline failed, using feature fallback', err instanceof Error ? err : undefined, {
        error: err instanceof Error ? err.message : String(err),
        entity_id: request.entity_id,
      })
    }
  }

  // Supplement features_used from the feature store snapshot
  if (featureVector) {
    for (const [k, v] of Object.entries(featureVector.features)) {
      if (typeof v === 'number' && isFinite(v) && !(k in featuresUsed)) {
        featuresUsed[k] = v
      }
    }

    // Heuristic fallback for non-property entities or failed pipeline
    if (rawScore === 0 && Object.keys(featuresUsed).length > 0) {
      const numericVals = Object.values(featuresUsed).filter(v => isFinite(v) && v >= 0 && v <= 100)
      if (numericVals.length > 0) {
        rawScore = Math.round(numericVals.reduce((s, v) => s + v, 0) / numericVals.length)
      }
    }
  }

  // Incorporate context overrides
  if (request.context) {
    for (const [k, v] of Object.entries(request.context)) {
      if (typeof v === 'number' && isFinite(v)) {
        featuresUsed[k] = v
      }
    }
  }

  // 4. Apply calibration
  let calibratedProbability: number | null = null
  let expectedYieldPct: number | null = null
  let confidenceInterval: [number, number] | null = null

  const calibModel = await getActiveCalibrationModel(
    request.tenant_id,
    request.entity_type,
    'conversion',
  )

  if (calibModel && calibModel.trained_on_n >= 50) {
    const normalizedScore = rawScore / 100
    const calibrated = calibrateScore(normalizedScore, calibModel)
    calibratedProbability = calibrated.calibrated_probability
    confidenceInterval    = calibrated.confidence_interval

    // Estimate expected yield using Portuguese market median
    const marketYieldPct = featuresUsed['estimated_yield_pct'] ?? 4.5
    expectedYieldPct = scoreToExpectedYield(normalizedScore, calibModel, marketYieldPct)
  }

  // 5. Compute feature contributions
  const explanation = computeFeatureContributions(featuresUsed, rawScore)

  const latencyMs = Date.now() - startMs

  const result: InferenceResult = {
    entity_id:              request.entity_id,
    raw_score:              rawScore,
    calibrated_probability: calibratedProbability,
    expected_yield_pct:     expectedYieldPct,
    confidence_interval:    confidenceInterval,
    model_version:          modelVersion,
    inference_latency_ms:   latencyMs,
    cache_hit:              false,
    features_used:          featuresUsed,
    explanation,
  }

  // 6. Persist prediction (non-critical, fire-and-forget)
  void persistInferencePrediction(
    request.tenant_id,
    request.entity_type,
    request.entity_id,
    result,
  )

  // 7. Cache result in-process
  if (useCache) {
    setCachedResult(cacheKey, result)
    // Also persist to DB cache as fallback (non-critical, fire-and-forget)
    void tryPersistToDbCache(cacheKey, request.tenant_id, result)
  }

  return result
}

// ---------------------------------------------------------------------------
// batchInfer — up to 100 entities in parallel
// ---------------------------------------------------------------------------

export async function batchInfer(
  requests: InferenceRequest[],
): Promise<InferenceResult[]> {
  if (requests.length === 0) return []

  // Cap at 100 per batch
  const capped = requests.slice(0, 100)

  // Run all in parallel — errors per-entity are isolated inside infer()
  const results = await Promise.all(capped.map(req => infer(req)))

  return results
}
