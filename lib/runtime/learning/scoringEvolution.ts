// AGENCY GROUP — SH-ROS Learning: scoringEvolution | AMI: 22506
import { supabaseAdmin } from '@/lib/supabase'

export interface ScoreVersion {
  version: string
  org_id: string
  metric: string
  value: number
  algorithm: string
  recorded_at: string
  metadata: Record<string, unknown>
}

export interface ScoreEvolutionPoint {
  date: string
  value: number
  version: string
}

export interface ScoreDriftResult {
  drifted: boolean
  metrics_drifted: string[]
  max_drift_pct: number
  recommendation: string
}

export class ScoringEvolutionTracker {
  async recordScoreVersion(org_id: string, version: ScoreVersion): Promise<void> {
    try {
      await supabaseAdmin.from('learning_events').insert({
        event_type:    'score_version',
        source_system: 'agent',
        metadata:      { ...version, org_id },
      })
    } catch (err) {
      console.warn('[ScoringEvolutionTracker] record failed:', err instanceof Error ? err.message : String(err))
    }
  }

  async getEvolution(org_id: string, metric: string, period_days = 30): Promise<ScoreEvolutionPoint[]> {
    try {
      const since = new Date(Date.now() - period_days * 86_400_000).toISOString()
      const { data } = await supabaseAdmin
        .from('learning_events')
        .select('metadata, created_at')
        .eq('event_type', 'score_version')
        .gte('created_at', since)
        .order('created_at', { ascending: true })
        .limit(200)

      return (data ?? [])
        .filter(r => (r.metadata as Record<string, unknown> | null)?.org_id === org_id &&
                     (r.metadata as Record<string, unknown>)?.metric === metric)
        .map(r => {
          const m = r.metadata as Record<string, unknown>
          return {
            date:    r.created_at.slice(0, 10),
            value:   typeof m.value === 'number' ? m.value : 0,
            version: typeof m.version === 'string' ? m.version : 'unknown',
          }
        })
    } catch { return [] }
  }

  async detectDrift(org_id: string): Promise<ScoreDriftResult> {
    const metrics   = ['confidence', 'probability', 'ev_score', 'roi_accuracy']
    const drifted:  string[] = []
    let maxDrift = 0

    for (const metric of metrics) {
      const points = await this.getEvolution(org_id, metric, 14)
      if (points.length < 4) continue

      const half   = Math.floor(points.length / 2)
      const early  = points.slice(0, half).reduce((s, p) => s + p.value, 0) / half
      const recent = points.slice(half).reduce((s, p) => s + p.value, 0) / (points.length - half)

      if (early > 0) {
        const driftPct = Math.abs((recent - early) / early) * 100
        if (driftPct > 15) { drifted.push(metric); maxDrift = Math.max(maxDrift, driftPct) }
      }
    }

    return {
      drifted:         drifted.length > 0,
      metrics_drifted: drifted,
      max_drift_pct:   parseFloat(maxDrift.toFixed(2)),
      recommendation:  drifted.length > 0
        ? `Score drift detected in ${drifted.join(', ')}. Consider reviewing agent weights and recalibrating.`
        : 'Scores stable. No action required.',
    }
  }
}

export const scoringEvolutionTracker = new ScoringEvolutionTracker()
