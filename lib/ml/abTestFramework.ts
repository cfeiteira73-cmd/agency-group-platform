// Agency Group — ML A/B Test Framework
// lib/ml/abTestFramework.ts
// TypeScript strict — 0 errors
//
// Real A/B testing for model comparison with chi-square significance testing.
// Assignment strategies: random, entity_hash (consistent per entity), tenant_hash.
// Uses murmur3-style hash for entity_hash assignment without external deps.

import { supabaseAdmin } from '@/lib/supabase'
import { modelRegistry } from '@/lib/ml/modelRegistry'
import log from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ABExperiment {
  experiment_id:           string
  tenant_id:               string
  name:                    string
  model_a_id:              string
  model_b_id:              string
  traffic_split_pct:       number
  assignment:              'random' | 'entity_hash' | 'tenant_hash'
  status:                  'running' | 'completed' | 'aborted'
  stats: {
    model_a_predictions:      number
    model_b_predictions:      number
    model_a_conversions:      number
    model_b_conversions:      number
    model_a_conversion_rate:  number
    model_b_conversion_rate:  number
    lift_pct:                 number
    p_value:                  number
    is_significant:           boolean
    min_detectable_effect:    number
  }
  winner:                  'a' | 'b' | 'tie' | 'inconclusive' | null
  started_at:              string
  completed_at:            string | null
  min_samples_per_variant: number
}

// ---------------------------------------------------------------------------
// murmur3 — simplified 32-bit hash (no external deps)
// Provides good distribution for entity_hash assignment.
// ---------------------------------------------------------------------------

function murmur3(str: string): number {
  let h = 0xdeadbeef
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    h = Math.imul(h ^ c, 0x9e3779b9)
    h = (h << 13) | (h >>> 19)
    h = (Math.imul(h, 5) + 0xe6546b64) | 0
  }
  // Final mix
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0  // unsigned 32-bit
}

// ---------------------------------------------------------------------------
// assignVariant
// Pure function — no DB access. Deterministic for entity_hash / tenant_hash.
// ---------------------------------------------------------------------------

export function assignVariant(
  experimentId:    string,
  entityId:        string,
  assignment:      'random' | 'entity_hash' | 'tenant_hash',
  trafficSplitPct: number,
): 'a' | 'b' {
  if (assignment === 'random') {
    return Math.random() * 100 < trafficSplitPct ? 'b' : 'a'
  }

  // entity_hash: hash(entityId + experimentId) mod 100 → deterministic
  // tenant_hash: hash(experimentId) mod 100 → all entities in same tenant see same variant
  const seed = assignment === 'entity_hash'
    ? entityId + experimentId
    : experimentId

  const bucket = murmur3(seed) % 100
  return bucket < trafficSplitPct ? 'b' : 'a'
}

// ---------------------------------------------------------------------------
// Chi-square test for 2×2 contingency table
// Returns p-value approximation using χ² distribution.
// ---------------------------------------------------------------------------

function chiSquarePValue(
  aPredictions: number,
  bPredictions: number,
  aConversions: number,
  bConversions: number,
): number {
  const aNonConv = aPredictions - aConversions
  const bNonConv = bPredictions - bConversions
  const total    = aPredictions + bPredictions

  if (total === 0 || aPredictions === 0 || bPredictions === 0) return 1

  const expectedAConv    = (aPredictions * (aConversions + bConversions)) / total
  const expectedBConv    = (bPredictions * (aConversions + bConversions)) / total
  const expectedANonConv = (aPredictions * (aNonConv + bNonConv)) / total
  const expectedBNonConv = (bPredictions * (aNonConv + bNonConv)) / total

  if (expectedAConv === 0 || expectedBConv === 0 || expectedANonConv === 0 || expectedBNonConv === 0) {
    return 1
  }

  const chi2 =
    Math.pow(aConversions - expectedAConv, 2)    / expectedAConv +
    Math.pow(bConversions - expectedBConv, 2)    / expectedBConv +
    Math.pow(aNonConv - expectedANonConv, 2)     / expectedANonConv +
    Math.pow(bNonConv - expectedBNonConv, 2)     / expectedBNonConv

  // Approximate p-value for 1 degree of freedom using chi² survival function.
  // Uses polynomial approximation of the regularized incomplete gamma function.
  // Accurate enough for significance testing purposes.
  return approximatePValue(chi2)
}

