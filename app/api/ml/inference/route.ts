// Agency Group — ML Named Model Inference
// app/api/ml/inference/route.ts
// Auth: portal auth (NextAuth / magic-link / service token)
// TypeScript strict — 0 errors
//
// POST /api/ml/inference
//   Run inference against one of the 4 named ML models using pre-computed
//   feature values. Returns raw score / probability + confidence tier.

import { NextRequest, NextResponse } from 'next/server'
import { requirePortalAuth } from '@/lib/requirePortalAuth'
import { getTenantId }       from '@/lib/tenant'
import {
  getNamedModel,
  predictWithWeights,
  sigmoidScore,
  isProbabilityModel,
  NAMED_MODELS,
} from '@/lib/ml/modelBootstrap'
import log from '@/lib/logger'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export const dynamic     = 'force-dynamic'
export const runtime     = 'nodejs'
export const maxDuration = 10

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const VALID_MODEL_NAMES = new Set(NAMED_MODELS.map(m => m.model_name))

type ConfidenceTier = 'high' | 'medium' | 'low'

function computeConfidence(probability: number): ConfidenceTier {
  if (probability >= 0.7) return 'high'
  if (probability >= 0.4) return 'medium'
  return 'low'
}

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

interface InferenceRequestBody {
  model_name:   string
  features:     Record<string, number>
  investor_id?: string
  property_id?: string
}

interface InferenceResponse {
  model_name:    string
  prediction:    number          // raw score / logit
  probability:   number | null   // sigmoid for classification models, null for regression
  confidence:    ConfidenceTier  // 'high' | 'medium' | 'low'
  model_version: string
  weights_used:  boolean         // true = DB weights, false = heuristic fallback
}

// ---------------------------------------------------------------------------
// POST /api/ml/inference
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // ── Auth ───────────────────────────────────────────────────────────────────
  const auth = await requirePortalAuth(req)
  if (!auth.ok) return auth.response

  const tenantId = await getTenantId(req)

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body: Partial<InferenceRequestBody>
  try {
    body = (await req.json()) as Partial<InferenceRequestBody>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { model_name, features, investor_id, property_id } = body

  // ── Validate model_name ────────────────────────────────────────────────────
  if (!model_name || typeof model_name !== 'string') {
    return NextResponse.json(
      { error: 'model_name is required' },
      { status: 400 },
    )
  }

  if (!VALID_MODEL_NAMES.has(model_name)) {
    return NextResponse.json(
      {
        error:        `Invalid model_name. Must be one of: ${Array.from(VALID_MODEL_NAMES).join(', ')}`,
        valid_models: Array.from(VALID_MODEL_NAMES),
      },
      { status: 400 },
    )
  }

  // ── Validate features ──────────────────────────────────────────────────────
  if (!features || typeof features !== 'object' || Array.isArray(features)) {
    return NextResponse.json(
      { error: 'features must be a non-null object of { featureName: number }' },
      { status: 400 },
    )
  }

  // ── Resolve weights (DB → heuristic fallback) ──────────────────────────────
  let weights:     Record<string, number>
  let modelVersion = '1.0.0'
  let weightsUsed  = false

  try {
    const namedModel = await getNamedModel(tenantId, model_name)

    if (namedModel && Object.keys(namedModel.weights).length > 0) {
      weights      = namedModel.weights
      modelVersion = namedModel.version
      weightsUsed  = true
    } else {
      // Fallback to hardcoded heuristic weights
      const spec = NAMED_MODELS.find(m => m.model_name === model_name)
      weights = spec?.initial_weights ?? {}

      log.warn('[ml/inference] getNamedModel returned null — using heuristic fallback', {
        model_name,
        tenant_id: tenantId,
      } as any)
    }
  } catch (err) {
    // Non-fatal: fall back to heuristic
    const spec = NAMED_MODELS.find(m => m.model_name === model_name)
    weights = spec?.initial_weights ?? {}

    log.error('[ml/inference] getNamedModel threw — using heuristic fallback', err instanceof Error ? err : undefined, {
      model_name,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  // ── Run inference ──────────────────────────────────────────────────────────
  const prediction = predictWithWeights(weights, features)

  // Classification models get sigmoid; regression models return raw score
  const isClassification = isProbabilityModel(model_name)
  const probability      = isClassification ? sigmoidScore(prediction) : null
  const confidence       = isClassification && probability !== null
    ? computeConfidence(probability)
    : (prediction >= 0.7 ? 'high' : prediction >= 0.4 ? 'medium' : 'low') as ConfidenceTier

  // ── Structured log ─────────────────────────────────────────────────────────
  log.info('[ml/inference] inference complete', {
    model_name,
    model_version:  modelVersion,
    weights_used:   weightsUsed,
    prediction:     Math.round(prediction * 10000) / 10000,
    probability:    probability !== null ? Math.round(probability * 10000) / 10000 : null,
    confidence,
    investor_id:    investor_id ?? null,
    property_id:    property_id ?? null,
  } as any)

  const result: InferenceResponse = {
    model_name,
    prediction,
    probability,
    confidence,
    model_version: modelVersion,
    weights_used:  weightsUsed,
  }

  return NextResponse.json(result)
}
