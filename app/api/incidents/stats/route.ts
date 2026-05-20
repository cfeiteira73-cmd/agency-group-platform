// =============================================================================
// Agency Group — Incidents: Stats API
// app/api/incidents/stats/route.ts
//
// GET /api/incidents/stats?tenant_id=xxx&window_hours=24
//   Returns quick aggregate stats for the tenant in the given time window.
//
// Response shape:
//   {
//     total:                  number
//     open:                   number
//     p0:                     number   (severity = 'P0')
//     p1:                     number   (severity = 'P1')
//     p2:                     number   (severity = 'P2')
//     p3:                     number   (severity = 'P3')
//     resolved_today:         number
//     avg_resolution_hours:   number | null
//     most_affected_subsystem: string | null
//   }
//
// Auth: Bearer token via REALITY_API_SECRET env var.
//
// TypeScript strict — 0 errors
// =============================================================================

import { type NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin }                  from '@/lib/supabase'
import type { IncidentRow }               from '@/lib/incidents/incidentIngestor'

// ─── Auth helpers ─────────────────────────────────────────────────────────────

function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

function verifyBearer(request: NextRequest): boolean {
  const secret = process.env.REALITY_API_SECRET
  if (!secret) return false
  const authHeader = request.headers.get('authorization') ?? ''
  const [scheme, token] = authHeader.split(' ')
  return scheme === 'Bearer' && token === secret
}

// ─── Stats response type ──────────────────────────────────────────────────────

interface IncidentStats {
  total:                    number
  open:                     number
  p0:                       number
  p1:                       number
  p2:                       number
  p3:                       number
  resolved_today:           number
  avg_resolution_hours:     number | null
  most_affected_subsystem:  string | null
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!verifyBearer(request)) return unauthorized()

  const { searchParams } = request.nextUrl

  const tenantId    = searchParams.get('tenant_id')
  const windowParam = searchParams.get('window_hours')

  // ── Validate tenant_id ────────────────────────────────────────────────────
  if (!tenantId || tenantId.trim() === '') {
    return badRequest('tenant_id query parameter is required')
  }

  // ── Validate window_hours ─────────────────────────────────────────────────
  let windowHours = 24
  if (windowParam !== null) {
    const parsed = Number(windowParam)
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 8760) {
      return badRequest('window_hours must be a positive number no greater than 8760')
    }
    windowHours = parsed
  }

  const cutoff      = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString()
  const todayStart  = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)
  const todayStartIso = todayStart.toISOString()

  try {
    // ── Fetch all incidents in window ────────────────────────────────────────
    const { data, error } = await (supabaseAdmin as any)
      .from('incidents')
      .select('*')
      .eq('tenant_id', tenantId.trim())
      .gte('detected_at', cutoff)
      .order('detected_at', { ascending: false })

    if (error) {
      console.error('[Incidents Stats API] DB error:', error)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }

    const rows = (data ?? []) as IncidentRow[]

    // ── Compute stats ────────────────────────────────────────────────────────
    let open           = 0
    let p0             = 0
    let p1             = 0
    let p2             = 0
    let p3             = 0
    let resolvedToday  = 0
    const resolutionMs: number[]            = []
    const subsystemFreq: Map<string, number> = new Map()

    for (const row of rows) {
      // Open / active
      if (row.status !== 'resolved' && row.status !== 'autopsy_complete') open++

      // Severity buckets
      switch (row.severity) {
        case 'P0': p0++; break
        case 'P1': p1++; break
        case 'P2': p2++; break
        case 'P3': p3++; break
      }

      // Resolved today
      if (
        (row.status === 'resolved' || row.status === 'autopsy_complete') &&
        row.resolved_at &&
        row.resolved_at >= todayStartIso
      ) {
        resolvedToday++
      }

      // Resolution latency
      if (row.resolved_at) {
        const latencyMs = new Date(row.resolved_at).getTime() - new Date(row.detected_at).getTime()
        if (latencyMs >= 0) resolutionMs.push(latencyMs)
      }

      // Subsystem frequency
      if (row.subsystem) {
        subsystemFreq.set(row.subsystem, (subsystemFreq.get(row.subsystem) ?? 0) + 1)
      }
    }

    // Average resolution in hours (rounded to 2 decimal places)
    let avgResolutionHours: number | null = null
    if (resolutionMs.length > 0) {
      const avgMs = resolutionMs.reduce((s, v) => s + v, 0) / resolutionMs.length
      avgResolutionHours = Math.round((avgMs / 3_600_000) * 100) / 100
    }

    // Most affected subsystem
    let mostAffectedSubsystem: string | null = null
    let maxFreq = 0
    for (const [sub, freq] of subsystemFreq.entries()) {
      if (freq > maxFreq) { maxFreq = freq; mostAffectedSubsystem = sub }
    }

    const stats: IncidentStats = {
      total:                    rows.length,
      open,
      p0,
      p1,
      p2,
      p3,
      resolved_today:           resolvedToday,
      avg_resolution_hours:     avgResolutionHours,
      most_affected_subsystem:  mostAffectedSubsystem,
    }

    return NextResponse.json(stats)
  } catch (err) {
    console.error('[Incidents Stats API] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