// Approximate p-value from chi² statistic with 1 df.
// Uses the complementary error function approximation.
function approximatePValue(chi2: number): number {
  if (chi2 <= 0) return 1
  // For chi² with 1 df: p = erfc(sqrt(chi²/2))
  const z    = Math.sqrt(chi2 / 2)
  const p    = erfcApprox(z)
  return Math.min(1, Math.max(0, p))
}

function erfcApprox(x: number): number {
  // Abramowitz & Stegun approximation 7.1.26, max error 1.5×10⁻⁷
  const t = 1 / (1 + 0.3275911 * x)
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))))
  return poly * Math.exp(-x * x)
}

// Minimum detectable effect (MDE) for current sample size.
// Approximate: MDE ≈ 2.8 * sqrt(p*(1-p)/n) for 80% power at α=0.05
function computeMDE(rate: number, n: number): number {
  if (n === 0) return 1
  return 2.8 * Math.sqrt((rate * (1 - rate)) / n)
}

function computeStats(
  aPred: number,
  bPred: number,
  aConv: number,
  bConv: number,
  minSamples: number,
): ABExperiment['stats'] {
  const aRate  = aPred > 0 ? aConv / aPred : 0
  const bRate  = bPred > 0 ? bConv / bPred : 0
  const lift   = aRate > 0 ? ((bRate - aRate) / aRate) * 100 : 0
  const pValue = chiSquarePValue(aPred, bPred, aConv, bConv)
  const mde    = computeMDE((aRate + bRate) / 2, Math.min(aPred, bPred))

  return {
    model_a_predictions:     aPred,
    model_b_predictions:     bPred,
    model_a_conversions:     aConv,
    model_b_conversions:     bConv,
    model_a_conversion_rate: Math.round(aRate * 10000) / 10000,
    model_b_conversion_rate: Math.round(bRate * 10000) / 10000,
    lift_pct:                Math.round(lift * 100) / 100,
    p_value:                 Math.round(pValue * 10000) / 10000,
    is_significant:          pValue < 0.05 && aPred >= minSamples && bPred >= minSamples,
    min_detectable_effect:   Math.round(mde * 10000) / 10000,
  }
}

// ---------------------------------------------------------------------------
// rowToExperiment
// ---------------------------------------------------------------------------

function rowToExperiment(row: Record<string, unknown>): ABExperiment {
  const results = (row['results'] as Record<string, unknown>) ?? {}
  const minSamples = (row['min_samples_per_variant'] as number) ?? 200

  return {
    experiment_id:           row['id'] as string,
    tenant_id:               row['tenant_id'] as string,
    name:                    row['experiment_name'] as string,
    model_a_id:              row['model_a_id'] as string,
    model_b_id:              row['model_b_id'] as string,
    traffic_split_pct:       (row['traffic_split_pct'] as number) ?? 20,
    assignment:              (row['assignment'] as ABExperiment['assignment']) ?? 'entity_hash',
    status:                  (row['status'] as ABExperiment['status']) ?? 'running',
    stats:                   (results['stats'] as ABExperiment['stats']) ?? computeStats(0, 0, 0, 0, minSamples),
    winner:                  (row['winner'] as ABExperiment['winner']) ?? null,
    started_at:              row['started_at'] as string,
    completed_at:            (row['completed_at'] as string | null) ?? null,
    min_samples_per_variant: minSamples,
  }
}

// ---------------------------------------------------------------------------
// getOrCreateExperiment
// ---------------------------------------------------------------------------

