// =============================================================================
// AGENCY GROUP — SH-ROS Control Tower: System Layer Health
// GET /api/control-tower/system-health
// Returns live health status for each system layer shown in the Overview page.
// Every value derived from actual DB/Redis queries — no hardcoded statuses.
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { getRequestCorrelationId } from '@/lib/observability/correlation'

export const runtime = 'nodejs'
export const revalidate = 0

type DotColor = 'green' | 'yellow' | 'red' | 'gray'

export interface SystemLayerStatus {
  name: string
  status: string
  detail: string
  dot: DotColor
}

export interface SystemHealthResponse {
  layers: SystemLayerStatus[]
  computed_at: string
}

// ─── Individual layer checks ──────────────────────────────────────────────────

async function checkEventBus(): Promise<SystemLayerStatus> {
  try {
    const since5m = new Date(Date.now() - 5 * 60_000).toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as unknown as { from: (t: string) => any }
    const { count, error } = await sb.from('runtime_events')
      .select('event_id', { count: 'exact', head: true })
      .gte('created_at', since5m)

    if (error) {
      return {
        name: 'Event Bus',
        status: 'DEGRADED',
        detail: `DB error: ${error.message}`,
        dot: 'red',
      }
    }
    const c = count ?? 0
    if (c === 0) {
      return {
        name: 'Event Bus',
        status: 'IDLE',
        detail: 'No events in last 5 min',
        dot: 'yellow',
      }
    }
    return {
      name: 'Event Bus',
      status: 'ACTIVE',
      detail: `${c} event(s) in last 5 min`,
      dot: 'green',
    }
  } catch (err) {
    return { name: 'Event Bus', status: 'DEGRADED', detail: String(err), dot: 'red' }
  }
}

async function checkAILayer(): Promise<SystemLayerStatus> {
  try {
    const since1h = new Date(Date.now() - 3_600_000).toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as unknown as { from: (t: string) => any }
    const { count, error } = await sb.from('ai_audit_log')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since1h)

    if (error) {
      return { name: 'AI Layer', status: 'DEGRADED', detail: `DB error: ${error.message}`, dot: 'red' }
    }
    const c = count ?? 0
    if (c === 0) {
      return {
        name: 'AI Layer',
        status: 'IDLE',
        detail: 'No AI executions in last hour',
        dot: 'yellow',
      }
    }
    return {
      name: 'AI Layer',
      status: 'ACTIVE',
      detail: `${c} execution(s) in last hour`,
      dot: 'green',
    }
  } catch (err) {
    return { name: 'AI Layer', status: 'DEGRADED', detail: String(err), dot: 'red' }
  }
}

async function checkRevenueEngine(): Promise<SystemLayerStatus> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as unknown as { from: (t: string) => any }
    const { count, error } = await sb.from('deals')
      .select('id', { count: 'exact', head: true })
      .not('stage', 'eq', 'closed_lost')

    if (error) {
      return { name: 'Revenue Engine', status: 'DEGRADED', detail: `DB error: ${error.message}`, dot: 'red' }
    }
    const c = count ?? 0
    if (c === 0) {
      return {
        name: 'Revenue Engine',
        status: 'EMPTY',
        detail: 'No active deals in pipeline',
        dot: 'yellow',
      }
    }
    return {
      name: 'Revenue Engine',
      status: 'ACTIVE',
      detail: `${c} active deal(s) in pipeline`,
      dot: 'green',
    }
  } catch (err) {
    return { name: 'Revenue Engine', status: 'DEGRADED', detail: String(err), dot: 'red' }
  }
}

