// AGENCY GROUP — SH-ROS | AMI: 22506
// GET  /api/distribution/invite?invite_code=xxx — ViralLoopStats for a code (auth required)
// POST /api/distribution/invite { email, invite_code } — register new agent via invite (PUBLIC)
// =============================================================================

import { NextRequest, NextResponse } from 'next/server'
import { isPortalAuth } from '@/lib/portalAuth'
import { supabaseAdmin } from '@/lib/supabase'
import { logger } from '@/lib/observability/logger'
import {
  createOnboardingProgress,
  computeViralStats,
  type ViralLoopStats,
} from '@/lib/distribution-engine'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const maxDuration = 15

// ---------------------------------------------------------------------------
// Supabase type escape
// ---------------------------------------------------------------------------

type DB = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        limit: (n: number) => Promise<{ data: unknown[] | null; error: unknown }>
      }
    }
    upsert: (
      row: Record<string, unknown>,
      opts?: Record<string, unknown>,
    ) => Promise<{ error: unknown }>
  }
}

// ---------------------------------------------------------------------------
// GET — viral stats for an invite code (portal auth required)
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!(await isPortalAuth(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const invite_code = req.nextUrl.searchParams.get('invite_code')
  if (!invite_code) {
    return NextResponse.json({ error: 'invite_code required' }, { status: 400 })
  }

  const db = supabaseAdmin as unknown as DB

  try {
    const { data: invited, error } = await db
      .from('agent_onboarding')
      .select('agent_id, is_activated, commission_eur')
      .eq('invited_by', invite_code)
      .limit(50)

    if (error) {
      return NextResponse.json(computeViralStats(invite_code, 0, 0))
    }

    const rows = (invited ?? []) as { agent_id: string; is_activated?: boolean; commission_eur?: number }[]
    const agents_activated = rows.filter(r => r.is_activated).length
    // Commission bonus: 1% per activated referral on their deals (estimate €1.5K avg commission × 1%)
    const avg_commission_bonus_eur = 15_000 * 0.01 // €150 per referral deal, simplified
    const total_bonus_eur = agents_activated * avg_commission_bonus_eur

    const stats: ViralLoopStats = computeViralStats(invite_code, agents_activated, total_bonus_eur)
    return NextResponse.json(stats)
  } catch (err) {
    logger.warn('[distribution/invite] GET failed', { invite_code, err })
    return NextResponse.json(computeViralStats(invite_code, 0, 0))
  }
}

// ---------------------------------------------------------------------------
// POST — register new agent via invite link (PUBLIC — no auth)
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: { email?: string; invite_code?: string; name?: string }
  try {
    body = await req.json() as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { email, invite_code } = body

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
  }

  const agent_id = `invite-${randomUUID()}`
  const progress = createOnboardingProgress(agent_id, email, invite_code ?? undefined)

  const db = supabaseAdmin as unknown as DB

  try {
    const { error } = await db
      .from('agent_onboarding')
      .upsert({
        agent_id: progress.agent_id,
        email: progress.email,
        steps_completed: [],
        current_step: 'account',
        completion_pct: 0,
        is_activated: false,
        invite_code: progress.invite_code,
        invited_by: progress.invited_by ?? null,
        started_at: new Date().toISOString(),
        activated_at: null,
        updated_at: new Date().toISOString(),
      })

    if (error) {
      logger.warn('[distribution/invite] POST upsert failed', { email, error })
      // Still return success — onboarding can proceed even if DB insert fails
    }
  } catch (err) {
    logger.warn('[distribution/invite] POST exception', { email, err })
  }

  logger.info('[distribution/invite] new agent registered via invite', {
    agent_id,
    email,
    invite_code,
  })

  return NextResponse.json({
    success: true,
    agent_id,
    invite_code: progress.invite_code,
    message: 'Bem-vindo ao SH-ROS. Verifique o seu email para activar a conta.',
  })
}
