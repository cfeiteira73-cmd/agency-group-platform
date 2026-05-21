// Agency Group — ML Model Registry
// lib/ml/modelRegistry.ts
// TypeScript strict — 0 errors
//
// Production model registry with full lifecycle management.
// Models progress: shadow → a_b_test → active → retired
// Weights stored in Supabase Storage: models/{tenant_id}/{model_id}/weights.json

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ModelStatus    = 'shadow' | 'a_b_test' | 'active' | 'retired'
export type ModelObjective = 'yield_prediction' | 'conversion_prediction' | 'time_to_close' | 'fraud_detection'

export interface ModelVersion {
  model_id:              string
  tenant_id:             string
  model_name:            string
  model_type:            'heuristic' | 'xgboost' | 'lightgbm' | 'neural' | 'ensemble'
  objective:             ModelObjective
  version:               string        // semver: '1.0.0', '1.1.0'
  status:                ModelStatus

  // Performance metrics (from validation set)
  metrics: {
    auc_roc?:           number
    precision?:         number
    recall?:            number
    f1?:                number
    mae?:               number   // for regression
    rmse?:              number
    calibration_error?: number
  }

  // Lineage
  training_manifest_id: string | null
  feature_version:      string
  trained_on_n:         number

  // Deployment
  weights_path:  string | null
  activated_at:  string | null
  retired_at:    string | null
  created_at:    string
}

// ---------------------------------------------------------------------------
// Row → ModelVersion mapping
// ---------------------------------------------------------------------------

function rowToModel(row: Record<string, unknown>): ModelVersion {
  return {
    model_id:             row['id'] as string,
    tenant_id:            row['tenant_id'] as string,
    model_name:           row['model_name'] as string,
    model_type:           row['model_type'] as ModelVersion['model_type'],
    objective:            row['objective'] as ModelObjective,
    version:              row['version'] as string,
    status:               row['status'] as ModelStatus,
    metrics:              (row['metrics'] as ModelVersion['metrics']) ?? {},
    training_manifest_id: (row['training_manifest_id'] as string | null) ?? null,
    feature_version:      (row['feature_version'] as string) ?? 'v1',
    trained_on_n:         (row['trained_on_n'] as number) ?? 0,
    weights_path:         (row['weights_path'] as string | null) ?? null,
    activated_at:         (row['activated_at'] as string | null) ?? null,
    retired_at:           (row['retired_at'] as string | null) ?? null,
    created_at:           row['created_at'] as string,
  }
}

// ---------------------------------------------------------------------------
// ModelRegistry class
// ---------------------------------------------------------------------------

export class ModelRegistry {

  // ── register ───────────────────────────────────────────────────────────────

  async register(model: Omit<ModelVersion, 'model_id' | 'created_at'>): Promise<ModelVersion> {
    const { data, error } = await (supabaseAdmin as any)
      .from('ml_model_registry')
      .insert({
        tenant_id:            model.tenant_id,
        model_name:           model.model_name,
        model_type:           model.model_type,
        objective:            model.objective,
        version:              model.version,
        status:               model.status,
        metrics:              model.metrics ?? {},
        feature_version:      model.feature_version,
        trained_on_n:         model.trained_on_n,
        training_manifest_id: model.training_manifest_id ?? null,
        weights_path:         model.weights_path ?? null,
        activated_at:         model.activated_at ?? null,
        retired_at:           model.retired_at   ?? null,
      })
      .select()
      .single()

    if (error || !data) {
      log.error('[modelRegistry] register — insert failed', undefined, { error: error?.message })
      throw new Error(`ModelRegistry.register failed: ${error?.message ?? 'no data'}`)
    }

    log.info('[modelRegistry] register — new model registered', {
      model_id:   data.id,
      model_name: model.model_name,
      version:    model.version,
      objective:  model.objective,
    } as any)

    return rowToModel(data)
  }

  // ── getActiveModel ─────────────────────────────────────────────────────────