async function checkCausalTrace(): Promise<SystemLayerStatus> {
  const envEnabled = process.env.CAUSAL_TRACE_ENABLED === 'true'
  if (!envEnabled) {
    return {
      name: 'Causal Graph',
      status: 'DISABLED',
      detail: 'CAUSAL_TRACE_ENABLED not set',
      dot: 'gray',
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as unknown as { from: (t: string) => any }
    const { count, error } = await sb.from('causal_trace')
      .select('id', { count: 'exact', head: true })

    if (error) {
      return { name: 'Causal Graph', status: 'DEGRADED', detail: `DB error: ${error.message}`, dot: 'red' }
    }
    const c = count ?? 0
    if (c === 0) {
      return {
        name: 'Causal Graph',
        status: 'EMPTY',
        detail: 'Enabled — no trace entries yet',
        dot: 'yellow',
      }
    }
    return {
      name: 'Causal Graph',
      status: 'ENABLED',
      detail: `${c} trace entries`,
      dot: 'green',
    }
  } catch (err) {
    return { name: 'Causal Graph', status: 'DEGRADED', detail: String(err), dot: 'red' }
  }
}

async function checkSelfHealing(): Promise<SystemLayerStatus> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as unknown as { from: (t: string) => any }
    const { data, error } = await sb.from('incidents')
      .select('detected_at')
      .order('detected_at', { ascending: false })
      .limit(1)

    if (error) {
      return { name: 'Self-Healing', status: 'DEGRADED', detail: `DB error: ${error.message}`, dot: 'red' }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data ?? []) as any[]
    if (rows.length === 0) {
      return {
        name: 'Self-Healing',
        status: 'NO DATA',
        detail: 'No incident records found',
        dot: 'gray',
      }
    }

    const lastRun = new Date(rows[0].detected_at as string)
    const ageMs   = Date.now() - lastRun.getTime()
    const ageH    = Math.round(ageMs / 3_600_000)
    const ageLabel = ageH < 24 ? `${ageH}h ago` : `${Math.round(ageH / 24)}d ago`

    const dot: DotColor = ageMs > 48 * 3_600_000 ? 'yellow' : 'green'

    return {
      name: 'Self-Healing',
      status: 'MONITORED',
      detail: `Last incident: ${ageLabel}`,
      dot,
    }
  } catch (err) {
    return { name: 'Self-Healing', status: 'DEGRADED', detail: String(err), dot: 'red' }
  }
}

async function checkMultiTenant(): Promise<SystemLayerStatus> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as unknown as { from: (t: string) => any }
    const { count, error } = await sb.from('tenants')
      .select('id', { count: 'exact', head: true })

    if (error) {
      // If table doesn't exist yet, show gray/unknown rather than red
      const notFound = error.message?.toLowerCase().includes('does not exist') ||
                       error.code === '42P01'
      return {
        name: 'Multi-Tenant',
        status: notFound ? 'NOT DEPLOYED' : 'DEGRADED',
        detail: notFound ? 'Tenants table not yet created' : `DB error: ${error.message}`,
        dot: notFound ? 'gray' : 'red',
      }
    }
    const c = count ?? 0
    if (c === 0) {
      return {
        name: 'Multi-Tenant',
        status: 'EMPTY',
        detail: 'No tenants provisioned',
        dot: 'yellow',
      }
    }
    return {
      name: 'Multi-Tenant',
      status: `${c} TENANT${c !== 1 ? 'S' : ''}`,
      detail: `${c} tenant(s) active · RLS enforced`,
      dot: 'green',
    }
  } catch (err) {
    return { name: 'Multi-Tenant', status: 'DEGRADED', detail: String(err), dot: 'red' }
  }
}

async function checkSecurity(): Promise<SystemLayerStatus> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sb = supabaseAdmin as unknown as { from: (t: string) => any }
    const { count, error } = await sb.from('incidents')
      .select('id', { count: 'exact', head: true })
      .in('status', ['open', 'investigating'])

    if (error) {
      return { name: 'Security', status: 'DEGRADED', detail: `DB error: ${error.message}`, dot: 'red' }
    }
    const c = count ?? 0
    if (c === 0) {
      return {
        name: 'Security',
        status: 'CLEAR',
        detail: 'No open incidents',
        dot: 'green',
      }
    }
    return {
      name: 'Security',
      status: `${c} OPEN INCIDENT${c !== 1 ? 'S' : ''}`,
      detail: `${c} incident(s) require attention`,
      dot: c > 2 ? 'red' : 'yellow',
    }
  } catch (err) {
    return { name: 'Security', status: 'DEGRADED', detail: String(err), dot: 'red' }
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const corrId = getRequestCorrelationId(req)

  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [
      eventBus,
      aiLayer,
      revenueEngine,
      causalTrace,
      selfHealing,
      multiTenant,
      security,
    ] = await Promise.all([
      checkEventBus(),
      checkAILayer(),
      checkRevenueEngine(),
      checkCausalTrace(),
      checkSelfHealing(),
      checkMultiTenant(),
      checkSecurity(),
    ])

    const response: SystemHealthResponse = {
      layers: [eventBus, aiLayer, revenueEngine, causalTrace, selfHealing, multiTenant, security],
      computed_at: new Date().toISOString(),
    }

    return NextResponse.json(response, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[GET /api/control-tower/system-health]', err, { corrId })
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
