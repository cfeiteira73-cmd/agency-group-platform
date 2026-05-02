// =============================================================================
// Agency Group — Scoring Performance Analytics
// GET /api/analytics/scoring-performance
//
// Returns calibration metrics and recommendations for the opportunity scoring
// engine, based on realized outcomes in scoring_feedback_events.
//
// USE CASES:
//   - Portal dashboard: "How accurate is our scoring?"
//   - Agent review: "Should we trust A+ deals?"
//   - Quarterly calibration: "Are score thresholds still well-calibrated?"
//
// AUTH: x-internal-token or Authorization: Bearer (CRON_SECRET fallback)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { computeCalibrationReport } from '@/lib/scoring/calibrationEngine'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isAuthorized(req: NextRequest): boolean {
  const internalToken = process.env.INTERNAL_API_TOKEN
  const cronSecret    = process.env.CRON_SECRET

  const headerToken =
    req.headers.get('x-internal-token') ??
    req.headers.get('authorization')?.replace('Bearer ', '').trim()

  if (!headerToken) return false
  if (internalToken && headerToken === internalToken) return true
  if (cronSecret    && headerToken === cronSecret)    return true
  return false
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const report = await computeCalibrationReport()

    return NextResponse.json(
      {
        ok:         true,
        report,
        // Convenience: top-level summary for quick dashboard reads
        summary: {
          total_events:  report.total_feedback_events,
          grades:        report.grade_performance.map(g => ({
            grade:           g.grade,
            surfaced:        g.total_surfaced,
            won:             g.deals_won,
            win_rate_pct:    g.win_rate_pct,
            meeting_rate_pct: g.meeting_rate_pct,
          })),
          top_recommendation: report.recommendations[0] ?? null,
          calibration_status: report.data_quality.has_enough_data ? 'calibrated' : 'insufficient_data',
        },
      },
      { status: 200 },
    )
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
