// =============================================================================
// Agency Group — Platform Config Accessor
// lib/platform/config.ts
//
// DB-backed configuration for hardcoded business thresholds.
// Eliminates "magic numbers" scattered across API routes.
//
// DESIGN:
//   - Single source of truth: `platform_config` table in Supabase
//   - 5-minute in-process cache per key to avoid DB hammering
//   - Typed helpers for every known config key
//   - Falls back to safe defaults if DB unavailable
//   - Writes invalidate the cache for the affected key
//
// USAGE:
//   const t = await getPlatformConfig()
//   if (score >= t.scoring.atacqueThreshold) { ... }
//
//   // Direct key access:
//   const v = await getConfigValue('scoring.ataque_threshold', 88)
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ConfigType = 'numeric' | 'text' | 'json' | 'boolean'

export interface PlatformConfigRow {
  config_key:   string
  value_numeric: number | null
  value_text:    string | null
  value_json:    Record<string, unknown> | null
  value_boolean: boolean | null
  config_type:   ConfigType
  description:   string | null
  category:      string
  updated_by:    string | null
  updated_at:    string
}

export interface PlatformConfigSnapshot {
  scoring: {
    ataque_threshold:         number   // score ≥ this → red alert (Ataque!)
    high_priority_threshold:  number   // score ≥ this → P0 alert
    money_priority_threshold: number   // money_priority_score ≥ this → P0 alert
    cpcv_readiness_threshold: number   // deal_readiness_score ≥ this → CPCV trigger
    qualification_threshold:  number   // lead_score ≥ this → basic qualified
    scarcity_threshold:       number   // scarcity_score ≥ this → zone scarce
    master_attack_rank_min:   number   // master_attack_rank ≥ this → P0 alert
    cpcv_probability_min:     number   // cpcv_prob ≥ this (combined with readiness)
  }
  alerts: {
    p0_cooldown_hours:        number   // hours between repeated P0 alerts
    p1_cooldown_hours:        number   // hours between repeated P1 alerts
    deal_pack_auto_score:     number   // score ≥ this → auto-send deal pack
  }
  distribution: {
    max_active_agents:        number   // max agents to route in parallel
    score_decay_days:         number   // days before a score is considered stale
  }
  revenue: {
    commission_pct:           number   // standard commission percentage (5.0)
    cpcv_split_pct:           number   // % paid at CPCV (50.0)
    escritura_split_pct:      number   // % paid at Escritura (50.0)
  }
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

const TTL_MS = 5 * 60 * 1000 // 5 minutes

interface CacheEntry<T> {
  value: T
  expires: number
}

const cache = new Map<string, CacheEntry<unknown>>()

function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key)
  if (!entry || Date.now() > entry.expires) return undefined
  return entry.value as T
}

function setCached<T>(key: string, value: T): void {
  cache.set(key, { value, expires: Date.now() + TTL_MS })
}

export function invalidateConfigCache(key?: string): void {
  if (key) {
    cache.delete(key)
    cache.delete('__all__')
  } else {
    cache.clear()
  }
}

// ---------------------------------------------------------------------------
// Leakage threshold snapshot (used by lib/commercial/revenueLeakage.ts)
// ---------------------------------------------------------------------------

export interface LeakageThresholds {
  highScoreMin:       number  // scoring.qualification_threshold
  cpCvReadinessMin:   number  // scoring.cpcv_readiness_threshold
  cpcvProbMin:        number  // scoring.cpcv_probability_min
  dormantDays:        number  // distribution.score_decay_days
  humanFailureHours:  number  // leakage.human_failure_hours
  cpvNoActionDays:    number  // leakage.cpcv_no_action_days
}

/**
 * Load revenue leakage thresholds from platform_config (cached 5 min).
 * Falls back to safe defaults if DB is unavailable — never throws.
 */
export async function getLeakageThresholds(): Promise<LeakageThresholds> {
  const [
    highScoreMin,
    cpCvReadinessMin,
    cpcvProbMin,
    dormantDays,
    humanFailureHours,
    cpvNoActionDays,
  ] = await Promise.all([
    getConfigValue('scoring.qualification_threshold',  70),
    getConfigValue('scoring.cpcv_readiness_threshold', 80),
    getConfigValue('scoring.cpcv_probability_min',     65),
    getConfigValue('distribution.score_decay_days',    14),
    getConfigValue('leakage.human_failure_hours',      48),
    getConfigValue('leakage.cpcv_no_action_days',       7),
  ])
  return { highScoreMin, cpCvReadinessMin, cpcvProbMin, dormantDays, humanFailureHours, cpvNoActionDays }
}

// ---------------------------------------------------------------------------
// Defaults — safe fallbacks if DB is unavailable
// ---------------------------------------------------------------------------

const DEFAULTS: Record<string, number | string | boolean> = {
  'scoring.ataque_threshold':         88,
  'scoring.high_priority_threshold':  80,
  'scoring.money_priority_threshold': 60,
  'scoring.cpcv_readiness_threshold': 80,
  'scoring.qualification_threshold':  70,
  'scoring.scarcity_threshold':       60,
  'scoring.master_attack_rank_min':   75,
  'scoring.cpcv_probability_min':     65,
  'alerts.p0_cooldown_hours':         6,
  'alerts.p1_cooldown_hours':         24,
  'alerts.deal_pack_auto_score':      80,
  'distribution.max_active_agents':   10,
  'distribution.score_decay_days':    14,
  'revenue.commission_pct':           5.0,
  'revenue.cpcv_split_pct':           50.0,
  'revenue.escritura_split_pct':      50.0,
  // Leakage-specific
  'leakage.human_failure_hours':      48,
  'leakage.cpcv_no_action_days':       7,
}