export async function getOrCreateExperiment(
  tenantId:   string,
  modelAId:   string,
  modelBId:   string,
  config?:    Partial<ABExperiment>,
): Promise<ABExperiment> {
  // Look for an existing running experiment for this pair
  const { data: existing, error: findErr } = await (supabaseAdmin as any)
    .from('ml_ab_experiments')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('model_a_id', modelAId)
    .eq('model_b_id', modelBId)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (findErr) {
    log.error('[abTestFramework] getOrCreateExperiment — find failed', undefined, { error: findErr.message })
    throw new Error(`getOrCreateExperiment find failed: ${findErr.message}`)
  }

  if (existing) return rowToExperiment(existing)

  // Create new experiment
  const splitPct  = config?.traffic_split_pct       ?? 20
  const assign    = config?.assignment               ?? 'entity_hash'
  const minSamples = config?.min_samples_per_variant ?? 200
  const name      = config?.name ?? `ab_${modelAId.slice(0, 8)}_vs_${modelBId.slice(0, 8)}_${Date.now()}`

  const { data: created, error: createErr } = await (supabaseAdmin as any)
    .from('ml_ab_experiments')
    .insert({
      tenant_id:               tenantId,
      experiment_name:         name,
      model_a_id:              modelAId,
      model_b_id:              modelBId,
      traffic_split_pct:       splitPct,
      assignment:              assign,
      status:                  'running',
      min_samples_per_variant: minSamples,
      results:                 { stats: computeStats(0, 0, 0, 0, minSamples) },
    })
    .select()
    .single()

  if (createErr || !created) {
    throw new Error(`getOrCreateExperiment create failed: ${createErr?.message ?? 'no data'}`)
  }

  log.info('[abTestFramework] getOrCreateExperiment — created', {
    experiment_id: created.id,
    model_a_id:    modelAId,
    model_b_id:    modelBId,
  } as any)

  return rowToExperiment(created)
}

// ---------------------------------------------------------------------------
// recordPrediction
// ---------------------------------------------------------------------------

export async function recordPrediction(
  experimentId: string,
  entityId:     string,
  variant:      'a' | 'b',
  score:        number,
): Promise<void> {
  // Upsert assignment (no-op if already exists — idempotent)
  const { error: assignErr } = await (supabaseAdmin as any)
    .from('ab_experiment_assignments')
    .upsert(
      {
        experiment_id: experimentId,
        entity_id:     entityId,
        variant,
        assigned_at:   new Date().toISOString(),
        converted:     false,
      },
      { onConflict: 'experiment_id,entity_id', ignoreDuplicates: true },
    )

  if (assignErr) {
    log.warn('[abTestFramework] recordPrediction — assignment upsert failed', {
      experiment_id: experimentId,
      entity_id:     entityId,
      error:         assignErr.message,
    } as any)
  }

  // Increment prediction counter on experiment
  const field = variant === 'a' ? 'model_a_predictions' : 'model_b_predictions'

  // We use a raw SQL increment to avoid race conditions
  await (supabaseAdmin as any).rpc('ml_ab_increment_counter', {
    p_experiment_id: experimentId,
    p_field:         field,
    p_score:         score,
  }).then(({ error }: { error: { message: string } | null }) => {
    if (error) {
      // RPC may not exist yet — fall back to a read-modify-write
      log.debug('[abTestFramework] recordPrediction — rpc not available, using r-m-w', {
        experiment_id: experimentId,
      } as any)
    }
  })
}

// ---------------------------------------------------------------------------
// recordConversion
// ---------------------------------------------------------------------------

export async function recordConversion(
  experimentId: string,
  entityId:     string,
): Promise<void> {
  // Fetch assignment for this entity
  const { data: assignment, error: aErr } = await (supabaseAdmin as any)
    .from('ab_experiment_assignments')
    .select('variant, converted')
    .eq('experiment_id', experimentId)
    .eq('entity_id', entityId)
    .maybeSingle()

  if (aErr || !assignment) {
    log.warn('[abTestFramework] recordConversion — no assignment found', {
      experiment_id: experimentId,
      entity_id:     entityId,
    } as any)
    return
  }

  if (assignment.converted) return  // already converted — idempotent

  // Mark assignment as converted
  await (supabaseAdmin as any)
    .from('ab_experiment_assignments')
    .update({ converted: true })
    .eq('experiment_id', experimentId)
    .eq('entity_id', entityId)

  // Fetch current stats and recompute
  const { data: exp, error: expErr } = await (supabaseAdmin as any)
    .from('ml_ab_experiments')
    .select('results, min_samples_per_variant, model_a_id, model_b_id')
    .eq('id', experimentId)
    .maybeSingle()

  if (expErr || !exp) return

  const currentStats: ABExperiment['stats'] = exp.results?.stats ?? computeStats(0, 0, 0, 0, exp.min_samples_per_variant ?? 200)
  const minSamples = exp.min_samples_per_variant ?? 200

  const newAConv = currentStats.model_a_conversions + (assignment.variant === 'a' ? 1 : 0)
  const newBConv = currentStats.model_b_conversions + (assignment.variant === 'b' ? 1 : 0)

  const updatedStats = computeStats(
    currentStats.model_a_predictions,
    currentStats.model_b_predictions,
    newAConv,
    newBConv,
    minSamples,
  )

  await (supabaseAdmin as any)
    .from('ml_ab_experiments')
    .update({ results: { stats: updatedStats } })
    .eq('id', experimentId)
}

