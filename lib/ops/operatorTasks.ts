// =============================================================================
// Agency Group — Operator Task Queue
// lib/ops/operatorTasks.ts
//
// Phase 10: Operational Playbook Support Layer
//
// Provides a structured task queue for operational workflows:
//   review_queue | distribution_check | calibration_review |
//   quality_review | escalation | data_fix | incident_response | other
//
// Tasks can be created by crons, health checks, or manually by admins.
// Tasks expire (overdue) and can be escalated.
//
// PURE FUNCTIONS:
//   buildTask, isTaskOverdue, computeTaskUrgencyScore, sortTasksByPriority
//
// DB FUNCTIONS:
//   createTask, claimTask, completeTask, cancelTask, escalateTask,
//   getPendingTasks, getOverdueTasks
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaskType =
  | 'review_queue'
  | 'distribution_check'
  | 'calibration_review'
  | 'quality_review'
  | 'escalation'
  | 'data_fix'
  | 'incident_response'
  | 'other'

export type TaskPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
export type TaskStatus   = 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'escalated'

export interface OperatorTask {
  id:              string
  task_type:       TaskType
  title:           string
  description?:    string | null
  priority:        TaskPriority
  assigned_to?:    string | null
  assigned_by?:    string | null
  assigned_at?:    string | null
  property_id?:    string | null
  review_queue_id?: string | null
  alert_id?:       string | null
  incident_id?:    string | null
  status:          TaskStatus
  due_at?:         string | null
  completed_at?:   string | null
  completed_by?:   string | null
  ops_notes?:      string | null
  resolution?:     string | null
  created_at:      string
  updated_at:      string
}

export interface TaskPayload {
  task_type:       TaskType
  title:           string
  description?:    string
  priority:        TaskPriority
  assigned_to?:    string
  assigned_by?:    string
  property_id?:    string
  review_queue_id?: string
  alert_id?:       string
  incident_id?:    string
  due_at?:         string
  ops_notes?:      string
}

// ---------------------------------------------------------------------------
// PURE: Build a task payload
// ---------------------------------------------------------------------------

export function buildTask(
  taskType: TaskType,
  title:    string,
  opts: {
    description?:    string
    priority?:       TaskPriority
    assignedTo?:     string
    assignedBy?:     string
    propertyId?:     string
    reviewQueueId?:  string
    alertId?:        string
    incidentId?:     string
    dueAt?:          string
    dueInHours?:     number    // convenience: compute dueAt from now + N hours
    opsNotes?:       string
  } = {},
): TaskPayload {
  const dueAt = opts.dueAt ?? (
    opts.dueInHours != null
      ? new Date(Date.now() + opts.dueInHours * 3600_000).toISOString()
      : undefined
  )

  return {
    task_type:       taskType,
    title,
    description:     opts.description,
    priority:        opts.priority ?? 'MEDIUM',
    assigned_to:     opts.assignedTo,
    assigned_by:     opts.assignedBy,
    property_id:     opts.propertyId,
    review_queue_id: opts.reviewQueueId,
    alert_id:        opts.alertId,
    incident_id:     opts.incidentId,
    due_at:          dueAt,
    ops_notes:       opts.opsNotes,
  }
}

// ---------------------------------------------------------------------------
// PURE: Determine if a task is overdue
// ---------------------------------------------------------------------------

export function isTaskOverdue(task: Pick<OperatorTask, 'due_at' | 'status'>): boolean {
  if (task.status === 'completed' || task.status === 'cancelled') return false
  if (!task.due_at) return false
  return new Date(task.due_at) < new Date()
}

// ---------------------------------------------------------------------------
// PURE: Compute urgency score for sorting (0-100)
// ---------------------------------------------------------------------------

export function computeTaskUrgencyScore(
  task: Pick<OperatorTask, 'priority' | 'due_at' | 'status'>,
): number {
  const priorityScore: Record<TaskPriority, number> = {
    CRITICAL: 80, HIGH: 60, MEDIUM: 40, LOW: 20,
  }

  const base      = priorityScore[task.priority] ?? 20
  const overdue   = isTaskOverdue(task) ? 20 : 0
  const urgentSoon = task.due_at
    ? new Date(task.due_at).getTime() - Date.now() < 3600_000 ? 10 : 0
    : 0

  return Math.min(100, base + overdue + urgentSoon)
}

// ---------------------------------------------------------------------------
// PURE: Sort tasks by urgency (highest first)
// ---------------------------------------------------------------------------

