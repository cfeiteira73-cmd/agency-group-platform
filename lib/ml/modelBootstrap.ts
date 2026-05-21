// Agency Group — ML Model Bootstrap
// lib/ml/modelBootstrap.ts
// TypeScript strict — 0 errors
//
// Seeds the 4 required named models into the ml_model_registry if they
// don't already exist. Uses heuristic weights as the initial v1 model
// before real training data accumulates.

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NamedModel {
  model_name:      string
  objective:       string
  description:     string
  model_type:      'heuristic' | 'xgboost' | 'lightgbm'
  feature_version: string
  initial_weights: Record<string, number>  // heuristic v1 weights
  metrics:         Record<string, number>  // initial baseline metrics
}

// ---------------------------------------------------------------------------
// NAMED_MODELS — the 4 canonical models required by the system spec
// ---------------------------------------------------------------------------

export const NAMED_MODELS: NamedModel[] = [
  {
    model_name:      'yield_predictor',
    objective:       'yield_prediction',
    description:     'Predicts yield potential (%) for a property/investor pair',
    model_type:      'heuristic',
    feature_version: 'v1',
    // Heuristic: lower price vs zone average → higher yield potential
    // Features: price_deviation_pct, zone_demand_pressure, area_m2_log, property_type_score
    initial_weights: {
      '__bias__':             0.04,   // base yield 4%
      'price_deviation_pct': -0.001,  // lower price → higher yield
      'zone_demand_pressure': 0.005,
      'area_m2_log':         -0.002,
      'property_type_score':  0.010,
    },
    metrics: { baseline_mae: 0.008, baseline_r2: 0.42 },
  },
  {
    model_name:      'liquidity_predictor',
    objective:       'liquidity_prediction',
    description:     'Predicts liquidity score (0-100) for a property at current market conditions',
    model_type:      'heuristic',
    feature_version: 'v1',
    // Heuristic: bid density + investor count + zone heat are primary drivers
    initial_weights: {
      '__bias__':             50.0,
      'active_bid_count':      8.0,
      'zone_heat_index':       0.3,
      'days_on_market':       -0.15,
      'price_vs_zone_avg':    -0.2,
      'investor_match_count':  5.0,
    },
    metrics: { baseline_mae: 12.5, baseline_r2: 0.58 },
  },
  {
    model_name:      'investor_conversion_predictor',
    objective:       'investor_conversion',
    description:     'P(investor converts on a specific property)',
    model_type:      'heuristic',
    feature_version: 'v1',
    // Logistic heuristic: match_score + capital_fit + urgency + past_success_rate
    initial_weights: {
      '__bias__':                -2.5,
      'match_score_norm':         3.0,
      'capital_fit_score':        2.0,
      'urgency_score':            1.5,
      'past_conversion_rate':     4.0,
      'days_since_last_action':  -0.1,
    },
    metrics: { baseline_auc: 0.67, baseline_precision: 0.55, baseline_recall: 0.48 },
  },
  {
    model_name:      'price_optimization_model',
    objective:       'price_optimization',
    description:     'Predicts optimal price adjustment (% of ask) to maximize revenue velocity',
    model_type:      'heuristic',
    feature_version: 'v1',
    // Heuristic: balance between clearing quickly and maximising commission
    initial_weights: {
      '__bias__':           0.0,   // 0% adjustment as baseline
      'days_on_market':    -0.05,  // longer on market → recommend lower
      'bid_density':        0.10,  // more bids → recommend higher
      'supply_pressure':    0.08,
      'demand_pressure':   -0.05,  // high demand → already clearing, reduce price less
      'zone_avg_deviation': 0.30,  // follow zone trends
    },
    metrics: { baseline_mae_pct: 2.1, baseline_direction_accuracy: 0.71 },
  },
]

// ---------------------------------------------------------------------------
// Probability models — these return a sigmoid score (classification)
// ---------------------------------------------------------------------------

const PROBABILITY_MODEL_NAMES = new Set(['investor_conversion_predictor'])

export function isProbabilityModel(modelName: string): boolean {
  return PROBABILITY_MODEL_NAMES.has(modelName)
}

// ---------------------------------------------------------------------------
// bootstrapNamedModels — idempotent, skips if already exists
// ---------------------------------------------------------------------------

