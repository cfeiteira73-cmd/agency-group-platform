export type EventStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dlq'
export type EventPriority = 'critical' | 'high' | 'medium' | 'low'

export interface DBRuntimeEvent {
  event_id: string
  type: string
  org_id: string
  status: EventStatus
  priority: EventPriority
  source?: string | null
  latency_ms: number | null
  created_at: string
}
