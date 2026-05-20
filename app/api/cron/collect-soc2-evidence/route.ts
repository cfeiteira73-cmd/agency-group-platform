// vercel.json: {"crons": [{"path": "/api/cron/collect-soc2-evidence", "schedule": "0 2 * * *"}]}
// Vercel Cron: daily at 02:00 UTC
// Collects SOC2 Type II evidence automatically via SOC2EvidenceCollector.collectAutomated()

import { NextRequest, NextResponse } from 'next/server'
import { SOC2EvidenceCollector }     from '@/lib/compliance/soc2Evidence'
import { supabaseAdmin }             from '@/lib/supabase'

export const dynamic     = 'force-dynamic'
export const runtime     = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const secret       = req.headers.get('authorization')?.replace('Bearer ', '')
  const cronExpected = process.env.CRON_SECRET
  if (!cronExpected || !secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Timing-safe comparison prevents secret enumeration via timing attacks
  const { timingSafeEqual } = await import('crypto')
  const a = Buffer.from(secret,       'utf8')
  const b = Buffer.from(cronExpected, 'utf8')
  const match = a.length === b.length && timingSafeEqual(a, b)
  if (!match) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const start = Date.now()

  try {
    // ── Resolve org_id ───────────────────────────────────────────────────────
    // Collect for the system/agency org. In multi-tenant production, iterate orgs.
    const org_id = process.env.SYSTEM_ORG_ID ?? process.env.DEFAULT_ORG_ID ?? '00000000-0000-0000-0000-000000000001'

    // ── Run collection ───────────────────────────────────────────────────────
    const collector = new SOC2EvidenceCollector()
    const result    = await collector.collectAutomated(org_id)

    // ── Log to automations_log ───────────────────────────────────────────────
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabaseAdmin as any)
      .from('automations_log')
      .insert({
        workflow_name: 'collect-soc2-evidence',
        status:        result.failed > 0 ? 'partial' : 'success',
        result: {
          collected:        result.collected,
          passed:           result.passed,
          failed:           result.failed,
          controls_covered: result.controls,
          duration_ms:      Date.now() - start,
        },
        created_at: new Date().toISOString(),
      })

    return NextResponse.json({
      collected:        result.collected,
      controls_covered: result.controls,
      timestamp:        new Date().toISOString(),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[collect-soc2-evidence] fatal error:', message)
    return NextResponse.json(
      { collected: 0, controls_covered: [], timestamp: new Date().toISOString(), error: message },
      { status: 500 }
    )
  }
}
