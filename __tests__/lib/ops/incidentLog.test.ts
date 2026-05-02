// =============================================================================
// Tests — lib/ops/incidentLog.ts  (pure functions only)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  classifyIncidentSeverity,
  buildIncident,
} from '../../../lib/ops/incidentLog'

// ---------------------------------------------------------------------------
// classifyIncidentSeverity
// ---------------------------------------------------------------------------

describe('classifyIncidentSeverity', () => {
  it('scoring_pipeline_down → critical', () => {
    expect(classifyIncidentSeverity('scoring_pipeline_down')).toBe('critical')
  })

  it('distribution_halted → critical', () => {
    expect(classifyIncidentSeverity('distribution_halted')).toBe('critical')
  })

  it('avm_compute_failure → critical', () => {
    expect(classifyIncidentSeverity('avm_compute_failure')).toBe('critical')
  })

  it('data_corruption → critical', () => {
    expect(classifyIncidentSeverity('data_corruption')).toBe('critical')
  })

  it('revenue_pipeline_blocked → critical', () => {
    expect(classifyIncidentSeverity('revenue_pipeline_blocked')).toBe('critical')
  })

  it('cron_cascade_failure → critical', () => {
    expect(classifyIncidentSeverity('cron_cascade_failure')).toBe('critical')
  })

  it('provider_degraded → warning', () => {
    expect(classifyIncidentSeverity('provider_degraded')).toBe('warning')
  })

  it('high_error_rate → warning', () => {
    expect(classifyIncidentSeverity('high_error_rate')).toBe('warning')
  })

  it('scoring_drift_detected → warning', () => {
    expect(classifyIncidentSeverity('scoring_drift_detected')).toBe('warning')
  })

  it('review_queue_overflow → warning', () => {
    expect(classifyIncidentSeverity('review_queue_overflow')).toBe('warning')
  })

  it('distribution_slowdown → warning', () => {
    expect(classifyIncidentSeverity('distribution_slowdown')).toBe('warning')
  })

  it('unknown type → info', () => {
    expect(classifyIncidentSeverity('some_minor_thing')).toBe('info')
    expect(classifyIncidentSeverity('unknown_event')).toBe('info')
  })
})

// ---------------------------------------------------------------------------
// buildIncident
// ---------------------------------------------------------------------------

describe('buildIncident', () => {
  it('builds minimal incident', () => {
    const p = buildIncident('scoring_pipeline_down', 'Scoring is down')
    expect(p.incident_type).toBe('scoring_pipeline_down')
    expect(p.title).toBe('Scoring is down')
    expect(p.severity).toBe('critical')
  })

  it('auto-classifies severity from type', () => {
    const p = buildIncident('provider_degraded', 'Idealista slow')
    expect(p.severity).toBe('warning')
  })

  it('allows severity override', () => {
    const p = buildIncident('unknown_type', 'Custom', { severity: 'critical' })
    expect(p.severity).toBe('critical')
  })

  it('sets affected_systems', () => {
    const p = buildIncident('scoring_pipeline_down', 'Down', {
      affectedSystems: ['scoring', 'distribution'],
    })
    expect(p.affected_systems).toEqual(['scoring', 'distribution'])
  })

  it('affected_systems defaults to empty array', () => {
    const p = buildIncident('scoring_pipeline_down', 'Down')
    expect(p.affected_systems).toEqual([])
  })

  it('sets all optional fields', () => {
    const p = buildIncident('scoring_pipeline_down', 'Down', {
      description:    'Full pipeline halted at 08:00',
      affectedCount:  150,
      startedAt:      '2026-05-02T08:00:00.000Z',
      detectedBy:     'cron/health-check',
      ownedBy:        'ops@agency.com',
      alertId:        'alert-001',
    })
    expect(p.description).toBe('Full pipeline halted at 08:00')
    expect(p.affected_count).toBe(150)
    expect(p.started_at).toBe('2026-05-02T08:00:00.000Z')
    expect(p.detected_by).toBe('cron/health-check')
    expect(p.owned_by).toBe('ops@agency.com')
    expect(p.alert_id).toBe('alert-001')
  })
})
