import { NextRequest, NextResponse } from 'next/server'
import { getSloReport } from '@/lib/sre/sloEngine'
import { runDrCertification } from '@/lib/sre/drCertifier'

export const runtime = 'nodejs'
export const maxDuration = 60

const TENANT_ID = process.env.DEFAULT_TENANT_ID ?? process.env.SYSTEM_ORG_ID ?? '00000000-0000-0000-0000-000000000001'

function bigintReplacer(_key: string, value: unknown) {
  return typeof value === 'bigint' ? value.toString() : value
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode') ?? 'summary'

  if (mode === 'slo') {
    const slos = await getSloReport(TENANT_ID)
    return NextResponse.json({ slos, timestamp: new Date().toISOString() })
  }

  if (mode === 'dr') {
    const cert = await runDrCertification(TENANT_ID)
    return new NextResponse(JSON.stringify(cert, bigintReplacer), { headers: { 'Content-Type': 'application/json' } })
  }

  // Full SRE summary
  const [slos, dr] = await Promise.allSettled([getSloReport(TENANT_ID), runDrCertification(TENANT_ID)])
  return new NextResponse(JSON.stringify({
    slos: slos.status === 'fulfilled' ? slos.value : null,
    dr: dr.status === 'fulfilled' ? dr.value : null,
    timestamp: new Date().toISOString(),
  }, bigintReplacer), { headers: { 'Content-Type': 'application/json' } })
}
