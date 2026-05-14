// AGENCY GROUP — SH-ROS Observability: workflowMetrics | AMI: 22506

export interface WorkflowStats {
  total_started: number
  total_completed: number
  total_failed: number
  total_compensated: number
  success_rate: number
  avg_duration_ms: number
  by_name: Record<string, { started: number; completed: number; failed: number }>
}

interface WorkflowRecord {
  workflow_name: string
  org_id: string
  started_at: number
  completed_at?: number
  failed: boolean
  step_id?: string
  compensated: boolean
}

export class WorkflowMetricsCollector {
  private readonly _records: Map<string, WorkflowRecord[]> = new Map()

  private _key(org_id?: string): string {
    return org_id ?? '__global__'
  }

  recordWorkflowStart(workflow_name: string, org_id: string): void {
    const k = this._key(org_id)
    const recs = this._records.get(k) ?? []
    recs.push({
      workflow_name,
      org_id,
      started_at: Date.now(),
      failed: false,
      compensated: false,
    })
    if (recs.length > 10000) recs.shift()
    this._records.set(k, recs)
  }

  recordWorkflowComplete(workflow_name: string, org_id: string, duration_ms: number): void {
    const k = this._key(org_id)
    const recs = this._records.get(k) ?? []
    // Find the most recent unfinished record for this workflow
    for (let i = recs.length - 1; i >= 0; i--) {
      const r = recs[i]
      if (r.workflow_name === workflow_name && !r.completed_at && !r.failed) {
        r.completed_at = r.started_at + duration_ms
        break
      }
    }
    this._records.set(k, recs)
  }

  recordWorkflowFail(workflow_name: string, org_id: string, step_id?: string): void {
    const k = this._key(org_id)
    const recs = this._records.get(k) ?? []
    for (let i = recs.length - 1; i >= 0; i--) {
      const r = recs[i]
      if (r.workflow_name === workflow_name && !r.completed_at && !r.failed) {
        r.failed = true
        r.step_id = step_id
        r.completed_at = Date.now()
        break
      }
    }
    this._records.set(k, recs)
  }

  recordCompensation(workflow_name: string, org_id: string): void {
    const k = this._key(org_id)
    const recs = this._records.get(k) ?? []
    for (let i = recs.length - 1; i >= 0; i--) {
      const r = recs[i]
      if (r.workflow_name === workflow_name && r.failed && !r.compensated) {
        r.compensated = true
        break
      }
    }
    this._records.set(k, recs)
  }

  getWorkflowStats(org_id?: string): WorkflowStats {
    let records: WorkflowRecord[] = []

    if (org_id) {
      records = this._records.get(this._key(org_id)) ?? []
    } else {
      for (const recs of this._records.values()) {
        records = records.concat(recs)
      }
    }

    const total_started = records.length
    const total_completed = records.filter((r) => r.completed_at && !r.failed).length
    const total_failed = records.filter((r) => r.failed).length
    const total_compensated = records.filter((r) => r.compensated).length

    const success_rate = total_started > 0 ? total_completed / total_started : 0

    const durations = records
      .filter((r) => r.completed_at)
      .map((r) => r.completed_at! - r.started_at)

    const avg_duration_ms = durations.length > 0
      ? durations.reduce((s, v) => s + v, 0) / durations.length
      : 0

    // Aggregate by name
    const by_name: Record<string, { started: number; completed: number; failed: number }> = {}
    for (const r of records) {
      if (!by_name[r.workflow_name]) {
        by_name[r.workflow_name] = { started: 0, completed: 0, failed: 0 }
      }
      by_name[r.workflow_name].started++
      if (r.completed_at && !r.failed) by_name[r.workflow_name].completed++
      if (r.failed) by_name[r.workflow_name].failed++
    }

    return {
      total_started,
      total_completed,
      total_failed,
      total_compensated,
      success_rate,
      avg_duration_ms,
      by_name,
    }
  }
}

export const workflowMetrics = new WorkflowMetricsCollector()
