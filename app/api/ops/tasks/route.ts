// GET  /api/ops/tasks  — list pending/overdue tasks
// POST /api/ops/tasks  — create | claim | complete | cancel | escalate

import { NextRequest, NextResponse }   from 'next/server'
import { safeCompare }                 from '@/lib/safeCompare'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import { logAction, buildAuditEntry }  from '@/lib/auth/auditLog'
import {
  buildTask,
  createTask,
  claimTask,
  completeTask,
  cancelTask,
  escalateTask,
  getPendingTasks,
  getOverdueTasks,
  sortTasksByPriority,
} from '@/lib/ops/operatorTasks'
import type { TaskType, TaskPriority } from '@/lib/ops/operatorTasks'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const user       = await getAdminRole(authHeader ?? '')
  if (!user || !hasPermission(user.role, 'system:read_jobs')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url       = new URL(req.url)
  const mine      = url.searchParams.get('mine') === 'true'
  const overdue   = url.searchParams.get('overdue') === 'true'
  const taskType  = url.searchParams.get('type') as TaskType | null

  try {
    let tasks = overdue
      ? await getOverdueTasks()
      : await getPendingTasks({
          assignedTo: mine ? user.user_email : undefined,
          taskType:   taskType ?? undefined,
        })

    tasks = sortTasksByPriority(tasks)

    return NextResponse.json({
      tasks,
      count:         tasks.length,
      overdue_count: tasks.filter(t => t.due_at && new Date(t.due_at) < new Date()).length,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const isService  = safeCompare(authHeader ?? '', process.env.CRON_SECRET ?? '')
  let actorEmail   = 'service'

  if (!isService) {
    const user = await getAdminRole(authHeader ?? '')
    if (!user || !hasPermission(user.role, 'system:read_jobs')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    actorEmail = user.user_email
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { action } = body

  // CREATE
  if (!action || action === 'create') {
    const { task_type, title } = body
    if (!task_type || !title) {
      return NextResponse.json({ error: 'task_type and title required' }, { status: 400 })
    }
    try {
      const payload = buildTask(task_type as TaskType, title as string, {
        description:   body.description   as string | undefined,
        priority:      body.priority      as TaskPriority | undefined,
        assignedTo:    body.assigned_to   as string | undefined,
        assignedBy:    actorEmail,
        propertyId:    body.property_id   as string | undefined,
        alertId:       body.alert_id      as string | undefined,
        incidentId:    body.incident_id   as string | undefined,
        dueInHours:    body.due_in_hours  != null ? Number(body.due_in_hours) : undefined,
        dueAt:         body.due_at        as string | undefined,
        opsNotes:      body.ops_notes     as string | undefined,
      })
      const id = await createTask(payload)
      await logAction(buildAuditEntry(actorEmail, 'create_operator_task', 'operator_task', id, { newValue: { task_type, title } }))
      return NextResponse.json({ success: true, id })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Internal error' },
        { status: 500 },
      )
    }
  }

  const { id } = body
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id required for this action' }, { status: 400 })
  }

  try {
    if (action === 'claim') {
      await claimTask(id, actorEmail)
      return NextResponse.json({ success: true, id, status: 'in_progress' })
    }

    if (action === 'complete') {
      await completeTask(id, actorEmail, body.resolution as string | undefined)
      return NextResponse.json({ success: true, id, status: 'completed' })
    }

    if (action === 'cancel') {
      await cancelTask(id, body.reason as string | undefined)
      return NextResponse.json({ success: true, id, status: 'cancelled' })
    }

    if (action === 'escalate') {
      if (!body.reason) return NextResponse.json({ error: 'reason required to escalate' }, { status: 400 })
      await escalateTask(id, actorEmail, body.reason as string)
      return NextResponse.json({ success: true, id, status: 'escalated' })
    }

    return NextResponse.json({ error: 'Unknown action — use create|claim|complete|cancel|escalate' }, { status: 400 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