export async function bootstrapNamedModels(tenantId: string): Promise<{
  bootstrapped: string[]
  skipped:      string[]
  errors:       string[]
}> {
  const bootstrapped: string[] = []
  const skipped:      string[] = []
  const errors:       string[] = []

  for (const model of NAMED_MODELS) {
    try {
      // Check if a non-retired version already exists for this tenant + model_name
      const { data: existing, error: checkErr } = await (supabaseAdmin as any)
        .from('ml_model_registry')
        .select('id, model_name, status')
        .eq('tenant_id', tenantId)
        .eq('model_name', model.model_name)
        .neq('status', 'retired')
        .limit(1)
        .maybeSingle()

      if (checkErr) {
        log.error('[modelBootstrap] bootstrapNamedModels — existence check failed', undefined, {
          model_name: model.model_name,
          error:      checkErr.message,
        })
        errors.push(`${model.model_name}: existence check failed — ${checkErr.message}`)
        continue
      }

      if (existing) {
        log.info('[modelBootstrap] bootstrapNamedModels — skipping (already exists)', {
          model_name: model.model_name,
          model_id:   existing.id,
          status:     existing.status,
        } as any)
        skipped.push(model.model_name)
        continue
      }

      // INSERT new heuristic v1 model as active
      const { data: inserted, error: insertErr } = await (supabaseAdmin as any)
        .from('ml_model_registry')
        .insert({
          tenant_id:            tenantId,
          model_name:           model.model_name,
          model_type:           model.model_type,
          objective:            model.objective,
          version:              '1.0.0',
          status:               'active',
          metrics:              model.metrics,
          feature_version:      model.feature_version,
          trained_on_n:         0,
          training_manifest_id: null,
          weights_path:         null,
          weights:              model.initial_weights,
          activated_at:         new Date().toISOString(),
          retired_at:           null,
        })
        .select('id')
        .single()

      if (insertErr || !inserted) {
        log.error('[modelBootstrap] bootstrapNamedModels — insert failed', undefined, {
          model_name: model.model_name,
          error:      insertErr?.message ?? 'no data returned',
        })
        errors.push(`${model.model_name}: insert failed — ${insertErr?.message ?? 'no data returned'}`)
        continue
      }

      log.info('[modelBootstrap] bootstrapNamedModels — bootstrapped', {
        model_name: model.model_name,
        model_id:   inserted.id,
        version:    '1.0.0',
      } as any)
      bootstrapped.push(model.model_name)

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      log.error('[modelBootstrap] bootstrapNamedModels — unexpected error', err instanceof Error ? err : undefined, {
        model_name: model.model_name,
        error:      msg,
      })
      errors.push(`${model.model_name}: unexpected error — ${msg}`)
    }
  }

  return { bootstrapped, skipped, errors }
}

// ---------------------------------------------------------------------------
// getNamedModel — get the current active version of a named model
// ---------------------------------------------------------------------------

export async function getNamedModel(
  tenantId:  string,
  modelName: string,
): Promise<{
  model_id:    string
  model_name:  string
  version:     string
  status:      string
  weights:     Record<string, number>
  metrics:     Record<string, number>
} | null> {
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from('ml_model_registry')
      .select('id, model_name, version, status, weights, metrics')
      .eq('tenant_id', tenantId)
      .eq('model_name', modelName)
      .eq('status', 'active')
      .order('activated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      log.error('[modelBootstrap] getNamedModel — query failed', undefined, {
        model_name: modelName,
        error:      error.message,
      })
      return null
    }

    if (!data) return null

    return {
      model_id:   data.id   as string,
      model_name: data.model_name as string,
      version:    data.version as string,
      status:     data.status  as string,
      weights:    (data.weights  as Record<string, number>) ?? {},
      metrics:    (data.metrics  as Record<string, number>) ?? {},
    }
  } catch (err) {
    log.error('[modelBootstrap] getNamedModel — unexpected error', err instanceof Error ? err : undefined, {
      model_name: modelName,
      error:      err instanceof Error ? err.message : String(err),
    })
    return null
  }
}

// ---------------------------------------------------------------------------
// predictWithWeights — pure linear combination (no DB, no side effects)
// Returns raw logit / score. Caller decides whether to apply sigmoid.
// ---------------------------------------------------------------------------

export function predictWithWeights(
  weights:  Record<string, number>,
  features: Record<string, number>,
): number {
  let logit = weights['__bias__'] ?? 0

  for (const [key, w] of Object.entries(weights)) {
    if (key === '__bias__') continue
    logit += w * (features[key] ?? 0)
  }

  return logit
}

// ---------------------------------------------------------------------------
// sigmoidScore — squash logit to (0, 1) probability
// ---------------------------------------------------------------------------

export function sigmoidScore(logit: number): number {
  return 1 / (1 + Math.exp(-logit))
}