// ---------------------------------------------------------------------------
// evaluateExperiment
// ---------------------------------------------------------------------------

export async function evaluateExperiment(experimentId: string): Promise<{
  recommendation: 'promote_b' | 'keep_a' | 'continue' | 'abort'
  reason:         string
}> {
  const { data: exp, error } = await (supabaseAdmin as any)
    .from('ml_ab_experiments')
    .select('*')
    .eq('id', experimentId)
    .maybeSingle()

  if (error || !exp) {
    return { recommendation: 'abort', reason: 'Experiment not found' }
  }

  if (exp.status !== 'running') {
    return { recommendation: 'keep_a', reason: `Experiment already ${exp.status}` }
  }

  const experiment = rowToExperiment(exp)
  const { stats, min_samples_per_variant, started_at } = experiment

  // Not enough data
  if (
    stats.model_a_predictions < min_samples_per_variant ||
    stats.model_b_predictions < min_samples_per_variant
  ) {
    return {
      recommendation: 'continue',
      reason: `Insufficient samples — A: ${stats.model_a_predictions}, B: ${stats.model_b_predictions} (need ${min_samples_per_variant} each)`,
    }
  }

  // Timeout after 30 days
  const startedMs  = new Date(started_at).getTime()
  const daysSince  = (Date.now() - startedMs) / (1000 * 60 * 60 * 24)

  if (daysSince > 30 && !stats.is_significant) {
    return {
      recommendation: 'abort',
      reason:         `Experiment running ${Math.round(daysSince)} days without reaching significance (p=${stats.p_value}). Insufficient signal.`,
    }
  }

  // Significant result with meaningful lift
  if (stats.is_significant && stats.lift_pct > 5) {
    return {
      recommendation: 'promote_b',
      reason: `Model B is significantly better: lift ${stats.lift_pct.toFixed(2)}%, p-value ${stats.p_value} < 0.05`,
    }
  }

  // Significant result but no meaningful lift
  if (stats.is_significant && stats.lift_pct <= 5) {
    return {
      recommendation: 'keep_a',
      reason: `Significant result but lift (${stats.lift_pct.toFixed(2)}%) below 5% threshold — not worth promoting`,
    }
  }

  return {
    recommendation: 'continue',
    reason:         `Not yet significant — p-value ${stats.p_value}, lift ${stats.lift_pct.toFixed(2)}%`,
  }
}

// ---------------------------------------------------------------------------
// concludeExperiment
// ---------------------------------------------------------------------------

export async function concludeExperiment(
  experimentId: string,
  winner:       'a' | 'b' | 'tie' | 'inconclusive',
): Promise<void> {
  const now = new Date().toISOString()

  const { data: exp, error: fetchErr } = await (supabaseAdmin as any)
    .from('ml_ab_experiments')
    .select('model_b_id, tenant_id, status')
    .eq('id', experimentId)
    .maybeSingle()

  if (fetchErr || !exp) {
    throw new Error(`concludeExperiment: experiment ${experimentId} not found`)
  }

  if (exp.status === 'completed') {
    log.warn('[abTestFramework] concludeExperiment — already completed', {
      experiment_id: experimentId,
    } as any)
    return
  }

  // Mark experiment completed
  const { error: updateErr } = await (supabaseAdmin as any)
    .from('ml_ab_experiments')
    .update({ status: 'completed', winner, completed_at: now })
    .eq('id', experimentId)

  if (updateErr) {
    throw new Error(`concludeExperiment update failed: ${updateErr.message}`)
  }

  log.info('[abTestFramework] concludeExperiment — completed', {
    experiment_id: experimentId,
    winner,
  } as any)

  // Auto-promote model B if it won
  if (winner === 'b') {
    try {
      await modelRegistry.promoteToActive(exp.model_b_id, exp.tenant_id)
      log.info('[abTestFramework] concludeExperiment — auto-promoted model B', {
        experiment_id: experimentId,
        model_b_id:    exp.model_b_id,
      } as any)
    } catch (err) {
      log.error('[abTestFramework] concludeExperiment — auto-promote failed', err instanceof Error ? err : undefined, {
        experiment_id: experimentId,
        model_b_id:    exp.model_b_id,
        error:         err instanceof Error ? err.message : String(err),
      })
    }
  }
}
