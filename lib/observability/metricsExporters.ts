// AGENCY GROUP — SH-ROS Observability: metricsExporters | AMI: 22506

import type { MetricsRegistry } from './metricsRegistry'

export interface DatadogMetricsBatch {
  series: Array<{
    metric: string
    points: [[number, number]]
    tags: string[]
    type: 'count' | 'gauge' | 'rate'
  }>
}

export class MetricsExporter {
  exportPrometheus(registry: MetricsRegistry): string {
    return registry.exportPrometheus()
  }

  exportDatadog(registry: MetricsRegistry): DatadogMetricsBatch {
    const snapshot = registry.exportJSON()
    const now = Math.floor(Date.now() / 1000)
    const series: DatadogMetricsBatch['series'] = []

    for (const [key, value] of Object.entries(snapshot.counters)) {
      const { name, tags } = this._parseKey(key)
      series.push({
        metric: name,
        points: [[now, value]],
        tags,
        type: 'count',
      })
    }

    for (const [key, value] of Object.entries(snapshot.gauges)) {
      const { name, tags } = this._parseKey(key)
      series.push({
        metric: name,
        points: [[now, value]],
        tags,
        type: 'gauge',
      })
    }

    for (const [key, stats] of Object.entries(snapshot.histograms)) {
      const { name, tags } = this._parseKey(key)
      // Emit p50, p95, p99, count, sum as separate series
      for (const [suffix, value] of Object.entries({
        p50: stats.p50,
        p95: stats.p95,
        p99: stats.p99,
        count: stats.count,
        sum: stats.sum,
      })) {
        series.push({
          metric: `${name}.${suffix}`,
          points: [[now, value]],
          tags,
          type: suffix === 'count' ? 'count' : 'gauge',
        })
      }
    }

    return { series }
  }

  exportJSON(registry: MetricsRegistry): Record<string, unknown> {
    const snapshot = registry.exportJSON()
    return {
      ...snapshot,
      meta: {
        exporter: 'agency-group-sh-ros',
        format: 'json',
        version: '1.0',
      },
    }
  }

  private _parseKey(key: string): { name: string; tags: string[] } {
    const braceIdx = key.indexOf('{')
    if (braceIdx === -1) return { name: key, tags: [] }

    const name = key.slice(0, braceIdx)
    const labelPart = key.slice(braceIdx + 1, key.lastIndexOf('}'))
    const tags: string[] = []

    for (const pair of labelPart.split(',')) {
      const [k, v] = pair.split('=')
      if (k && v) {
        tags.push(`${k}:${v.replace(/"/g, '')}`)
      }
    }

    return { name, tags }
  }
}

export const metricsExporter = new MetricsExporter()
