// =============================================================================
// Agency Group — Distribution Control Engine
// lib/ops/distributionControl.ts
//
// Runtime safety controls — pause/resume distribution globally or by scope.
// Checked by the distribution API before any routing decision is executed.
//
// PURE FUNCTIONS (unit-testable):
//   isDistributionPaused, findBlockingControl
//
// DB FUNCTIONS:
//   getActiveControls, pauseDistribution, resumeDistribution
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DistributionControl {
  id:             string
  control_type:   'global' | 'zone' | 'asset_type' | 'tier'
  zone_key:       string | null
  asset_type:     string | null
  tier:           string | null   // 'A+' | 'A' | 'B' | null
  status:         'active' | 'paused'
  reason:         string | null
  controlled_by:  string | null
}

export interface PauseRequest {
  control_type:  DistributionControl['control_type']
  zone_key?:     string
  asset_type?:   string
  tier?:         string
  reason?:       string
  controlled_by?: string
}

export interface ControlCheckResult {
  is_paused:        boolean
  blocking_control: DistributionControl | null
  reason:           string
}

// ---------------------------------------------------------------------------
// PURE: Find the most specific control that blocks a given distribution
// Priority: global > tier > zone > asset_type (most restrictive first)
// ---------------------------------------------------------------------------

export function findBlockingControl(
  controls:   DistributionControl[],
  tier:       string,
  zoneKey?:   string,
  assetType?: string,
): DistributionControl | null {
  const paused = controls.filter(c => c.status === 'paused')
  if (paused.length === 0) return null

  // 1. Global pause — stops everything
  const global = paused.find(c => c.control_type === 'global')
  if (global) return global

  // 2. Tier-specific pause
  const tierControl = paused.find(c => c.control_type === 'tier' && c.tier === tier)
  if (tierControl) return tierControl

  // 3. Zone-specific pause
  if (zoneKey) {
    const zoneControl = paused.find(c => c.control_type === 'zone' && c.zone_key === zoneKey)
    if (zoneControl) return zoneControl
  }

  // 4. Asset-type-specific pause
  if (assetType) {
    const assetControl = paused.find(c => c.control_type === 'asset_type' && c.asset_type === assetType)
    if (assetControl) return assetControl
  }

  return null
}

// ---------------------------------------------------------------------------
// PURE: Check if distribution is paused for a given context
// ---------------------------------------------------------------------------

export function isDistributionPaused(
  controls:   DistributionControl[],
  tier:       string,
  zoneKey?:   string,
  assetType?: string,
): ControlCheckResult {
  const blocking = findBlockingControl(controls, tier, zoneKey, assetType)

  if (!blocking) {
    return { is_paused: false, blocking_control: null, reason: '' }
  }

  const reasonParts = [`Distribution paused (${blocking.control_type})`]
  if (blocking.reason)       reasonParts.push(blocking.reason)
  if (blocking.controlled_by) reasonParts.push(`by ${blocking.controlled_by}`)

  return {
    is_paused:        true,
    blocking_control: blocking,
    reason:           reasonParts.join(' — '),
  }
}

// ---------------------------------------------------------------------------
// DB: Get all currently active/paused controls
// ---------------------------------------------------------------------------

export async function getActiveControls(): Promise<DistributionControl[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('distribution_controls')
    .select('id, control_type, zone_key, asset_type, tier, status, reason, controlled_by')

  if (error) throw new Error(`getActiveControls: ${error.message}`)
  return (data ?? []) as DistributionControl[]
}

// ---------------------------------------------------------------------------
// DB: Pause distribution for a given scope
// ---------------------------------------------------------------------------

export async function pauseDistribution(req: PauseRequest): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('distribution_controls')
    .upsert({
      control_type:  req.control_type,
      zone_key:      req.zone_key      ?? null,
      asset_type:    req.asset_type    ?? null,
      tier:          req.tier          ?? null,
      status:        'paused',
      reason:        req.reason        ?? null,
      controlled_by: req.controlled_by ?? null,
      activated_at:  new Date().toISOString(),
    }, { onConflict: 'control_type, zone_key, asset_type, tier' })
    .select('id')
    .single()

  if (error) throw new Error(`pauseDistribution: ${error.message}`)
  return data.id as string
}

// ---------------------------------------------------------------------------
// DB: Resume distribution for a given control ID
// ---------------------------------------------------------------------------

export async function resumeDistribution(
  controlId:    string,
  resumedBy?:   string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('distribution_controls')
    .update({
      status:          'active',
      deactivated_at:  new Date().toISOString(),
      controlled_by:   resumedBy ?? null,
    })
    .eq('id', controlId)

  if (error) throw new Error(`resumeDistribution: ${error.message}`)
}
