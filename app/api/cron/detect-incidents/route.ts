// =============================================================================
// Agency Group — Detect Incidents Cron
// GET /api/cron/detect-incidents
// Scheduled every 5 minutes (*/5 * * * *) via vercel.json
//
// Scans runtime_events for recent failures and ingests new incidents for all
// configured tenants. Also runs latency-spike detection per tenant.
//
// Auth : CRON_SECRET bearer token
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import {
  detectAndIngestFromRuntimeEvents,
  detectLatencySpike,
} from '@/lib/incidents/incidentIngestor'
import { safeCompare }   from '@/lib/safeCompare'
import { withCronLock }  from '@/lib/ops/withCronLock'

export const runtime     = 'nodejs'
export const maxDuration = 300

// ─── Auth ─────────────────────────────────────────────────────────────────────

function isAuthorized(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const incoming =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace('Bearer ', '')
  return !!incoming && safeCompare(incoming, cronSecret)
}

// ─── Tenant resolution ────────────────────────────────────────────────────────

/**
 * Returns the list of tenant IDs to scan.
 * Reads TENANT_IDS env var (comma-separated). Falls back to ['agency-group'].
 */
function resolveTenantIds(): string[] {
  const raw = process.env.TENANT_IDS
  if (!raw || raw.trim() === '') return ['agency-group']
  return raw
    .split(',')
    .map(id => id.trim())
    .filter(id => id.length > 0)
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Distributed lock — prevents overlap with concurrent invocations.
  // TTL: 6 minutes (maxDuration=300s + 60s buffer). withCronLock returns null
  // when another instance already holds the lock.
  const locked = await withCronLock('detect-incidents', 6, async () => {
    const tenantIds      = resolveTenantIds()
    const allIncidentIds: string[] = []
    const startMs        = Date.now()
    const errors: Array<{ tenant_id: string; error: string }> = []

    // Sequential per-tenant — stop after 240 s to leave 60 s margin within maxDuration=300
    for (const tenantId of tenantIds) {
      if (Date.now() - startMs > 240_000) {
        console.warn(
          `[detect-incidents cron] time budget exceeded, stopping at tenant=${tenantId}`,
        )
        break
      }
      try {
        // Detect failures from runtime_events
        const fromEvents = await detectAndIngestFromRuntimeEvents(tenantId)
        allIncidentIds.push(...fromEvents)

        // Detect latency spikes (threshold: 500 ms)
        const spikeId = await detectLatencySpike(tenantId)
        if (spikeId) allIncidentIds.push(spikeId)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        console.error(`[detect-incidents cron] tenant=${tenantId} error:`, message)
        errors.push({ tenant_id: tenantId, error: message })
      }
    }

    return NextResponse.json({
      incidents_detected: allIncidentIds.length,
      incident_ids:       allIncidentIds,
      detected_at:        new Date().toISOString(),
      duration_ms:        Date.now() - startMs,
      tenants_scanned:    tenantIds.length,
      ...(errors.length > 0 ? { errors } : {}),
    })
  })

  if (locked === null) {
    return NextResponse.json({ skipped: true, reason: 'another_instance_running' })
  }

  return locked
}
