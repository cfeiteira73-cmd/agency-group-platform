// app/api/vault/snapshot/route.ts
// POST /api/vault/snapshot — triggers a vault snapshot
// Auth: Bearer INTERNAL_API_SECRET

import { NextRequest, NextResponse } from 'next/server'
import { createSnapshot } from '@/lib/vault/snapshotManager'
import { safeCompare } from '@/lib/safeCompare'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  const secret = process.env.INTERNAL_API_SECRET
  const cronSecret = process.env.CRON_SECRET
  if (
    (!secret || !safeCompare(token, secret)) &&
    (!cronSecret || !safeCompare(token, cronSecret))
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const tenantId = req.headers.get('x-tenant-id') ?? 'agency-group'
    const manifest = await createSnapshot(tenantId)
    return NextResponse.json({ ok: true, snapshot_id: manifest.snapshot_id, manifest }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: 'Snapshot failed', detail: String(err) }, { status: 500 })
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ endpoint: '/api/vault/snapshot', method: 'POST', auth: 'Bearer INTERNAL_API_SECRET' })
}
