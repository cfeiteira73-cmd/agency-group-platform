// Agency Group — Disaster Recovery Status API
// app/api/dr/status/route.ts
// GET  /api/dr/status?mode=backup-health|dr-status|test-summary|rpo|all
// POST /api/dr/status — schedule-backup, initiate-dr, run-integrity-check, schedule-tests
// Auth: POST requires Bearer INTERNAL_API_SECRET
// TypeScript strict — 0 errors

import { NextRequest, NextResponse } from 'next/server'
import { safeCompare } from '@/lib/safeCompare'

import {
  scheduleBackup,
  getBackupHealth,
  type BackupType,
  type BackupRegion,
} from '@/lib/dr/backupOrchestrator'
import {
  initiateDrEvent,
  getLatestDrStatus,
  type DrScenario,
} from '@/lib/dr/disasterRecoveryEngine'
import {
  getDrTestSummary,
  runDataIntegrityCheck,
  scheduleNextTests,
} from '@/lib/dr/drTestingSuite'
import { computeRpo } from '@/lib/dr/eventReplayEngine'

export const runtime = 'nodejs'
export const maxDuration = 60

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TENANT_ID = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'

function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const authHeader = req.headers.get('authorization') ?? ''
  const incoming = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  if (!incoming) return false
  return safeCompare(incoming, secret)
}

function ok(data: unknown, status = 200): NextResponse {
  return NextResponse.json({ ok: true, data }, { status })
}

function err(message: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error: message }, { status })
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('mode') ?? 'all'

  try {
    if (mode === 'backup-health') {
      const health = await getBackupHealth()
      return ok(health)
    }

    if (mode === 'dr-status') {
      const status = await getLatestDrStatus(TENANT_ID)
      return ok(status)
    }

    if (mode === 'test-summary') {
      const summary = await getDrTestSummary(TENANT_ID)
      return ok(summary)
    }

    if (mode === 'rpo') {
      const rpo = await computeRpo(TENANT_ID)
      return ok(rpo)
    }

    // Default: combined status
    const [backupHealth, drStatus, testSummary, rpo] = await Promise.allSettled([
      getBackupHealth(),
      getLatestDrStatus(TENANT_ID),
      getDrTestSummary(TENANT_ID),
      computeRpo(TENANT_ID),
    ])

    return ok({
      backup_health: backupHealth.status === 'fulfilled' ? backupHealth.value : null,
      dr_status: drStatus.status === 'fulfilled' ? drStatus.value : null,
      test_summary: testSummary.status === 'fulfilled' ? testSummary.value : null,
      rpo: rpo.status === 'fulfilled' ? rpo.value : null,
      generated_at: new Date().toISOString(),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err(`DR status GET failed: ${message}`, 500)
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return err('Unauthorized', 401)
  }

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return err('Invalid JSON body', 400)
  }

  const action = body.action as string | undefined
  if (!action) return err('Missing action', 400)

  try {
    if (action === 'schedule-backup') {
      const type = body.type as BackupType | undefined
      if (!type) return err('Missing backup type', 400)
      const record = await scheduleBackup(type, TENANT_ID)
      return ok(record, 201)
    }

    if (action === 'initiate-dr') {
      const scenario = body.scenario as DrScenario | undefined
      const primaryRegion = (body.primary_region as BackupRegion | undefined) ?? 'EU_WEST'
      const failoverRegion = (body.failover_region as BackupRegion | undefined) ?? 'EU_SOUTH'
      if (!scenario) return err('Missing scenario', 400)
      const drEvent = await initiateDrEvent(scenario, primaryRegion, failoverRegion)
      return ok(drEvent, 201)
    }

    if (action === 'run-integrity-check') {
      const result = await runDataIntegrityCheck(TENANT_ID)
      return ok(result)
    }

    if (action === 'schedule-tests') {
      const tests = await scheduleNextTests(TENANT_ID)
      return ok({ scheduled: tests.length, tests })
    }

    return err(`Unknown action: ${action}`, 400)
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return err(`DR action "${action}" failed: ${message}`, 500)
  }
}
