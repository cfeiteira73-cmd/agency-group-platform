// POST /api/analytics/simulation  — run a scoring simulation / backtest
// GET  /api/analytics/simulation  — list simulations for a model version

import { NextRequest, NextResponse }   from 'next/server'
import { getAdminRole, hasPermission } from '@/lib/auth/adminAuth'
import {
  createSimulation,
  completeSimulation,
  computeBacktestMetrics,
  computeGradeDistribution,
  computeModelDelta,
  scoreToGrade,
} from '@/lib/intelligence/modelVersioning'
import type { SimulationResult } from '@/lib/intelligence/modelVersioning'

export const runtime = 'nodejs'
export const maxDuration = 60   // simulations can take time

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const user       = await getAdminRole(authHeader ?? '')
  if (!user || !hasPermission(user.role, 'analytics:read')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const url       = new URL(req.url)
  const versionId = url.searchParams.get('version_id')

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { createClient } = await import('@supabase/supabase-js')
    void createClient   // not used directly — access through supabaseAdmin
    const { supabaseAdmin } = await import('@/lib/supabase')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query = (supabaseAdmin as any)
      .from('calibration_simulations')
      .select('id, simulation_name, status, metrics, run_by, started_at, completed_at, created_at, model_version_id')
      .order('created_at', { ascending: false })
      .limit(20)

    if (versionId) query = query.eq('model_version_id', versionId)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ simulations: data ?? [], count: (data ?? []).length })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')?.replace('Bearer ', '')
  const user       = await getAdminRole(authHeader ?? '')
  if (!user || !hasPermission(user.role, 'commercial:write')) {
    return NextResponse.json({ error: 'Forbidden — requires ops_manager or higher' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { model_version_id, simulation_name, property_ids, description, thresholds } = body

  if (!model_version_id) {
    return NextResponse.json({ error: 'model_version_id required' }, { status: 400 })
  }
  if (!simulation_name) {
    return NextResponse.json({ error: 'simulation_name required' }, { status: 400 })
  }

  const propIds = Array.isArray(property_ids) ? property_ids as string[] : undefined

  try {
    // Create simulation record
    const simId = await createSimulation({
      modelVersionId: model_version_id as string,
      simulationName: simulation_name  as string,
      description:    description      as string | undefined,
      propertyIds:    propIds,
      runBy:          user.user_email,
    })

    // Fetch properties + their current scores from scoring_feedback_events
    const { supabaseAdmin } = await import('@/lib/supabase')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let propQuery = (supabaseAdmin as any)
      .from('scoring_feedback_events')
      .select('property_id, opportunity_score, grade')
      .not('opportunity_score', 'is', null)
      .limit(propIds?.length ? propIds.length : 200)

    if (propIds?.length) {
      propQuery = propQuery.in('property_id', propIds)
    }

    const { data: feedbackRows } = await propQuery

    // Fetch outcomes
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: outcomeRows } = await (supabaseAdmin as any)
      .from('transaction_outcomes')
      .select('property_id, outcome_type')
      .in('outcome_type', ['won', 'lost'])

    const outcomes = (outcomeRows ?? []).map((r: { property_id: string; outcome_type: string }) => ({
      property_id: r.property_id,
      won:         r.outcome_type === 'won',
    }))

    const modelThresholds = (thresholds as Parameters<typeof scoreToGrade>[1]) ?? {}

    // Simulate: apply grade thresholds from new model version
    const results: SimulationResult[] = (feedbackRows ?? []).map((r: {
      property_id: string
      opportunity_score: number
      grade: string
    }) => {
      const currentScore    = r.opportunity_score
      const simulatedScore  = currentScore    // score formula unchanged — only thresholds vary
      const currentGrade    = r.grade
      const simulatedGrade  = scoreToGrade(simulatedScore, modelThresholds)
      return {
        property_id:     r.property_id,
        current_score:   currentScore,
        simulated_score: simulatedScore,
        delta:           simulatedScore - currentScore,
        current_grade:   currentGrade,
        simulated_grade: simulatedGrade,
        grade_changed:   currentGrade !== simulatedGrade,
      }
    })

    const metrics     = computeBacktestMetrics(results, outcomes, modelThresholds)
    const delta       = computeModelDelta(results)
    const comparison  = {
      current_distribution:   computeGradeDistribution(results.map(r => r.current_score)),
      simulated_distribution: computeGradeDistribution(results.map(r => r.simulated_score), modelThresholds),
      delta,
    }

    await completeSimulation({ simulationId: simId, results, metrics, comparison })

    return NextResponse.json({
      success:        true,
      simulation_id:  simId,
      property_count: results.length,
      metrics,
      comparison,
      grade_changes:  results.filter(r => r.grade_changed).length,
    })
  } catch (err) {
    console.error('[simulation POST]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}
