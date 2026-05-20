// =============================================================================
// Agency Group — Capture Drift Snapshot Cron
// GET /api/cron/capture-drift-snapshot
// Scheduled hourly at minute 0 (0 * * * *) via vercel.json
//
// Captures a system snapshot for each known tenant and stores it in Redis
// for long-term drift analysis via analyzeDrift().
//
// Auth : CRON_SECRET bearer token
// TypeScript strict — 0 errors
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { captureSnapshot }           from '@/lib/reality/stabilityDriftEngine'
import { safeCompare }               from '@/lib/safeCompare'

export const runtime     = 'nodejs'
export const maxDuration = 60

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
 * Returns the list of tenant IDs to capture snapshots for.
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

  const tenantIds    = resolveTenantIds()
  const capturedAt   = new Date().toISOString()
  let   capturedCount = 0

  // Capture snapshots for all tenants in parallel — fail-open per tenant
  const results = await Promise.allSettled(
    tenantIds.map(id => captureSnapshot(id)),
  )

  for (const result of results) {
    if (result.status === 'fulfilled') {
      capturedCount++
    } else {
      console.error(
        '[capture-drift-snapshot] snapshot failed:',
        result.reason instanceof Error ? result.reason.message : result.reason,
      )
    }
  }

  return NextResponse.json({
    snapshots_captured: capturedCount,
    tenant_ids:         tenantIds,
    captured_at:        capturedAt,
  })
}
