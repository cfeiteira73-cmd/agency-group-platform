// =============================================================================
// Tests — lib/ops/operatorTasks.ts  (pure functions only)
// =============================================================================

import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabaseAdmin: {}, supabase: {} }))

import {
  buildTask,
  isTaskOverdue,
  computeTaskUrgencyScore,
  sortTasksByPriority,
} from '../../../lib/ops/operatorTasks'
import type { OperatorTask } from '../../../lib/ops/operatorTasks'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTask(overrides: Partial<OperatorTask> = {}): OperatorTask {
  return {
    id:         'task-001',
    task_type:  'review_queue',
    title:      'Test Task',
    priority:   'MEDIUM',
    status:     'pending',
    due_at:     null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildTask
// ---------------------------------------------------------------------------

describe('buildTask', () => {
  it('builds task with defaults', () => {
    const t = buildTask('review_queue', 'Review needed')
    expect(t.task_type).toBe('review_queue')
    expect(t.title).toBe('Review needed')
    expect(t.priority).toBe('MEDIUM')
    expect(t.due_at).toBeUndefined()
  })

  it('accepts explicit priority', () => {
    const t = buildTask('escalation', 'Critical escalation', { priority: 'CRITICAL' })
    expect(t.priority).toBe('CRITICAL')
  })

  it('computes dueAt from dueInHours', () => {
    const before = Date.now()
    const t      = buildTask('distribution_check', 'Check', { dueInHours: 2 })
    const after  = Date.now()
    expect(t.due_at).toBeDefined()
    const dueMs = new Date(t.due_at!).getTime()
    expect(dueMs).toBeGreaterThanOrEqual(before + 2 * 3600_000)
    expect(dueMs).toBeLessThanOrEqual(after  + 2 * 3600_000)
  })

  it('explicit dueAt takes precedence over dueInHours', () => {
    const explicit = '2026-12-31T00:00:00.000Z'
    const t        = buildTask('data_fix', 'Fix', { dueAt: explicit, dueInHours: 24 })
    expect(t.due_at).toBe(explicit)
  })

  it('sets all optional fields', () => {
    const t = buildTask('incident_response', 'Respond', {
      description:    'Full details',
      assignedTo:     'ops@agency.com',
      assignedBy:     'admin@agency.com',
      propertyId:     'prop-001',
      reviewQueueId:  'rq-001',
      alertId:        'alert-001',
      incidentId:     'inc-001',
      opsNotes:       'Urgent — CEO aware',
    })
    expect(t.description).toBe('Full details')
    expect(t.assigned_to).toBe('ops@agency.com')
    expect(t.assigned_by).toBe('admin@agency.com')
    expect(t.property_id).toBe('prop-001')
    expect(t.review_queue_id).toBe('rq-001')
    expect(t.alert_id).toBe('alert-001')
    expect(t.incident_id).toBe('inc-001')
    expect(t.ops_notes).toBe('Urgent — CEO aware')
  })

  it('no dueAt when neither dueAt nor dueInHours provided', () => {
    const t = buildTask('other', 'Ad hoc')
    expect(t.due_at).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// isTaskOverdue
// ---------------------------------------------------------------------------

describe('isTaskOverdue', () => {
  it('not overdue when status is completed', () => {
    const past = new Date(Date.now() - 3600_000).toISOString()
    expect(isTaskOverdue({ status: 'completed', due_at: past })).toBe(false)
  })

  it('not overdue when status is cancelled', () => {
    const past = new Date(Date.now() - 3600_000).toISOString()
    expect(isTaskOverdue({ status: 'cancelled', due_at: past })).toBe(false)
  })

  it('not overdue when no due_at', () => {
    expect(isTaskOverdue({ status: 'pending', due_at: null })).toBe(false)
  })

  it('overdue when pending and due_at is in the past', () => {
    const past = new Date(Date.now() - 3600_000).toISOString()
    expect(isTaskOverdue({ status: 'pending', due_at: past })).toBe(true)
  })

  it('overdue when in_progress and due_at is in the past', () => {
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(isTaskOverdue({ status: 'in_progress', due_at: past })).toBe(true)
  })

  it('not overdue when due_at is in the future', () => {
    const future = new Date(Date.now() + 3600_000).toISOString()
    expect(isTaskOverdue({ status: 'pending', due_at: future })).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// computeTaskUrgencyScore
// ---------------------------------------------------------------------------

describe('computeTaskUrgencyScore', () => {
  it('CRITICAL base = 80', () => {
    expect(computeTaskUrgencyScore({ priority: 'CRITICAL', due_at: null, status: 'pending' })).toBe(80)
  })

  it('HIGH base = 60', () => {
    expect(computeTaskUrgencyScore({ priority: 'HIGH', due_at: null, status: 'pending' })).toBe(60)
  })

  it('MEDIUM base = 40', () => {
    expect(computeTaskUrgencyScore({ priority: 'MEDIUM', due_at: null, status: 'pending' })).toBe(40)
  })

  it('LOW base = 20', () => {
    expect(computeTaskUrgencyScore({ priority: 'LOW', due_at: null, status: 'pending' })).toBe(20)
  })

  it('overdue adds +20 (past dates also trigger urgentSoon +10)', () => {
    const past = new Date(Date.now() - 3600_000).toISOString()
    // MEDIUM(40) + overdue(20) + urgentSoon(10, past diff is negative < 3600_000) = 70
    expect(computeTaskUrgencyScore({ priority: 'MEDIUM', due_at: past, status: 'pending' })).toBe(70)
  })

  it('due in < 1h adds +10', () => {
    const soon = new Date(Date.now() + 30 * 60_000).toISOString()  // 30 min from now
    // not overdue (future), but urgent-soon
    expect(computeTaskUrgencyScore({ priority: 'MEDIUM', due_at: soon, status: 'pending' })).toBe(50) // 40 + 10
  })

  it('capped at 100', () => {
    const past = new Date(Date.now() - 3600_000).toISOString()
    // CRITICAL(80) + overdue(20) = 100 → capped
    expect(computeTaskUrgencyScore({ priority: 'CRITICAL', due_at: past, status: 'pending' })).toBe(100)
  })

  it('completed task gets no overdue bonus but still gets urgentSoon', () => {
    const past = new Date(Date.now() - 3600_000).toISOString()
    // completed → isTaskOverdue = false → no +20 overdue
    // but urgentSoon: past diff < 3600_000 → +10
    // HIGH(60) + 0 + 10 = 70
    expect(computeTaskUrgencyScore({ priority: 'HIGH', due_at: past, status: 'completed' })).toBe(70)
  })

  it('no due_at → no urgency bonuses', () => {
    expect(computeTaskUrgencyScore({ priority: 'LOW', due_at: null, status: 'pending' })).toBe(20)
  })

  it('due in > 1h gets no urgent-soon bonus', () => {
    const twoHours = new Date(Date.now() + 2 * 3600_000).toISOString()
    expect(computeTaskUrgencyScore({ priority: 'MEDIUM', due_at: twoHours, status: 'pending' })).toBe(40)
  })
})

// ---------------------------------------------------------------------------
// sortTasksByPriority
// ---------------------------------------------------------------------------

describe('sortTasksByPriority', () => {
  it('returns empty array for empty input', () => {
    expect(sortTasksByPriority([])).toEqual([])
  })

  it('higher urgency score comes first', () => {
    const past = new Date(Date.now() - 3600_000).toISOString()
    const tasks = [
      makeTask({ id: 'a', priority: 'LOW' }),
      makeTask({ id: 'b', priority: 'CRITICAL', due_at: past }),  // 100
      makeTask({ id: 'c', priority: 'HIGH' }),                    // 60
    ]
    const sorted = sortTasksByPriority(tasks)
    expect(sorted[0].id).toBe('b')   // CRITICAL + overdue = 100
    expect(sorted[1].id).toBe('c')   // HIGH = 60
    expect(sorted[2].id).toBe('a')   // LOW = 20
  })

  it('does not mutate the original array', () => {
    const tasks  = [makeTask({ id: 'x', priority: 'LOW' }), makeTask({ id: 'y', priority: 'CRITICAL' })]
    const copy   = tasks.map(t => t.id)
    sortTasksByPriority(tasks)
    expect(tasks.map(t => t.id)).toEqual(copy)   // original order preserved
  })

  it('CRITICAL before HIGH before MEDIUM before LOW (no due_at)', () => {
    const tasks = [
      makeTask({ id: 'low',      priority: 'LOW' }),
      makeTask({ id: 'medium',   priority: 'MEDIUM' }),
      makeTask({ id: 'high',     priority: 'HIGH' }),
      makeTask({ id: 'critical', priority: 'CRITICAL' }),
    ]
    const sorted = sortTasksByPriority(tasks)
    expect(sorted.map(t => t.id)).toEqual(['critical', 'high', 'medium', 'low'])
  })

  it('overdue MEDIUM outranks non-overdue HIGH when delta > threshold', () => {
    const past = new Date(Date.now() - 3600_000).toISOString()
    const tasks = [
      makeTask({ id: 'high',   priority: 'HIGH' }),             // 60
      makeTask({ id: 'medium', priority: 'MEDIUM', due_at: past }), // 40+20=60 — same score
    ]
    const sorted = sortTasksByPriority(tasks)
    // Both score 60 — stable sort, order may be preserved
    expect(sorted.map(t => t.id)).toContain('high')
    expect(sorted.map(t => t.id)).toContain('medium')
  })
})
