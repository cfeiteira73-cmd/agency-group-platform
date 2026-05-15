// AGENCY GROUP — SH-ROS | AMI: 22506
// Product Simplicity Layer: Operational Digest Engine
// Generates a daily/weekly single-screen health snapshot of the revenue pipeline
// Portugal context: 18% close rate, 210-day avg cycle, €320K avg deal, 5% commission

import logger from '@/lib/logger'

// ─── Interfaces ───────────────────────────────────────────────────────────────

export type DigestItemType = 'opportunity' | 'risk' | 'action' | 'win'

export interface DigestItem {
  type: DigestItemType
  title: string
  detail: string
  value_eur: number
  urgency: 'immediate' | 'today' | 'this_week'
}

export interface OperationalDigest {
  org_id: string
  date: string
  headline: string
  score: number        // 0-100 health score
  items: DigestItem[]
  one_sentence: string
  generated_at: Date
}

// ─── Class ────────────────────────────────────────────────────────────────────

class OperationalDigestEngine {
  generate(orgId: string, date: Date): OperationalDigest {
    // In production this would pull live data from Supabase/pipeline
    // Here we emit a well-structured empty-but-valid digest so callers can hydrate it
    const items: DigestItem[] = []
    const score = this.score(items)
    const headline = this.getHeadline(items, score)

    const digest: OperationalDigest = {
      org_id: orgId,
      date: date.toISOString().split('T')[0],
      headline,
      score,
      items,
      one_sentence: '',
      generated_at: new Date(),
    }

    digest.one_sentence = this.getOneSentence(digest)

    logger.info('[OperationalDigest] generate', {
      org_id: orgId,
      date: digest.date,
      score,
      item_count: items.length,
    })

    return digest
  }

  score(items: DigestItem[]): number {
    if (items.length === 0) return 75  // neutral baseline

    let score = 75

    for (const item of items) {
      if (item.type === 'win') {
        score += item.urgency === 'immediate' ? 8 : 5
      } else if (item.type === 'opportunity') {
        score += item.urgency === 'immediate' ? 4 : 2
      } else if (item.type === 'risk') {
        score -= item.urgency === 'immediate' ? 10 : 6
      } else if (item.type === 'action') {
        // Pending actions are neutral — neither boosts nor reduces
        score -= 1
      }
    }

    return Math.max(0, Math.min(100, score))
  }

  getHeadline(items: DigestItem[], score: number): string {
    const hotLeads = items.filter(i => i.type === 'opportunity' && i.urgency === 'immediate').length
    const risks    = items.filter(i => i.type === 'risk').length
    const wins     = items.filter(i => i.type === 'win').length
    const totalAtStake = items
      .filter(i => i.urgency === 'immediate')
      .reduce((sum, i) => sum + i.value_eur, 0)

    if (wins > 0 && score >= 85) {
      return `${wins} deal${wins > 1 ? 's' : ''} closed — pipeline is healthy 🏆`
    }
    if (hotLeads > 0 && totalAtStake > 0) {
      const atStakeStr = totalAtStake >= 1_000_000
        ? `€${(totalAtStake / 1_000_000).toFixed(1)}M`
        : `€${Math.round(totalAtStake / 1000)}K`
      return `${hotLeads} hot lead${hotLeads > 1 ? 's' : ''} need attention today — ${atStakeStr} at stake`
    }
    if (risks > 0) {
      return `${risks} risk${risks > 1 ? 's' : ''} detected — immediate action required`
    }
    if (score >= 80) return 'Pipeline is healthy — stay the course'
    if (score >= 60) return 'Pipeline needs attention — review actions below'
    return 'Critical: multiple pipeline risks require immediate action'
  }

  getOneSentence(digest: OperationalDigest): string {
    const actions = digest.items.filter(i => i.type === 'action').length
    const topValue = digest.items
      .sort((a, b) => b.value_eur - a.value_eur)[0]?.value_eur ?? 0
    const topValueStr = topValue >= 1_000_000
      ? `€${(topValue / 1_000_000).toFixed(1)}M`
      : topValue > 0 ? `€${Math.round(topValue / 1000)}K` : ''

    if (actions === 0 && topValue === 0) {
      return `Score ${digest.score}/100 — no urgent actions on ${digest.date}.`
    }
    const valueClause = topValueStr ? ` with ${topValueStr} top opportunity` : ''
    return `Score ${digest.score}/100 — ${actions} action${actions !== 1 ? 's' : ''} pending${valueClause} on ${digest.date}.`
  }
}

export const operationalDigestEngine = new OperationalDigestEngine()
