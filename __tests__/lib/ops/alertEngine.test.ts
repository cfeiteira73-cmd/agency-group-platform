// =============================================================================
// Tests — lib/ops/alertEngine.ts  (pure functions only)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  classifyAlertSeverity,
  buildAlert,
  formatAlertTitle,
} from '../../../lib/ops/alertEngine'
import type { AlertType } from '../../../lib/ops/alertEngine'

// ---------------------------------------------------------------------------
// classifyAlertSeverity
// ---------------------------------------------------------------------------

describe('classifyAlertSeverity', () => {
  it('cron_failure → critical', () => {
    expect(classifyAlertSeverity('cron_failure')).toBe('critical')
  })

  it('routing_failure → critical', () => {
    expect(classifyAlertSeverity('routing_failure')).toBe('critical')
  })

  it('provider_failure → critical', () => {
    expect(classifyAlertSeverity('provider_failure')).toBe('critical')
  })

  it('score_drift_critical → critical', () => {
    expect(classifyAlertSeverity('score_drift_critical')).toBe('critical')
  })

  it('job_dead_letter → critical', () => {
    expect(classifyAlertSeverity('job_dead_letter')).toBe('critical')
  })

  it('review_queue_overdue → warning', () => {
    expect(classifyAlertSeverity('review_queue_overdue')).toBe('warning')
  })

  it('data_quality_critical → warning', () => {
    expect(classifyAlertSeverity('data_quality_critical')).toBe('warning')
  })

  it('avm_confidence_low → warning', () => {
    expect(classifyAlertSeverity('avm_confidence_low')).toBe('warning')
  })

  it('api_degradation → warning', () => {
    expect(classifyAlertSeverity('api_degradation')).toBe('warning')
  })

  it('distribution_paused → warning', () => {
    expect(classifyAlertSeverity('distribution_paused')).toBe('warning')
  })

  it('score_distribution_anomaly → warning', () => {
    expect(classifyAlertSeverity('score_distribution_anomaly')).toBe('warning')
  })

  it('pdf_generation_failure → info (not in critical/warning lists)', () => {
    expect(classifyAlertSeverity('pdf_generation_failure')).toBe('info')
  })
})

// ---------------------------------------------------------------------------
// buildAlert
// ---------------------------------------------------------------------------

describe('buildAlert', () => {
  it('returns type, title, message', () => {
    const alert = buildAlert('cron_failure', 'Cron Failed', 'update-partner-tiers did not run')
    expect(alert.type).toBe('cron_failure')
    expect(alert.title).toBe('Cron Failed')
    expect(alert.message).toBe('update-partner-tiers did not run')
  })

  it('dedup_key uses type:YYYY-MM-DD by default', () => {
    const today = new Date().toISOString().split('T')[0]
    const alert = buildAlert('cron_failure', 'Test', 'msg')
    expect(alert.dedup_key).toBe(`cron_failure:${today}`)
  })

  it('dedup_key uses type:dedupSuffix when provided', () => {
    const alert = buildAlert('routing_failure', 'Test', 'msg', {}, 'prop-001')
    expect(alert.dedup_key).toBe('routing_failure:prop-001')
  })

  it('context is empty object by default', () => {
    const alert = buildAlert('cron_failure', 'T', 'M')
    expect(alert.context).toEqual({})
  })

  it('context is passed through', () => {
    const ctx   = { job_id: 'j-123', attempts: 3 }
    const alert = buildAlert('job_dead_letter', 'Dead Job', 'Max retries', ctx)
    expect(alert.context).toEqual(ctx)
  })

  it('same type + same day → same dedup_key (enables deduplication)', () => {
    const a1 = buildAlert('cron_failure', 'A', 'A')
    const a2 = buildAlert('cron_failure', 'B', 'B')
    expect(a1.dedup_key).toBe(a2.dedup_key)
  })

  it('different suffix → different dedup_key', () => {
    const a1 = buildAlert('routing_failure', 'A', 'A', {}, 'prop-001')
    const a2 = buildAlert('routing_failure', 'B', 'B', {}, 'prop-002')
    expect(a1.dedup_key).not.toBe(a2.dedup_key)
  })

  it('different type → different default dedup_key', () => {
    const today = new Date().toISOString().split('T')[0]
    const a1    = buildAlert('cron_failure',   'A', 'M')
    const a2    = buildAlert('routing_failure', 'A', 'M')
    expect(a1.dedup_key).toBe(`cron_failure:${today}`)
    expect(a2.dedup_key).toBe(`routing_failure:${today}`)
    expect(a1.dedup_key).not.toBe(a2.dedup_key)
  })
})

// ---------------------------------------------------------------------------
// formatAlertTitle
// ---------------------------------------------------------------------------

describe('formatAlertTitle', () => {
  it('critical alert → 🚨 prefix', () => {
    const title = formatAlertTitle('cron_failure', 'update-partner-tiers failed')
    expect(title.startsWith('🚨')).toBe(true)
    expect(title).toContain('update-partner-tiers failed')
  })

  it('warning alert → ⚠️ prefix', () => {
    const title = formatAlertTitle('review_queue_overdue', '5 reviews overdue')
    expect(title.startsWith('⚠️')).toBe(true)
  })

  it('info alert → ℹ️ prefix', () => {
    const title = formatAlertTitle('pdf_generation_failure', 'PDF generation slow')
    expect(title.startsWith('ℹ️')).toBe(true)
  })

  it('includes subject in output', () => {
    const subject = 'Distribution paused in Lisboa'
    const title   = formatAlertTitle('distribution_paused', subject)
    expect(title).toContain(subject)
  })

  it('all critical types produce 🚨', () => {
    const criticalTypes: AlertType[] = [
      'cron_failure', 'routing_failure', 'provider_failure',
      'score_drift_critical', 'job_dead_letter',
    ]
    criticalTypes.forEach(t => {
      expect(formatAlertTitle(t, 'x').startsWith('🚨')).toBe(true)
    })
  })

  it('all warning types produce ⚠️', () => {
    const warningTypes: AlertType[] = [
      'review_queue_overdue', 'data_quality_critical',
      'avm_confidence_low', 'api_degradation', 'distribution_paused',
      'score_distribution_anomaly',
    ]
    warningTypes.forEach(t => {
      expect(formatAlertTitle(t, 'x').startsWith('⚠️')).toBe(true)
    })
  })
})
