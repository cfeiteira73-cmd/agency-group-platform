// TypeScript strict — 0 errors
// app/api/sre/region-health/route.ts
// GET  /api/sre/region-health                → getRegionConfigs + checkAllRegionHealth
// GET  /api/sre/region-health?region=eu-west → single region health + history
// GET  /api/sre/region-health?mode=routing   → routeRequest decision
// POST /api/sre/region-health                → force health check on all regions (service auth)

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { safeCompare } from '@/lib/safeCompare'
import {
  getRegionConfigs,
  checkAllRegionHealth,
  routeRequest,
  getRegionHealthHistory,
  type RegionId,
} from '@/lib/sre/activeActiveRouter'
import { CANONICAL_TENANT_UUID } from '@/lib/constants/pipeline'
import log from '@/lib/logger'

export const runtime = 'nodejs'

function resolveTenantId(): string {
  return (
    process.env.DEFAULT_TENANT_ID ??
    process.env.SYSTEM_ORG_ID ??
    CANONICAL_TENANT_UUID
  )
}

function verifyServiceAuth(req: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  if (!secret) return false
  const incoming =
    req.headers.get('x-service-auth') ??
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    ''
  return safeCompare(incoming, secret)
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const authorized = await isPortalAuth(req)
  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = resolveTenantId()
  const { searchParams } = new URL(req.url)
  const region = searchParams.get('region') as RegionId | null
  const mode   = searchParams.get('mode')

  try {
    // mode=routing → return a routing decision
    if (mode === 'routing') {
      const decision = await routeRequest(tenantId)
      return NextResponse.json({ routing_decision: decision })
    }

    // ?region=eu-west → single region details + history
    if (region) {
      const validRegions: RegionId[] = ['eu-west', 'eu-south', 'eu-central']
      if (!validRegions.includes(region)) {
        return NextResponse.json({ error: `Invalid region: ${region}` }, { status: 400 })
      }
      const [configs, health, history] = await Promise.all([
        Promise.resolve(getRegionConfigs()),
        checkAllRegionHealth(),
        getRegionHealthHistory(region, 24),
      ])
      const config = configs.find(c => c.id === region) ?? null
      return NextResponse.json({
        region,
        config,
        current_health: health[region] ?? null,
        history_24h: history,
      })
    }

    // Default → all region configs + live health check
    const [configs, health] = await Promise.all([
      Promise.resolve(getRegionConfigs()),
      checkAllRegionHealth(),
    ])

    return NextResponse.json({
      regions: configs,
      health,
      checked_at: new Date().toISOString(),
    })
  } catch (err) {
    log.error('[/api/sre/region-health] GET error', err instanceof Error ? err : undefined, {
      tenant_id: tenantId,
    })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!verifyServiceAuth(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const health = await checkAllRegionHealth()
    return NextResponse.json({
      message: 'Health check complete',
      health,
      checked_at: new Date().toISOString(),
    })
  } catch (err) {
    log.error('[/api/sre/region-health] POST error', err instanceof Error ? err : undefined)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