// ---------------------------------------------------------------------------
// Core: getConfigValue — single key with typed default
// ---------------------------------------------------------------------------

export async function getConfigValue<T extends number | string | boolean>(
  key: string,
  defaultValue: T,
): Promise<T> {
  const cached = getCached<T>(key)
  if (cached !== undefined) return cached

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from('platform_config')
      .select('value_numeric, value_text, value_boolean, config_type')
      .eq('config_key', key)
      .single()

    if (error || !data) {
      setCached(key, defaultValue)
      return defaultValue
    }

    let value: T = defaultValue
    if (data.config_type === 'numeric' && data.value_numeric !== null) {
      value = data.value_numeric as T
    } else if (data.config_type === 'boolean' && data.value_boolean !== null) {
      value = data.value_boolean as T
    } else if (data.config_type === 'text' && data.value_text !== null) {
      value = data.value_text as T
    }

    setCached(key, value)
    return value
  } catch {
    setCached(key, defaultValue)
    return defaultValue
  }
}

// ---------------------------------------------------------------------------
// Bulk: getAllConfig — fetch all rows for admin UI
// ---------------------------------------------------------------------------

export async function getAllConfig(): Promise<PlatformConfigRow[]> {
  const cached = getCached<PlatformConfigRow[]>('__all__')
  if (cached) return cached

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any)
      .from('platform_config')
      .select('*')
      .order('category', { ascending: true })
      .order('config_key', { ascending: true })

    if (error || !data) return buildDefaultRows()

    setCached('__all__', data as PlatformConfigRow[])
    return data as PlatformConfigRow[]
  } catch {
    return buildDefaultRows()
  }
}

// ---------------------------------------------------------------------------
// Composite: getPlatformConfig — returns typed snapshot
// ---------------------------------------------------------------------------

export async function getPlatformConfig(): Promise<PlatformConfigSnapshot> {
  const [
    ataque, highPri, moneyPri, cpcvReady, qualify, scarcity, masterRank, cpcvProb,
    p0Cool, p1Cool, dealPackScore,
    maxAgents, decayDays,
    commPct, cpcvSplit, escrituraSplit,
  ] = await Promise.all([
    getConfigValue('scoring.ataque_threshold',         88),
    getConfigValue('scoring.high_priority_threshold',  80),
    getConfigValue('scoring.money_priority_threshold', 60),
    getConfigValue('scoring.cpcv_readiness_threshold', 80),
    getConfigValue('scoring.qualification_threshold',  70),
    getConfigValue('scoring.scarcity_threshold',       60),
    getConfigValue('scoring.master_attack_rank_min',   75),
    getConfigValue('scoring.cpcv_probability_min',     65),
    getConfigValue('alerts.p0_cooldown_hours',          6),
    getConfigValue('alerts.p1_cooldown_hours',         24),
    getConfigValue('alerts.deal_pack_auto_score',      80),
    getConfigValue('distribution.max_active_agents',   10),
    getConfigValue('distribution.score_decay_days',    14),
    getConfigValue('revenue.commission_pct',          5.0),
    getConfigValue('revenue.cpcv_split_pct',         50.0),
    getConfigValue('revenue.escritura_split_pct',    50.0),
  ])

  return {
    scoring: {
      ataque_threshold:         ataque,
      high_priority_threshold:  highPri,
      money_priority_threshold: moneyPri,
      cpcv_readiness_threshold: cpcvReady,
      qualification_threshold:  qualify,
      scarcity_threshold:       scarcity,
      master_attack_rank_min:   masterRank,
      cpcv_probability_min:     cpcvProb,
    },
    alerts: {
      p0_cooldown_hours:    p0Cool,
      p1_cooldown_hours:    p1Cool,
      deal_pack_auto_score: dealPackScore,
    },
    distribution: {
      max_active_agents: maxAgents,
      score_decay_days:  decayDays,
    },
    revenue: {
      commission_pct:       commPct,
      cpcv_split_pct:       cpcvSplit,
      escritura_split_pct:  escrituraSplit,
    },
  }
}

// ---------------------------------------------------------------------------
// Write: updateConfigValue — updates DB + invalidates cache
// ---------------------------------------------------------------------------

export async function updateConfigValue(
  key:       string,
  value:     number | string | boolean,
  updatedBy: string,
): Promise<void> {
  const configType: ConfigType =
    typeof value === 'number'  ? 'numeric'  :
    typeof value === 'boolean' ? 'boolean'  :
                                 'text'

  const update: Record<string, unknown> = {
    config_type: configType,
    value_numeric: typeof value === 'number'  ? value : null,
    value_boolean: typeof value === 'boolean' ? value : null,
    value_text:    typeof value === 'string'  ? value : null,
    updated_by: updatedBy,
    updated_at: new Date().toISOString(),
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('platform_config')
    .update(update)
    .eq('config_key', key)

  if (error) throw new Error(`updateConfigValue(${key}): ${error.message}`)

  invalidateConfigCache(key)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildDefaultRows(): PlatformConfigRow[] {
  const now = new Date().toISOString()
  return Object.entries(DEFAULTS).map(([key, val]) => {
    const [cat] = key.split('.')
    const configType: ConfigType = typeof val === 'number' ? 'numeric' : typeof val === 'boolean' ? 'boolean' : 'text'
    return {
      config_key:    key,
      value_numeric: typeof val === 'number'  ? val  : null,
      value_text:    typeof val === 'string'  ? val  : null,
      value_boolean: typeof val === 'boolean' ? val  : null,
      value_json:    null,
      config_type:   configType,
      description:   null,
      category:      cat ?? 'general',
      updated_by:    null,
      updated_at:    now,
    }
  })
}
