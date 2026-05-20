// AGENCY GROUP — SH-ROS Observability: metricsRegistry | AMI: 22506
//
// Persistence strategy:
//   Counter/Gauge/Histogram values are in-memory for low-latency reads.
//   On every exportJSON() call, a snapshot is flushed to `runtime_events`
//   (event_type='metric_snapshot') so historical data survives cold starts.
//   Snapshot writes are fire-and-forget — never block the caller.

export interface MetricCounter {
  inc(amount?: number): void
  get(): number
  labels: Record<string, string>
}

export interface MetricGauge {
  set(value: number): void
  inc(amount?: number): void
  dec(amount?: number): void
  get(): number
  labels: Record<string, string>
}

export interface MetricHistogram {
  observe(value: number): void
  getStats(): {
    count: number
    sum: number
    buckets: Record<string, number>
    p50: number
    p95: number
    p99: number
  }
  labels: Record<string, string>
}

export interface MetricsSnapshot {
  timestamp: string
  counters: Record<string, number>
  gauges: Record<string, number>
  histograms: Record<string, ReturnType<MetricHistogram['getStats']>>
}

// ---------------------------------------------------------------------------
// Implementations
// ---------------------------------------------------------------------------

class CounterImpl implements MetricCounter {
  private value = 0
  labels: Record<string, string>

  constructor(labels: Record<string, string> = {}) {
    this.labels = labels
  }

  inc(amount = 1): void {
    this.value += amount
  }

  get(): number {
    return this.value
  }
}

class GaugeImpl implements MetricGauge {
  private value = 0
  labels: Record<string, string>

  constructor(labels: Record<string, string> = {}) {
    this.labels = labels
  }

  set(value: number): void {
    this.value = value
  }

  inc(amount = 1): void {
    this.value += amount
  }

  dec(amount = 1): void {
    this.value -= amount
  }

  get(): number {
    return this.value
  }
}

class HistogramImpl implements MetricHistogram {
  private observations: number[] = []
  private readonly defaultBuckets: number[]
  labels: Record<string, string>

  constructor(labels: Record<string, string> = {}, buckets?: number[]) {
    this.labels = labels
    this.defaultBuckets = buckets ?? [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000]
  }

  observe(value: number): void {
    this.observations.push(value)
    // Keep memory bounded: max 10000 observations per histogram
    if (this.observations.length > 10000) {
      this.observations.shift()
    }
  }

  getStats(): { count: number; sum: number; buckets: Record<string, number>; p50: number; p95: number; p99: number } {
    const sorted = [...this.observations].sort((a, b) => a - b)
    const count = sorted.length
    const sum = sorted.reduce((acc, v) => acc + v, 0)

    const buckets: Record<string, number> = {}
    for (const b of this.defaultBuckets) {
      buckets[String(b)] = sorted.filter((v) => v <= b).length
    }
    buckets['+Inf'] = count

    const percentile = (p: number): number => {
      if (count === 0) return 0
      const idx = Math.ceil((p / 100) * count) - 1
      return sorted[Math.max(0, idx)]
    }

    return {
      count,
      sum,
      buckets,
      p50: percentile(50),
      p95: percentile(95),
      p99: percentile(99),
    }
  }
}

// ---------------------------------------------------------------------------
// Supabase snapshot writer (lazy import to avoid circular deps)
// ---------------------------------------------------------------------------

