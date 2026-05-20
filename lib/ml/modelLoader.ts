// Agency Group — ML Model Loader
// lib/ml/modelLoader.ts
// TypeScript strict — 0 errors
//
// Loads serialized models from file system or HTTP.
// When a trained model (XGBoost/LightGBM serialized as JSON weights) is available,
// this loader replaces the heuristic predictors without code changes.
// Trained models are stored as JSON feature weight files.

import { readFile } from 'fs/promises'
import { join } from 'path'

export interface TrainedModelWeights {
  model_name: string
  model_type: 'heuristic' | 'linear_regression' | 'gradient_boost_approx'
  objective: string
  version: string
  feature_names: string[]
  // For linear regression / gradient boost approx: coefficients
  coefficients?: Record<string, number>
  intercept?: number
  // For tree-based approximate: leaf values per feature range
  leaf_values?: Record<string, number[]>
  trained_at: string
  training_records: number
  validation_auc?: number
}

export interface ModelPrediction {
  score: number        // 0-100
  confidence: number   // 0-1
  model_version: string
  fallback_used: boolean   // true if heuristic was used instead of trained model
}

// ---------------------------------------------------------------------------
// In-memory model cache with TTL (1 hour)
// ---------------------------------------------------------------------------

const MODEL_CACHE_TTL_MS = 60 * 60 * 1000  // 1 hour

const modelCache = new Map<string, { weights: TrainedModelWeights; loadedAt: number }>()

// ---------------------------------------------------------------------------
// scoreWithWeights
// Score features using loaded model weights (linear approximation of trained model).
// For linear_regression / gradient_boost_approx: score = intercept + sum(coef * feature_value)
// Normalized to 0-100.
// ---------------------------------------------------------------------------

export function scoreWithWeights(
  features: Record<string, number | null>,
  weights: TrainedModelWeights,
): ModelPrediction {
  const confidence = weights.validation_auc ?? 0.6

  // Heuristic model: no scoring via weights — caller should use native heuristic
  if (weights.model_type === 'heuristic' || !weights.coefficients) {
    return {
      score:         50,
      confidence,
      model_version: weights.version,
      fallback_used: true,
    }
  }

  const intercept = weights.intercept ?? 0
  let rawScore = intercept

  for (const [featureName, coefficient] of Object.entries(weights.coefficients)) {
    const featureValue = features[featureName]
    if (featureValue !== null && featureValue !== undefined && !isNaN(featureValue)) {
      rawScore += coefficient * featureValue
    }
    // Missing features contribute 0 (implicitly already 0 from intercept-only path)
  }

  // Normalize raw score to 0-100
  // Sigmoid-like normalization: score = 100 / (1 + e^(-rawScore))
  const normalized = 100 / (1 + Math.exp(-rawScore))
  const score = Math.min(100, Math.max(0, Math.round(normalized)))

  return {
    score,
    confidence,
    model_version: weights.version,
    fallback_used: false,
  }
}

// ---------------------------------------------------------------------------
// loadModelWeights
// Load model weights from a JSON file.
// MODEL_WEIGHTS_DIR env var (default: ./model-weights/)
// Returns null (not throw) if file not found or malformed.
// ---------------------------------------------------------------------------

export async function loadModelWeights(modelName: string): Promise<TrainedModelWeights | null> {
  const weightsDir = process.env.MODEL_WEIGHTS_DIR ?? './model-weights'
  const filePath   = join(weightsDir, `${modelName}.json`)

  try {
    const raw  = await readFile(filePath, 'utf-8')
    const parsed = JSON.parse(raw) as TrainedModelWeights

    // Minimal validation
    if (!parsed.model_name || !parsed.model_type || !parsed.version) {
      console.error('[modelLoader] loadModelWeights — invalid model file (missing required fields):', filePath)
      return null
    }

    return parsed
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // ENOENT is expected when no trained model exists yet — only log at debug level
    if (msg.includes('ENOENT') || msg.includes('no such file')) {
      console.debug('[modelLoader] loadModelWeights — model file not found (heuristic will be used):', filePath)
    } else {
      console.error('[modelLoader] loadModelWeights — failed to load:', filePath, msg)
    }
    return null
  }
}

// ---------------------------------------------------------------------------
// getOrLoadModel
// Check in-memory cache (TTL 1h), otherwise call loadModelWeights.
// Returns null if no trained model file is available.
// ---------------------------------------------------------------------------

export async function getOrLoadModel(modelName: string): Promise<TrainedModelWeights | null> {
  const cached = modelCache.get(modelName)
  const now    = Date.now()

  if (cached && (now - cached.loadedAt) < MODEL_CACHE_TTL_MS) {
    return cached.weights
  }

  const weights = await loadModelWeights(modelName)
  if (weights !== null) {
    modelCache.set(modelName, { weights, loadedAt: now })
  }

  return weights
}
