// =============================================================================
// Agency Group — Data Moat Scoring Engine
// lib/commercial/moat.ts
//
// Computes a 0–100 competitive defensibility score for the platform based on
// proprietary data accumulation across 5 dimensions.
//
// Usage:
//   import { computeMoatScore } from '@/lib/commercial/moat'
//   const score = await computeMoatScore()
// =============================================================================

import { supabaseAdmin } from '@/lib/supabase'
import log from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MoatScore {
  overall_score: number         // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  dimensions: {
    data_volume: number         // contacts + offmarket_leads + deals count → score
    data_quality: number        // avg data quality score from data_quality_events or contacts
    network_effects: number     // referrals count, partner count → network score
    proprietary_intel: number   // learning_events, market_feedback_signals → intel score
    automation_depth: number    // automations_log count over 30d → automation score
  }
  top_strengths: string[]
  top_risks: string[]
  computed_at: string
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

/** Scale a raw count to 0–100 given a target (100% at target) */
function scaleCount(count: number, target: number): number {
  return Math.min(100, Math.round((count / target) * 100))
}

function deriveGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
  if (score >= 80) return 'A'
  if (score >= 65) return 'B'
  if (score >= 50) return 'C'
  if (score >= 35) return 'D'
  return 'F'
}

// Dimension labels for strengths/risks output
const DIMENSION_LABELS: Record<keyof MoatScore['dimensions'], string> = {
  data_volume:       'Volume de Dados',
  data_quality:      'Qualidade de Dados',
  network_effects:   'Efeitos de Rede',
  proprietary_intel: 'Intel Proprietário',
  automation_depth:  'Profundidade de Automação',
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

export async function computeMoatScore(): Promise<MoatScore> {
  const sb = supabaseAdmin
  const now = new Date().toISOString()
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString()

  try {
    // ── Parallel queries ────────────────────────────────────────────────────
    const [
      contactsResult,
      dealsResult,
      learningResult,
      automationsResult,
      referralsResult,
      partnersResult,
    ] = await Promise.allSettled([
      // 1. contacts count → data_volume
      sb.from('contacts').select('*', { count: 'exact', head: true }),

      // 2. deals count → data_volume bonus
      sb.from('deals').select('*', { count: 'exact', head: true }),

      // 3. learning_events count → proprietary_intel
      sb.from('learning_events').select('*', { count: 'exact', head: true }),

      // 4. automations_log last 30d → automation_depth
      sb.from('automations_log')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo),

      // 5. referrals count → network_effects
      sb.from('referrals').select('*', { count: 'exact', head: true }),

      // 6. institutional_partners count → network_effects bonus
      sb.from('institutional_partners').select('*', { count: 'exact', head: true }),
    ])

    const getCount = (result: PromiseSettledResult<{ count: number | null }>): number => {
      if (result.status === 'fulfilled') return result.value.count ?? 0
      return 0
    }

    const contactsCount   = getCount(contactsResult as PromiseSettledResult<{ count: number | null }>)
    const dealsCount      = getCount(dealsResult as PromiseSettledResult<{ count: number | null }>)
    const learningCount   = getCount(learningResult as PromiseSettledResult<{ count: number | null }>)
    const automationsCount = getCount(automationsResult as PromiseSettledResult<{ count: number | null }>)
    const referralsCount  = getCount(referralsResult as PromiseSettledResult<{ count: number | null }>)
    const partnersCount   = getCount(partnersResult as PromiseSettledResult<{ count: number | null }>)

    // ── Compute dimension scores ────────────────────────────────────────────

    // data_volume: contacts (target 500) + deals bonus (target 100)
    const contactScore = scaleCount(contactsCount, 500)
    const dealsBonus   = scaleCount(dealsCount, 100)
    const data_volume  = Math.round(contactScore * 0.7 + dealsBonus * 0.3)

    // data_quality: try data_quality_events, fallback to contacts with email (proxy)
    let data_quality = 50 // baseline
    try {
      const { data: dqData } = await sb
        .from('data_quality_events')
        .select('score')
        .limit(200)
      if (dqData && dqData.length > 0) {
        const avg = dqData.reduce((sum: number, r) => sum + ((r.score ?? 50) as number), 0) / dqData.length
        data_quality = Math.min(100, Math.round(avg))
      } else {
        // Fallback: contacts with email populated as quality proxy
        const { count: withEmail } = await sb
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .not('email', 'is', null)
        if (contactsCount > 0 && withEmail != null) {
          data_quality = Math.min(100, Math.round((withEmail / Math.max(contactsCount, 1)) * 100))
        }
      }
    } catch {
      // Keep baseline 50
    }

    // network_effects: referrals (target 50) + partners (target 10)
    const referralScore = scaleCount(referralsCount, 50)
    const partnerScore  = scaleCount(partnersCount, 10)
    const network_effects = Math.round(referralScore * 0.6 + partnerScore * 0.4)

    // proprietary_intel: learning_events (target 1000) + market_feedback bonus
    let mfCount = 0
    try {
      const { count } = await sb
        .from('market_feedback_signals')
        .select('*', { count: 'exact', head: true })
      mfCount = count ?? 0
    } catch {
      // table may not exist yet
    }
    const learningScore = scaleCount(learningCount, 1000)
    const mfBonus       = scaleCount(mfCount, 200)
    const proprietary_intel = Math.round(learningScore * 0.7 + mfBonus * 0.3)

    // automation_depth: automations last 30d (target 200 runs)
    const automation_depth = scaleCount(automationsCount, 200)

    // ── Overall score: weighted average ────────────────────────────────────
    const dimensions = {
      data_volume,
      data_quality,
      network_effects,
      proprietary_intel,
      automation_depth,
    }

    const overall_score = Math.round(
      data_volume       * 0.25 +
      data_quality      * 0.20 +
      network_effects   * 0.20 +
      proprietary_intel * 0.20 +
      automation_depth  * 0.15
    )

    const grade = deriveGrade(overall_score)

    // ── Strengths & Risks ───────────────────────────────────────────────────
    const top_strengths: string[] = []
    const top_risks:     string[] = []

    for (const [key, score] of Object.entries(dimensions) as Array<[keyof MoatScore['dimensions'], number]>) {
      const label = DIMENSION_LABELS[key]
      if (score > 70) top_strengths.push(label)
      if (score < 40) top_risks.push(label)
    }

    log.info('[moat] score computed', { route: 'lib/commercial/moat', overall_score, grade })

    return {
      overall_score,
      grade,
      dimensions,
      top_strengths,
      top_risks,
      computed_at: now,
    }
  } catch (err) {
    log.error('[moat] computeMoatScore failed — returning zero score', err instanceof Error ? err : new Error(String(err)), { route: 'lib/commercial/moat' })

    // Graceful fallback — never throw
    return {
      overall_score: 0,
      grade: 'F',
      dimensions: {
        data_volume: 0,
        data_quality: 0,
        network_effects: 0,
        proprietary_intel: 0,
        automation_depth: 0,
      },
      top_strengths: [],
      top_risks: ['Volume de Dados', 'Qualidade de Dados', 'Efeitos de Rede', 'Intel Proprietário', 'Profundidade de Automação'],
      computed_at: now,
    }
  }
}
