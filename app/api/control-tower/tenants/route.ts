// app/api/control-tower/tenants/route.ts
// GET  /api/control-tower/tenants — list all tenants (admin only)
// POST /api/control-tower/tenants — create new tenant (admin only)
// Auth: Bearer INTERNAL_API_SECRET

import { NextRequest, NextResponse } from 'next/server'
import { listTenants, createTenant } from '@/lib/tenant/registry'
import type { CreateTenantInput } from '@/lib/tenant/registry'
import { safeCompare } from '@/lib/safeCompare'

function isAuthorized(req: NextRequest): boolean {
  const token = (req.headers.get('authorization') ?? '').replace('Bearer ', '')
  const secret = process.env.INTERNAL_API_SECRET
  const adminSecret = process.env.ADMIN_SECRET
  return (!!secret && safeCompare(token, secret)) ||
         (!!adminSecret && safeCompare(token, adminSecret))
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const tenants = await listTenants()
  return NextResponse.json({ tenants, count: tenants.length })
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = await req.json() as CreateTenantInput
    if (!body.slug || !body.name || !body.owner_email) {
      return NextResponse.json({ error: 'slug, name, owner_email required' }, { status: 400 })
    }
    const tenant = await createTenant(body)
    if (!tenant) return NextResponse.json({ error: 'Failed to create tenant' }, { status: 500 })
    return NextResponse.json({ tenant }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
