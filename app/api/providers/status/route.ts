// app/api/providers/status/route.ts
// GET /api/providers/status — returns health check for all data providers

import { NextResponse } from 'next/server'
import { checkAllProviders } from '@/lib/providers/providerHealthCheck'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function GET(): Promise<NextResponse> {
  try {
    const report = await checkAllProviders()
    return NextResponse.json(report)
  } catch (e) {
    return NextResponse.json(
      { error: 'Provider health check failed', detail: e instanceof Error ? e.message : 'unknown' },
      { status: 500 },
    )
  }
}
