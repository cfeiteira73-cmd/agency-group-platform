// AGENCY GROUP — SH-ROS Queue: queueBackpressure | AMI: 22506
// Backpressure control with per-org sliding window latency tracking.
// Thresholds: light=p95>1000ms, moderate=p95>2000ms, severe=p95>5000ms

// ─── Types ────────────────────────────────────────────────────────────────────

type BackpressureLevel = 'none' | 'light' | 'moderate' | 'severe'

// ─── BackpressureController ───────────────────────────────────────────────────

export class BackpressureController {
  private readonly WINDOW = 100
  /** org_id → circular buffer of latencies */
  private readonly windows = new Map<string, number[]>()

  // ── recordLatency ──────────────────────────────────────────────────────────

  recordLatency(org_id: string, latency_ms: number): void {
    let buf = this.windows.get(org_id)
    if (!buf) {
      buf = []
      this.windows.set(org_id, buf)
    }
    buf.push(latency_ms)
    if (buf.length > this.WINDOW) {
      buf.shift()
    }
  }

  // ── isBackpressured ────────────────────────────────────────────────────────

  isBackpressured(org_id: string): boolean {
    return this.getBackpressureLevel(org_id) !== 'none'
  }

  // ── getBackpressureLevel ───────────────────────────────────────────────────

  getBackpressureLevel(org_id: string): BackpressureLevel {
    const buf = this.windows.get(org_id)
    if (!buf || buf.length < 5) return 'none'

    const p95 = this.percentile([...buf].sort((a, b) => a - b), 95)

    if (p95 > 5_000) return 'severe'
    if (p95 > 2_000) return 'moderate'
    if (p95 > 1_000) return 'light'
    return 'none'
  }

  // ── getSuggestedDelayMs ────────────────────────────────────────────────────

  getSuggestedDelayMs(org_id: string): number {
    const level = this.getBackpressureLevel(org_id)
    switch (level) {
      case 'none':     return 0
      case 'light':    return 500
      case 'moderate': return 2_000
      case 'severe':   return 5_000
    }
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0
    const idx = Math.ceil((p / 100) * sorted.length) - 1
    return sorted[Math.max(0, idx)] ?? 0
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const backpressureController = new BackpressureController()