  async getActiveModel(tenantId: string, objective: ModelObjective): Promise<ModelVersion | null> {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('ml_model_registry')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('objective', objective)
        .eq('status', 'active')
        .order('activated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        log.error('[modelRegistry] getActiveModel — query failed', undefined, { error: error.message })
        return null
      }

      return data ? rowToModel(data) : null
    } catch (err) {
      log.error('[modelRegistry] getActiveModel — unexpected error', err instanceof Error ? err : undefined, {
        error: err instanceof Error ? err.message : String(err),
      })
      return null
    }
  }

  // ── getShadowModel ─────────────────────────────────────────────────────────

  async getShadowModel(tenantId: string, objective: ModelObjective): Promise<ModelVersion | null> {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('ml_model_registry')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('objective', objective)
        .eq('status', 'shadow')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        log.error('[modelRegistry] getShadowModel — query failed', undefined, { error: error.message })
        return null
      }

      return data ? rowToModel(data) : null
    } catch (err) {
      log.error('[modelRegistry] getShadowModel — unexpected error', err instanceof Error ? err : undefined, {
        error: err instanceof Error ? err.message : String(err),
      })
      return null
    }
  }

  // ── promoteToActive ────────────────────────────────────────────────────────

  async promoteToActive(modelId: string, tenantId: string): Promise<void> {
    const now = new Date().toISOString()

    // Fetch target model to get objective
    const { data: targetModel, error: fetchErr } = await (supabaseAdmin as any)
      .from('ml_model_registry')
      .select('*')
      .eq('id', modelId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (fetchErr || !targetModel) {
      throw new Error(`promoteToActive: model ${modelId} not found — ${fetchErr?.message ?? 'no data'}`)
    }

    const objective = targetModel.objective as ModelObjective

    // Step 1: retire current active model
    const { error: retireErr } = await (supabaseAdmin as any)
      .from('ml_model_registry')
      .update({ status: 'retired', retired_at: now })
      .eq('tenant_id', tenantId)
      .eq('objective', objective)
      .eq('status', 'active')

    if (retireErr) {
      // Non-fatal: there may simply be no current active model
      log.warn('[modelRegistry] promoteToActive — retire current active failed (continuing)', {
        error:     retireErr.message,
        objective,
      } as any)
    }

    // Step 2: promote target model
    const { error: promoteErr } = await (supabaseAdmin as any)
      .from('ml_model_registry')
      .update({ status: 'active', activated_at: now })
      .eq('id', modelId)

    if (promoteErr) {
      throw new Error(`promoteToActive: update failed — ${promoteErr.message}`)
    }

    // Step 3: emit governance event
    await this._emitGovernanceEvent('model.promoted', {
      model_id:   modelId,
      tenant_id:  tenantId,
      objective,
      activated_at: now,
    })

    log.info('[modelRegistry] promoteToActive — done', {
      model_id:  modelId,
      objective,
      activated_at: now,
    } as any)
  }

  // ── demoteToShadow ─────────────────────────────────────────────────────────

  async demoteToShadow(modelId: string): Promise<void> {
    const { error } = await (supabaseAdmin as any)
      .from('ml_model_registry')
      .update({ status: 'shadow', activated_at: null })
      .eq('id', modelId)

    if (error) {
      throw new Error(`demoteToShadow failed: ${error.message}`)
    }

    log.info('[modelRegistry] demoteToShadow — done', { model_id: modelId } as any)
  }

  // ── retireModel ────────────────────────────────────────────────────────────

  async retireModel(modelId: string, reason: string): Promise<void> {
    const now = new Date().toISOString()

    const { error } = await (supabaseAdmin as any)
      .from('ml_model_registry')
      .update({ status: 'retired', retired_at: now })
      .eq('id', modelId)

    if (error) {
      throw new Error(`retireModel failed: ${error.message}`)
    }

    log.info('[modelRegistry] retireModel — done', {
      model_id: modelId,
      reason,
      retired_at: now,
    } as any)
  }

  // ── getVersionHistory ──────────────────────────────────────────────────────

  async getVersionHistory(tenantId: string, objective: ModelObjective): Promise<ModelVersion[]> {
    try {
      const { data, error } = await (supabaseAdmin as any)
        .from('ml_model_registry')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('objective', objective)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) {
        log.error('[modelRegistry] getVersionHistory — query failed', undefined, { error: error.message })
        return []
      }

      return (data ?? []).map(rowToModel)
    } catch (err) {
      log.error('[modelRegistry] getVersionHistory — unexpected error', err instanceof Error ? err : undefined, {
        error: err instanceof Error ? err.message : String(err),
      })
      return []
    }
  }

  // ── saveWeights ────────────────────────────────────────────────────────────

  async saveWeights(modelId: string, weights: Record<string, unknown>): Promise<string> {
    // Fetch model to get tenant_id
    const { data: model, error: fetchErr } = await (supabaseAdmin as any)
      .from('ml_model_registry')
      .select('tenant_id')
      .eq('id', modelId)
      .maybeSingle()

    if (fetchErr || !model) {
      throw new Error(`saveWeights: model ${modelId} not found — ${fetchErr?.message ?? 'no data'}`)
    }

    const path        = `models/${model.tenant_id}/${modelId}/weights.json`
    const jsonBytes   = new TextEncoder().encode(JSON.stringify(weights, null, 2))

    const { error: uploadErr } = await (supabaseAdmin as any).storage
      .from('ml-models')
      .upload(path, jsonBytes, {
        contentType:  'application/json',
        cacheControl: '3600',
        upsert:       true,
      })

    if (uploadErr) {
      throw new Error(`saveWeights: upload failed — ${uploadErr.message}`)
    }

    // Update registry row with weights_path
    const { error: updateErr } = await (supabaseAdmin as any)
      .from('ml_model_registry')
      .update({ weights_path: path })
      .eq('id', modelId)

    if (updateErr) {
      log.warn('[modelRegistry] saveWeights — weights_path update failed (non-critical)', {
        model_id: modelId,
        error:    updateErr.message,
      } as any)
    }

    log.info('[modelRegistry] saveWeights — weights saved', { model_id: modelId, path } as any)
    return path
  }

  // ── loadWeights ────────────────────────────────────────────────────────────

  async loadWeights(modelId: string): Promise<Record<string, unknown> | null> {
    try {
      const { data: model, error: fetchErr } = await (supabaseAdmin as any)
        .from('ml_model_registry')
        .select('weights_path, weights')
        .eq('id', modelId)
        .maybeSingle()

      if (fetchErr || !model) return null

      // Prefer Storage path if available
      if (model.weights_path) {
        const { data, error } = await (supabaseAdmin as any).storage
          .from('ml-models')
          .download(model.weights_path)

        if (error || !data) {
          log.warn('[modelRegistry] loadWeights — storage download failed, falling back to DB weights', {
            model_id: modelId,
            error:    error?.message,
          } as any)
        } else {
          const text = await (data as Blob).text()
          return JSON.parse(text) as Record<string, unknown>
        }
      }

      // Fall back to inline weights column (legacy)
      if (model.weights) {
        return model.weights as Record<string, unknown>
      }

      return null
    } catch (err) {
      log.error('[modelRegistry] loadWeights — unexpected error', err instanceof Error ? err : undefined, {
        model_id: modelId,
        error:    err instanceof Error ? err.message : String(err),
      })
      return null
    }
  }

  // ── _emitGovernanceEvent ───────────────────────────────────────────────────

  private async _emitGovernanceEvent(
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<void> {
    try {
      await (supabaseAdmin as any)
        .from('governance_decisions')
        .insert({
          action_type:      eventType,
          governance_class: 'routine',
          decision:         'approved',
          payload,
          decided_at:       new Date().toISOString(),
        })
    } catch (err) {
      // Governance events are non-fatal
      log.warn('[modelRegistry] _emitGovernanceEvent — failed (non-critical)', {
        event_type: eventType,
        error:      err instanceof Error ? err.message : String(err),
      } as any)
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

export const modelRegistry = new ModelRegistry()