export function sortTasksByPriority(tasks: OperatorTask[]): OperatorTask[] {
  return [...tasks].sort(
    (a, b) => computeTaskUrgencyScore(b) - computeTaskUrgencyScore(a),
  )
}

// ---------------------------------------------------------------------------
// DB: Create a task
// ---------------------------------------------------------------------------

export async function createTask(payload: TaskPayload): Promise<string> {
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('operator_tasks')
    .insert({
      task_type:       payload.task_type,
      title:           payload.title,
      description:     payload.description ?? null,
      priority:        payload.priority,
      assigned_to:     payload.assigned_to  ?? null,
      assigned_by:     payload.assigned_by  ?? null,
      assigned_at:     payload.assigned_to  ? now : null,
      property_id:     payload.property_id  ?? null,
      review_queue_id: payload.review_queue_id ?? null,
      alert_id:        payload.alert_id     ?? null,
      incident_id:     payload.incident_id  ?? null,
      status:          'pending',
      due_at:          payload.due_at       ?? null,
      ops_notes:       payload.ops_notes    ?? null,
      created_at:      now,
      updated_at:      now,
    })
    .select('id')
    .single()

  if (error) throw new Error(`createTask: ${error.message}`)
  return data.id as string
}

// ---------------------------------------------------------------------------
// DB: Claim a task (assign to self and mark in_progress)
// ---------------------------------------------------------------------------

export async function claimTask(
  id:    string,
  email: string,
): Promise<void> {
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('operator_tasks')
    .update({
      status:      'in_progress',
      assigned_to: email,
      assigned_at: now,
      updated_at:  now,
    })
    .eq('id', id)
    .eq('status', 'pending')   // optimistic lock

  if (error) throw new Error(`claimTask: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Complete a task
// ---------------------------------------------------------------------------

export async function completeTask(
  id:          string,
  completedBy: string,
  resolution?: string,
): Promise<void> {
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('operator_tasks')
    .update({
      status:       'completed',
      completed_at: now,
      completed_by: completedBy,
      resolution:   resolution ?? null,
      updated_at:   now,
    })
    .eq('id', id)
    .in('status', ['pending', 'in_progress'])

  if (error) throw new Error(`completeTask: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Cancel a task
// ---------------------------------------------------------------------------

export async function cancelTask(
  id:     string,
  reason?: string,
): Promise<void> {
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('operator_tasks')
    .update({
      status:     'cancelled',
      resolution: reason ?? null,
      updated_at: now,
    })
    .eq('id', id)
    .in('status', ['pending', 'in_progress'])

  if (error) throw new Error(`cancelTask: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Escalate a task
// ---------------------------------------------------------------------------

export async function escalateTask(
  id:          string,
  escalatedBy: string,
  reason:      string,
): Promise<void> {
  const now = new Date().toISOString()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabaseAdmin as any)
    .from('operator_tasks')
    .update({
      status:     'escalated',
      ops_notes:  reason,
      assigned_by: escalatedBy,
      updated_at: now,
    })
    .eq('id', id)

  if (error) throw new Error(`escalateTask: ${error.message}`)
}

// ---------------------------------------------------------------------------
// DB: Get pending/in-progress tasks
// ---------------------------------------------------------------------------

export async function getPendingTasks(opts: {
  assignedTo?:  string
  taskType?:    TaskType
  priority?:    TaskPriority
  limit?:       number
} = {}): Promise<OperatorTask[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabaseAdmin as any)
    .from('operator_tasks')
    .select('*')
    .in('status', ['pending', 'in_progress'])
    .order('created_at', { ascending: true })
    .limit(opts.limit ?? 50)

  if (opts.assignedTo) query = query.eq('assigned_to', opts.assignedTo)
  if (opts.taskType)   query = query.eq('task_type', opts.taskType)
  if (opts.priority)   query = query.eq('priority', opts.priority)

  const { data, error } = await query
  if (error) throw new Error(`getPendingTasks: ${error.message}`)
  return (data ?? []) as OperatorTask[]
}

// ---------------------------------------------------------------------------
// DB: Get overdue tasks
// ---------------------------------------------------------------------------

export async function getOverdueTasks(): Promise<OperatorTask[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabaseAdmin as any)
    .from('operator_tasks')
    .select('*')
    .in('status', ['pending', 'in_progress'])
    .lt('due_at', new Date().toISOString())
    .order('due_at', { ascending: true })
    .limit(100)

  if (error) throw new Error(`getOverdueTasks: ${error.message}`)
  return (data ?? []) as OperatorTask[]
}
