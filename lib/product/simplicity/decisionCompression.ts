// AGENCY GROUP — SH-ROS | AMI: 22506
// Product Simplicity Layer: Decision Compression
// Distils a flood of instructions into the single most impactful action
// Portugal context: 18% close rate, 210-day avg cycle, €320K avg deal, 5% commission

import logger from '@/lib/logger'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface RawDecision {
  decision_id: string
  instruction: string
  priority: number
  revenue_impact: number
  time_estimate: string
  confidence: number
}

export interface CompressedDecision {
  rank: number
  action: string
  why: string
  impact_label: string
  do_now: boolean
  revenue_eur: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const IMPACT_THRESHOLDS = [
  { min: 50000, label: 'Critical — €50K+' },
  { min: 20000, label: 'High — €20K–€50K' },
  { min: 5000,  label: 'Medium — €5K–€20K' },
  { min: 0,     label: 'Low — <€5K' },
]

function getImpactLabel(revenue: number): string {
  const threshold = IMPACT_THRESHOLDS.find(t => revenue >= t.min)
  return threshold?.label ?? 'Low — <€5K'
}

// ─── Class ────────────────────────────────────────────────────────────────────

class DecisionCompressor {
  compress(decisions: RawDecision[], maxOutput = 3): CompressedDecision[] {
    if (decisions.length === 0) return []

    const sorted = [...decisions].sort(
      (a, b) => (b.priority * b.revenue_impact * b.confidence) - (a.priority * a.revenue_impact * a.confidence)
    )

    const top = sorted.slice(0, maxOutput)

    const compressed: CompressedDecision[] = top.map((d, idx) => ({
      rank: idx + 1,
      action: d.instruction,
      why: `Priority ${d.priority} • ${d.time_estimate} • ${Math.round(d.confidence * 100)}% confidence`,
      impact_label: getImpactLabel(d.revenue_impact),
      do_now: d.priority === 1 && d.confidence >= 0.7,
      revenue_eur: d.revenue_impact,
    }))

    logger.info('[DecisionCompressor] compress', {
      input_count: decisions.length,
      output_count: compressed.length,
      top_revenue_eur: compressed[0]?.revenue_eur ?? 0,
    })

    return compressed
  }

  toSingleAction(decisions: RawDecision[]): string {
    if (decisions.length === 0) return 'No actions pending.'

    const sorted = [...decisions].sort(
      (a, b) => (b.priority * b.revenue_impact * b.confidence) - (a.priority * a.revenue_impact * a.confidence)
    )

    const top = sorted[0]
    return top.instruction
  }

  formatForRole(decision: CompressedDecision, role: 'agent' | 'broker' | 'executive'): string {
    switch (role) {
      case 'agent':
        return `[#${decision.rank}] ${decision.action} — ${decision.impact_label}${decision.do_now ? ' ⚡ DO NOW' : ''}`
      case 'broker':
        return `Priority ${decision.rank}: ${decision.action} | Revenue at stake: €${decision.revenue_eur.toLocaleString('pt-PT')} | ${decision.why}`
      case 'executive':
        return `RANK ${decision.rank} | ${decision.impact_label} | ${decision.action} | Confidence: ${decision.why}`
    }
  }

  getUrgentOnly(decisions: RawDecision[]): RawDecision[] {
    return decisions.filter(d => d.priority === 1)
  }
}

export const decisionCompressor = new DecisionCompressor()
