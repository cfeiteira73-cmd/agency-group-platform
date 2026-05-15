// AGENCY GROUP — SH-ROS | AMI: 22506
import { logger } from '@/lib/observability/logger'

export interface EmbeddingMetric {
  metric_id: string
  name: string
  value: number      // 0-1
  weight: number     // importance 0-1
  description: string
}

export interface EmbeddingProfile {
  org_id: string
  embedding_score: number    // 0-100 weighted composite
  depth_label: 'surface' | 'integrated' | 'embedded' | 'mission_critical'
  metrics: EmbeddingMetric[]
  months_active: number
  data_volume_estimate: string
  assessed_at: Date
}

const DEPTH_THRESHOLDS = { surface: 25, integrated: 50, embedded: 75 } // >75 = mission_critical

const STANDARD_METRICS: Omit<EmbeddingMetric, 'value'>[] = [
  {
    metric_id: 'daily_active_users',
    name: 'Daily Active Users',
    weight: 0.20,
    description: 'Percentage of licensed seats active on a daily basis',
  },
  {
    metric_id: 'workflow_coverage',
    name: 'Workflow Coverage',
    weight: 0.18,
    description: 'Fraction of core business workflows that rely on the platform',
  },
  {
    metric_id: 'data_integration_depth',
    name: 'Data Integration Depth',
    weight: 0.15,
    description: 'Number and criticality of data sources connected to the platform',
  },
  {
    metric_id: 'api_call_volume',
    name: 'API Call Volume',
    weight: 0.12,
    description: 'Volume of API calls relative to capacity, indicating platform reliance',
  },
  {
    metric_id: 'custom_configurations',
    name: 'Custom Configurations',
    weight: 0.12,
    description: 'Extent of platform customisation (custom fields, rules, templates)',
  },
  {
    metric_id: 'team_certification',
    name: 'Team Certification',
    weight: 0.10,
    description: 'Percentage of team members trained and certified on the platform',
  },
  {
    metric_id: 'revenue_workflows_pct',
    name: 'Revenue Workflows %',
    weight: 0.08,
    description: 'Share of revenue-generating processes managed through the platform',
  },
  {
    metric_id: 'months_of_history',
    name: 'Months of History',
    weight: 0.05,
    description: 'Depth of historical data accumulated in the platform',
  },
]

class OperationalEmbeddingMetrics {
  assessOrg(orgId: string, rawMetrics: Record<string, number>): EmbeddingProfile {
    const metrics: EmbeddingMetric[] = STANDARD_METRICS.map((template) => ({
      ...template,
      value: Math.min(1, Math.max(0, rawMetrics[template.metric_id] ?? 0)),
    }))

    const embedding_score = this.calculateScore(metrics)
    const depth_label = this.getDepthLabel(embedding_score)

    const dauMetric = metrics.find((m) => m.metric_id === 'daily_active_users')
    const monthsMetric = metrics.find((m) => m.metric_id === 'months_of_history')
    const months_active = Math.round((monthsMetric?.value ?? 0) * 36) // normalised against 3-year ceiling
    const data_volume_estimate = this.estimateDataVolume(
      months_active,
      Math.round((dauMetric?.value ?? 0) * 100),
    )

    logger.info('[OperationalEmbeddingMetrics] org assessed', {
      orgId,
      embedding_score,
      depth_label,
    })

    return {
      org_id: orgId,
      embedding_score,
      depth_label,
      metrics,
      months_active,
      data_volume_estimate,
      assessed_at: new Date(),
    }
  }

  calculateScore(metrics: EmbeddingMetric[]): number {
    const raw = metrics.reduce((sum, m) => sum + m.value * m.weight, 0)
    return Math.min(100, Math.round(raw * 100))
  }

  getDepthLabel(score: number): EmbeddingProfile['depth_label'] {
    if (score <= DEPTH_THRESHOLDS.surface) return 'surface'
    if (score <= DEPTH_THRESHOLDS.integrated) return 'integrated'
    if (score <= DEPTH_THRESHOLDS.embedded) return 'embedded'
    return 'mission_critical'
  }

  getTopMetrics(profile: EmbeddingProfile, limit = 3): EmbeddingMetric[] {
    return [...profile.metrics]
      .sort((a, b) => b.value * b.weight - a.value * a.weight)
      .slice(0, limit)
  }

  estimateDataVolume(monthsActive: number, dailyActiveUsers: number): string {
    // Rough heuristic: each active user generates ~50 events/day
    const totalEvents = monthsActive * 30 * dailyActiveUsers * 50
    if (totalEvents < 1_000) return `~${totalEvents} events`
    if (totalEvents < 1_000_000) return `~${Math.round(totalEvents / 1_000)}K events`
    return `~${(totalEvents / 1_000_000).toFixed(1)}M events`
  }
}

export const operationalEmbeddingMetrics = new OperationalEmbeddingMetrics()
export default operationalEmbeddingMetrics
