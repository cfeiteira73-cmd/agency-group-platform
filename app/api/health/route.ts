// =============================================================================
// AGENCY GROUP — System Health Check v1.0
// GET /api/health — verify Supabase, AI, and configuration status
// =============================================================================

import { NextResponse } from 'next/server'
import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface ServiceStatus {
  ok: boolean
  latency?: number
  error?: string
  details?: Record<string, unknown>
}

interface HealthReport {
  status: 'healthy' | 'degraded' | 'down'
  timestamp: string
  version: string
  services: {
    supabase: ServiceStatus
    anthropic: ServiceStatus
    env: ServiceStatus
  }
  counts?: {
    contacts: number
    properties: number
    deals: number
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const monitoringSecret = process.env.HEALTH_CHECK_SECRET
  const reqSecret = request.headers.get('x-health-secret')
  if (!monitoringSecret || reqSecret !== monitoringSecret) {
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() }, { status: 200 })
  }
  // Full response continues below for authenticated monitoring...

  const start = Date.now()
  const report: HealthReport = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '3.0.0',
    services: {
      supabase: { ok: false },
      anthropic: { ok: false },
      env: { ok: false },
    },
  }

  // Check environment variables
  const requiredEnv = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'ANTHROPIC_API_KEY',
  ]
  const missingVars = requiredEnv.filter(k => !process.env[k])
  report.services.env = {
    ok: missingVars.length === 0,
    details: missingVars.length > 0 ? { missingCount: missingVars.length } : { all_present: true },
  }

  // Check Supabase
  if (supabaseAdmin) {
    const t0 = Date.now()
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const admin = supabaseAdmin as any
      const [c, p, d] = await Promise.all([
        admin.from('contacts').select('id', { count: 'exact', head: true }),
        admin.from('properties').select('id', { count: 'exact', head: true }),
        admin.from('deals').select('id', { count: 'exact', head: true }),
      ])
      report.services.supabase = {
        ok: !c.error && !p.error && !d.error,
        latency: Date.now() - t0,
        error: c.error?.message || p.error?.message || d.error?.message,
      }
      if (!c.error && !p.error && !d.error) {
        report.counts = {
          contacts: c.count ?? 0,
          properties: p.count ?? 0,
          deals: d.count ?? 0,
        }
      }
    } catch (e) {
      report.services.supabase = { ok: false, error: String(e), latency: Date.now() - t0 }
    }
  }

  // Check Anthropic (just verify key exists and is non-empty)
  const anthropicKey = process.env.ANTHROPIC_API_KEY
  report.services.anthropic = {
    ok: Boolean(anthropicKey && anthropicKey.startsWith('sk-ant-')),
    details: { anthropic: !!process.env.ANTHROPIC_API_KEY },
  }

  // Determine overall status
  const allOk = Object.values(report.services).every(s => s.ok)
  const anyDown = !report.services.supabase.ok
  report.status = allOk ? 'healthy' : anyDown ? 'down' : 'degraded'

  const httpStatus = report.status === 'healthy' ? 200 : 207

  return NextResponse.json({
    ...report,
    // Flat aliases for consumers that check json.status === 'ok' or json.supabase === true
    status: report.status === 'healthy' ? 'ok' : report.status,
    supabase: report.services.supabase.ok,
    _latency_total: Date.now() - start,
  }, {
    status: httpStatus,
    headers: { 'Cache-Control': 'no-store' },
  })
}
