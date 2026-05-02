// =============================================================================
// Tests — lib/ops/distributionControl.ts  (pure functions only)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  findBlockingControl,
  isDistributionPaused,
} from '../../../lib/ops/distributionControl'
import type { DistributionControl } from '../../../lib/ops/distributionControl'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeControl(overrides: Partial<DistributionControl> = {}): DistributionControl {
  return {
    id:            'ctrl-001',
    control_type:  'global',
    zone_key:      null,
    asset_type:    null,
    tier:          null,
    status:        'paused',
    reason:        'Maintenance window',
    controlled_by: 'admin@agency.com',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// findBlockingControl
// ---------------------------------------------------------------------------

describe('findBlockingControl', () => {
  it('returns null when no controls', () => {
    expect(findBlockingControl([], 'A', 'lisboa', 'apartment')).toBeNull()
  })

  it('returns null when all controls are active (not paused)', () => {
    const controls = [makeControl({ status: 'active' })]
    expect(findBlockingControl(controls, 'A', 'lisboa', 'apartment')).toBeNull()
  })

  it('global pause blocks everything', () => {
    const controls = [makeControl({ control_type: 'global', status: 'paused' })]
    expect(findBlockingControl(controls, 'A', 'lisboa', 'apartment')).not.toBeNull()
    expect(findBlockingControl(controls, 'A+', undefined, undefined)).not.toBeNull()
    expect(findBlockingControl(controls, 'B', 'porto', 'villa')).not.toBeNull()
  })

  it('tier pause blocks matching tier only', () => {
    const controls = [makeControl({ control_type: 'tier', tier: 'A+', status: 'paused', zone_key: null, asset_type: null })]
    expect(findBlockingControl(controls, 'A+', 'lisboa', 'apartment')).not.toBeNull()
    expect(findBlockingControl(controls, 'A',  'lisboa', 'apartment')).toBeNull()
    expect(findBlockingControl(controls, 'B',  'lisboa', 'apartment')).toBeNull()
  })

  it('zone pause blocks matching zone only', () => {
    const controls = [makeControl({ control_type: 'zone', zone_key: 'lisboa-centro', status: 'paused', tier: null, asset_type: null })]
    expect(findBlockingControl(controls, 'A', 'lisboa-centro', 'apartment')).not.toBeNull()
    expect(findBlockingControl(controls, 'A', 'porto', 'apartment')).toBeNull()
  })

  it('asset_type pause blocks matching type only', () => {
    const controls = [makeControl({ control_type: 'asset_type', asset_type: 'commercial', status: 'paused', tier: null, zone_key: null })]
    expect(findBlockingControl(controls, 'A', 'lisboa', 'commercial')).not.toBeNull()
    expect(findBlockingControl(controls, 'A', 'lisboa', 'apartment')).toBeNull()
  })

  it('global takes priority over tier control', () => {
    const controls = [
      makeControl({ control_type: 'global', status: 'paused', id: 'global-1' }),
      makeControl({ control_type: 'tier', tier: 'A+', status: 'paused', id: 'tier-1', zone_key: null, asset_type: null }),
    ]
    const result = findBlockingControl(controls, 'A+', 'lisboa', 'apartment')
    expect(result?.id).toBe('global-1')
  })

  it('returns null when zone control does not match and no global', () => {
    const controls = [makeControl({ control_type: 'zone', zone_key: 'algarve', status: 'paused', tier: null, asset_type: null })]
    expect(findBlockingControl(controls, 'A', 'lisboa', 'apartment')).toBeNull()
  })

  it('zone control without zoneKey provided does not block', () => {
    const controls = [makeControl({ control_type: 'zone', zone_key: 'lisboa', status: 'paused', tier: null, asset_type: null })]
    // No zoneKey provided — zone control should not match
    expect(findBlockingControl(controls, 'A')).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// isDistributionPaused
// ---------------------------------------------------------------------------

describe('isDistributionPaused', () => {
  it('returns is_paused: false when no controls', () => {
    const result = isDistributionPaused([], 'A', 'lisboa', 'apartment')
    expect(result.is_paused).toBe(false)
    expect(result.blocking_control).toBeNull()
  })

  it('returns is_paused: false when only active controls', () => {
    const controls = [makeControl({ status: 'active' })]
    const result   = isDistributionPaused(controls, 'A', 'lisboa', 'apartment')
    expect(result.is_paused).toBe(false)
  })

  it('returns is_paused: true for global pause', () => {
    const controls = [makeControl()]  // default is global+paused
    const result   = isDistributionPaused(controls, 'A', 'lisboa', 'apartment')
    expect(result.is_paused).toBe(true)
    expect(result.blocking_control).not.toBeNull()
  })

  it('includes reason string when paused', () => {
    const controls = [makeControl({ reason: 'Emergency maintenance' })]
    const result   = isDistributionPaused(controls, 'A', 'lisboa')
    expect(result.reason).toContain('Distribution paused')
    expect(result.reason).toContain('Emergency maintenance')
  })

  it('includes controlled_by in reason when available', () => {
    const controls = [makeControl({ controlled_by: 'ops@agency.com', reason: null })]
    const result   = isDistributionPaused(controls, 'A', 'lisboa')
    expect(result.reason).toContain('ops@agency.com')
  })

  it('empty reason when not paused', () => {
    const result = isDistributionPaused([], 'A')
    expect(result.reason).toBe('')
  })

  it('tier pause only affects that tier', () => {
    const controls = [makeControl({ control_type: 'tier', tier: 'A+', zone_key: null, asset_type: null })]
    expect(isDistributionPaused(controls, 'A+').is_paused).toBe(true)
    expect(isDistributionPaused(controls, 'A').is_paused).toBe(false)
    expect(isDistributionPaused(controls, 'B').is_paused).toBe(false)
  })

  it('multiple controls — most restrictive (global) wins', () => {
    const controls = [
      makeControl({ control_type: 'zone', zone_key: 'porto', status: 'active', tier: null, asset_type: null }),
      makeControl({ control_type: 'global', status: 'paused' }),
    ]
    const result = isDistributionPaused(controls, 'A', 'lisboa')
    expect(result.is_paused).toBe(true)
    expect(result.blocking_control?.control_type).toBe('global')
  })
})
