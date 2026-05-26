// app/api/legal/status/route.ts
// GET /api/legal/status — returns status of all legal execution systems

import { NextResponse } from 'next/server'
import { getLegalSystemStatus } from '@/lib/legal/legalExecutionOrchestrator'

export const runtime = 'nodejs'
export const maxDuration = 10

export async function GET(): Promise<NextResponse> {
  try {
    const status = await getLegalSystemStatus()
    const allSystems = [...status.PT.systems, ...status.ES.systems]
    const activeCount = allSystems.filter(s => s.status === 'ACTIVE').length

    return NextResponse.json({
      checked_at: new Date().toISOString(),
      total_systems: allSystems.length,
      active_systems: activeCount,
      PT: status.PT,
      ES: status.ES,
    })
  } catch (e) {
    return NextResponse.json(
      { error: 'Legal status check failed', detail: e instanceof Error ? e.message : 'unknown' },
      { status: 500 },
    )
  }
}
