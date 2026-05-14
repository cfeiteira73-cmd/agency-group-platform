// AGENCY GROUP — SH-ROS Cold Memory: anomalyDetection | AMI: 22506
import { supabaseAdmin } from '@/lib/supabase'

export interface AnomalyResult {
  detected: boolean
  metric: string
  value: number
  baseline_mean: number
  baseline_stddev: number
  z_score: number
  severity: 'none' | 'minor' | 'moderate' | 'severe'
  description: string
}

export interface BaselineStats {
  metric: string
  mean: number
  stddev: number
  min: number
  max: number
  sample_count: number
  period_days: number
}

export class AnomalyDetector {
  async detect(
    org_id: string,
    metric: string,
    value: number,
    _context?: Record<string, unknown>,
  ): Promise<AnomalyResult> {
    const baseline = await this.getBaseline(org_id, metric)

    if (baseline.sample_count < 5) {
      return {
        detected: false, metric, value,
        baseline_mean: baseline.mean, baseline_stddev: baseline.stddev,
        z_score: 0, severity: 'none',
        description: 'Insufficient baseline data',
      }
    }

    const z = baseline.stddev > 0 ? Math.abs(value - baseline.mean) / baseline.stddev : 0
    const severity: AnomalyResult['severity'] =
      z > 4 ? 'severe' : z > 3 ? 'moderate' : z > 2 ? 'minor' : 'none'

    const result: AnomalyResult = {
      detected: z > 2, metric, value,
      baseline_mean:   baseline.mean,
      baseline_stddev: baseline.stddev,
      z_score: parseFloat(z.toFixed(3)),
      severity,
      description: z > 2
        ? `${metric} deviates ${z.toFixed(1)}σ from baseline (${baseline.mean.toFixed(2)} ± ${baseline.stddev.toFixed(2)})`
        : `${metric} within normal range`,
    }

    if (z > 2) await this.reportAnomaly(org_id, result)
    return result
  }

  async getBaseline(org_id: string, metric: string, period_days = 30): Promise<BaselineStats> {
    const since = new Date(Date.now() - period_days * 86_400_000).toISOString()

    try {
      const { data } = await supabaseAdmin
        .from('learning_events')
        .select('metadata')
        .eq('event_type', 'anomaly_baseline')
        .eq('agent_email', `metric:${metric}`)
        .gte('created_at', since)
        .limit(200)

      const values = (data ?? [])
        .map(r => (r.metadata as Record<string, unknown> | null)?.value as number | undefined)
        .filter((v): v is number => typeof v === 'number')

      if (values.length === 0) return { metric, mean: 0, stddev: 0, min: 0, max: 0, sample_count: 0, period_days }

      const mean   = values.reduce((a, b) => a + b, 0) / values.length
      const stddev = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length)

      return {
        metric, mean, stddev,
        min: Math.min(...values), max: Math.max(...values),
        sample_count: values.length, period_days,
      }
    } catch {
      return { metric, mean: 0, stddev: 0, min: 0, max: 0, sample_count: 0, period_days }
    }
  }

  async reportAnomaly(org_id: string, anomaly: AnomalyResult): Promise<void> {
    try {
      await supabaseAdmin.from('learning_events').insert({
        event_type:    'anomaly_detected',
        source_system: 'agent',
        metadata:      { org_id, ...anomaly },
      })

      if (anomaly.severity === 'severe' || anomaly.severity === 'moderate') {
        await supabaseAdmin.from('system_alerts').insert({
          alert_type:    'anomaly',
          severity:      anomaly.severity === 'severe' ? 'P1' : 'P2',
          title:         `Anomaly: ${anomaly.metric}`,
          message:       anomaly.description,
          resource_type: 'sh-ros-anomaly',
          status:        'open' as const,
          metadata:      { org_id, ...anomaly },
        })
      }
    } catch (err) {
      console.warn('[AnomalyDetector] reportAnomaly failed:', err instanceof Error ? err.message : String(err))
    }
  }
}

export const anomalyDetector = new AnomalyDetector()
