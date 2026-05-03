// =============================================================================
// Agency Group — Platform Config API
// GET  /api/platform/config          → list all config rows (ops_manager+)
// PUT  /api/platform/config          → update a config value (ops_manager+)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { getAdminRole, isRoleAtLeast } from '@/lib/auth/adminAuth'
import { getAllConfig, updateConfigValue, invalidateConfigCache } from '@/lib/platform/config'

export const runtime = 'nodejs'

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function auth(req: NextRequest) {
  const email = req.headers.get('authorization')?.replace('Bearer ', '').trim()
  if (!email) return null
  const admin = await getAdminRole(email)
  if (!admin) return null
  if (!isRoleAtLeast(admin.role, 'ops_manager')) return null
  return { email, role: admin.role }
}

// ---------------------------------------------------------------------------
// GET — list all platform config rows
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const actor = await auth(req)
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  try {
    const rows = await getAllConfig()
    return NextResponse.json({ rows, count: rows.length })
  } catch (err) {
    console.error('[platform/config] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PUT — update a single config value
// ---------------------------------------------------------------------------

interface PutBody {
  key:   string
  value: number | string | boolean
}

export async function PUT(req: NextRequest) {
  const actor = await auth(req)
  if (!actor) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: PutBody
  try {
    body = await req.json() as PutBody
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { key, value } = body

  if (!key || typeof key !== 'string') {
    return NextResponse.json({ error: 'key is required' }, { status: 400 })
  }
  if (value === undefined || value === null) {
    return NextResponse.json({ error: 'value is required' }, { status: 400 })
  }
  if (typeof value !== 'number' && typeof value !== 'string' && typeof value !== 'boolean') {
    return NextResponse.json({ error: 'value must be number, string, or boolean' }, { status: 400 })
  }

  // Validate key format: category.key_name
  if (!/^[a-z_]+\.[a-z_]+$/.test(key)) {
    return NextResponse.json({ error: 'key must be in format category.key_name' }, { status: 400 })
  }

  try {
    await updateConfigValue(key, value, actor.email)
    // Invalidate full cache so GET returns fresh data immediately
    invalidateConfigCache()

    return NextResponse.json({
      success: true,
      key,
      value,
      updated_by: actor.email,
      updated_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[platform/config] PUT error:', err)
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
