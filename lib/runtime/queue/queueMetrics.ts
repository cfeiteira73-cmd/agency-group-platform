// AGENCY GROUP — SH-ROS Queue: queueMetrics | AMI: 22506
// In-process queue metrics aggregation with a sliding window (last 10 000 operations).

import type { QueueMetrics } from './queueProvider'

// ─── Internal operation record ────────────────────────────────────────────────

type OpKind = 'enqueue' | 'dequeue' | 'ack' | 'nack' | 'dlq' | 'replay'

interface OpRecord {
  kind: OpKind
  org_id: string
  latency_ms: number
  at: number // Date.now()
}

// ─── QueueMetricsCollector ────────────────────────────────────────────────────

export class QueueMetricsCollector {
  private readonly WINDOW = 10_000
  private ops: OpRecord[] = []
  private startAt = Date.now()

  // ── record helpers ─────────────────────────────────────────────────────────

  recordEnqueue(org_id: string, _priority: string, latency_ms: number): void {
    this.push({ kind: 'enqueue', org_id, latency_ms, at: Date.now() })
  }

  recordDequeue(org_id: string, latency_ms: number): void {
    this.push({ kind: 'dequeue', org_id, latency_ms, at: Date.now() })
  }

  recordAck(org_id: string): void {
    this.push({ kind: 'ack', org_id, latency_ms: 0, at: Date.now() })
  }

  recordNack(org_id: string): void {
    this.push({ kind: 'nack', org_id, latency_ms: 0, at: Date.now() })
  }

  recordDLQ(org_id: string): void {
    this.push({ kind: 'dlq', org_id, latency_ms: 0, at: Date.now() })
  }

  recordReplay(org_id: string, count: number): void {
    for (let i = 0; i < count; i++) {
      this.push({ kind: 'replay', org_id, latency_ms: 0, at: Date.now() })
    }
  }

  // ── getMetrics ─────────────────────────────────────────────────────────────

  getMetrics(org_id?: string): QueueMetrics {
    const ops = org_id ? this.ops.filter((o) => o.org_id === org_id) : this.ops
    const now = Date.now()
    const windowMs = now - this.startAt || 1

    const count = (kind: OpKind) => ops.filter((o) => o.kind === kind).length
    const oneMinAgo = now - 60_000
    const throughput = ops.filter((o) => o.kind === 'enqueue' && o.at >= oneMinAgo).length

    return {
      provider: 'in-process',
      org_id,
      enqueued_total: count('enqueue'),
      dequeued_total: count('dequeue'),
      ack_total: count('ack'),
      nack_total: count('nack'),
      dlq_total: count('dlq'),
      replay_total: count('replay'),
      lag: Math.max(0, count('enqueue') - count('ack') - count('dlq')),
      throughput_per_min: throughput,
      partition_count: 1,
      consumer_count: 1,
    }
  }

  // ── getPercentiles ─────────────────────────────────────────────────────────

  getPercentiles(): { p50: number; p95: number; p99: number } {
    const latencies = this.ops
      .filter((o) => o.latency_ms > 0)
      .map((o) => o.latency_ms)
      .sort((a, b) => a - b)

    if (latencies.length === 0) return { p50: 0, p95: 0, p99: 0 }

    return {
      p50: this.percentile(latencies, 50),
      p95: this.percentile(latencies, 95),
      p99: this.percentile(latencies, 99),
    }
  }

  // ── reset ──────────────────────────────────────────────────────────────────

  reset(): void {
    this.ops = []
    this.startAt = Date.now()
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private push(op: OpRecord): void {
    this.ops.push(op)
    // Evict oldest if over window
    if (this.ops.length > this.WINDOW) {
      this.ops.splice(0, this.ops.length - this.WINDOW)
    }
  }

  private percentile(sorted: number[], p: number): number {
    const idx = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[Math.max(0, idx)] ?? 0
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const queueMetricsCollector = new QueueMetricsCollector()