async function persistMetricSnapshot(snapshot: MetricsSnapshot): Promise<void> {
  try {
    // Lazy import to avoid loading supabase on module init
    const { supabaseAdmin } = await import('@/lib/supabase')
    await supabaseAdmin.from('runtime_events').insert({
      org_id:          'agency-group',
      type:            'metric_snapshot',
      status:          'completed',
      correlation_id:  `metrics-${snapshot.timestamp}`,
      trace_id:        'system-metrics-registry',
      source_system:   'engine',
      payload: {
        counters:   snapshot.counters,
        gauges:     snapshot.gauges,
        // Histograms serialised as summary stats only (not raw observations)
        histograms: Object.fromEntries(
          Object.entries(snapshot.histograms).map(([k, v]) => [k, {
            count: v.count,
            sum:   v.sum,
            p50:   v.p50,
            p95:   v.p95,
            p99:   v.p99,
          }]),
        ),
      },
      event_timestamp: snapshot.timestamp,
    })
  } catch (err) {
    // Silently degrade — never break the metrics path
    console.warn('[MetricsRegistry] snapshot persist failed:', err)
  }
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export class MetricsRegistry {
  private counters: Map<string, CounterImpl> = new Map()
  private gauges: Map<string, GaugeImpl> = new Map()
  private histograms: Map<string, HistogramImpl> = new Map()
  /** Tracks last persist time to throttle snapshot writes (max once per 60s) */
  private _lastPersistMs = 0

  private metricKey(name: string, labels: Record<string, string> = {}): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}="${v}"`)
      .join(',')
    return labelStr ? `${name}{${labelStr}}` : name
  }

  counter(name: string, labels: Record<string, string> = {}): MetricCounter {
    const key = this.metricKey(name, labels)
    if (!this.counters.has(key)) {
      this.counters.set(key, new CounterImpl(labels))
    }
    return this.counters.get(key)!
  }

  gauge(name: string, labels: Record<string, string> = {}): MetricGauge {
    const key = this.metricKey(name, labels)
    if (!this.gauges.has(key)) {
      this.gauges.set(key, new GaugeImpl(labels))
    }
    return this.gauges.get(key)!
  }

  histogram(name: string, labels: Record<string, string> = {}, buckets?: number[]): MetricHistogram {
    const key = this.metricKey(name, labels)
    if (!this.histograms.has(key)) {
      this.histograms.set(key, new HistogramImpl(labels, buckets))
    }
    return this.histograms.get(key)!
  }

  exportPrometheus(): string {
    const lines: string[] = []
    const ts = Date.now()

    for (const [key, counter] of this.counters.entries()) {
      lines.push(`# TYPE ${key.split('{')[0]} counter`)
      lines.push(`${key} ${counter.get()} ${ts}`)
    }

    for (const [key, gauge] of this.gauges.entries()) {
      lines.push(`# TYPE ${key.split('{')[0]} gauge`)
      lines.push(`${key} ${gauge.get()} ${ts}`)
    }

    for (const [key, hist] of this.histograms.entries()) {
      const stats = hist.getStats()
      const baseName = key.split('{')[0]
      const labelPart = key.includes('{') ? key.slice(key.indexOf('{'), key.indexOf('}') + 1) : ''
      lines.push(`# TYPE ${baseName} histogram`)
      for (const [le, cnt] of Object.entries(stats.buckets)) {
        const bucketLabels = labelPart
          ? `${labelPart.slice(0, -1)},le="${le}"}`
          : `{le="${le}"}`
        lines.push(`${baseName}_bucket${bucketLabels} ${cnt} ${ts}`)
      }
      lines.push(`${baseName}_sum${labelPart} ${stats.sum} ${ts}`)
      lines.push(`${baseName}_count${labelPart} ${stats.count} ${ts}`)
    }

    return lines.join('\n')
  }

  exportJSON(): MetricsSnapshot {
    const counters: Record<string, number> = {}
    const gauges: Record<string, number> = {}
    const histograms: Record<string, ReturnType<MetricHistogram['getStats']>> = {}

    for (const [key, counter] of this.counters.entries()) {
      counters[key] = counter.get()
    }
    for (const [key, gauge] of this.gauges.entries()) {
      gauges[key] = gauge.get()
    }
    for (const [key, hist] of this.histograms.entries()) {
      histograms[key] = hist.getStats()
    }

    const snapshot: MetricsSnapshot = {
      timestamp: new Date().toISOString(),
      counters,
      gauges,
      histograms,
    }

    // Throttled fire-and-forget persist: max once per 60 seconds
    const nowMs = Date.now()
    if (nowMs - this._lastPersistMs >= 60_000) {
      this._lastPersistMs = nowMs
      void persistMetricSnapshot(snapshot)
    }

    return snapshot
  }

  reset(): void {
    this.counters.clear()
    this.gauges.clear()
    this.histograms.clear()
    this._registerStandardMetrics()
  }

  private _registerStandardMetrics(): void {
    // Pre-register SH-ROS standard metrics so they appear in exports even at zero
    this.counter('shros_events_total', { org_id: '', type: '', priority: '' })
    this.counter('shros_agents_total', { org_id: '', agent_id: '', status: '' })
    this.histogram('shros_event_duration_ms', { org_id: '', type: '' })
    this.gauge('shros_queue_lag', { org_id: '', provider: '' })
    this.counter('shros_dlq_total', { org_id: '' })
    this.histogram('shros_revenue_impact_eur', { org_id: '', agent_id: '' })
    this.histogram('shros_ev_score', { org_id: '', agent_id: '' })
    this.counter('shros_retry_total', { org_id: '', type: '' })
    this.gauge('shros_economic_score', { org_id: '' })
  }
}

export const metricsRegistry = new MetricsRegistry()
// Register standard metrics on singleton init
;(metricsRegistry as unknown as { _registerStandardMetrics(): void })['_registerStandardMetrics']?.()
