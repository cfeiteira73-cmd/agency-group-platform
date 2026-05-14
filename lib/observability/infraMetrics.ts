// AGENCY GROUP — SH-ROS Observability: infraMetrics | AMI: 22506

export interface InfraHealthReport {
  db_latency_p50: number
  db_latency_p99: number
  api_latency_p50: number
  api_latency_p99: number
  error_rate_pct: number
  worker_health_pct: number
  computed_at: string
}

const MAX_SAMPLES = 5000

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.max(0, idx)]
}

export class InfraMetricsCollector {
  private readonly _dbLatencies: number[] = []
  private readonly _apiLatencies: number[] = []
  private _apiRequests = 0
  private _apiErrors = 0
  private readonly _workers: Map<string, boolean> = new Map()

  recordDBLatency(operation: string, latency_ms: number): void {
    void operation // stored in histogram, label not needed for aggregation
    this._dbLatencies.push(latency_ms)
    if (this._dbLatencies.length > MAX_SAMPLES) this._dbLatencies.shift()
  }

  recordAPILatency(endpoint: string, latency_ms: number, status_code: number): void {
    void endpoint
    this._apiLatencies.push(latency_ms)
    if (this._apiLatencies.length > MAX_SAMPLES) this._apiLatencies.shift()
    this._apiRequests++
    if (status_code >= 500) this._apiErrors++
  }

  recordWorkerHealth(worker_id: string, healthy: boolean): void {
    this._workers.set(worker_id, healthy)
  }

  getInfraHealth(): InfraHealthReport {
    const dbSorted = [...this._dbLatencies].sort((a, b) => a - b)
    const apiSorted = [...this._apiLatencies].sort((a, b) => a - b)

    const error_rate_pct = this._apiRequests > 0
      ? (this._apiErrors / this._apiRequests) * 100
      : 0

    const workerCount = this._workers.size
    const healthyCount = [...this._workers.values()].filter(Boolean).length
    const worker_health_pct = workerCount > 0
      ? (healthyCount / workerCount) * 100
      : 100

    return {
      db_latency_p50: percentile(dbSorted, 50),
      db_latency_p99: percentile(dbSorted, 99),
      api_latency_p50: percentile(apiSorted, 50),
      api_latency_p99: percentile(apiSorted, 99),
      error_rate_pct,
      worker_health_pct,
      computed_at: new Date().toISOString(),
    }
  }
}

export const infraMetrics = new InfraMetricsCollector()
