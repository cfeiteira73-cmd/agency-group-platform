// =============================================================================
// Agency Group — Feature Flag System
// lib/ops/featureFlags.ts
//
// Phase 8: Feature Flag / Safety Control System
//
// Provides global kill-switches, subsystem flags, gradual rollout support,
// and canary mode. This is the production safety layer — critical for launch.
//
// FLAG TYPES:
//   kill_switch — disables an entire subsystem immediately
//   regular     — feature toggle with optional rollout_pct
//   canary      — routes X% of traffic to experimental behavior
//
// EVALUATION ORDER:
//   1. Kill switches take absolute priority (if disabled → FALSE always)
//   2. Expired flags return FALSE
//   3. Rollout_pct applies stochastic gating (hash-based, deterministic)
//
// PURE FUNCTIONS:
//   evaluateFlag, isFlagEnabled, buildFlagPayload, hashForRollout
//
// DB FUNCTIONS:
//   getFlag, getAllFlags, enableFlag, disableFlag, isEnabled, setFlagConfig
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FlagScope = 'global' | 'subsystem' | 'zone' | 'tier'

export interface FeatureFlag {
  id:             string
  flag_key:       string
  flag_name:      string
  description?:   string | null
  flag_scope:     FlagScope
  subsystem?:     string | null
  is_enabled:     boolean
  rollout_pct:    number
  config:         Record<string, unknown>
  is_kill_switch: boolean
  is_canary:      boolean
  enabled_by?:    string | null
  enabled_at?:    string | null
  disabled_by?:   string | null
  disabled_at?:   string | null
  expires_at?:    string | null
  created_at:     string
  updated_at:     string
}

export interface FlagPayload {
  flag_key:       string
  flag_name:      string
  description?:   string
  flag_scope:     FlagScope
  subsystem?:     string
  is_enabled:     boolean
  rollout_pct:    number
  config:         Record<string, unknown>
  is_kill_switch: boolean
  is_canary:      boolean
  expires_at?:    string
}

export interface FlagEvaluationContext {
  recipient_email?: string   // for deterministic rollout bucketing
  zone_key?:        string
  tier?:            string
}

// ---------------------------------------------------------------------------
// PURE: Simple hash-based rollout bucketing (deterministic, 0-99)
// Given the same key + context, always returns the same bucket
// ---------------------------------------------------------------------------

export function hashForRollout(flagKey: string, contextKey: string): number {
  const combined = `${flagKey}:${contextKey}`
  let hash = 0
  for (let i = 0; i < combined.length; i++) {
    hash = ((hash << 5) - hash) + combined.charCodeAt(i)
    hash |= 0  // convert to 32-bit integer
  }
  return Math.abs(hash) % 100
}

// ---------------------------------------------------------------------------
// PURE: Evaluate a single flag for a given context
// ---------------------------------------------------------------------------

export function evaluateFlag(
  flag:     FeatureFlag,
  context?: FlagEvaluationContext,
): boolean {
  // Expired flag = disabled
  if (flag.expires_at && new Date(flag.expires_at) <= new Date()) return false

  // Not enabled at all
  if (!flag.is_enabled) return false

  // Full rollout
  if (flag.rollout_pct >= 100) return true

  // Partial rollout — use deterministic hash bucketing
  const contextKey = context?.recipient_email ?? context?.zone_key ?? 'default'
  const bucket     = hashForRollout(flag.flag_key, contextKey)
  return bucket < flag.rollout_pct
}

// ---------------------------------------------------------------------------
// PURE: Check if a flag key is enabled in a collection of flags
// ---------------------------------------------------------------------------

export function isFlagEnabled(
  flags:   FeatureFlag[],
  key:     string,
  context?: FlagEvaluationContext,
): boolean {
  const flag = flags.find(f => f.flag_key === key)
  if (!flag) return false
  return evaluateFlag(flag, context)
}

// ---------------------------------------------------------------------------
// PURE: Build a flag payload for creation
// ---------------------------------------------------------------------------

