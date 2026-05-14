// AGENCY GROUP — SH-ROS Observability: replayMetrics | AMI: 22506

export interface ReplayStats {
  total_replays: number
  total_events_replayed: number
  error_rate: number
  avg_duration_ms: number
  last_replay_at: string | null
}

interface ReplayRecord {
  org_id: string
  type: string
  count: number
  duration_ms: number
  timestamp: string
  error?: string
}

export class ReplayMetricsCollector {
  private readonly _records: Map<string, ReplayRecord[]> = new Map()
  private readonly _errors: Map<string, string[]> = new Map()

  recordReplay(org_id: string, type: string, count: number, duration_ms: number): void {
    const key = org_id
    const records = this._records.get(key) ?? []
    records.push({ org_id, type, count, duration_ms, timestamp: new Date().toISOString() })
    if (records.length > 5000) records.shift()
    this._records.set(key, records)
  }

  recordReplayError(org_id: string, error: string): void {
    const errs = this._errors.get(org_id) ?? []
    errs.push(error)
    if (errs.length > 1000) errs.shift()
    this._errors.set(org_id, errs)
  }

  getReplayStats(org_id?: string): ReplayStats {
    let records: ReplayRecord[] = []

    if (org_id) {
      records = this._records.get(org_id) ?? []
    } else {
      for (const recs of this._records.values()) {
        records = records.concat(recs)
      }
    }

    let errorCount = 0
    if (org_id) {
      errorCount = (this._errors.get(org_id) ?? []).length
    } else {
      for (const errs of this._errors.values()) {
        errorCount += errs.length
      }
    }

    const total_replays = records.length
    const total_events_replayed = records.reduce((sum, r) => sum + r.count, 0)
    const total_operations = total_replays + errorCount
    const error_rate = total_operations > 0 ? errorCount / total_operations : 0
    const avg_duration_ms = total_replays > 0
      ? records.reduce((sum, r) => sum + r.duration_ms, 0) / total_replays
      : 0

    const last_replay_at = total_replays > 0
      ? records[records.length - 1].timestamp
      : null

    return {
      total_replays,
      total_events_replayed,
      error_rate,
      avg_duration_ms,
      last_replay_at,
    }
  }
}

export const replayMetrics = new ReplayMetricsCollector()