export function buildFlagPayload(
  flagKey:  string,
  flagName: string,
  opts: {
    description?:  string
    scope?:        FlagScope
    subsystem?:    string
    isEnabled?:    boolean
    rolloutPct?:   number
    config?:       Record<string, unknown>
    isKillSwitch?: boolean
    isCanary?:     boolean
    expiresAt?:    string
  } = {},
): FlagPayload {
  return {
    flag_key:       flagKey,
    flag_name:      flagName,
    description:    opts.description,
    flag_scope:     opts.scope ?? 'global',
    subsystem:      opts.subsystem,
    is_enabled:     opts.isEnabled ?? false,
    rollout_pct:    opts.rolloutPct ?? 100,
    config:         opts.config ?? {},
    is_kill_switch: opts.isKillSwitch ?? false,
    is_canary:      opts.isCanary ?? false,
    expires_at:     opts.expiresAt,
  }
}

// ---------------------------------------------------------------------------
// DB: Get a single flag by key
// ---------------------------------------------------------------------------

export async function getFlag(key: string): Promise<FeatureFlag | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('feature_flags')
    .select('*')
    .eq('flag_key', key)
    .single()

  if (error) return null
  return data as FeatureFlag
}

// ---------------------------------------------------------------------------
// DB: Get all flags, optionally filtered by scope or subsystem
// ---------------------------------------------------------------------------

export async function getAllFlags(opts: {
  scope?:     FlagScope
  subsystem?: string
  enabledOnly?: boolean
} = {}): Promise<FeatureFlag[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabaseAdmin as any)
    .from('feature_flags')
    .select('*')
    .order('is_kill_switch', { ascending: false })
    .order('flag_key', { ascending: true })

  if (opts.scope)      query = query.eq('flag_scope', opts.scope)
  if (opts.subsystem)  query = query.eq('subsystem', opts.subsystem)
  if (opts.enabledOnly) query = query.eq('is_enabled', true)

  const { data, error } = await query
  if (error) throw new Error(`getAllFlags: ${error.message}`)
  return (data ?? []) as FeatureFlag[]
}

// ---------------------------------------------------------------------------
// DB: Enable a flag
// ---------------------------------------------------------------------------

export async function enableFlag(
  key:       string,
  enabledBy: string,
  opts: {
    rolloutPct?: number
    config?:     Record<string, unknown>
    expiresAt?:  string
  } = {},
): Promise<void> {
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('feature_flags')
    .update({
      is_enabled:  true,
      enabled_by:  enabledBy,
      enabled_at:  now,
      disabled_by: null,
      disabled_at: null,
      updated_at:  now,
      ...(opts.rolloutPct != null && { rollout_pct: opts.rolloutPct }),
      ...(opts.config     != null && { config: opts.config }),
      ...(opts.expiresAt  != null && { expires_at: opts.expiresAt }),
    })
    .eq('flag_key', key)

  if (error) throw new Error(`enableFlag: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Disable a flag
// ---------------------------------------------------------------------------

export async function disableFlag(
  key:        string,
  disabledBy: string,
): Promise<void> {
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('feature_flags')
    .update({
      is_enabled:  false,
      disabled_by: disabledBy,
      disabled_at: now,
      updated_at:  now,
    })
    .eq('flag_key', key)

  if (error) throw new Error(`disableFlag: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Convenience — check if a single flag is enabled
// Fetches fresh from DB each call — use getAllFlags for bulk evaluation
// ---------------------------------------------------------------------------

export async function isEnabled(
  key:     string,
  context?: FlagEvaluationContext,
): Promise<boolean> {
  const flag = await getFlag(key)
  if (!flag) return false
  return evaluateFlag(flag, context)
}

// ---------------------------------------------------------------------------
// DB: Create or update a flag
// ---------------------------------------------------------------------------

export async function upsertFlag(
  payload:  FlagPayload,
  actor:    string,
): Promise<string> {
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('feature_flags')
    .upsert({
      flag_key:       payload.flag_key,
      flag_name:      payload.flag_name,
      description:    payload.description ?? null,
      flag_scope:     payload.flag_scope,
      subsystem:      payload.subsystem ?? null,
      is_enabled:     payload.is_enabled,
      rollout_pct:    payload.rollout_pct,
      config:         payload.config,
      is_kill_switch: payload.is_kill_switch,
      is_canary:      payload.is_canary,
      expires_at:     payload.expires_at ?? null,
      updated_at:     now,
      ...(payload.is_enabled ? { enabled_by: actor, enabled_at: now } : {}),
    }, { onConflict: 'flag_key' })
    .select('id')
    .single()

  if (error) throw new Error(`upsertFlag: ${error.message}`)
  return data.id as string
}
